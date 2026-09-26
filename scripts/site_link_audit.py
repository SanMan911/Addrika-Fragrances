#!/usr/bin/env python3
"""Crawl the storefront and report broken internal links / images / API 5xx.

Usage: python3 scripts/site_link_audit.py [base_url] [--max 300]
Writes a markdown report to /app/memory/SITE_AUDIT_LINKS.md
"""
from __future__ import annotations

import re
import sys
from collections import deque
from html.parser import HTMLParser
from urllib.parse import urljoin, urlparse, urldefrag

import requests

BASE = sys.argv[1] if len(sys.argv) > 1 and not sys.argv[1].startswith("--") else "http://localhost:3000"
MAX_PAGES = 300
if "--max" in sys.argv:
    MAX_PAGES = int(sys.argv[sys.argv.index("--max") + 1])

SEEDS = ["/", "/sitemap.xml", "/robots.txt", "/manifest.json", "/llms.txt"]
SKIP_PREFIXES = ("/admin", "/api/", "/_next/", "/auth/callback", "/preview/")
EXTERNAL_OK_HOSTS = {"instagram.com", "www.instagram.com", "wa.me", "api.whatsapp.com"}


class LinkParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.links: list[tuple[str, str]] = []  # (kind, url)
        self.title = ""
        self._in_title = False
        self.text_hits: list[str] = []

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag == "a" and a.get("href"):
            self.links.append(("a", a["href"]))
        elif tag == "img" and a.get("src"):
            self.links.append(("img", a["src"]))
        elif tag == "link" and a.get("href") and a.get("rel") in ("icon", "apple-touch-icon", "manifest", "canonical"):
            self.links.append(("link", a["href"]))
        elif tag == "title":
            self._in_title = True

    def handle_endtag(self, tag):
        if tag == "title":
            self._in_title = False

    def handle_data(self, data):
        if self._in_title:
            self.title += data


def norm(url: str, page: str) -> str | None:
    if not url or url.startswith(("mailto:", "tel:", "javascript:", "data:", "#", "sms:", "whatsapp:")):
        return None
    full = urljoin(urljoin(BASE, page), url)
    full, _ = urldefrag(full)
    return full


def main():
    sess = requests.Session()
    sess.headers["User-Agent"] = "AAROHMM-LinkAudit/1"
    seen: dict[str, dict] = {}
    queue = deque(SEEDS)
    referers: dict[str, set] = {}
    base_host = urlparse(BASE).netloc

    while queue and len(seen) < MAX_PAGES:
        path = queue.popleft()
        if path in seen:
            continue
        url = urljoin(BASE, path)
        try:
            r = sess.get(url, timeout=25, allow_redirects=True)
            status = r.status_code
            ctype = r.headers.get("content-type", "")
        except Exception as e:
            seen[path] = {"status": f"ERR {e.__class__.__name__}", "title": "", "brand_hits": []}
            continue
        entry = {"status": status, "title": "", "brand_hits": [], "final": r.url}
        seen[path] = entry
        if status != 200 or "text/html" not in ctype:
            if path == "/sitemap.xml" and status == 200:
                for loc in re.findall(r"<loc>(.*?)</loc>", r.text):
                    p = urlparse(loc).path
                    if p and p not in seen and not p.startswith(SKIP_PREFIXES):
                        queue.append(p)
            continue
        html = r.text
        p = LinkParser()
        p.feed(html)
        entry["title"] = p.title.strip()
        entry["brand_hits"] = sorted(set(re.findall(r"Addrika|ADDRIKA", html)))
        for kind, href in p.links:
            full = norm(href, path)
            if not full:
                continue
            u = urlparse(full)
            if u.netloc != base_host:
                continue
            target = u.path + (f"?{u.query}" if u.query and kind == "a" else "")
            referers.setdefault(target, set()).add(path)
            if kind in ("img", "link"):
                if target not in seen and not target.startswith("/_next/"):
                    queue.appendleft(target)  # cheap HEAD-ish check via GET
            elif not target.startswith(SKIP_PREFIXES) and target not in seen:
                queue.append(target)

    broken = {k: v for k, v in seen.items() if not (isinstance(v["status"], int) and v["status"] < 400)}
    brand = {k: v["brand_hits"] for k, v in seen.items() if v.get("brand_hits")}
    lines = [f"# Site link audit — {BASE}", "", f"Pages/assets checked: {len(seen)}", ""]
    lines.append("## Broken (>=400 / errors)")
    if not broken:
        lines.append("_none_")
    for k, v in sorted(broken.items()):
        refs = ", ".join(sorted(referers.get(k, []))[:5]) or "(seed)"
        lines.append(f"- `{k}` → **{v['status']}** — linked from: {refs}")
    lines += ["", "## Legacy brand string still rendered"]
    if not brand:
        lines.append("_none_")
    for k, hits in sorted(brand.items()):
        lines.append(f"- `{k}` → {hits}")
    lines += ["", "## All pages"]
    for k, v in sorted(seen.items()):
        if isinstance(v["status"], int) and v["status"] < 400 and v.get("title"):
            lines.append(f"- `{k}` — {v['status']} — {v['title'][:80]}")
    out = "\n".join(lines)
    with open("/app/memory/SITE_AUDIT_LINKS.md", "w") as f:
        f.write(out + "\n")
    print(out)


if __name__ == "__main__":
    main()
