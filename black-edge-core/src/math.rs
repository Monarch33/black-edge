// d1/d2 and should_trade are public API fields; suppress dead-code noise for them.
#![allow(dead_code)]

/// Black-Scholes pricing for **cash-or-nothing binary call options** and
/// Kelly Criterion position sizing.
///
/// Binary call pays $1 if S_T > K at expiry, $0 otherwise.
/// Fair value  = e^{-rT} * N(d2)
/// For Polymarket we set r = 0 so: fair_value = N(d2).
use chrono::Utc;

// ---------------------------------------------------------------------------
// Normal CDF  – Abramowitz & Stegun approximation (7-term, max |error| < 7.5e-8)
// ---------------------------------------------------------------------------

/// Cumulative standard normal distribution Φ(x).
pub fn norm_cdf(x: f64) -> f64 {
    if x > 8.0 {
        return 1.0;
    }
    if x < -8.0 {
        return 0.0;
    }

    let is_negative = x < 0.0;
    let z = x.abs();

    // Horner-form polynomial approximation for the complementary CDF tail
    let t = 1.0 / (1.0 + 0.2316419 * z);
    let poly = t * (0.319_381_53
        + t * (-0.356_563_782
            + t * (1.781_477_937
                + t * (-1.821_255_978 + t * 1.330_274_429))));
    let pdf = (-0.5 * z * z).exp() / std::f64::consts::SQRT_2 / std::f64::consts::PI.sqrt();
    let q = pdf * poly;

    if is_negative {
        q
    } else {
        1.0 - q
    }
}

/// Standard normal PDF φ(x).
#[inline]
pub fn norm_pdf(x: f64) -> f64 {
    (-0.5 * x * x).exp() / (2.0 * std::f64::consts::PI).sqrt()
}

// ---------------------------------------------------------------------------
// Black-Scholes binary call
// ---------------------------------------------------------------------------

/// Inputs for the BS binary option pricer.
#[derive(Debug, Clone)]
pub struct BsInput {
    /// Underlying spot price (e.g. BTC in USD)
    pub spot: f64,
    /// Strike price
    pub strike: f64,
    /// Implied volatility (annualised, e.g. 0.80 = 80 %)
    pub iv: f64,
    /// Time to expiry in **seconds** (computed from live market end time)
    pub tte_secs: f64,
    /// Risk-free rate (set to 0 for prediction markets)
    pub risk_free: f64,
}

impl BsInput {
    /// Time to expiry in years.
    #[inline]
    pub fn tte_years(&self) -> f64 {
        // Floor at 1 second to avoid division by zero at expiry
        self.tte_secs.max(1.0) / 31_557_600.0 // seconds per Julian year
    }
}

#[derive(Debug, Clone)]
pub struct BsOutput {
    /// Fair value of the binary call (probability × discount factor; r=0 → prob only)
    pub fair_value: f64,
    /// d1 intermediate
    pub d1: f64,
    /// d2 intermediate
    pub d2: f64,
    /// Delta: ∂V/∂S
    pub delta: f64,
    /// Gamma: ∂²V/∂S²
    pub gamma: f64,
    /// Theta: ∂V/∂t (per day, negative = time decay)
    pub theta: f64,
    /// Vega: ∂V/∂σ (per 1 % move in IV)
    pub vega: f64,
}

/// Price a **cash-or-nothing binary call** and compute first-order Greeks.
///
/// Returns `None` if inputs are degenerate (spot/strike ≤ 0, IV ≤ 0, TTE ≤ 0).
pub fn price_binary_call(inp: &BsInput) -> Option<BsOutput> {
    if inp.spot <= 0.0 || inp.strike <= 0.0 || inp.iv <= 0.0 {
        return None;
    }

    let t = inp.tte_years();
    if t <= 0.0 {
        return None;
    }

    let sigma_sqrt_t = inp.iv * t.sqrt();
    let ln_s_k = (inp.spot / inp.strike).ln();

    let d1 = (ln_s_k + (inp.risk_free + 0.5 * inp.iv * inp.iv) * t) / sigma_sqrt_t;
    let d2 = d1 - sigma_sqrt_t;

    let discount = (-inp.risk_free * t).exp();
    let nd2 = norm_cdf(d2);
    let nd2_neg = norm_cdf(-d2);
    let phi_d2 = norm_pdf(d2);

    let fair_value = discount * nd2;

    // Delta for binary call: e^{-rT} * φ(d2) / (S * σ * √T)
    let delta = discount * phi_d2 / (inp.spot * sigma_sqrt_t);

    // Gamma: ∂Delta/∂S  = -d1 * φ(d2) * e^{-rT} / (S² σ² T)
    let gamma = -d1 * discount * phi_d2 / (inp.spot * inp.spot * inp.iv * inp.iv * t);

    // Theta (per calendar year → convert to per day at end)
    // θ = r·e^{-rT}·N(d2) + e^{-rT}·φ(d2)·[d1/(2T) - r/σ√T·... ] (full formula)
    // Simplified for r=0:  θ = φ(d2) * d1 / (2 * σ * T) / S ... per year
    // We use the standard closed-form:
    let theta_annual = inp.risk_free * discount * nd2
        - discount * phi_d2 * (d1 / (2.0 * t) - inp.risk_free / sigma_sqrt_t);
    // Polymarket trades in real calendar time; express theta per trading day
    let theta = -theta_annual / 365.0;

    // Vega: ∂V/∂σ expressed per 1 % move in vol
    // For binary call: ∂V/∂σ = -e^{-rT} φ(d2) * d1 / σ
    let vega = -discount * phi_d2 * d1 / inp.iv / 100.0; // per 1 % IV

    let _ = nd2_neg; // suppress unused warning

    Some(BsOutput {
        fair_value,
        d1,
        d2,
        delta,
        gamma,
        theta,
        vega,
    })
}

