"""Typical card of 5%-quota candidates by best in-quota rank band, next to the
same bands of the free quota (set 1277, 1400-1405). Aggregates only: groups >= 10.
Writes quota5_cards_stats.json."""
import csv, os, json, statistics as st, collections
BASE = os.environ.get("KONKUR_REPORT_CARDS", "D:/competitor-crawler-data/report_cards")
K = ["language", "math", "spec1", "spec2", "spec3", "spec4"]
cards = {}
for r in csv.DictReader(open(os.path.join(BASE, "model/cards_by_code.csv"), encoding="utf-8")):
    if r["quota"] not in ("5_percent", "free"): continue
    c = cards.setdefault((r["card"], r["quota"]), dict(quota=r["quota"], year=int(r["year"]), gpa=float(r["gpa"]), p=[float(r[k]) for k in K], ranks={}))
    c["ranks"][r["code"]] = float(r["rank"])
cards = [c for c in cards.values() if len(c["ranks"]) == 4]
for c in cards:
    c["best"] = min(c["ranks"].values()); c["spec"] = sum(c["p"][2:]) / 4
def q(v): x = st.quantiles(v, n=4); return [x[0], st.median(v), x[2]]
B = [(1, 10), (11, 30), (31, 100), (101, 300), (301, 1000)]
out = {"byYear": dict(collections.Counter(c["year"] for c in cards if c["quota"] == "5_percent"))}
for quota in ("5_percent", "free"):
    cs = [c for c in cards if c["quota"] == quota]
    d = {"n": len(cs), "bands": {}}
    for a, b in B:
        g = [c for c in cs if a <= c["best"] <= b]
        if len(g) < 10: d["bands"][f"{a}-{b}"] = dict(n=len(g)); continue
        d["bands"][f"{a}-{b}"] = dict(n=len(g), box=[q([c["p"][j] for c in g]) for j in range(6)], spec=q([c["spec"] for c in g]), gpa=q([c["gpa"] for c in g]),
                                      zeroMath=sum(c["p"][1] <= 0 for c in g) / len(g), zeroLang=sum(c["p"][0] <= 0 for c in g) / len(g))
    out[quota] = d
json.dump(out, open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "quota5_cards_stats.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
for quota in ("5_percent", "free"):
    print(quota, out[quota]["n"])
    for k, v in out[quota]["bands"].items(): print("  ", k, v["n"], v.get("spec") and [round(x) for x in v["spec"]], v.get("gpa") and [round(x, 1) for x in v["gpa"]], v.get("box") and [round(x[1]) for x in v["box"]], v.get("zeroMath") and round(v["zeroMath"], 2))
