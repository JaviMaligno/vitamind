import json, math, time, calendar, urllib.request, os, sys, collections
import numpy as np
S = os.path.dirname(os.path.abspath(__file__))
def elev(lat, lon, h):
    n = h/24.0 - 10957.5
    L = (280.46 + 0.9856474*n) % 360; g = math.radians((357.528 + 0.9856003*n) % 360)
    lam = math.radians(L + 1.915*math.sin(g) + 0.02*math.sin(2*g)); eps = math.radians(23.439 - 4e-7*n)
    dec = math.asin(math.sin(eps)*math.sin(lam)); ra = math.atan2(math.cos(eps)*math.sin(lam), math.cos(lam))
    gmst = (18.697374558 + 24.06570982441908*n) % 24; ha = math.radians(gmst*15 + lon - math.degrees(ra))
    la = math.radians(lat)
    return math.degrees(math.asin(math.sin(la)*math.sin(dec) + math.cos(la)*math.cos(dec)*math.cos(ha)))
MODELS = ["best_match","ukmo_seamless","meteofrance_seamless","ecmwf_ifs025","icon_seamless","gfs_seamless"]
SH = {"best_match":"best","ukmo_seamless":"ukmo","meteofrance_seamless":"mf","ecmwf_ifs025":"ecmwf","icon_seamless":"icon","gfs_seamless":"gfs"}
def get(url):
    for a in range(5):
        try: return json.load(urllib.request.urlopen(url, timeout=120))
        except Exception as e: err = e; time.sleep(5)
    raise err
G = json.load(open(os.path.join(S, sys.argv[1])))
rows = []
for code, st in G.items():
    base = f"latitude={st['lat']}&longitude={st['lon']}&timezone=GMT&start_date=2025-09-01&end_date=2026-08-31"
    sat = get(f"https://satellite-api.open-meteo.com/v1/archive?{base}&hourly=shortwave_radiation")["hourly"]
    fc = get(f"https://previous-runs-api.open-meteo.com/v1/forecast?{base}&hourly=shortwave_radiation_previous_day1,uv_index_previous_day1,uv_index_clear_sky_previous_day1,cloud_cover_previous_day1&models={','.join(MODELS)}")["hourly"]
    si = {t: i for i, t in enumerate(sat["time"])}; fi = {t: i for i, t in enumerate(fc["time"])}
    for t, (ghi, uvb) in st["hourly"].items():
        if t not in fi or t not in si: continue
        e = elev(st["lat"], st["lon"], calendar.timegm(time.strptime(t, "%Y-%m-%dT%H:%M"))/3600 - 0.5)
        if e < 25: continue
        se = math.sin(math.radians(e)); cs = 1098*se*math.exp(-0.057/se)
        j = fi[t]
        r = dict(st=code, t=t, e=e, gnd=min(ghi/cs, 1.2), uvb=uvb,
                 sat=None if sat["shortwave_radiation"][si[t]] is None else min(sat["shortwave_radiation"][si[t]]/cs, 1.2))
        for m in MODELS:
            v = fc.get(f"shortwave_radiation_previous_day1_{m}", [None]*len(fc["time"]))[j]
            r[m] = None if v is None else min(v/cs, 1.2)
        u = fc.get("uv_index_previous_day1_best_match", [None]*len(fc["time"]))[j]
        uc = fc.get("uv_index_clear_sky_previous_day1_best_match", [None]*len(fc["time"]))[j]
        r["om_uv_ratio"] = (u/uc) if (u is not None and uc) else None
        r["cc_best"] = fc.get("cloud_cover_previous_day1_best_match", [None]*len(fc["time"]))[j]
        rows.append(r)
    print(code, sum(1 for r in rows if r["st"] == code), file=sys.stderr, flush=True)
json.dump(rows, open(os.path.join(S, sys.argv[1].replace(".json","_rows.json")), "w"))

print("\n1) DOES THE SATELLITE RANK MODELS LIKE THE GROUND DOES?  (day-ahead, sun > 25 deg, MAE of clear-sky index)")
ok = [r for r in rows if r["sat"] is not None and all(r[m] is not None for m in MODELS)]
print(f"   n={len(ok)}   satellite vs ground itself: MAE {np.mean([abs(r['sat']-r['gnd']) for r in ok]):.3f}")
print(f"   {'model':8s} {'vs GROUND':>10s} {'vs SATELLITE':>13s}")
for m in MODELS + ["median5", "mean5"]:
    f = (lambda r: float(np.median([r[x] for x in MODELS[1:]]))) if m == "median5" else (lambda r: float(np.mean([r[x] for x in MODELS[1:]]))) if m == "mean5" else (lambda r, m=m: r[m])
    print(f"   {SH.get(m, m):8s} {np.mean([abs(f(r)-r['gnd']) for r in ok]):10.3f} {np.mean([abs(f(r)-r['sat']) for r in ok]):13.3f}")
print("   per station, vs GROUND:")
for code in G:
    rs = [r for r in ok if r["st"] == code]
    if rs: print(f"   {code}: " + "  ".join(f"{SH[m]}={np.mean([abs(r[m]-r['gnd']) for r in rs]):.3f}" for m in MODELS))

print("\n2) UV: HOW DOES MEASURED UVB FALL WITH CLOUD, COMPARED WITH TOTAL RADIATION?")
for code in G:
    rs = [r for r in rows if r["st"] == code and r["uvb"] is not None and r["uvb"] > 0]
    clear = [r for r in rs if r["gnd"] >= 0.95]
    if len(clear) < 30: print(f"   {code}: too few clear hours with UVB ({len(clear)})"); continue
    X = np.log([math.sin(math.radians(r["e"])) for r in clear]); Y = np.log([r["uvb"] for r in clear])
    b, a = np.polyfit(X, Y, 1)
    for r in rs: r["cmf_uv"] = r["uvb"]/math.exp(a + b*math.log(math.sin(math.radians(r["e"]))))
    bins = [(0,.3),(.3,.5),(.5,.7),(.7,.85),(.85,.95),(.95,1.3)]
    line = []
    for lo, hi in bins:
        v = [r["cmf_uv"] for r in rs if lo <= r["gnd"] < hi]
        line.append(f"kc {lo:.2f}-{hi:.2f}: UV x{np.median(v):.2f} (n={len(v)})" if v else "")
    print(f"   {code} (clear-sky UVB ~ sin(e)^{b:.2f}):"); [print("      " + l) for l in line if l]
    # How good are three ways of getting UV attenuation from the FORECAST, vs measured UV attenuation?
    good = [r for r in rs if r["ecmwf_ifs025"] is not None and r["om_uv_ratio"] is not None and r["cc_best"] is not None]
    if good:
        m_om = np.mean([abs(r["om_uv_ratio"]-r["cmf_uv"]) for r in good])
        m_ec = np.mean([abs(min(r["ecmwf_ifs025"],1.05)-r["cmf_uv"]) for r in good])
        m_bm = np.mean([abs(min(r["best_match"],1.05)-r["cmf_uv"]) for r in good])
        print(f"      forecast UV attenuation error vs measured: Open-Meteo uv/uv_clear {m_om:.3f} | best_match GHI ratio {m_bm:.3f} | ECMWF GHI ratio {m_ec:.3f}  (n={len(good)})")
