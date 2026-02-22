//! Quantitative finance primitives for the HFT engine.
//!
//! # What lives here
//! - `norm_cdf`      – Standard-normal CDF (Abramowitz & Stegun 26.2.17)
//! - `bs_binary_call`– Black-Scholes price for a cash-or-nothing binary call
//! - `kelly_fraction` – Full-Kelly bet size, clamped for risk management
//! - `compute_edge`  – Signed edge between model price and market price
//!
//! All functions are pure (no I/O, no global state) and safe to call from any
//! async context without acquiring a lock.

use std::f64::consts::PI;

// ── Normal distribution ───────────────────────────────────────────────────────

/// Cumulative distribution function for N(0, 1).
///
/// Uses the rational-polynomial approximation from Abramowitz & Stegun §26.2.17
/// with a maximum absolute error of 7.5 × 10⁻⁸.  Fast enough for real-time
/// option repricing on every Binance tick.
pub fn norm_cdf(x: f64) -> f64 {
    let t = 1.0 / (1.0 + 0.2316419 * x.abs());
    let d = (-(x * x) / 2.0).exp() / (2.0 * PI).sqrt();
    let poly = t * (0.319_381_530
        + t * (-0.356_563_782
            + t * (1.781_477_937
                + t * (-1.821_255_978 + t * 1.330_274_429))));
    let cdf = 1.0 - d * poly;
    if x >= 0.0 { cdf } else { 1.0 - cdf }
}

/// Probability density function for N(0, 1).
pub fn norm_pdf(x: f64) -> f64 {
    (-(x * x) / 2.0).exp() / (2.0 * PI).sqrt()
}

// ── Black-Scholes binary option ───────────────────────────────────────────────

/// Black-Scholes price for a **cash-or-nothing binary call** (pays $1 if S > K
/// at expiry, $0 otherwise).
///
/// This is equivalent to the risk-neutral probability that BTC finishes above
/// the strike, which is the fair value of a Polymarket YES token.
///
/// # Parameters
/// - `s`     – Underlying spot price (BTC/USDC)
/// - `k`     – Strike price (BTC/USDC)
/// - `r`     – Annualised risk-free rate (e.g. `0.05` = 5 %)
/// - `sigma` – Annualised volatility (e.g. `0.80` = 80 %)
/// - `t`     – Time to expiry in **years** (5 min = `5.0 / 525_600.0`)
///
/// Returns a value in [0.0, 1.0].
pub fn bs_binary_call(s: f64, k: f64, r: f64, sigma: f64, t: f64) -> f64 {
    if t <= 0.0 || sigma <= 0.0 || s <= 0.0 || k <= 0.0 {
        // Expired or degenerate inputs: return intrinsic value
        return if s > k { 1.0 } else { 0.0 };
    }
    let d2 = ((s / k).ln() + (r - 0.5 * sigma * sigma) * t) / (sigma * t.sqrt());
    (-r * t).exp() * norm_cdf(d2)
}

/// Delta of the binary call (first derivative with respect to S).
///
/// Useful for understanding how sensitive the fair value is to BTC price moves.
pub fn bs_binary_call_delta(s: f64, k: f64, r: f64, sigma: f64, t: f64) -> f64 {
    if t <= 0.0 || sigma <= 0.0 || s <= 0.0 || k <= 0.0 {
        return 0.0;
    }
    let d2 = ((s / k).ln() + (r - 0.5 * sigma * sigma) * t) / (sigma * t.sqrt());
    (-r * t).exp() * norm_pdf(d2) / (s * sigma * t.sqrt())
}

// ── Kelly Criterion ───────────────────────────────────────────────────────────

