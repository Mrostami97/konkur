"""Admitted students with maths/language at zero or below: by year, orientation,
university (median rank of zero vs non-zero admits), both-zero share. Daytime free
quota, set 1277, 1400-1404. Aggregates only; groups >= 10. Writes zero_stats.json."""
import os, sys, json, statistics as st, collections
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
from adm_loader import load
adm = [a for a in load() if a["quota"] == "free" and a["period"] == "روزانه"]
zm = lambda a: a["p"][1] <= 0; zl = lambda a: a["p"][0] <= 0
out = {"n": len(adm), "both": sum(zm(a) and zl(a) for a in adm), "zm": sum(map(zm, adm)), "zl": sum(map(zl, adm))}
out["byYear"] = {str(y): [len(g), sum(map(zm, g)), sum(map(zl, g)), sum(zm(a) and zl(a) for a in g)] for y in range(1400, 1405) if len(g := [a for a in adm if a["year"] == y]) >= 10}
out["byProg"] = {p: [len(g), sum(map(zm, g)), sum(map(zl, g))] for p in set(a["prog"] for a in adm) if len(g := [a for a in adm if a["prog"] == p]) >= 20}
out["uniRank"] = {}
for u in set(a["uni"] for a in adm):
    g = [a for a in adm if a["uni"] == u]
    z = [a["rank"] for a in g if zm(a)]; nz = [a["rank"] for a in g if not zm(a)]
    if len(z) >= 10 and len(nz) >= 10: out["uniRank"][u] = [len(z), st.median(z), len(nz), st.median(nz)]
z = [a for a in adm if zm(a)]; nz = [a for a in adm if not zm(a)]
out["specZ"] = st.median(sum(a["p"][2:]) / 4 for a in z); out["specNZ"] = st.median(sum(a["p"][2:]) / 4 for a in nz)
json.dump(out, open(os.path.join(HERE, "zero_stats.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print({k: v for k, v in out.items() if k not in ("byProg", "uniRank")}); print(out["byProg"]); print({u: [v[0], round(v[1]), v[2], round(v[3])] for u, v in out["uniRank"].items()})
