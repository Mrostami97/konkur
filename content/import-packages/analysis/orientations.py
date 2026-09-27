"""Orientations of set 1277: share of free-quota admissions (all periods) and
daytime median admitted rank per orientation at the four large Tehran
universities (>= 5 cards). Aggregates only (tier B)."""
import csv, collections, os, statistics as st
BASE = os.environ.get("KONKUR_REPORT_CARDS", "D:/competitor-crawler-data/report_cards")
rows = [r for r in csv.DictReader(open(os.path.join(BASE, "out/admissions_parsed.csv"), encoding="utf-8-sig")) if r["quota"] == "free" and r["rank"]]
c = collections.Counter(r["program"] for r in rows)
print("admissions", len(rows)); print([(k, v, f"{100*v/len(rows):.0f}%") for k, v in c.most_common()])
unis = ["صنعتی شریف", "تهران", "امیرکبیر", "علم و صنعت"]
g = collections.defaultdict(list)
for r in rows:
    if r["period"] == "روزانه": g[(r["program"], r["university"])].append(float(r["rank"]))
for p, _ in c.most_common():
    cells = []
    for u in unis:
        v = g.get((p, u), [])
        cells.append(f"{round(st.median(v))} ({len(v)})" if len(v) >= 5 else "—")
    print(p, "|", " | ".join(cells))
