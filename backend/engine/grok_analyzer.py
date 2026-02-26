"""
Black Edge — Grok xAI / OpenAI Integration
==========================================
Uses xAI's Grok API when available, falls back to OpenAI (Railway OPENAI_API_KEY).
"""

import os
import asyncio
import httpx
import structlog
from typing import Optional

logger = structlog.get_logger()

GROK_API_KEY = os.getenv("GROK_API_KEY", "")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
GROK_BASE = "https://api.x.ai/v1"
GROK_MODEL = "grok-3-mini"
OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-4o-mini")


class GrokAnalyzer:
    """Grok xAI or OpenAI integration for market analysis and commentary."""

    def __init__(self):
        self.grok_key = GROK_API_KEY
        self.openai_key = OPENAI_API_KEY
        self.base_url = GROK_BASE
        self.model = GROK_MODEL

    def _prefer_openai(self) -> bool:
        """Utilise OpenAI si Grok non configuré (clé OpenAI sur Railway)."""
        return not self.grok_key and bool(self.openai_key)

    async def _call_openai(self, messages: list[dict], max_tokens: int = 300) -> Optional[str]:
        """Fallback: appel OpenAI quand Grok non configuré (Railway OPENAI_API_KEY)."""
        if not self.openai_key:
            return None
        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                resp = await client.post(
                    "https://api.openai.com/v1/chat/completions",
                    headers={
                        "Authorization": f"Bearer {self.openai_key}",
                        "Content-Type": "application/json",
                    },
                    json={
                        "model": OPENAI_MODEL,
                        "messages": messages,
                        "max_tokens": max_tokens,
                        "temperature": 0.3,
                    },
                )
                resp.raise_for_status()
                data = resp.json()
                return data["choices"][0]["message"]["content"].strip()
        except Exception as e:
            logger.error("OpenAI API call failed", error=str(e))
            return None

    async def _call_grok(self, messages: list[dict], max_tokens: int = 300) -> Optional[str]:
        """Make a call to Grok or OpenAI API and return the response text."""
        if self._prefer_openai():
            return await self._call_openai(messages, max_tokens)

        if not self.grok_key:
            return None

        headers = {
            "Authorization": f"Bearer {self.grok_key}",
            "Content-Type": "application/json",
        }
        payload = {
            "model": self.model,
            "messages": messages,
            "max_tokens": max_tokens,
            "temperature": 0.3,
        }

        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                resp = await client.post(
                    f"{self.base_url}/chat/completions",
                    headers=headers,
                    json=payload,
                )
                resp.raise_for_status()
                data = resp.json()
                return data["choices"][0]["message"]["content"].strip()
        except Exception as e:
            logger.error("Grok API call failed, trying OpenAI fallback", error=str(e))
            return await self._call_openai(messages, max_tokens)

    async def analyze_market(
        self,
        question: str,
        yes_price: float,
        volume: float,
        context: str = "",
    ) -> dict:
        """
        Analyze a single prediction market using Grok.

        Returns:
            {
                edge_assessment: str,
                risk_factor: str,
                confidence: str,
                direction: str,  # "YES" | "NO" | "NEUTRAL"
                reasoning: str,
            }
        """
        prompt = f"""Analyze this prediction market briefly:

Question: {question}
Current YES price: {yes_price:.2%}
24h Volume: ${volume:,.0f}
{f"Context: {context}" if context else ""}

Respond with JSON only:
{{
  "edge_assessment": "brief edge assessment (1 sentence)",
  "risk_factor": "low|medium|high",
  "confidence": "low|medium|high",
  "direction": "YES|NO|NEUTRAL",
  "reasoning": "1-2 sentence reasoning"
}}"""

        messages = [
            {"role": "system", "content": "You are a quantitative prediction market analyst. Be concise and data-driven."},
            {"role": "user", "content": prompt},
        ]

        response = await self._call_grok(messages, max_tokens=200)

        if not response:
            return {
                "edge_assessment": "Analysis unavailable",
                "risk_factor": "medium",
                "confidence": "low",
                "direction": "NEUTRAL",
                "reasoning": "Grok API unavailable",
            }

        # Parse JSON response
        import json
        try:
            # Strip markdown code fences if present
            clean = response.strip()
            if clean.startswith("```"):
                clean = clean.split("```")[1]
                if clean.startswith("json"):
                    clean = clean[4:]
            return json.loads(clean.strip())
        except Exception:
            return {
                "edge_assessment": response[:100],
                "risk_factor": "medium",
                "confidence": "medium",
                "direction": "NEUTRAL",
                "reasoning": response[:200],
            }

    async def generate_commentary(self, signals: list[dict]) -> str:
        """
        Generate a 2-3 sentence market overview for the top signals.

        Args:
            signals: List of signal dicts with question, edge, direction fields

        Returns:
            2-3 sentence market commentary string
        """
        if not signals:
            return "No active signals to analyze."

        top = signals[:5]
        signal_summary = "\n".join([
            f"- {s.get('question', 'Unknown')[:80]} | Edge: {s.get('edge', 0):.1%} | Direction: {s.get('direction', 'N/A')}"
            for s in top
        ])

        prompt = f"""Given these top Polymarket signals:

{signal_summary}

Write a 2-3 sentence market overview commentary for traders. Be specific, data-driven, and mention the strongest edge opportunity. No fluff."""

        messages = [
            {"role": "system", "content": "You are a terse, quantitative prediction market analyst writing for professional traders."},
            {"role": "user", "content": prompt},
        ]

        response = await self._call_grok(messages, max_tokens=150)
        return response or "Markets are active. Monitor top signals for execution opportunities."


# Singleton instance
_analyzer: Optional[GrokAnalyzer] = None


def get_analyzer() -> GrokAnalyzer:
    global _analyzer
    if _analyzer is None:
        _analyzer = GrokAnalyzer()
    return _analyzer
