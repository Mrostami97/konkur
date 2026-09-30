"""Four card types by maths and language strength, per rank band (set 1277, free
quota, 1400-1405). Thresholds are round numbers near each band's medians.
Aggregates only: groups >= 10. Writes archetype_stats.json."""
import os, json, statistics as st, sys
HERE = os.path.dirname(os.path.abspath(__file__))
exec(open(os.path.join(HERE, "skip_subject.py"), encoding="utf-8").read().split("BANDS =")[0])
CFG = {"top100": dict(lo=1, hi=100, math=15, lang=30), "mid": dict(lo=101, hi=1000, math=10, lang=20)}
def q(v): x = st.quantiles(v, n=4); return [x[0], st.median(v), x[2]]
out = {}
for name, cfg in CFG.items():
    g = [c for c in cards if cfg["lo"] <= c["best"] <= cfg["hi"]]
    for c in g: c["spec"] = sum(c["p"][2:])/4
    types = {"both": lambda c: c["p"][1] >= cfg["math"] and c["p"][0] >= cfg["lang"], "math": lambda c: c["p"][1] >= cfg["math"] and c["p"][0] < cfg["lang"],
             "lang": lambda c: c["p"][1] < cfg["math"] and c["p"][0] >= cfg["lang"], "neither": lambda c: c["p"][1] < cfg["math"] and c["p"][0] < cfg["lang"]}
    d = dict(cfg=cfg, n=len(g), types={})
    for t, f in types.items():
        s = [c for c in g if f(c)]
        early = [c for c in s if c["year"] <= 1403]; late = [c for c in s if c["year"] >= 1404]
        d["types"][t] = dict(n=len(s), share=len(s)/len(g), rank=q([c["best"] for c in s]) if len(s) >= 10 else None, spec=q([c["spec"] for c in s]) if len(s) >= 10 else None,
                             gpa=st.median(c["gpa"] for c in s) if len(s) >= 10 else None, math=st.median(c["p"][1] for c in s) if len(s) >= 10 else None, lang=st.median(c["p"][0] for c in s) if len(s) >= 10 else None,
                             nEarly=len(early), nLate=len(late))
    d["early"] = sum(1 for c in g if c["year"] <= 1403); d["late"] = sum(1 for c in g if c["year"] >= 1404)
    out[name] = d
json.dump(out, open(os.path.join(HERE, "archetype_stats.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
for k, d in out.items():
    print(k, d["cfg"], d["n"], "early", d["early"], "late", d["late"])
    for t, v in d["types"].items(): print("  ", t, v["n"], round(100*v["share"]), v["rank"] and [round(x) for x in v["rank"]], v["spec"] and [round(x) for x in v["spec"]], v["gpa"] and round(v["gpa"], 1), v["math"] and round(v["math"]), v["lang"] and round(v["lang"]), v["nEarly"], v["nLate"])

# --- enrichment: per-year share of each type, best code per type, spec quartiles per type
for name, cfg in CFG.items():
    d = out[name]
    g = [c for c in cards if cfg["lo"] <= c["best"] <= cfg["hi"]]
    def typ(c):
        m, l = c["p"][1] >= cfg["math"], c["p"][0] >= cfg["lang"]
        return "both" if m and l else "math" if m else "lang" if l else "neither"
    d["perYear"] = {str(y): dict(n=len(v), **{t: sum(typ(c) == t for c in v) for t in ("both", "math", "lang", "neither")}) for y in range(1400, 1406) if len(v := [c for c in g if c["year"] == y]) >= 10}
    for t in ("both", "math", "lang", "neither"):
        v = [c for c in g if typ(c) == t]
        d["types"][t]["bestCode"] = dict(collections.Counter(c["bestCode"] for c in v))
        d["types"][t]["specBoxes"] = [st.median(c["p"][j] for c in v) for j in range(2, 6)] if len(v) >= 10 else None
json.dump(out, open(os.path.join(HERE, "archetype_stats.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
for k, d in out.items():
    print("\n#", k, d["perYear"])
    for t, v in d["types"].items(): print("  ", t, v["bestCode"], v["specBoxes"] and [round(x) for x in v["specBoxes"]])
