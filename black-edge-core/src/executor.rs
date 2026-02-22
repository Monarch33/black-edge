/// Polymarket L2 execution layer.
///
/// Responsibilities:
///   1. Build an EIP-712 typed-data `Order` struct matching the Polymarket
///      CTF Exchange ABI exactly.
///   2. Sign it with the trader's Polygon EOA private key via `ethers`.
///   3. POST the signed order to `https://clob.polymarket.com/order` using a
///      persistent `reqwest::Client` (keep-alive, HTTP/2).
///   4. Enforce a 2 000 ms post-fire cooldown in `HftState` to prevent
///      bankroll draining during volatile ticks.
use std::time::Duration;

use anyhow::{Context, Result};
use chrono::Utc;
use ethers::{
    signers::{LocalWallet, Signer},
    types::{Address, H256, U256},
    utils::keccak256,
};
use reqwest::Client;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use tracing::{error, info, warn};

use crate::state::{SharedCreds, SharedState};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/// Polymarket CLOB REST endpoint for order submission
const ORDER_ENDPOINT: &str = "https://clob.polymarket.com/order";

/// Post-execution cooldown (ms)
const COOLDOWN_MS: i64 = 2_000;

/// Polymarket CTF Exchange contract address on Polygon (used in EIP-712 domain)
/// Mainnet deployment – verify against Polymarket docs if updated.
const CTF_EXCHANGE_ADDRESS: &str = "0x4bFb41d5B3570DeFd03C39a9A4D8dE6Bd8B8982E";

/// Polygon Mainnet chain ID
const POLYGON_CHAIN_ID: u64 = 137;

// ---------------------------------------------------------------------------
// EIP-712 Order struct (matches CTF Exchange ABI exactly)
// ---------------------------------------------------------------------------

/// The canonical Polymarket order struct for EIP-712 signing.
/// Field names intentionally use camelCase to match the Solidity ABI.
#[allow(non_snake_case)]
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Order {
    /// Random salt to prevent replay attacks
    pub salt: U256,
    /// Maker's EOA address (our wallet)
    pub maker: Address,
    /// Signer address (same as maker for EOA orders)
    pub signer: Address,
    /// Taker – zero address for open orders
    pub taker: Address,
    /// Token ID of the conditional outcome token
    pub tokenId: U256,
    /// Amount of USDC to spend (in 6-decimal units)
    pub makerAmount: U256,
    /// Minimum conditional tokens to receive
    pub takerAmount: U256,
    /// Order expiry as Unix timestamp (0 = GTC)
    pub expiration: U256,
    /// Nonce (anti-replay)
    pub nonce: U256,
    /// Protocol fee rate in basis points
    pub feeRateBps: U256,
    /// 0 = BUY, 1 = SELL
    pub side: u8,
    /// 0 = EOA signature
    pub signatureType: u8,
}

/// EIP-712 type string for the Order struct (used in type hash).
const ORDER_TYPE_STRING: &str =
    "Order(uint256 salt,address maker,address signer,address taker,uint256 tokenId,\
     uint256 makerAmount,uint256 takerAmount,uint256 expiration,uint256 nonce,\
     uint256 feeRateBps,uint8 side,uint8 signatureType)";

// ---------------------------------------------------------------------------
// Signed order payload sent to the CLOB API
// ---------------------------------------------------------------------------

#[derive(Debug, Serialize)]
struct SignedOrderPayload {
    order: OrderForApi,
    owner: String,
    #[serde(rename = "orderType")]
    order_type: String,
    signature: String,
}

/// Flattened JSON representation expected by the Polymarket API
#[allow(non_snake_case)]
#[derive(Debug, Serialize)]
struct OrderForApi {
    salt: String,
    maker: String,
    signer: String,
    taker: String,
    tokenId: String,
    makerAmount: String,
    takerAmount: String,
    expiration: String,
    nonce: String,
    feeRateBps: String,
    side: String,
    signatureType: String,
}

impl From<&Order> for OrderForApi {
    fn from(o: &Order) -> Self {
        OrderForApi {
            salt: o.salt.to_string(),
            maker: format!("{:?}", o.maker),
            signer: format!("{:?}", o.signer),
            taker: format!("{:?}", o.taker),
            tokenId: o.tokenId.to_string(),
            makerAmount: o.makerAmount.to_string(),
            takerAmount: o.takerAmount.to_string(),
            expiration: o.expiration.to_string(),
            nonce: o.nonce.to_string(),
            feeRateBps: o.feeRateBps.to_string(),
            side: o.side.to_string(),
            signatureType: o.signatureType.to_string(),
        }
    }
}

