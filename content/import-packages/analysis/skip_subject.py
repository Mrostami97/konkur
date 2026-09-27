"""Which subject can be skipped? Aggregates for the article skip-a-subject.

Reads the per-(card, code) table built by rank-model/cards_by_code.py (raw data
outside the repository; tier B, aggregates only) and the public rank model.
Free quota, set 1277, 1400-1405. A card's band is its best in-quota rank over
the four codes. Prints only counts, shares and medians.
"""
import csv, collections, json, math, os, statistics as st
BASE = os.environ.get("KONKUR_REPORT_CARDS", "D:/competitor-crawler-data/report_cards")
MODEL = json.load(open(os.path.join(os.path.dirname(__file__), "../../../apps/web/src/content/rank-model-1277.json"), encoding="utf-8"))
K = ["language", "math", "spec1", "spec2", "spec3", "spec4"]
NAMES = ["زبان", "ریاضی", "نظریه و سیگنال", "داده، الگوریتم و هوش", "منطقی و معماری", "سیستم عامل، شبکه و پایگاه داده"]
cards = {}
for r in csv.DictReader(open(os.path.join(BASE, "model/cards_by_code.csv"), encoding="utf-8")):
    if r["quota"] != "free": continue
    c = cards.setdefault(r["card"], dict(year=int(r["year"]), gpa=float(r["gpa"]), p=[float(r[k]) for k in K], ranks={}))
    c["ranks"][r["code"]] = float(r["rank"])
cards = [c for c in cards.values() if len(c["ranks"]) == 4]
for c in cards:
    c["best"] = min(c["ranks"].values()); c["bestCode"] = min(c["ranks"], key=c["ranks"].get)
BANDS = [(1, 100), (101, 500), (501, 1000), (1001, 3000), (3001, 20000)]
def band(r): return next(i for i, (a, b) in enumerate(BANDS) if a <= r <= b)
print("cards", len(cards), collections.Counter(c["year"] for c in cards))

print("\n== share of cards with <= 0% / < 10% in each box, by best-rank band ==")
for i, (a, b) in enumerate(BANDS):
    g = [c for c in cards if band(c["best"]) == i]
    row = []
    for j in range(6):
        vals = [c["p"][j] for c in g]
        row.append(f"{NAMES[j]}: <=0 {100*sum(v <= 0 for v in vals)/len(g):.0f}% <10 {100*sum(v < 10 for v in vals)/len(g):.0f}% med {st.median(vals):.1f}")
    print(f"rank {a}-{b} (n={len(g)})"); [print("   ", x) for x in row]

# Counterfactual with the public model: set one box to 0 (if it was above 0) and re-estimate the best code's rank, same year.
def curve_rank(year, code, pcts, gpa):
    y = next((m for m in MODEL["years"] if m["year"] == year and m["quota"] == "free"), None)
    cv = y and y["codes"].get(code)
    if not cv: return None
    w = MODEL["weights"][code]; x = sum(a*b for a, b in zip(w, pcts))/sum(w) + y["gpaShift"]*(gpa - MODEL["gpaRef"])
    pos = (x - cv["start"])/MODEL["step"]; last = len(cv["lnRank"]) - 1
    if pos < 0 or pos > last: return None
    i = min(int(pos), last - 1); t = pos - i
    return math.exp(cv["lnRank"][i]*(1-t) + cv["lnRank"][i+1]*t)
print("\n== rank multiplier when one box is set to 0 (best code, model), median by band ==")
for i, (a, b) in enumerate(BANDS[:4]):
    g = [c for c in cards if band(c["best"]) == i]
    out = []
    for j in range(6):
        mult = []
        for c in g:
            base = curve_rank(c["year"], c["bestCode"], c["p"], c["gpa"])
            if not base or c["p"][j] <= 0: continue
            q = list(c["p"]); q[j] = 0
            new = curve_rank(c["year"], c["bestCode"], q, c["gpa"])
            if new: mult.append(new/base)
        out.append(f"{NAMES[j]}: x{st.median(mult):.2f} (n={len(mult)})" if len(mult) >= 20 else f"{NAMES[j]}: n<20")
    print(f"rank {a}-{b}:", " | ".join(out))

print("\n== top 100: how many boxes at <= 0 per card ==")
g = [c for c in cards if c["best"] <= 100]
print(collections.Counter(sum(v <= 0 for v in c["p"]) for c in g))
print("== top 1000: how many boxes at <= 0 per card ==")
g = [c for c in cards if c["best"] <= 1000]
print(collections.Counter(sum(v <= 0 for v in c["p"]) for c in g), len(g))

print("\n== top 100 and top 500: which boxes are the zero ones ==")
for top in (100, 500):
    g = [c for c in cards if c["best"] <= top]
    combos = collections.Counter(tuple(NAMES[j] for j in range(6) if c["p"][j] <= 0) for c in g)
    print(f"top {top} (n={len(g)}):"); [print("   ", k or "(none)", v) for k, v in combos.most_common(8)]
print("\n== share with math <= 0 among top 100, by year ==")
for y in sorted({c["year"] for c in cards}):
    g = [c for c in cards if c["best"] <= 100 and c["year"] == y]
    if g: print(y, len(g), f"{100*sum(c['p'][1] <= 0 for c in g)/len(g):.0f}%")
