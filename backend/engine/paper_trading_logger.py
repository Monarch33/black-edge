"""
Paper Trading Logger - Track all predictions and performance

This module logs every signal from the Council, tracks outcomes,
and calculates performance metrics for public track record.

Database: SQLite (migrations to Postgres later)
Auto-resolution: Checks Polymarket API for market resolution
"""

import sqlite3
import json
import time
from datetime import datetime
from pathlib import Path
from typing import Optional, Dict, List
from dataclasses import dataclass, asdict
import structlog

logger = structlog.get_logger()

# Database path
DB_PATH = Path(__file__).parent.parent / "data" / "paper_trading.db"
DB_PATH.parent.mkdir(parents=True, exist_ok=True)


# =============================================================================
# DATA STRUCTURES
# =============================================================================

@dataclass
class PaperTrade:
    """A logged paper trade prediction."""
    id: Optional[int] = None
    timestamp: float = 0.0
    market_id: str = ""
    market_question: str = ""
    platform: str = "polymarket"

    # Prediction
    prediction: str = ""  # "YES" or "NO"
    confidence: float = 0.0  # 0-1
    edge: float = 0.0  # Estimated edge %
    entry_price: float = 0.0  # Price at entry

    # Council votes
    council_votes: str = "{}"  # JSON: {agent: vote}
    signal_strength: float = 0.0

    # Risk management
    recommended_amount: float = 0.0  # Kelly-sized bet
    kelly_fraction: float = 0.0
    risk_level: str = "medium"

    # Resolution (filled later)
    resolved: bool = False
    resolution_timestamp: Optional[float] = None
    actual_outcome: Optional[str] = None  # "YES" or "NO"
    exit_price: Optional[float] = None

    # Performance
    correct: Optional[bool] = None
    profit_loss: Optional[float] = None  # P&L if traded
    edge_realized: Optional[float] = None  # Actual edge vs predicted


# =============================================================================
# DATABASE SETUP
# =============================================================================

def init_database():
    """Initialize SQLite database with schema."""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS paper_trades (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp REAL NOT NULL,
            market_id TEXT NOT NULL,
            market_question TEXT NOT NULL,
            platform TEXT NOT NULL DEFAULT 'polymarket',

            prediction TEXT NOT NULL,
            confidence REAL NOT NULL,
            edge REAL NOT NULL,
            entry_price REAL NOT NULL,

            council_votes TEXT NOT NULL,
            signal_strength REAL NOT NULL,

            recommended_amount REAL NOT NULL,
            kelly_fraction REAL NOT NULL,
            risk_level TEXT NOT NULL,

            resolved INTEGER NOT NULL DEFAULT 0,
            resolution_timestamp REAL,
            actual_outcome TEXT,
            exit_price REAL,

            correct INTEGER,
            profit_loss REAL,
            edge_realized REAL,

            UNIQUE(market_id, timestamp)
        )
    """)

    # Index for fast queries
    cursor.execute("""
        CREATE INDEX IF NOT EXISTS idx_timestamp
        ON paper_trades(timestamp DESC)
    """)

    cursor.execute("""
        CREATE INDEX IF NOT EXISTS idx_resolved
        ON paper_trades(resolved, timestamp DESC)
    """)

    conn.commit()
    conn.close()
    logger.info("📊 Paper trading database initialized", path=str(DB_PATH))


# =============================================================================
# LOGGING FUNCTIONS
# =============================================================================

def log_prediction(
    market_id: str,
    market_question: str,
    prediction: str,
    confidence: float,
    edge: float,
    entry_price: float,
    council_votes: Dict[str, str],
    signal_strength: float,
    recommended_amount: float,
    kelly_fraction: float,
    risk_level: str,
    platform: str = "polymarket"
) -> int:
    """
    Log a new paper trade prediction.

    Returns:
        Trade ID
    """
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    trade = PaperTrade(
        timestamp=time.time(),
        market_id=market_id,
        market_question=market_question,
        platform=platform,
        prediction=prediction,
        confidence=confidence,
        edge=edge,
        entry_price=entry_price,
        council_votes=json.dumps(council_votes),
        signal_strength=signal_strength,
        recommended_amount=recommended_amount,
        kelly_fraction=kelly_fraction,
        risk_level=risk_level,
    )

    try:
        cursor.execute("""
            INSERT INTO paper_trades (
                timestamp, market_id, market_question, platform,
                prediction, confidence, edge, entry_price,
                council_votes, signal_strength,
                recommended_amount, kelly_fraction, risk_level
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            trade.timestamp,
            trade.market_id,
            trade.market_question,
            trade.platform,
            trade.prediction,
            trade.confidence,
            trade.edge,
            trade.entry_price,
            trade.council_votes,
            trade.signal_strength,
            trade.recommended_amount,
            trade.kelly_fraction,
            trade.risk_level,
        ))

        conn.commit()
        trade_id = cursor.lastrowid

        logger.info(
            "📝 Paper trade logged",
            trade_id=trade_id,
            market=market_question[:50],
            prediction=prediction,
            confidence=f"{confidence:.1%}",
            edge=f"{edge:.1%}",
        )

        return trade_id

    except sqlite3.IntegrityError:
        logger.warning("⚠️ Duplicate prediction ignored", market_id=market_id)
        return -1
    finally:
        conn.close()


