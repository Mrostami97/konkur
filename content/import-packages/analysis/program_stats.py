"""Per-orientation (program) profile: free quota, daytime, set 1277. Aggregates
only (groups >= 10, medians of >= 5). Writes program_stats.json."""
import collections, json, math, os, statistics as st, sys
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
from adm_loader import load
adm = load()
day = [a for a in adm if a["quota"] == "free" and a["period"] == "روزانه"]
MODEL = json.load(open(os.path.join(HERE, "../../../apps/web/src/content/rank-model-1277.json"), encoding="utf-8"))
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
for prog, n in collections.Counter(a["prog"] for a in day).items():
    if n < 20: continue
    g = [a for a in day if a["prog"] == prog]
    d = dict(n=n, share=n/len(day), rank=q([a["rank"] for a in g]))
    d["code"] = collections.Counter(a["code"] for a in g).most_common(1)[0][0]
    d["unis"] = {u: [len(v), st.median(v)] for u in set(a["uni"] for a in g) if len(v := [a["rank"] for a in g if a["uni"] == u]) >= 5}
    d["years"] = {str(y): [len(v), st.median(v)] for y in range(1400, 1406) if len(v := [a["rank"] for a in g if a["year"] == y]) >= 5}
    d["yearsN"] = {str(y): sum(1 for a in g if a["year"] == y) for y in range(1400, 1406)}
    d["pct"] = [st.median(a["p"][j] for a in g) for j in range(6)]
    d["spec"] = st.median(sum(a["p"][2:])/4 for a in g)
    gp = [a["gpa"] for a in g if a["gpa"]]
    d["gpa"] = dict(n=len(gp), med=st.median(gp), lt16=sum(x < 16 for x in gp)/len(gp), ge19=sum(x >= 19 for x in gp)/len(gp), q=q(gp))
    d["zeroMath"] = sum(a["p"][1] <= 0 for a in g)/len(g); d["zeroLang"] = sum(a["p"][0] <= 0 for a in g)/len(g)
    d["need"] = {str(y): need(y, d["code"], d["rank"][1]) for y in (1403, 1404, 1405)}
    d["nUnis"] = len(set(a["uni"] for a in g)); d["total"] = len(day)
    out[prog] = d
json.dump(out, open(os.path.join(HERE, "program_stats.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print(len(day))
for p, d in sorted(out.items(), key=lambda kv: kv[1]["rank"][1]):
    print(p, d["n"], round(100*d["share"]), "code", d["code"], [round(x) for x in d["rank"]], "nUnis", d["nUnis"])
    print("   unis", {u: (v[0], round(v[1])) for u, v in sorted(d["unis"].items(), key=lambda kv: kv[1][1])})
    print("   years", {y: (v[0], round(v[1])) for y, v in d["years"].items()}, "pct", [round(x) for x in d["pct"]], "spec", round(d["spec"]), "gpa", round(d["gpa"]["med"], 1), round(100*d["gpa"]["lt16"]), round(100*d["gpa"]["ge19"]), "zeroMath", round(100*d["zeroMath"]), "need", {k: v and round(v, 1) for k, v in d["need"].items()})

# --- enrichment: per-university card, rank buckets, 1406 formula, quota 5%, night
TESTS = {1403: [25, 20, 9, 20, 20, 19], 1404: [25, 20, 10, 20, 20, 20]}
def w1406(a):
    T = TESTS[a["year"]]; sp = sum(a["p"][j] * T[j] for j in range(2, 6)) / sum(T[2:])
    return (a["p"][0] + 2 * a["p"][1] + 4 * sp) / 7
BUCKETS = [(1, 100), (101, 300), (301, 600), (601, 100000)]
for prog, d in out.items():
    g = [a for a in day if a["prog"] == prog]
    d["uniCard"] = {u: [len(v), st.median(sum(a["p"][2:]) / 4 for a in v), st.median(a["p"][1] for a in v), st.median(a["p"][0] for a in v)]
                    for u in set(a["uni"] for a in g) if len(v := [a for a in g if a["uni"] == u]) >= 5}
    d["buckets"] = [sum(1 for a in g if lo <= a["rank"] <= hi) for lo, hi in BUCKETS]
    r = [a for a in g if a["year"] in TESTS]
    d["w1406"] = [len(r), st.median(w1406(a) for a in r)] if len(r) >= 10 else None
    q5 = [a for a in adm if a["quota"] == "5_percent" and a["period"] == "روزانه" and a["prog"] == prog]
    d["q5"] = [len(q5), st.median(a["rank"] for a in q5)] if len(q5) >= 5 else None
    nt = [a for a in adm if a["quota"] == "free" and a["period"] == "شبانه" and a["prog"] == prog]
    d["night"] = [len(nt), st.median(a["rank"] for a in nt)] if len(nt) >= 5 else None
    d["specQ"] = [st.quantiles([sum(a["p"][2:]) / 4 for a in g], n=4)[i] for i in (0, 2)]
json.dump(out, open(os.path.join(HERE, "program_stats.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
for p, d in out.items():
    print("\n#", p, "buckets", d["buckets"], "w1406", d["w1406"] and (d["w1406"][0], round(d["w1406"][1], 1)), "q5", d["q5"], "night", d["night"], "specQ", [round(x) for x in d["specQ"]])
    print("   uniCard", {u: (v[0], round(v[1]), round(v[2]), round(v[3])) for u, v in sorted(d["uniCard"].items(), key=lambda kv: -kv[1][1])})
