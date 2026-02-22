/// Black-Scholes pricing engine for binary cash-or-nothing options.
///
/// Polymarket BTC markets are binary: they pay $1 if BTC is above (or below)
/// a fixed strike at expiry, and $0 otherwise. This maps to a European
/// cash-or-nothing call, valued as:
///
///   P = N(d2)
///
/// where N is the standard Normal CDF, and
///
///   d1 = (ln(S/K) + (r + σ²/2)·T) / (σ·√T)
///   d2 = d1 − σ·√T
///
/// All Normal distribution functions are implemented inline using the
/// Abramowitz & Stegun rational approximation (|ε| < 7.5×10⁻⁸).

use std::f64::consts::PI;
use serde::{Deserialize, Serialize};

/// Input parameters for Black-Scholes evaluation.
#[derive(Debug, Clone)]
pub struct BsInput {
    /// Current BTC spot price (Binance mid)
    pub spot: f64,
    /// Market strike price (from Polymarket question, e.g. 70_000.0)
    pub strike: f64,
    /// Time to expiry in years (e.g. 5 min = 5/(525_600))
    pub time_to_expiry_years: f64,
    /// Annualized risk-free rate (e.g. 0.05 for 5%)
    pub risk_free_rate: f64,
    /// Annualized implied volatility (e.g. 0.80 for 80%)
    pub sigma: f64,
    /// Current Polymarket YES price (for edge calculation)
    pub market_price: f64,
}

/// Output from Black-Scholes: fair price and Greeks.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BlackScholesResult {
    /// Theoretical probability the option expires in-the-money (= fair YES price)
    pub fair_price: f64,
    /// Delta: sensitivity of fair_price to ±$1 move in BTC
    pub delta: f64,
    /// Gamma: rate of change of Delta per $1 move in BTC
    pub gamma: f64,
    /// Theta: daily time decay (dollars per day)
    pub theta: f64,
    /// Vega: sensitivity to ±1% change in implied vol
    pub vega: f64,
    /// Annualized implied volatility used
    pub implied_vol: f64,
    /// Edge: fair_price − market_price (positive = model says market underprices YES)
    pub edge_vs_market: f64,
}

impl Default for BlackScholesResult {
    fn default() -> Self {
        Self {
            fair_price: 0.5,
            delta: 0.0,
            gamma: 0.0,
            theta: 0.0,
            vega: 0.0,
            implied_vol: 0.80,
            edge_vs_market: 0.0,
        }
    }
}

/// Standard Normal probability density function.
#[inline(always)]
fn norm_pdf(x: f64) -> f64 {
    (-0.5 * x * x).exp() / (2.0 * PI).sqrt()
}

/// Standard Normal CDF via Abramowitz & Stegun approximation 26.2.17.
/// Maximum absolute error: 7.5 × 10⁻⁸.
pub fn norm_cdf(x: f64) -> f64 {
    const P: f64 = 0.2316419;
    const B: [f64; 5] = [
        0.319381530,
        -0.356563782,
        1.781477937,
        -1.821255978,
        1.330274429,
    ];

    let t = 1.0 / (1.0 + P * x.abs());
    let poly = t * (B[0] + t * (B[1] + t * (B[2] + t * (B[3] + t * B[4]))));
    let cdf_positive = 1.0 - norm_pdf(x) * poly;

    if x >= 0.0 {
        cdf_positive
    } else {
        1.0 - cdf_positive
    }
}

