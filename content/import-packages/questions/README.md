# Past-exam question import (question.v2)

`build.mjs` turns the owner's local bank (`outputs/question_bank/active_questions.jsonl`
in the OCR/review workspace) into one import zip per exam year:

    node build.mjs <bank-root> <out-dir> [year ...]

- Only subjects the site has (and the 1406 exam keeps) are packed; the rest
  stay in the archive. `report.json` lists what was left out and why.
- Text is marked checked when it was compared with the original page; a key
  only when it was checked by eye. Anything unchecked imports as DRAFT and
  waits in the admin review queue, out of students' sight.
- External ids come from exam code, year, booklet and number, so rebuilding
  after the bank changes revises the same questions on re-import.
- Images (figures and the crop of the original booklet) are resized to at most
  1100 px wide to stay well inside the importer's 50 MB / 1000-entry limits.

The zips are not committed: they hold the booklet images. Upload each at
`/admin/import`, approve and publish.
