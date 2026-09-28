"""Language box (25 tests) by rank band and year, set 1277, free quota, best in-quota rank.
Aggregates only: groups >= 10 (>= 5 medians only). Loader = skip_subject.py."""
import os, statistics as st, collections
HERE = os.path.dirname(os.path.abspath(__file__))
exec(open(os.path.join(HERE, "skip_subject.py"), encoding="utf-8").read().split("BANDS =")[0])
B = [(1, 30), (31, 100), (101, 300), (301, 1000), (1001, 3000)]
N = {1400: 25, 1401: 25, 1402: 25, 1403: 25, 1404: 25, 1405: 25}
print("\n== median language % by band x year (n) ==")
for a, b in B:
    row = []
    for y in range(1400, 1406):
        g = [c for c in cards if c["year"] == y and a <= c["best"] <= b]
        row.append(f"{y}: {st.median(c['p'][0] for c in g):.0f} (n={len(g)})" if len(g) >= 5 else f"{y}: -(n={len(g)})")
    print(f"{a}-{b}:", " | ".join(row))
print("\n== all years pooled: language median, quartiles, share <=0, share >=50, net tests median ==")
for a, b in B:
    g = [c for c in cards if a <= c["best"] <= b]; v = [c["p"][0] for c in g]
    q = st.quantiles(v, n=4)
    print(f"{a}-{b} n={len(g)} med {st.median(v):.1f} q1 {q[0]:.1f} q3 {q[2]:.1f} <=0 {100*sum(x<=0 for x in v)/len(v):.0f}% >=50 {100*sum(x>=50 for x in v)/len(v):.0f}% nettests {st.median(v)*25/100:.1f}")
print("\n== language vs spec average (pooled): median lang minus median spec (percent points), by band ==")
for a, b in B:
    g = [c for c in cards if a <= c["best"] <= b]
    print(f"{a}-{b}: lang {st.median(c['p'][0] for c in g):.1f} maths {st.median(c['p'][1] for c in g):.1f} spec-avg {st.median(sum(c['p'][2:])/4 for c in g):.1f}")
print("\n== year medians of language, all cards best<=1000 ==")
for y in range(1400, 1406):
    g = [c for c in cards if c["year"] == y and c["best"] <= 1000]
    if len(g) >= 5: print(y, len(g), f"{st.median(c['p'][0] for c in g):.1f}")
print("\n== spearman-ish: corr(lang, best rank rank) pooled best<=3000 ==")
g = [c for c in cards if c["best"] <= 3000]
import math
def rk(v):
    o = sorted(range(len(v)), key=lambda i: v[i]); r = [0]*len(v)
    for i, j in enumerate(o): r[j] = i
    return r
for j, nm in enumerate(NAMES):
    a = rk([c["p"][j] for c in g]); b = rk([-c["best"] for c in g]); n = len(g)
    ma = sum(a)/n; mb = sum(b)/n
    cov = sum((x-ma)*(y-mb) for x, y in zip(a, b)); print(nm, round(cov/math.sqrt(sum((x-ma)**2 for x in a)*sum((y-mb)**2 for y in b)), 2))
print("\n== 1404 and 1405 only: quartiles, share <=0, net tests (25 tests) ==")
for y in (1404, 1405):
    for a, b in B:
        g = [c for c in cards if c["year"] == y and a <= c["best"] <= b]
        if len(g) < 10: continue
        v = [c["p"][0] for c in g]; q = st.quantiles(v, n=4)
        print(f"{y} {a}-{b} n={len(g)} med {st.median(v):.1f} q1 {q[0]:.1f} q3 {q[2]:.1f} <=0 {100*sum(x<=0 for x in v)/len(v):.0f}% netTests {st.median(v)*25/100:.1f} gpa {st.median(c['gpa'] for c in g):.1f}")
print("\n== 1400-1403 pooled by band ==")
for a, b in B:
    g = [c for c in cards if c["year"] <= 1403 and a <= c["best"] <= b]
    v = [c["p"][0] for c in g]; q = st.quantiles(v, n=4)
    print(f"{a}-{b} n={len(g)} med {st.median(v):.1f} q3 {q[2]:.1f} <=0 {100*sum(x<=0 for x in v)/len(v):.0f}%")
