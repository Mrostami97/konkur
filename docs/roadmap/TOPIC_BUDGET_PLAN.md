# Topic budget (بودجه‌بندی مبحث‌به‌مبحث) — deferred

Status: **waiting for the owner to tag the bank questions with their topic** (decided
2026-10-13). Build this as soon as tagging is done; do not start it before.

## What it is

For every subject of the 1406 exam, how many past questions came from each topic of
the 1406 syllabus: e.g. in «داده‌ساختارها و الگوریتم‌ها» 1389–1405, how many on
recurrences, heaps, hashing, graphs and shortest paths. The per-subject counts per
year already exist (the `*-questions-per-year` articles, `analysis/bank_stats.json`);
this adds the layer inside each subject.

## Inputs

- The owner's unified bank (`active_questions.jsonl`, see memory
  `question-bank-import`), once each question carries a topic from the 1406 syllabus
  (`content/import-packages/syllabus-1406-notes.mjs`, memory
  `exams-follow-1406-syllabus`). On 2026-10-13 only 334 of 6,609 questions had a
  `topic`.
- Tracks: ce (1277, 1389–1405), it (1276, 1386–1405), cs (1209), phd. Only subjects
  in the 1406 exam of a track.

## Output (three ideas, one data layer)

1. **Topic section in each subject's existing budget article** — not a new page, so
   «بودجه‌بندی X» and «مباحث مهم X» do not compete. Retitle to include
   «مبحث‌به‌مبحث». Table: topic × period (multi-year windows plus the last five
   years — single years hold 0–2 questions per topic and mislead), share of the
   subject, rising/falling topics.
2. **«مباحث پرتکرار هر درس در کنکور ارشد کامپیوتر»** (idea 2 of 2026-10-13): one hub
   ranking the top topics of every subject, linking to the subject articles and the
   lesson notes.
3. **«اگر فقط سه ماه داری»** (idea 3): the smallest set of topics covering a given
   share (e.g. 60%) of a subject's questions in recent years; links to lesson notes,
   the bank and a short practice exam.

## Rules

- Counts only from tagged questions; print the number of questions and years behind
  every table; history is not a forecast for 1406.
- Rebuild `analysis/bank_stats.mjs`-style aggregates (a `topic_stats` file), then the
  article builders; verify hand-written claims against the printed stats.
- Also unlocks: topic pages (`/topics/*`, `topics.xml` is empty today), topic filters
  in the bank, and frequency lines in the topic test articles (idea 1).
