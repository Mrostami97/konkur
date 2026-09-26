"""Local helper page for working with the ChatGPT chat UI by hand.

For each pending page it shows the page image (drag it into ChatGPT), a
"copy prompt" button (the prompt already contains the exam metadata), and a
box to paste ChatGPT's reply. The reply is checked against the schema and
saved in the same format as the API path. Nothing is sent anywhere by this
program; it only runs on 127.0.0.1.
"""
from __future__ import annotations

import html
import json
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

from .prompt import manual_prompt
from .render import iter_pages
from .results import parse_reply, raw_path, save_result, schema_errors

PAGE = """<!doctype html>
<html lang="fa" dir="rtl"><head><meta charset="utf-8">
<title>استخراج دستی سؤال</title>
<style>
body{{font-family:Vazirmatn,Tahoma,sans-serif;margin:0;background:#f6f6f4;color:#222}}
header{{padding:12px 16px;background:#fff;border-bottom:1px solid #ddd;display:flex;gap:16px;flex-wrap:wrap;align-items:center}}
main{{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:16px;padding:16px}}
@media (max-width:900px){{main{{grid-template-columns:1fr}}}}
img{{width:100%;border:1px solid #ccc;background:#fff}}
textarea{{width:100%;min-height:340px;font-family:monospace;direction:ltr;box-sizing:border-box}}
button{{font:inherit;padding:8px 14px;cursor:pointer}}
.err{{background:#fde8e8;border:1px solid #e0a0a0;padding:8px;white-space:pre-wrap;direction:ltr}}
.ok{{background:#e7f6e7;border:1px solid #9c9;padding:8px}}
code{{direction:ltr;unicode-bidi:embed}}
</style></head><body>
<header>
  <strong>{title}</strong>
  <span>صفحه {page} از {pages}</span>
  <span>باقی‌مانده: {remaining}</span>
  <a href="/?skip={key}">رد کردن این صفحه (فعلاً)</a>
</header>
{message}
<main>
  <section>
    <p>۱) تصویر را داخل چت ChatGPT بکشید (یا راست‌کلیک ← Copy image).</p>
    <img src="/image/{pdf_id}/{page}" alt="page image" draggable="true">
  </section>
  <section>
    <p>۲) متن دستور را کپی و در همان پیام ChatGPT بچسبانید:</p>
    <button onclick="navigator.clipboard.writeText(document.getElementById('prompt').value).then(()=>this.textContent='کپی شد ✓')">کپی دستور</button>
    <textarea id="prompt" readonly style="min-height:90px">{prompt}</textarea>
    <p>۳) پاسخ کامل ChatGPT را اینجا بچسبانید و ذخیره کنید:</p>
    <form method="post" action="/save">
      <input type="hidden" name="pdf_id" value="{pdf_id}">
      <input type="hidden" name="page" value="{page}">
      <textarea name="reply" required>{reply}</textarea>
      <p><button type="submit">ذخیره و صفحه‌ی بعد</button></p>
    </form>
  </section>
</main></body></html>
"""

DONE = """<!doctype html><html lang="fa" dir="rtl"><meta charset="utf-8">
<body style="font-family:Tahoma;padding:24px">همه‌ی صفحه‌ها برای «{producer}» ثبت شده‌اند. حالا دستور <code>merge</code> را اجرا کنید.</body></html>"""


def serve_manual(work: Path, rows: list[dict[str, str]], producer: str, port: int = 8765,
                 pdf_ids: set[str] | None = None) -> None:
    skipped: set[str] = set()
    row_by_id = {r["pdf_id"]: r for r in rows}

    def pending():
        for row, page_no, image in iter_pages(work, rows):
            if pdf_ids and row["pdf_id"] not in pdf_ids:
                continue
            key = f"{row['pdf_id']}:{page_no}"
            if key in skipped or raw_path(work, row["pdf_id"], page_no, producer).exists():
                continue
            yield row, page_no, image

    def context_for(pdf_id: str) -> dict:
        return json.loads((work / "pages" / pdf_id / "meta.json").read_text(encoding="utf-8"))

    class Handler(BaseHTTPRequestHandler):
        def _send(self, body: str | bytes, ctype: str = "text/html; charset=utf-8", status: int = 200):
            data = body.encode("utf-8") if isinstance(body, str) else body
            self.send_response(status)
            self.send_header("Content-Type", ctype)
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)

        def log_message(self, *args):  # keep the terminal quiet
            pass

        def _render(self, message: str = "", reply: str = "", target: tuple[str, int] | None = None):
            items = list(pending())
            if target:
                chosen = next(((r, p, i) for r, p, i in items if (r["pdf_id"], p) == target), None)
            else:
                chosen = items[0] if items else None
            if not chosen:
                return self._send(DONE.format(producer=html.escape(producer)))
            row, page_no, _ = chosen
            total = int(row["pages"]) if row.get("pages", "").isdigit() else None
            ctx = context_for(row["pdf_id"])
            title = " · ".join(v for v in (ctx.get("exam_type"), ctx.get("major"), ctx.get("year"), row["path"]) if v)
            self._send(PAGE.format(
                title=html.escape(title), page=page_no, pages=total or "?", remaining=len(items),
                key=f"{row['pdf_id']}:{page_no}", pdf_id=row["pdf_id"], message=message,
                prompt=html.escape(manual_prompt(ctx, page_no, total)), reply=html.escape(reply),
            ))

        def do_GET(self):
            url = urlparse(self.path)
            if url.path.startswith("/image/"):
                _, _, pdf_id, page = url.path.split("/")
                if pdf_id not in row_by_id or not page.isdigit():
                    return self._send("not found", "text/plain", 404)
                image = work / "pages" / pdf_id / f"p{int(page):03d}.png"
                return self._send(image.read_bytes(), "image/png") if image.exists() else self._send("", "text/plain", 404)
            skip = parse_qs(url.query).get("skip")
            if skip:
                skipped.add(skip[0])
            self._render()

        def do_POST(self):
            length = int(self.headers.get("Content-Length", 0))
            form = parse_qs(self.rfile.read(length).decode("utf-8"))
            pdf_id = form.get("pdf_id", [""])[0]
            page = int(form.get("page", ["0"])[0])
            reply = form.get("reply", [""])[0]
            if pdf_id not in row_by_id:
                return self._send("unknown pdf", "text/plain", 400)
            try:
                result = parse_reply(reply)
                problems = schema_errors(result)
                if problems:
                    raise ValueError("\n".join(problems[:15]))
            except Exception as exc:
                msg = ('<div class="err">پاسخ قابل قبول نیست؛ از ChatGPT بخواهید فقط JSON مطابق schema بدهد.\n\n'
                       + html.escape(str(exc)) + "</div>")
                return self._render(msg, reply, (pdf_id, page))
            save_result(work, context_for(pdf_id), page, producer, result)
            n = len(result.get("questions", []))
            self._render(f'<div class="ok">ذخیره شد: صفحه {page} ({n} سؤال).</div>')

    server = ThreadingHTTPServer(("127.0.0.1", port), Handler)
    print(f"Open http://127.0.0.1:{port} in your browser (Ctrl+C to stop).")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
