"""Per-university profile for the university articles. Aggregates only:
groups >= 10 (>= 5 for medians only). Free quota, daytime unless stated.
Writes uni_stats.json (numbers only) and prints a readable summary."""
import collections, json, statistics as st, sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from adm_loader import load, NAMES
adm = load()
day = [a for a in adm if a["quota"] == "free" and a["period"] == "روزانه"]
def q(v): x = st.quantiles(v, n=4); return [x[0], st.median(v), x[2]]
out = {}
unis = [u for u, n in collections.Counter(a["uni"] for a in day).items() if n >= 10]
for u in unis:
    g = [a for a in day if a["uni"] == u]
    r = [a["rank"] for a in g]
    d = dict(n=len(g), rank=q(r))
    d["years"] = {y: [len(v), st.median(v)] for y in range(1400, 1406) if len(v := [a["rank"] for a in g if a["year"] == y]) >= 5}
    d["yearsN"] = {y: sum(1 for a in g if a["year"] == y) for y in range(1400, 1406)}
    d["progs"] = {p: [len(v), st.median(v)] for p in set(a["prog"] for a in g) if len(v := [a["rank"] for a in g if a["prog"] == p]) >= 5}
    d["progsN"] = dict(collections.Counter(a["prog"] for a in g))
    d["pct"] = [st.median(a["p"][j] for a in g) for j in range(6)]
    d["spec"] = st.median(sum(a["p"][2:]) / 4 for a in g)
    gp = [a["gpa"] for a in g if a["gpa"]]
    d["gpa"] = dict(n=len(gp), med=st.median(gp), lt16=sum(x < 16 for x in gp) / len(gp), ge19=sum(x >= 19 for x in gp) / len(gp), q=q(gp)) if len(gp) >= 10 else None
    d["zeroMath"] = sum(a["p"][1] <= 0 for a in g) / len(g)
    d["zeroLang"] = sum(a["p"][0] <= 0 for a in g) / len(g)
    for per in ("شبانه", "پردیس و خودگردان"):
        v = [a["rank"] for a in adm if a["quota"] == "free" and a["period"] == per and a["uni"] == u]
        if len(v) >= 5: d.setdefault("other", {})[per] = [len(v), st.median(v)]
    v = [a["rank"] for a in adm if a["quota"] == "5_percent" and a["uni"] == u and a["period"] == "روزانه"]
    if len(v) >= 5: d["quota5"] = [len(v), st.median(v)]
    out[u] = d
order = sorted(out, key=lambda u: out[u]["rank"][1])
for i, u in enumerate(order): out[u]["order"] = i + 1
json.dump(out, open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "uni_stats.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
for u in order:
    d = out[u]; print(f"{d['order']:>2} {u} n={d['n']} rank q={[round(x) for x in d['rank']]} years={ {y: (v[0], round(v[1])) for y, v in d['years'].items()} } progs={ {p: (v[0], round(v[1])) for p, v in d['progs'].items()} }")
    print("    pct", [round(x) for x in d["pct"]], "spec", round(d["spec"]), "gpa", d["gpa"] and (round(d["gpa"]["med"], 1), round(100*d["gpa"]["lt16"]), round(100*d["gpa"]["ge19"])), "zeroMath", round(100*d["zeroMath"]), "zeroLang", round(100*d["zeroLang"]), d.get("other"), d.get("quota5"))

# --- weighted average (GPA 17.5) each program's median admitted rank needed, by year, via the public rank model
import math
MODEL = json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "../../../apps/web/src/content/rank-model-1277.json"), encoding="utf-8"))
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
for u, d in out.items():
    g = [a for a in day if a["uni"] == u]
    d["need"] = {}
    for p, (n, m) in d["progs"].items():
        code = collections.Counter(a["code"] for a in g if a["prog"] == p).most_common(1)[0][0]
        d["need"][p] = {"code": code, **{str(y): need(y, code, m) for y in (1403, 1404, 1405)}}
json.dump(out, open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "uni_stats.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
for u in order: print(u, {p: {k: (round(v, 1) if isinstance(v, float) else v) for k, v in nd.items()} for p, nd in out[u]["need"].items()})

# --- enrichment: per-orientation typical card, rank buckets, 1406-formula average (1403-1404)
TESTS = {1403: [25, 20, 9, 20, 20, 19], 1404: [25, 20, 10, 20, 20, 20]}
def w1406(a):
    T = TESTS[a["year"]]; sp = sum(a["p"][j] * T[j] for j in range(2, 6)) / sum(T[2:])
    return (a["p"][0] + 2 * a["p"][1] + 4 * sp) / 7
BUCKETS = [(1, 100), (101, 300), (301, 600), (601, 100000)]
for u, d in out.items():
    g = [a for a in day if a["uni"] == u]
    d["progCard"] = {p: [len(v), st.median(sum(a["p"][2:]) / 4 for a in v), st.median(a["p"][1] for a in v), st.median(a["p"][0] for a in v)]
                     for p in set(a["prog"] for a in g) if len(v := [a for a in g if a["prog"] == p]) >= 5}
    d["buckets"] = [sum(1 for a in g if lo <= a["rank"] <= hi) for lo, hi in BUCKETS]
    r = [a for a in g if a["year"] in TESTS]
    d["w1406"] = [len(r), st.median(w1406(a) for a in r)] if len(r) >= 10 else None
    d["specQ"] = [st.quantiles([sum(a["p"][2:]) / 4 for a in g], n=4)[i] for i in (0, 2)]
json.dump(out, open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "uni_stats.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
for u in order:
    d = out[u]
    print("\n#", u, "buckets", d["buckets"], "w1406", d["w1406"] and (d["w1406"][0], round(d["w1406"][1], 1)), "specQ", [round(x) for x in d["specQ"]])
    print("   progCard", {p: (v[0], round(v[1]), round(v[2]), round(v[3])) for p, v in d["progCard"].items()})
