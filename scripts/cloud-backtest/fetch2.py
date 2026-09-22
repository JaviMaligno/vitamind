# Two years, 73 cities: satellite irradiance (truth) vs day-before forecasts of 5 models + best_match.
import json, math, time, calendar, urllib.request, sys, csv, os
S = os.path.dirname(os.path.abspath(__file__))
cities = json.load(open(os.path.join(S, "cities.json")))
MODELS = ["best_match","ukmo_seamless","meteofrance_seamless","ecmwf_ifs025","icon_seamless","gfs_seamless"]
PERIODS = [("2024-09-01","2025-08-31"),("2025-09-01","2026-09-20")]
def get(url):
    err = None
    for a in range(6):
        try: return json.load(urllib.request.urlopen(url, timeout=120))
        except Exception as e: err = e; time.sleep(5*(a+1))
    raise err
def elev(lat, lon, h):
    n = h/24.0 - 10957.5
    L = (280.46 + 0.9856474*n) % 360; g = math.radians((357.528 + 0.9856003*n) % 360)
    lam = math.radians(L + 1.915*math.sin(g) + 0.02*math.sin(2*g)); eps = math.radians(23.439 - 4e-7*n)
    dec = math.asin(math.sin(eps)*math.sin(lam)); ra = math.atan2(math.cos(eps)*math.sin(lam), math.cos(lam))
    gmst = (18.697374558 + 24.06570982441908*n) % 24; ha = math.radians(gmst*15 + lon - math.degrees(ra))
    la = math.radians(lat)
    return math.degrees(math.asin(math.sin(la)*math.sin(dec) + math.cos(la)*math.cos(dec)*math.cos(ha)))
out = open(os.path.join(S, "rows2.csv"), "w", newline=""); w = csv.writer(out)
w.writerow(["city","lat","lon","time_utc","elev","obs"] + MODELS)
for c in cities:
    n0 = 0
    for a, b in PERIODS:
        base = f"latitude={c['lat']}&longitude={c['lon']}&timezone=GMT&start_date={a}&end_date={b}"
        try:
            sat = get(f"https://satellite-api.open-meteo.com/v1/archive?{base}&hourly=shortwave_radiation")["hourly"]
            fc = get(f"https://previous-runs-api.open-meteo.com/v1/forecast?{base}&hourly=shortwave_radiation_previous_day1&models={','.join(MODELS)}")["hourly"]
        except Exception as e:
            print(f"{c['name']} {a}: FAILED {e}", file=sys.stderr, flush=True); continue
        idx = {t: i for i, t in enumerate(fc["time"])}
        for i, t in enumerate(sat["time"]):
            o = sat["shortwave_radiation"][i]
            if o is None or t not in idx: continue
            e = elev(c["lat"], c["lon"], calendar.timegm(time.strptime(t, "%Y-%m-%dT%H:%M"))/3600 - 0.5)
            if e < 15: continue
            j = idx[t]
            vals = [fc.get(f"shortwave_radiation_previous_day1_{m}", [None]*len(fc["time"]))[j] for m in MODELS]
            w.writerow([c["name"], c["lat"], c["lon"], t, round(e, 2), o] + ["" if v is None else v for v in vals]); n0 += 1
        time.sleep(1)
    print(f"{c['name']}: {n0}", file=sys.stderr, flush=True); out.flush()
out.close()
