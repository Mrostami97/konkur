"""Taraz (total score) against rank, set 1277, 1403, from the owner's
database (rankings.total_score; source: public KonkurComputer result bank,
tier B, aggregates only). Per quota and code: a monotone fit of ln(rank) on
taraz (pool-adjacent-violators on points sorted by taraz), the taraz each
target rank needed, and a least-squares fit taraz ~ weighted average + GPA."""
import sqlite3, math, statistics as st, collections
c = sqlite3.connect("file:C:/Users/Error/Downloads/konkur_results_v41.sqlite?mode=ro", uri=True)
W = {1: [1,2,2,3,3,4], 2: [1,2,3,4,2,3], 3: [1,2,2,3,4,3], 4: [1,2,2,4,3,3]}
KEYS = ["language", "math", "spec1", "spec2", "spec3", "spec4"]
rows = c.execute("""select r.id, r.quota, r.effective_gpa, k.coefficient_code, k.rank_quota, k.total_score
  from rankings k join result_records r on r.id = k.result_id
  where k.total_score is not null and r.duplicate_of_result_id is null and r.exam_year_shamsi = 1403 and k.rank_quota is not null""").fetchall()
pct = collections.defaultdict(dict)
for rid, key, v in c.execute("select result_id, subject_key, percentage from subject_scores"):
    pct[rid][key] = v
def pava_dec(ys):
    b = []
    for y in ys:
        b.append([y, 1])
        while len(b) > 1 and b[-2][0]/b[-2][1] < b[-1][0]/b[-1][1]:
            s, n = b.pop(); b[-1][0] += s; b[-1][1] += n
    out = []
    for s, n in b: out += [s/n]*n
    return out
for quota in ("free", "5_percent"):
    print(f"\n=== {quota}")
    for code in (1, 2, 3, 4):
        g = sorted((t, r) for rid, q, gpa, cc, r, t in rows if q == quota and cc == code)
        if len(g) < 30: continue
        xs = [t for t, _ in g]; ys = pava_dec([math.log(r) for _, r in g])
        def taraz_for(rank):
            t = math.log(rank)
            if t > ys[0] or t < ys[-1]: return None
            for i in range(len(ys) - 1):
                if ys[i] >= t >= ys[i+1]:
                    f = 0 if ys[i] == ys[i+1] else (ys[i] - t)/(ys[i] - ys[i+1]); return xs[i] + f*(xs[i+1] - xs[i])
        print(f"code {code} n={len(g)} taraz {xs[0]}-{xs[-1]} rank {min(r for _, r in g)}-{max(r for _, r in g)} | " +
              " ".join(f"r{k}:{'-' if taraz_for(k) is None else round(taraz_for(k))}" for k in (10, 30, 100, 300, 1000, 3000)))
# taraz ~ weighted average + GPA (free quota)
for code in (1, 2, 3, 4):
    pts = []
    for rid, q, gpa, cc, r, t in rows:
        if q != "free" or cc != code or gpa is None or any(pct[rid].get(k) is None for k in KEYS): continue
        x = sum(w*pct[rid][k] for w, k in zip(W[code], KEYS))/15; pts.append((x, gpa, t))
    n = len(pts); X = [[1, x, g] for x, g, _ in pts]; Y = [t for *_, t in pts]
    # normal equations 3x3
    A = [[sum(a[i]*a[j] for a in X) for j in range(3)] for i in range(3)]; B = [sum(a[i]*y for a, y in zip(X, Y)) for i in range(3)]
    import copy
    M = copy.deepcopy(A); v = B[:]
    for i in range(3):
        p = M[i][i]
        for j in range(i, 3): M[i][j] /= p
        v[i] /= p
        for k in range(3):
            if k != i:
                f = M[k][i]
                for j in range(i, 3): M[k][j] -= f*M[i][j]
                v[k] -= f*v[i]
    pred = [v[0] + v[1]*x + v[2]*g for x, g, _ in pts]
    res = [y - p for y, p in zip(Y, pred)]
    ss = sum((y - st.mean(Y))**2 for y in Y); r2 = 1 - sum(e*e for e in res)/ss
    print(f"code {code} n={n}: taraz = {v[0]:.0f} + {v[1]:.1f}*wavg + {v[2]:.1f}*gpa  R2={r2:.3f}  median|res|={st.median(abs(e) for e in res):.0f}")

# Reverse: rank at a given taraz (free and 5%), from the same monotone fit.
for quota in ("free", "5_percent"):
    for code in (2, 4):
        g = sorted((t, r) for rid, q, gpa, cc, r, t in rows if q == quota and cc == code)
        xs = [t for t, _ in g]; ys = pava_dec([math.log(r) for _, r in g])
        def rank_at(t0):
            if t0 < xs[0] or t0 > xs[-1]: return None
            for i in range(len(xs) - 1):
                if xs[i] <= t0 <= xs[i+1]:
                    f = 0 if xs[i+1] == xs[i] else (t0 - xs[i])/(xs[i+1] - xs[i]); return math.exp(ys[i]*(1-f) + ys[i+1]*f)
        print(quota, "code", code, " ".join(f"t{t}:{'-' if rank_at(t) is None else round(rank_at(t))}" for t in (9000, 8000, 7000, 6000, 5000, 4000, 3000, 2000)))
