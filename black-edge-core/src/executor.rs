//! Polymarket L2 order execution with EIP-712 cryptographic signing.
//!
//! # Execution modes
//! 1. **BUY** – opens a new long position when Black-Scholes edge ≥ 2 %,
//!    Kelly > 0, cooldown elapsed, no in-flight BUY outstanding.
//! 2. **SELL (take-profit)** – closes the position when unrealised ROI reaches
//!    the take-profit target (20 %), locking in profit before expiry.
//!
//! # MEV / slippage protection
//! - BUY orders use 0.5 % slippage tolerance on `takerAmount` (accepts
//!   slightly fewer shares), preventing fill at a stale/worse price.
//! - SELL orders use 0.5 % slippage tolerance on `takerAmount` (accepts
//!   slightly fewer USDC), ensuring the order matches even in fast markets.
//! - `feeRateBps = 0` (correct for CLOB GTC orders — fee is on-chain).
//! - 5-minute `expiration` auto-cancels unmatched orders after the window.
//! - On-chain MEV sandwich attacks are not applicable to CLOB limit orders.
//!
//! # EIP-712 type string (Polymarket CTF Exchange, Polygon mainnet)
//! ```text
//! Order(uint256 salt,address maker,address signer,address taker,
//!       uint256 tokenId,uint256 makerAmount,uint256 takerAmount,
//!       uint256 expiration,uint256 nonce,uint256 feeRateBps,
//!       uint8 side,uint8 signatureType)
//! ```

use std::time::{Duration, SystemTime, UNIX_EPOCH};

use anyhow::{bail, Context, Result};
use hmac::{Hmac, Mac};
use k256::ecdsa::{signature::hazmat::PrehashSigner, RecoveryId, SigningKey};
use rand::Rng;
use serde::{Deserialize, Serialize};
use sha2::Sha256;
use sha3::{Digest, Keccak256};
use tracing::{info, warn};
use uuid::Uuid;

use crate::state::{ActiveOrder, EngineCredentials, OrderStatus, SharedState};

// ── Constants ─────────────────────────────────────────────────────────────────

const EXCHANGE_CONTRACT: &str = "0x4bFb41d5B3570DeFd03C39a9A4D8dE6Bd8B8982E";
const CHAIN_ID:          u64  = 137; // Polygon mainnet
const CLOB_BASE:         &str = "https://clob.polymarket.com";

const MIN_EDGE:          f64  = 0.02;   // 2 % minimum edge to enter
const COOLDOWN_MS:       u64  = 2_000;  // 2 s between executions
const TAKE_PROFIT_ROI:   f64  = 0.20;   // exit at +20 % unrealised ROI
const MIN_SELL_SHARES:   f64  = 0.001;  // minimum position size worth selling
const SLIPPAGE_BPS:      f64  = 0.005;  // 0.5 % slippage tolerance

// ── EIP-712 primitives ────────────────────────────────────────────────────────

fn keccak256(data: &[u8]) -> [u8; 32] {
    let mut h = Keccak256::new();
    h.update(data);
    h.finalize().into()
}

fn encode_u256(value: u128) -> [u8; 32] {
    let mut buf = [0u8; 32];
    buf[16..].copy_from_slice(&value.to_be_bytes());
    buf
}

fn encode_u64(value: u64) -> [u8; 32] {
    let mut buf = [0u8; 32];
    buf[24..].copy_from_slice(&value.to_be_bytes());
    buf
}

fn encode_u8(value: u8) -> [u8; 32] {
    let mut buf = [0u8; 32];
    buf[31] = value;
    buf
}

fn encode_address(hex_addr: &str) -> Result<[u8; 32]> {
    let clean = hex_addr.trim_start_matches("0x");
    let bytes = hex::decode(clean).context("invalid address hex")?;
    if bytes.len() != 20 {
        bail!("address must be 20 bytes, got {}", bytes.len());
    }
    let mut buf = [0u8; 32];
    buf[12..].copy_from_slice(&bytes);
    Ok(buf)
}

