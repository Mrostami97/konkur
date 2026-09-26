"""Command line: python -m kx <command> ... (see README.md)."""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from .meta import active_rows, build_inventory, read_manifest


def _config(work: Path) -> dict:
    path = work / "config.json"
    if not path.exists():
        sys.exit(f"{path} not found; run `inventory` first.")
    return json.loads(path.read_text(encoding="utf-8"))


def _rows(work: Path) -> list[dict[str, str]]:
    return read_manifest(work / "manifest.csv")


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(prog="kx", description="Konkur PDF question extractor")
    parser.add_argument("--work", type=Path, default=Path("work"), help="working folder (default: ./work)")
    sub = parser.add_subparsers(dest="command", required=True)

    p = sub.add_parser("inventory", help="scan PDFs, detect duplicates, write work/manifest.csv")
    p.add_argument("pdf_root", type=Path)

    p = sub.add_parser("render", help="render every page of every active PDF to PNG")
    p.add_argument("--dpi", type=int, default=300)

    p = sub.add_parser("api", help="extract pages automatically through the OpenAI API")
    p.add_argument("--model", required=True, help="OpenAI model name with vision support")
    p.add_argument("--limit", type=int, help="stop after this many new pages (for a pilot run)")
    p.add_argument("--pdf", action="append", help="only these pdf_id values (repeatable)")

    p = sub.add_parser("manual", help="local helper page for using the ChatGPT chat UI by hand")
    p.add_argument("--producer", default="chatgpt-ui", help="label stored with the results")
    p.add_argument("--port", type=int, default=8765)
    p.add_argument("--pdf", action="append", help="only these pdf_id values (repeatable)")

    p = sub.add_parser("merge", help="build question drafts, compare readings, write work/out/report.csv")
    p.add_argument("--primary", help="producer whose reading is used as the main text")

    args = parser.parse_args(argv)
    work: Path = args.work

    if args.command == "inventory":
        root = args.pdf_root.resolve()
        work.mkdir(parents=True, exist_ok=True)
        (work / "config.json").write_text(json.dumps({"pdf_root": str(root)}, ensure_ascii=False), encoding="utf-8")
        rows = build_inventory(root, work / "manifest.csv")
        dupes = sum(1 for r in rows if r["duplicate_of"])
        scanned = sum(1 for r in rows if r.get("has_text_layer") == "no")
        pages = sum(int(r["pages"]) for r in active_rows(rows) if r.get("pages", "").isdigit())
        print(f"{len(rows)} PDFs, {dupes} exact duplicates, {scanned} probably scanned, "
              f"{pages} pages in unique files.")
        print(f"Now check and complete {work / 'manifest.csv'} (exam_type, major, year, doc_kind, ...).")
    elif args.command == "render":
        from .render import render_all
        n = render_all(work, Path(_config(work)["pdf_root"]), _rows(work), args.dpi)
        print(f"rendered {n} new pages into {work / 'pages'}")
    elif args.command == "api":
        from .api_openai import extract_with_openai
        n = extract_with_openai(work, _rows(work), args.model, args.limit, pdf_ids=set(args.pdf or []) or None)
        print(f"extracted {n} new pages")
    elif args.command == "manual":
        from .manual import serve_manual
        serve_manual(work, _rows(work), args.producer, args.port, set(args.pdf or []) or None)
    elif args.command == "merge":
        from .merge import merge_all
        totals = merge_all(work, Path(_config(work)["pdf_root"]), _rows(work), args.primary)
        print(f"{totals.get('pdfs', 0)} PDFs, {totals.get('questions', 0)} questions, "
              f"{totals.get('needs_review', 0)} need review -> {work / 'out' / 'report.csv'}")


if __name__ == "__main__":
    main()
