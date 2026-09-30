"""Best in-quota rank by band of one box (specialised package, maths, language).
Set 1277, free quota, 1403 and 1404 (test counts known; the two exams are the
closest to the 1406 format). Aggregates only; groups >= 10. Writes metric_stats.json."""
import os, json, statistics as st, sys
HERE = os.path.dirname(os.path.abspath(__file__))
exec(open(os.path.join(HERE, "skip_subject.py"), encoding="utf-8").read().split("BANDS =")[0])
TESTS = {1403: [25, 20, 9, 20, 20, 19], 1404: [25, 20, 10, 20, 20, 20]}
cs = [c for c in cards if c["year"] in (1403, 1404) and c["best"] <= 3000]
for c in cs:
    T = TESTS[c["year"]]; c["spec"] = sum(c["p"][j]*T[j] for j in range(2, 6))/sum(T[2:])
def q(v): x = st.quantiles(v, n=4); return [x[0], st.median(v), x[2]]
SPEC = [(0, 10), (10, 20), (20, 30), (30, 40), (40, 50), (50, 60), (60, 101)]
MATH = [(-100, 0.001), (0.001, 10), (10, 20), (20, 30), (30, 40), (40, 101)]
LANG = [(-100, 0.001), (0.001, 10), (10, 20), (20, 40), (40, 60), (60, 101)]
out = {"n": len(cs), "byYear": {str(y): sum(1 for c in cs if c["year"] == y) for y in (1403, 1404)}}
for name, key, bands in (("spec", lambda c: c["spec"], SPEC), ("math", lambda c: c["p"][1], MATH), ("lang", lambda c: c["p"][0], LANG)):
    rows = []
    for lo, hi in bands:
        g = [c for c in cs if lo <= key(c) < hi]
        if len(g) < 10: rows.append(dict(lo=lo, hi=hi, n=len(g))); continue
        r = [c["best"] for c in g]
        rows.append(dict(lo=lo, hi=hi, n=len(g), rank=q(r), le100=sum(x <= 100 for x in r)/len(g), le300=sum(x <= 300 for x in r)/len(g), le1000=sum(x <= 1000 for x in r)/len(g),
                         spec=st.median(c["spec"] for c in g), math=st.median(c["p"][1] for c in g), lang=st.median(c["p"][0] for c in g), gpa=st.median(c["gpa"] for c in g)))
    out[name] = rows
json.dump(out, open(os.path.join(HERE, "metric_stats.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
for name in ("spec", "math", "lang"):
    print(name)
    for r in out[name]: print("  ", r["lo"], r["hi"], r["n"], r.get("rank") and [round(x) for x in r["rank"]], r.get("le100") and round(100*r["le100"]), r.get("le300") and round(100*r["le300"]), r.get("le1000") and round(100*r["le1000"]), r.get("spec") and round(r["spec"]), r.get("math") and round(r["math"]), r.get("lang") and round(r["lang"]))

# --- enrichment: per-year split of each band (1403 vs 1404), and the other two boxes' zero shares
for name, key, bands in (("spec", lambda c: c["spec"], SPEC), ("math", lambda c: c["p"][1], MATH), ("lang", lambda c: c["p"][0], LANG)):
    for i, (lo, hi) in enumerate(bands):
        r = out[name][i]
        for y in (1403, 1404):
            g = [c for c in cs if c["year"] == y and lo <= key(c) < hi]
            r[f"y{y}"] = [len(g), st.median(c["best"] for c in g)] if len(g) >= 10 else [len(g), None]
json.dump(out, open(os.path.join(HERE, "metric_stats.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
for name in ("spec", "math", "lang"):
    print(name, [(r["lo"], r["hi"], r["y1403"][0], r["y1403"][1] and round(r["y1403"][1]), r["y1404"][0], r["y1404"][1] and round(r["y1404"][1])) for r in out[name]])
