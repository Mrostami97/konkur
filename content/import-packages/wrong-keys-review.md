# سؤال‌هایی که کلید رسمی‌شان با حل ما نمی‌خواند

تاریخ: ۷ آبان ۱۴۰۵. منبع: یادداشت‌های بررسی بانک (.claude/bank-tools/skip.txt). این سؤال‌ها فعلاً **بدون پاسخ تشریحی** روی سایت‌اند و کلید رسمی‌شان نمایش داده می‌شود.

- گروه الف: جواب درست بین گزینه‌هاست (51 سؤال). می‌شود کلید را به جواب ما تغییر داد و در پاسخ‌نامه نوشت که کلید رسمی چه بوده.
- گروه ب: هیچ گزینه‌ای درست نیست یا متن دفترچه غلط چاپی دارد (8 سؤال). می‌شود سؤال را «بدون گزینهٔ درست» علامت زد (سازوکارش در بانک هست) یا کنار گذاشت.

ستون «جواب ما» شمارهٔ گزینه است. یادداشت‌های فنی همان‌اند که هنگام حل نوشته شد.

## گروه الف: جواب درست بین گزینه‌هاست

| سؤال | درس | کلید رسمی | جواب ما | دلیل (یادداشت فنی) |
|---|---|---|---|---|
| PhD 2355 1397 q16 | داده‌ساختار و الگوریتم | 4 | 2 | B / 16 B blocks = 512 lines, 4-way = 128 sets: offset 4, set 7 (option 2); key 4 (2, 9) wrong |
| PhD 2355 1397 q18 | معماری و مدار | 1 | 3 | DMA does not involve the CPU in the transfer (ب false) and interrupt-driven I/O does (ج true), so الف و ج (option 3); key 1 wrong |
| PhD 2355 1397 q20 | معماری و مدار | 1 | 4 | Booth's add count fixes the number of 1-runs, not the number of 1 bits, so add-and-shift's count cannot be determined (option 4); key 1 wrong |
| PhD 2312 1395 q5 | داده‌ساختار و الگوریتم | 3 | 2 | removing a leaf of T, or an edge of T, leaves MSTs of the matching subgraphs (cycle property on tree paths that avoid v), so bullets 2 and 3 are true (two, option 2); key 3 (one) wrong |
| PhD 2312 1395 q18 | معماری و مدار | 2 | 4 | with a=0, b=c=1 the NAND drives 1 and the inverter drives 0 (bus conflict), and with b=c=0 nothing drives o; the circuit is not usable (option 4); key 2 wrong |
| IT 1400 q42 | داده‌ساختار و الگوریتم | 2 | 3 | equal DFS and BFS trees from one vertex force G to be a tree, so bullets 1 (tree) and 2 (bipartite) are true: two (option 3); key 2 (one) wrong |
| IT 1397 q46 | داده‌ساختار و الگوریتم | 2 | 3 | comb(20,3) makes 2279 calls in all (2278 recursive calls), option 3; key 2 (1957) wrong |
| IT 1396 q94 | هوش مصنوعی | 1 | 2 | with MIN (or MAX) at the second level, coin A gives about 5.03 (7.06) and coin B 6.08 (8.64), so B is better (option 2); key 1 (A) wrong |
| IT 1394 q91 | سیستم عامل | 4 | 2 | P0 prints 2 or 3 times depending on whether both releases of S0 land before its next wait (binary semaphore), so "at least two" (option 2); key 4 (at least three) wrong |
| IT 1392 q47 | داده‌ساختار و الگوریتم | 3 | 1 | both statements are false (p=0.34 can get a 2-bit code with 0.34,0.2,0.17,0.15,0.14; and 0.4,0.3,0.3 gives 0.4 a 1-bit code), so option 1; key 3 wrong |
| IT 1390 q74 | هوش مصنوعی | 2 | 1 | option 1 is the exactly-one formula; key 2 (~forall x ... and exists y take) does not say "only one" |
| IT 1389 q93 | هوش مصنوعی | 4 | 1 | group(x,y,mother(x)) and group(Ali,Ali,Alice) fail (mother(Ali) against the constant Alice), so option 1; key 4 (none) wrong |
| IT 1387 q88 | هوش مصنوعی | 1 | 2 | goal formulation comes first, then problem formulation (AIMA), so option 2; key 1 wrong |
| IT 1387 q91 | هوش مصنوعی | 3 | 4 | X before Y and Z, W free: 2 orders of X,Y,Z times 4 places for W = 8 linearizations (option 4); key 3 (4) wrong |
| PhD 2358 1405 q10 | داده‌ساختار و الگوریتم | 2 | 3 | statements 1, 2 and 5 are true; 3 is false (Hu-Shing solves matrix chain in O(n log n)) and 4 is false, so three (option 3); key 2 (four) wrong |
| PhD 2247 1405 q40 | داده‌ساختار و الگوریتم | 3 | 4 | option 3 only shows an optimal tour without crossings exists (cost <=); option 4 (strict decrease, diagonals longer than opposite sides) proves the claim; key 3 wrong |
| PhD 2247 1403 q2 | داده‌ساختار و الگوریتم | 3 | 4 | tracing gives x = 720, 360, 120, 30, 6, 1, 0 with s ending at 8 (option 4); key 3 (7) wrong |
| PhD 2247 1402 q6 | داده‌ساختار و الگوریتم | 2 | 1 | (a) is true (any BST on the same keys becomes any other with O(n) rotations via a right spine) and (b) is false (oscillating functions), so option 1; key 2 wrong |
| PhD 2247 1401 q41 | داده‌ساختار و الگوریتم | 2 | 4 | (a) is false and (b) is false too (a 3-approximation does not give a 2-approximation), so option 4; key 2 wrong |
| PhD 2247 1400 q7 | داده‌ساختار و الگوریتم | 2 | 3 | (a) is true (f = n on even n and 1 on odd n, g the other way) and (b) is trivially true, so both (option 3); key 2 wrong |
| PhD 2246 1393 q33 | داده‌ساختار و الگوریتم | 3 | 1 | x^26 by halving needs 6 multiplications (x^2, x^3, x^6, x^12, x^13, x^26), option 1; key 3 (8) wrong |
| IT 1392 q104 | معماری و مدار | 1 | 2 | stack datapath ADD #100; DR reaches only R1 and the adder reads only R1/R2, so it takes 2 clocks (load R1 and pop into R2, then push the sum), option 2; the key says 1 clock (option 1) |
| IT 1390 q89 | معماری و مدار | 1 | 3 | method a takes 5+20+45+20=90 ns per sample (9000 ns), pipeline b has a 50 ns clock ((3+99)x50=5100 ns), so b is about 1.8x faster (option 3); key says option 1 |
| CE 1395 q42 | داده‌ساختار و الگوریتم | 1 | 3 | per colour 125 ways (y1+..+y4=12, yi<=5), n=125^2=15625, last two digits sum 7 (option 3); the key says option 1 (13 in the booklet, 12 in the bank text) |
| IT 1396 q33 | داده‌ساختار و الگوریتم | 1 | 3 | integer square matrices are countable (a true) but /R^N/ = /N^N/ = c (b false), so option 3; the key says option 1 |
| CE 1390 q49 | داده‌ساختار و الگوریتم | 2 | 1 | (DSA): only the MST statement survives (+1 on every edge changes min cuts and shortest paths), so 1 statement is true (option 1); the key says 2 (option 3) |
| IT 1404 q32 | داده‌ساختار و الگوریتم | 3 | 4 | recurrence 4 (2T(n-1)+1 = 2^n) grows fastest; the initial key says 3 (which is Theta(n^2)) |
| CS 1403 q84 | نظریهٔ زبان‌ها | (در یادداشت) | 3 | C accepts the shuffle of L_A and L_B, so both 021100 and 210010 are accepted (option 3); the key says only I |
| CS 1403 q89 | نظریهٔ زبان‌ها | (در یادداشت) | 4 | with three 0s the PDA reaches q2 with z on the stack and stops, so alpha is rejected; beta has a 0 after a 1 and is rejected too (option 4) |
| CS 1403 q90 | نظریهٔ زبان‌ها | (در یادداشت) | 4 | the machine adds 1 in binary: $1001 gives $1010 and $101010 gives $101011, so neither I nor II holds (option 4) |
| CS 1396 q197 | داده‌ساختار و الگوریتم | 1 | 3 | only 10 can have been the pivot (11 lies right of 18), which is option 3; the key says option 1 (10 or 18); doubtful key |
| CS 1396 q118 | نظریهٔ زبان‌ها | (در یادداشت) | 4 | a decidable problem need not be decidable by an LBA, so option 4 is right; the key says the LBA option |
| CS 1396 q217 | داده‌ساختار و الگوریتم | (در یادداشت) | 4 | twin of q118 |
| CS 1393 q117 | نظریهٔ زبان‌ها | 4 | 2 | every language has infinitely many TMs (option 2); the key says option 4 |
| CS 1393 q212 | نظریهٔ زبان‌ها | 4 | 2 | every language has infinitely many TMs (option 2); the key says option 4 |
| CS 1394 q112 | نظریهٔ زبان‌ها | (در یادداشت) | 1 | a DFA for a k-rule regular grammar can need about 2^k states (n-th symbol from the end), so option 1 (key) is false |
| CS 1387 q58 | معماری و مدار | 4 | 3 | a gigabyte is 2^30 (or 10^9) bytes; the key (1024 x 1024 bytes) is a megabyte |
| CS 1388 q62 | داده‌ساختار و الگوریتم | 1 | 2 | in-place A[i]=A[8-i] leaves 3,2,1,3,2,3,1,2,3 whose sum is 20 (option 2); key 1 (18) wrong |
| CS 1384 q62 | داده‌ساختار و الگوریتم | 2 | 3 | heapsort sift-down loop: n-1 passes of O(log n), Theta(n log n) (option 3); key 2 wrong |
| CS 1386 q91 | داده‌ساختار و الگوریتم | 3 | 1 | n-1 comparisons per merge is the worst case only (best case merges with about n/2); key 3 (all cases) wrong |
| CS 1386 q99 | داده‌ساختار و الگوریتم | 1 | 3 | sparse addition costs O(r_A + r_B) (option 3 with row headers), not O(nm); key 1 wrong |
| CS 1389 q58 | داده‌ساختار و الگوریتم | 4 | 2 | T(n) = H_n = Theta(ln n), so o(n) (option 2) holds and o(ln n) (key 4) does not |
| CS 1397 q76 | داده‌ساختار و الگوریتم | 3 | 4 | costs: A((BC)D) 7830, (AB)(CD) 9050, (A(BC))D 5670, ((AB)C)D 4770, so option 4 is fastest; key 3 wrong |
| CS 1401 q76 | داده‌ساختار و الگوریتم | 2 | 1 | with equal weights any spanning tree is minimum, found in Theta(e) by DFS; key 2 (n) wrong |
| CS 1405 q79 | داده‌ساختار و الگوریتم | 3 | 4 | jobs 3, 1, 2 in slots 1, 2, 3 meet their deadlines for 45 (option 4); key 3 (40) wrong |
| PhD 1398 q6 | داده‌ساختار و الگوریتم | 2 | 4 | height log n / log log n times an O(log n) list scan gives O(log^2 n / log log n) (option 4); initial key 2 wrong |
| CS 1383 q109 | معماری و مدار | 2 | 1 | on a Pentium push sp stores the old SP, so bp = FF00 (option 1); key 2 (FEFE) is 8086 behaviour |
| CS 1404 q88 | نظریهٔ زبان‌ها | 3 | 2 | this is Sipser's machine for 0^(2^n): 0^6 is rejected and 0^8 accepted, so only II (option 2); key 3 wrong |
| CS 1405 q82 | نظریهٔ زبان‌ها | 4 | 2 | the DFA rejects exactly the strings containing 110; alpha (101101...) and beta (...01/100...) both contain it, so option 2; key 4 wrong |
| CS 1405 q86 | نظریهٔ زبان‌ها | 1 | 3 | both n_a+n_b = n_c and n_a+n_b = 2n_c are one-counter context-free languages, so option 3; key 1 wrong |
| CS 1387 q117 | نظریهٔ زبان‌ها | 1 | 2 | L meets 1+0+1+0+ in {1^a 0^b 1^c 0^d : d <= a}, not regular, so option 2; key 1 wrong |

