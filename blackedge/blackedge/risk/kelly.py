"""
Critère de Kelly (Fractional) — Risk Manager (Le Garde-Fou)
===========================================================
f* = (bp - q) / b
Module mathématique pur — PAS d'IA.
"""

from blackedge.config import BlackEdgeSettings


def kelly_fraction(
    win_prob: float,
    loss_prob: float,
    decimal_odds: float,
    fraction: float = 0.5,
) -> float:
    """
    Calcule la fraction de Kelly pour un pari binaire.

    Formule : f* = (bp - q) / b
    - p = probabilité de gain
    - q = probabilité de perte = 1 - p
    - b = cote décimale nette (profit par unité mise)

    Pour un marché YES à prix `price` :
    - Si on gagne : on reçoit 1/price par unité (gain net = 1/price - 1)
    - b = (1/price) - 1

    Args:
        win_prob: Probabilité de gain (estimation IA)
        loss_prob: Probabilité de perte (1 - win_prob)
        decimal_odds: Cote décimale = 1/price pour YES
        fraction: Fractional Kelly (0.5 = demi-Kelly)

    Returns:
        Fraction du bankroll à miser, entre 0 et max_position_pct.
    """
    if decimal_odds <= 1.0 or win_prob <= 0 or win_prob >= 1:
        return 0.0

    b = decimal_odds - 1.0  # profit net par unité
    q = loss_prob
    p = win_prob

    f_star = (b * p - q) / b
    f_star = max(0.0, f_star)
    f_fractional = f_star * fraction
    return f_fractional


def position_size_usd(
    portfolio_usd: float,
    win_prob: float,
    price: float,
    side: str,
    settings: BlackEdgeSettings | None = None,
) -> float:
    """
    Calcule la taille de position en USD pour un trade.

    Args:
        portfolio_usd: Valeur totale du portfolio
        win_prob: Probabilité de gain (IA)
        price: Prix actuel du token (YES ou NO)
        side: "YES" ou "NO"
        settings: Configuration (kelly_fraction, max_position_pct)

    Returns:
        Montant en USD à miser (0 si pas d'edge).
    """
    cfg = settings or BlackEdgeSettings()

    if portfolio_usd <= 0 or price <= 0 or price >= 1:
        return 0.0

    # Pour YES : odds = 1/price. Pour NO : odds = 1/(1-price)
    if side.upper() == "YES":
        decimal_odds = 1.0 / price
        loss_prob = 1.0 - win_prob
    else:
        decimal_odds = 1.0 / (1.0 - price)
        loss_prob = win_prob  # inversé
        win_prob = 1.0 - win_prob

    f = kelly_fraction(
        win_prob=win_prob,
        loss_prob=loss_prob,
        decimal_odds=decimal_odds,
        fraction=cfg.kelly_fraction,
    )

    if f <= 0:
        return 0.0

    max_pct = cfg.max_position_pct / 100.0
    f_capped = min(f, max_pct)
    return portfolio_usd * f_capped
