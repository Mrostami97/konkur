"""Per-year profile of the master's computer engineering exam (set 1277, free
quota). Aggregates only: groups >= 10 (>= 5 medians). Writes year_stats.json."""
import os, json, math, statistics as st, sys, collections
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
exec(open(os.path.join(HERE, "skip_subject.py"), encoding="utf-8").read().split("BANDS =")[0])
from adm_loader import load
adm = [a for a in load() if a["quota"] == "free" and a["period"] == "روزانه"]
B = [(1, 30), (31, 100), (101, 300), (301, 1000), (1001, 3000)]
RANKS = [10, 30, 50, 100, 200, 300, 500, 1000, 1500, 2000, 3000]
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
out = {}
for y in range(1400, 1406):
    cs = [c for c in cards if c["year"] == y]
    d = {"n": len(cs), "nTop3000": sum(1 for c in cs if c["best"] <= 3000)}
    d["bands"] = {}
    for a, b in B:
        g = [c for c in cs if a <= c["best"] <= b]
        if len(g) < 10: continue
        d["bands"][f"{a}-{b}"] = dict(n=len(g), pct=[st.median(c["p"][j] for c in g) for j in range(6)], gpa=st.median(c["gpa"] for c in g),
                                       zeroMath=sum(c["p"][1] <= 0 for c in g)/len(g), zeroLang=sum(c["p"][0] <= 0 for c in g)/len(g))
    d["need"] = {code: {str(r): need(y, code, r) for r in RANKS} for code in ("1", "2", "3", "4")}
    aa = [a for a in adm if a["year"] == y]
    d["adm"] = dict(n=len(aa), median=st.median(a["rank"] for a in aa) if aa else None,
                    unis={u: [len(v), st.median(v)] for u in set(a["uni"] for a in aa) if len(v := [a["rank"] for a in aa if a["uni"] == u]) >= 5})
    out[str(y)] = d
json.dump(out, open(os.path.join(HERE, "year_stats.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
for y, d in out.items():
    print(y, "cards", d["n"], "top3000", d["nTop3000"], "adm", d["adm"]["n"], d["adm"]["median"] and round(d["adm"]["median"]))
    print("  need code2:", {r: v and round(v, 1) for r, v in d["need"]["2"].items()})
    print("  need code4:", {r: v and round(v, 1) for r, v in d["need"]["4"].items()})
    for k, v in d["bands"].items(): print("  ", k, v["n"], [round(x) for x in v["pct"]], "gpa", round(v["gpa"], 1), "zm", round(100*v["zeroMath"]), "zl", round(100*v["zeroLang"]))
    print("  adm unis", {u: (v[0], round(v[1])) for u, v in d["adm"]["unis"].items()})