/// Parse a Polymarket token ID (decimal string, up to 256-bit) into the
/// 32-byte big-endian representation required for EIP-712 struct hashing.
///
/// Polymarket token IDs exceed `u128::MAX` — using `u128` would truncate the
/// top 128 bits and produce an invalid signature.  This function implements
/// arbitrary-precision decimal→bytes via long-division by 256 (no extra deps).
fn decimal_str_to_u256_be(s: &str) -> Result<[u8; 32]> {
    let mut digits: Vec<u8> = s
        .bytes()
        .map(|b| {
            if b.is_ascii_digit() { Ok(b - b'0') }
            else { Err(anyhow::anyhow!("non-digit byte in token ID: {b}")) }
        })
        .collect::<Result<Vec<_>>>()?;

    let mut le_bytes: Vec<u8> = Vec::with_capacity(32);

    while digits.iter().any(|&d| d != 0) {
        let mut carry: u32 = 0;
        let mut new_digits: Vec<u8> = Vec::with_capacity(digits.len());
        let mut leading = true;

        for &d in &digits {
            carry = carry * 10 + d as u32;
            let q = (carry / 256) as u8;
            carry %= 256;
            if q != 0 || !leading {
                new_digits.push(q);
                leading = false;
            }
        }
        le_bytes.push(carry as u8);
        digits = new_digits;
    }

    if le_bytes.len() > 32 {
        bail!("token ID value exceeds 256 bits");
    }

    let mut out = [0u8; 32];
    for (i, &b) in le_bytes.iter().enumerate() {
        out[31 - i] = b;
    }
    Ok(out)
}

// ── EIP-712 domain & type hash ────────────────────────────────────────────────

const ORDER_TYPE_STRING: &str =
    "Order(uint256 salt,address maker,address signer,address taker,\
     uint256 tokenId,uint256 makerAmount,uint256 takerAmount,\
     uint256 expiration,uint256 nonce,uint256 feeRateBps,\
     uint8 side,uint8 signatureType)";

fn type_hash() -> [u8; 32] {
    keccak256(ORDER_TYPE_STRING.as_bytes())
}

fn domain_separator() -> Result<[u8; 32]> {
    let domain_type_hash = keccak256(
        b"EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)",
    );
    let name_hash    = keccak256(b"Polymarket CTF Exchange");
    let version_hash = keccak256(b"1");

    let mut encoded = Vec::with_capacity(5 * 32);
    encoded.extend_from_slice(&domain_type_hash);
    encoded.extend_from_slice(&name_hash);
    encoded.extend_from_slice(&version_hash);
    encoded.extend_from_slice(&encode_u64(CHAIN_ID));
    encoded.extend_from_slice(&encode_address(EXCHANGE_CONTRACT)?);
    Ok(keccak256(&encoded))
}

// ── Order struct & hash ───────────────────────────────────────────────────────

#[derive(Debug, Clone)]
pub struct Order {
    pub salt:           u128,
    pub maker:          String,
    pub signer:         String,
    pub taker:          String,
    /// Full 32-byte big-endian Polymarket YES-token ID (256-bit).
    pub token_id:       [u8; 32],
    /// BUY: USDC spent (6-dec).  SELL: YES shares given (6-dec).
    pub maker_amount:   u64,
    /// BUY: YES shares received (6-dec).  SELL: USDC expected (6-dec).
    pub taker_amount:   u64,
    pub expiration:     u64,
    pub nonce:          u64,
    pub fee_rate_bps:   u64,
    /// 0 = BUY, 1 = SELL
    pub side:           u8,
    pub signature_type: u8,
}

impl Order {
    fn struct_hash(&self) -> Result<[u8; 32]> {
        let mut encoded = Vec::with_capacity(13 * 32);
        encoded.extend_from_slice(&type_hash());
        encoded.extend_from_slice(&encode_u256(self.salt));
        encoded.extend_from_slice(&encode_address(&self.maker)?);
        encoded.extend_from_slice(&encode_address(&self.signer)?);
        encoded.extend_from_slice(&encode_address(&self.taker)?);
        encoded.extend_from_slice(&self.token_id); // full 256-bit
        encoded.extend_from_slice(&encode_u64(self.maker_amount));
        encoded.extend_from_slice(&encode_u64(self.taker_amount));
        encoded.extend_from_slice(&encode_u64(self.expiration));
        encoded.extend_from_slice(&encode_u64(self.nonce));
        encoded.extend_from_slice(&encode_u64(self.fee_rate_bps));
        encoded.extend_from_slice(&encode_u8(self.side));
        encoded.extend_from_slice(&encode_u8(self.signature_type));
        Ok(keccak256(&encoded))
    }

