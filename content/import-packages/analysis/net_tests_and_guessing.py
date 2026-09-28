"""Net tests (correct minus a third of wrong) by rank band, and how often a box
went negative. Free quota, set 1277, 1403-1404 (box sizes known for both).
percent = (3c - w)/(3N)*100  =>  net tests = c - w/3 = percent * N / 100.
Aggregates only (tier B)."""
import os, statistics as st, collections
__file__ = os.path.join(os.path.dirname(os.path.abspath(__file__)), "skip_subject.py")
exec(open(__file__, encoding="utf-8").read().split("BANDS =")[0])
N = {1403: [25, 20, 9, 20, 20, 19], 1404: [25, 20, 10, 20, 20, 20]}
sel = [c for c in cards if c["year"] in N]
print("cards 1403-1404:", len(sel), collections.Counter(c["year"] for c in sel))
bands = [(1, 30), (31, 100), (101, 300), (301, 1000), (1001, 3000)]
print("\n== median net tests per box (1404 sizes 25/20/10/20/20/20 = 115), by best-rank band ==")
for a, b in bands:
    g = [c for c in sel if a <= c["best"] <= b]
    if len(g) < 20: print(a, b, len(g), "few"); continue
    nets = [[c["p"][j]*N[c["year"]][j]/100 for j in range(6)] for c in g]
    med = [st.median(n[j] for n in nets) for j in range(6)]
    tot = st.median(sum(n) for n in nets)
    spec = st.median(sum(n[2:]) for n in nets)
    print(f"{a}-{b} n={len(g)} | " + " | ".join(f"{NAMES[j]} {med[j]:.1f}" for j in range(6)) + f" | total median {tot:.1f} | spec total median {spec:.1f} (of 70)")
print("\n== share of boxes with negative percent (< 0), by band and box ==")
for a, b in bands:
    g = [c for c in sel if a <= c["best"] <= b]
    if len(g) < 20: continue
    print(f"{a}-{b} n={len(g)} | " + " | ".join(f"{NAMES[j]} {100*sum(c['p'][j] < 0 for c in g)/len(g):.0f}%" for j in range(6)) + f" | any box negative {100*sum(any(v < 0 for v in c['p']) for c in g)/len(g):.0f}%")
allc = [c for c in cards]
print("\nall years 1400-1405:", len(allc), "cards with >=1 negative box:", f"{100*sum(any(v < 0 for v in c['p']) for c in allc)/len(allc):.0f}%", "boxes negative:", f"{100*sum(v < 0 for c in allc for v in c['p'])/(6*len(allc)):.1f}%")
# most negative seen per box (as share of the floor -33.3%)
print("min percent seen per box:", [round(min(c['p'][j] for c in allc), 1) for j in range(6)])
