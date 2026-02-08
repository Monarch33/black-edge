"""
Sentiment Analysis - Zero-Dependency Lexicon-Based Analyzer
Lightweight sentiment scoring for financial/political text without external NLP libraries.
Based on VADER methodology but with custom lexicon for prediction markets.
"""

from __future__ import annotations

import re
import math


# ═══════════════════════════════════════════════════════════════════════════
# LEXICON: Financial + Political Terms (Score Range: -3 to +3)
# ═══════════════════════════════════════════════════════════════════════════

SENTIMENT_LEXICON = {
    # Strongly Positive (+2.5 to +3)
    "surge": 2.8, "soar": 2.7, "skyrocket": 3.0, "triumph": 2.9, "breakthrough": 2.6,
    "bullish": 2.5, "winning": 2.4, "dominant": 2.5, "landslide": 2.8, "victory": 2.6,

    # Positive (+1.5 to +2.4)
    "gain": 1.8, "rise": 1.7, "rally": 2.0, "strong": 1.9, "optimistic": 2.1,
    "outperform": 2.2, "lead": 1.8, "ahead": 1.9, "momentum": 2.0, "upbeat": 2.1,
    "confident": 2.0, "favorable": 1.9, "robust": 2.0, "improve": 1.8,
    "success": 2.2, "beat": 2.0, "exceed": 2.1, "positive": 1.7, "good": 1.5,

    # Moderately Positive (+0.5 to +1.4)
    "up": 1.0, "higher": 1.1, "increase": 1.0, "grow": 1.2, "expansion": 1.1,
    "support": 1.0, "approve": 1.3, "accept": 0.9, "agree": 1.0, "endorse": 1.4,
    "progress": 1.2, "stable": 0.8, "steady": 0.9, "recovery": 1.3,

    # Neutral to Slightly Positive (0.1 to +0.4)
    "hold": 0.2, "maintain": 0.3, "continue": 0.2, "expect": 0.1, "breaking": 0.3,

    # Neutral to Slightly Negative (-0.4 to -0.1)
    "concern": -0.3, "question": -0.2, "uncertain": -0.3, "wait": -0.1,

    # Moderately Negative (-1.4 to -0.5)
    "down": -1.0, "lower": -1.1, "decrease": -1.0, "decline": -1.2, "fall": -1.1,
    "weak": -1.3, "struggle": -1.4, "lag": -1.2, "trail": -1.1, "slip": -1.0,
    "miss": -1.3, "disappoint": -1.4, "negative": -1.0, "bad": -0.9,

    # Negative (-2.4 to -1.5)
    "lose": -1.8, "loss": -1.9, "fail": -2.0, "drop": -1.7, "slump": -2.1,
    "bearish": -2.2, "pessimistic": -2.0, "doubt": -1.7, "risk": -1.6,
    "worry": -1.8, "fear": -1.9, "reject": -1.9, "oppose": -1.7,
    "underperform": -2.1, "behind": -1.6, "poor": -1.8, "trouble": -1.9,

    # Strongly Negative (-3.0 to -2.5)
    "crash": -2.9, "collapse": -3.0, "plunge": -2.8, "disaster": -2.9,
    "crisis": -2.7, "panic": -2.8, "catastrophic": -3.0, "devastating": -2.9,
    "plummet": -2.8, "tumble": -2.6, "scandal": -2.7, "defeat": -2.5,

    # Domain-Specific (Political)
    "poll": 0.1, "vote": 0.1, "election": 0.0, "debate": -0.1, "scandal": -2.7,
    "investigate": -1.5, "impeach": -2.4, "resign": -2.0, "endorse": 1.4,
    "primary": 0.0, "swing": 0.2, "battleground": -0.2,

    # Domain-Specific (Markets)
    "volatility": -1.2, "volume": 0.3, "liquidity": 0.8, "arbitrage": 0.9,
    "hedge": 0.4, "leverage": 0.2, "margin": -0.3, "squeeze": -1.6,
    "bubble": -2.2, "correction": -1.4, "reversal": -0.8, "breakout": 2.1,

    # Modifiers (used for boosting)
    "very": 0.0, "extremely": 0.0, "highly": 0.0, "incredibly": 0.0,
    "absolutely": 0.0, "totally": 0.0, "major": 0.0, "massive": 0.0,
}

# Negation words that flip polarity
NEGATIONS = {
    "not", "no", "never", "none", "nobody", "nothing", "neither", "nowhere",
    "hardly", "barely", "scarcely", "rarely", "doesn't", "don't", "didn't",
    "won't", "wouldn't", "can't", "cannot", "couldn't", "shouldn't",
}

# Amplifiers that boost sentiment intensity
AMPLIFIERS = {
    "very": 0.293, "extremely": 0.428, "highly": 0.293, "incredibly": 0.428,
    "absolutely": 0.350, "totally": 0.350, "completely": 0.350,
    "major": 0.293, "massive": 0.428, "huge": 0.350, "enormous": 0.428,
}