    pub fn signing_hash(&self) -> Result<[u8; 32]> {
        let ds = domain_separator()?;
        let sh = self.struct_hash()?;
        let mut msg = Vec::with_capacity(66);
        msg.extend_from_slice(b"\x19\x01");
        msg.extend_from_slice(&ds);
        msg.extend_from_slice(&sh);
        Ok(keccak256(&msg))
    }
}

// ── ECDSA signing ─────────────────────────────────────────────────────────────

fn sign_order(order: &Order, private_key_hex: &str) -> Result<[u8; 65]> {
    let key_bytes = hex::decode(private_key_hex.trim_start_matches("0x"))
        .context("invalid private key hex")?;
    let signing_key =
        SigningKey::from_bytes(key_bytes.as_slice().into()).context("invalid secp256k1 key")?;
    let digest = order.signing_hash()?;
    let (sig, recovery_id): (k256::ecdsa::Signature, RecoveryId) =
        signing_key.sign_prehash(&digest).context("ECDSA signing failed")?;
    let sig_bytes: [u8; 64] = sig.to_bytes().into();
    let mut out = [0u8; 65];
    out[..64].copy_from_slice(&sig_bytes);
    out[64] = recovery_id.to_byte() + 27;
    Ok(out)
}

// ── CLOB auth (HMAC-SHA256) ────────────────────────────────────────────────────

type HmacSha256 = Hmac<Sha256>;

fn build_auth_headers(
    creds: &EngineCredentials,
    method: &str,
    path: &str,
    body: &str,
    timestamp: u64,
) -> Result<Vec<(String, String)>> {
    let message = format!("{timestamp}{method}{path}{body}");
    let mut mac = HmacSha256::new_from_slice(creds.polymarket_secret.as_bytes())
        .context("HMAC key error")?;
    mac.update(message.as_bytes());
    let signature = base64::Engine::encode(
        &base64::engine::general_purpose::STANDARD,
        mac.finalize().into_bytes(),
    );
    let maker_addr = derive_address(&creds.polygon_private_key)?;
    Ok(vec![
        ("POLY_ADDRESS".into(),    maker_addr),
        ("POLY-SIGNATURE".into(),  signature),
        ("POLY-TIMESTAMP".into(),  timestamp.to_string()),
        ("POLY-API-KEY".into(),    creds.polymarket_api_key.clone()),
        ("POLY-PASSPHRASE".into(), creds.polymarket_passphrase.clone()),
    ])
}

fn derive_address(private_key_hex: &str) -> Result<String> {
    let key_bytes = hex::decode(private_key_hex.trim_start_matches("0x"))
        .context("invalid private key hex")?;
    let signing_key =
        SigningKey::from_bytes(key_bytes.as_slice().into()).context("bad secp256k1 key")?;
    let verifying_key = signing_key.verifying_key();
    let uncompressed   = verifying_key.to_encoded_point(false);
    let pubkey_bytes   = &uncompressed.as_bytes()[1..];
    let hash = keccak256(pubkey_bytes);
    Ok(format!("0x{}", hex::encode(&hash[12..])))
}

// ── Wire types ────────────────────────────────────────────────────────────────

#[derive(Serialize)]
struct ClobOrderRequest {
    order:      ClobOrderPayload,
    owner:      String,
    #[serde(rename = "orderType")]
    order_type: String,
}

#[derive(Serialize)]
struct ClobOrderPayload {
    salt:                 String,
    maker:                String,
    signer:               String,
    taker:                String,
    #[serde(rename = "tokenId")]
    token_id:             String,
    #[serde(rename = "makerAmount")]
    maker_amount:         String,
    #[serde(rename = "takerAmount")]
    taker_amount:         String,
    expiration:           String,
    nonce:                String,
    #[serde(rename = "feeRateBps")]
    fee_rate_bps:         String,
    side:                 String,
    #[serde(rename = "signatureType")]
    signature_type:       u8,
    signature:            String,
}

#[derive(Deserialize, Debug)]
struct ClobOrderResponse {
    #[serde(rename = "orderID")]
    order_id: Option<String>,
    success:  Option<bool>,
    error:    Option<String>,
}

// ── HTTP client ───────────────────────────────────────────────────────────────

