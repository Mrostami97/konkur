"""The 1405 exam through its report cards, against 1404. Aggregates only.

Set 1277 from the per-(card, code) table (free quota); set 1276 from the 1405
image cards (out/tg1405_cards_clean.json). Raw data outside the repo (tier B).
"""
import csv, json, math, os, collections, statistics as st
BASE = os.environ.get("KONKUR_REPORT_CARDS", "D:/competitor-crawler-data/report_cards")
HERE = os.path.dirname(os.path.abspath(__file__))
MODEL = json.load(open(os.path.join(HERE, "../../../apps/web/src/content/rank-model-1277.json"), encoding="utf-8"))
K = ["language", "math", "spec1", "spec2", "spec3", "spec4"]
NAMES = ["زبان", "ریاضی", "نظریه و سیگنال", "داده، الگوریتم و هوش", "منطقی و معماری", "سیستم عامل، شبکه و پایگاه داده"]
cards = {}
for r in csv.DictReader(open(os.path.join(BASE, "model/cards_by_code.csv"), encoding="utf-8")):
    if r["quota"] != "free": continue
    c = cards.setdefault(r["card"], dict(year=int(r["year"]), gpa=float(r["gpa"]), p=[float(r[k]) for k in K], ranks={}))
    c["ranks"][r["code"]] = float(r["rank"])
cards = [c for c in cards.values() if len(c["ranks"]) == 4]
for c in cards: c["best"] = min(c["ranks"].values())
BANDS = [(1, 10), (11, 50), (51, 100), (101, 330)]
print("== 1277 free: median percent per box by best-rank band, 1404 vs 1405 ==")
for a, b in BANDS:
    for y in (1404, 1405):
        g = [c for c in cards if c["year"] == y and a <= c["best"] <= b]
        if len(g) < 5: print(f"{a}-{b} {y} n={len(g)} (too few)"); continue
        print(f"{a}-{b} {y} n={len(g)} | " + " | ".join(f"{NAMES[j]} {st.median(c['p'][j] for c in g):.1f}" for j in range(6)) + f" | gpa {st.median(c['gpa'] for c in g):.2f}")
print("\n== <= 0 shares among best rank <= 100 ==")
for y in (1403, 1404, 1405):
    g = [c for c in cards if c["year"] == y and c["best"] <= 100]
    print(y, len(g), " | ".join(f"{NAMES[j]} {100*sum(c['p'][j] <= 0 for c in g)/len(g):.0f}%" for j in range(6)))
def need(year, code, rank):
    y = next(m for m in MODEL["years"] if m["year"] == year and m["quota"] == "free"); cv = y["codes"][code]; ln = cv["lnRank"]; t = math.log(rank)
    if t > ln[0] or t < ln[-1]: return None
    for i in range(len(ln) - 1):
        if ln[i] >= t >= ln[i+1]:
            f = 0 if ln[i] == ln[i+1] else (ln[i] - t)/(ln[i] - ln[i+1]); return cv["start"] + (i + f)*MODEL["step"]
print("\n== weighted average (GPA 17.5) needed for a rank, by year and code ==")
for code in ("2", "4", "3", "1"):
    for rank in (5, 10, 30, 100, 200, 300):
        print("code", code, "rank", rank, " ".join(f"{y}:{'-' if need(y, code, rank) is None else round(need(y, code, rank), 1)}" for y in (1402, 1403, 1404, 1405)))
print("\n1405 free cards:", sum(c["year"] == 1405 for c in cards), "best rank range med", st.median(c["best"] for c in cards if c["year"] == 1405))

# Set 1276 (IT), 1405
d = json.load(open(os.path.join(BASE, "out/tg1405_cards_clean.json"), encoding="utf-8"))
it = [r for r in d if r["set"] == 1276 and r["quota"] == "free" and "cut off" not in r.get("note", "") and "hidden" not in r.get("note", "")]
IK = ["language", "it_common", "it_management", "it_special"]
print("\n== 1276 IT 1405 free n =", len(it))
for k in IK:
    vals = [r[k] if r.get(k) is not None else 0.0 for r in it]
    blank = sum(r.get(k) is None for r in it)
    print(k, "median", round(st.median(vals), 1), "blank", blank, "<=0", sum(v <= 0 for v in vals))
for a, b in [(1, 10), (11, 50), (51, 9999)]:
    g = [r for r in it if a <= min(r["rank_quota"]) <= b]
    if g: print(f"IT best rank {a}-{b} n={len(g)} | " + " | ".join(f"{k} {st.median((r[k] if r.get(k) is not None else 0.0) for r in g):.1f}" for k in IK) + f" | mgmt blank {sum(r.get('it_management') is None for r in g)}")
print("IT two codes: rank ratio worst/best median", round(st.median(max(r["rank_quota"])/min(r["rank_quota"]) for r in it), 2))
