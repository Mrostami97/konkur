"""What the official 1406 weights (language 1, maths 2, specialised 4; out of 7)
would have made of past cards. Years 1403-1405 only (test counts known). No GPA.
Aggregates only. Writes w1406_stats.json."""
import os, json, statistics as st, sys, collections, math
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
exec(open(os.path.join(HERE, "skip_subject.py"), encoding="utf-8").read().split("BANDS =")[0])
from adm_loader import load
TESTS = {1403: [25, 20, 9, 20, 20, 19], 1404: [25, 20, 10, 20, 20, 20], 1405: [25, 19, 10, 19, 19, 18]}
W = MODEL["weights"]
def new(c):
    T = TESTS[c["year"]]; spec = sum(c["p"][j]*T[j] for j in range(2, 6))/sum(T[2:])
    return (c["p"][0] + 2*c["p"][1] + 4*spec)/7, spec
def old(p, code): w = W[code]; return sum(a*b for a, b in zip(w, p))/sum(w)
def q(v): x = st.quantiles(v, n=4); return [x[0], st.median(v), x[2]]
out = {}
# --- admitted cards (free, daytime), years 1403-1404 (1405 has no admissions)
adm = [a for a in load() if a["quota"] == "free" and a["period"] == "روزانه" and a["year"] in (1403, 1404)]
for a in adm:
    T = TESTS[a["year"]]; spec = sum(a["p"][j]*T[j] for j in range(2, 6))/sum(T[2:])
    a["new"] = (a["p"][0] + 2*a["p"][1] + 4*spec)/7; a["old"] = old(a["p"], a["code"])
def grp(key):
    d = {}
    for k in set(a[key] for a in adm):
        g = [a for a in adm if a[key] == k]
        if len(g) >= 10: d[k] = dict(n=len(g), new=q([a["new"] for a in g]), old=q([a["old"] for a in g]), rank=st.median(a["rank"] for a in g))
    return d
out["admUni"] = grp("uni"); out["admProg"] = grp("prog")
out["admAll"] = dict(n=len(adm), new=q([a["new"] for a in adm]), old=q([a["old"] for a in adm]))
# --- all cards top3000, per year: band medians and re-ranking overlap
top = [c for c in cards if c["year"] in (1403, 1404, 1405) and c["best"] <= 3000]
for c in top:
    c["new"], c["spec"] = new(c); c["old"] = max(old(c["p"], code) for code in "1234")
B = [(1, 30), (31, 100), (101, 300), (301, 1000), (1001, 3000)]
out["bands"] = {}
for a, b in B:
    g = [c for c in top if a <= c["best"] <= b and c["year"] in (1403, 1404)]
    if len(g) >= 10: out["bands"][f"{a}-{b}"] = dict(n=len(g), new=q([c["new"] for c in g]), old=q([c["old"] for c in g]))
g5 = [c for c in top if c["year"] == 1405 and c["best"] <= 300]
out["bands1405"] = {f"{a}-{b}": dict(n=len(g), new=q([c["new"] for c in g]), old=q([c["old"] for c in g])) for a, b in B[:3] if len(g := [c for c in g5 if a <= c["best"] <= b]) >= 10}
def rank_of(vals):
    o = sorted(range(len(vals)), key=lambda i: -vals[i]); r = [0]*len(vals)
    for pos, i in enumerate(o): r[i] = pos
    return r
out["rerank"] = {}
for y in (1403, 1404):
    cs = [c for c in top if c["year"] == y]
    ro = rank_of([c["old"] for c in cs]); rn = rank_of([c["new"] for c in cs]); n = len(cs)
    def overlap(frac):
        k = int(n*frac); return sum(1 for i in range(n) if ro[i] < k and rn[i] < k)/k
    def spearman():
        ma = mb = (n-1)/2; cov = sum((ro[i]-ma)*(rn[i]-mb) for i in range(n)); return cov/sum((ro[i]-ma)**2 for i in range(n))
    k = int(n*0.1)
    enter = [cs[i] for i in range(n) if rn[i] < k and ro[i] >= k]; leave = [cs[i] for i in range(n) if ro[i] < k and rn[i] >= k]; stay = [cs[i] for i in range(n) if ro[i] < k and rn[i] < k]
    med = lambda g, j: st.median(c["p"][j] for c in g) if len(g) >= 5 else None
    out["rerank"][str(y)] = dict(n=n, k=k, overlap10=overlap(0.1), overlap20=overlap(0.2), spearman=spearman(), nEnter=len(enter), nLeave=len(leave), nStay=len(stay),
        enter=[med(enter, 0), med(enter, 1), st.median(c["spec"] for c in enter) if len(enter) >= 5 else None], leave=[med(leave, 0), med(leave, 1), st.median(c["spec"] for c in leave) if len(leave) >= 5 else None],
        stay=[med(stay, 0), med(stay, 1), st.median(c["spec"] for c in stay) if len(stay) >= 5 else None])
json.dump(out, open(os.path.join(HERE, "w1406_stats.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print(out["admAll"]); print({u: (v["n"], round(v["new"][1], 1), round(v["old"][1], 1)) for u, v in out["admUni"].items()}); print({u: (v["n"], round(v["new"][1], 1), round(v["old"][1], 1)) for u, v in out["admProg"].items()})
print({b: (v["n"], round(v["new"][1], 1), round(v["old"][1], 1)) for b, v in out["bands"].items()}, {b: (v["n"], round(v["new"][1], 1), round(v["old"][1], 1)) for b, v in out["bands1405"].items()})
for y, v in out["rerank"].items(): print(y, {k: (round(x, 2) if isinstance(x, float) else x) for k, x in v.items() if k not in ("enter", "leave", "stay")}, "enter", v["enter"], "leave", v["leave"], "stay", v["stay"])