## گروه ب: هیچ گزینه‌ای درست نیست یا متن ایراد دارد

| سؤال | درس | کلید رسمی | جواب ما | دلیل (یادداشت فنی) |
|---|---|---|---|---|
| PhD 2356 1400 q10 | داده‌ساختار و الگوریتم | 2 | — | bullet 1 false (v may only be reachable from a negative cycle), bullet 2 false (v->x->u, v->y->u with back edge u->v: no other edge lies on every cycle), bullet 3 false (Dijkstra is correct when only edges leaving s are negative); none true, key 2 (one) wrong |
| IT 1391 q79 | سیستم عامل | 4 | — | Fig B (A holds 1,4 wants 2; C holds 2,3 wants 4) and Fig C (B holds 1,2 wants 3; C holds 3 wants 2) still deadlock; key 4 wrong |
| PhD 2247 1402 q9 | داده‌ساختار و الگوریتم | 1 | — | (b) is solvable in O(n log n) by sorting and two pointers, and in expected O(n) with log-scale buckets, not n^2; key 1 wrong |
| CS 1386 q63 | داده‌ساختار و الگوریتم | 4 | — | line 2 squares A[i][i] and the j = i term then multiplies the squared value again, so no option computes the diagonal of A^2; key 4 wrong |
| CS 1392 q60 | داده‌ساختار و الگوریتم | 2 | — | with while(p>0) the last pass makes p = 0 and prints an extra 1 (n >= 0); no option fixes the program; key 2 wrong |
| CS 1396 q169 | داده‌ساختار و الگوریتم | 1 | — | f(P, P%q, r) drives q to 0 and ignores it, returning gcd(P, r), not gcd(P, q, r); key 1 wrong (booklet typo) |
| CS 1390 q94 | داده‌ساختار و الگوریتم | 4 | — | S(i) = 2S(i/2) + 1 with S(0) = 1 gives 2^(floor(lg n)+2) - 1 stars, not an option; key 4 wrong |
| CS 1391 q82 | داده‌ساختار و الگوریتم | 4 | — | with T(1) = 1, T(2) = 3/2 the solution is T(n) = 1 + lg n / n = Theta(1); the key Theta(lg n / n) needs T(1) = 0 |

سؤال‌های قدیمی‌تر با کلید مشکوک (پیش از ۷ آبان) در content/import-packages/bank-corrections.md ثبت شده‌اند.
