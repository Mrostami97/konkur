"""Every (orientation, university) pair with >= 5 daytime free-quota admissions,
1400-1404: count and median admitted rank (medians of groups >= 5 only), plus
quartiles when >= 10. Writes pair_stats.json."""
import collections, json, os, statistics as st, sys
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
from adm_loader import load
adm = [a for a in load() if a["quota"] == "free" and a["period"] == "روزانه"]
g = collections.defaultdict(list)
for a in adm: g[(a["prog"], a["uni"])].append(a["rank"])
rows = []
for (p, u), v in g.items():
    if len(v) < 5: continue
    row = dict(prog=p, uni=u, n=len(v), med=st.median(v))
    if len(v) >= 10: x = st.quantiles(v, n=4); row["q1"] = x[0]; row["q3"] = x[2]
    rows.append(row)
rows.sort(key=lambda r: r["med"])
json.dump(dict(total=len(adm), rows=rows), open(os.path.join(HERE, "pair_stats.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print(len(adm), len(rows), sum(r["n"] for r in rows))
for r in rows[:8]: print(r)