def resolve_prediction(
    trade_id: int,
    actual_outcome: str,
    exit_price: float,
    resolution_timestamp: Optional[float] = None
) -> bool:
    """
    Mark a prediction as resolved and calculate performance.

    Args:
        trade_id: The trade ID to resolve
        actual_outcome: "YES" or "NO"
        exit_price: Final market price (for P&L calc)
        resolution_timestamp: When resolved (default: now)

    Returns:
        True if successful
    """
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    # Get original trade
    cursor.execute("""
        SELECT prediction, entry_price, recommended_amount, confidence, edge
        FROM paper_trades
        WHERE id = ?
    """, (trade_id,))

    row = cursor.fetchone()
    if not row:
        logger.error("❌ Trade not found", trade_id=trade_id)
        conn.close()
        return False

    prediction, entry_price, recommended_amount, confidence, predicted_edge = row

    # Calculate performance
    correct = (prediction == actual_outcome)

    # P&L calculation (simplified)
    if correct:
        # If predicted YES and outcome YES: profit = amount * (1/entry_price - 1)
        # If predicted NO and outcome NO: profit = amount * (1/(1-entry_price) - 1)
        if prediction == "YES":
            profit_loss = recommended_amount * (1.0 / entry_price - 1.0)
        else:  # NO
            profit_loss = recommended_amount * (1.0 / (1.0 - entry_price) - 1.0)
    else:
        # Lost the bet
        profit_loss = -recommended_amount

    # Edge realized (how much better/worse than predicted)
    if prediction == "YES":
        edge_realized = (1.0 if correct else 0.0) - entry_price
    else:  # NO
        edge_realized = (0.0 if correct else 1.0) - entry_price

    # Update database
    cursor.execute("""
        UPDATE paper_trades
        SET resolved = 1,
            resolution_timestamp = ?,
            actual_outcome = ?,
            exit_price = ?,
            correct = ?,
            profit_loss = ?,
            edge_realized = ?
        WHERE id = ?
    """, (
        resolution_timestamp or time.time(),
        actual_outcome,
        exit_price,
        1 if correct else 0,
        profit_loss,
        edge_realized,
        trade_id,
    ))

    conn.commit()
    conn.close()

    logger.info(
        "✅ Prediction resolved",
        trade_id=trade_id,
        correct=correct,
        profit_loss=f"${profit_loss:.2f}",
        edge_realized=f"{edge_realized*100:.1f}%",
    )

    return True


# =============================================================================
# QUERY FUNCTIONS
# =============================================================================

