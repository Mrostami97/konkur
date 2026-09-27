"""How much is one GPA point worth on the master's rank? Aggregates only.

Uses rank-model/fit.py and fit2.py (run from the report_cards folder) on the
per-(card, code) table. gamma = weighted-average points one GPA point is worth,
fitted per year and quota on a fine grid, with a bootstrap range over cards (10 resamples; the 2nd and 9th values).
Also the median rank ratio for GPA + 1 at the card's own position, and a raw
within-bin comparison that needs no model.
"""
import sys, os, math, random, collections, statistics as st
BASE = os.environ.get("KONKUR_REPORT_CARDS", "D:/competitor-crawler-data/report_cards")
os.chdir(BASE); sys.path.insert(0, "model")
from fit import load, interp, GREF, W
from fit2 import fit_s, sse
groups = load()
COARSE = [i*0.25 for i in range(0, 9)]
by_yq = collections.defaultdict(dict)
for (y, q, c), pts in groups.items():
    if q == "25_percent" or len(pts) < 40: continue
    by_yq[(y, q)][c] = pts
def best_gamma(codes):
    """Coarse 0.25 grid, then 0.05 steps around the best coarse value."""
    cost = lambda g: sum(sse(p, fit_s(p, g)) for p in codes.values())
    g0 = min(COARSE, key=cost)
    return min([round(g0 + d*0.05, 2) for d in range(-4, 5) if g0 + d*0.05 >= 0], key=cost)
print("year quota cards gamma bootstrap-80%  rank ratio for GPA+1 (median over cards: all / best<=100 / 101-1000 / >1000)")
for (y, q), codes in sorted(by_yq.items()):
    g = best_gamma(codes)
    cards = sorted({p["card"] for pts in codes.values() for p in pts})
    boots = []
    rnd = random.Random(5)
    for _ in range(10):
        pick = collections.Counter(rnd.choice(cards) for _ in cards)
        bc = {c: [p for p in pts for _ in range(pick[p["card"]])] for c, pts in codes.items()}
        boots.append(best_gamma(bc))
    boots.sort()
    models = {c: fit_s(pts, g) for c, pts in codes.items()}
    ratios = collections.defaultdict(list)
    for c, pts in codes.items():
        m = models[c]
        for p in pts:
            s = p["x"] + g*(p["g"] - GREF)
            if not (m["lo"] <= s and s + g <= m["hi"]): continue
            r0 = math.exp(interp(m["grid"], m["m"], s)); r1 = math.exp(interp(m["grid"], m["m"], s + g))
            rank = math.exp(p["y"]); band = "top" if rank <= 100 else "mid" if rank <= 1000 else "low"
            ratios["all"].append(r1/r0); ratios[band].append(r1/r0)
    f = lambda k: f"{st.median(ratios[k]):.2f}" if len(ratios[k]) >= 20 else "  - "
    print(y, q, len(cards), f"{g:.2f}", f"{boots[1]:.2f}-{boots[8]:.2f}", f("all"), f("top"), f("mid"), f("low"))

# Raw check, no model: code 2, free quota, 1403+1404; within 5-point bins of weighted average,
# median rank for GPA >= 18.5 vs GPA < 17.
print("\nraw: year | wavg bin | n hi / n lo | median rank GPA>=18.5 | GPA<17")
for y in (1403, 1404):
    pts = groups[(y, "free", 2)]
    for lo in range(20, 50, 5):
        b = [p for p in pts if lo <= p["x"] < lo + 5]
        hi = [math.exp(p["y"]) for p in b if p["g"] >= 18.5]; lw = [math.exp(p["y"]) for p in b if p["g"] < 17]
        if len(hi) >= 8 and len(lw) >= 8:
            print(y, f"{lo}-{lo+5}", len(hi), len(lw), round(st.median(hi)), round(st.median(lw)))
# GPA spread in the data
allg = [p["g"] for (y, q, c), pts in groups.items() if c == 1 and q == "free" for p in pts]
print("\nGPA quartiles (free, one row per card):", [round(st.quantiles(allg, n=4)[i], 2) for i in range(3)], "min", min(allg), "max", max(allg))
