"""Inventory of the PDF collection and per-PDF exam metadata.

The manifest (work/manifest.csv) is the single place where exam metadata
lives. `inventory` fills it with guesses from folder/file names; the owner
corrects it by hand (Excel/LibreOffice) before rendering and extraction.
Every later step reads metadata from the manifest, so each page and each
question carries the exam it came from.
"""
from __future__ import annotations

import csv
import hashlib
import re
from pathlib import Path

import pymupdf as fitz

MANIFEST_FIELDS = [
    "pdf_id",          # stable id: first 12 hex chars of the sha256
    "path",            # path relative to the PDF root
    "sha256",
    "pages",
    "has_text_layer",  # "yes" = born-digital PDF, "no" = probably scanned
    "duplicate_of",    # pdf_id of an identical file (same bytes); skipped later
    "doc_kind",        # questions | answer_key | questions_and_key | solutions | other
    "degree",          # master | phd | other
    "exam_type",       # e.g. سراسری / آزاد / آزمایشی
    "major",           # e.g. مهندسی کامپیوتر
    "year",            # Persian year, e.g. 1402
    "booklet",         # booklet / group code if the exam has several
    "publisher",       # sanjesh / name of the institute / unknown
    "key_pdf_id",      # for a questions PDF whose key is in another file
    "skip",            # "yes" to leave this file out
    "notes",
]

_FA_DIGITS = str.maketrans("۰۱۲۳۴۵۶۷۸۹٠١٢٣٤٥٦٧٨٩", "01234567890123456789")


def normalize_fa(text: str) -> str:
    """Canonical Persian: Arabic ي/ك → ی/ک, Persian/Arabic digits → ASCII."""
    return text.replace("ي", "ی").replace("ك", "ک").translate(_FA_DIGITS)


def _sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def guess_from_name(rel_path: str) -> dict[str, str]:
    """Best-effort guesses from folder and file names. Always reviewed by a human."""
    name = normalize_fa(rel_path).lower()
    guess: dict[str, str] = {}

    year = re.search(r"(?<!\d)(13[5-9]\d|14[0-2]\d)(?!\d)", name)
    if year:
        guess["year"] = year.group(1)

    if re.search(r"دکتر|phd|doctor", name):
        guess["degree"] = "phd"
    elif re.search(r"ارشد|master|msc|arshad", name):
        guess["degree"] = "master"

    if re.search(r"کلید|پاسخنامه|پاسخ‌نامه|answer|key", name):
        guess["doc_kind"] = "answer_key"
    elif re.search(r"تشریحی|solution|pasokh", name):
        guess["doc_kind"] = "solutions"
    else:
        guess["doc_kind"] = "questions"

    if re.search(r"سراسری|sarasari", name):
        guess["exam_type"] = "سراسری"
    elif re.search(r"آزاد|azad", name):
        guess["exam_type"] = "آزاد"
    elif re.search(r"آزمایشی|azmayeshi|mock", name):
        guess["exam_type"] = "آزمایشی"

    if re.search(r"سنجش|sanjesh", name):
        guess["publisher"] = "sanjesh"

    if re.search(r"کامپیوتر|computer|comp", name):
        guess["major"] = "مهندسی کامپیوتر"
    elif re.search(r"فناوری اطلاعات|\bit\b", name):
        guess["major"] = "مهندسی فناوری اطلاعات"

    return guess


def _has_text_layer(doc: fitz.Document) -> bool:
    sample = min(3, doc.page_count)
    chars = sum(len(doc[i].get_text().strip()) for i in range(sample))
    return chars > 100 * sample


def build_inventory(pdf_root: Path, manifest_path: Path) -> list[dict[str, str]]:
    """Scan pdf_root recursively. Rows already in the manifest keep their
    hand-edited metadata; only new files get guessed values."""
    old_rows = read_manifest(manifest_path) if manifest_path.exists() else []
    by_path = {row["path"]: row for row in old_rows}
    # The copy that was canonical last time stays canonical, so edits made
    # on it are never moved onto a duplicate row.
    canonical_by_sha = {row["sha256"]: row for row in old_rows if not row.get("duplicate_of")}

    files: list[tuple[str, str, Path]] = []
    for pdf in sorted(pdf_root.rglob("*")):
        if pdf.is_file() and pdf.suffix.lower() == ".pdf":
            files.append((pdf.relative_to(pdf_root).as_posix(), _sha256(pdf), pdf))

    canonical_path: dict[str, str] = {}
    for rel, digest, _ in files:
        previous = canonical_by_sha.get(digest)
        if previous and previous["path"] == rel:
            canonical_path[digest] = rel
    for rel, digest, _ in files:
        canonical_path.setdefault(digest, rel)

    rows: list[dict[str, str]] = []
    for rel, digest, pdf in files:
        old = by_path.get(rel)
        if old and old["sha256"] == digest:
            row = dict(old)
        elif digest in canonical_by_sha and canonical_path[digest] == rel:
            row = dict(canonical_by_sha[digest], path=rel)  # file was moved/renamed
        else:
            row = {field: "" for field in MANIFEST_FIELDS}
            row.update(pdf_id=digest[:12], path=rel, sha256=digest)
            try:
                with fitz.open(pdf) as doc:
                    row["pages"] = str(doc.page_count)
                    row["has_text_layer"] = "yes" if _has_text_layer(doc) else "no"
            except Exception as exc:  # corrupt or encrypted file
                row["skip"] = "yes"
                row["notes"] = f"cannot open: {exc}"
            row.update(guess_from_name(rel))
        row["duplicate_of"] = "" if canonical_path[digest] == rel else digest[:12]
        rows.append(row)

    write_manifest(manifest_path, rows)
    return rows


def read_manifest(path: Path) -> list[dict[str, str]]:
    # utf-8-sig: Excel saves CSV with a BOM.
    with path.open(encoding="utf-8-sig", newline="") as f:
        return [{k: (v or "").strip() for k, v in row.items()} for row in csv.DictReader(f)]


def write_manifest(path: Path, rows: list[dict[str, str]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    # utf-8-sig so Excel shows Persian correctly when the file is opened directly.
    with path.open("w", encoding="utf-8-sig", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=MANIFEST_FIELDS, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(rows)


def active_rows(rows: list[dict[str, str]]) -> list[dict[str, str]]:
    return [r for r in rows if r.get("skip") != "yes" and not r.get("duplicate_of")]


def exam_context(row: dict[str, str]) -> dict[str, str]:
    """The metadata attached to every page and question of this PDF."""
    keys = ["pdf_id", "path", "sha256", "doc_kind", "degree", "exam_type", "major", "year", "booklet", "publisher"]
    return {k: row.get(k, "") for k in keys}
