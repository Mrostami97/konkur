"""Per-subject percentage by rank band (set 1277, free quota, best in-quota rank of
the four codes; tier B, aggregates only, groups >= 10, medians of >= 5).
Writes subject_stats.json (numbers only)."""
import os, json, statistics as st, math
HERE = os.path.dirname(os.path.abspath(__file__))
exec(open(os.path.join(HERE, "skip_subject.py"), encoding="utf-8").read().split("BANDS =")[0])
B = [(1, 30), (31, 100), (101, 300), (301, 1000), (1001, 3000)]
TESTS = {1403: [25, 20, 9, 20, 20, 19], 1404: [25, 20, 10, 20, 20, 20], 1405: [25, 19, 10, 19, 19, 18]}
def rk(v):
    o = sorted(range(len(v)), key=lambda i: v[i]); r = [0]*len(v)
    for i, j in enumerate(o): r[j] = i
    return r
out = {}
allc = [c for c in cards if c["best"] <= 3000]
for j in range(6):
    d = {"name": NAMES[j]}
    d["byYear"] = {f"{a}-{b}": {str(y): (lambda g: [len(g), st.median(c["p"][j] for c in g)] if len(g) >= 5 else None)([c for c in cards if c["year"] == y and a <= c["best"] <= b]) for y in range(1400, 1406)} for a, b in B}
    d["recent"] = {}
    for y in (1404, 1405):
        for a, b in B:
            g = [c for c in cards if c["year"] == y and a <= c["best"] <= b]
            if len(g) < 10: continue
            v = [c["p"][j] for c in g]; q = st.quantiles(v, n=4)
            d["recent"][f"{y}|{a}-{b}"] = dict(n=len(g), med=st.median(v), q1=q[0], q3=q[2], zero=sum(x <= 0 for x in v)/len(v), net=st.median(v)*TESTS[y][j]/100, tests=TESTS[y][j])
    d["old"] = {}
    for a, b in B:
        g = [c for c in cards if c["year"] <= 1403 and a <= c["best"] <= b]
        v = [c["p"][j] for c in g]; q = st.quantiles(v, n=4)
        d["old"][f"{a}-{b}"] = dict(n=len(g), med=st.median(v), q3=q[2], zero=sum(x <= 0 for x in v)/len(v))
    xa = rk([c["p"][j] for c in allc]); xb = rk([-c["best"] for c in allc]); n = len(allc)
    ma = sum(xa)/n; mb = sum(xb)/n
    d["corr"] = sum((x-ma)*(y-mb) for x, y in zip(xa, xb))/math.sqrt(sum((x-ma)**2 for x in xa)*sum((y-mb)**2 for y in xb))
    d["nAll"] = n
    out[str(j)] = d
json.dump(out, open(os.path.join(HERE, "subject_stats.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
for j in range(1, 6):
    d = out[str(j)]; print(d["name"], "corr", round(d["corr"], 2))
    for a, b in B:
        print("  ", a, b, {y: (round(v[1]) if v else None) for y, v in d["byYear"][f"{a}-{b}"].items()}, "| old", round(d["old"][f"{a}-{b}"]["med"]), "zero", round(100*d["old"][f"{a}-{b}"]["zero"]))
    for k, v in d["recent"].items(): print("  ", k, v["n"], round(v["med"]), round(v["q1"]), round(v["q3"]), round(100*v["zero"]), round(v["net"], 1))
