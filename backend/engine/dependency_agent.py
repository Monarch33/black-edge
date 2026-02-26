"""
Dependency Agent: LLM-Based Market Dependency Detection
========================================================
Uses Large Language Models to detect semantic dependencies between
prediction market conditions, following the methodology from
"Unravelling the Probabilistic Forest" (Saguillo et al.).

The agent:
1. Takes market condition descriptions as input
2. Uses an LLM to reason about logical dependencies
3. Outputs a dependency matrix for the mathematical solver
"""

import asyncio
import json
import hashlib
from dataclasses import dataclass, field
from typing import Optional
from datetime import datetime, timedelta
import re

import numpy as np
from numpy.typing import NDArray
import httpx
import structlog

from config import get_settings

logger = structlog.get_logger()
settings = get_settings()


# =============================================================================
# Data Classes
# =============================================================================

@dataclass
class MarketCondition:
    """Represents a single condition in a prediction market."""
    condition_id: str
    market_id: str
    question: str  # The condition question/description
    topic: Optional[str] = None
    end_date: Optional[datetime] = None


@dataclass
class DependencyResult:
    """Result of dependency analysis between markets."""
    market_ids: list[str]
    condition_ids: list[str]
    dependency_matrix: NDArray[np.float64]  # Binary matrix
    valid_outcomes: list[list[int]]  # List of valid outcome vectors
    confidence: float
    reasoning: str
    cached: bool = False
    timestamp: datetime = field(default_factory=datetime.utcnow)


@dataclass
class MarketPair:
    """A pair of markets to analyze for dependencies."""
    market1_id: str
    market2_id: str
    market1_conditions: list[MarketCondition]
    market2_conditions: list[MarketCondition]
    topic: str
    end_date: datetime


# =============================================================================
# LLM Prompt Templates
# =============================================================================

SINGLE_MARKET_PROMPT = """You are analyzing a prediction market with multiple mutually exclusive conditions.
A prediction market has conditions that represent possible outcomes of an event.
Exactly ONE condition will resolve to TRUE, and all others to FALSE.

MARKET CONDITIONS:
{conditions}

TASK: Determine all valid outcome vectors. An outcome vector is a list of 0s and 1s where:
- 1 means the condition is TRUE
- 0 means the condition is FALSE
- Exactly one condition should be TRUE per valid outcome

OUTPUT FORMAT: Return ONLY a JSON object with this structure:
{{
    "valid_outcomes": [[0,1,0,...], [1,0,0,...], ...],
    "reasoning": "Brief explanation of the logical relationships"
}}

Each inner array should have {num_conditions} elements (one per condition).
There should be exactly {num_conditions} valid outcomes for mutually exclusive conditions."""


MULTI_MARKET_PROMPT = """You are analyzing TWO prediction markets to determine if their conditions have logical dependencies.

MARKET 1 CONDITIONS (indices 0 to {m1_end}):
{market1_conditions}

MARKET 2 CONDITIONS (indices {m2_start} to {m2_end}):
{market2_conditions}

TASK: Determine all valid JOINT outcome vectors considering both markets.
- Each market's conditions are internally mutually exclusive (exactly one TRUE per market)
- BUT conditions across markets may have logical dependencies
- For example: if Market 1 has "Team A wins" and Market 2 has "Team A wins by 3+ goals",
  then "Team A wins by 3+" being TRUE implies "Team A wins" must be TRUE

OUTPUT FORMAT: Return ONLY a JSON object:
{{
    "valid_outcomes": [[0,1,0,0,1,0,...], ...],
    "dependent": true/false,
    "dependent_pairs": [[i, j], ...],
    "reasoning": "Explanation of dependencies found"
}}

Rules:
- Each outcome vector has {total_conditions} elements
- First {m1_count} elements are Market 1 conditions
- Last {m2_count} elements are Market 2 conditions
- If markets are INDEPENDENT: there should be {m1_count} * {m2_count} valid outcomes
- If markets are DEPENDENT: there will be fewer valid outcomes
- dependent_pairs: list of [i,j] pairs where condition i TRUE implies condition j FALSE"""


# =============================================================================
# LLM Client
# =============================================================================