// ---------------------------------------------------------------------------
// Kelly Criterion
// ---------------------------------------------------------------------------

/// Kelly sizing result.
#[derive(Debug, Clone)]
pub struct KellyOutput {
    /// Raw (uncapped) Kelly fraction
    pub raw_fraction: f64,
    /// Capped fraction (max = `MAX_KELLY_FRACTION`)
    pub capped_fraction: f64,
    /// True if edge is sufficient to place a bet
    pub should_trade: bool,
}

/// Maximum allowed position size as fraction of bankroll.
pub const MAX_KELLY_FRACTION: f64 = 0.25;

/// Minimum required edge (bs_fair_value - market_price) to enter a position.
pub const MIN_EDGE_THRESHOLD: f64 = 0.02; // 2 %

/// Classic Kelly: f* = (b·p − q) / b
///
/// For a binary market with payout b=1 (bet $1 to win $1):
///   f* = p − q = 2p − 1
///
/// We generalise slightly: the market is priced at `market_price` so the
/// effective net odds are:
///   b = (1 − market_price) / market_price   (payout per $ risked if we win)
///
/// Then standard Kelly: f* = (b·p − (1−p)) / b
pub fn kelly_size(bs_probability: f64, market_price: f64) -> KellyOutput {
    // Edge check
    let edge = bs_probability - market_price;
    if edge < MIN_EDGE_THRESHOLD || market_price <= 0.0 || market_price >= 1.0 {
        return KellyOutput {
            raw_fraction: 0.0,
            capped_fraction: 0.0,
            should_trade: false,
        };
    }

    // Net odds b = (payout if win) / (amount at risk)
    // On a binary that costs `market_price` per share and pays $1 on win:
    let b = (1.0 - market_price) / market_price;
    let p = bs_probability;
    let q = 1.0 - p;

    let raw = (b * p - q) / b;
    let raw = raw.max(0.0); // floor at 0 – never go short

    let capped = raw.min(MAX_KELLY_FRACTION);

    KellyOutput {
        raw_fraction: raw,
        capped_fraction: capped,
        should_trade: capped > 0.0,
    }
}

// ---------------------------------------------------------------------------
// Convenience: compute TTE from a known expiry Unix timestamp
// ---------------------------------------------------------------------------

/// Returns seconds until `expiry_unix` from the current UTC time.
/// Returns 0.0 if expiry has already passed.
pub fn tte_from_expiry(expiry_unix: i64) -> f64 {
    let now = Utc::now().timestamp();
    (expiry_unix - now).max(0) as f64
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_norm_cdf_known_values() {
        assert!((norm_cdf(0.0) - 0.5).abs() < 1e-6);
        assert!((norm_cdf(1.96) - 0.975).abs() < 1e-3);
        assert!((norm_cdf(-1.96) - 0.025).abs() < 1e-3);
    }

    #[test]
    fn test_binary_call_atm() {
        // ATM binary: fair value should be close to 0.5
        let inp = BsInput {
            spot: 100.0,
            strike: 100.0,
            iv: 0.80,
            tte_secs: 300.0, // 5 minutes
            risk_free: 0.0,
        };
        let out = price_binary_call(&inp).unwrap();
        // With 5-min TTE and 80% IV, d2 is slightly negative → price slightly below 0.5
        assert!(out.fair_value > 0.0 && out.fair_value < 1.0);
    }

    #[test]
    fn test_kelly_no_edge() {
        let result = kelly_size(0.52, 0.52); // zero edge
        assert!(!result.should_trade);
    }

    #[test]
    fn test_kelly_sufficient_edge() {
        let result = kelly_size(0.60, 0.50); // 10% edge
        assert!(result.should_trade);
        assert!(result.capped_fraction <= MAX_KELLY_FRACTION);
        assert!(result.capped_fraction > 0.0);
    }

    #[test]
    fn test_kelly_capped() {
        // Huge edge → raw Kelly might exceed cap
        let result = kelly_size(0.95, 0.50);
        assert!(result.capped_fraction <= MAX_KELLY_FRACTION);
    }
}
