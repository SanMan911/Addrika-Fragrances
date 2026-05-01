"""Sacred Mappls setup cheat-sheet — readable in one tap until Mappls is live."""
import os
from fastapi import APIRouter, HTTPException
from fastapi.responses import HTMLResponse, PlainTextResponse

router = APIRouter(tags=["Docs"])

_DOC_PATH = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(__file__))),
    "MAPPLS_SETUP.md",
)


def _load() -> str:
    if not os.path.exists(_DOC_PATH):
        raise HTTPException(status_code=404, detail="MAPPLS_SETUP.md not found")
    with open(_DOC_PATH, "r", encoding="utf-8") as f:
        return f.read()


@router.get("/docs/mappls-setup", response_class=HTMLResponse)
async def mappls_setup_html():
    """Render the cheat-sheet as a styled HTML page for one-tap reference."""
    md = _load()
    # Tiny, dependency-free Markdown → HTML for the bits we use.
    import re
    html = md
    html = html.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
    # Headings
    html = re.sub(r"^### (.+)$", r"<h3>\1</h3>", html, flags=re.M)
    html = re.sub(r"^## (.+)$", r"<h2>\1</h2>", html, flags=re.M)
    html = re.sub(r"^# (.+)$", r"<h1>\1</h1>", html, flags=re.M)
    # Bold / inline-code / italic
    html = re.sub(r"\*\*([^*]+)\*\*", r"<strong>\1</strong>", html)
    html = re.sub(r"`([^`]+)`", r"<code>\1</code>", html)
    html = re.sub(r"\*([^*]+)\*", r"<em>\1</em>", html)
    # Links [text](url)
    html = re.sub(r"\[([^\]]+)\]\(([^)]+)\)",
                  r'<a href="\2" target="_blank" rel="noopener">\1</a>', html)
    # Auto-links <https://...>
    html = re.sub(r"&lt;(https?://[^&]+)&gt;",
                  r'<a href="\1" target="_blank" rel="noopener">\1</a>', html)
    # Blockquote
    html = re.sub(r"^&gt; (.+)$", r"<blockquote>\1</blockquote>", html, flags=re.M)
    # Horizontal rule
    html = html.replace("\n---\n", "\n<hr/>\n")
    # Lists (very lightweight)
    html = re.sub(r"^([0-9]+)\. (.+)$", r"<li>\2</li>", html, flags=re.M)
    html = re.sub(r"^- (.+)$", r"<li>\1</li>", html, flags=re.M)
    # Wrap consecutive <li> blocks in <ul>
    html = re.sub(r"(<li>.*?</li>)(\n(?!<li>))",
                  r"<ul>\1</ul>\2", html, flags=re.S)
    # Fenced code blocks
    html = re.sub(r"```bash\n(.*?)```", r"<pre><code>\1</code></pre>", html, flags=re.S)
    html = re.sub(r"```\n(.*?)```", r"<pre><code>\1</code></pre>", html, flags=re.S)
    # Tables — keep the original markdown line breaks readable inside <pre>
    # (we don't bother building real <table> for brevity).
    # Paragraphs: turn double newlines into <p>
    html = re.sub(r"\n{2,}", "\n\n", html)

    page = f"""<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>Mappls Setup — Sacred Cheat-Sheet</title>
  <style>
    body {{ font-family: -apple-system, Segoe UI, Roboto, sans-serif;
           background:#0f1419; color:#e8e6e3; margin:0;
           padding: 32px 20px; line-height:1.6; }}
    .wrap {{ max-width:780px; margin:0 auto; }}
    h1 {{ color:#D4AF37; font-size:28px; margin-top:0; }}
    h2 {{ color:#D4AF37; margin-top:32px; padding-top:16px;
          border-top:1px solid rgba(212,175,55,0.2); }}
    h3 {{ color:#f0c849; margin-top:24px; }}
    a {{ color:#D4AF37; }}
    code {{ background:rgba(212,175,55,0.12); color:#f0c849;
            padding:2px 6px; border-radius:4px; font-size:0.92em; }}
    pre {{ background:#1a2332; padding:14px 16px; border-radius:8px;
           overflow-x:auto; border:1px solid rgba(212,175,55,0.2); }}
    pre code {{ background:transparent; color:#e8e6e3; padding:0; }}
    blockquote {{ border-left:3px solid #D4AF37; padding:8px 16px;
                  color:#cfc7b3; background:rgba(212,175,55,0.06);
                  margin:16px 0; border-radius:0 6px 6px 0; }}
    li {{ margin:6px 0; }}
    hr {{ border:none; border-top:1px solid rgba(212,175,55,0.2);
          margin:32px 0; }}
    .badge {{ display:inline-block; background:#D4AF37; color:#1a1a2e;
              padding:4px 10px; border-radius:20px; font-size:11px;
              font-weight:700; letter-spacing:1px; }}
    .actions {{ position:sticky; top:0; background:rgba(15,20,25,0.96);
                padding:12px 0 18px; border-bottom:1px solid rgba(212,175,55,0.15);
                margin-bottom:24px; backdrop-filter:blur(6px); }}
    .actions a {{ display:inline-block; padding:6px 12px;
                  border:1px solid rgba(212,175,55,0.3); border-radius:6px;
                  text-decoration:none; margin-right:8px; font-size:13px; }}
  </style>
</head>
<body>
  <div class="wrap">
    <div class="actions">
      <span class="badge">SACRED · KEEP UNTIL MAPPLS IS LIVE</span>
      <div style="margin-top:10px;">
        <a href="/api/docs/mappls-setup.txt">Plain text</a>
        <a href="https://apis.mappls.com" target="_blank" rel="noopener">Open Mappls Console ↗</a>
        <a href="https://vercel.com/dashboard" target="_blank" rel="noopener">Vercel ↗</a>
        <a href="https://dashboard.render.com" target="_blank" rel="noopener">Render ↗</a>
      </div>
    </div>
    {html}
  </div>
</body>
</html>"""
    return HTMLResponse(content=page)


@router.get("/docs/mappls-setup.txt", response_class=PlainTextResponse)
async def mappls_setup_txt():
    """Plain-text version (for copy-paste into Notes / WhatsApp / email)."""
    return PlainTextResponse(content=_load())