class LLMClient:
    """
    Client for interacting with LLM APIs.

    Supports multiple backends (OpenAI, DeepSeek, local models).
    """

    def __init__(
        self,
        model: str = settings.llm_model,
        api_base: Optional[str] = None,
        api_key: Optional[str] = None,
    ):
        self.model = model
        self.api_base = api_base or "http://localhost:11434/api"  # Default to Ollama
        self.api_key = api_key
        self._client = httpx.AsyncClient(timeout=120.0)

    async def generate(self, prompt: str) -> str:
        """
        Generate a response from the LLM.

        Args:
            prompt: The input prompt

        Returns:
            The LLM's response text
        """
        # Try Ollama-style API first (for local models like DeepSeek)
        try:
            response = await self._client.post(
                f"{self.api_base}/generate",
                json={
                    "model": self.model,
                    "prompt": prompt,
                    "stream": False,
                    "options": {
                        "temperature": 0.1,  # Low temperature for consistency
                        "num_predict": 4096,
                    },
                },
            )
            response.raise_for_status()
            return response.json()["response"]
        except Exception as e:
            logger.warning("Ollama API failed, trying OpenAI format", error=str(e))

        # Fallback to OpenAI-compatible API
        headers = {}
        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"

        response = await self._client.post(
            f"{self.api_base}/chat/completions",
            headers=headers,
            json={
                "model": self.model,
                "messages": [{"role": "user", "content": prompt}],
                "temperature": 0.1,
                "max_tokens": 4096,
            },
        )
        response.raise_for_status()
        return response.json()["choices"][0]["message"]["content"]

    async def close(self) -> None:
        """Close the HTTP client."""
        await self._client.aclose()


# =============================================================================
# Dependency Agent
# =============================================================================

