"""The transcription instructions and the JSON shape every page result must have.

The same prompt and schema are used for the API path and the manual ChatGPT
path, so results from both are interchangeable and comparable.
"""
from __future__ import annotations

import json

BLOCK = {
    "type": "object",
    "additionalProperties": False,
    "required": ["type", "content"],
    "properties": {
        # text: Persian/English prose. latex: one formula, without $ delimiters.
        # table: the table as GitHub markdown. figure: index into `figures`.
        "type": {"type": "string", "enum": ["text", "latex", "table", "figure"]},
        "content": {"type": "string"},
    },
}

PAGE_SCHEMA = {
    "type": "object",
    "additionalProperties": False,
    "required": ["page_kind", "questions", "answer_key", "page_notes"],
    "properties": {
        "page_kind": {
            "type": "string",
            "enum": ["questions", "answer_key", "solutions", "cover", "instructions", "blank", "other"],
        },
        "questions": {
            "type": "array",
            "items": {
                "type": "object",
                "additionalProperties": False,
                "required": [
                    "number", "continues_from_previous_page", "stem_blocks",
                    "options", "figures", "confidence", "uncertain_parts",
                ],
                "properties": {
                    "number": {"type": ["integer", "null"]},
                    "continues_from_previous_page": {"type": "boolean"},
                    "stem_blocks": {"type": "array", "items": BLOCK},
                    "options": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "additionalProperties": False,
                            "required": ["number", "blocks"],
                            "properties": {
                                "number": {"type": "integer"},
                                "blocks": {"type": "array", "items": BLOCK},
                            },
                        },
                    },
                    "figures": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "additionalProperties": False,
                            "required": ["bbox", "description"],
                            "properties": {
                                # [x0, y0, x1, y1] on a 0..1000 grid over the page image.
                                "bbox": {"type": "array", "items": {"type": "integer"}},
                                "description": {"type": "string"},
                            },
                        },
                    },
                    "confidence": {"type": "string", "enum": ["high", "medium", "low"]},
                    "uncertain_parts": {"type": "array", "items": {"type": "string"}},
                },
            },
        },
        "answer_key": {
            "type": "array",
            "items": {
                "type": "object",
                "additionalProperties": False,
                "required": ["question_number", "correct_option"],
                "properties": {
                    "question_number": {"type": "integer"},
                    "correct_option": {"type": "integer"},
                },
            },
        },
        "page_notes": {"type": "string"},
    },
}

INSTRUCTIONS = """\
You are transcribing one page image of an Iranian university entrance exam (Konkur) booklet.
Your only job is exact transcription into the JSON schema. Do not solve, explain, summarize, translate, or correct anything.

Rules:
1. Copy text exactly as printed, character for character, including the original wording, punctuation and numbering. Keep Persian in Persian script and use ی and ک (not ي / ك). Keep English/code exactly as printed.
2. Every mathematical expression, symbol, subscript, superscript, fraction, matrix, set, or formula goes in a separate block of type "latex", written as plain LaTeX without $ delimiters. Keep surrounding Persian words in "text" blocks, in reading order.
3. Code snippets and pseudo-code: a "text" block that keeps the original line breaks and indentation.
4. Tables: a "table" block containing the table as GitHub markdown.
5. Diagrams, graphs, circuits, trees, automata, or any picture: add an entry to "figures" with its bounding box as [x0, y0, x1, y1] on a 0..1000 grid over the whole page image (0,0 = top-left), and put a "figure" block whose content is the figure's index (as a string) at the place it appears. Do not try to redraw the figure in text.
6. Options: the four choices are numbered 1 to 4 (the booklet prints them as ۱) ۲) ۳) ۴) or similar). Put each choice's content in "options" with its number. Do not include the option label itself in the content.
7. If the first question at the top of the page is the continuation of a question from the previous page, set "continues_from_previous_page": true and its "number" to null; include only the part printed on this page.
8. Answer-key tables (کلید / پاسخنامه): fill "answer_key" with every question number and its correct option, and set page_kind to "answer_key".
9. If any character, digit, sign or word is unclear, write your best reading, add a short description of the doubt to "uncertain_parts", and lower "confidence". Never silently guess. Never invent missing text.
10. Pages without questions (cover, instructions, blank) get an empty "questions" array and the matching page_kind.

Return only the JSON object.
"""


def page_prompt(context: dict[str, str], page_no: int, total_pages: int | None = None) -> str:
    """The instructions plus the known facts about the source PDF."""
    facts = {
        "exam_type": context.get("exam_type", ""),
        "degree": context.get("degree", ""),
        "major": context.get("major", ""),
        "year": context.get("year", ""),
        "booklet": context.get("booklet", ""),
        "document_kind": context.get("doc_kind", ""),
        "page": page_no,
    }
    if total_pages:
        facts["total_pages"] = total_pages
    facts = {k: v for k, v in facts.items() if v not in ("", None)}
    return (
        INSTRUCTIONS
        + "\nKnown facts about this booklet (context only; do not copy them into the output):\n"
        + json.dumps(facts, ensure_ascii=False)
        + "\n"
    )


def manual_prompt(context: dict[str, str], page_no: int, total_pages: int | None = None) -> str:
    """For the ChatGPT chat UI, which cannot enforce a schema: include it inline."""
    return (
        page_prompt(context, page_no, total_pages)
        + "\nThe JSON must match this JSON Schema exactly. Reply with the JSON only, in a single ```json code block.\n"
        + json.dumps(PAGE_SCHEMA, ensure_ascii=False)
    )
