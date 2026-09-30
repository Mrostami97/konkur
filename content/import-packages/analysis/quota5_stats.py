"""Master's computer engineering, 5% quota admissions (daytime) versus free quota:
per university and per program medians of the in-quota rank, typical card, and
the weighted average each median rank needed (public rank model, GPA 17.5, 1403
and 1404). Aggregates only: groups >= 10 (>= 5 for medians of ranks/counts).
Writes quota5_stats.json."""
import collections, json, math, os, statistics as st, sys
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
from adm_loader import load
MODEL = json.load(open(os.path.join(HERE, "../../../apps/web/src/content/rank-model-1277.json"), encoding="utf-8"))
allm = [a for a in load() if a["period"] == "روزانه" and a["quota"] in ("free", "5_percent")]
def need(quota, year, code, rank):
    y = next((m for m in MODEL["years"] if m["year"] == year and m["quota"] == quota), None)
    cv = y and y["codes"].get(code)
    if not cv: return None
    target = math.log(rank); ln = cv["lnRank"]
    if target > ln[0] or target < ln[-1]: return None
    for i in range(len(ln) - 1):
        if ln[i] >= target >= ln[i+1]:
            t = 0 if ln[i] == ln[i+1] else (ln[i] - target)/(ln[i] - ln[i+1])
            return cv["start"] + (i + t)*MODEL["step"]
def q(v): x = st.quantiles(v, n=4); return [x[0], st.median(v), x[2]]
f5 = [a for a in allm if a["quota"] == "5_percent"]; ff = [a for a in allm if a["quota"] == "free"]
out = {"n5": len(f5), "nFree": len(ff), "byYear5": dict(collections.Counter(a["year"] for a in f5))}
out["rank5"] = q([a["rank"] for a in f5]); out["rankFree"] = q([a["rank"] for a in ff])
out["box5"] = [st.median(a["p"][j] for a in f5) for j in range(6)]; out["boxFree"] = [st.median(a["p"][j] for a in ff) for j in range(6)]
out["gpa5"] = st.median(a["gpa"] for a in f5 if a["gpa"]); out["gpaFree"] = st.median(a["gpa"] for a in ff if a["gpa"])
out["zeroMath5"] = sum(a["p"][1] <= 0 for a in f5)/len(f5); out["zeroMathFree"] = sum(a["p"][1] <= 0 for a in ff)/len(ff)
out["byUni"] = {}
for u in set(a["uni"] for a in f5):
    g = [a for a in f5 if a["uni"] == u]
    if len(g) < 5: continue
    out["byUni"][u] = dict(n=len(g), rank=st.median(a["rank"] for a in g), spec=st.median(sum(a["p"][2:])/4 for a in g), gpa=st.median(a["gpa"] for a in g if a["gpa"]) if sum(1 for a in g if a["gpa"]) >= 5 else None,
                           nFree=sum(1 for a in ff if a["uni"] == u), rankFree=st.median(a["rank"] for a in ff if a["uni"] == u) if sum(1 for a in ff if a["uni"] == u) >= 5 else None)
out["byProg"] = {}
for p in set(a["prog"] for a in f5):
    g = [a for a in f5 if a["prog"] == p]
    if len(g) < 5: continue
    gf = [a for a in ff if a["prog"] == p]
    code = collections.Counter(a["code"] for a in g).most_common(1)[0][0]
    r5 = st.median(a["rank"] for a in g); rf = st.median(a["rank"] for a in gf) if len(gf) >= 5 else None
    out["byProg"][p] = dict(n=len(g), rank=r5, nFree=len(gf), rankFree=rf, code=code,
        need5={str(y): need("5_percent", y, code, r5) for y in (1403, 1404)}, needFree={str(y): (need("free", y, code, rf) if rf else None) for y in (1403, 1404)})
json.dump(out, open(os.path.join(HERE, "quota5_stats.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print({k: (round(v, 2) if isinstance(v, float) else v) for k, v in out.items() if k not in ("byUni", "byProg")})
print({u: (v["n"], round(v["rank"]), v["nFree"], v["rankFree"] and round(v["rankFree"])) for u, v in out["byUni"].items()})
for p, v in out["byProg"].items(): print(p, v["n"], round(v["rank"]), v["nFree"], v["rankFree"] and round(v["rankFree"]), {y: x and round(x, 1) for y, x in v["need5"].items()}, {y: x and round(x, 1) for y, x in v["needFree"].items()})

# --- enrichment: 5% card per university, in-quota rank buckets, per-year counts
out["uniCard5"] = {u: [len(v), st.median(sum(a["p"][2:]) / 4 for a in v), st.median(a["p"][1] for a in v), st.median(a["p"][0] for a in v)] for u in set(a["uni"] for a in f5) if len(v := [a for a in f5 if a["uni"] == u]) >= 10}
out["buckets5"] = [sum(1 for a in f5 if lo <= a["rank"] <= hi) for lo, hi in ((1, 30), (31, 100), (101, 300), (301, 100000))]
out["progCard5"] = {p: [len(v), st.median(sum(a["p"][2:]) / 4 for a in v), st.median(a["p"][1] for a in v), st.median(a["p"][0] for a in v)] for p in set(a["prog"] for a in f5) if len(v := [a for a in f5 if a["prog"] == p]) >= 10}
json.dump(out, open(os.path.join(HERE, "quota5_stats.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print({u: [v[0]] + [round(x) for x in v[1:]] for u, v in out["uniCard5"].items()}); print(out["buckets5"]); print({p: [v[0]] + [round(x) for x in v[1:]] for p, v in out["progCard5"].items()})
