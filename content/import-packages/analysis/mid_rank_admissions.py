"""Where ranks 300-1000 were admitted: university-program pairs (daytime and
night separately) with >= 5 free-quota cards and median rank >= 250.
Aggregates only (tier B): counts and medians, no single ranks."""
import csv, collections, os, statistics as st
BASE = os.environ.get("KONKUR_REPORT_CARDS", "D:/competitor-crawler-data/report_cards")
rows = [r for r in csv.DictReader(open(os.path.join(BASE, "out/admissions_parsed.csv"), encoding="utf-8-sig")) if r["quota"] == "free" and r["rank"]]
g = collections.defaultdict(list)
for r in rows: g[(r["program"], r["university"], r["period"], r["code"])].append((int(r["year"]), float(r["rank"])))
out = []
for k, v in g.items():
    ranks = [x for _, x in v]
    if len(v) >= 5 and st.median(ranks) >= 250 and k[2] in ("روزانه", "شبانه"):
        q = st.quantiles(ranks, n=4)
        out.append((st.median(ranks), k, len(v), round(q[0]), round(q[2]), sorted({y for y, _ in v})))
out.sort()
for med, (p, u, per, code), n, q1, q3, ys in out:
    print(f"{p} | {u} | {per} | code {code} | n {n} | median {med:.0f} | IQR {q1}-{q3} | years {ys[0]}-{ys[-1]}")
band = [r for r in rows if 300 <= float(r["rank"]) <= 1000]
print("\nadmissions with rank 300-1000:", len(band), dict(collections.Counter(r["period"] for r in band)))
print("universities (daytime):", collections.Counter(r["university"] for r in band if r["period"] == "روزانه").most_common(20))
