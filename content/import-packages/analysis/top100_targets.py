"""Targets for a rank under 100: the recent (1404-1405) top-100 profile per
package, as the 1406 packages would group it. Aggregates only (tier B)."""
import os, statistics as st
__file__ = os.path.join(os.path.dirname(os.path.abspath(__file__)), "skip_subject.py")
exec(open(__file__, encoding="utf-8").read().split("BANDS =")[0])
N = {1404: [25, 20, 10, 20, 20, 20], 1405: [25, 19, 10, 19, 19, 18]}
def spec(c):  # question-weighted mean of the four specialised boxes
    n = N[c["year"]][2:]; return sum(p*q for p, q in zip(c["p"][2:], n))/sum(n)
for a, b in [(1, 30), (31, 100), (101, 300)]:
    g = [c for c in cards if c["year"] in (1404, 1405) and a <= c["best"] <= b]
    q = lambda xs: st.quantiles(xs, n=4)
    s = [spec(c) for c in g]; m = [c["p"][1] for c in g]; l = [c["p"][0] for c in g]
    print(f"best rank {a}-{b} (n={len(g)}): spec median {st.median(s):.1f} [{q(s)[0]:.1f}-{q(s)[2]:.1f}] | math {st.median(m):.1f} [{q(m)[0]:.1f}-{q(m)[2]:.1f}] | language {st.median(l):.1f} [{q(l)[0]:.1f}-{q(l)[2]:.1f}] | spec >= 40: {100*sum(x >= 40 for x in s)/len(s):.0f}%")
