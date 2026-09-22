import json, os, collections, numpy as np
from scipy.optimize import nnls
M5 = ["ukmo_seamless","meteofrance_seamless","ecmwf_ifs025","icon_seamless","gfs_seamless"]
def load(f): return [r for r in json.load(f) if all(r[m] is not None for m in M5 + ["best_match"])]
HERE = os.path.dirname(os.path.abspath(__file__))
DE, US = (load(open(os.path.join(HERE, f))) for f in ("dwd_rows.json", "surfrad_rows.json"))
def fit(rows):
    X = np.array([[r[m] for m in M5] + [1] for r in rows]); y = np.array([r["gnd"] for r in rows]); return nnls(X, y)[0]
W_DE, W_US = fit(DE), fit(US)
W_SAT = np.array([0.046, 0.051, 0.66, 0.134, 0.05, 0.046])   # fitted earlier on the satellite, 73 cities
S = {"best_match (today)": lambda r: r["best_match"], "ecmwf": lambda r: r["ecmwf_ifs025"],
     "mean5": lambda r: np.mean([r[m] for m in M5]), "median5": lambda r: float(np.median([r[m] for m in M5])),
     "blend fit on satellite": lambda r: float(np.dot(W_SAT, [r[m] for m in M5] + [1])),
     "blend fit on OTHER continent": None}
def day(rows, f, thr=0.65):
    d = collections.defaultdict(lambda: [False, False])
    for r in rows:
        if r["e"] >= 35: k = (r["st"], r["t"][:10]); d[k][0] |= r["gnd"] >= 0.7; d[k][1] |= f(r) >= thr
    v = list(d.values()); y = [x for x in v if x[0]]; n = [x for x in v if not x[0]]
    return sum(1 for x in y if not x[1])/len(y), sum(1 for x in n if x[1])/len(n)
print("GROUND TRUTH (day-ahead).  MAE | days: missed sun / invented sun (thr 0.65)")
for name, f in S.items():
    line = f"{name:30s}"
    for lab, rows, other in (("Germany", DE, W_US), ("USA", US, W_DE)):
        g = f or (lambda r, w=other: float(np.dot(w, [r[m] for m in M5] + [1])))
        mae = np.mean([abs(g(r) - r["gnd"]) for r in rows]); a, b = day(rows, g)
        line += f" | {lab}: {mae:.3f}  {100*a:4.1f}%/{100*b:4.1f}%"
    print(line)
print("\nweights (ukmo, mf, ecmwf, icon, gfs, intercept)\n  fit on Germany:", np.round(W_DE, 2), "\n  fit on USA:    ", np.round(W_US, 2))
