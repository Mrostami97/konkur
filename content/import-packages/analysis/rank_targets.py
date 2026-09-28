"""Percentages needed for ranks 500-3000, set 1277, free quota. Aggregates only.
(1) weighted average (GPA 17.5) the public model gives for each rank/year/code;
(2) median box percentages of cards whose best rank fell in a band around each
target (1403-1404, where the data reaches those ranks)."""
import os, json, math, statistics as st
HERE = os.path.dirname(os.path.abspath(__file__))
MODEL = json.load(open(os.path.join(HERE, "../../../apps/web/src/content/rank-model-1277.json"), encoding="utf-8"))
__file__ = os.path.join(HERE, "skip_subject.py")
exec(open(__file__, encoding="utf-8").read().split("BANDS =")[0])
def need(year, code, rank):
    y = next((m for m in MODEL["years"] if m["year"] == year and m["quota"] == "free"), None)
    cv = y and y["codes"].get(code)
    if not cv: return None
    ln = cv["lnRank"]; t = math.log(rank)
    if t > ln[0] or t < ln[-1]: return None
    for i in range(len(ln) - 1):
        if ln[i] >= t >= ln[i+1]:
            f = 0 if ln[i] == ln[i+1] else (ln[i] - t)/(ln[i] - ln[i+1]); return cv["start"] + (i + f)*MODEL["step"]
for code in ("2", "4", "3", "1"):
    print("code", code)
    for rank in (500, 1000, 1500, 2000, 3000):
        print("  rank", rank, " ".join(f"{y}:{'-' if need(y, code, rank) is None else round(need(y, code, rank), 1)}" for y in (1400, 1401, 1402, 1403, 1404)))
N = {1403: [25, 20, 9, 20, 20, 19], 1404: [25, 20, 10, 20, 20, 20]}
for a, b in [(400, 650), (800, 1300), (1600, 2500), (2500, 4000)]:
    g = [c for c in cards if c["year"] in (1403, 1404) and a <= c["best"] <= b]
    if len(g) < 15: print(a, b, "n", len(g)); continue
    spec = [sum(p*q for p, q in zip(c["p"][2:], N[c["year"]][2:]))/sum(N[c["year"]][2:]) for c in g]
    print(f"band {a}-{b} n={len(g)} | spec {st.median(spec):.1f} | math {st.median(c['p'][1] for c in g):.1f} | lang {st.median(c['p'][0] for c in g):.1f} | " + " | ".join(f"{NAMES[j]} {st.median(c['p'][j] for c in g):.1f}" for j in range(2, 6)) + f" | gpa {st.median(c['gpa'] for c in g):.2f} | math<=0 {100*sum(c['p'][1] <= 0 for c in g)/len(g):.0f}%")
print("cards 1403-1404 by band:", {f"{a}-{b}": sum(1 for c in cards if c["year"] in (1403, 1404) and a <= c["best"] <= b) for a, b in [(1, 500), (501, 1000), (1001, 2000), (2001, 5000), (5001, 99999)]})
