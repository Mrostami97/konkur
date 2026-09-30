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

# --- enrichment: per-subject shift vs previous year, card types, codes, GPA, pairs
TESTS = {1401: [30, 20, 9, 20, 20, 19], 1402: [25, 20, 9, 20, 20, None], 1403: [25, 20, 9, 20, 20, 19], 1404: [25, 20, 10, 20, 20, 20], 1405: [25, 19, 10, 19, 19, 18]}
for y in range(1400, 1406):
    d = out[str(y)]; cs = [c for c in cards if c["year"] == y]
    d["tests"] = TESTS.get(y)
    top = [c for c in cs if c["best"] <= 100]
    if len(top) >= 10:
        both = sum(1 for c in top if c["p"][1] >= 15 and c["p"][0] >= 30); neither = sum(1 for c in top if c["p"][1] < 15 and c["p"][0] < 30)
        d["top100"] = dict(n=len(top), both=both, neither=neither, gpaQ=[st.quantiles([c["gpa"] for c in top], n=4)[i] for i in (0, 2)],
                           ge19=sum(c["gpa"] >= 19 for c in top) / len(top), bestCode=dict(collections.Counter(c["bestCode"] for c in top)),
                           spec=st.median(sum(c["p"][2:]) / 4 for c in top), specQ=[st.quantiles([sum(c["p"][2:]) / 4 for c in top], n=4)[i] for i in (0, 2)])
    mid = [c for c in cs if 101 <= c["best"] <= 1000]
    if len(mid) >= 10:
        d["mid"] = dict(n=len(mid), bestCode=dict(collections.Counter(c["bestCode"] for c in mid)), spec=st.median(sum(c["p"][2:]) / 4 for c in mid))
    if d.get("tests"):
        d["net"] = {k: [round(v["pct"][j] * d["tests"][j] / 100, 1) if d["tests"][j] else None for j in range(6)] for k, v in d["bands"].items()}
    aa = [a for a in adm if a["year"] == y]
    d["adm"]["pairs"] = {f"{p}|{u}": [n, st.median(a["rank"] for a in aa if a["prog"] == p and a["uni"] == u)] for (p, u), n in collections.Counter((a["prog"], a["uni"]) for a in aa).items() if n >= 5}
    d["adm"]["progs"] = {p: [n, st.median(a["rank"] for a in aa if a["prog"] == p)] for p, n in collections.Counter(a["prog"] for a in aa).items() if n >= 5}
for y in range(1401, 1406):
    d, p = out[str(y)], out[str(y - 1)]
    d["shift"] = {k: [round(v["pct"][j] - p["bands"][k]["pct"][j], 1) for j in range(6)] for k, v in d["bands"].items() if k in p["bands"]}
json.dump(out, open(os.path.join(HERE, "year_stats.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
for y in range(1400, 1406):
    d = out[str(y)]
    print("\n##", y, "top100", d.get("top100") and {k: (round(v, 2) if isinstance(v, float) else v) for k, v in d["top100"].items()}, "mid", d.get("mid"))
    print("   shift", d.get("shift")); print("   net", d.get("net")); print("   progs", {k: (v[0], round(v[1])) for k, v in d["adm"]["progs"].items()}); print("   pairs", {k: (v[0], round(v[1])) for k, v in d["adm"]["pairs"].items()})