pub fn build_http_client() -> Result<reqwest::Client> {
    reqwest::ClientBuilder::new()
        .pool_idle_timeout(Duration::from_secs(90))
        .pool_max_idle_per_host(4)
        .tcp_keepalive(Duration::from_secs(30))
        .tcp_nodelay(true)
        .timeout(Duration::from_millis(5_000))
        .build()
        .context("failed to build reqwest client")
}

// ── Execution loop ────────────────────────────────────────────────────────────

/// Wakes every `poll_interval_ms`, checks all risk gates, and fires BUY or
/// SELL orders when conditions are met.
pub async fn run(state: SharedState, client: reqwest::Client, poll_interval_ms: u64) {
    let interval = Duration::from_millis(poll_interval_ms);
    loop {
        tokio::time::sleep(interval).await;
        if let Err(e) = try_execute(&state, &client).await {
            warn!("executor: {e:#}");
        }
    }
}

// ── Action determination ──────────────────────────────────────────────────────

enum ExecutionAction {
    /// No trade warranted.
    None,
    /// Open a new long position.
    Buy {
        creds:        EngineCredentials,
        token_id:     String,
        yes_price:    f64,
        kelly_frac:   f64,
        bankroll_usdc: u64,
    },
    /// Close existing position to lock in profit.
    Sell {
        creds:     EngineCredentials,
        token_id:  String,
        yes_price: f64,
        shares:    f64,
    },
}

async fn try_execute(state: &SharedState, client: &reqwest::Client) -> Result<()> {
    let action = {
        let s = state.read().await;

        // Gate: credentials required for any action
        let creds = match &s.credentials {
            Some(c) => c.clone(),
            None    => return Ok(()),
        };

        // Gate: live prices required
        if s.btc_price == 0.0 || s.yes_price == 0.0 {
            return Ok(());
        }

        let token_id = match &s.active_token_id {
            Some(t) => t.clone(),
            None    => return Ok(()),
        };

        // ── Priority 1: Take-profit SELL ──────────────────────────────────────
        // Close the position if unrealised ROI hits the target AND no in-flight
        // SELL is already outstanding.
        if s.current_position_shares > MIN_SELL_SHARES
            && s.average_entry_price > 0.0
            && s.yes_price >= s.average_entry_price * (1.0 + TAKE_PROFIT_ROI)
            && s.cooldown_elapsed(COOLDOWN_MS)
            && !s.has_inflight_sell(&token_id)
        {
            ExecutionAction::Sell {
                creds,
                token_id,
                yes_price: s.yes_price,
                shares:    s.current_position_shares,
            }
        }
        // ── Priority 2: BUY when edge is positive ─────────────────────────────
        else if s.edge >= MIN_EDGE
            && s.kelly_fraction > 0.0
            && s.cooldown_elapsed(COOLDOWN_MS)
            && !s.has_inflight_order(&token_id)
        {
            ExecutionAction::Buy {
                creds,
                token_id,
                yes_price:     s.yes_price,
                kelly_frac:    s.kelly_fraction,
                bankroll_usdc: s.bankroll_usdc,
            }
        }
        else {
            ExecutionAction::None
        }
    };

    match action {
        ExecutionAction::None => Ok(()),
        ExecutionAction::Buy { creds, token_id, yes_price, kelly_frac, bankroll_usdc } => {
            execute_buy(state, client, creds, token_id, yes_price, kelly_frac, bankroll_usdc).await
        }
        ExecutionAction::Sell { creds, token_id, yes_price, shares } => {
            execute_sell(state, client, creds, token_id, yes_price, shares).await
        }
    }
}

// ── BUY execution ─────────────────────────────────────────────────────────────