/// Kelly-optimal fraction of bankroll for a binary bet.
///
/// # Formula
/// ```text
/// f* = (b·p − q) / b
/// ```
/// where:
/// - `b = (1 / implied_prob) − 1`  (decimal odds minus 1)
/// - `p = win_prob`                 (model probability)
/// - `q = 1 − p`                   (model loss probability)
///
/// The result is clamped to [0, `max_fraction`].  Negative Kelly (unfavourable
/// bet) returns 0.0 — we never short YES tokens in this engine.
///
/// # Parameters
/// - `win_prob`      – Model win probability from Black-Scholes (0.0–1.0)
/// - `implied_prob`  – Market YES price / implied probability (0.0–1.0)
/// - `max_fraction`  – Hard cap, e.g. `0.02` = never risk more than 2 %
pub fn kelly_fraction(win_prob: f64, implied_prob: f64, max_fraction: f64) -> f64 {
    if implied_prob <= 0.0 || implied_prob >= 1.0 || win_prob <= 0.0 {
        return 0.0;
    }
    let b = 1.0 / implied_prob - 1.0; // decimal odds
    let q = 1.0 - win_prob;
    let full_kelly = (b * win_prob - q) / b;
    full_kelly.max(0.0).min(max_fraction)
}

/// Signed edge between model fair value and market price.
///
/// Positive → our model says the token is underpriced → BUY signal.
/// Negative → our model says the token is overpriced  → no trade.
pub fn compute_edge(bs_fair_value: f64, market_price: f64) -> f64 {
    bs_fair_value - market_price
}

/// Convert a dollar wager to YES-token quantity at the current market price.
///
/// Returns the integer quantity (6-decimal) to place as `takerAmount`.
pub fn dollar_to_shares(dollar_amount: f64, yes_price: f64) -> u64 {
    if yes_price <= 0.0 {
        return 0;
    }
    let shares = dollar_amount / yes_price;
    (shares * 1_000_000.0) as u64 // 6-decimal fixed point
}

// ── Tests ─────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn norm_cdf_known_values() {
        assert!((norm_cdf(0.0) - 0.5).abs() < 1e-6, "CDF(0) = 0.5");
        assert!((norm_cdf(1.960) - 0.975).abs() < 1e-3, "CDF(1.96) ≈ 0.975");
        assert!((norm_cdf(-1.96) - 0.025).abs() < 1e-3, "CDF(-1.96) ≈ 0.025");
        assert!(norm_cdf(10.0) > 0.9999, "CDF(10) → 1");
    }

    #[test]
    fn bs_binary_at_the_money() {
        // ATM, short expiry → fair value ≈ 0.5 (slight drift from r)
        let fv = bs_binary_call(50_000.0, 50_000.0, 0.0, 0.80, 5.0 / 525_600.0);
        assert!(fv > 0.40 && fv < 0.60, "ATM fair value ≈ 0.5, got {fv}");
    }

    #[test]
    fn bs_binary_deep_itm() {
        // S >> K → fair value → 1
        let fv = bs_binary_call(100_000.0, 50_000.0, 0.05, 0.80, 5.0 / 525_600.0);
        assert!(fv > 0.99, "Deep ITM → near 1, got {fv}");
    }

    #[test]
    fn bs_binary_deep_otm() {
        // S << K → fair value → 0
        let fv = bs_binary_call(10_000.0, 50_000.0, 0.05, 0.80, 5.0 / 525_600.0);
        assert!(fv < 0.01, "Deep OTM → near 0, got {fv}");
    }

    #[test]
    fn kelly_positive_edge() {
        // Win prob 60 %, market implies 50 % → positive bet
        let f = kelly_fraction(0.60, 0.50, 0.05);
        assert!(f > 0.0 && f <= 0.05, "Kelly with edge: {f}");
    }

    #[test]
    fn kelly_zero_edge() {
        let f = kelly_fraction(0.50, 0.50, 0.05);
        assert!(f.abs() < 1e-10, "Kelly with no edge: {f}");
    }

    #[test]
    fn kelly_negative_edge_is_zero() {
        // Market is priced above our model → do NOT bet
        let f = kelly_fraction(0.40, 0.50, 0.05);
        assert_eq!(f, 0.0, "Negative-edge Kelly should be 0");
    }
}
