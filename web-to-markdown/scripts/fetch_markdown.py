#!/usr/bin/env python3
"""Fetch a web page and save it as Markdown.

Usage:
    python fetch_markdown.py <url> [--output <path>] [--api-key <key>] [--zone-id <id>]

Strategy:
    1. If Cloudflare credentials provided, try `Accept: text/markdown` first
    2. Fall back to fetching HTML and converting with basic heuristics
    3. Save result to docs/ directory as .md file
"""

import argparse
import html
import os
import re
import sys
import urllib.request
import urllib.error
from datetime import datetime
from pathlib import Path
from urllib.parse import urlparse


def fetch_with_cloudflare_markdown(url: str, api_key: str | None = None) -> str | None:
    """Try fetching markdown via Cloudflare's text/markdown Accept header."""
    headers = {"Accept": "text/markdown", "User-Agent": "Claude-Code-Skill/1.0"}
    if api_key:
        headers["Authorization"] = f"Bearer {api_key}"

    req = urllib.request.Request(url, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            content_type = resp.headers.get("Content-Type", "")
            if "text/markdown" in content_type:
                return resp.read().decode("utf-8")
    except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError):
        pass
    return None


def fetch_html(url: str) -> str:
    """Fetch raw HTML from a URL."""
    headers = {
        "User-Agent": "Mozilla/5.0 (compatible; Claude-Code-Skill/1.0)",
        "Accept": "text/html,application/xhtml+xml",
    }
    req = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(req, timeout=15) as resp:
        return resp.read().decode("utf-8", errors="replace")


def strip_tag(html_str: str, tag: str) -> str:
    """Remove a tag and its contents entirely."""
    return re.sub(rf"<{tag}[\s>].*?</{tag}>", "", html_str, flags=re.DOTALL | re.IGNORECASE)


def extract_main_content(html_str: str) -> str:
    """Extract main content area from HTML."""
    for tag in ["main", "article", r'div[^>]*role=["\']main["\']']:
        m = re.search(rf"<{tag}[^>]*>(.*?)</(?:{tag.split('[')[0]})>", html_str, re.DOTALL | re.IGNORECASE)
        if m:
            return m.group(1)
    # fallback: body
    m = re.search(r"<body[^>]*>(.*?)</body>", html_str, re.DOTALL | re.IGNORECASE)
    if m:
        return m.group(1)
    return html_str


def html_to_markdown(raw_html: str) -> str:
    """Convert HTML to Markdown using regex-based approach (no external deps)."""
    text = raw_html

    # Remove unwanted tags entirely
    for tag in ["script", "style", "nav", "footer", "header", "aside", "noscript", "svg", "iframe"]:
        text = strip_tag(text, tag)

    # Extract main content
    text = extract_main_content(text)

    # Remove HTML comments
    text = re.sub(r"<!--.*?-->", "", text, flags=re.DOTALL)

    # Headings
    for i in range(6, 0, -1):
        text = re.sub(
            rf"<h{i}[^>]*>(.*?)</h{i}>",
            lambda m, level=i: f"\n\n{'#' * level} {m.group(1).strip()}\n\n",
            text, flags=re.DOTALL | re.IGNORECASE
        )

    # Code blocks (pre > code)
    def convert_code_block(m):
        code_tag = m.group(1)
        lang = ""
        lang_m = re.search(r'class="[^"]*(?:language|lang)-(\w+)', code_tag)
        if lang_m:
            lang = lang_m.group(1)
        # Extract inner text
        code_m = re.search(r"<code[^>]*>(.*?)</code>", code_tag, re.DOTALL | re.IGNORECASE)
        content = code_m.group(1) if code_m else code_tag
        content = html.unescape(re.sub(r"<[^>]+>", "", content))
        return f"\n\n```{lang}\n{content.strip()}\n```\n\n"

    text = re.sub(r"<pre[^>]*>(.*?)</pre>", convert_code_block, text, flags=re.DOTALL | re.IGNORECASE)

    # Inline code
    text = re.sub(r"<code[^>]*>(.*?)</code>", r"`\1`", text, flags=re.DOTALL | re.IGNORECASE)

    # Links
    text = re.sub(
        r'<a[^>]*href="([^"]*)"[^>]*>(.*?)</a>',
        r"[\2](\1)",
        text, flags=re.DOTALL | re.IGNORECASE
    )

    # Images
    text = re.sub(
        r'<img[^>]*src="([^"]*)"[^>]*alt="([^"]*)"[^>]*/?>',
        r"![\2](\1)",
        text, flags=re.IGNORECASE
    )
    text = re.sub(
        r'<img[^>]*src="([^"]*)"[^>]*/?>',
        r"![](\1)",
        text, flags=re.IGNORECASE
    )

    # Bold / Italic
    text = re.sub(r"<(?:strong|b)[^>]*>(.*?)</(?:strong|b)>", r"**\1**", text, flags=re.DOTALL | re.IGNORECASE)
    text = re.sub(r"<(?:em|i)[^>]*>(.*?)</(?:em|i)>", r"*\1*", text, flags=re.DOTALL | re.IGNORECASE)

    # Lists
    text = re.sub(r"<li[^>]*>(.*?)</li>", r"\n- \1", text, flags=re.DOTALL | re.IGNORECASE)

    # Blockquotes
    text = re.sub(
        r"<blockquote[^>]*>(.*?)</blockquote>",
        lambda m: "\n" + "\n".join(f"> {line}" for line in m.group(1).strip().split("\n")) + "\n",
        text, flags=re.DOTALL | re.IGNORECASE
    )

    # Paragraphs / line breaks
    text = re.sub(r"<br\s*/?>", "\n", text, flags=re.IGNORECASE)
    text = re.sub(r"<p[^>]*>(.*?)</p>", r"\n\n\1\n\n", text, flags=re.DOTALL | re.IGNORECASE)
    text = re.sub(r"<hr[^>]*/?>", "\n\n---\n\n", text, flags=re.IGNORECASE)

    # Tables
    text = re.sub(r"</?thead[^>]*>", "", text, flags=re.IGNORECASE)
    text = re.sub(r"</?tbody[^>]*>", "", text, flags=re.IGNORECASE)
    text = re.sub(r"<th[^>]*>(.*?)</th>", r"| \1 ", text, flags=re.DOTALL | re.IGNORECASE)
    text = re.sub(r"<td[^>]*>(.*?)</td>", r"| \1 ", text, flags=re.DOTALL | re.IGNORECASE)
    text = re.sub(r"<tr[^>]*>(.*?)</tr>", r"\1|\n", text, flags=re.DOTALL | re.IGNORECASE)
    text = re.sub(r"</?table[^>]*>", "\n", text, flags=re.IGNORECASE)

    # Strip remaining tags
    text = re.sub(r"<[^>]+>", "", text)

    # Decode HTML entities
    text = html.unescape(text)

    # Clean up whitespace
    text = re.sub(r"\n{3,}", "\n\n", text)
    text = re.sub(r"[ \t]+\n", "\n", text)
    text = re.sub(r"\n[ \t]+", "\n", text)
    text = text.strip()

    return text


