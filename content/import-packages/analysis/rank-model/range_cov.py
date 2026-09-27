import sys, math, collections
sys.path.insert(0, "model")
from fit import load, interp, GREF
from fit2 import fit_s, sse, GAMMAS
groups = load(); by_yq = collections.defaultdict(dict)
for (y, q, c), pts in groups.items():
    if q == "25_percent" or len(pts) < 40: continue
    by_yq[(y, q)][c] = pts
full = {}
for (y, q), codes in by_yq.items():
    gm = min(GAMMAS, key=lambda gm: sum(sse(pts, fit_s(pts, gm)) for pts in codes.values()))
    full[(y, q)] = (gm, {c: fit_s(pts, gm) for c, pts in codes.items()})
hit = tot = 0; per = collections.Counter(); pert = collections.Counter()
for (y, q), codes in by_yq.items():
    if y == 1405: continue
    for c, pts in codes.items():
        for p in pts:
            preds = []
            for (y2, q2), (gm, mdls) in full.items():
                if q2 != q or y2 == y or y2 == 1405: continue
                m = mdls.get(c); s = p["x"] + gm*(p["g"]-GREF)
                if m and m["lo"] <= s <= m["hi"]: preds.append(interp(m["grid"], m["m"], s))
            if len(preds) < 3: continue
            tot += 1; pert[y] += 1
            if min(preds) - 0.05 <= p["y"] <= max(preds) + 0.05: hit += 1; per[y] += 1
print("coverage of other-years range:", hit, tot, round(100*hit/tot, 1))
for y in sorted(pert): print(y, round(100*per[y]/pert[y], 1))
