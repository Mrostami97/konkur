"""Assemble page results into per-exam question drafts and a review report.

- Joins questions that continue onto the next page.
- Attaches correct options from answer-key pages (same PDF or `key_pdf_id`).
- Crops figures from the original PDF at high resolution.
- When several producers (models / manual ChatGPT) read the same page,
  compares them field by field and flags every disagreement.
- Flags structural problems (not 4 options, gaps, duplicates, missing key,
  low confidence) so review time goes only where it is needed.

Output is a *draft* format, not contracts' question.v1: question.v1 also
requires topic_codes and solution_blocks, which a booklet does not contain.
Those are added later by editors; they are never invented here.
"""
from __future__ import annotations

import csv
import json
import re
from collections import defaultdict
from pathlib import Path

import pymupdf as fitz

from .meta import active_rows, normalize_fa
from .results import page_results

QUESTION_KINDS = {"questions", "questions_and_key", "other", ""}


def _canon(blocks: list[dict]) -> str:
    parts = []
    for b in blocks:
        text = normalize_fa(b.get("content", "")).replace("‌", "")
        text = re.sub(r"\s+", "" if b.get("type") == "latex" else " ", text).strip()
        parts.append(f"{b.get('type')}:{text}")
    return "|".join(parts)


def question_signature(q: dict) -> dict[str, str]:
    sig = {"stem": _canon(q["stem_blocks"])}
    for opt in q["options"]:
        sig[f"option{opt['number']}"] = _canon(opt["blocks"])
    return sig


def _assemble(pdf_id: str, pages: int, producer: str, work: Path):
    """Questions and key entries for one PDF as read by one producer."""
    questions: list[dict] = []
    key: dict[int, int] = {}
    missing_pages: list[int] = []
    for page_no in range(1, pages + 1):
        record = next((r for r in page_results(work, pdf_id, page_no) if r["producer"] == producer), None)
        if record is None:
            missing_pages.append(page_no)
            continue
        result = record["result"]
        for entry in result.get("answer_key", []):
            key[entry["question_number"]] = entry["correct_option"]
        for q in result.get("questions", []):
            figures = [dict(f, page=page_no) for f in q.get("figures", [])]
            if q.get("continues_from_previous_page") and questions:
                prev = questions[-1]
                offset = len(prev["figures"])
                blocks = [_shift_figure(b, offset) for b in q["stem_blocks"]]
                # Text before any option on the new page continues whatever came
                # last: the stem, or the last option if options had started.
                (prev["options"][-1]["blocks"] if prev["options"] else prev["stem_blocks"]).extend(blocks)
                prev["options"].extend({"number": o["number"],
                                        "blocks": [_shift_figure(b, offset) for b in o["blocks"]]}
                                       for o in q["options"])
                prev["figures"].extend(figures)
                prev["pages"].append(page_no)
                prev["uncertain_parts"].extend(q.get("uncertain_parts", []))
                prev["confidence"] = _min_conf(prev["confidence"], q.get("confidence", "low"))
                continue
            questions.append({
                "number": q.get("number"),
                "stem_blocks": list(q["stem_blocks"]),
                "options": [dict(o) for o in q["options"]],
                "figures": figures,
                "pages": [page_no],
                "confidence": q.get("confidence", "low"),
                "uncertain_parts": list(q.get("uncertain_parts", [])),
            })
    return questions, key, missing_pages


def _shift_figure(block: dict, offset: int) -> dict:
    if block.get("type") == "figure" and block.get("content", "").isdigit():
        return {"type": "figure", "content": str(int(block["content"]) + offset)}
    return block


def _min_conf(a: str, b: str) -> str:
    order = ["low", "medium", "high"]
    return order[min(order.index(a) if a in order else 0, order.index(b) if b in order else 0)]


