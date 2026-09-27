"""What percentages got people into each university-program? Aggregates only.

Joins each admission in the public result banks (parsed with
report_cards/admissions.py) to the card's percentages, free quota, daytime.
For each pair with >= 10 cards: the median admitted rank, and the weighted
average that rank needed in each year (inverse of the public rank model's
curve at GPA 17.5). Raw rows stay outside the repository (tier B).
"""
import csv, collections, json, math, os, statistics as st
BASE = os.environ.get("KONKUR_REPORT_CARDS", "D:/competitor-crawler-data/report_cards")
HERE = os.path.dirname(os.path.abspath(__file__))
MODEL = json.load(open(os.path.join(HERE, "../../../apps/web/src/content/rank-model-1277.json"), encoding="utf-8"))
src = open(os.path.join(BASE, "admissions.py"), encoding="utf-8").read().split("f = lambda v")[0]
cwd = os.getcwd(); os.chdir(BASE); ns = {}; exec(src, ns); os.chdir(cwd)
parse = ns["parse"]
K = ["language", "math", "spec1", "spec2", "spec3", "spec4"]
seen, adm = set(), []
for r in csv.DictReader(open(os.path.join(BASE, "out/report_cards.csv"), encoding="utf-8-sig")):
    p = parse(r["admission_raw"])
    if not p or p[0] is None or p[1] is None: continue
    (prog, code), uni, period, _ = p
    key = (r["fingerprint"], prog, uni, period)
    if key in seen: continue
    seen.add(key)
    rank = r[f"code{code}_rank_quota"]
    if r["quota"] != "free" or period != "روزانه" or not rank or any(r[k] == "" for k in K): continue
    adm.append(dict(year=int(r["exam_year"]), prog=prog, code=str(code), uni=uni, rank=float(rank), p=[float(r[k]) for k in K], gpa=float(r["gpa"]) if r["gpa"] else None))

def need(year, code, rank):
    """Weighted average (GPA 17.5) whose model rank equals `rank` that year."""
    y = next((m for m in MODEL["years"] if m["year"] == year and m["quota"] == "free"), None)
    cv = y and y["codes"].get(code)
    if not cv: return None
    target = math.log(rank); ln = cv["lnRank"]
    if target > ln[0] or target < ln[-1]: return None
    for i in range(len(ln) - 1):
        if ln[i] >= target >= ln[i+1]:
            t = 0 if ln[i] == ln[i+1] else (ln[i] - target)/(ln[i] - ln[i+1])
            return cv["start"] + (i + t)*MODEL["step"]

groups = collections.defaultdict(list)
for a in adm: groups[(a["prog"], a["uni"], a["code"])].append(a)
years = [1400, 1401, 1402, 1403, 1404, 1405]
rows = []
for (prog, uni, code), g in groups.items():
    if len(g) < 10: continue
    med = st.median(a["rank"] for a in g)
    spec = st.median(st.mean(a["p"][2:]) for a in g)
    rows.append((med, prog, uni, code, len(g), [need(y, code, med) for y in years], spec,
                 st.median(a["p"][1] for a in g), st.median(a["p"][0] for a in g),
                 sum(a["p"][1] <= 0 for a in g)/len(g)))
rows.sort()
print("pair | code | n | median rank | weighted avg needed for that rank in 1400..1405 | admitted median: spec-mean, math, language | math<=0")
for med, prog, uni, code, n, needs, spec, math_, lang, mz in rows:
    ns_ = " ".join("  -  " if v is None else f"{v:5.1f}" for v in needs)
    print(f"{prog} {uni} | {code} | {n} | {med:.0f} | {ns_} | {spec:.1f} {math_:.1f} {lang:.1f} | {100*mz:.0f}%")
print("\nadmissions joined:", len(adm), "pairs:", len(rows))
