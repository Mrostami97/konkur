"""Shared loader: every parsed admission in the public result banks joined to its
card (percentages, GPA, in-quota rank of the admitted program). Tier B: raw rows
stay outside the repository; callers print aggregates only (groups >= 10)."""
import csv, os
BASE = os.environ.get("KONKUR_REPORT_CARDS", "D:/competitor-crawler-data/report_cards")
_src = open(os.path.join(BASE, "admissions.py"), encoding="utf-8").read().split("f = lambda v")[0]
_cwd = os.getcwd(); os.chdir(BASE); _ns = {}; exec(_src, _ns); os.chdir(_cwd)
parse = _ns["parse"]
K = ["language", "math", "spec1", "spec2", "spec3", "spec4"]
NAMES = ["زبان", "ریاضی", "نظریه و سیگنال", "داده‌ساختار، الگوریتم و هوش", "منطقی و معماری", "سیستم عامل، شبکه و پایگاه داده"]
def load():
    seen, adm = set(), []
    for r in csv.DictReader(open(os.path.join(BASE, "out/report_cards.csv"), encoding="utf-8-sig")):
        p = parse(r["admission_raw"])
        if not p or p[0] is None or p[1] is None: continue
        (prog, code), uni, period, _ = p
        key = (r["fingerprint"], prog, uni, period)
        if key in seen: continue
        seen.add(key)
        rank = r[f"code{code}_rank_quota"]
        if not rank or any(r[k] == "" for k in K): continue
        adm.append(dict(year=int(r["exam_year"]), quota=r["quota"], prog=prog, code=str(code), uni=uni, period=period, rank=float(rank),
                        p=[float(r[k]) for k in K], gpa=float(r["gpa"]) if r["gpa"] else None))
    return adm
