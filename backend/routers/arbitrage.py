"""
Arbitrage Router: API Endpoints for Arbitrage Operations
=========================================================
REST endpoints for querying and executing arbitrage opportunities.
"""

from datetime import datetime
from typing import Optional
from uuid import uuid4

from fastapi import APIRouter, HTTPException, status, Query
import structlog

from config import get_settings
from api.dependencies import CurrentUser, RunnerUser, WhaleUser
from models.schemas import (
    User,
    UserTier,
    ArbitrageOpportunityResponse,
    ArbitrageTypeEnum,
    RiskAssessmentResponse,
    ExecutionRequest,
    ExecutionResult,
    redact_opportunity,
)
from engine import ArbitrageDetector, ArbitrageType, MarketState

logger = structlog.get_logger()
settings = get_settings()

router = APIRouter(prefix="/arbitrage", tags=["Arbitrage"])


# =============================================================================
# In-Memory Storage (replace with Redis/database)
# =============================================================================

# Active opportunities: opportunity_id -> ArbitrageOpportunityResponse
_active_opportunities: dict[str, ArbitrageOpportunityResponse] = {}

# Detector instance
_detector = ArbitrageDetector(
    min_profit_threshold=settings.min_profit_threshold,
    max_position_probability=settings.max_position_probability,
)


# =============================================================================
# Endpoints
# =============================================================================

@router.get("/opportunities", response_model=list[ArbitrageOpportunityResponse])
async def list_opportunities(
    user: CurrentUser,
    arb_type: Optional[ArbitrageTypeEnum] = None,
    min_profit: Optional[float] = Query(None, ge=0),
    limit: int = Query(50, ge=1, le=200),
) -> list[ArbitrageOpportunityResponse]:
    """
    List active arbitrage opportunities.

    Filtered and redacted based on user's subscription tier:
    - Observer: Can see opportunities exist but no profit/position data
    - Runner: Full access to intra-market (rebalancing) arbitrage
    - Whale: Full access to all arbitrage including combinatorial
    """
    opportunities = list(_active_opportunities.values())

    # Filter by type if specified
    if arb_type:
        opportunities = [o for o in opportunities if o.arb_type == arb_type]

    # Filter by tier access
    if user.tier == UserTier.OBSERVER:
        # Observers can see structure only
        pass
    elif user.tier == UserTier.RUNNER:
        # Runners can see rebalancing arbitrage
        opportunities = [
            o for o in opportunities
            if o.arb_type in [
                ArbitrageTypeEnum.LONG_REBALANCING,
                ArbitrageTypeEnum.SHORT_REBALANCING,
            ]
        ]

    # Filter by minimum profit (only for tiers that can see profit)
    if min_profit and user.tier in [UserTier.RUNNER, UserTier.WHALE]:
        opportunities = [
            o for o in opportunities
            if o.profit_per_dollar and o.profit_per_dollar >= min_profit
        ]

    # Sort by profit (highest first)
    opportunities.sort(
        key=lambda o: o.profit_per_dollar or 0,
        reverse=True,
    )

    # Limit results
    opportunities = opportunities[:limit]

    # Redact based on tier
    return [redact_opportunity(o, user.tier) for o in opportunities]


@router.get("/opportunities/{opportunity_id}", response_model=ArbitrageOpportunityResponse)
async def get_opportunity(
    opportunity_id: str,
    user: CurrentUser,
) -> ArbitrageOpportunityResponse:
    """
    Get details of a specific arbitrage opportunity.
    """
    opp = _active_opportunities.get(opportunity_id)
    if not opp:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Opportunity not found",
        )

    # Check tier access for combinatorial
    if opp.arb_type == ArbitrageTypeEnum.COMBINATORIAL and user.tier != UserTier.WHALE:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Combinatorial arbitrage requires Whale tier",
        )

    return redact_opportunity(opp, user.tier)


@router.get("/opportunities/{opportunity_id}/risk", response_model=RiskAssessmentResponse)
async def get_opportunity_risk(
    opportunity_id: str,
    trade_size: float = Query(100.0, ge=1, le=100000),
    user: RunnerUser = None,  # Requires at least Runner tier
) -> RiskAssessmentResponse:
    """
    Get risk assessment for an arbitrage opportunity.

    Requires Runner tier or higher.
    """
    opp = _active_opportunities.get(opportunity_id)
    if not opp:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Opportunity not found",
        )

    # Check tier access for combinatorial
    if opp.arb_type == ArbitrageTypeEnum.COMBINATORIAL and user.tier != UserTier.WHALE:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Combinatorial arbitrage risk requires Whale tier",
        )

    # Calculate risk (simplified - integrate with RiskCalculator)
    total_risk = opp.execution_risk
    risk_adjusted_profit = (opp.profit_per_dollar or 0) * (1 - total_risk * 0.5)

    return RiskAssessmentResponse(
        opportunity_id=opportunity_id,
        market_ids=opp.market_ids,
        liquidity_risk=total_risk * 0.3,
        volatility_risk=total_risk * 0.25,
        timing_risk=total_risk * 0.2,
        slippage_risk=total_risk * 0.25,
        total_risk=total_risk,
        risk_adjusted_profit=risk_adjusted_profit,
        max_safe_trade_size=trade_size * (1 - total_risk),
        recommended_trade_size=trade_size * (1 - total_risk) * 0.5,
        execution_window_blocks=5 if total_risk < 0.5 else 2,
        confidence=opp.confidence,
        reasoning=f"Risk assessment for {opp.arb_type.value} opportunity",
    )


