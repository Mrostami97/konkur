"""Typical card and destinations for a rank window (set 1277, free quota, best
in-quota rank over the four codes). Aggregates only: groups >= 10 (>= 5 for
category counts and medians). Writes rank_window_stats.json."""
import os, json, math, statistics as st, sys, collections
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
exec(open(os.path.join(HERE, "skip_subject.py"), encoding="utf-8").read().split("BANDS =")[0])
from adm_loader import load
adm = [a for a in load() if a["quota"] == "free" and a["period"] == "روزانه"]
WIN = {"10": (1, 10, 10), "20": (11, 30, 20), "50": (31, 70, 50), "100": (71, 140, 100), "200": (141, 260, 200), "300": (261, 400, 300), "500": (401, 650, 500), "1000": (800, 1300, 1000)}
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
for key, (lo, hi, center) in WIN.items():
    g = [c for c in cards if lo <= c["best"] <= hi]
    d = dict(lo=lo, hi=hi, center=center, n=len(g))
    d["byYear"] = {str(y): sum(1 for c in g if c["year"] == y) for y in range(1400, 1406)}
    d["box"] = [q([c["p"][j] for c in g]) for j in range(6)]
    d["spec"] = q([sum(c["p"][2:])/4 for c in g])
    d["gpa"] = q([c["gpa"] for c in g])
    d["zeroMath"] = sum(c["p"][1] <= 0 for c in g)/len(g); d["zeroLang"] = sum(c["p"][0] <= 0 for c in g)/len(g)
    d["ge19"] = sum(c["gpa"] >= 19 for c in g)/len(g); d["lt16"] = sum(c["gpa"] < 16 for c in g)/len(g)
    d["bestCode"] = dict(collections.Counter(c["bestCode"] for c in g))
    d["need"] = {code: {str(y): need(y, code, center) for y in range(1400, 1406)} for code in ("2", "4")}
    aa = [a for a in adm if lo <= a["rank"] <= hi]
    d["admN"] = len(aa)
    d["admUni"] = {u: n for u, n in collections.Counter(a["uni"] for a in aa).items() if n >= 5}
    d["admProg"] = {p: n for p, n in collections.Counter(a["prog"] for a in aa).items() if n >= 5}
    d["admPairs"] = {f"{p}|{u}": n for (p, u), n in collections.Counter((a["prog"], a["uni"]) for a in aa).items() if n >= 5}
    out[key] = d
json.dump(out, open(os.path.join(HERE, "rank_window_stats.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
for k, d in out.items():
    print(k, (d["lo"], d["hi"]), "n", d["n"], d["byYear"], "adm", d["admN"], d["admUni"], d["admProg"])
    print("   need2", {y: v and round(v) for y, v in d["need"]["2"].items()}, "gpa", [round(x, 1) for x in d["gpa"]], "spec", [round(x) for x in d["spec"]], "zm", round(100*d["zeroMath"]), "zl", round(100*d["zeroLang"]), "codes", d["bestCode"])
    print("   pairs", d["admPairs"])