// ---------------------------------------------------------------------------
// EIP-712 domain separator + struct hash
// ---------------------------------------------------------------------------

fn domain_separator() -> [u8; 32] {
    // keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)")
    let type_hash = keccak256(
        b"EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)",
    );
    let name_hash = keccak256(b"Polymarket CTF Exchange");
    let version_hash = keccak256(b"1");
    let chain_id = U256::from(POLYGON_CHAIN_ID);
    let contract: Address = CTF_EXCHANGE_ADDRESS.parse().expect("invalid CTF address");

    let mut chain_bytes = [0u8; 32];
    chain_id.to_big_endian(&mut chain_bytes);

    let mut contract_bytes = [0u8; 32];
    contract_bytes[12..].copy_from_slice(contract.as_bytes());

    let encoded = [
        type_hash.as_ref(),
        name_hash.as_ref(),
        version_hash.as_ref(),
        &chain_bytes,
        &contract_bytes,
    ]
    .concat();

    keccak256(encoded)
}

fn order_type_hash() -> [u8; 32] {
    keccak256(ORDER_TYPE_STRING.as_bytes())
}

/// Compute the EIP-712 struct hash for an `Order`.
#[allow(non_snake_case)]
fn order_struct_hash(order: &Order) -> [u8; 32] {
    let type_hash = order_type_hash();

    let mut maker_bytes = [0u8; 32];
    maker_bytes[12..].copy_from_slice(order.maker.as_bytes());

    let mut signer_bytes = [0u8; 32];
    signer_bytes[12..].copy_from_slice(order.signer.as_bytes());

    let mut taker_bytes = [0u8; 32];
    taker_bytes[12..].copy_from_slice(order.taker.as_bytes());

    let u256_to_bytes = |v: U256| {
        let mut b = [0u8; 32];
        v.to_big_endian(&mut b);
        b
    };

    let encoded = [
        type_hash.as_ref(),
        u256_to_bytes(order.salt).as_ref(),
        &maker_bytes,
        &signer_bytes,
        &taker_bytes,
        u256_to_bytes(order.tokenId).as_ref(),
        u256_to_bytes(order.makerAmount).as_ref(),
        u256_to_bytes(order.takerAmount).as_ref(),
        u256_to_bytes(order.expiration).as_ref(),
        u256_to_bytes(order.nonce).as_ref(),
        u256_to_bytes(order.feeRateBps).as_ref(),
        &[0u8; 31][..],
        &[order.side],
        &[0u8; 31][..],
        &[order.signatureType],
    ]
    .concat();

    keccak256(encoded)
}

/// Compute the final EIP-712 digest: `\x19\x01 || domainSep || structHash`
fn eip712_digest(order: &Order) -> [u8; 32] {
    let domain_sep = domain_separator();
    let struct_hash = order_struct_hash(order);

    let mut payload = Vec::with_capacity(2 + 32 + 32);
    payload.extend_from_slice(b"\x19\x01");
    payload.extend_from_slice(&domain_sep);
    payload.extend_from_slice(&struct_hash);

    keccak256(payload)
}

// ---------------------------------------------------------------------------
// Executor
// ---------------------------------------------------------------------------

pub struct Executor {
    http: Client,
    state: SharedState,
    creds: SharedCreds,
}

impl Executor {
    pub fn new(state: SharedState, creds: SharedCreds) -> Self {
        let http = Client::builder()
            .tcp_keepalive(Duration::from_secs(30))
            .timeout(Duration::from_secs(5))
            .build()
            .expect("failed to build reqwest client");

        Self { http, state, creds }
    }

    /// Main loop: check for edge > threshold on every iteration.
    pub async fn run(&self) {
        let mut interval = tokio::time::interval(Duration::from_millis(50)); // 20 Hz check
        loop {
            interval.tick().await;
            if let Err(e) = self.try_execute().await {
                // Log but never panic – execution errors are recoverable
                warn!("[executor] execution cycle error: {e:#}");
            }
        }
    }

