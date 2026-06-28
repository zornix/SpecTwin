# misc — superseded code

These files implement the **earlier approach** that was considered and dropped:
filtering the product sitemap (`urls.txt`) down to sunglasses instead of
crawling the `/sunglasses` listing directly.

It was abandoned because product URLs carry **no reliable sunglasses marker**, so
the sitemap can't be filtered down to "sunglasses only" with confidence. The
`/sunglasses` listing is the site's own authoritative pre-filtered set, and it's
also the *only* place a **price** is exposed — so the live pipeline harvests that
listing instead (see `../README.md`).

Nothing in the active pipeline imports anything here. Kept for reference only.

| File | What it did |
| --- | --- |
| `filter_urls.py` | Pruned `urls.txt` down to sunglass *category* URLs |
| `sunglasses_crawl.py` | Discovered sunglasses category pages via the You.com API |
| `sitemap.py` | Read / filtered / re-rendered the `<urlset>` sitemap |
| `urls.txt` | Raw product sitemap dump (`desktop_sitemap_products_{0,1}.xml`) |
| `urls.json` | Parsed sitemap URLs |
| `sitemapcategories.txt` | Raw sunglasses category sitemap |

> `link_extract.py` stayed in the parent directory: although it began here, the
> live `listing_parse.py` reuses its `product_url()` recognizer.
