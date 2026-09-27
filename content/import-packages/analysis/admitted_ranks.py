"""Table of admitted-ranks-by-university: free quota, daytime, pairs with >= 10
cards. Reads report_cards/out/admissions_parsed.csv (tier B, aggregates only).
Prints the article's rows with Persian digits; quartiles = statistics.quantiles
(exclusive), last column = highest rank seen in 1403-1404."""
import csv, collections, os, statistics as st, json
BASE = os.environ.get("KONKUR_REPORT_CARDS", "D:/competitor-crawler-data/report_cards")
FA = str.maketrans("0123456789", "۰۱۲۳۴۵۶۷۸۹")
NAME = {"تهران": "دانشگاه تهران"}
rows = [r for r in csv.DictReader(open(os.path.join(BASE, "out/admissions_parsed.csv"), encoding="utf-8-sig"))
        if r["quota"] == "free" and r["period"] == "روزانه" and r["rank"]]
g = collections.defaultdict(list)
for r in rows: g[(r["program"], r["university"])].append((int(r["year"]), float(r["rank"])))
out = []
for (p, u), v in g.items():
    if len(v) < 10: continue
    ranks = [x for _, x in v]; q = st.quantiles(ranks, n=4); recent = [x for y, x in v if y >= 1403]
    out.append((st.median(ranks), [f"{p} {NAME.get(u, u)}", str(len(v)), str(round(st.median(ranks))), f"{round(q[0])} تا {round(q[2])}", str(round(max(recent))) if recent else "—"]))
out.sort(key=lambda t: t[0])
print("daytime free admissions:", len(rows), "pairs:", len(out))
print(json.dumps([[c.translate(FA) for c in r] for _, r in out], ensure_ascii=False, indent=0))
