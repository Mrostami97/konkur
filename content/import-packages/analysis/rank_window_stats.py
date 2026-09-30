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

# --- enrichment: per-year typical card, 1404 net tests, card types early vs late, top programs
T1404 = [25, 20, 10, 20, 20, 20]
for key, d in out.items():
    lo, hi = d["lo"], d["hi"]
    g = [c for c in cards if lo <= c["best"] <= hi]
    d["perYear"] = {str(y): [len(v), st.median(sum(c["p"][2:]) / 4 for c in v), st.median(c["p"][1] for c in v), st.median(c["p"][0] for c in v), st.median(c["gpa"] for c in v)]
                    for y in range(1400, 1406) if len(v := [c for c in g if c["year"] == y]) >= 10}
    v4 = [c for c in g if c["year"] == 1404]
    d["net1404"] = [len(v4), [round(st.median(c["p"][j] for c in v4) * T1404[j] / 100, 1) for j in range(6)]] if len(v4) >= 10 else None
    for name, yrs in (("early", range(1400, 1404)), ("late", (1404, 1405))):
        v = [c for c in g if c["year"] in yrs]
        d[name] = [len(v), sum(c["p"][1] >= 15 and c["p"][0] >= 30 for c in v), sum(c["p"][1] < 15 and c["p"][0] < 30 for c in v)] if len(v) >= 10 else None
json.dump(out, open(os.path.join(HERE, "rank_window_stats.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
for k, d in out.items():
    print("\n#", k, d["lo"], d["hi"], "n", d["n"], "early", d["early"], "late", d["late"], "net1404", d["net1404"])
    print("   perYear", {y: (v[0], round(v[1]), round(v[2]), round(v[3]), round(v[4], 1)) for y, v in d["perYear"].items()})
    print("   need2", {y: v and round(v) for y, v in d["need"]["2"].items()}, "spec", [round(x) for x in d["spec"]], "gpa", [round(x, 1) for x in d["gpa"]], "zm", round(100*d["zeroMath"]), "zl", round(100*d["zeroLang"]), "ge19", round(100*d["ge19"]), "lt16", round(100*d["lt16"]))
    print("   progs", d["admProg"], "unis", d["admUni"])
