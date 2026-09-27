"""The 5% quota (ایثارگران) against free quota, set 1277. Aggregates only.
Weighted average needed for a rank in each quota and year (public model,
GPA 17.5), card counts, and admissions in the 5% quota."""
import csv, json, math, os, collections, statistics as st
BASE = os.environ.get("KONKUR_REPORT_CARDS", "D:/competitor-crawler-data/report_cards")
HERE = os.path.dirname(os.path.abspath(__file__))
MODEL = json.load(open(os.path.join(HERE, "../../../apps/web/src/content/rank-model-1277.json"), encoding="utf-8"))
def need(year, quota, code, rank):
    y = next((m for m in MODEL["years"] if m["year"] == year and m["quota"] == quota), None)
    if not y: return None
    cv = y["codes"][code]; ln = cv["lnRank"]; t = math.log(rank)
    if t > ln[0] or t < ln[-1]: return None
    for i in range(len(ln) - 1):
        if ln[i] >= t >= ln[i+1]:
            f = 0 if ln[i] == ln[i+1] else (ln[i] - t)/(ln[i] - ln[i+1]); return cv["start"] + (i + f)*MODEL["step"]
def rank_at(year, quota, code, x):
    y = next((m for m in MODEL["years"] if m["year"] == year and m["quota"] == quota), None)
    if not y: return None
    cv = y["codes"][code]; pos = (x - cv["start"])/MODEL["step"]; last = len(cv["lnRank"]) - 1
    if pos < 0 or pos > last: return None
    i = min(int(pos), last - 1); f = pos - i; return math.exp(cv["lnRank"][i]*(1-f) + cv["lnRank"][i+1]*f)
print("cards per year:", [(m["year"], m["quota"], m["cards"]) for m in MODEL["years"]])
for code in ("2", "4"):
    print(f"\ncode {code}: weighted average needed (free / 5%)")
    for rank in (10, 50, 100, 300):
        print(" rank", rank, " ".join(f"{y}: {'-' if need(y,'free',code,rank) is None else round(need(y,'free',code,rank),1)}/{'-' if need(y,'5_percent',code,rank) is None else round(need(y,'5_percent',code,rank),1)}" for y in range(1400, 1405)))
    print(f" rank at the same average (free -> 5%)")
    for x in (25, 30, 35, 40):
        print("  avg", x, " ".join(f"{y}: {'-' if rank_at(y,'free',code,x) is None else round(rank_at(y,'free',code,x))}->{'-' if rank_at(y,'5_percent',code,x) is None else round(rank_at(y,'5_percent',code,x))}" for y in range(1400, 1405)))
rows = [r for r in csv.DictReader(open(os.path.join(BASE, "out/admissions_parsed.csv"), encoding="utf-8-sig")) if r["quota"] == "5_percent" and r["rank"]]
print("\n5% admissions:", len(rows), collections.Counter(r["period"] for r in rows))
g = collections.defaultdict(list)
for r in rows:
    if r["period"] == "روزانه": g[(r["program"], r["university"])].append(float(r["rank"]))
for k, v in sorted(g.items(), key=lambda kv: st.median(kv[1])):
    if len(v) >= 5: print(k, len(v), round(st.median(v)))
