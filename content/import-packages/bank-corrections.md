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
| kunkurcomputer-q-1209-1392-370C-063 | CS 1392 q63, option 3 | ۱۲۵ | ۱۲۰ (the Huffman merge cost; the key 3 holds with the booklet). Fixed in questions/text-fixes.mjs |

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
| kunkurcomputer-q-1209-1385-b0-073 | CS 1385 q73 | 2 (4×5!) | choose the greatest and least element (5·4=20 ways) and any partial order on the other three (19 labelled posets): 380, which is none of the options |
| kunkurcomputer-q-1209-1387-b0-058 | CS 1387 q58 | 4 (1024×1024 bytes) | that is a megabyte; options 1–3 (10⁹, 1000 million, 2³⁰) are the two usual meanings of a gigabyte. Booklet text matches the bank |
| kunkurcomputer-q-1209-1397-262F-076 | CS 1397 q76 | 3 ((A(BC))D) | multiplications: ((AB)C)D = 2250+1500+1020 = 4770, (A(BC))D = 3750+900+1020 = 5670, A((BC)D) = 7830, (AB)(CD) = 9050. The fastest is option 4; booklet text matches the bank |
| kunkurcomputer-q-1277-1390-b2-049 | CE 1390 q49 (doc-1201552de810011a q129) | 3 («۲ گزاره») | adding 1 to every edge keeps the MST (order unchanged) but can change the minimum cut (a cut with more edges grows more) and the shortest path (a path with more edges grows more): only II holds, option 1 |
| kunkurcomputer-q-1209-1391-368C-056 | CS 1391 q56 | 1 | column-major position of A[i,j,k] in A[1..a,2..b,3..c] is (k−3)(b−1)a+(j−2)a+i; option 1 ends in +k (booklet misprint, matches the bank). Intended answer 1 |

## Questions whose figure, code or language is missing (2026-10-18)

The stem points at something that is only in the booklet crop, which students do
not see. `needs-figure.mjs` keeps these ten in the review queue until the part is
typed in or cut as a figure: CS 1382 q144 (the language), CS 1384 q117 and q121
(automaton), CS 1392 q88 (matrix sizes), CE 1382 q60 (graph), CE 1383 q50 (program),
q52 (tree), q63 (matrix P), CE 1384 q52 (tree), q53 (algorithm).

**Closed from the booklet crops (2026-10-18).** `text-fixes.mjs` now types the missing
part (`append`, `stem`, `table`) or adds the drawing already cut from the booklet
(`figures`) for 13 of the 15: CS 1382 q144, CS 1383 q139 (the definition of f),
CS 1384 q121, CS 1392 q88, CE 1382 q60, CE 1383 q50, q52, q63, CE 1384 q52, q53,
CE 1389 q74 (stack program), CE 1389 q50 (DFS table), CE 1390 q34 (MAYBESORT). Each
key was checked against the typed text and holds. In CE 1389 q50 the booklet prints
the fourth and eighth columns blurred as «a» and «n»; the options name d and h, so
the table is typed with d and h.

Two stay in the queue with their gap typed in, because no option is exactly right:

| Question id | Exam | Key | Why |
|---|---|---|---|
| kunkurcomputer-q-1209-1384-b0-117 | CS 1384 q117 | 4 | in the drawn automaton the middle edge goes from the lower state up to the upper one on 0, so 10 and 100 are accepted too; option 4, 0+(00+1+11)00*, leaves them out |
| kunkurcomputer-q-1277-1389-b1-033 | CE 1389 q33 | 4 (p_ik*p_kj) | with independent failures a path fails with probability p+q−pq; the product is the probability that both edges fail. No option is exact |

## Texts the bank marked ambiguous, compared with the booklet (2026-10-18)

