"""Parse the free-text admission column into program, university and period,
then summarise admitted ranks per university and program.

Rank used = in-quota rank in the coefficient code of the admitted program:
code 1 network/security, 2 AI, 3 architecture, 4 software (recovered exactly
from the banks' per-code weighted averages; see scratchpad/code_weights.mjs).
Only free quota and the daytime period (روزانه) are summarised, so ranks are
comparable. Output: out/admissions_parsed.csv and a printed summary.
"""
import csv, collections, re, statistics as st

PROGRAMS = [  # (pattern, canonical, code)
    (r"هوش مصنوعی و رباتیک|هوش مصنوعی|رباتیک", "هوش مصنوعی", 2),
    (r"نرم ?افزار", "نرم‌افزار", 4),
    (r"معماری", "معماری کامپیوتر", 3),
    (r"الگوریتم", "الگوریتم و محاسبات", 4),
    (r"بیوانفورماتیک", "بیوانفورماتیک", 4),
    (r"علم داده|علوم داده", "علم داده", 4),
    (r"رایانش امن|امنیت", "رایانش امن", 1),
    (r"شبکه", "شبکه‌های کامپیوتری", 1),
    (r"اینترنت اشیا", "اینترنت اشیا", 1),
    (r"قرآن ?‌?کاوی", "قرآن‌کاوی رایانشی", 2),
]
UNIS = [  # most specific first; "?" = ambiguous, left unparsed rather than guessed
    (r"گرمسار", "امیرکبیر (واحد گرمسار)"),
    (r"شریف", "صنعتی شریف"),
    (r"امیرکبیر|امیر کبیر|پلی ?تکنیک", "امیرکبیر"),
    (r"علم ?و ?صنعت", "علم و صنعت"),
    (r"علم و فرهنگ", "علم و فرهنگ"),
    (r"علوم ?و? ?تحقیقات", "آزاد علوم و تحقیقات"),
    (r"فارابی", "تهران (پردیس فارابی)"),
    (r"فنون نوین", "تهران (علوم و فنون نوین)"),
    (r"واحد|آزاد اسلامی|دانشگاه آزاد|تهران مرکز|تهران شمال|تهران جنوب", "?"),
    (r"بهشتی", "شهید بهشتی"),
    (r"رجایی", "شهید رجایی"),
    (r"خواجه ?نصیر", "خواجه‌نصیر"),
    (r"صنعتی اصفهان", "صنعتی اصفهان"),
    (r"دانشگاه اصفهان", "دانشگاه اصفهان"),
    (r"اصفهان", "?"),
    (r"سجاد", "سجاد مشهد"),
    (r"خیام", "خیام مشهد"),
    (r"خراسان", "خراسان مشهد"),
    (r"فردوسی|مشهد", "فردوسی مشهد"),
    (r"صنعتی شیراز", "صنعتی شیراز"),
    (r"شیراز", "شیراز"),
    (r"سهند", "صنعتی سهند"),
    (r"مدنی", "شهید مدنی آذربایجان"),
    (r"تبریز", "تبریز"),
    (r"الزهرا", "الزهرا"),
    (r"تربیت ?مدرس|ترتبیت مدرس", "تربیت مدرس"),
    (r"خوارزمی", "خوارزمی"),
    (r"شاهد", "شاهد"),
    (r"مالک ?اشتر", "مالک اشتر"),
    (r"خاتم", "خاتم"),
    (r"امام حسین", "امام حسین"),
    (r"انقلاب اسلامی", "انقلاب اسلامی"),
    (r"گیلان", "گیلان"),
    (r"سمنان", "سمنان"),
    (r"یزد", "یزد"),
    (r"شاهرود", "صنعتی شاهرود"),
    (r"صنعتی همدان", "صنعتی همدان"),
    (r"بو ?علی", "بوعلی سینا همدان"),
    (r"همدان", "?"),
    (r"صنعتی قم", "صنعتی قم"),
    (r"(^|\s)قم($|\s|-)", "قم"),
    (r"کاشان", "کاشان"),
    (r"باهنر|کرمان(?!شاه)", "شهید باهنر کرمان"),
    (r"علوم پایه زنجان|تحصیلات تکمیلی زنجان", "تحصیلات تکمیلی علوم پایه زنجان"),
    (r"زنجان", "زنجان"),
    (r"کردستان|سنندج", "کردستان"),
    (r"علم و فناوری مازندران|بهشهر", "علم و فناوری مازندران"),
    (r"نوشیروانی|بابل(?!سر)", "نوشیروانی بابل"),
    (r"مازندران|بابلسر", "مازندران"),
    (r"رازی|کرمانشاه", "رازی کرمانشاه"),
    (r"چمران|اهواز", "شهید چمران اهواز"),
    (r"شهرکرد", "شهرکرد"),
    (r"ارومیه", "ارومیه"),
    (r"قزوین|امام خمینی", "بین‌المللی امام خمینی قزوین"),
    (r"بجنورد", "بجنورد"),
    (r"اراک", "اراک"),
    (r"بیرجند", "بیرجند"),
    (r"لرستان", "لرستان"),
    (r"گلستان", "گلستان"),
    (r"سیرجان", "صنعتی سیرجان"),
    (r"تربت", "تربت حیدریه"),
    (r"دانشگاه تهران|(^|\s)تهران($|\s|-)", "تهران"),
]
PERIOD = [(r"شبانه|نوبت دوم", "شبانه"), (r"پردیس|بین ?الملل|خودگردان", "پردیس و خودگردان"), (r"مجازی", "مجازی"), (r"غیر ?انتفاعی", "غیرانتفاعی"), (r"آزاد اسلامی|دانشگاه آزاد", "آزاد")]

