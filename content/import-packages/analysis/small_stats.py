"""Small orientations of the master's computer engineering exam (bioinformatics,
algorithms and computation, data science): daytime free quota, 1400-1404.
Aggregates only: groups >= 10 (>= 5 for medians/counts). Writes small_stats.json."""
import collections, json, math, os, statistics as st, sys
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
from adm_loader import load
MODEL = json.load(open(os.path.join(HERE, "../../../apps/web/src/content/rank-model-1277.json"), encoding="utf-8"))
adm = [a for a in load() if a["quota"] == "free" and a["period"] == "روزانه"]
def need(year, code, rank):
    y = next((m for m in MODEL["years"] if m["year"] == year and m["quota"] == "free"), None)
    cv = y and y["codes"].get(code)
    if not cv: return None
    target = math.log(rank); ln = cv["lnRank"]
    if target > ln[0] or target < ln[-1]: return None
    for i in range(len(ln) - 1):
        if ln[i] >= target >= ln[i+1]:
            t = 0 if ln[i] == ln[i+1] else (ln[i] - target)/(ln[i] - ln[i+1])
            return cv["start"] + (i + t)*MODEL["step"]
def q(v): x = st.quantiles(v, n=4); return [x[0], st.median(v), x[2]]
out = {}
for p in ("بیوانفورماتیک", "الگوریتم و محاسبات", "علم داده"):
    g = [a for a in adm if a["prog"] == p]
    code = collections.Counter(a["code"] for a in g).most_common(1)[0][0]
    gp = [a["gpa"] for a in g if a["gpa"]]
    out[p] = dict(n=len(g), code=code, rank=q([a["rank"] for a in g]), unis={u: [n, st.median(a["rank"] for a in g if a["uni"] == u)] for u, n in collections.Counter(a["uni"] for a in g).items() if n >= 5},
        yearsN={str(y): sum(1 for a in g if a["year"] == y) for y in range(1400, 1406)},
        years={str(y): [n, st.median(a["rank"] for a in g if a["year"] == y)] for y, n in collections.Counter(a["year"] for a in g).items() if n >= 5},
        box=[st.median(a["p"][j] for a in g) for j in range(6)], spec=st.median(sum(a["p"][2:])/4 for a in g), gpa=q(gp), zeroMath=sum(a["p"][1] <= 0 for a in g)/len(g), zeroLang=sum(a["p"][0] <= 0 for a in g)/len(g),
        need={str(y): need(y, code, st.median(a["rank"] for a in g)) for y in (1403, 1404, 1405)})
json.dump(out, open(os.path.join(HERE, "small_stats.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
for p, d in out.items(): print(p, d["n"], d["code"], [round(x) for x in d["rank"]], d["unis"], d["years"], d["yearsN"], "gpa", [round(x, 1) for x in d["gpa"]], "spec", round(d["spec"]), "zm", round(d["zeroMath"], 2), {k: v and round(v, 1) for k, v in d["need"].items()})
