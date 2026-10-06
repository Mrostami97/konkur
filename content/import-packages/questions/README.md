# Past-exam question import (question.v2)

`build.mjs` turns the owner's local bank (`outputs/unified_question_bank/active_questions.jsonl`
in the OCR/review workspace) into one import zip per exam and year, plus a few
first-import bundles:

    node build.mjs <bank-root> <out-dir> [year ...]

- Both master's banks: computer engineering (code 1277, `exam_track` "ce") and
  IT (code 1276, "it"). The two were built separately and name a few fields
  differently (stem, crop, key, booklet); each record is read into one shape.
- Only subjects in the 1406 master's exam of either track are packed (IT
  management, software engineering, circuits, signals, ... stay in the
  archive). `report.json` lists what was left out and why.
- Text is marked checked when it was compared with the original page; a key
  only when it was checked against its source. Anything unchecked imports as
  DRAFT and waits in the admin review queue, out of students' sight. Answers
  taken from an initial key carry the note «کلید اولیه».
- External ids come from exam code, year, booklet and number, so rebuilding
  after the bank changes revises the same questions on re-import. The 1389
  computer-engineering exam had two sessions numbered from 1; the second
  session's ids carry its source document.
- Images (figures and the crop of the original booklet) are resized to at most
  1100 px wide. Bundles stay under 25 MB and 1000 entries: the import page
  sends a file in one request, and the CDN has cut single uploads much past 40 MB.

The zips are not committed: they hold the booklet images. Upload each bundle at
`/admin/import`, approve and publish; then «ساخت شبیه‌ساز همهٔ سال‌ها» in
«آزمون‌ها» builds every year's simulator, unpublished.
