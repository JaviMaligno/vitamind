import csv, math, sys, os, collections
import numpy as np
from scipy.optimize import nnls
S = os.path.dirname(os.path.abspath(__file__))
M5 = ["ukmo_seamless","meteofrance_seamless","ecmwf_ifs025","icon_seamless","gfs_seamless"]
ALL = ["best_match"] + M5
SH = {"best_match":"best","ukmo_seamless":"ukmo","meteofrance_seamless":"mf","ecmwf_ifs025":"ecmwf","icon_seamless":"icon","gfs_seamless":"gfs"}
MIN_ELEV = 25
R = []
for r in csv.DictReader(open(os.path.join(S, "rows2.csv"))):
    e = float(r["elev"])
    if e < MIN_ELEV: continue
    if any(r[m] == "" for m in ALL): continue
    se = math.sin(math.radians(e)); cs = 1098*se*math.exp(-0.057/se)
    lat, lon = float(r["lat"]), float(r["lon"]); t = r["time_utc"]
    month = int(t[5:7]); smonth = month if lat >= 0 else (month + 5) % 12 + 1  # southern: shift 6 months
    season = ["DJF","DJF","MAM","MAM","MAM","JJA","JJA","JJA","SON","SON","SON","DJF"][smonth-1]
    alat = abs(lat)
    band = "tropics" if alat < 23.5 else "subtrop" if alat < 35 else "midlat" if alat < 50 else "high"
    region = "Americas" if lon < -30 else "EurAfr" if lon < 60 else "AsiaOce"
    R.append(dict(city=r["city"], day=t[:10], elev=e, obs=min(float(r["obs"])/cs, 1.2),
                  kc={m: min(float(r[m])/cs, 1.2) for m in ALL}, zone=f"{region}/{band}", season=season,
                  train=t < "2025-09-01"))
tr = [r for r in R if r["train"]]; te = [r for r in R if not r["train"]]
print(f"rows: train {len(tr)}, test {len(te)}, cities {len(set(r['city'] for r in R))}, zones {len(set(r['zone'] for r in R))}")

def metrics(rows, pred):
    o = np.array([r["obs"] for r in rows]); f = np.array([pred(r) for r in rows])
    mae = np.abs(f-o).mean()
    sunny = o >= 0.75; cloudy = o < 0.5
    fcld = ((f < 0.5) & sunny).sum()/max(sunny.sum(),1); fsun = ((f >= 0.75) & cloudy).sum()/max(cloudy.sum(),1)
    # daily decision: any hour with sun >= 35 deg and kc >= 0.7
    d = collections.defaultdict(lambda: [False, False])
    for r, fv in zip(rows, f):
        if r["elev"] >= 35:
            k = (r["city"], r["day"]); d[k][0] |= r["obs"] >= 0.7; d[k][1] |= fv >= 0.7
    days = list(d.values()); obs_yes = [x for x in days if x[0]]; obs_no = [x for x in days if not x[0]]
    missed = sum(1 for x in obs_yes if not x[1])/max(len(obs_yes),1)   # we said no window, there was sun
    phantom = sum(1 for x in obs_no if x[1])/max(len(obs_no),1)        # we said sun, there was none
    return mae, fcld, fsun, missed, phantom

# --- candidate strategies (all parameters chosen on TRAIN only) ---
def mae_of(rows, m): return np.mean([abs(r["kc"][m]-r["obs"]) for r in rows])
strategies = {}
for m in ALL: strategies[SH[m]] = (lambda m: lambda r: r["kc"][m])(m)
strategies["mean5"] = lambda r: sum(r["kc"][m] for m in M5)/5
strategies["median5"] = lambda r: float(np.median([r["kc"][m] for m in M5]))
def group_best(key):
    g = collections.defaultdict(list)
    for r in tr: g[key(r)].append(r)
    best = {k: min(M5, key=lambda m: mae_of(v, m)) for k, v in g.items()}
    return (lambda r: r["kc"][best.get(key(r), "ecmwf_ifs025")]), best
strategies["best/zone"], BZ = group_best(lambda r: r["zone"])
strategies["best/zone+season"], BZS = group_best(lambda r: (r["zone"], r["season"]))
strategies["best/city"], BC = group_best(lambda r: r["city"])
def group_blend(key):
    g = collections.defaultdict(list)
    for r in tr: g[key(r)].append(r)
    W = {}
    for k, v in g.items():
        X = np.array([[r["kc"][m] for m in M5] + [1.0] for r in v]); y = np.array([r["obs"] for r in v])
        w, _ = nnls(X, y); W[k] = w
    def pred(r):
        w = W.get(key(r)); 
        if w is None: return r["kc"]["ecmwf_ifs025"]
        return float(min(max(np.dot(w, [r["kc"][m] for m in M5] + [1.0]), 0), 1.2))
    return pred, W
strategies["blend/global"], WG = group_blend(lambda r: "all")
strategies["blend/zone"], WZ = group_blend(lambda r: r["zone"])
strategies["blend/zone+season"], WZS = group_blend(lambda r: (r["zone"], r["season"]))

print(f"\n{'strategy':20s} | {'TRAIN mae':>9s} | {'TEST mae':>8s} {'falseCld':>8s} {'falseSun':>8s} | {'day: missed':>11s} {'phantom':>8s}")
for name, p in strategies.items():
    a = metrics(tr, p); b = metrics(te, p)
    print(f"{name:20s} | {a[0]:9.3f} | {b[0]:8.3f} {100*b[1]:7.1f}% {100*b[2]:7.1f}% | {100*b[3]:10.1f}% {100*b[4]:7.1f}%")

print("\nbest single model per zone (chosen on train):", {k: SH[v] for k, v in sorted(BZ.items())})
print("\nTEST MAE by zone:")
zs = sorted(set(r["zone"] for r in R)); cols = ["ecmwf","best","median5","best/zone","blend/zone","blend/zone+season"]
print(f"{'zone':18s} {'n':>6s} " + "".join(f"{c:>18s}" for c in cols))
for z in zs:
    rows = [r for r in te if r["zone"] == z]
    if not rows: continue
    print(f"{z:18s} {len(rows):6d} " + "".join(f"{metrics(rows, strategies[c])[0]:18.3f}" for c in cols))
print("\nTEST MAE by season (hemisphere-adjusted):")
for s in ["DJF","MAM","JJA","SON"]:
    rows = [r for r in te if r["season"] == s]
    print(f"{s:5s} {len(rows):6d} " + "".join(f"{c}={metrics(rows, strategies[c])[0]:.3f}  " for c in cols))
print("\nglobal blend weights (ukmo, mf, ecmwf, icon, gfs, intercept):", np.round(WG["all"], 3))
