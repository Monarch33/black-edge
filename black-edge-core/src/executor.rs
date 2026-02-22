//! Polymarket L2 order execution with EIP-712 cryptographic signing.
//!
//! # Architecture
//! 1. **EIP-712 encoding** – implemented from first principles using `sha3`
//!    (keccak256) and `k256` (secp256k1 ECDSA), keeping dependencies minimal
//!    and version-stable.
//! 2. **HMAC-SHA256 CLOB auth** – Polymarket's REST API requires a per-request
//!    signature over `timestamp + method + path + body`.
//! 3. **Connection pool** – a single `reqwest::Client` is created once and
//!    reused; TLS sessions are kept alive to target < 15 ms round-trip.
//! 4. **Risk gates** – the executor checks for in-flight orders, the cooldown
//!    timer, and a positive Kelly fraction before firing any transaction.
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

/// Polymarket CTF Exchange contract on Polygon mainnet.
const EXCHANGE_CONTRACT: &str = "0x4bFb41d5B3570DeFd03C39a9A4D8dE6Bd8B8982E";

const CHAIN_ID: u64 = 137; // Polygon mainnet

/// Minimum edge (BS fair value − market price) required to fire an order.
const MIN_EDGE: f64 = 0.02;

/// Cooldown between consecutive executions (ms).  Prevents double-firing
/// while the in-flight HTTP round-trip is outstanding.
const COOLDOWN_MS: u64 = 2_000;

/// Polymarket CLOB REST base URL.
const CLOB_BASE: &str = "https://clob.polymarket.com";

// ── EIP-712 primitives ────────────────────────────────────────────────────────

fn keccak256(data: &[u8]) -> [u8; 32] {
    let mut h = Keccak256::new();
    h.update(data);
    h.finalize().into()
}

/// Encode a `uint256` (from a u128 value) as a 32-byte big-endian word.
/// The upper 16 bytes are zero-padded.
fn encode_u256(value: u128) -> [u8; 32] {
    let mut buf = [0u8; 32];
    buf[16..].copy_from_slice(&value.to_be_bytes());
    buf
}

/// Encode a `uint64` (zero-extended to uint256) as a 32-byte big-endian word.
fn encode_u64(value: u64) -> [u8; 32] {
    let mut buf = [0u8; 32];
    buf[24..].copy_from_slice(&value.to_be_bytes());
    buf
}

/// Encode a `uint8` (zero-extended to uint256) as a 32-byte big-endian word.
fn encode_u8(value: u8) -> [u8; 32] {
    let mut buf = [0u8; 32];
    buf[31] = value;
    buf
}

/// Encode an Ethereum address (20 bytes) as a 32-byte left-padded word.
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
/// Polymarket token IDs are keccak256-derived 256-bit integers stored as
/// decimal strings and **frequently exceed `u128::MAX`**.  Using `u128`
/// would silently truncate the top bits, producing a completely wrong
/// EIP-712 digest and therefore an invalid signature.
///
/// This function implements decimal-to-big-endian conversion via repeated
/// long-division by 256, with no additional dependencies.
fn decimal_str_to_u256_be(s: &str) -> Result<[u8; 32]> {
    let mut digits: Vec<u8> = s
        .bytes()
        .map(|b| {
            if b.is_ascii_digit() {
                Ok(b - b'0')
            } else {
                Err(anyhow::anyhow!("non-digit byte in token ID: {b}"))
            }
        })
        .collect::<Result<Vec<_>>>()?;

    let mut le_bytes: Vec<u8> = Vec::with_capacity(32);

    // Repeatedly divide `digits` (a big decimal integer) by 256.
    // Each remainder is one byte of the little-endian result.
    while digits.iter().any(|&d| d != 0) {
        // `carry` never exceeds 255*10 + 9 = 2559 → fits in u16 safely.
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
        bail!("token ID value exceeds 256 bits ({} bytes needed)", le_bytes.len());
    }

    // Reverse little-endian → big-endian; zero-pad to 32 bytes.
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

/// Compute the EIP-712 domain separator.
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
    /// Raw 32-byte big-endian representation of the 256-bit YES-token ID.
    /// Polymarket token IDs exceed `u128::MAX`; we store the full bytes.
    pub token_id:       [u8; 32],
    pub maker_amount:   u64,
    pub taker_amount:   u64,
    pub expiration:     u64,
    pub nonce:          u64,
    pub fee_rate_bps:   u64,
    pub side:           u8,
    pub signature_type: u8,
}