    async fn try_execute(&self) -> Result<()> {
        // ---- Read relevant state atomically ----
        let (edge, kelly, token_id, in_cooldown, last_ts, yes_price) = {
            let s = self.state.read().await;
            (
                s.edge,
                s.kelly_fraction,
                s.active_market_token_id.clone(),
                s.in_cooldown,
                s.last_execution_ts,
                s.polymarket_yes_price,
            )
        };

        // ---- Guard: cooldown ----
        let now_ms = Utc::now().timestamp_millis();
        if in_cooldown && (now_ms - last_ts) < COOLDOWN_MS {
            return Ok(()); // still cooling down
        }

        // ---- Guard: minimum edge ----
        if edge < crate::math::MIN_EDGE_THRESHOLD {
            return Ok(());
        }

        // ---- Guard: valid market ----
        if token_id.is_empty() {
            return Ok(());
        }

        // ---- Guard: Kelly fraction meaningful ----
        if kelly <= 0.0 {
            return Ok(());
        }

        // ---- Read credentials ----
        let creds = self.creds.read().await.clone();
        if creds.polygon_private_key.is_empty() {
            warn!("[executor] no private key configured – skipping execution");
            return Ok(());
        }

        // ---- Parse private key + derive wallet ----
        let key_hex = creds
            .polygon_private_key
            .trim_start_matches("0x")
            .to_string();
        let wallet: LocalWallet = key_hex
            .parse()
            .context("invalid polygon_private_key hex")?;
        let maker: Address = wallet.address();

        // ---- Build order parameters ----
        // Assume bankroll = $100 USDC for now; in production read from on-chain balance.
        let bankroll_usdc = 100.0_f64;
        let maker_amount_usdc = (bankroll_usdc * kelly).floor().max(1.0);
        // makerAmount in 6-decimal USDC
        let maker_amount_raw = (maker_amount_usdc * 1_000_000.0) as u64;
        // takerAmount = number of YES shares we expect (price is in [0,1])
        let taker_amount_shares = (maker_amount_usdc / yes_price.max(0.001)) as u64;

        let token_id_u256: U256 = token_id
            .parse()
            .context("token_id is not a valid U256")?;

        let salt = U256::from(rand::random::<u128>());
        let nonce = U256::zero();
        let expiration = U256::zero(); // GTC
        let fee_rate_bps = U256::from(0u32);

        #[allow(non_snake_case)]
        let order = Order {
            salt,
            maker,
            signer: maker,
            taker: Address::zero(),
            tokenId: token_id_u256,
            makerAmount: U256::from(maker_amount_raw),
            takerAmount: U256::from(taker_amount_shares),
            expiration,
            nonce,
            feeRateBps: fee_rate_bps,
            side: 0, // BUY
            signatureType: 0, // EOA
        };

        // ---- Sign ----
        let digest = eip712_digest(&order);
        // sign_hash is synchronous in ethers v2 LocalWallet
        let sig = wallet
            .sign_hash(H256::from(digest))
            .context("signing failed")?;
        let sig_bytes = sig.to_vec();
        let sig_hex = format!("0x{}", hex::encode(&sig_bytes));

        // ---- Craft payload ----
        let payload = SignedOrderPayload {
            order: OrderForApi::from(&order),
            owner: format!("{:?}", maker),
            order_type: "GTC".to_string(),
            signature: sig_hex,
        };

        info!(
            "[executor] FIRING order: edge={edge:.4}  kelly={kelly:.4}  usdc={maker_amount_usdc:.2}  token={token_id}"
        );

        // ---- Mark cooldown BEFORE sending (prevent duplicate fires) ----
        {
            let mut s = self.state.write().await;
            s.in_cooldown = true;
            s.last_execution_ts = now_ms;
        }

        // ---- POST to Polymarket CLOB ----
        let result = self
            .http
            .post(ORDER_ENDPOINT)
            .header("POLY-API-KEY", &creds.polymarket_api_key)
            .header("POLY-SIGNATURE", &creds.polymarket_secret)
            .header("POLY-PASSPHRASE", &creds.polymarket_passphrase)
            .json(&payload)
            .send()
            .await;

        match result {
            Ok(resp) => {
                let status = resp.status();
                let body: Value = resp.json().await.unwrap_or(Value::Null);
                if status.is_success() {
                    let order_id = body
                        .get("orderID")
                        .or_else(|| body.get("order_id"))
                        .and_then(|v| v.as_str())
                        .unwrap_or("unknown")
                        .to_string();
                    info!("[executor] order accepted: id={order_id}");
                    let mut s = self.state.write().await;
                    s.active_orders.insert(order_id, "open".to_string());
                } else {
                    error!("[executor] order rejected: HTTP {status}  body={body}");
                }
            }
            Err(e) => {
                error!("[executor] HTTP POST failed: {e:#}");
            }
        }

        Ok(())
    }
}
