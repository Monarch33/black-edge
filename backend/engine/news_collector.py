"""
News Collector — Multi-source aggregator for Black Edge
========================================================
Collecte des headlines de Google News RSS, CryptoPanic, et Reddit.
Les résultats sont normalisés en NewsItem pour injection dans
FeatureEngineer et NarrativeVelocityLite.
"""

import asyncio
import time
from dataclasses import dataclass
from typing import Optional

import httpx
import structlog

logger = structlog.get_logger()


@dataclass
class NewsItem:
    """A single news item from any source."""
    title: str
    source: str           # "google_news", "cryptopanic", "reddit"
    url: str
    published_ms: int     # timestamp milliseconds
    category: str         # "crypto", "politics", "sports", "economy", "tech", "world"
    raw_source: str       # nom de la source originale (ex: "Reuters", "CoinDesk")


class NewsCollector:
    """
    Multi-source news aggregator for the Black Edge pipeline.

    Collecte des headlines de Google News RSS, CryptoPanic, et Reddit.
    Les résultats sont normalisés en NewsItem pour injection dans
    FeatureEngineer et NarrativeVelocityLite.
    """

    def __init__(self, cryptopanic_token: str = ""):
        self._client: httpx.AsyncClient | None = None
        self._cryptopanic_token = cryptopanic_token
        self._seen_urls: set[str] = set()  # Déduplication
        self._last_fetch: dict[str, float] = {}  # Rate limiting par source

    async def _get_client(self) -> httpx.AsyncClient:
        if self._client is None or self._client.is_closed:
            self._client = httpx.AsyncClient(
                timeout=httpx.Timeout(15.0, connect=10.0),
                headers={"User-Agent": "BlackEdge/3.0"},
                follow_redirects=True,
            )
        return self._client

    async def _rate_limit(self, source: str, min_interval: float = 5.0) -> None:
        """Enforce minimum interval between requests per source."""
        now = time.monotonic()
        last = self._last_fetch.get(source, 0)
        if now - last < min_interval:
            await asyncio.sleep(min_interval - (now - last))
        self._last_fetch[source] = time.monotonic()

    # ─── GOOGLE NEWS RSS ───

    async def fetch_google_news(self, query: str, max_results: int = 10) -> list[NewsItem]:
        """Fetch headlines from Google News RSS for a specific query."""
        import feedparser

        await self._rate_limit("google_news", 5.0)
        client = await self._get_client()

        url = f"https://news.google.com/rss/search?q={query}&hl=en-US&gl=US&ceid=US:en"

        try:
            resp = await client.get(url)
            resp.raise_for_status()
            feed = feedparser.parse(resp.text)

            items = []
            for entry in feed.entries[:max_results]:
                news_url = entry.get("link", "")
                if news_url in self._seen_urls:
                    continue
                self._seen_urls.add(news_url)

                # Parse published time
                published = entry.get("published_parsed")
                if published:
                    import calendar
                    ts_ms = int(calendar.timegm(published) * 1000)
                else:
                    ts_ms = int(time.time() * 1000)

                # Extract source from title (Google News format: "Title - Source")
                title = entry.get("title", "")
                raw_source = ""
                if " - " in title:
                    parts = title.rsplit(" - ", 1)
                    title = parts[0]
                    raw_source = parts[1] if len(parts) > 1 else ""

                # Categorize
                category = self._categorize(title, query)

                items.append(NewsItem(
                    title=title,
                    source="google_news",
                    url=news_url,
                    published_ms=ts_ms,
                    category=category,
                    raw_source=raw_source,
                ))

            logger.info("Google News fetched", query=query, results=len(items))
            return items

        except Exception as e:
            logger.error("Google News fetch failed", query=query, error=str(e))
            return []

    async def fetch_google_news_topic(self, topic: str, max_results: int = 10) -> list[NewsItem]:
        """Fetch top headlines by Google News topic category."""
        import feedparser

        await self._rate_limit(f"google_news_{topic}", 5.0)
        client = await self._get_client()

        # Topics: WORLD, NATION, BUSINESS, TECHNOLOGY, ENTERTAINMENT, SPORTS, SCIENCE, HEALTH
        url = f"https://news.google.com/rss/headlines/section/topic/{topic}?hl=en-US&gl=US&ceid=US:en"

        try:
            resp = await client.get(url)
            resp.raise_for_status()
            feed = feedparser.parse(resp.text)

            topic_to_category = {
                "WORLD": "world", "NATION": "politics", "BUSINESS": "economy",
                "TECHNOLOGY": "tech", "SPORTS": "sports", "SCIENCE": "tech",
                "HEALTH": "world", "ENTERTAINMENT": "world",
            }
            category = topic_to_category.get(topic, "world")

            items = []
            for entry in feed.entries[:max_results]:
                news_url = entry.get("link", "")
                if news_url in self._seen_urls:
                    continue
                self._seen_urls.add(news_url)

                published = entry.get("published_parsed")
                if published:
                    import calendar
                    ts_ms = int(calendar.timegm(published) * 1000)
                else:
                    ts_ms = int(time.time() * 1000)

                title = entry.get("title", "")
                raw_source = ""
                if " - " in title:
                    parts = title.rsplit(" - ", 1)
                    title = parts[0]
                    raw_source = parts[1] if len(parts) > 1 else ""

                items.append(NewsItem(
                    title=title,
                    source="google_news",
                    url=news_url,
                    published_ms=ts_ms,
                    category=category,
                    raw_source=raw_source,
                ))

            logger.info("Google News topic fetched", topic=topic, results=len(items))
            return items

        except Exception as e:
            logger.error("Google News topic fetch failed", topic=topic, error=str(e))
            return []

    # ─── CRYPTOPANIC ───

    async def fetch_cryptopanic(self, filter_type: str = "hot", max_results: int = 20) -> list[NewsItem]:
        """Fetch crypto news from CryptoPanic API."""
        await self._rate_limit("cryptopanic", 12.0)  # 5 req/min = 12s interval
        client = await self._get_client()

        params = {"filter": filter_type}
        if self._cryptopanic_token:
            params["auth_token"] = self._cryptopanic_token

        url = "https://cryptopanic.com/api/free/v1/posts/"

        try:
            resp = await client.get(url, params=params)
            resp.raise_for_status()
            data = resp.json()

            items = []
            for post in data.get("results", [])[:max_results]:
                post_url = post.get("url", "")
                if post_url in self._seen_urls:
                    continue
                self._seen_urls.add(post_url)

                # Parse timestamp
                created_at = post.get("created_at", "")
                try:
                    from datetime import datetime
                    dt = datetime.fromisoformat(created_at.replace("Z", "+00:00"))
                    ts_ms = int(dt.timestamp() * 1000)
                except Exception:
                    ts_ms = int(time.time() * 1000)

                items.append(NewsItem(
                    title=post.get("title", ""),
                    source="cryptopanic",
                    url=post_url,
                    published_ms=ts_ms,
                    category="crypto",
                    raw_source=post.get("source", {}).get("title", ""),
                ))

            logger.info("CryptoPanic fetched", filter=filter_type, results=len(items))
            return items

        except Exception as e:
            logger.error("CryptoPanic fetch failed", error=str(e))
            return []

    # ─── REDDIT ───

    async def fetch_reddit(self, subreddit: str, max_results: int = 15) -> list[NewsItem]:
        """Fetch hot posts from a subreddit."""
        await self._rate_limit(f"reddit_{subreddit}", 5.0)
        client = await self._get_client()

        url = f"https://www.reddit.com/r/{subreddit}/hot.json?limit={max_results}"

        sub_to_category = {
            "polymarket": "crypto",
            "cryptocurrency": "crypto",
            "bitcoin": "crypto",
            "politics": "politics",
            "worldnews": "world",
            "sportsbetting": "sports",
            "nfl": "sports",
            "nba": "sports",
            "soccer": "sports",
            "economics": "economy",
        }
        category = sub_to_category.get(subreddit, "world")

        try:
            resp = await client.get(url)
            resp.raise_for_status()
            data = resp.json()

            items = []
            for child in data.get("data", {}).get("children", []):
                post = child.get("data", {})
                post_url = post.get("url", "")

                # Skip stickied and self-posts without substance
                if post.get("stickied", False):
                    continue

                title = post.get("title", "")
                if not title or len(title) < 10:
                    continue

                if post_url in self._seen_urls:
                    continue
                self._seen_urls.add(post_url)

                ts_ms = int(post.get("created_utc", time.time()) * 1000)

                items.append(NewsItem(
                    title=title,
                    source="reddit",
                    url=post_url,
                    published_ms=ts_ms,
                    category=category,
                    raw_source=f"r/{subreddit}",
                ))

            logger.info("Reddit fetched", subreddit=subreddit, results=len(items))
            return items

        except Exception as e:
            logger.error("Reddit fetch failed", subreddit=subreddit, error=str(e))
            return []

    # ─── FULL SWEEP ───

    async def collect_all(self, market_questions: list[str] = None) -> list[NewsItem]:
        """
        Collecte massive de toutes les sources.

        Args:
            market_questions: Liste de questions de marché Polymarket actifs
                              (pour chercher des news liées)

        Returns:
            Liste de NewsItem dédupliquées, triées par date
        """
        all_items: list[NewsItem] = []

        # 1. Google News par catégorie (headlines générales)
        topics = ["WORLD", "NATION", "BUSINESS", "TECHNOLOGY", "SPORTS"]
        for topic in topics:
            items = await self.fetch_google_news_topic(topic, max_results=5)
            all_items.extend(items)

        # 2. Google News par query liée aux marchés actifs
        if market_questions:
            # Extraire les keywords des 10 premiers marchés
            for question in market_questions[:10]:
                keywords = self._extract_search_query(question)
                if keywords:
                    items = await self.fetch_google_news(keywords, max_results=5)
                    all_items.extend(items)

        # 3. CryptoPanic (hot + rising)
        items = await self.fetch_cryptopanic("hot", max_results=10)
        all_items.extend(items)
        items = await self.fetch_cryptopanic("rising", max_results=10)
        all_items.extend(items)

        # 4. Reddit (subreddits pertinents)
        subreddits = ["polymarket", "cryptocurrency", "politics", "worldnews", "sportsbetting"]
        for sub in subreddits:
            items = await self.fetch_reddit(sub, max_results=10)
            all_items.extend(items)

        # Trier par date (plus récent en premier)
        all_items.sort(key=lambda x: x.published_ms, reverse=True)

        # Limiter le cache de déduplication (garder 5000 dernières URLs)
        if len(self._seen_urls) > 5000:
            self._seen_urls = set(list(self._seen_urls)[-3000:])

        logger.info(
            "📰 News collection complete",
            total_items=len(all_items),
            sources={
                "google_news": sum(1 for i in all_items if i.source == "google_news"),
                "cryptopanic": sum(1 for i in all_items if i.source == "cryptopanic"),
                "reddit": sum(1 for i in all_items if i.source == "reddit"),
            }
        )

        return all_items

    # ─── HELPERS ───

    @staticmethod
    def _categorize(title: str, query: str = "") -> str:
        """Categorize a headline."""
        text = (title + " " + query).lower()
        if any(w in text for w in ["bitcoin", "crypto", "ethereum", "btc", "eth", "solana", "defi", "nft", "blockchain"]):
            return "crypto"
        if any(w in text for w in ["trump", "biden", "election", "vote", "congress", "senate", "president", "democrat", "republican"]):
            return "politics"
        if any(w in text for w in ["nfl", "nba", "super bowl", "championship", "game", "score", "player", "match", "soccer", "football"]):
            return "sports"
        if any(w in text for w in ["fed", "rate", "inflation", "gdp", "stock", "market", "economy", "recession", "tariff"]):
            return "economy"
        if any(w in text for w in ["ai", "tech", "apple", "google", "microsoft", "openai", "regulation"]):
            return "tech"
        return "world"

    @staticmethod
    def _extract_search_query(question: str) -> str:
        """Extract a Google-searchable query from a Polymarket question."""
        # Enlever les mots interrogatifs et les dates
        import re
        q = question.lower()
        # Remove common question patterns
        q = re.sub(r'^(will|does|is|are|has|have|can|could|would|should)\s+', '', q)
        q = re.sub(r'\b(by|before|after|in|on|at|during)\s+(january|february|march|april|may|june|july|august|september|october|november|december)\s*\d*\s*,?\s*\d*', '', q)
        q = re.sub(r'\b(2024|2025|2026|2027)\b', '', q)
        q = re.sub(r'\?', '', q)
        q = q.strip()
        # Garder les 5 premiers mots significatifs
        words = [w for w in q.split() if len(w) > 2][:5]
        return " ".join(words)

    async def close(self) -> None:
        if self._client and not self._client.is_closed:
            await self._client.aclose()
            self._client = None