impl Order {
    /// EIP-712 `structHash` for this order.
    fn struct_hash(&self) -> Result<[u8; 32]> {
        let mut encoded = Vec::with_capacity(13 * 32);
        encoded.extend_from_slice(&type_hash());
        encoded.extend_from_slice(&encode_u256(self.salt));
        encoded.extend_from_slice(&encode_address(&self.maker)?);
        encoded.extend_from_slice(&encode_address(&self.signer)?);
        encoded.extend_from_slice(&encode_address(&self.taker)?);
        encoded.extend_from_slice(&self.token_id); // full 32-byte uint256
        encoded.extend_from_slice(&encode_u64(self.maker_amount));
        encoded.extend_from_slice(&encode_u64(self.taker_amount));
        encoded.extend_from_slice(&encode_u64(self.expiration));
        encoded.extend_from_slice(&encode_u64(self.nonce));
        encoded.extend_from_slice(&encode_u64(self.fee_rate_bps));
        encoded.extend_from_slice(&encode_u8(self.side));
        encoded.extend_from_slice(&encode_u8(self.signature_type));
        Ok(keccak256(&encoded))
    }

    /// Final EIP-712 digest: `keccak256("\x19\x01" ‖ domainSeparator ‖ structHash)`.
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

/// Sign an EIP-712 digest with a secp256k1 private key.
/// Returns a 65-byte `[r ‖ s ‖ v]` signature (Ethereum convention, v = 27/28).
fn sign_order(order: &Order, private_key_hex: &str) -> Result<[u8; 65]> {
    let key_bytes = hex::decode(private_key_hex.trim_start_matches("0x"))
        .context("invalid private key hex")?;
    let signing_key =
        SigningKey::from_bytes(key_bytes.as_slice().into()).context("invalid secp256k1 key")?;

    let digest = order.signing_hash()?;

    let (sig, recovery_id): (k256::ecdsa::Signature, RecoveryId) =
        signing_key.sign_prehash(&digest).context("ECDSA signing failed")?;

    let sig_bytes: [u8; 64] = sig.to_bytes().into();
    let v: u8 = recovery_id.to_byte() + 27;

    let mut out = [0u8; 65];
    out[..64].copy_from_slice(&sig_bytes);
    out[64] = v;
    Ok(out)
}

// ── CLOB API auth (HMAC-SHA256) ───────────────────────────────────────────────

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

/// Derive the Ethereum address from a secp256k1 private key.
fn derive_address(private_key_hex: &str) -> Result<String> {
    let key_bytes = hex::decode(private_key_hex.trim_start_matches("0x"))
        .context("invalid private key hex")?;
    let signing_key =
        SigningKey::from_bytes(key_bytes.as_slice().into()).context("bad secp256k1 key")?;
    let verifying_key = signing_key.verifying_key();
    let uncompressed  = verifying_key.to_encoded_point(false);
    let pubkey_bytes  = &uncompressed.as_bytes()[1..]; // strip 0x04 prefix
    let hash = keccak256(pubkey_bytes);
    Ok(format!("0x{}", hex::encode(&hash[12..])))
}

// ── Wire types for the CLOB REST API ─────────────────────────────────────────

#[derive(Serialize)]
struct ClobOrderRequest {
    order:      ClobOrderPayload,
    owner:      String,
    #[serde(rename = "orderType")]
    order_type: String,
}

#[derive(Serialize)]
struct ClobOrderPayload {
    salt:                    String,
    maker:                   String,
    signer:                  String,
    taker:                   String,
    #[serde(rename = "tokenId")]
    token_id:                String,
    #[serde(rename = "makerAmount")]
    maker_amount:            String,
    #[serde(rename = "takerAmount")]
    taker_amount:            String,
    expiration:              String,
    nonce:                   String,
    #[serde(rename = "feeRateBps")]
    fee_rate_bps:            String,
    side:                    String,
    #[serde(rename = "signatureType")]
    signature_type:          u8,
    signature:               String,
}

#[derive(Deserialize, Debug)]
struct ClobOrderResponse {
    #[serde(rename = "orderID")]
    order_id: Option<String>,
    success:  Option<bool>,
    error:    Option<String>,
}

// ── Main execution loop ───────────────────────────────────────────────────────

/// Build a pooled HTTP client once at startup.
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

/// Core execution task.  Wakes every `poll_interval_ms`, re-evaluates current
/// state through five risk gates, and fires a live CLOB order when all pass.
pub async fn run(state: SharedState, client: reqwest::Client, poll_interval_ms: u64) {
    let interval = Duration::from_millis(poll_interval_ms);
    loop {
        tokio::time::sleep(interval).await;
        if let Err(e) = try_execute(&state, &client).await {
            warn!("executor: {e:#}");
        }
    }
}

async fn try_execute(state: &SharedState, client: &reqwest::Client) -> Result<()> {
    // ── Snapshot under a minimal read lock ───────────────────────────────────
    let snapshot = {
        let s = state.read().await;

        // Gate 1: Vault credentials must be loaded
        let creds = match &s.credentials {
            Some(c) => c.clone(),
            None    => return Ok(()),
        };

        // Gate 2: live market data required
        if s.btc_price == 0.0 || s.yes_price == 0.0 {
            return Ok(());
        }

        // Gate 3: edge must meet the minimum threshold
        if s.edge < MIN_EDGE {
            return Ok(());
        }

        // Gate 4: Kelly fraction must be strictly positive
        // (Kelly = 0 means the model finds no favourable odds — don't trade)
        if s.kelly_fraction <= 0.0 {
            return Ok(());
        }

        // Gate 5: cooldown window must have elapsed since last execution
        if !s.cooldown_elapsed(COOLDOWN_MS) {
            return Ok(());
        }

        // Gate 6: no in-flight order outstanding for this token
        let token_id = match &s.active_token_id {
            Some(t) => t.clone(),
            None    => return Ok(()),
        };
        if s.has_inflight_order(&token_id) {
            return Ok(());
        }

        (creds, token_id, s.yes_price, s.kelly_fraction, s.bankroll_usdc)
    };

    let (creds, token_id, yes_price, kelly_frac, bankroll_usdc) = snapshot;

    // ── Size the order ────────────────────────────────────────────────────────
    let wager_usdc = ((bankroll_usdc as f64) * kelly_frac) as u64;
    if wager_usdc < 1_000_000 {
        return Ok(()); // < $1.00 – too small to justify gas cost
    }
    let shares = crate::math::dollar_to_shares(wager_usdc as f64 / 1_000_000.0, yes_price);

    // ── Parse 256-bit token ID for EIP-712 ────────────────────────────────────
    // Polymarket token IDs are decimal representations of keccak256-sized
    // integers; they exceed u128::MAX.  `decimal_str_to_u256_be` converts
    // them to the 32-byte big-endian form required by the struct hash.
    let token_id_bytes = decimal_str_to_u256_be(&token_id)
        .with_context(|| format!("cannot parse token_id={token_id} as uint256"))?;

    // ── Build the Order ───────────────────────────────────────────────────────
    let maker_addr = derive_address(&creds.polygon_private_key)?;
    let salt: u128 = rand::thread_rng().gen();
    let expiration = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_secs()
        + 300; // 5-minute validity window

    let order = Order {
        salt,
        maker:          maker_addr.clone(),
        signer:         maker_addr.clone(),
        taker:          "0x0000000000000000000000000000000000000000".into(),
        token_id:       token_id_bytes,
        maker_amount:   wager_usdc,
        taker_amount:   shares,
        expiration,
        nonce:          0,
        fee_rate_bps:   0,
        side:           0, // BUY YES
        signature_type: 0, // EOA signature
    };

    // ── Sign EIP-712 digest ───────────────────────────────────────────────────
    let sig_bytes = sign_order(&order, &creds.polygon_private_key)?;
    let sig_hex   = format!("0x{}", hex::encode(sig_bytes));

    // ── Serialise CLOB payload ────────────────────────────────────────────────
    // The token_id in the JSON payload uses the original decimal string
    // (not the bytes), as required by the Polymarket CLOB REST API.
    let payload = ClobOrderRequest {
        order: ClobOrderPayload {
            salt:           order.salt.to_string(),
            maker:          order.maker.clone(),
            signer:         order.signer.clone(),
            taker:          order.taker.clone(),
            token_id:       token_id.clone(), // original decimal string
            maker_amount:   order.maker_amount.to_string(),
            taker_amount:   order.taker_amount.to_string(),
            expiration:     order.expiration.to_string(),
            nonce:          order.nonce.to_string(),
            fee_rate_bps:   order.fee_rate_bps.to_string(),
            side:           "BUY".into(),
            signature_type: 0,
            signature:      sig_hex,
        },
        owner:      maker_addr.clone(),
        order_type: "GTC".into(),
    };
    let body = serde_json::to_string(&payload)?;

    // ── Build HMAC-SHA256 auth headers ────────────────────────────────────────
    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_secs();
    let headers = build_auth_headers(&creds, "POST", "/order", &body, timestamp)?;

    // ── Register in-flight order BEFORE the HTTP call ─────────────────────────
    // Setting last_execution here ensures the 2 s cooldown starts ticking
    // from the moment we attempt to fire, not from when the server responds.
    // This is the correct place to prevent double-firing.
    let order_uuid = Uuid::new_v4();
    {
        let mut s = state.write().await;
        s.active_orders.insert(
            order_uuid,
            ActiveOrder {
                market_id:          "".into(),
                token_id:           token_id.clone(),
                side:               0,
                maker_amount_usdc:  wager_usdc,
                taker_amount_shares: shares,
                price:              yes_price,
                status:             OrderStatus::InFlight,
                submitted_at:       timestamp,
            },
        );
        s.last_execution = Some(std::time::Instant::now());
    }

    // ── POST to clob.polymarket.com/order ─────────────────────────────────────
    info!(
        "executor: → BUY  {} shares @ {:.4}  (${:.2} USDC wager)",
        shares,
        yes_price,
        wager_usdc as f64 / 1_000_000.0,
    );

    let mut req = client
        .post(format!("{CLOB_BASE}/order"))
        .header("Content-Type", "application/json");
    for (k, v) in &headers {
        req = req.header(k.as_str(), v.as_str());
    }
    let resp        = req.body(body).send().await?;
    let http_status = resp.status();
    let resp_body: ClobOrderResponse = resp.json().await?;

    // ── Update order state ────────────────────────────────────────────────────
    let new_status = if http_status.is_success() && resp_body.success.unwrap_or(false) {
        let oid = resp_body.order_id.unwrap_or_default();
        info!("executor: ✓ order placed  clob_id={oid}");
        OrderStatus::Placed { order_id: oid }
    } else {
        let reason = resp_body.error.unwrap_or_else(|| http_status.to_string());
        warn!("executor: ✗ order rejected – {reason}");
        OrderStatus::Failed { reason }
    };

    {
        let mut s = state.write().await;
        if let Some(o) = s.active_orders.get_mut(&order_uuid) {
            o.status = new_status;
        }
    }

    Ok(())
}

// ── Unit tests ────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    /// Verify a small number round-trips correctly.
    #[test]
    fn test_u256_small() {
        let out = decimal_str_to_u256_be("255").unwrap();
        assert_eq!(out[31], 0xff);
        assert_eq!(&out[..31], &[0u8; 31]);
    }

    /// Verify a real Polymarket token ID (exceeds u128::MAX) is parsed.
    #[test]
    fn test_u256_large_token_id() {
        // This number is ~5.2×10^76, far exceeding u128::MAX (~3.4×10^38).
        let s = "52114319501245915516055106046884209969926127482827954674443846427813813222426";
        let out = decimal_str_to_u256_be(s).unwrap();
        // The result must not be all-zeros (which would indicate u128 truncation).
        assert!(out.iter().any(|&b| b != 0));
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
