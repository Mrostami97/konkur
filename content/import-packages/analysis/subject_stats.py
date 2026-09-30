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

# --- enrichment: weight per code, admitted medians per university / orientation, zero share by year
import sys
sys.path.insert(0, HERE)
from adm_loader import load
adm = [a for a in load() if a["quota"] == "free" and a["period"] == "روزانه"]
W = MODEL["weights"]
for j in range(6):
    d = out[str(j)]
    d["weights"] = {c: W[c][j] for c in "1234"}
    d["byUni"] = {u: [len(v), st.median(a["p"][j] for a in v)] for u in set(a["uni"] for a in adm) if len(v := [a for a in adm if a["uni"] == u]) >= 10}
    d["byProg"] = {p: [len(v), st.median(a["p"][j] for a in v)] for p in set(a["prog"] for a in adm) if len(v := [a for a in adm if a["prog"] == p]) >= 20}
    d["zeroTop300"] = {str(y): [len(g), sum(c["p"][j] <= 0 for c in g) / len(g)] for y in range(1400, 1406) if len(g := [c for c in cards if c["year"] == y and c["best"] <= 300]) >= 10}
    d["ge50Top100"] = {str(y): [len(g), sum(c["p"][j] >= 50 for c in g) / len(g)] for y in range(1400, 1406) if len(g := [c for c in cards if c["year"] == y and c["best"] <= 100]) >= 10}
json.dump(out, open(os.path.join(HERE, "subject_stats.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
for j in range(6):
    d = out[str(j)]
    print("\n#", d["name"], "w", d["weights"])
    print("   byUni", {u: round(v[1]) for u, v in sorted(d["byUni"].items(), key=lambda kv: -kv[1][1])})
    print("   byProg", {p: round(v[1]) for p, v in sorted(d["byProg"].items(), key=lambda kv: -kv[1][1])})
    print("   zeroTop300", {y: (v[0], round(100 * v[1])) for y, v in d["zeroTop300"].items()}, "ge50Top100", {y: (v[0], round(100 * v[1])) for y, v in d["ge50Top100"].items()})