class DependencyAgent:
    """
    Detects semantic dependencies between prediction market conditions.

    Uses LLM reasoning to:
    1. Validate single market structure (mutually exclusive conditions)
    2. Detect cross-market dependencies for combinatorial arbitrage

    Results are cached to avoid redundant LLM calls.
    """

    def __init__(
        self,
        llm_client: Optional[LLMClient] = None,
        cache_ttl: int = settings.dependency_update_interval,
    ):
        self.llm = llm_client or LLMClient()
        self.cache_ttl = cache_ttl
        self._cache: dict[str, DependencyResult] = {}

    def _cache_key(self, condition_ids: list[str]) -> str:
        """Generate a cache key from condition IDs."""
        sorted_ids = sorted(condition_ids)
        return hashlib.sha256("|".join(sorted_ids).encode()).hexdigest()[:16]

    def _is_cache_valid(self, key: str) -> bool:
        """Check if a cached result is still valid."""
        if key not in self._cache:
            return False
        result = self._cache[key]
        age = (datetime.utcnow() - result.timestamp).total_seconds()
        return age < self.cache_ttl

    async def analyze_single_market(
        self,
        conditions: list[MarketCondition],
    ) -> DependencyResult:
        """
        Analyze a single market to validate condition structure.

        For a well-formed market, should return n valid outcomes
        (one for each condition being TRUE).

        Args:
            conditions: List of conditions in the market

        Returns:
            DependencyResult with valid outcomes and dependency matrix
        """
        # Check cache
        cache_key = self._cache_key([c.condition_id for c in conditions])
        if self._is_cache_valid(cache_key):
            result = self._cache[cache_key]
            result.cached = True
            return result

        n = len(conditions)
        condition_text = "\n".join(
            f"{i}. {c.question}" for i, c in enumerate(conditions)
        )

        prompt = SINGLE_MARKET_PROMPT.format(
            conditions=condition_text,
            num_conditions=n,
        )

        try:
            response = await self.llm.generate(prompt)
            parsed = self._parse_llm_response(response)

            valid_outcomes = parsed.get("valid_outcomes", [])
            reasoning = parsed.get("reasoning", "")

            # Validate the response
            if not self._validate_single_market_outcomes(valid_outcomes, n):
                logger.warning(
                    "Invalid LLM response for single market, using default",
                    market_id=conditions[0].market_id if conditions else "unknown",
                )
                # Default to identity matrix (standard simplex)
                valid_outcomes = np.eye(n).astype(int).tolist()
                reasoning = "Default: mutually exclusive conditions"

            # Build dependency matrix (for single market, all conditions are dependent)
            dep_matrix = np.ones((n, n)) - np.eye(n)

            result = DependencyResult(
                market_ids=[conditions[0].market_id] if conditions else [],
                condition_ids=[c.condition_id for c in conditions],
                dependency_matrix=dep_matrix,
                valid_outcomes=valid_outcomes,
                confidence=1.0 if len(valid_outcomes) == n else 0.8,
                reasoning=reasoning,
            )

            # Cache result
            self._cache[cache_key] = result
            return result

        except Exception as e:
            logger.error("LLM analysis failed", error=str(e))
            # Return default structure
            return DependencyResult(
                market_ids=[conditions[0].market_id] if conditions else [],
                condition_ids=[c.condition_id for c in conditions],
                dependency_matrix=np.ones((n, n)) - np.eye(n),
                valid_outcomes=np.eye(n).astype(int).tolist(),
                confidence=0.5,
                reasoning=f"Default (LLM failed): {str(e)}",
            )

    async def analyze_market_pair(
        self,
        pair: MarketPair,
    ) -> DependencyResult:
        """
        Analyze two markets for cross-market dependencies.

        Args:
            pair: MarketPair containing both markets' conditions

        Returns:
            DependencyResult with joint valid outcomes and dependency matrix
        """
        all_conditions = pair.market1_conditions + pair.market2_conditions
        cache_key = self._cache_key([c.condition_id for c in all_conditions])

        if self._is_cache_valid(cache_key):
            result = self._cache[cache_key]
            result.cached = True
            return result

        m1_count = len(pair.market1_conditions)
        m2_count = len(pair.market2_conditions)
        total = m1_count + m2_count

        m1_text = "\n".join(
            f"{i}. {c.question}" for i, c in enumerate(pair.market1_conditions)
        )
        m2_text = "\n".join(
            f"{i + m1_count}. {c.question}" for i, c in enumerate(pair.market2_conditions)
        )

        prompt = MULTI_MARKET_PROMPT.format(
            market1_conditions=m1_text,
            market2_conditions=m2_text,
            m1_end=m1_count - 1,
            m2_start=m1_count,
            m2_end=total - 1,
            m1_count=m1_count,
            m2_count=m2_count,
            total_conditions=total,
        )

        try:
            response = await self.llm.generate(prompt)
            parsed = self._parse_llm_response(response)

            valid_outcomes = parsed.get("valid_outcomes", [])
            dependent = parsed.get("dependent", False)
            dependent_pairs = parsed.get("dependent_pairs", [])
            reasoning = parsed.get("reasoning", "")

            # Validate
            if not self._validate_multi_market_outcomes(
                valid_outcomes, m1_count, m2_count
            ):
                logger.warning(
                    "Invalid LLM response for market pair, assuming independent"
                )
                # Default to independent markets (Cartesian product)
                valid_outcomes = self._generate_independent_outcomes(m1_count, m2_count)
                dependent = False
                reasoning = "Default: assumed independent"

            # Build dependency matrix from dependent_pairs
            dep_matrix = np.zeros((total, total))
            for i, j in dependent_pairs:
                if 0 <= i < total and 0 <= j < total:
                    dep_matrix[i, j] = 1
                    dep_matrix[j, i] = 1  # Symmetric

            # Determine confidence based on outcome count
            expected_independent = m1_count * m2_count
            actual = len(valid_outcomes)
            if actual < expected_independent:
                confidence = 0.9  # High confidence in dependency
            else:
                confidence = 0.7  # Standard confidence

            result = DependencyResult(
                market_ids=[pair.market1_id, pair.market2_id],
                condition_ids=[c.condition_id for c in all_conditions],
                dependency_matrix=dep_matrix,
                valid_outcomes=valid_outcomes,
                confidence=confidence,
                reasoning=reasoning,
            )

            self._cache[cache_key] = result
            return result

        except Exception as e:
            logger.error("LLM analysis failed for market pair", error=str(e))
            # Return independent markets as default
            valid_outcomes = self._generate_independent_outcomes(m1_count, m2_count)
            return DependencyResult(
                market_ids=[pair.market1_id, pair.market2_id],
                condition_ids=[c.condition_id for c in all_conditions],
                dependency_matrix=np.zeros((total, total)),
                valid_outcomes=valid_outcomes,
                confidence=0.5,
                reasoning=f"Default (LLM failed): {str(e)}",
            )

    def _parse_llm_response(self, response: str) -> dict:
        """Parse JSON from LLM response, handling markdown code blocks."""
        # Remove markdown code blocks if present
        response = response.strip()
        if response.startswith("```"):
            lines = response.split("\n")
            # Find start and end of code block
            start = 1 if lines[0].startswith("```") else 0
            end = len(lines) - 1 if lines[-1] == "```" else len(lines)
            response = "\n".join(lines[start:end])

        # Try to extract JSON object
        json_match = re.search(r'\{[\s\S]*\}', response)
        if json_match:
            try:
                return json.loads(json_match.group())
            except json.JSONDecodeError:
                pass

        logger.warning("Failed to parse LLM response as JSON")
        return {}

    def _validate_single_market_outcomes(
        self,
        outcomes: list[list[int]],
        n: int,
    ) -> bool:
        """Validate outcomes for a single market."""
        if not outcomes:
            return False

        for outcome in outcomes:
            if len(outcome) != n:
                return False
            if sum(outcome) != 1:  # Exactly one TRUE
                return False

        return True

    def _validate_multi_market_outcomes(
        self,
        outcomes: list[list[int]],
        m1_count: int,
        m2_count: int,
    ) -> bool:
        """Validate outcomes for a market pair."""
        if not outcomes:
            return False

        total = m1_count + m2_count
        for outcome in outcomes:
            if len(outcome) != total:
                return False
            # Check each market has exactly one TRUE
            m1_sum = sum(outcome[:m1_count])
            m2_sum = sum(outcome[m1_count:])
            if m1_sum != 1 or m2_sum != 1:
                return False

        return True

    def _generate_independent_outcomes(
        self,
        m1_count: int,
        m2_count: int,
    ) -> list[list[int]]:
        """Generate all valid outcomes for independent markets."""
        outcomes = []
        for i in range(m1_count):
            for j in range(m2_count):
                outcome = [0] * (m1_count + m2_count)
                outcome[i] = 1
                outcome[m1_count + j] = 1
                outcomes.append(outcome)
        return outcomes

    async def close(self) -> None:
        """Clean up resources."""
        await self.llm.close()


