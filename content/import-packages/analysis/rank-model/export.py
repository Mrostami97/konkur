"""Export the aggregated rank model for the site (tier B: aggregates only).

Writes apps/web/src/content/rank-model-1277.json: per (year, quota, code) a
decreasing curve of ln(rank) on a 0.5-point grid of the GPA-shifted weighted
average, the GPA shift per (year, quota), residual quantiles per rank band,
accuracy measured out-of-fold, and admission ranks per university-program-period
(free quota, >= 10 cards; see admission_pairs.py). No single card is written.
"""
import sys, math, random, collections, csv, json, statistics
sys.path.insert(0, "model")
from fit import load, interp, quant, GREF, W
from fit2 import fit_s, sse, GAMMAS
OUT = "C:/Users/Error/Documents/konkur/apps/web/src/content/rank-model-1277.json"
MIN_CARDS = 40
groups = load()
by_yq = collections.defaultdict(dict)
for (y, q, c), pts in groups.items():
    if q == "25_percent" or len(pts) < MIN_CARDS: continue
    by_yq[(y, q)][c] = pts
BANDS = [30, 150, 600, 2500, None]
def band_of(rank): return next(i for i, b in enumerate(BANDS) if b is None or rank < b)

# Out-of-fold residuals: accuracy and bands.
res = collections.defaultdict(list); allres = []
for (y, q), codes in sorted(by_yq.items()):
    cards = sorted({p["card"] for pts in codes.values() for p in pts}); random.Random(7).shuffle(cards)
    fold = {cd: i % 5 for i, cd in enumerate(cards)}
    for f in range(5):
        tr = {c: [p for p in pts if fold[p["card"]] != f] for c, pts in codes.items()}
        gm = min(GAMMAS, key=lambda gm: sum(sse(t, fit_s(t, gm)) for t in tr.values()))
        for c, pts in codes.items():
            mdl = fit_s(tr[c], gm)
            for p in pts:
                if fold[p["card"]] != f: continue
                s = p["x"] + gm*(p["g"]-GREF)
                if not (mdl["lo"] <= s <= mdl["hi"]): continue
                pred = interp(mdl["grid"], mdl["m"], s); r = p["y"] - pred
                res[(q, band_of(math.exp(pred)))].append(r); allres.append(r)
bands = {}
for q in ("free", "5_percent"):
    bands[q] = []
    for i, b in enumerate(BANDS):
        r = res[(q, i)] or res[("free", i)]
        bands[q].append(dict(below=b, n=len(r), q10=round(quant(r, .1), 3), q25=round(quant(r, .25), 3), q75=round(quant(r, .75), 3), q90=round(quant(r, .9), 3)))

# Year-to-year transfer: the previous year's curve applied to this year's cards.
transfer = []
full = {}
for (y, q), codes in sorted(by_yq.items()):
    gm = min(GAMMAS, key=lambda gm: sum(sse(pts, fit_s(pts, gm)) for pts in codes.values()))
    full[(y, q)] = dict(gamma=gm, codes={c: fit_s(pts, gm) for c, pts in codes.items()},
                        cards=len({p["card"] for pts in codes.values() for p in pts}))
for (y, q), m in full.items():
    prev = full.get((y - 1, q))
    if not prev: continue
    for c, pts in by_yq[(y, q)].items():
        pm = prev["codes"].get(c)
        if not pm: continue
        for p in pts:
            s = p["x"] + prev["gamma"]*(p["g"]-GREF)
            if pm["lo"] <= s <= pm["hi"]: transfer.append(p["y"] - interp(pm["grid"], pm["m"], s))

years = []
for (y, q), m in sorted(full.items()):
    codes = {}
    for c, mdl in sorted(m["codes"].items()):
        codes[str(c)] = dict(start=mdl["grid"][0], lnRank=[round(v, 3) for v in mdl["m"]])
    years.append(dict(year=y, quota=q, gpaShift=m["gamma"], cards=m["cards"], codes=codes))

# Admissions: see admission_pairs.py (free quota, every period, >= 10 cards).
from admission_pairs import pairs as admission_pairs
admissions = admission_pairs("out/admissions_parsed.csv")

model = dict(
    set=1277, generated="2026-09-27", gpaRef=GREF, step=0.5,
    weights={str(c): w for c, w in W.items()},
    accuracy=dict(sameYearMedianErrorPct=round((math.exp(quant([abs(r) for r in allres], .5)) - 1)*100, 1), sameYearChecks=len(allres),
                  nextYearMedianErrorPct=round((math.exp(quant([abs(r) for r in transfer], .5)) - 1)*100, 1), nextYearChecks=len(transfer)),
    bands=bands, years=years, admissions=admissions,
    cards=len({p["card"] for pts in groups.values() for p in pts}),
)
json.dump(model, open(OUT, "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
print("accuracy", model["accuracy"]); print("admission pairs", len(admissions)); print("years", [(y["year"], y["quota"], y["cards"], y["gpaShift"]) for y in years])
import os; print("bytes", os.path.getsize(OUT))
