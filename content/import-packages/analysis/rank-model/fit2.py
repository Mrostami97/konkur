"""Alternative: GPA shifts the score. ln(rank) = m(x + gamma*(gpa - 17.5)), m decreasing.
gamma per (year, quota) chosen by grid search on the training folds' fit (shared by codes)."""
import sys, math, random, collections
sys.path.insert(0, "model")
from fit import load, smooth, pava_decreasing, interp, quant, GREF

def fit_s(pts, gamma, span=0.25):
    for p in pts: p["s"] = p["x"] + gamma*(p["g"] - GREF)
    xs = [p["s"] for p in pts]; lo, hi = min(xs), max(xs)
    grid = [round(lo + i*0.5, 2) for i in range(int((hi-lo)/0.5) + 2)]
    m = pava_decreasing(smooth(xs, [p["y"] for p in pts], grid, span))
    return dict(grid=grid, m=m, gamma=gamma, lo=lo, hi=hi)

def sse(pts, mdl):
    return sum((p["y"] - interp(mdl["grid"], mdl["m"], p["x"] + mdl["gamma"]*(p["g"]-GREF)))**2 for p in pts)

GAMMAS = [i*0.25 for i in range(0, 25)]
if __name__ == "__main__":
    groups = load()
    by_yq = collections.defaultdict(dict)
    for (y, q, c), pts in groups.items():
        if q == "25_percent" or len(pts) < 40: continue
        by_yq[(y, q)][c] = pts
    allres = []; peryear = collections.defaultdict(list)
    for (y, q), codes in sorted(by_yq.items()):
        cards = sorted({p["card"] for pts in codes.values() for p in pts}); random.Random(1).shuffle(cards)
        fold = {cd: i % 5 for i, cd in enumerate(cards)}
        best_full = min(GAMMAS, key=lambda gm: sum(sse(pts, fit_s(pts, gm)) for pts in codes.values()))
        for f in range(5):
            tr = {c: [p for p in pts if fold[p["card"]] != f] for c, pts in codes.items()}
            gm = min(GAMMAS, key=lambda gm: sum(sse(t, fit_s(t, gm)) for t in tr.values()))
            for c, pts in codes.items():
                mdl = fit_s(tr[c], gm)
                for p in pts:
                    if fold[p["card"]] != f: continue
                    s = p["x"] + gm*(p["g"]-GREF)
                    if mdl["lo"] <= s <= mdl["hi"]:
                        r = p["y"] - interp(mdl["grid"], mdl["m"], s); allres.append(r); peryear[(y, q)].append(r)
        print((y, q), "gamma(full)", best_full, "n", len(peryear[(y, q)]), "median|err| x%.3f" % math.exp(quant([abs(r) for r in peryear[(y, q)]], .5)))
    mae = quant([abs(r) for r in allres], .5)
    print(f"ALL n {len(allres)} median |ln err| {mae:.3f} (x{math.exp(mae):.3f}) q10..q90 {quant(allres,.1):.2f}..{quant(allres,.9):.2f}")
