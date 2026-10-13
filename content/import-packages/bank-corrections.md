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
| it-1388-C-q0096 | IT 1388 q96, stem | «(با کوانتوم زمانی q=1 و NP-LCFS» | «(با کوانتوم زمانی q=1) و NP-LCFS» (closing parenthesis) |

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
