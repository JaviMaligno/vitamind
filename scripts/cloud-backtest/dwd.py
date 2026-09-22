import subprocess, zipfile, io, json, os, sys, collections, datetime
S = os.path.dirname(os.path.abspath(__file__))
ST = {"01048":("Dresden",51.1278,13.7543),"01420":("Frankfurt",50.0259,8.5213),"01443":("Freiburg",48.0232,7.8343),
      "01975":("Hamburg",53.6332,9.9881),"02712":("Konstanz",47.6952,9.1307),"02932":("Leipzig",51.4347,12.2396),
      "03015":("Lindenberg",52.2085,14.1180),"03631":("Norderney",53.7123,7.1519),"03987":("Potsdam",52.3812,13.0622),
      "04271":("Rostock",54.1803,12.0808)}
B = "https://opendata.dwd.de/climate_environment/CDC/observations_germany/climate/10_minutes/solar/recent/"
out = {}
for sid, (name, lat, lon) in ST.items():
    z = zipfile.ZipFile(io.BytesIO(subprocess.run(["curl","-s","--max-time","120",f"{B}10minutenwerte_SOLAR_{sid}_akt.zip"],capture_output=True,check=True).stdout))
    txt = z.read([n for n in z.namelist() if n.startswith("produkt")][0]).decode("latin-1").splitlines()
    hdr = [h.strip() for h in txt[0].split(";")]; iT, iG = hdr.index("MESS_DATUM"), hdr.index("GS_10")
    acc = collections.defaultdict(lambda: [0.0, 0])
    for ln in txt[1:]:
        p = [x.strip() for x in ln.split(";")]
        if len(p) <= iG: continue
        g = float(p[iG])
        if g < 0: continue  # -999 missing
        t = datetime.datetime.strptime(p[iT], "%Y%m%d%H%M")  # END of the 10-min interval, UTC
        stamp = (t - datetime.timedelta(minutes=1)).replace(minute=0) + datetime.timedelta(hours=1)
        a = acc[stamp.strftime("%Y-%m-%dT%H:00")]; a[0] += g * 10000 / 600; a[1] += 1
    hourly = {k: [a[0]/a[1], None] for k, a in acc.items() if a[1] == 6 and "2025-09-01" <= k[:10] <= "2026-08-31"}
    out["dwd" + sid] = {"name": name, "lat": lat, "lon": lon, "hourly": hourly}
    print(name, len(hourly), file=sys.stderr, flush=True)
json.dump(out, open(os.path.join(S, "dwd.json"), "w"))
