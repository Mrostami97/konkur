# Bank vs. source image: differences found while building articles

Found while checking each published question against its crop image (2026-10-13).
Fix these in the bank; articles built here already use the image's text.

## Text errors (the question on the site would be wrong)

| Question id | Exam | Bank says | Image says |
|---|---|---|---|
| doc-0d6b4ac841e02bf1-q-0044 | CE 1405 q44, option 2 | `2^8` | `3^8` (۳ به توان ۸) — the key (option 1, `2^64`) is unaffected |
| doc-aa34d7e9ba352ebc-q-0047 | CE 1404 q47, option 4 | `(0+ε)(11*0*)*` | `(0+ε)(11*0)*1*` — with the bank text option 4 would also differ and the key (2) would not hold |
| cs-early-fa3a82f4-1382-q-0099 | CS 1382 q99, stem | «اگر خانه‌های ۱، ۴، ۶ و ۷ این جدول پر باشند» | «اگر خانه‌های ۱، ۲، ۴ و ۶ این جدول پر باشد» (the key ۱٫۶۲۵ holds for both) |
| doc-0d6b4ac841e02bf1-q-0058 | CE 1405 q58, stem | `2T([sqrt n])` | `2T(⌊√n⌋)` (floor sign) |
| doc-0d6b4ac841e02bf1-q-0075 | CE 1405 q75, last option | ends with «مجموعه دروس تخصصی ۳ (مدار منطقی، …):» | that line is the next section heading, not part of the question |
| doc-aa34d7e9ba352ebc-q-0035 | CE 1404 q35, stem | `۰/۰۱٪` of requests are real attacks | `۰/۱٪` — with the bank number the answer is 0.005, not the key (3) 0.047 |
| doc-aa34d7e9ba352ebc-q-0039 | CE 1404 q39, option 4 | `۶۰۰۰` lines | `۶۰۰۰۰` lines — with the bank number option 4 is also false and the key (2) is no longer the only answer |
| it-1388-C-q0096 | IT 1388 q96, stem | «(با کوانتوم زمانی q=1 و NP-LCFS» | «(با کوانتوم زمانی q=1) و NP-LCFS» (closing parenthesis) |

## Key errors (the bank's key misses a final-key change)

| Question id | Exam | Bank | Final key |
|---|---|---|---|
| doc-0d6b4ac841e02bf1-q-0086 | CE 1405 q86 | option 2 only | options 2 and 3 (۱۳ and ۱۱) — the final key (booklet 135B) marks «۳,۴»; mapped to 135A by the two readings of the question, confirmed by the owner 2026-10-13 |

## Labels added to options (not in the booklet)

| Question id | Exam | Bank says | Image says |
|---|---|---|---|
| doc-64e3de2de6db498a-q-0071 | CE 1395 q71 | `ATT = 41.8, AWT = 55.5` … | `41.8، 55.5` … (the stem says «از راست به چپ») |
| doc-7adaa40c11e371ac-q-0083 | CE 1403 q83 | `index = 16، TAG = 11` … | `۱۶ و ۱۱` … |
| doc-7adaa40c11e371ac-q-0104 | CE 1403 q104 | `مبدأ: ۵؛ مقصد: بدون تغییر` … | `۵ ـ بدون تغییر` … |

## Crop images that do not show the whole question

The text was checked against the full booklet page instead; it is right, but the crop
beside the question is incomplete.

| Question id | Exam | Problem |
|---|---|---|
| doc-aa34d7e9ba352ebc-q-0036 | CE 1404 q36 | crop stops after option 3 |
| doc-aa34d7e9ba352ebc-q-0086 | CE 1404 q86 | crop has only the options, no stem |
| doc-aa34d7e9ba352ebc-q-0103 | CE 1404 q103 | crop stops after option 2 and includes the end of q102 |
| doc-7adaa40c11e371ac-q-0104, doc-95fb09b12836fade-q-0047 / q-0097, doc-b08b0a453fcade0c-q-0048 | CE 1403 q104, 1391 q47 / q97, 1392 q48 | no question crop; only the page image |

## Consequence for the subject-page samples

The samples bundle `kunkurcomputer-question-imports/2026-10-07-samples/` was built from
the bank before these checks and carries the three errors above (1405 q44, 1403 q83,
1403 q104). Do not upload it; rebuild it after the bank is corrected. On 2026-10-13 no
sample was live on the site (`/api/questions/samples` returned none). The other 31
samples match their images.

## Keys that the mathematics does not reach (found writing solutions, 2026-10-18)

The text matches the booklet; the recorded key cannot be right. Left without a
written solution until the owner decides (build.mjs refuses a solution that does
not reach the key).

| Question id | Exam | Key | Why |
|---|---|---|---|
| kunkurcomputer-q-1209-1389-3077-058 | CS 1389 q58 | 4 (`o(ln n)`) | `T(n)=H_n=Θ(ln n)`, so `T(n)∈o(ln n)` is false and only option 2 (`o(n)`) holds |
| kunkurcomputer-q-1209-1387-b0-087 | CS 1387 q87 | 1 (۲۲) | BSTs on five keys: 6 have 3 levels, 20 have 4 and 16 have 5 (6+20+16=42=C₅); «depth 4 with the root on level 1» gives 20, which is not an option |
| kunkurcomputer-q-1209-1383-b0-097 | CS 1383 q97 | 4 (۱۴) | 23 numbers exceed 1000; t of them on the bottom (10th) level need at least Σ⌈t/2^(9−l)⌉ ancestors above 1000. t=8 uses 21, t=9 needs 25, so the maximum is 8 — not an option. 14 looks like 23−9 (one root path), which ignores that the leaves need different parents |
| kunkurcomputer-q-1209-1385-b0-079 | CS 1385 q79 | 4 | f(n,k) counts onto maps from a k-set to an n-set: f(4,4)=24, f(3,3)=6, f(4,5)=240, f(5,4)=0. The false statement is option 3 (f(4,5)=0), not 4 |

## Questions whose figure, code or language is missing (2026-10-18)

The stem points at something that is only in the booklet crop, which students do
not see. `needs-figure.mjs` keeps these ten in the review queue until the part is
typed in or cut as a figure: CS 1382 q144 (the language), CS 1384 q117 and q121
(automaton), CS 1392 q88 (matrix sizes), CE 1382 q60 (graph), CE 1383 q50 (program),
q52 (tree), q63 (matrix P), CE 1384 q52 (tree), q53 (algorithm).
