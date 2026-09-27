"""One row per (card, code): year, quota, gpa, six percentages, in-quota rank.

Same grouping as merge.py (fingerprint = year, GPA, six percentages); within a
group each code's rank is the median over sources, which absorbs the ~400 rank
typos between banks. Owner workbook rows join a group but carry no quota, so an
owner-only card (quota unknown) is left out. Output: model/cards_by_code.csv
"""
import csv, sqlite3, hashlib, collections, json, statistics, os
os.chdir(os.path.dirname(os.path.abspath(__file__)) + "/..")
K = ["language", "math", "spec1", "spec2", "spec3", "spec4"]
f = lambda v: None if v in ("", None) else float(v)
def fp(year, gpa, sc):
    key = [str(year), f"{gpa:.2f}" if gpa is not None else "None", *[f"{sc[k]:.2f}" if sc.get(k) is not None else "None" for k in K]]
    return hashlib.sha1("|".join(key).encode()).hexdigest()[:16]
groups = collections.defaultdict(list)
for r in csv.DictReader(open("out/report_cards.csv", encoding="utf-8-sig")):
    groups[r["fingerprint"]].append(dict(year=int(r["exam_year"]), quota=r["quota"], gpa=f(r["gpa"]),
        sc={k: f(r[k]) for k in K}, ranks=[f(r[f"code{i}_rank_quota"]) for i in range(1, 5)]))
c = sqlite3.connect("file:C:/Users/Error/Downloads/konkur_results_v41.sqlite?mode=ro", uri=True)
KEYS = {"language": "language", "math": "math", "specialized_1": "spec1", "specialized_2": "spec2", "specialized_3": "spec3", "specialized_4": "spec4"}
for rid, y, g in c.execute("select r.id, r.exam_year_shamsi, r.effective_gpa from result_records r join source_pages p on p.id=r.source_page_id where p.source_id=4 and r.duplicate_of_result_id is null and r.quality_status='verified'").fetchall():
    sc = {KEYS[k]: v for k, v in c.execute("select subject_key, percentage from subject_scores where result_id=?", (rid,)) if k in KEYS}
    if len(sc) < 6: continue
    ranks = [rn for _, rn in c.execute("select coefficient_code, rank_national from rankings where result_id=? order by coefficient_code", (rid,))]
    if len(ranks) != 4: continue
    groups[fp(y, g, sc)].append(dict(year=y, quota=None, gpa=g, sc=sc, ranks=ranks))
for r in json.load(open("out/tg1405_cards_clean.json", encoding="utf-8")):
    if r["set"] != 1277: continue
    note = r.get("note", "")
    if "cut off" in note or "hidden" in note: continue
    sc = {k: (r[k] if r.get(k) is not None else 0.0) for k in K}
    groups[fp(1405, r.get("gpa"), sc)].append(dict(year=1405, quota=r["quota"], gpa=r.get("gpa"), sc=sc, ranks=r["rank_quota"]))
rows = []
for key, g in groups.items():
    quotas = [r["quota"] for r in g if r["quota"] and r["quota"] != "unknown"]
    if not quotas: continue
    quota = collections.Counter(quotas).most_common(1)[0][0]
    base = g[0]
    if base["gpa"] is None or any(base["sc"][k] is None for k in K): continue
    for code in range(4):
        vals = [r["ranks"][code] for r in g if len(r["ranks"]) > code and r["ranks"][code] and r["ranks"][code] > 0]
        if not vals: continue
        rows.append(dict(card=key, year=base["year"], quota=quota, code=code + 1, gpa=base["gpa"], **base["sc"], rank=statistics.median(vals)))
with open("model/cards_by_code.csv", "w", encoding="utf-8", newline="") as fh:
    w = csv.DictWriter(fh, fieldnames=list(rows[0].keys())); w.writeheader(); w.writerows(rows)
cnt = collections.Counter((r["year"], r["quota"]) for r in rows if r["code"] == 2)
for k in sorted(cnt): print(k, cnt[k])
