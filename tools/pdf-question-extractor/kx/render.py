"""Render every page of every active PDF to a PNG, next to its metadata."""
from __future__ import annotations

import json
from pathlib import Path

import pymupdf as fitz

from .meta import active_rows, exam_context


def page_image_path(work: Path, pdf_id: str, page_no: int) -> Path:
    return work / "pages" / pdf_id / f"p{page_no:03d}.png"


def render_all(work: Path, pdf_root: Path, rows: list[dict[str, str]], dpi: int = 300) -> int:
    rendered = 0
    for row in active_rows(rows):
        out_dir = work / "pages" / row["pdf_id"]
        out_dir.mkdir(parents=True, exist_ok=True)
        (out_dir / "meta.json").write_text(
            json.dumps(exam_context(row), ensure_ascii=False, indent=2), encoding="utf-8"
        )
        with fitz.open(pdf_root / row["path"]) as doc:
            for index, page in enumerate(doc, start=1):
                target = page_image_path(work, row["pdf_id"], index)
                if target.exists():  # resumable: never redo finished pages
                    continue
                page.get_pixmap(dpi=dpi).save(target)
                rendered += 1
    return rendered


def iter_pages(work: Path, rows: list[dict[str, str]]):
    """Yield (row, page_no, image_path) for every rendered page, in order."""
    for row in active_rows(rows):
        page_dir = work / "pages" / row["pdf_id"]
        for image in sorted(page_dir.glob("p*.png")):
            yield row, int(image.stem[1:]), image
