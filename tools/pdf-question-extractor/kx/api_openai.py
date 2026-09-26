"""Automatic extraction through the OpenAI API (needs OPENAI_API_KEY).

This is the supported way to send thousands of pages to OpenAI models.
Automating the ChatGPT website instead is against OpenAI's terms and gets
accounts blocked, so the chat-UI path is the manual helper in manual.py.
"""
from __future__ import annotations

import base64
import json
import sys
import time
from pathlib import Path

from .prompt import PAGE_SCHEMA, page_prompt
from .render import iter_pages
from .results import raw_path, save_result, schema_errors


def extract_with_openai(
    work: Path,
    rows: list[dict[str, str]],
    model: str,
    limit: int | None = None,
    detail: str = "high",
    pdf_ids: set[str] | None = None,
) -> int:
    from openai import OpenAI  # imported here so other commands work without the package

    client = OpenAI()
    producer = f"openai:{model}"
    done = 0
    for row, page_no, image in iter_pages(work, rows):
        if pdf_ids and row["pdf_id"] not in pdf_ids:
            continue
        if raw_path(work, row["pdf_id"], page_no, producer).exists():
            continue  # resumable
        if limit is not None and done >= limit:
            break

        context = json.loads((image.parent / "meta.json").read_text(encoding="utf-8"))
        total = int(row["pages"]) if row.get("pages", "").isdigit() else None
        data_url = "data:image/png;base64," + base64.b64encode(image.read_bytes()).decode()

        for attempt in range(4):
            try:
                response = client.responses.create(
                    model=model,
                    input=[{
                        "role": "user",
                        "content": [
                            {"type": "input_text", "text": page_prompt(context, page_no, total)},
                            {"type": "input_image", "image_url": data_url, "detail": detail},
                        ],
                    }],
                    text={"format": {
                        "type": "json_schema",
                        "name": "konkur_page",
                        "schema": PAGE_SCHEMA,
                        "strict": True,
                    }},
                )
                result = json.loads(response.output_text)
                problems = schema_errors(result)
                if problems:
                    raise ValueError("; ".join(problems[:5]))
                break
            except Exception as exc:
                wait = 2 ** (attempt + 1)
                print(f"  {row['pdf_id']} p{page_no}: {exc} (retry in {wait}s)", file=sys.stderr)
                time.sleep(wait)
        else:
            print(f"  {row['pdf_id']} p{page_no}: gave up", file=sys.stderr)
            continue

        usage = response.usage.model_dump() if getattr(response, "usage", None) else None
        save_result(work, context, page_no, producer, result, usage)
        done += 1
        print(f"  {row['pdf_id']} p{page_no}: {len(result['questions'])} questions")
    return done
