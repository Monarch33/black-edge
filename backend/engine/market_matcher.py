"""
Market Matcher — Links news headlines to Polymarket markets
============================================================
Maintient un index de keywords pour chaque marché actif et score
les headlines entrantes contre cet index.
"""

import re
from dataclasses import dataclass


@dataclass
class MarketMatch:
    """A match between a headline and a market."""
    market_id: str
    market_question: str
    match_score: float      # 0.0 - 1.0
    matched_keywords: list[str]


class MarketMatcher:
    """
    Links incoming news headlines to active Polymarket markets.

    Maintains a keyword index of active markets and scores
    incoming headlines against it.
    """

    # Keywords à ignorer (trop communs)
    STOP_WORDS = {
        "will", "the", "be", "by", "in", "on", "at", "to", "of", "a", "an",
        "is", "are", "has", "have", "does", "do", "before", "after", "above",
        "below", "than", "more", "less", "end", "next", "this", "that",
    }

    def __init__(self):
        self._market_keywords: dict[str, set[str]] = {}  # market_id → keywords
        self._market_questions: dict[str, str] = {}       # market_id → question

    def update_markets(self, markets: list) -> None:
        """
        Update the keyword index from active Polymarket markets.
        Call this every time markets are refreshed.

        Args:
            markets: List of PolymarketMarket objects
        """
        self._market_keywords.clear()
        self._market_questions.clear()

        for market in markets:
            market_id = market.id
            question = market.question

            # Extract keywords
            words = re.findall(r'[a-z0-9]+', question.lower())
            keywords = {w for w in words if w not in self.STOP_WORDS and len(w) > 2}

            # Add important bigrams (ex: "super bowl", "rate cut")
            lower_q = question.lower()
            bigrams = [
                "super bowl", "rate cut", "rate hike", "executive order",
                "world series", "champions league", "prime minister",
                "supreme court", "bitcoin price", "interest rate",
            ]
            for bigram in bigrams:
                if bigram in lower_q:
                    keywords.add(bigram.replace(" ", "_"))

            self._market_keywords[market_id] = keywords
            self._market_questions[market_id] = question

    def match_headline(self, headline: str, min_score: float = 0.3) -> list[MarketMatch]:
        """
        Match a headline against all active markets.

        Args:
            headline: News headline text
            min_score: Minimum match score (0.0 - 1.0)

        Returns:
            List of MarketMatch, sorted by score descending
        """
        headline_words = set(re.findall(r'[a-z0-9]+', headline.lower()))

        matches = []
        for market_id, market_keywords in self._market_keywords.items():
            if not market_keywords:
                continue

            # Find matching keywords
            common = headline_words & market_keywords

            if not common:
                continue

            score = len(common) / len(market_keywords)

            if score >= min_score:
                matches.append(MarketMatch(
                    market_id=market_id,
                    market_question=self._market_questions[market_id],
                    match_score=score,
                    matched_keywords=list(common),
                ))

        # Sort by score
        matches.sort(key=lambda x: x.match_score, reverse=True)

        return matches
