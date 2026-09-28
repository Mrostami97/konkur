"""GPA of admitted students by university (free quota, daytime, set 1277), from
the public result banks (tier B: groups of >= 10, medians and shares only)."""
import csv, collections, os, statistics as st
BASE = os.environ.get("KONKUR_REPORT_CARDS", "D:/competitor-crawler-data/report_cards")
src = open(os.path.join(BASE, "admissions.py"), encoding="utf-8").read().split("f = lambda v")[0]
cwd = os.getcwd(); os.chdir(BASE); ns = {}; exec(src, ns); os.chdir(cwd)
parse = ns["parse"]; seen = set(); g = collections.defaultdict(list); allg = []
for r in csv.DictReader(open(os.path.join(BASE, "out/report_cards.csv"), encoding="utf-8-sig")):
    if r["quota"] != "free" or not r["gpa"]: continue
    p = parse(r["admission_raw"])
    if not p or p[0] is None or p[1] is None or p[2] != "روزانه": continue
    key = (r["fingerprint"], p[0][0], p[1])
    if key in seen: continue
    seen.add(key); gpa = float(r["gpa"]); g[p[1]].append(gpa); allg.append(gpa)
print("daytime free admissions with GPA:", len(allg), "median", round(st.median(allg), 2), "share < 16:", f"{100*sum(x < 16 for x in allg)/len(allg):.0f}%", "< 15:", sum(x < 15 for x in allg), "min", min(allg))
print("\nuniversity | n | median GPA | q1-q3 | share < 16 | share < 17 | min")
for u, v in sorted(g.items(), key=lambda kv: -st.median(kv[1])):
    if len(v) < 10: continue
    q = st.quantiles(v, n=4)
    print(u, len(v), round(st.median(v), 2), f"{q[0]:.1f}-{q[2]:.1f}", f"{100*sum(x < 16 for x in v)/len(v):.0f}%", f"{100*sum(x < 17 for x in v)/len(v):.0f}%", min(v))

print("\nshare below 15 / below 16, and count, for the three largest Tehran universities and all:")
for u in ("صنعتی شریف", "تهران", "امیرکبیر", "علم و صنعت"):
    v = g[u]; print(u, len(v), f"<15: {sum(x < 15 for x in v)} ({100*sum(x < 15 for x in v)/len(v):.0f}%)", f"<16: {sum(x < 16 for x in v)} ({100*sum(x < 16 for x in v)/len(v):.0f}%)")
print("all", len(allg), f"<15: {sum(x < 15 for x in allg)} ({100*sum(x < 15 for x in allg)/len(allg):.1f}%)", f">=19: {100*sum(x >= 19 for x in allg)/len(allg):.0f}%")