def get_track_record() -> Dict:
    """
    Get complete track record statistics.

    Returns:
        Dict with performance metrics
    """
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    # Total predictions
    cursor.execute("SELECT COUNT(*) FROM paper_trades")
    total_predictions = cursor.fetchone()[0]

    # Resolved predictions
    cursor.execute("SELECT COUNT(*) FROM paper_trades WHERE resolved = 1")
    total_resolved = cursor.fetchone()[0]

    if total_resolved == 0:
        conn.close()
        return {
            "total_predictions": total_predictions,
            "total_resolved": 0,
            "win_rate": 0.0,
            "avg_edge_predicted": 0.0,
            "avg_edge_realized": 0.0,
            "total_pnl": 0.0,
            "confidence_breakdown": {},
            "recent_predictions": [],
        }

    # Win rate
    cursor.execute("SELECT COUNT(*) FROM paper_trades WHERE correct = 1")
    total_correct = cursor.fetchone()[0]
    win_rate = total_correct / total_resolved if total_resolved > 0 else 0.0

    # Average edge
    cursor.execute("SELECT AVG(edge) FROM paper_trades WHERE resolved = 1")
    avg_edge_predicted = cursor.fetchone()[0] or 0.0

    cursor.execute("SELECT AVG(edge_realized) FROM paper_trades WHERE resolved = 1")
    avg_edge_realized = cursor.fetchone()[0] or 0.0

    # Total P&L
    cursor.execute("SELECT SUM(profit_loss) FROM paper_trades WHERE resolved = 1")
    total_pnl = cursor.fetchone()[0] or 0.0

    # Confidence breakdown
    confidence_breakdown = {}
    for level in ["high", "medium", "low"]:
        cursor.execute("""
            SELECT
                COUNT(*) as total,
                SUM(CASE WHEN correct = 1 THEN 1 ELSE 0 END) as wins
            FROM paper_trades
            WHERE resolved = 1 AND risk_level = ?
        """, (level,))

        row = cursor.fetchone()
        if row and row[0] > 0:
            confidence_breakdown[level] = {
                "total": row[0],
                "wins": row[1],
                "win_rate": row[1] / row[0],
            }

    # Recent predictions (last 10)
    cursor.execute("""
        SELECT
            id, timestamp, market_question, prediction, confidence,
            edge, entry_price, resolved, correct, profit_loss
        FROM paper_trades
        ORDER BY timestamp DESC
        LIMIT 10
    """)

    recent = []
    for row in cursor.fetchall():
        recent.append({
            "id": row[0],
            "timestamp": row[1],
            "market": row[2],
            "prediction": row[3],
            "confidence": row[4],
            "edge": row[5],
            "entry_price": row[6],
            "resolved": bool(row[7]),
            "correct": bool(row[8]) if row[8] is not None else None,
            "profit_loss": row[9],
        })

    conn.close()

    return {
        "total_predictions": total_predictions,
        "total_resolved": total_resolved,
        "win_rate": win_rate,
        "avg_edge_predicted": avg_edge_predicted,
        "avg_edge_realized": avg_edge_realized,
        "total_pnl": total_pnl,
        "confidence_breakdown": confidence_breakdown,
        "recent_predictions": recent,
    }


def get_unresolved_predictions() -> List[Dict]:
    """
    Get all unresolved predictions (for auto-resolution).

    Returns:
        List of unresolved trades
    """
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    cursor.execute("""
        SELECT id, market_id, market_question, prediction, timestamp
        FROM paper_trades
        WHERE resolved = 0
        ORDER BY timestamp DESC
    """)

    unresolved = []
    for row in cursor.fetchall():
        unresolved.append({
            "id": row[0],
            "market_id": row[1],
            "market_question": row[2],
            "prediction": row[3],
            "timestamp": row[4],
        })

    conn.close()
    return unresolved


# =============================================================================
# AUTO-RESOLUTION (TODO: Implement with Polymarket API)
# =============================================================================

async def auto_resolve_predictions():
    """
    Check unresolved predictions and resolve them via Polymarket API.

    This should be called periodically (e.g., every hour).
    """
    unresolved = get_unresolved_predictions()

    if not unresolved:
        return

    logger.info(f"🔍 Checking {len(unresolved)} unresolved predictions")

    # TODO: For each unresolved prediction:
    # 1. Check if market is resolved via Polymarket API
    # 2. If resolved, get outcome and call resolve_prediction()

    # Placeholder for now
    for trade in unresolved:
        # Skip if too recent (< 1 hour old)
        if time.time() - trade["timestamp"] < 3600:
            continue

        # TODO: Check Polymarket API for resolution
        # market_data = await polymarket_client.get_market(trade["market_id"])
        # if market_data["closed"]:
        #     outcome = "YES" if market_data["outcome"] == "Yes" else "NO"
        #     resolve_prediction(trade["id"], outcome, exit_price=...)

        pass


# =============================================================================
# INITIALIZATION
# =============================================================================

# Initialize DB on import
init_database()