Released (`verified: true` in `text-fixes.mjs`) after reading the crop: CS 1397 q92,
1398 q77, q85, q94, 1400 q85, 1404 q69 (text complete as printed); CS 1396 q212 (the
booklet asks about «M», the set defined is R); CS 1402 q85 (option 3's «SL» is L);
CS 1402 q84 and 1403 q88 (the booklet prints the terminal c as «C» in Y → cY and, in
1403, Z as «z»; both keys read it as c; the duplicate grammar crop is dropped);
CS 1400 q67 (the program, two copies of one crop, typed as printed — its outer loop
starts at i = 0, where the inner loop would not advance; the key, n lg n, reads it
from i = 1).

Still held:

| Question id | Exam | Key | Why |
|---|---|---|---|
| kunkurcomputer-q-1209-1392-370C-093 | CS 1392 q93 | 3 (5, 1101) | the booklet prints f's frequency as «s»; read as 5 the depth is 5, but f's code under the usual convention (smaller weight on 0) is 1100, option 4 |
| kunkurcomputer-q-1209-1402-760F-062 | CS 1402 q62 | 4 (initial) | the booklet's loop multiplies j by 3 with i, so it prints n; the options (and the key) fit j = j*i, which gives 3^(k(k+1)/2) with k = log₃n |

## Old CS questions without a key (1380–1385), solved from the booklet (2026-10-18)

The republished compiler key of these years does not match the booklet (the bank set
it aside), so each question was solved from its crop. Our key (`ourKey` in
`solutions.mjs`) is given only where one option is clearly right: CS 1380 q51, q62,
q70, q76, q79; 1381 q72, q84, q111, q139; 1382 q91, q147; 1383 q91, q110, q142;
1384 q82, q93, q140; and CS 1404 q68 (whose key sources conflict). Text fixes from the
booklet: 1383 q110 (22313 instructions, B's CPI is 3; the bank typed 33333 and 2),
1384 q140 (tridiagonal means a_ij = 0 for |i−j| > 1; the booklet prints ≥ 1),
1383 q91 (distance table typed out). In 1380 q70 and 1381 q84 the booklet writes
«خارج قسمت» where it means the dividend's upper half; the solution says so.

Left without a key, and why:

| Question | Why |
|---|---|
| CS 1380 q43 | the program ends with S[i]='\0' and i is 0 there, so it prints nothing; the options fit S[k] (AF3) |
| CS 1380 q57, 1381 q110, 1380 q95, 1381 q61, 1382 q148, 1381 q150 | two options are true (1380 q57: 1 and 4; 1381 q110: 1 and 4; 1380 q95: 1 and 3; 1381 q61: 2 and 3 are not tautologies; 1382 q148: 2 and 3 are false; 1381 q150: 1 and 4) |
| CS 1380 q61 | «word» can be the word within a block (3 bits, option 1) or the byte offset (5 bits, option 2) |
| CS 1380 q67, q69, q77, q120; 1381 q96, q147, q148, q149 | the wording admits more than one reading (≈100 bits between 90 and 120; «maximum» speed-up; tape reasons; this; tape figures that give 73%; functional-language claims) |
| CS 1380 q101, q109, q110; 1381 q136 | hand-drawn automata / a TM table not yet worked through |
| CS 1381 q74 | both loops end in «;», so the body runs once after them (and n, i are out of scope in standard C++) |
| CS 1381 q78, q104 | written with little o: read literally, o(n²) and o(n log n) are false for Θ(n²) and Θ(n log n) |
| CS 1381 q85 | no option matches the XY table (next state is xQ + x̄ȳ + x̄Q̄) |
| CS 1381 q156 | the grammar gives k ≥ 2 in both parts; option 3 says k ≥ 1 |
| CS 1381 q157 | the grammar gives only abba and bbaabbabba; all four statements hold |
| CS 1383 q77, q82, q84 | C macros/expressions with x++ twice or y==y++: undefined or unspecified order |
| CS 1383 q129 | an orthogonal triangular matrix is diagonal with ±1, so its trace is not fixed |
| CS 1383 q138 | f(3) = 3^(3^3) = 3^27, not an option |
| CS 1384 q52 | Y = 2 is outside the support 0 < y < 1 |
| CS 1385 q62 | the loop runs while m == 1, so for (42, 13) it stops after one pass and returns 0; the options fit m >= 1 (546) |

## More keys the mathematics does not reach (2026-10-18, later)

| Question id | Exam | Key | Why |
|---|---|---|---|
| kunkurcomputer-q-1209-1384-b0-062 | CS 1384 q62 | 2 (O(n²)) | the program is heapsort's sort-down: in the inner loop c = 2p+1 and p = c, so p at least doubles and the loop runs O(log i) times; the whole is O(n log n), option 3 |
| kunkurcomputer-q-1209-1396-265A-197 | CS 1396 q197 | 1 (10 or 18) | in 6,8,4,10,18,23,22,11 everything left of 10 is smaller and everything right is larger, but 11 sits right of 18, so 18 cannot have been the pivot: option 3 |

Text: CS 1399 q72 sorts a 10-element array in the booklet; the bank typed 15 (`text-fixes.mjs`).
| kunkurcomputer-q-1209-1393-370E-101 (and its repeat q191) | CS 1393 q101 | 4 (O(n³)) | the k-core is found by repeatedly deleting a vertex of degree < k: degrees in O(n²) from the matrix, each deletion updates its n neighbours, so O(n²) in all — option 2 |
| kunkurcomputer-q-1209-1404-460C-072 | CS 1404 q72 | 3 (۶) | counting by machine: \|N_n(i,j)\| takes the values 3,5,6,7,8,10 for n = 4 (six values) but 3,5,…,12 (nine values) for every n ≥ 6, so «for n > 3» has no single answer; 6 holds only for n = 4 |
| kunkurcomputer-q-1209-1391-368C-082 | CS 1391 q82 | 4 (Θ(log n / n)) | the recurrence is solved exactly by T(n) = 1 + (log₂ n)/n (check: 3/2·T(n/2) − 1/2·T(n/4) = 1 + (log₂ n + 1)/n, minus 1/n), with T(1) = 1 and T(2) = 3/2; so T(n) = Θ(1), not an option |
| kunkurcomputer-q-1209-1390-372B-094 | CS 1390 q94 | 4 (2^(⌊log₂n⌋+1)) | the star is printed outside the if, so A(0) prints one too: S(0) = 1, S(i) = 2S(i/2) + 1, giving S(n) = 2^(⌊log₂n⌋+2) − 1 (A(1) prints 3); no option matches |
| kunkurcomputer-q-1209-1391-368C-092 | CS 1391 q92 | 1 (backtracking, O(2ⁿ)) | the weights 1..n add up to n(n+1)/2 ≤ 2ⁿ, so every object fits and the answer is «take all» in O(n); the greedy option (O(n log n)) does that, backtracking is not the best method |
| kunkurcomputer-q-1209-1385-b0-089 | CS 1385 q89 | 3 (skewed right) | an inorder walk pushes the keys in ascending order, so they come off the stack largest first; inserting keys in descending order puts each new key left of the last: a left-skewed tree, option 2 |
| kunkurcomputer-q-1209-1382-b0-145 | CS 1382 q145 | 3 | the complement of L = {aⁿbˡ : n ≠ 3k} in {a,b}* is (aaa)*b* together with every string outside a*b* (those containing «ba»); option 3 equals a*b*, which contains ab ∈ L, and option 4 is all of {a,b}*; no option is the complement |
| kunkurcomputer-q-1209-1383-b0-128 | CS 1383 q128 | 2 (√(a+d)) | the Frobenius norm of B itself is √(a²+b²+c²+d²), option 3; √(a+d) = √tr(AAᵀ) is the Frobenius norm of A, not of B |
| kunkurcomputer-q-1209-1401-461E-076 | CS 1401 q76 | 2 (n) | with equal weights any spanning tree is minimum, so BFS/DFS finds one in Θ(n+e) = Θ(e) for a connected graph; it has to look at the edges, so n alone is not reachable (option 1) |
| kunkurcomputer-q-1209-1389-3077-084 | CS 1389 q84 | 4 | as printed, option 4 says n(lg n)⁵ = O(n^½), which is false (and every option has one false half); the booklet's «lg n» with a small ۲ under it is unclear |
| kunkurcomputer-q-1209-1399-462F-076 | CS 1399 q76 | 1 (θ(1)) | the sum Σ1/i² converges, so its value is θ(1), but the question asks for the time to compute it, which takes n terms: θ(n), option 2 |
| kunkurcomputer-q-1209-1405-257A-074 | CS 1405 q74 | 3 (231) | optimal three-way merging (ternary Huffman) of 3,7,8,9,15,16,17,20,33: 3+7+8=18, 9+15+16=40, 17+18+20=55, 33+40+55=128; moves 18+40+55+128 = 241, not an option |
| kunkurcomputer-q-1209-1405-257A-079 | CS 1405 q79 | 3 (40) | job 3 (d=1) at time 1, job 1 (d=2) at time 2, job 2 (d=3) at time 3 all meet their deadlines: 10+20+15 = 45, option 4 |
| kunkurcomputer-q-1209-1386-309-122 | CS 1386 q122 | 1 | option 2 is also true: in S→S(SS)|λ the inner SS can be any balanced string (take the second S→λ), so G″ also generates every balanced string, the same as G and G′ |
| kunkurcomputer-q-1209-1405-257A-086 | CS 1405 q86 | 1 | L₂ (n_a+n_b = 2n_c) is also context-free: a one-counter PDA pushes one mark per a or b and pops two per c (or the reverse, with a sign state), so both are context-free: option 3 |
| kunkurcomputer-q-1209-1405-257A-086 | CS 1405 q86 | 1 | L₂ (n_a+n_b = 2n_c) is also context-free: a one-counter PDA adds one per a or b and subtracts two per c, so both languages are context-free: option 3 |
| kunkurcomputer-q-1209-1387-b0-087 | CS 1387 q87 | 1 (22) | counting BSTs on 5 keys by levels (f(n,h) = Σ f(k,h−1)f(n−1−k,h−1)): at most 3 levels 6, at most 4 levels 26, so exactly 4 levels is 20 (26 if «at most»); 22 matches neither |
| kunkurcomputer-q-1209-1389-3077-058 | CS 1389 q58 | 4 | T(n) = H_n = Θ(ln n), so it is not o(ln n) (little-o, as printed); the true statement is o(n), option 2 |
| kunkurcomputer-q-1209-1391-368C-082 | CS 1391 q82 | 4 | with n = 2^k the solution is T(n) = 1 + (log₂ n)/n exactly (fits T(1)=1, T(2)=3/2), so T(n) = Θ(1), not an option; log n / n is only the decaying part |
| kunkurcomputer-q-1276-1402-758F-033 | IT 1402 q33 | 1 | T(n³) = Σθ(k) for k ≤ n = θ(n²), so T(N) = θ(N^{2/3}), option 3 (booklet order 1, n^{1/3}, n^{2/3}, n checked against the crop) |
| kunkurcomputer-q-1209-1397-262F-076 | CS 1397 q76 | 3 | costs: ((AB)C)D = 2250+1500+1020 = 4770, (A(BC))D = 3750+900+1020 = 5670, A((BC)D) = 7830, (AB)(CD) = 9050; the fastest is ((AB)C)D, option 4 |
| kunkurcomputer-q-1276-1402-758F-032 | IT 1402 q32 | 1 | i and j are both multiplied by 3 the same number of times, so the printed j equals n: θ(n), which is none of the options (θ(n²) is not it) |
| kunkurcomputer-q-1209-1382-b0-059 | CS 1382 q59 | 3 | option 2 is also correct: 2·C(2n−1, n−1) = C(2n, n) = Σ C(n,k)² (checked against the crop: no square on option 2) |
| kunkurcomputer-q-1209-1385-b0-073 | CS 1385 q73 | 2 (4×5!) | choose the greatest (5) and least (4) elements, then any partial order on the remaining 3 labelled elements (19): 5·4·19 = 380, which is none of the options |
| kunkurcomputer-q-1209-1385-b0-079 | CS 1385 q79 | 4 | f(n,k) counts onto maps from a k-set to an n-set: f(4,4)=24, f(3,3)=6, f(5,4)=0 are true; f(4,5)=4!·S(5,4)=240≠0, so the false statement is option 3 |
| kunkurcomputer-q-1276-1401-459C-035 | IT 1401 q35 | 1 (۲) | three of the six are always equivalences: h(f(g(R))), h(g(f(R))) and f(h(g(R))) (the transitive closure of a symmetric relation is symmetric, and adding loops keeps transitivity); 3 is not an option |
| kunkurcomputer-q-1276-1402-758F-030 | IT 1402 q30 | 3 | text fix, not a key dispute: the booklet says oranges in multiples of 3 (the bank typed 2); with that the generating function is 1/(1−x)² and the answer 21 matches the key |
| kunkurcomputer-q-1277-1389-b2-047 | CE 1389 q47 | 1 | 47^74 ≡ 1 (mod 24) and ≡ 4 (mod 7), so 47^74 ≡ 25 (mod 168): one day and one hour after Wednesday 4 pm is Thursday 5 pm, not an option |
| kunkurcomputer-q-1277-1391-b1-045 | CE 1391 q45 | 1 | φn follows from the premises iff (φ1∧…∧φn−1)→φn is a tautology: option 2 (checked against the crop); option 1 (a disjunction being satisfiable) is far too weak |
| kunkurcomputer-q-1277-1391-b2-120 | CE 1391 q120 | 4 | entailment is monotonic, so option 2 (a follows from KB2 = KB1 ∪ {b}) is just as true as option 4; the question has two correct options |