def _merge_options(options: list[dict]) -> list[dict]:
    """Options split across pages arrive as repeated numbers; join them."""
    merged: dict[int, dict] = {}
    for opt in options:
        if opt["number"] in merged:
            merged[opt["number"]]["blocks"].extend(opt["blocks"])
        else:
            merged[opt["number"]] = {"number": opt["number"], "blocks": list(opt["blocks"])}
    return [merged[n] for n in sorted(merged)]


def _crop_figures(question: dict, pdf_path: Path, media_dir: Path, stem: str) -> None:
    if not question["figures"]:
        return
    media_dir.mkdir(parents=True, exist_ok=True)
    with fitz.open(pdf_path) as doc:
        for i, fig in enumerate(question["figures"]):
            bbox = fig.get("bbox", [])
            if len(bbox) != 4:
                fig["media_file"] = None
                continue
            page = doc[fig["page"] - 1]
            w, h = page.rect.width, page.rect.height
            x0, y0, x1, y1 = (max(0, min(1000, v)) for v in bbox)
            pad = 8  # small margin: model boxes are rarely pixel-tight
            clip = fitz.Rect(x0 * w / 1000 - pad, y0 * h / 1000 - pad, x1 * w / 1000 + pad, y1 * h / 1000 + pad) & page.rect
            if clip.is_empty:
                fig["media_file"] = None
                continue
            target = media_dir / f"{stem}-fig{i}.png"
            page.get_pixmap(dpi=300, clip=clip).save(target)
            fig["media_file"] = target.name


