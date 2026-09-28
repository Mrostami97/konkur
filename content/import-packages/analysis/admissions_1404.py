"""1404 admissions by university, set 1277, free quota, from the owner's
database (admissions + rankings; rank = in-quota rank in the admitted
program's coefficient code). Mostly the public KonkurComputer result bank:
tier B, aggregates only (groups of >= 5, medians and quartiles)."""
import sqlite3, collections, statistics as st
c = sqlite3.connect("file:C:/Users/Error/Downloads/konkur_results_v41.sqlite?mode=ro", uri=True)
rows = c.execute("""select r.exam_year_shamsi, r.quota, coalesce(a.admission_type, ''), i.canonical_name, p.canonical_name, p.coefficient_code, k.rank_quota
from admissions a join result_records r on r.id = a.result_id join institutions i on i.id = a.institution_id join programs p on p.id = a.program_id
join rankings k on k.result_id = r.id and k.coefficient_code = p.coefficient_code
where r.duplicate_of_result_id is null and a.accepted = 1 and k.rank_quota is not null""").fetchall()
TYPE = lambda t: "روزانه" if t.startswith("روزانه") else "شبانه" if ("شبانه" in t or "نوبت دوم" in t) else "پردیس" if "پردیس" in t else t or "نامشخص"
def summary(title, rs, key):
    g = collections.defaultdict(list)
    for r in rs: g[key(r)].append(r[6])
    print(f"\n== {title} (n={len(rs)})")
    for k, v in sorted(g.items(), key=lambda kv: st.median(kv[1])):
        if len(v) >= 5:
            q = st.quantiles(v, n=4); print(k, len(v), round(st.median(v)), round(q[0]), round(q[2]))
    small = sorted((k, len(v)) for k, v in g.items() if len(v) < 5)
    print("  groups under 5:", len(small))
for year in (1404, 1403):
    fr = [r for r in rows if r[0] == year and r[1] == "free"]
    print(f"\n######## {year}: free admissions with rank {len(fr)}", collections.Counter(TYPE(r[2]) for r in fr))
    summary(f"{year} daytime by university", [r for r in fr if TYPE(r[2]) == "روزانه"], lambda r: r[3])
    summary(f"{year} daytime by university and program", [r for r in fr if TYPE(r[2]) == "روزانه"], lambda r: (r[3], r[4]))
    summary(f"{year} other periods by university and type", [r for r in fr if TYPE(r[2]) != "روزانه"], lambda r: (r[3], TYPE(r[2])))
