# SURFRAD ground truth: hourly means (stamped at END of hour, UTC) of global solar and UVB.
import urllib.request, datetime, time, json, os, sys, collections
S = os.path.dirname(os.path.abspath(__file__))
ST = {"psu":"Penn State","bon":"Bondville","gwn":"Goodwin Creek","tbl":"Table Mountain","dra":"Desert Rock"}
out = {}
d = datetime.date(2025, 9, 1); end = datetime.date(2026, 8, 31)
days = []
while d <= end: days.append(d); d += datetime.timedelta(days=2)
for code in ST:
    hourly = {}; meta = None; nf = 0
    for day in days:
        yy = day.strftime("%y"); jd = day.timetuple().tm_yday
        url = f"https://gml.noaa.gov/aftp/data/radiation/surfrad/{code}/{day.year}/{code}{yy}{jd:03d}.dat"
        try: txt = urllib.request.urlopen(url, timeout=60).read().decode("latin-1")
        except Exception: continue
        lines = txt.splitlines()
        if meta is None:
            p = lines[1].split(); meta = (float(p[0]), float(p[1]), float(p[2]))
        acc = collections.defaultdict(lambda: [0.0, 0, 0.0, 0])
        for ln in lines[2:]:
            p = ln.split()
            if len(p) < 30: continue
            y, mo, dd, hh, mi = int(p[0]), int(p[2]), int(p[3]), int(p[4]), int(p[5])
            ghi, q1, uvb, q2 = float(p[8]), int(p[9]), float(p[28]), int(p[29])
            end_h = datetime.datetime(y, mo, dd, hh) + datetime.timedelta(hours=1)  # minute in [h, h+1) -> stamp h+1
            a = acc[end_h.strftime("%Y-%m-%dT%H:00")]
            if q1 == 0 and ghi > -50: a[0] += ghi; a[1] += 1
            if q2 == 0 and uvb > -50: a[2] += uvb; a[3] += 1
        for k, a in acc.items():
            if a[1] >= 45: hourly[k] = [a[0]/a[1], (a[2]/a[3]) if a[3] >= 45 else None]
        nf += 1
    out[code] = {"name": ST[code], "lat": meta[0], "lon": meta[1], "elev_m": meta[2], "hourly": hourly}
    print(f"{code}: {nf} files, {len(hourly)} hours", file=sys.stderr, flush=True)
json.dump(out, open(os.path.join(S, "surfrad.json"), "w"))
