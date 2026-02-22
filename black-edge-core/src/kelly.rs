/// Kelly Criterion position sizing for binary prediction market bets.
///
/// For a binary bet with:
///   p  = win probability (our BS fair_price)
///   q  = 1 − p (loss probability)
///   b  = net odds on a $1 wager = (1 / market_price) − 1
///         (e.g. market_price = 0.68 → b = 0.471)
///
/// The full Kelly fraction is:
///   f* = (b·p − q) / b
///
/// We apply a 25% cap (never bet more than 25% of bankroll regardless of edge)
/// and a 2% minimum edge gate (no trade if edge < 2%).

use serde::{Deserialize, Serialize};

/// Input for Kelly sizing.
#[derive(Debug, Clone)]
pub struct KellyInput {
    /// Win probability derived from Black-Scholes fair_price.
    pub win_prob: f64,
    /// Polymarket YES price (market's implied probability).
    pub market_price: f64,
    /// Total bankroll in USD.
    pub bankroll: f64,
}

/// Output of Kelly sizing calculation.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KellyResult {
    /// Optimal fraction of bankroll to wager (0.0–0.25, capped).
    pub fraction: f64,
    /// Dollar amount to wager = fraction × bankroll.
    pub dollar_amount: f64,
    /// Model edge = win_prob − market_price.
    pub edge: f64,
    /// Net decimal odds = (1 / market_price) − 1.
    pub b: f64,
}

impl Default for KellyResult {
    fn default() -> Self {
        Self {
            fraction: 0.0,
            dollar_amount: 0.0,
            edge: 0.0,
            b: 0.0,
        }
    }
}

/// Maximum fraction of bankroll per trade (hard cap).
const MAX_KELLY_FRACTION: f64 = 0.25;
/// Minimum edge required to generate a non-zero size.
const MIN_EDGE_THRESHOLD: f64 = 0.02;

/// Compute Kelly fraction and dollar size.
///
/// Returns a `KellyResult` with fraction = 0 if edge < MIN_EDGE_THRESHOLD
/// or if market_price is degenerate (≤ 0 or ≥ 1).
pub fn calculate(input: &KellyInput) -> KellyResult {
    let KellyInput {
        win_prob: p,
        market_price,
        bankroll,
    } = *input;

    let edge = p - market_price;

    // Net odds: what we win per dollar risked
    let b = if market_price <= 0.0 || market_price >= 1.0 {
        0.0
    } else {
        1.0 / market_price - 1.0
    };

    if b <= 0.0 || edge < MIN_EDGE_THRESHOLD {
        return KellyResult {
            fraction: 0.0,
            dollar_amount: 0.0,
            edge,
            b,
        };
    }

    let q = 1.0 - p;
    let kelly_raw = (b * p - q) / b;
    let fraction = kelly_raw.max(0.0).min(MAX_KELLY_FRACTION);
    let dollar_amount = fraction * bankroll;

    KellyResult {
        fraction,
        dollar_amount,
        edge,
        b,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Classic Kelly example: fair coin, 2:1 payout → f* = 0.25
    #[test]
    fn classic_kelly_example() {
        // market_price = 0.5, win_prob = 0.6, b = 1.0
        // f* = (1.0 × 0.6 - 0.4) / 1.0 = 0.20
        let result = calculate(&KellyInput {
            win_prob: 0.6,
            market_price: 0.5,
            bankroll: 1000.0,
        });
        assert!((result.fraction - 0.20).abs() < 1e-9, "fraction = {}", result.fraction);
        assert!((result.dollar_amount - 200.0).abs() < 1e-6);
        assert!((result.edge - 0.1).abs() < 1e-9);
    }

    /// No edge → zero size.
    #[test]
    fn no_edge_zero_size() {
        let result = calculate(&KellyInput {
            win_prob: 0.5,
            market_price: 0.5,
            bankroll: 1000.0,
        });
        assert_eq!(result.fraction, 0.0);
        assert_eq!(result.dollar_amount, 0.0);
    }

    /// Below minimum edge threshold → zero size.
    #[test]
    fn below_min_edge_zero_size() {
        let result = calculate(&KellyInput {
            win_prob: 0.51,  // 1% edge, below 2% threshold
            market_price: 0.50,
            bankroll: 1000.0,
        });
        assert_eq!(result.fraction, 0.0);
    }

    /// Capped at MAX_KELLY_FRACTION regardless of huge edge.
    #[test]
    fn large_edge_capped() {
        let result = calculate(&KellyInput {
            win_prob: 0.99,
            market_price: 0.10,
            bankroll: 1000.0,
        });
        assert!(result.fraction <= MAX_KELLY_FRACTION + 1e-10);
    }
}