async fn execute_buy(
    state:         &SharedState,
    client:        &reqwest::Client,
    creds:         EngineCredentials,
    token_id:      String,
    yes_price:     f64,
    kelly_frac:    f64,
    bankroll_usdc: u64,
) -> Result<()> {
    // ── Size the order ────────────────────────────────────────────────────────
    let wager_usdc = ((bankroll_usdc as f64) * kelly_frac) as u64;
    if wager_usdc < 1_000_000 {
        return Ok(()); // < $1.00 – not worth gas
    }

    // Shares with 0.5% slippage buffer (accept slightly fewer shares to
    // protect against price moving against us during HTTP round-trip).
    let shares_raw = crate::math::dollar_to_shares(wager_usdc as f64 / 1_000_000.0, yes_price);
    let shares     = (shares_raw as f64 * (1.0 - SLIPPAGE_BPS)) as u64;

    // ── Build and sign order ──────────────────────────────────────────────────
    let token_id_bytes = decimal_str_to_u256_be(&token_id)
        .with_context(|| format!("invalid token_id={token_id}"))?;
    let maker_addr = derive_address(&creds.polygon_private_key)?;
    let salt: u128 = rand::thread_rng().gen();
    let expiration = now_secs() + 300;

    let order = Order {
        salt, maker: maker_addr.clone(), signer: maker_addr.clone(),
        taker:          "0x0000000000000000000000000000000000000000".into(),
        token_id:       token_id_bytes,
        maker_amount:   wager_usdc,
        taker_amount:   shares,
        expiration,     nonce: 0, fee_rate_bps: 0,
        side:           0, // BUY
        signature_type: 0,
    };

    let (sig_hex, body, headers) = sign_and_build(&order, &creds, &token_id, "BUY")?;
    let _ = sig_hex; // used inside sign_and_build

    // ── Register in-flight order BEFORE HTTP call (prevents double-fire) ──────
    let order_uuid = Uuid::new_v4();
    {
        let mut s = state.write().await;
        s.active_orders.insert(order_uuid, ActiveOrder {
            market_id:           "".into(),
            token_id:            token_id.clone(),
            side:                0,
            maker_amount_usdc:   wager_usdc,
            taker_amount_shares: shares,
            price:               yes_price,
            status:              OrderStatus::InFlight,
            submitted_at:        now_secs(),
        });
        s.last_execution = Some(std::time::Instant::now());
    }

    info!(
        "executor: → BUY  {} shares @ {:.4}  (${:.2} USDC wager)",
        shares, yes_price, wager_usdc as f64 / 1_000_000.0,
    );

    let resp_body = post_order(client, body, headers).await?;
    let (new_status, placed) = parse_response(resp_body);

    {
        let mut s = state.write().await;
        if let Some(o) = s.active_orders.get_mut(&order_uuid) {
            o.status = new_status;
        }
        // Update inventory only on confirmed placement
        if placed {
            let new_shares    = shares as f64 / 1_000_000.0;
            let cost_dollars  = wager_usdc as f64 / 1_000_000.0;
            s.add_to_position(new_shares, cost_dollars);
        }
    }

    Ok(())
}

// ── SELL execution (take-profit) ──────────────────────────────────────────────

async fn execute_sell(
    state:     &SharedState,
    client:    &reqwest::Client,
    creds:     EngineCredentials,
    token_id:  String,
    yes_price: f64,
    shares:    f64,
) -> Result<()> {
    let shares_fixed  = (shares * 1_000_000.0) as u64;
    let usdc_dollars  = shares * yes_price;
    // Accept 0.5% slippage: ensure order fills even if price ticks slightly against us
    let taker_usdc = (usdc_dollars * 1_000_000.0 * (1.0 - SLIPPAGE_BPS)) as u64;

    let token_id_bytes = decimal_str_to_u256_be(&token_id)
        .with_context(|| format!("invalid token_id={token_id}"))?;
    let maker_addr = derive_address(&creds.polygon_private_key)?;
    let salt: u128 = rand::thread_rng().gen();
    let expiration = now_secs() + 300;

    let order = Order {
        salt, maker: maker_addr.clone(), signer: maker_addr.clone(),
        taker:          "0x0000000000000000000000000000000000000000".into(),
        token_id:       token_id_bytes,
        maker_amount:   shares_fixed, // YES tokens given
        taker_amount:   taker_usdc,   // USDC expected back
        expiration,     nonce: 0, fee_rate_bps: 0,
        side:           1, // SELL
        signature_type: 0,
    };

    let (sig_hex, body, headers) = sign_and_build(&order, &creds, &token_id, "SELL")?;
    let _ = sig_hex;

    let order_uuid = Uuid::new_v4();
    {
        let mut s = state.write().await;
        s.active_orders.insert(order_uuid, ActiveOrder {
            market_id:           "".into(),
            token_id:            token_id.clone(),
            side:                1,
            maker_amount_usdc:   shares_fixed, // shares given (see note in ActiveOrder)
            taker_amount_shares: taker_usdc,   // USDC expected (see note)
            price:               yes_price,
            status:              OrderStatus::InFlight,
            submitted_at:        now_secs(),
        });
        s.last_execution = Some(std::time::Instant::now());
        // Do NOT clear position yet – wait for confirmed placement
    }

    let pnl = (yes_price - {
        // read entry price for the log line (can't hold lock across await)
        let s = state.read().await;
        s.average_entry_price
    }) * shares;
    info!(
        "executor: → SELL  {:.2} YES shares @ {:.4}  (est. P&L ${:+.2})",
        shares, yes_price, pnl,
    );

    let resp_body = post_order(client, body, headers).await?;
    let (new_status, placed) = parse_response(resp_body);

    {
        let mut s = state.write().await;
        if let Some(o) = s.active_orders.get_mut(&order_uuid) {
            o.status = new_status;
        }
        if placed {
            // Clear position; bankroll update happens when fill is confirmed on-chain
            s.clear_position();
            info!("executor: ✓ SELL placed – position closed, profit locked");
        }
    }

    Ok(())
}