def merge_all(work: Path, pdf_root: Path, rows: list[dict[str, str]], primary: str | None = None) -> dict:
    out_dir = work / "out"
    out_dir.mkdir(parents=True, exist_ok=True)
    by_id = {r["pdf_id"]: r for r in rows}
    report_rows: list[dict] = []
    totals = defaultdict(int)
    all_questions = (out_dir / "all_questions.jsonl").open("w", encoding="utf-8")

    for row in active_rows(rows):
        if row.get("doc_kind") not in QUESTION_KINDS:
            continue
        pdf_id = row["pdf_id"]
        pages = int(row["pages"]) if row.get("pages", "").isdigit() else 0
        producer_names = sorted({rec["producer"] for page_no in range(1, pages + 1)
                                 for rec in page_results(work, pdf_id, page_no)})
        if not producer_names:
            continue
        lead = primary if primary in producer_names else producer_names[0]

        readings = {p: _assemble(pdf_id, pages, p, work) for p in producer_names}
        questions, key, missing_pages = readings[lead]

        # Answer key: this PDF (any producer) plus a separate key PDF if linked.
        for _, k, _ in readings.values():
            for n, v in k.items():
                key.setdefault(n, v)
        key_conflicts = {n for _, k, _ in readings.values() for n, v in k.items() if key.get(n) != v}
        linked = row.get("key_pdf_id")
        if linked and linked in by_id:
            kpages = int(by_id[linked]["pages"] or 0)
            for kp in {r["producer"] for p in range(1, kpages + 1) for r in page_results(work, linked, p)}:
                _, k2, _ = _assemble(linked, kpages, kp, work)
                for n, v in k2.items():
                    if n in key and key[n] != v:
                        key_conflicts.add(n)
                    key.setdefault(n, v)

        others = {p: {q["number"]: q for q in readings[p][0] if q["number"] is not None}
                  for p in producer_names if p != lead}
        numbers = [q["number"] for q in questions if q["number"] is not None]
        dupes = {n for n in numbers if numbers.count(n) > 1}
        expected = set(range(min(numbers), max(numbers) + 1)) if numbers else set()
        gaps = sorted(expected - set(numbers))

        drafts = []
        for q in questions:
            q["options"] = _merge_options(q["options"])
            n = q["number"]
            flags: list[str] = []
            if n is None:
                flags.append("no_question_number")
            if n in dupes:
                flags.append("duplicate_number")
            if [o["number"] for o in q["options"]] != [1, 2, 3, 4]:
                flags.append(f"options={[o['number'] for o in q['options']]}")
            if any(not o["blocks"] for o in q["options"]) or not q["stem_blocks"]:
                flags.append("empty_block")
            if q["confidence"] != "high":
                flags.append(f"confidence_{q['confidence']}")
            if q["uncertain_parts"]:
                flags.append("uncertain_parts")
            correct = key.get(n) if n is not None else None
            if correct is None:
                flags.append("no_answer_key")
            elif correct not in (1, 2, 3, 4):
                flags.append(f"key_out_of_range={correct}")
            if n in key_conflicts:
                flags.append("answer_key_conflict")

            agreement = {"producers": producer_names, "agree": [lead], "disagree": {}, "missing": []}
            mine = question_signature(q)
            for p, qs in others.items():
                other = qs.get(n)
                if other is None:
                    agreement["missing"].append(p)
                    continue
                other = dict(other, options=_merge_options(other["options"]))
                theirs = question_signature(other)
                diff = sorted(f for f in set(mine) | set(theirs) if mine.get(f) != theirs.get(f))
                if diff:
                    agreement["disagree"][p] = diff
                else:
                    agreement["agree"].append(p)
            if len(producer_names) == 1:
                flags.append("single_reading")
            if agreement["disagree"]:
                flags.append("producers_disagree:" + ",".join(sorted({f for d in agreement["disagree"].values() for f in d})))
            if agreement["missing"]:
                flags.append("missing_in:" + ",".join(agreement["missing"]))

            stem = f"{pdf_id}-q{n if n is not None else 'x' + str(len(drafts))}"
            _crop_figures(q, pdf_root / row["path"], out_dir / "media" / pdf_id, stem)
            draft = {
                "external_id": stem,
                "exam": {k: row.get(k, "") for k in ("degree", "exam_type", "major", "year", "booklet", "publisher")},
                "number": n,
                "stem_blocks": q["stem_blocks"],
                "options": q["options"],
                "correct_option": correct,
                "figures": q["figures"],
                "source": {"pdf_path": row["path"], "sha256": row["sha256"], "pages": q["pages"]},
                "confidence": q["confidence"],
                "uncertain_parts": q["uncertain_parts"],
                "agreement": agreement,
                "flags": flags,
                "provenance": {"producer_type": "external_ai", "producer_name": lead,
                               "source_artifact": f"{row['path']}#sha256:{row['sha256']}"},
            }
            drafts.append(draft)
            all_questions.write(json.dumps(draft, ensure_ascii=False) + "\n")
            report_rows.append({
                "external_id": stem, "pdf": row["path"], "number": n, "pages": " ".join(map(str, q["pages"])),
                "correct_option": correct if correct is not None else "",
                "readings": len(producer_names),
                "needs_review": "yes" if any(f != "single_reading" for f in flags) else "no",
                "flags": " ; ".join(flags),
            })
            totals["questions"] += 1
            totals["needs_review"] += report_rows[-1]["needs_review"] == "yes"

        (out_dir / f"{pdf_id}.json").write_text(json.dumps({
            "context": {k: row.get(k, "") for k in ("pdf_id", "path", "sha256", "doc_kind", "degree", "exam_type",
                                                   "major", "year", "booklet", "publisher")},
            "producers": producer_names, "primary": lead,
            "missing_pages": {p: readings[p][2] for p in producer_names if readings[p][2]},
            "number_gaps": gaps, "duplicate_numbers": sorted(dupes),
            "questions": drafts,
        }, ensure_ascii=False, indent=2), encoding="utf-8")
        totals["pdfs"] += 1

    all_questions.close()
    with (out_dir / "report.csv").open("w", encoding="utf-8-sig", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=["external_id", "pdf", "number", "pages", "correct_option", "readings", "needs_review", "flags"])
        writer.writeheader()
        writer.writerows(report_rows)
    return dict(totals)
