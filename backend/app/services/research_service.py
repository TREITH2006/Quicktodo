import logging

from ddgs import DDGS


logger = logging.getLogger(__name__)


def search_web(query: str, max_results: int = 5) -> list[dict]:
    """Search the web and return source details for AI research."""
    try:
        results = DDGS().text(
            query,
            max_results=max_results,
        )

        sources = []

        for item in results:
            sources.append(
                {
                    "title": item.get("title", ""),
                    "url": item.get("href", ""),
                    "snippet": item.get("body", ""),
                }
            )

        return sources

    except Exception:
        logger.exception("Web search failed.")
        return []