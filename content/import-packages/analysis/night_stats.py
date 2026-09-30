"""Night and parallel (پردیس و خودگردان) admissions, free quota, set 1277, 1400-1404,
against daytime admissions of the same university. Aggregates only: groups >= 10
(>= 5 medians/counts). Writes night_stats.json."""
import collections, json, math, os, statistics as st, sys
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
from adm_loader import load
MODEL = json.load(open(os.path.join(HERE, "../../../apps/web/src/content/rank-model-1277.json"), encoding="utf-8"))
allm = [a for a in load() if a["quota"] == "free"]
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
def prof(g):
    gp = [a["gpa"] for a in g if a["gpa"]]
    return dict(n=len(g), rank=q([a["rank"] for a in g]), box=[st.median(a["p"][j] for a in g) for j in range(6)], spec=st.median(sum(a["p"][2:])/4 for a in g),
                gpa=st.median(gp) if len(gp) >= 10 else None, zeroMath=sum(a["p"][1] <= 0 for a in g)/len(g), zeroLang=sum(a["p"][0] <= 0 for a in g)/len(g))
out = {}
for per in ("روزانه", "شبانه", "پردیس و خودگردان"):
    g = [a for a in allm if a["period"] == per]
    out[per] = prof(g)
    out[per]["unis"] = {u: prof([a for a in g if a["uni"] == u]) | {"rankMed": st.median(a["rank"] for a in g if a["uni"] == u)} for u in set(a["uni"] for a in g) if sum(1 for a in g if a["uni"] == u) >= 10}
    out[per]["years"] = {str(y): sum(1 for a in g if a["year"] == y) for y in range(1400, 1406)}
    out[per]["progs"] = {p: [n, st.median(a["rank"] for a in g if a["prog"] == p)] for p, n in collections.Counter(a["prog"] for a in g).items() if n >= 5}
# same-university day comparison for universities that have night or parallel admissions with >= 10 cards
out["compare"] = {}
for per in ("شبانه", "پردیس و خودگردان"):
    for u, v in out[per]["unis"].items():
        d = [a for a in allm if a["period"] == "روزانه" and a["uni"] == u]
        n_ = [a for a in allm if a["period"] == per and a["uni"] == u]
        if len(d) >= 10:
            out["compare"][f"{u}|{per}"] = dict(nDay=len(d), rankDay=st.median(a["rank"] for a in d), nNight=len(n_), rankNight=st.median(a["rank"] for a in n_),
                specDay=st.median(sum(a["p"][2:])/4 for a in d), specNight=st.median(sum(a["p"][2:])/4 for a in n_), mathZeroDay=sum(a["p"][1] <= 0 for a in d)/len(d), mathZeroNight=sum(a["p"][1] <= 0 for a in n_)/len(n_))
json.dump(out, open(os.path.join(HERE, "night_stats.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
for per in ("روزانه", "شبانه", "پردیس و خودگردان"):
    d = out[per]; print(per, d["n"], [round(x) for x in d["rank"]], "spec", round(d["spec"]), "gpa", d["gpa"] and round(d["gpa"], 1), "zm", round(d["zeroMath"], 2), {u: (v["n"], round(v["rankMed"])) for u, v in d["unis"].items()}, d["years"], d["progs"])
print(out["compare"])

# --- enrichment: night per (orientation, university), per year, card per university
ng = [a for a in allm if a["period"] == "شبانه"]
out["nightPairs"] = {f"{p}|{u}": [n, st.median(a["rank"] for a in ng if a["prog"] == p and a["uni"] == u)] for (p, u), n in collections.Counter((a["prog"], a["uni"]) for a in ng).items() if n >= 5}
out["dayPairs"] = {}
for k in out["nightPairs"]:
    p, u = k.split("|"); d = [a["rank"] for a in allm if a["period"] == "روزانه" and a["prog"] == p and a["uni"] == u]
    if len(d) >= 5: out["dayPairs"][k] = [len(d), st.median(d)]
out["nightYears"] = {str(y): sum(1 for a in ng if a["year"] == y) for y in range(1400, 1405)}
out["nightCard"] = {u: [len(v), st.median(sum(a["p"][2:]) / 4 for a in v), st.median(a["p"][1] for a in v), st.median(a["p"][0] for a in v), st.median(a["gpa"] for a in v if a["gpa"])] for u in set(a["uni"] for a in ng) if len(v := [a for a in ng if a["uni"] == u]) >= 10}
json.dump(out, open(os.path.join(HERE, "night_stats.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print(out["nightPairs"]); print(out["dayPairs"]); print(out["nightYears"]); print({u: [v[0]] + [round(x, 1) for x in v[1:]] for u, v in out["nightCard"].items()})
