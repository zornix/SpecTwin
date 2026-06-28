"""Thin wrapper around the You.com Contents API.

Fetches clean Markdown for a batch of URLs so we never deal with raw HTML
or browser automation ourselves.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import List, Optional

from youdotcom import You
from youdotcom.models import ContentsFormats

from config import DEFAULT_CRAWL_TIMEOUT, get_api_key

MAX_URLS_PER_REQUEST = 10


@dataclass
class FetchedPage:
    """Result of a single URL fetch."""

    url: str
    title: Optional[str]
    markdown: Optional[str]

    @property
    def ok(self) -> bool:
        return bool(self.markdown)


def _chunk(items: List[str], size: int) -> List[List[str]]:
    return [items[i : i + size] for i in range(0, len(items), size)]


def fetch_pages(
    urls: List[str],
    crawl_timeout: int = DEFAULT_CRAWL_TIMEOUT,
) -> List[FetchedPage]:
    """Fetch Markdown for each URL via the Contents API (batched, max 10/request)."""
    if not urls:
        return []

    api_key = get_api_key()
    results: List[FetchedPage] = []

    with You(api_key_auth=api_key) as you:
        for batch in _chunk(urls, MAX_URLS_PER_REQUEST):
            pages = you.contents.generate(
                urls=batch,
                formats=[ContentsFormats.MARKDOWN],
                crawl_timeout=crawl_timeout,
            )
            for page in pages:
                results.append(
                    FetchedPage(
                        url=getattr(page, "url", None) or "",
                        title=getattr(page, "title", None),
                        markdown=getattr(page, "markdown", None),
                    )
                )

    return results