class SentimentIntensityAnalyzer:
    """
    Lexicon-based sentiment analyzer for financial and political text.

    Returns VADER-style compound scores normalized to [-1, 1] range.
    Handles negations, amplifiers, and ALL CAPS emphasis.

    Example:
        >>> analyzer = SentimentIntensityAnalyzer()
        >>> scores = analyzer.polarity_scores("BREAKING: Trump surges in polls")
        >>> print(scores['compound'])  # > 0.5
    """

    __slots__ = ('lexicon', 'negations', 'amplifiers')

    def __init__(self):
        self.lexicon = SENTIMENT_LEXICON
        self.negations = NEGATIONS
        self.amplifiers = AMPLIFIERS

    def _simple_stem(self, word: str) -> str:
        """
        Basic stemming: remove common suffixes to match root forms.
        Handles plurals (s, es) and verb forms (ing, ed).
        """
        # Try exact match first
        if word in self.lexicon:
            return word

        # Remove common suffixes
        if len(word) > 4:
            # Plural forms
            if word.endswith('es') and word[:-2] in self.lexicon:
                return word[:-2]
            if word.endswith('s') and word[:-1] in self.lexicon:
                return word[:-1]
            # Verb forms
            if word.endswith('ing') and word[:-3] in self.lexicon:
                return word[:-3]
            if word.endswith('ed') and word[:-2] in self.lexicon:
                return word[:-2]

        return word

    def polarity_scores(self, text: str) -> dict[str, float]:
        """
        Calculate sentiment polarity scores for input text.

        Args:
            text: Input text to analyze

        Returns:
            Dictionary with keys: 'pos', 'neg', 'neu', 'compound'
            - compound: normalized score in [-1, 1]
            - pos/neg/neu: proportion of sentiment (sum to 1.0)
        """
        if not text or not text.strip():
            return {"pos": 0.0, "neg": 0.0, "neu": 1.0, "compound": 0.0}

        # Tokenize and normalize
        tokens = self._tokenize(text)
        if not tokens:
            return {"pos": 0.0, "neg": 0.0, "neu": 1.0, "compound": 0.0}

        # Score each token with context
        sentiments = []
        for i, token in enumerate(tokens):
            score = self._get_token_sentiment(token, tokens, i)
            if score != 0.0:
                sentiments.append(score)

        if not sentiments:
            return {"pos": 0.0, "neg": 0.0, "neu": 1.0, "compound": 0.0}

        # Calculate compound score (VADER normalization)
        sum_s = sum(sentiments)
        compound = sum_s / math.sqrt(sum_s * sum_s + 15.0)

        # Calculate pos/neg/neu proportions
        pos_sum = sum(s for s in sentiments if s > 0)
        neg_sum = abs(sum(s for s in sentiments if s < 0))
        total = pos_sum + neg_sum

        if total > 0:
            pos = pos_sum / total
            neg = neg_sum / total
            neu = 1.0 - (pos + neg)
        else:
            pos = neg = 0.0
            neu = 1.0

        return {
            "pos": round(pos, 3),
            "neg": round(neg, 3),
            "neu": round(neu, 3),
            "compound": round(compound, 4),
        }

    def _tokenize(self, text: str) -> list[str]:
        """
        Simple tokenization: lowercase, split on non-alphanumeric.
        Preserves uppercase info for emphasis detection.
        """
        # Keep track of which words were ALL CAPS before lowercasing
        words = re.findall(r'\b[A-Za-z]+\b', text)
        return words

    def _get_token_sentiment(self, token: str, tokens: list[str], index: int) -> float:
        """
        Get sentiment score for a token considering context.

        Handles:
        - ALL CAPS emphasis (boost by 0.733)
        - Negation (flip polarity within window of 3 words)
        - Amplifiers (boost magnitude by amplifier weight)
        """
        token_lower = token.lower()

        # Apply stemming to find root form
        stemmed = self._simple_stem(token_lower)

        # Check if word is in lexicon
        if stemmed not in self.lexicon:
            return 0.0

        base_score = self.lexicon[stemmed]

        # ALL CAPS boost (if word is longer than 3 chars to avoid acronyms)
        if token.isupper() and len(token) > 3:
            base_score *= 1.733  # VADER constant

        # Check for negation in previous 3 tokens
        is_negated = False
        for i in range(max(0, index - 3), index):
            if tokens[i].lower() in self.negations:
                is_negated = True
                break

        if is_negated:
            base_score *= -0.74  # Flip and dampen (VADER constant)

        # Check for amplifier in previous token
        if index > 0:
            prev_token = tokens[index - 1].lower()
            if prev_token in self.amplifiers:
                boost = self.amplifiers[prev_token]
                if base_score > 0:
                    base_score += boost
                else:
                    base_score -= boost

        return base_score

    def __repr__(self) -> str:
        return f"SentimentIntensityAnalyzer(lexicon_size={len(self.lexicon)})"