def url_to_filename(url: str) -> str:
    """Generate a filename from URL."""
    parsed = urlparse(url)
    path = parsed.path.strip("/")
    if not path:
        path = parsed.netloc
    # Convert path to filename
    name = path.replace("/", "_").replace(".", "_")
    name = re.sub(r"[^a-zA-Z0-9_-]", "", name)
    if not name:
        name = "page"
    return name[:80]


def main():
    parser = argparse.ArgumentParser(description="Fetch web page as Markdown")
    parser.add_argument("url", help="URL to fetch")
    parser.add_argument("--output", "-o", help="Output file path (default: docs/<name>.md)")
    parser.add_argument("--api-key", help="Cloudflare API key (or set CLOUDFLARE_API_KEY env)")
    parser.add_argument("--zone-id", help="Cloudflare Zone ID (or set CLOUDFLARE_ZONE_ID env)")
    args = parser.parse_args()

    api_key = args.api_key or os.environ.get("CLOUDFLARE_API_KEY")

    # Try Cloudflare markdown-for-agents first
    markdown = None
    if api_key:
        print(f"Trying Cloudflare Markdown for Agents...", file=sys.stderr)
        markdown = fetch_with_cloudflare_markdown(args.url, api_key)
        if markdown:
            print(f"Got markdown from Cloudflare ({len(markdown)} chars)", file=sys.stderr)

    # Fallback: fetch HTML and convert
    if not markdown:
        # Also try without API key - some sites support it natively
        markdown = fetch_with_cloudflare_markdown(args.url)
        if markdown:
            print(f"Got markdown via Accept header ({len(markdown)} chars)", file=sys.stderr)

    if not markdown:
        print("Fetching HTML and converting...", file=sys.stderr)
        raw_html = fetch_html(args.url)
        markdown = html_to_markdown(raw_html)
        print(f"Converted HTML to markdown ({len(markdown)} chars)", file=sys.stderr)

    # Add source metadata header
    now = datetime.now().strftime("%Y-%m-%d %H:%M")
    header = f"<!-- Source: {args.url} -->\n<!-- Fetched: {now} -->\n\n"
    markdown = header + markdown

    # Determine output path
    if args.output:
        out_path = Path(args.output)
    else:
        docs_dir = Path("docs")
        docs_dir.mkdir(exist_ok=True)
        filename = url_to_filename(args.url) + ".md"
        out_path = docs_dir / filename

    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(markdown, encoding="utf-8")
    print(f"Saved: {out_path} ({len(markdown)} bytes)", file=sys.stderr)
    print(str(out_path))


if __name__ == "__main__":
    main()