@router.post("/execute", response_model=ExecutionResult)
async def execute_opportunity(
    request: ExecutionRequest,
    user: WhaleUser = None,  # Requires Whale tier
) -> ExecutionResult:
    """
    Execute an arbitrage opportunity.

    WHALE TIER ONLY.

    This endpoint submits transactions to execute the arbitrage.
    Use dry_run=True (default) to simulate without executing.

    WARNING: Real execution involves financial risk. Always verify
    the opportunity and risk assessment before executing.
    """
    opp = _active_opportunities.get(request.opportunity_id)
    if not opp:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Opportunity not found or expired",
        )

    # Check if opportunity is still valid (not expired)
    if opp.expires_at and opp.expires_at < datetime.utcnow():
        raise HTTPException(
            status_code=status.HTTP_410_GONE,
            detail="Opportunity has expired",
        )

    if request.dry_run:
        # Simulation mode
        logger.info(
            "Dry run execution",
            opportunity_id=request.opportunity_id,
            trade_size=request.trade_size_usd,
            user=user.uid,
        )

        estimated_profit = (opp.profit_per_dollar or 0) * request.trade_size_usd
        estimated_slippage = opp.execution_risk * 0.5 * estimated_profit

        return ExecutionResult(
            opportunity_id=request.opportunity_id,
            success=True,
            transactions=[],  # No real transactions in dry run
            actual_profit=estimated_profit - estimated_slippage,
            actual_slippage=estimated_slippage / estimated_profit if estimated_profit > 0 else 0,
            error=None,
        )

    # Real execution
    # TODO: Implement actual transaction submission
    # This would involve:
    # 1. Building transactions for each position
    # 2. Signing with user's wallet (requires wallet integration)
    # 3. Submitting to Polygon
    # 4. Monitoring for confirmation

    logger.warning(
        "Real execution not implemented",
        opportunity_id=request.opportunity_id,
        user=user.uid,
    )

    return ExecutionResult(
        opportunity_id=request.opportunity_id,
        success=False,
        transactions=[],
        actual_profit=None,
        actual_slippage=None,
        error="Real execution not yet implemented. Use dry_run=True for simulation.",
    )


@router.get("/stats")
async def get_stats(user: CurrentUser) -> dict:
    """
    Get arbitrage statistics.
    """
    opportunities = list(_active_opportunities.values())

    # Basic stats visible to all
    stats = {
        "total_opportunities": len(opportunities),
        "by_type": {},
    }

    # Count by type
    for arb_type in ArbitrageTypeEnum:
        count = len([o for o in opportunities if o.arb_type == arb_type])
        stats["by_type"][arb_type.value] = count

    # Profit stats only for paid tiers
    if user.tier in [UserTier.RUNNER, UserTier.WHALE]:
        profits = [o.profit_per_dollar for o in opportunities if o.profit_per_dollar]
        if profits:
            stats["avg_profit_per_dollar"] = sum(profits) / len(profits)
            stats["max_profit_per_dollar"] = max(profits)
            stats["total_potential_profit"] = sum(profits)

    return stats


# =============================================================================
# Internal Functions (called by background tasks)
# =============================================================================

def add_opportunity(
    arb_type: ArbitrageType,
    market_ids: list[str],
    condition_ids: list[str],
    observed_prices: list[float],
    projected_prices: list[float],
    profit_per_dollar: float,
    recommended_positions: dict[str, str],
    confidence: float,
    execution_risk: float,
) -> ArbitrageOpportunityResponse:
    """Add a new arbitrage opportunity (called by detection pipeline)."""
    # Map internal ArbitrageType to API enum
    type_map = {
        ArbitrageType.NONE: ArbitrageTypeEnum.NONE,
        ArbitrageType.LONG_REBALANCING: ArbitrageTypeEnum.LONG_REBALANCING,
        ArbitrageType.SHORT_REBALANCING: ArbitrageTypeEnum.SHORT_REBALANCING,
        ArbitrageType.COMBINATORIAL: ArbitrageTypeEnum.COMBINATORIAL,
    }

    opportunity_id = str(uuid4())[:8]

    opp = ArbitrageOpportunityResponse(
        opportunity_id=opportunity_id,
        arb_type=type_map.get(arb_type, ArbitrageTypeEnum.NONE),
        market_ids=market_ids,
        condition_ids=condition_ids,
        profit_per_dollar=profit_per_dollar,
        observed_prices=observed_prices,
        projected_prices=projected_prices,
        recommended_positions=recommended_positions,
        confidence=confidence,
        execution_risk=execution_risk,
        risk_adjusted_profit=profit_per_dollar * (1 - execution_risk * 0.5),
    )

    _active_opportunities[opportunity_id] = opp
    logger.info(
        "New arbitrage opportunity",
        id=opportunity_id,
        type=opp.arb_type.value,
        profit=profit_per_dollar,
    )

    return opp


def remove_opportunity(opportunity_id: str) -> bool:
    """Remove an expired or executed opportunity."""
    return _active_opportunities.pop(opportunity_id, None) is not None


def clear_expired_opportunities() -> int:
    """Remove all expired opportunities. Returns count removed."""
    now = datetime.utcnow()
    expired = [
        oid for oid, opp in _active_opportunities.items()
        if opp.expires_at and opp.expires_at < now
    ]
    for oid in expired:
        del _active_opportunities[oid]
    return len(expired)
