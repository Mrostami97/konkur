"""Strongest and weakest specialised box per card, by rank band (set 1277, free
quota, 1400-1405, best in-quota rank <= 1000). Ties go to the first box in
order. Aggregates only: groups >= 10. Writes strength_stats.json."""
import os, json, statistics as st, collections
HERE = os.path.dirname(os.path.abspath(__file__))
exec(open(os.path.join(HERE, "skip_subject.py"), encoding="utf-8").read().split("BANDS =")[0])
SP = [2, 3, 4, 5]
B = [(1, 100), (101, 300), (301, 1000)]
def q(v): x = st.quantiles(v, n=4); return [x[0], st.median(v), x[2]]
out = {"names": [NAMES[j] for j in SP], "bands": {}}
for a, b in B:
    g = [c for c in cards if a <= c["best"] <= b]
    strong = collections.Counter(); weak = collections.Counter(); gaps = []; ge50 = collections.Counter()
    ties_s = ties_w = 0
    for c in g:
        v = [c["p"][j] for j in SP]
        hi, lo = max(v), min(v)
        if v.count(hi) > 1: ties_s += 1
        if v.count(lo) > 1: ties_w += 1
        strong[v.index(hi)] += 1; weak[v.index(lo)] += 1; gaps.append(hi - lo); ge50[sum(x >= 50 for x in v)] += 1
    out["bands"][f"{a}-{b}"] = dict(n=len(g), strong={str(k): v for k, v in strong.items()}, weak={str(k): v for k, v in weak.items()}, gap=q(gaps), ge50={str(k): v for k, v in ge50.items()}, tiesStrong=ties_s, tiesWeak=ties_w)
json.dump(out, open(os.path.join(HERE, "strength_stats.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
for k, d in out["bands"].items(): print(k, d["n"], "strong", d["strong"], "weak", d["weak"], "gap", [round(x) for x in d["gap"]], "ge50", d["ge50"], "ties", d["tiesStrong"], d["tiesWeak"])
