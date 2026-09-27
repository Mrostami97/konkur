"""Daytime vs night-course (شبانه) vs campus admissions. Aggregates only.

Reads report_cards/out/admissions_parsed.csv (free quota, set 1277,
1400-1404; tier B). Prints per-period counts and rank quartiles, and for each
university-program with >= 5 cards in daytime and in another period, both
medians and their ratio.
"""
import csv, collections, os, statistics as st
BASE = os.environ.get("KONKUR_REPORT_CARDS", "D:/competitor-crawler-data/report_cards")
rows = [r for r in csv.DictReader(open(os.path.join(BASE, "out/admissions_parsed.csv"), encoding="utf-8-sig")) if r["quota"] == "free" and r["rank"]]
per = collections.defaultdict(list)
for r in rows: per[r["period"]].append(float(r["rank"]))
for k, v in per.items():
    q = st.quantiles(v, n=4) if len(v) >= 4 else [0, 0, 0]
    print(k, len(v), "median", round(st.median(v)), "IQR", round(q[0]), round(q[2]))
g = collections.defaultdict(lambda: collections.defaultdict(list))
for r in rows: g[(r["program"], r["university"])][r["period"]].append(float(r["rank"]))
print("\npair | daytime n, median | other period n, median | ratio")
ratios = []
for (p, u), d in g.items():
    day = d.get("روزانه", [])
    for per_, v in d.items():
        if per_ == "روزانه" or len(day) < 5 or len(v) < 5: continue
        ratio = st.median(v)/st.median(day); ratios.append(ratio)
        print(f"{p} {u} | {len(day)}, {st.median(day):.0f} | {per_} {len(v)}, {st.median(v):.0f} | {ratio:.2f}")
print("median ratio", round(st.median(ratios), 2), "range", round(min(ratios), 2), round(max(ratios), 2))