// ── Shared helpers ────────────────────────────────────────────────────────────

fn now_secs() -> u64 {
    SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_secs()
}

/// Build EIP-712 signed payload + auth headers for a CLOB POST /order call.
fn sign_and_build(
    order:    &Order,
    creds:    &EngineCredentials,
    token_id_str: &str,
    side_str: &str,
) -> Result<(String, String, Vec<(String, String)>)> {
    let sig_bytes = sign_order(order, &creds.polygon_private_key)?;
    let sig_hex   = format!("0x{}", hex::encode(sig_bytes));

    let payload = ClobOrderRequest {
        order: ClobOrderPayload {
            salt:           order.salt.to_string(),
            maker:          order.maker.clone(),
            signer:         order.signer.clone(),
            taker:          order.taker.clone(),
            token_id:       token_id_str.to_string(),
            maker_amount:   order.maker_amount.to_string(),
            taker_amount:   order.taker_amount.to_string(),
            expiration:     order.expiration.to_string(),
            nonce:          order.nonce.to_string(),
            fee_rate_bps:   order.fee_rate_bps.to_string(),
            side:           side_str.to_string(),
            signature_type: 0,
            signature:      sig_hex.clone(),
        },
        owner:      order.maker.clone(),
        order_type: "GTC".into(),
    };
    let body = serde_json::to_string(&payload)?;

    let ts      = now_secs();
    let headers = build_auth_headers(creds, "POST", "/order", &body, ts)?;

    Ok((sig_hex, body, headers))
}

async fn post_order(
    client:  &reqwest::Client,
    body:    String,
    headers: Vec<(String, String)>,
) -> Result<ClobOrderResponse> {
    let mut req = client
        .post(format!("{CLOB_BASE}/order"))
        .header("Content-Type", "application/json");
    for (k, v) in &headers {
        req = req.header(k.as_str(), v.as_str());
    }
    let resp = req.body(body).send().await?;
    Ok(resp.json::<ClobOrderResponse>().await?)
}

fn parse_response(resp: ClobOrderResponse) -> (OrderStatus, bool) {
    if resp.success.unwrap_or(false) {
        let oid = resp.order_id.unwrap_or_default();
        info!("executor: ✓ order placed  clob_id={oid}");
        (OrderStatus::Placed { order_id: oid }, true)
    } else {
        let reason = resp.error.unwrap_or_else(|| "unknown error".into());
        warn!("executor: ✗ order rejected – {reason}");
        (OrderStatus::Failed { reason }, false)
    }
}

// ── Unit tests ────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_u256_small() {
        let out = decimal_str_to_u256_be("255").unwrap();
        assert_eq!(out[31], 0xff);
        assert_eq!(&out[..31], &[0u8; 31]);
    }

    #[test]
    fn test_u256_large_token_id() {
        let s = "52114319501245915516055106046884209969926127482827954674443846427813813222426";
        let out = decimal_str_to_u256_be(s).unwrap();
        assert!(out.iter().any(|&b| b != 0), "large token ID must not be all-zeros");
    }

    #[test]
    fn test_u256_zero() {
        let out = decimal_str_to_u256_be("0").unwrap();
        assert_eq!(out, [0u8; 32]);
    }

    #[test]
    fn test_u256_rejects_non_digit() {
        assert!(decimal_str_to_u256_be("12x4").is_err());
    }
}
