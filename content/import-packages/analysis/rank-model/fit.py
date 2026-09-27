"""Fit and cross-validate the rank model for set 1277.

Per (year, quota, code): ln(rank) = m(x) + beta * (gpa - 17.5), where x is the
code's weighted average of the six percentages (official weights / 15), m is a
decreasing curve (local-linear smooth with a nearest-neighbour span, then made
monotone by pool-adjacent-violators) and beta is fitted by backfitting.
Prediction bands: empirical quantiles of the out-of-fold residuals.
"""
import csv, collections, math, random, sys, json
W = {1: [1,2,2,3,3,4], 2: [1,2,3,4,2,3], 3: [1,2,2,3,4,3], 4: [1,2,2,4,3,3]}
K = ["language","math","spec1","spec2","spec3","spec4"]
GREF = 17.5

def load():
    rows = list(csv.DictReader(open("model/cards_by_code.csv", encoding="utf-8")))
    g = collections.defaultdict(list)
    for r in rows:
        x = sum(w*float(r[k]) for w, k in zip(W[int(r["code"])], K)) / 15
        g[(int(r["year"]), r["quota"], int(r["code"]))].append(dict(card=r["card"], x=x, y=math.log(float(r["rank"])), g=float(r["gpa"])))
    return g

def smooth(xs, ys, at, span):
    """Local-linear tricube smooth with a nearest-neighbour span."""
    n = len(xs); k = max(8, int(span*n)); out = []
    for x0 in at:
        d = sorted(abs(x - x0) for x in xs); h = max(d[min(k, n)-1], 1e-6) * 1.0001
        sw = swx = swy = swxx = swxy = 0.0
        for x, y in zip(xs, ys):
            u = abs(x - x0)/h
            if u >= 1: continue
            w = (1 - u**3)**3
            sw += w; swx += w*x; swy += w*y; swxx += w*x*x; swxy += w*x*y
        den = sw*swxx - swx*swx
        if abs(den) < 1e-9: out.append(swy/sw); continue
        b = (sw*swxy - swx*swy)/den; a = (swy - b*swx)/sw
        out.append(a + b*x0)
    return out

def pava_decreasing(v):
    blocks = []  # [sum, count]
    for y in v:
        blocks.append([y, 1])
        while len(blocks) > 1 and blocks[-2][0]/blocks[-2][1] < blocks[-1][0]/blocks[-1][1]:
            s, c = blocks.pop(); blocks[-1][0] += s; blocks[-1][1] += c
    out = []
    for s, c in blocks: out += [s/c]*c
    return out

def fit(pts, span, use_gpa):
    xs = [p["x"] for p in pts]; lo, hi = min(xs), max(xs)
    grid = [round(lo + i*0.5, 2) for i in range(int((hi - lo)/0.5) + 2)]
    beta = 0.0
    for _ in range(6 if use_gpa else 1):
        ys = [p["y"] - beta*(p["g"] - GREF) for p in pts]
        m = pava_decreasing(smooth(xs, ys, grid, span))
        if not use_gpa: break
        res = [p["y"] - interp(grid, m, p["x"]) for p in pts]
        gs = [p["g"] - GREF for p in pts]; gm = sum(gs)/len(gs); rm = sum(res)/len(res)
        beta = sum((a-gm)*(b-rm) for a, b in zip(gs, res)) / sum((a-gm)**2 for a in gs)
    return dict(grid=grid, m=m, beta=beta, lo=lo, hi=hi)

def interp(grid, m, x):
    if x <= grid[0]: return m[0]
    if x >= grid[-1]: return m[-1]
    i = int((x - grid[0])/0.5); i = min(i, len(grid)-2)
    t = (x - grid[i])/(grid[i+1]-grid[i]); return m[i]*(1-t) + m[i+1]*t

def predict(model, x, g): return interp(model["grid"], model["m"], x) + model["beta"]*(g - GREF)

def quant(a, p):
    a = sorted(a); i = p*(len(a)-1); lo = int(i); hi = min(lo+1, len(a)-1)
    return a[lo]*(1-(i-lo)) + a[hi]*(i-lo)

def cv(pts, span, use_gpa, folds=5, seed=1):
    cards = sorted({p["card"] for p in pts}); random.Random(seed).shuffle(cards)
    fold = {c: i % folds for i, c in enumerate(cards)}; res = []
    for f in range(folds):
        tr = [p for p in pts if fold[p["card"]] != f]; te = [p for p in pts if fold[p["card"]] == f]
        if len(tr) < 20 or not te: continue
        mdl = fit(tr, span, use_gpa)
        for p in te:
            if mdl["lo"] <= p["x"] <= mdl["hi"]: res.append(p["y"] - predict(mdl, p["x"], p["g"]))
    return res

if __name__ == "__main__":
    groups = load()
    for span in (0.15, 0.25, 0.4):
        for use_gpa in (False, True):
            allres = []
            for key, pts in groups.items():
                if key[1] == "25_percent" or len(pts) < 40: continue
                allres += cv(pts, span, use_gpa)
            mae = quant([abs(r) for r in allres], 0.5)
            print(f"span {span} gpa {use_gpa}: n {len(allres)}  median |ln err| {mae:.3f} (x{math.exp(mae):.2f})  q10..q90 {quant(allres,.1):.2f}..{quant(allres,.9):.2f}")
