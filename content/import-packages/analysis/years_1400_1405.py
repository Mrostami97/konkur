"""Year-by-year picture of set 1277, free quota, 1400-1405: cards per year,
needed weighted average per rank (public model, GPA 17.5, code 2), median box
percentages of the top 100 and ranks 101-500 per year, and shares of top-100
cards with maths/language <= 0. Aggregates only (tier B)."""
import os, json, math, statistics as st, collections
HERE = os.path.dirname(os.path.abspath(__file__))
MODEL = json.load(open(os.path.join(HERE, "../../../apps/web/src/content/rank-model-1277.json"), encoding="utf-8"))
__file__ = os.path.join(HERE, "skip_subject.py")
exec(open(__file__, encoding="utf-8").read().split("BANDS =")[0])
def need(year, rank, code="2"):
    y = next((m for m in MODEL["years"] if m["year"] == year and m["quota"] == "free"), None)
    ln = y["codes"][code]["lnRank"]; t = math.log(rank)
    if t > ln[0] or t < ln[-1]: return None
    cv = y["codes"][code]
    for i in range(len(ln) - 1):
        if ln[i] >= t >= ln[i+1]:
            f = 0 if ln[i] == ln[i+1] else (ln[i] - t)/(ln[i] - ln[i+1]); return cv["start"] + (i + f)*MODEL["step"]
years = [1400, 1401, 1402, 1403, 1404, 1405]
print("cards per year (free, all four ranks):", {y: sum(c["year"] == y for c in cards) for y in years})
print("\nneeded weighted average (code 2, GPA 17.5)")
for r in (10, 30, 100, 300, 1000):
    print(" rank", r, {y: (None if need(y, r) is None else round(need(y, r), 1)) for y in years})
print("\ntop-100 cards: n, GPA median, maths<=0, language<=0, median percents (lang, math, theory, DS, logic, OS)")
for y in years:
    g = [c for c in cards if c["year"] == y and c["best"] <= 100]
    if len(g) < 10: print(y, len(g)); continue
    print(y, len(g), round(st.median(c["gpa"] for c in g), 2), f"{100*sum(c['p'][1] <= 0 for c in g)/len(g):.0f}%", f"{100*sum(c['p'][0] <= 0 for c in g)/len(g):.0f}%", [round(st.median(c["p"][j] for c in g), 1) for j in range(6)])
print("\nranks 101-500: n, medians")
for y in years:
    g = [c for c in cards if c["year"] == y and 101 <= c["best"] <= 500]
    if len(g) < 10: print(y, len(g)); continue
    print(y, len(g), [round(st.median(c["p"][j] for c in g), 1) for j in range(6)], "GPA", round(st.median(c["gpa"] for c in g), 2))
# 1404 vs 1403 per box, ranks 31-100 and 101-300 (same bands)
for a, b in [(1, 30), (31, 100), (101, 300), (301, 1000)]:
    for y in (1402, 1403, 1404):
        g = [c for c in cards if c["year"] == y and a <= c["best"] <= b]
        if len(g) >= 15: print(f"band {a}-{b} {y} n={len(g)}", [round(st.median(c["p"][j] for c in g), 1) for j in range(6)])
