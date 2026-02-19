"""
Agent LLM — Intelligence Core (L'Oracle IA)
===========================================
Appel Claude/OpenAI, output JSON validé Pydantic.
Calcul Alpha : Probabilité IA vs Probabilité Marché.
"""

import json
import re

import httpx
import structlog
from tenacity import (
    retry,
    stop_after_attempt,
    wait_exponential,
    retry_if_exception_type,
)

from blackedge.api.models import Market
from blackedge.config import BlackEdgeSettings
from blackedge.intelligence.schemas import AgentAnalysis, AlphaSignal

logger = structlog.get_logger()


class LLMAgent:
    """
    Agent IA pour l'analyse des marchés.
    Retourne une probabilité réelle — comparée au marché pour détecter l'Alpha.
    """

    def __init__(self, settings: BlackEdgeSettings | None = None) -> None:
        self._settings = settings or BlackEdgeSettings()
        self._client: httpx.AsyncClient | None = None

    async def _get_client(self) -> httpx.AsyncClient:
        if self._client is None or self._client.is_closed:
            self._client = httpx.AsyncClient(
                timeout=httpx.Timeout(60.0, connect=15.0),
                headers={"User-Agent": "BlackEdge/1.0"},
            )
        return self._client

    async def close(self) -> None:
        if self._client and not self._client.is_closed:
            await self._client.aclose()
            self._client = None

    def _build_prompt(self, market: Market) -> str:
        return f"""Tu es un analyste quantitatif expert des marchés prédictifs. Tu dois estimer la VRAIE probabilité qu'un événement se réalise, indépendamment du prix du marché.

MARCHÉ À ANALYSER:
- Question: {market.question}
- Description: {market.description[:800] if market.description else "N/A"}
- Prix actuel YES: {market.yes_price:.2%}
- Prix actuel NO: {market.no_price:.2%}
- Volume 24h: ${market.volume_24h:,.0f}
- Liquidité: ${market.liquidity:,.0f}

INSTRUCTIONS:
1. Estime la probabilité RÉELLE que la réponse soit "Yes" (entre 0 et 1).
2. Le marché peut être inefficace — ta probabilité peut différer du prix.
3. Donne un score de confiance (0-1) pour ton estimation.
4. Recommande YES ou NO selon ta probabilité vs le prix (achète le sous-évalué).

Réponds UNIQUEMENT en JSON valide, sans markdown, avec exactement ces champs:
{{
  "market_id": "{market.id}",
  "ia_probability": <float 0-1>,
  "confidence_score": <float 0-1>,
  "reasoning": "<2-3 phrases concises>",
  "recommended_side": "YES ou NO"
}}"""

    def _extract_json(self, text: str) -> dict | None:
        """Extrait le JSON de la réponse (gère les blocs markdown)."""
        text = text.strip()
        # Enlever ```json ... ```
        match = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", text)
        if match:
            text = match.group(1).strip()
        # Chercher un objet JSON
        start = text.find("{")
        if start >= 0:
            depth = 0
            for i, c in enumerate(text[start:], start):
                if c == "{":
                    depth += 1
                elif c == "}":
                    depth -= 1
                    if depth == 0:
                        try:
                            return json.loads(text[start : i + 1])
                        except json.JSONDecodeError:
                            pass
        try:
            return json.loads(text)
        except json.JSONDecodeError:
            return None

    @retry(
        stop=stop_after_attempt(2),
        wait=wait_exponential(multiplier=1, min=2, max=15),
        retry=retry_if_exception_type((httpx.HTTPError, httpx.TimeoutException)),
    )
    async def analyze_market(self, market: Market) -> AgentAnalysis | None:
        """
        Analyse un marché via le LLM.
        Retourne None si JSON invalide → trade annulé (fail-safe).
        """
        api_key = self._settings.llm_api_key
        if not api_key:
            logger.warning("llm_api_key_missing", hint="Définir BLACKEDGE_LLM_API_KEY")
            return None

        prompt = self._build_prompt(market)
        client = await self._get_client()
        provider = self._settings.llm_provider.lower()

        try:
            if provider == "anthropic":
                raw = await self._call_anthropic(client, api_key, prompt)
            elif provider == "openai":
                raw = await self._call_openai(client, api_key, prompt)
            else:
                logger.warning("unknown_llm_provider", provider=provider)
                return None

            if not raw:
                return None

            data = self._extract_json(raw)
            if not data:
                logger.warning("llm_invalid_json", raw_preview=raw[:200])
                return None

            # Forcer market_id pour cohérence
            data["market_id"] = market.id
            return AgentAnalysis.model_validate(data)

        except Exception as e:
            logger.error("llm_analysis_failed", error=str(e), market_id=market.id)
            return None

    async def _call_anthropic(
        self, client: httpx.AsyncClient, api_key: str, prompt: str
    ) -> str | None:
        url = "https://api.anthropic.com/v1/messages"
        payload = {
            "model": self._settings.llm_model,
            "max_tokens": 1024,
            "messages": [{"role": "user", "content": prompt}],
        }
        headers = {
            "x-api-key": api_key,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
        }
        resp = await client.post(url, json=payload, headers=headers)
        resp.raise_for_status()
        data = resp.json()
        for block in data.get("content", []):
            if block.get("type") == "text":
                return block.get("text", "")
        return None

    async def _call_openai(
        self, client: httpx.AsyncClient, api_key: str, prompt: str
    ) -> str | None:
        url = "https://api.openai.com/v1/chat/completions"
        payload = {
            "model": self._settings.llm_model,
            "max_tokens": 1024,
            "messages": [{"role": "user", "content": prompt}],
        }
        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        }
        resp = await client.post(url, json=payload, headers=headers)
        resp.raise_for_status()
        data = resp.json()
        choice = data.get("choices", [{}])[0]
        return choice.get("message", {}).get("content", "")

    def compute_alpha(
        self, market: Market, analysis: AgentAnalysis
    ) -> AlphaSignal | None:
        """
        Compare probabilité IA vs Marché.
        Si décalage >= alpha_threshold_pct → signal Alpha.
        """
        threshold = self._settings.alpha_threshold_pct / 100.0
        market_prob = market.market_probability
        ia_prob = analysis.ia_probability
        delta = abs(ia_prob - market_prob)

        if delta < threshold:
            return None

        # Côté recommandé : YES si IA > Marché (YES sous-évalué), NO sinon
        side = analysis.recommended_side.upper()
        if side not in ("YES", "NO"):
            side = "YES" if ia_prob > market_prob else "NO"

        return AlphaSignal(
            market_id=market.id,
            market_question=market.question,
            market_probability=market_prob,
            ia_probability=ia_prob,
            alpha_pct=delta * 100,
            confidence_score=analysis.confidence_score,
            side=side,
            reasoning=analysis.reasoning,
        )