def parse(text):
    t = text.replace("ي", "ی").replace("ك", "ک").strip()
    if not t or t in ("-", "—"):
        return None
    prog = next(((c, code) for p, c, code in PROGRAMS if re.search(p, t)), None)
    # University: the specific names first; plain "تهران" only if nothing else matched.
    uni = next((u for p, u in UNIS[:-1] if re.search(p, t)), None)
    if uni is None:
        # "تهران" is also a city: only the University of Tehran when nothing but
        # the program, the period and "دانشگاه" surrounds it.
        rest = t
        for pat, *_ in PROGRAMS:
            rest = re.sub(pat, " ", rest)
        for pat, _ in PERIOD:
            rest = re.sub(pat, " ", rest)
        rest = re.sub(r"دانشگاه|کامپیوتر|و محاسبات|[-–()]", " ", rest)
        if rest.split() == ["تهران"]:
            uni = "تهران"
    period = next((name for p, name in PERIOD if re.search(p, t)), "روزانه")
    if uni == "?":
        uni = None
    return prog, uni, period, t

f = lambda v: None if v in ("", None) else float(v)
rows = list(csv.DictReader(open("out/report_cards.csv", encoding="utf-8-sig")))
seen, parsed, unparsed = set(), [], collections.Counter()
for r in rows:
    p = parse(r["admission_raw"])
    if p is None:
        continue
    (prog, uni, period, t) = p
    if prog is None or uni is None:
        unparsed[t] += 1
        continue
    key = (r["fingerprint"], prog[0], uni, period)  # same person in both banks counts once
    if key in seen:
        continue
    seen.add(key)
    rank = f(r[f"code{prog[1]}_rank_quota"])
    parsed.append(dict(year=int(r["exam_year"]), quota=r["quota"], program=prog[0], code=prog[1], university=uni, period=period, rank=rank))
print("parsed admissions:", len(parsed), " unparsed texts:", sum(unparsed.values()))
for t, n in unparsed.most_common(25):
    print("   ?", n, t)
with open("out/admissions_parsed.csv", "w", encoding="utf-8-sig", newline="") as fh:
    w = csv.DictWriter(fh, fieldnames=list(parsed[0].keys())); w.writeheader(); w.writerows(parsed)

day = [a for a in parsed if a["quota"] == "free" and a["period"] == "روزانه" and a["rank"]]
print("free-quota daytime with rank:", len(day))
groups = collections.defaultdict(list)
for a in day:
    groups[(a["university"], a["program"])].append(a)
print("\nuniversity | program | n | years | median | max rank")
for (u, p), g in sorted(groups.items(), key=lambda kv: -len(kv[1])):
    if len(g) < 8:
        continue
    ranks = sorted(a["rank"] for a in g)
    by_year = collections.defaultdict(list)
    for a in g:
        by_year[a["year"]].append(a["rank"])
    ymax = " ".join(f"{y}:{int(max(v))}({len(v)})" for y, v in sorted(by_year.items()))
    print(f"{u} | {p} | {len(g)} | {ymax} | {st.median(ranks):.0f} | {int(max(ranks))}")
