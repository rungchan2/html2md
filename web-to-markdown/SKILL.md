---
name: web-to-markdown
description: Fetch web pages and save them as clean Markdown files into a docs/ directory. Use when the user provides a URL and wants its content saved as a local .md file for reference — especially documentation pages, API references, blog posts, or technical guides. Triggers on requests like "save this page as markdown", "fetch this docs page", "grab this URL into docs/", or when given a URL with intent to capture its content locally. Supports Cloudflare Markdown for Agents (Accept text/markdown) for higher quality output on supported sites, with automatic HTML-to-Markdown fallback for all other sites. Configurable via CLOUDFLARE_API_KEY environment variable for authenticated Cloudflare access.
---

# Web to Markdown

Fetch a URL and save its content as a clean `.md` file in the project's `docs/` directory.

## Quick Start

Run the bundled script:

```bash
python3 <skill-path>/scripts/fetch_markdown.py <url> [--output <path>]
```

The script automatically:
1. Tries `Accept: text/markdown` header (Cloudflare Markdown for Agents)
2. Falls back to HTML fetch + conversion if markdown not available
3. Saves to `docs/<url-derived-name>.md` by default

## Options

| Flag | Description | Default |
|------|-------------|---------|
| `--output`, `-o` | Custom output path | `docs/<name>.md` |
| `--api-key` | Cloudflare API key | `$CLOUDFLARE_API_KEY` env |
| `--zone-id` | Cloudflare Zone ID | `$CLOUDFLARE_ZONE_ID` env |

## Usage Patterns

### Single page
```bash
python3 <skill-path>/scripts/fetch_markdown.py "https://react.dev/reference/react/useState"
# → docs/reference_react_useState.md
```

### Custom output path
```bash
python3 <skill-path>/scripts/fetch_markdown.py "https://docs.example.com/api" --output docs/api/example-api.md
```

### Multiple pages (run sequentially)
```bash
python3 <skill-path>/scripts/fetch_markdown.py "https://docs.example.com/getting-started" --output docs/getting-started.md
python3 <skill-path>/scripts/fetch_markdown.py "https://docs.example.com/api-reference" --output docs/api-reference.md
```

### With Cloudflare API key
```bash
export CLOUDFLARE_API_KEY="your-key"
python3 <skill-path>/scripts/fetch_markdown.py "https://example.com/docs"
```

## Conversion Strategy

1. **Cloudflare sites**: If the site has Markdown for Agents enabled, the server returns clean markdown directly — no client-side parsing needed. This produces the highest quality output.
2. **All other sites**: HTML is fetched and converted locally. The script extracts `<main>`, `<article>`, or `<body>` content, strips nav/footer/scripts, and converts to markdown. Quality is good for documentation sites but may include some noise for complex layouts.

## Output Format

Each saved file includes source metadata:

```markdown
<!-- Source: https://example.com/docs/page -->
<!-- Fetched: 2026-02-17 14:30 -->

# Page Title
...content...
```

## Notes

- No external Python dependencies required (uses only stdlib)
- Cloudflare API key is optional — the `Accept: text/markdown` header works without authentication on many Cloudflare-proxied sites that have enabled the feature
- For JavaScript-heavy SPAs that render client-side, the HTML fallback may capture minimal content. Consider using a browser-based approach for those sites.

## Resources

### scripts/
- `fetch_markdown.py` — Main fetch and conversion script. Zero dependencies, runs with Python 3.10+.
