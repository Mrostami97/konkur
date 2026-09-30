"""Per coefficient-code profile (set 1277, 1400-1405). Aggregates only; groups
>= 10 (>= 5 for medians/category counts). Writes code_stats.json."""
import os, json, math, statistics as st, sys, collections
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
exec(open(os.path.join(HERE, "skip_subject.py"), encoding="utf-8").read().split("BANDS =")[0])
from adm_loader import load
adm = [a for a in load() if a["quota"] == "free" and a["period"] == "روزانه"]
B = [(1, 100), (101, 300), (301, 1000), (1001, 3000)]
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
top = [c for c in cards if c["best"] <= 3000]
out = {}
for code in "1234":
    d = {"weights": MODEL["weights"][code]}
    g = [c for c in top if c["bestCode"] == code]
    d["nBest"] = len(g); d["nTop"] = len(top)
    d["bandShare"] = {f"{a}-{b}": [sum(1 for c in top if a <= c["best"] <= b and c["bestCode"] == code), sum(1 for c in top if a <= c["best"] <= b)] for a, b in B}
    d["box"] = [q([c["p"][j] for c in g]) for j in range(6)] if len(g) >= 10 else None
    # the others (cards whose best code is a different one), for contrast
    o = [c for c in top if c["bestCode"] != code]
    d["boxOthers"] = [st.median(c["p"][j] for c in o) for j in range(6)]
    # rank of this code relative to the card's best rank
    ratio = [c["ranks"][code]/c["best"] for c in top]
    d["ratio"] = q(ratio)
    d["ratioTop100"] = q([c["ranks"][code]/c["best"] for c in top if c["best"] <= 100])
    d["need"] = {str(r): {str(y): need(y, code, r) for y in range(1400, 1406)} for r in (100, 300, 1000)}
    aa = [a for a in adm if a["code"] == code]
    d["admN"] = len(aa)
    d["admProg"] = {p: [len(v), st.median(v)] for p in set(a["prog"] for a in aa) if len(v := [a["rank"] for a in aa if a["prog"] == p]) >= 5}
    d["admUni"] = {u: [len(v), st.median(v)] for u in set(a["uni"] for a in aa) if len(v := [a["rank"] for a in aa if a["uni"] == u]) >= 5}
    d["admTotal"] = len(adm)
    out[code] = d
json.dump(out, open(os.path.join(HERE, "code_stats.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
for c, d in out.items():
    print(c, d["weights"], "best", d["nBest"], "/", d["nTop"], d["bandShare"], "ratio", [round(x, 2) for x in d["ratio"]], "top100", [round(x, 2) for x in d["ratioTop100"]])
    print("  box", d["box"] and [round(x[1]) for x in d["box"]], "others", [round(x) for x in d["boxOthers"]])
    print("  need", {r: {y: v and round(v) for y, v in ys.items()} for r, ys in d["need"].items()})
    print("  adm", d["admN"], {p: (v[0], round(v[1])) for p, v in d["admProg"].items()}, {u: (v[0], round(v[1])) for u, v in d["admUni"].items()})

# --- enrichment: best-code share per year, card of best-code cards per band, admitted card per orientation
for code in "1234":
    d = out[code]
    d["byYear"] = {str(y): [sum(1 for c in top if c["year"] == y and c["bestCode"] == code), sum(1 for c in top if c["year"] == y)] for y in range(1400, 1406)}
    d["bandCard"] = {}
    for a, b in B:
        g = [c for c in top if a <= c["best"] <= b and c["bestCode"] == code]
        if len(g) >= 10: d["bandCard"][f"{a}-{b}"] = [len(g)] + [st.median(c["p"][j] for c in g) for j in range(6)]
    aa = [a for a in adm if a["code"] == code]
    d["progCard"] = {p: [len(v), st.median(sum(a["p"][2:]) / 4 for a in v), st.median(a["p"][1] for a in v), st.median(a["p"][0] for a in v)] for p in set(a["prog"] for a in aa) if len(v := [a for a in aa if a["prog"] == p]) >= 10}
json.dump(out, open(os.path.join(HERE, "code_stats.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
for c, d in out.items():
    print("\n#", c, "byYear", {y: f"{v[0]}/{v[1]}" for y, v in d["byYear"].items()})
    print("   bandCard", {k: [v[0]] + [round(x) for x in v[1:]] for k, v in d["bandCard"].items()})
    print("   progCard", {p: [v[0]] + [round(x) for x in v[1:]] for p, v in d["progCard"].items()})
