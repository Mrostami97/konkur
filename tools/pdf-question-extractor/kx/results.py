"""Storing, parsing and shape-checking page results from any producer."""
from __future__ import annotations

import json
import re
from datetime import datetime, timezone
from pathlib import Path

from .prompt import PAGE_SCHEMA


def producer_slug(producer: str) -> str:
    return re.sub(r"[^A-Za-z0-9._-]+", "-", producer).strip("-") or "unknown"


def raw_path(work: Path, pdf_id: str, page_no: int, producer: str) -> Path:
    return work / "raw" / pdf_id / f"p{page_no:03d}__{producer_slug(producer)}.json"


def page_results(work: Path, pdf_id: str, page_no: int) -> list[dict]:
    """All stored results for one page (one per producer/model)."""
    folder = work / "raw" / pdf_id
    return [json.loads(p.read_text(encoding="utf-8")) for p in sorted(folder.glob(f"p{page_no:03d}__*.json"))]


def save_result(work: Path, context: dict, page_no: int, producer: str, result: dict, usage: dict | None = None) -> Path:
    target = raw_path(work, context["pdf_id"], page_no, producer)
    target.parent.mkdir(parents=True, exist_ok=True)
    record = {
        "producer": producer,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "context": context,
        "page": page_no,
        "usage": usage or {},
        "result": result,
    }
    target.write_text(json.dumps(record, ensure_ascii=False, indent=2), encoding="utf-8")
    return target


def parse_reply(text: str) -> dict:
    """Extract the JSON object from a model reply (with or without ``` fences)."""
    fenced = re.search(r"```(?:json)?\s*(\{.*\})\s*```", text, re.S)
    candidate = fenced.group(1) if fenced else text[text.find("{"): text.rfind("}") + 1]
    if not candidate:
        raise ValueError("no JSON object found in the reply")
    return json.loads(candidate)


_TYPES = {
    "object": dict, "array": list, "string": str,
    "integer": int, "boolean": bool, "null": type(None),
}


def schema_errors(value, schema: dict = PAGE_SCHEMA, path: str = "$") -> list[str]:
    """Minimal validator for the subset of JSON Schema used in PAGE_SCHEMA."""
    errors: list[str] = []
    allowed = schema.get("type")
    if allowed:
        names = allowed if isinstance(allowed, list) else [allowed]
        ok = any(
            isinstance(value, _TYPES[n]) and not (n == "integer" and isinstance(value, bool))
            for n in names
        )
        if not ok:
            return [f"{path}: expected {'/'.join(names)}"]
    if "enum" in schema and value not in schema["enum"]:
        errors.append(f"{path}: {value!r} not in {schema['enum']}")
    if isinstance(value, dict):
        props = schema.get("properties", {})
        for key in schema.get("required", []):
            if key not in value:
                errors.append(f"{path}.{key}: missing")
        if schema.get("additionalProperties") is False:
            errors += [f"{path}.{k}: unexpected field" for k in value if k not in props]
        for key, sub in props.items():
            if key in value:
                errors += schema_errors(value[key], sub, f"{path}.{key}")
    if isinstance(value, list) and "items" in schema:
        for i, item in enumerate(value):
            errors += schema_errors(item, schema["items"], f"{path}[{i}]")
    return errors