/// Compute the Black-Scholes fair value and Greeks for a binary call option.
///
/// Returns `None` if inputs are degenerate (e.g. T ≤ 0, σ ≤ 0, S ≤ 0, K ≤ 0).
pub fn calculate(input: &BsInput) -> Option<BlackScholesResult> {
    let BsInput {
        spot: s,
        strike: k,
        time_to_expiry_years: t,
        risk_free_rate: r,
        sigma,
        market_price,
    } = *input;

    if t <= 0.0 || sigma <= 0.0 || s <= 0.0 || k <= 0.0 {
        return None;
    }

    let sqrt_t = t.sqrt();
    let d1 = (s.ln() - k.ln() + (r + 0.5 * sigma * sigma) * t) / (sigma * sqrt_t);
    let d2 = d1 - sigma * sqrt_t;

    // Fair price = N(d2) for a binary call
    let fair_price = norm_cdf(d2);

    // Delta for binary call: N'(d2) / (S·σ·√T)
    let delta = norm_pdf(d2) / (s * sigma * sqrt_t);

    // Gamma for binary call: -N'(d1)·d1 / (S²·σ²·T)
    let gamma = -norm_pdf(d1) * d1 / (s * s * sigma * sigma * t);

    // Theta (per year) for binary call:
    //   -N'(d2)·[r/(σ·√T) - d1/(2T)] − r·e^{-rT}·N(d2)
    // We report it divided by 365 to get daily theta.
    let theta_annual = -norm_pdf(d2) * (r / (sigma * sqrt_t) - d1 / (2.0 * t))
        - r * (-r * t).exp() * fair_price;
    let theta = theta_annual / 365.0;

    // Vega for binary call (per 1% vol): -N'(d1)·d2·√T / σ  × 0.01
    let vega = -norm_pdf(d1) * d2 * sqrt_t / sigma * 0.01;

    Some(BlackScholesResult {
        fair_price,
        delta,
        gamma,
        theta,
        vega,
        implied_vol: sigma,
        edge_vs_market: fair_price - market_price,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    /// ATM binary call with very short T should give price close to 0.5
    /// (risk-neutral probability of ending ITM when S = K).
    #[test]
    fn atm_binary_call_near_half() {
        let input = BsInput {
            spot: 70_000.0,
            strike: 70_000.0,
            time_to_expiry_years: 5.0 / 525_600.0, // 5 minutes
            risk_free_rate: 0.05,
            sigma: 0.80,
            market_price: 0.50,
        };
        let result = calculate(&input).expect("should compute");
        // For ATM with r > 0, fair_price should be slightly above 0.5
        assert!(
            (result.fair_price - 0.5).abs() < 0.05,
            "ATM price {} not near 0.5",
            result.fair_price
        );
    }

    /// Deep in-the-money binary call should approach 1.0.
    #[test]
    fn deep_itm_approaches_one() {
        let input = BsInput {
            spot: 100_000.0,
            strike: 50_000.0,
            time_to_expiry_years: 1.0 / 365.0,
            risk_free_rate: 0.05,
            sigma: 0.80,
            market_price: 0.90,
        };
        let result = calculate(&input).expect("should compute");
        assert!(result.fair_price > 0.85, "deep ITM price {} < 0.85", result.fair_price);
    }

    /// Deep out-of-the-money binary call should approach 0.0.
    #[test]
    fn deep_otm_approaches_zero() {
        let input = BsInput {
            spot: 50_000.0,
            strike: 100_000.0,
            time_to_expiry_years: 1.0 / 365.0,
            risk_free_rate: 0.05,
            sigma: 0.80,
            market_price: 0.10,
        };
        let result = calculate(&input).expect("should compute");
        assert!(result.fair_price < 0.15, "deep OTM price {} > 0.15", result.fair_price);
    }

    /// Degenerate inputs (T=0) must return None.
    #[test]
    fn degenerate_zero_t_returns_none() {
        let input = BsInput {
            spot: 70_000.0,
            strike: 70_000.0,
            time_to_expiry_years: 0.0,
            risk_free_rate: 0.05,
            sigma: 0.80,
            market_price: 0.5,
        };
        assert!(calculate(&input).is_none());
    }

    /// norm_cdf(0) should be exactly 0.5.
    #[test]
    fn norm_cdf_at_zero() {
        assert!((norm_cdf(0.0) - 0.5).abs() < 1e-6);
    }
}