# =============================================================================
# Topic Classifier (for heuristic filtering)
# =============================================================================

class TopicClassifier:
    """
    Classifies markets into topics using text embeddings.

    Used as a heuristic filter to reduce the search space before
    running expensive LLM dependency analysis.
    """

    TOPICS = [
        "Politics",
        "Economy",
        "Technology",
        "Crypto",
        "Twitter",
        "Culture",
        "Sports",
    ]

    def __init__(self):
        # Simple keyword-based classification (upgrade to embeddings for production)
        self._topic_keywords = {
            "Politics": ["election", "president", "congress", "senate", "vote", "democrat", "republican", "biden", "trump", "governor"],
            "Economy": ["gdp", "inflation", "fed", "interest rate", "stock", "market", "recession", "unemployment"],
            "Technology": ["ai", "openai", "google", "apple", "microsoft", "tech", "software", "hardware"],
            "Crypto": ["bitcoin", "ethereum", "crypto", "blockchain", "token", "defi", "nft"],
            "Twitter": ["twitter", "x.com", "elon", "musk", "tweet"],
            "Culture": ["movie", "music", "celebrity", "award", "oscar", "grammy"],
            "Sports": ["game", "match", "team", "win", "score", "championship", "nba", "nfl", "soccer", "football"],
        }

    def classify(self, text: str) -> str:
        """Classify text into a topic."""
        text_lower = text.lower()
        scores = {}

        for topic, keywords in self._topic_keywords.items():
            score = sum(1 for kw in keywords if kw in text_lower)
            scores[topic] = score

        # Return topic with highest score, or "Culture" as default
        best_topic = max(scores, key=scores.get)
        return best_topic if scores[best_topic] > 0 else "Culture"


# =============================================================================
# Market Pair Generator (heuristic filtering)
# =============================================================================

class MarketPairGenerator:
    """
    Generates candidate market pairs for dependency analysis.

    Uses heuristics from the paper:
    1. Same end date
    2. Same topic
    3. Volume threshold
    """

    def __init__(self, topic_classifier: Optional[TopicClassifier] = None):
        self.classifier = topic_classifier or TopicClassifier()

    def generate_pairs(
        self,
        markets: list[tuple[str, list[MarketCondition]]],
        max_pairs: int = 1000,
    ) -> list[MarketPair]:
        """
        Generate candidate pairs for dependency analysis.

        Args:
            markets: List of (market_id, conditions) tuples
            max_pairs: Maximum number of pairs to return

        Returns:
            List of MarketPair objects
        """
        # Group markets by topic and end date
        groups: dict[tuple[str, str], list[tuple[str, list[MarketCondition]]]] = {}

        for market_id, conditions in markets:
            if not conditions:
                continue

            # Classify topic
            topic = self.classifier.classify(conditions[0].question)

            # Get end date (use first condition's date or today)
            end_date = conditions[0].end_date or datetime.utcnow()
            date_key = end_date.strftime("%Y-%m-%d")

            key = (topic, date_key)
            if key not in groups:
                groups[key] = []
            groups[key].append((market_id, conditions))

        # Generate pairs within each group
        pairs = []
        for (topic, date_key), group_markets in groups.items():
            n = len(group_markets)
            for i in range(n):
                for j in range(i + 1, n):
                    if len(pairs) >= max_pairs:
                        break

                    m1_id, m1_conds = group_markets[i]
                    m2_id, m2_conds = group_markets[j]

                    pair = MarketPair(
                        market1_id=m1_id,
                        market2_id=m2_id,
                        market1_conditions=m1_conds,
                        market2_conditions=m2_conds,
                        topic=topic,
                        end_date=datetime.strptime(date_key, "%Y-%m-%d"),
                    )
                    pairs.append(pair)

        logger.info(
            "Generated market pairs",
            total_pairs=len(pairs),
            groups=len(groups),
        )
        return pairs
