"""Coefficient codes of set 1277, 1400-1405: how far apart one person's four
ranks were, which strengths favoured which code, and whether admitted people
entered their best code. Aggregates only (tier B); raw data outside the repo.
"""
import csv, collections, os, statistics as st
BASE = os.environ.get("KONKUR_REPORT_CARDS", "D:/competitor-crawler-data/report_cards")
K = ["language", "math", "spec1", "spec2", "spec3", "spec4"]
NAMES = ["زبان", "ریاضی", "نظریه و سیگنال", "داده، الگوریتم و هوش", "منطقی و معماری", "سیستم عامل، شبکه و پایگاه داده"]
cards = {}
for r in csv.DictReader(open(os.path.join(BASE, "model/cards_by_code.csv"), encoding="utf-8")):
    if r["quota"] != "free": continue
    c = cards.setdefault(r["card"], dict(year=int(r["year"]), p=[float(r[k]) for k in K], ranks={}))
    c["ranks"][int(r["code"])] = float(r["rank"])
cards = [c for c in cards.values() if len(c["ranks"]) == 4]
for c in cards:
    c["best"] = min(c["ranks"].values()); c["worst"] = max(c["ranks"].values())
    c["bestCodes"] = [k for k, v in c["ranks"].items() if v == c["best"]]
print("cards", len(cards))
BANDS = [(1, 100), (101, 500), (501, 1000), (1001, 99999)]
print("\n== worst/best rank ratio across the four codes, by best-rank band ==")
for a, b in BANDS:
    g = [c["worst"]/c["best"] for c in cards if a <= c["best"] <= b]
    q = st.quantiles(g, n=10)
    print(f"{a}-{b} n={len(g)} median {st.median(g):.2f} p90 {q[8]:.2f} share >=1.5: {100*sum(x >= 1.5 for x in g)/len(g):.0f}%  >=2: {100*sum(x >= 2 for x in g)/len(g):.0f}%")
print("\n== which code was best (ties counted for each tied code) ==")
cnt = collections.Counter(k for c in cards for k in c["bestCodes"])
print({k: f"{100*v/len(cards):.0f}%" for k, v in sorted(cnt.items())}, "ties:", f"{100*sum(len(c['bestCodes']) > 1 for c in cards)/len(cards):.0f}%")
print("\n== median box percentages of cards whose single best code is k (best rank <= 1000) ==")
for k in (1, 2, 3, 4):
    g = [c for c in cards if c["bestCodes"] == [k] and c["best"] <= 1000]
    print(k, len(g), " | ".join(f"{NAMES[j]} {st.median(c['p'][j] for c in g):.1f}" for j in range(6)))
print("\n== code rank gap: rank in code k / best rank, median, when code k is not best (best<=1000) ==")
for k in (1, 2, 3, 4):
    g = [c["ranks"][k]/c["best"] for c in cards if k not in c["bestCodes"] and c["best"] <= 1000]
    print(k, len(g), f"{st.median(g):.2f}")
# Admissions: did people enter the code where their rank was best?
src = open(os.path.join(BASE, "admissions.py"), encoding="utf-8").read().split("f = lambda v")[0]
cwd = os.getcwd(); os.chdir(BASE); ns = {}; exec(src, ns); os.chdir(cwd)
parse = ns["parse"]; seen = set(); stats = collections.Counter(); gaps = []
for r in csv.DictReader(open(os.path.join(BASE, "out/report_cards.csv"), encoding="utf-8-sig")):
    p = parse(r["admission_raw"])
    if not p or p[0] is None or p[1] is None or r["quota"] != "free": continue
    (prog, code), uni, period, _ = p
    key = (r["fingerprint"], prog, uni, period)
    if key in seen: continue
    seen.add(key)
    ranks = {k: float(r[f"code{k}_rank_quota"]) for k in (1, 2, 3, 4) if r[f"code{k}_rank_quota"]}
    if len(ranks) < 4: continue
    best = min(ranks.values())
    stats["all"] += 1
    if ranks[code] == best: stats["entered best code"] += 1
    else: gaps.append(ranks[code]/best)
    stats[f"code{code}"] += 1
print("\n== admissions ==", dict(stats))
print("not best code: n", len(gaps), "median rank ratio of entered code to best", round(st.median(gaps), 2))
