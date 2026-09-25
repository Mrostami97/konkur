"""Aggregate statistics for articles/top-rank-percentages.mjs.

Input: the merged report-card table (one row per report card) built outside
this repo from the owner's Konkur_answer workbooks and two public result banks;
pass its path in KONKUR_MERGED_CARDS. Only aggregates are printed (medians,
quartiles, counts); nothing identifying is read or written.

Scope: computer engineering master's, 1400-1404, free quota, cards with at
least one in-quota rank. Rank = best in-quota rank over the four codes.
"""
import csv, os, statistics as st

K = ["language", "math", "spec1", "spec2", "spec3", "spec4"]
SPEC = ["spec1", "spec2", "spec3", "spec4"]
rows = []
for r in csv.DictReader(open(os.environ["KONKUR_MERGED_CARDS"], encoding="utf-8-sig")):
    if r["quota"] != "free" or r["best_rank_quota"] == "":
        continue
    rows.append(dict(year=int(r["exam_year"]), best=float(r["best_rank_quota"]), sc={k: float(r[k]) for k in K}))
print("cards used:", len(rows))


def quart(v):
    v = sorted(v)
    q = st.quantiles(v, n=4)
    return round(q[0], 1), round(st.median(v), 1), round(q[2], 1)


by = {}
for r in rows:
    by.setdefault(r["year"], []).append(r)
for y in sorted(by):
    g = [r for r in by[y] if r["best"] <= 100]
    print(y, "cards", len(by[y]), "top100", len(g), {k: round(st.median([r["sc"][k] for r in g]), 1) for k in K})

bands = [(1, 10), (11, 50), (51, 100), (101, 300), (301, 1000), (1001, 10**9)]
for lo, hi in bands:
    g = [r for r in rows if lo <= r["best"] <= hi]
    print(f"band {lo}-{hi} n={len(g)} spec-mean (q1, median, q3) = {quart([st.mean([r['sc'][k] for k in SPEC]) for r in g])}")

top = [r for r in rows if r["best"] <= 100]
top10 = [r for r in rows if r["best"] <= 10]
print("top100 n=", len(top), "math<20:", sum(r["sc"]["math"] < 20 for r in top), "any box<15:", sum(min(r["sc"].values()) < 15 for r in top),
      "language<=5:", sum(r["sc"]["language"] <= 5 for r in top))
print("top10 n=", len(top10), "math<20:", sum(r["sc"]["math"] < 20 for r in top10))
print("weakest box:", {k: sum(min(r["sc"], key=r["sc"].get) == k for r in top) for k in K})
print("strongest box:", {k: sum(max(r["sc"], key=r["sc"].get) == k for r in top) for k in K})
print("weakest is a specialised box:", sum(min(r["sc"], key=r["sc"].get) in SPEC for r in top))
for y in sorted(by):
    g = [st.mean([r["sc"][k] for k in SPEC]) for r in by[y] if r["best"] <= 100]
    print(y, "top100 spec-mean min", round(min(g), 1))
