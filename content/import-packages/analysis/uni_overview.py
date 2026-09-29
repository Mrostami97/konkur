import collections, sys
sys.path.insert(0, ".")
from adm_loader import load
adm = load()
print(len(adm), collections.Counter(a["quota"] for a in adm))
c = collections.Counter((a["uni"]) for a in adm if a["quota"] == "free" and a["period"] == "روزانه")
for u, n in c.most_common(30): print(n, u)
print(collections.Counter(a["prog"] for a in adm if a["quota"]=="free" and a["period"]=="روزانه").most_common())
