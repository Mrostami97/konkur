"""Aggregate statistics for articles/top-rank-percentages.mjs.

Reads the owner's private report-card database read-only and prints only
aggregates (medians, quartiles, counts). The database is not in this repo; pass
its path in KONKUR_RESULTS_DB. Nothing identifying is printed or written.
"""
import os, sqlite3, statistics as st, json
c = sqlite3.connect(f"file:{os.environ['KONKUR_RESULTS_DB']}?mode=ro", uri=True)
KEYS = {"language": "language", "math": "math", "spec1": "spec1", "spec2": "spec2", "spec3": "spec3", "spec4": "spec4",
        "specialized_1": "spec1", "specialized_2": "spec2", "specialized_3": "spec3", "specialized_4": "spec4"}
rows = c.execute("""select r.id, r.exam_year_shamsi, r.quota, p.source_id, r.effective_gpa from result_records r
  join source_pages p on p.id = r.source_page_id
  where r.duplicate_of_result_id is null and r.quality_status = 'verified' and r.degree_level = 'master' and r.exam_domain = 'computer_engineering'""").fetchall()
recs = []
bad = 0
for rid, year, quota, src, gpa in rows:
    sc = {KEYS[k]: v for k, v in c.execute("select subject_key, percentage from subject_scores where result_id=?", (rid,)) if k in KEYS and v is not None}
    if len(sc) < 6: continue
    if any(v < -33.34 or v > 100.001 for v in sc.values()): bad += 1; continue
    rk = c.execute("select coefficient_code, rank_quota, rank_national from rankings where result_id=?", (rid,)).fetchall()
    owner = src == 4
    # Owner workbooks record the rank without quota; competitor rows record the rank within quota.
    ranks = [(rn if owner else rq) for _, rq, rn in rk]
    ranks = [r for r in ranks if r is not None and r > 0]
    if not ranks: continue
    if not owner and quota not in ("free",): continue  # competitor rows: free quota only, so ranks are comparable
    recs.append(dict(year=year, owner=owner, best=min(ranks), sc=sc, gpa=gpa))
print("records used:", len(recs), "out of range dropped:", bad)
by = {}
for r in recs: by.setdefault(r["year"], []).append(r)
for y in sorted(by): print(y, "n=", len(by[y]), "owner" if by[y][0]["owner"] else "competitor", "best<=100:", sum(r["best"] <= 100 for r in by[y]))
bands = [(1, 10), (11, 50), (51, 100), (101, 300), (301, 1000), (1001, 10**9)]
def q(v):
    v = sorted(v); n = len(v)
    if n < 5: return None
    return (round(st.quantiles(v, n=4)[0], 1), round(st.median(v), 1), round(st.quantiles(v, n=4)[2], 1))
out = {}
for y in sorted(by):
    for lo, hi in bands:
        g = [r for r in by[y] if lo <= r["best"] <= hi]
        if len(g) < 8: continue
        out[f"{y}:{lo}-{hi}"] = dict(n=len(g), **{k: q([r["sc"][k] for r in g]) for k in ["language", "math", "spec1", "spec2", "spec3", "spec4"]})
for k, v in out.items(): print(k, v)
# Pooled top-100 across years, and "one weak box" share.
top = [r for r in recs if r["best"] <= 100]
print("pooled top100 n=", len(top), {k: q([r["sc"][k] for r in top]) for k in ["language", "math", "spec1", "spec2", "spec3", "spec4"]})
print("top100 with math < 20:", sum(r["sc"]["math"] < 20 for r in top), " with any box < 15:", sum(min(r["sc"].values()) < 15 for r in top))
top10 = [r for r in recs if r["best"] <= 10]
print("top10 n=", len(top10), " math<20:", sum(r["sc"]["math"] < 20 for r in top10), " any box<15:", sum(min(r["sc"].values()) < 15 for r in top10))
print("---- extra")
K = ["language", "math", "spec1", "spec2", "spec3", "spec4"]
for y in sorted(by):
    g = [r for r in by[y] if r["best"] <= 100]
    print(y, "top100 n=", len(g), {k: (round(st.median([r["sc"][k] for r in g]), 1)) for k in K},
          "strongest box counts:", {k: sum(max(r["sc"], key=r["sc"].get) == k for r in g) for k in K})
print("top100 language<=5:", sum(r["sc"]["language"] <= 5 for r in top), "of", len(top))
print("top100 strongest box overall:", {k: sum(max(r["sc"], key=r["sc"].get) == k for r in top) for k in K})
print("top100 weakest box overall:", {k: sum(min(r["sc"], key=r["sc"].get) == k for r in top) for k in K})
# Mean of the four specialised boxes, by band, pooled; shows the gradient.
for lo, hi in bands:
    g = [r for r in recs if lo <= r["best"] <= hi]
    sp = [st.mean([r["sc"][k] for k in ["spec1", "spec2", "spec3", "spec4"]]) for r in g]
    print(f"band {lo}-{hi} n={len(g)} spec-mean median={round(st.median(sp),1)} q1={round(st.quantiles(sp,n=4)[0],1)} q3={round(st.quantiles(sp,n=4)[2],1)}")
# Minimum specialised mean seen among top-100, per year (a floor, not a guarantee).
for y in sorted(by):
    g = [st.mean([r["sc"][k] for k in ["spec1","spec2","spec3","spec4"]]) for r in by[y] if r["best"] <= 100]
    print(y, "top100 spec-mean min", round(min(g),1), "p10", round(sorted(g)[max(0,len(g)//10-1)],1))
