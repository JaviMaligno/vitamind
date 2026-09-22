# Measured UVB (SURFRAD) vs three ways of forecasting the UV that cloud lets through.
# Needs surfrad.json and surfrad_rows.json (python surfrad.py; python ground.py surfrad.json).
import json, math, os, urllib.request, collections
import numpy as np
S = os.path.dirname(os.path.abspath(__file__))
rows = json.load(open(os.path.join(S, "surfrad_rows.json"))); G = json.load(open(os.path.join(S, "surfrad.json")))
M5 = ["ukmo_seamless","meteofrance_seamless","ecmwf_ifs025","icon_seamless","gfs_seamless"]
om = {}
for code, st in G.items():
    # previous-runs' uv_index_previous_day1 comes back null, so Open-Meteo's UV is
    # taken from the historical host: short lead, i.e. an ADVANTAGE to method A.
    h = json.load(urllib.request.urlopen(f"https://historical-forecast-api.open-meteo.com/v1/forecast?latitude={st['lat']}&longitude={st['lon']}&hourly=uv_index,uv_index_clear_sky&timezone=GMT&start_date=2025-09-01&end_date=2026-08-31", timeout=120))["hourly"]
    for t, u, c in zip(h["time"], h["uv_index"], h["uv_index_clear_sky"]):
        if u is not None and c and c > 0.5: om[(code, t)] = u / c
for code in G:  # measured cloud modification factor: UVB over a clear-sky power law fitted per station
    rs = [r for r in rows if r["st"] == code and r["uvb"] and r["uvb"] > 0]
    cl = [r for r in rs if r["gnd"] >= 0.95]
    b, a = np.polyfit(np.log([math.sin(math.radians(r["e"])) for r in cl]), np.log([r["uvb"] for r in cl]), 1)
    print(f"{code}: clear-sky UVB ~ sin(elev)^{b:.2f}")
    for r in rs: r["cmf"] = r["uvb"] / math.exp(a + b*math.log(math.sin(math.radians(r["e"]))))
ok = [r for r in rows if "cmf" in r and (r["st"], r["t"]) in om and all(r[m] is not None for m in M5)]
for r in ok: r["med"] = float(np.median([r[m] for m in M5])); r["om"] = om[(r["st"], r["t"])]
train = [r for r in ok if r["st"] in ("psu", "tbl")]; test = [r for r in ok if r["st"] not in ("psu", "tbl")]
ps = np.linspace(0.5, 1.2, 71)
p = ps[np.argmin([np.mean([abs(min(r["med"],1.05)**q - r["cmf"]) for r in train]) for q in ps])]
M = {"A. Open-Meteo uv/uv_clear (short lead)": lambda r: r["om"],
     "B. median-5 irradiance ratio (day-ahead)": lambda r: min(r["med"], 1.05),
     f"C. median-5 ratio ^{p:.2f} (day-ahead)": lambda r: min(r["med"], 1.05) ** p}
def day(rs, f):
    d = collections.defaultdict(lambda: [False, False])
    for r in rs:
        if r["e"] >= 35: k = (r["st"], r["t"][:10]); d[k][0] |= r["cmf"] >= 0.7; d[k][1] |= f(r) >= 0.7
    v = list(d.values()); y = [x for x in v if x[0]]; n = [x for x in v if not x[0]]
    return sum(1 for x in y if not x[1])/len(y), sum(1 for x in n if x[1])/len(n)
print(f"TEST stations bon+gwn+dra, n={len(test)}")
for k, f in M.items():
    e = [f(r) - r["cmf"] for r in test]; a, b = day(test, f)
    print(f"{k:44s} MAE {np.mean(np.abs(e)):.3f} bias {np.mean(e):+.3f}  days missed {100*a:.1f}% invented {100*b:.1f}%")
