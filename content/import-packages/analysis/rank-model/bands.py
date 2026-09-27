import sys, math, random, collections
sys.path.insert(0, "model")
from fit import load, interp, quant, GREF
from fit2 import fit_s, sse, GAMMAS
groups = load()
by_yq = collections.defaultdict(dict)
for (y, q, c), pts in groups.items():
    if q == "25_percent" or len(pts) < 40: continue
    by_yq[(y, q)][c] = pts
BANDS = [(0, 30), (30, 150), (150, 600), (600, 2500), (2500, 1e9)]
res = collections.defaultdict(list); resq = collections.defaultdict(list)
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
                pred = interp(mdl["grid"], mdl["m"], s)
                b = next(i for i, (a, bb) in enumerate(BANDS) if a <= math.exp(pred) < bb)
                res[b].append(p["y"] - pred); resq[(q, b)].append(p["y"] - pred)
for b, (a, bb) in enumerate(BANDS):
    r = res[b]
    print(f"pred rank {a}-{bb}: n {len(r)}  q10 {quant(r,.1):+.2f} q25 {quant(r,.25):+.2f} q50 {quant(r,.5):+.2f} q75 {quant(r,.75):+.2f} q90 {quant(r,.9):+.2f}")
for k in sorted(resq): print(k, len(resq[k]), f"{quant(resq[k],.1):+.2f} {quant(resq[k],.9):+.2f}")
