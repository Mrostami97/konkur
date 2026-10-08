"""Admitted ranks per university-program-period, for the site (tier B:
aggregates only, never a single card).

Free quota only; every period (روزانه, شبانه, پردیس, ...) is kept, because the
students the evening and campus programs admit are exactly the ones a
daytime-only list leaves with nothing to aim for. A pair needs at least
MIN_CARDS cards, so its quartiles never come close to a single student's
rank (apps/web/test/rank-calculator.mjs holds the line). Ranks are in-quota
ranks in the program's coefficient code.

    py admission_pairs.py <admissions_parsed.csv>

rewrites only the `admissions` list of the site's rank-model-1277.json;
export.py calls pairs() for a full rebuild.
"""
import collections, csv, json, statistics, sys

MIN_CARDS = 10
OUT = "C:/Users/Error/Documents/konkur/apps/web/src/content/rank-model-1277.json"


def quant(values, q):
    """Linear-interpolated quantile of sorted values."""
    if not values:
        return None
    position = (len(values) - 1) * q
    low = int(position)
    high = min(low + 1, len(values) - 1)
    return values[low] + (values[high] - values[low]) * (position - low)


def pairs(csv_path):
    groups = collections.defaultdict(list)
    for r in csv.DictReader(open(csv_path, encoding="utf-8-sig")):
        if r["quota"] != "free" or not r["rank"] or not r["code"] or not r["period"]:
            continue
        groups[(r["program"], r["university"], int(r["code"]), r["period"])].append((int(r["year"]), float(r["rank"])))
    out = []
    for (program, university, code, period), rows in groups.items():
        if len(rows) < MIN_CARDS:
            continue
        ranks = sorted(rank for _, rank in rows)
        recent = [rank for year, rank in rows if year >= 1403]
        out.append(dict(
            program=program, university=university, code=code, period=period, cards=len(rows),
            median=round(statistics.median(ranks)), p25=round(quant(ranks, .25)), p75=round(quant(ranks, .75)),
            highestRecent=round(max(recent)) if len(recent) >= 5 else None,
        ))
    out.sort(key=lambda pair: pair["median"])
    return out


if __name__ == "__main__":
    model = json.load(open(OUT, encoding="utf-8"))
    model["admissions"] = pairs(sys.argv[1])
    json.dump(model, open(OUT, "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
    periods = collections.Counter(pair["period"] for pair in model["admissions"])
    print("pairs", len(model["admissions"]), dict(periods))
