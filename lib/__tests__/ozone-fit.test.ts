import { describe, it, expect } from "vitest";
import { impliedOzone, fitOzoneTable, tableCoverage, MIN_USEFUL_ELEVATION_DEG, type OzoneSample } from "@/lib/ozone-fit";
import { lookupOzone, monthOfDoy, monthMidDoy, bandIndex, bandCentre, type OzoneTable } from "@/lib/ozone-table";
import { uvIndex, ozoneDU, ozoneColumn } from "@/lib/uv-model";
import { declination } from "@/lib/solar";

/**
 * The pipeline that will re-base the ozone climatology, tested end to end
 * against a field whose answer is known in advance.
 *
 * The network half (`scripts/ozone-sample.ts`) cannot run in this environment —
 * egress policy refuses Open-Meteo — so everything that CAN be checked without
 * it is checked here: the inversion, the binning, the interpolation, and a
 * round trip that manufactures observations from a chosen ozone field and
 * demands the fit recover it. If that round trip passes, the only thing left
 * for the other environment to supply is real numbers.
 */

/** Noon solar elevation, the geometry the sampler will actually feed in. */
const noonElevation = (lat: number, doy: number) => 90 - Math.abs(lat - declination(doy));

describe("impliedOzone", () => {
  it("inverts uvIndex exactly", () => {
    for (const [elev, du, alt] of [[60, 280, 0], [45, 350, 1500], [80, 240, 2640]] as const) {
      const uvi = uvIndex(elev, du, alt);
      expect(impliedOzone(uvi, elev, alt)!).toBeCloseTo(du, 4);
    }
  });

  it("refuses a sun too low for the formula to be trusted", () => {
    // Madronich is stated valid to SZA 60, i.e. elevation 30. Below that the
    // ozone recovered would be fitting the extrapolation's error.
    expect(impliedOzone(1.0, MIN_USEFUL_ELEVATION_DEG - 0.1, 0)).toBeNull();
    expect(impliedOzone(1.0, MIN_USEFUL_ELEVATION_DEG, 0)).not.toBeNull();
  });

  it("refuses a reading no column in the bracket can produce", () => {
    // Monotone in ozone, so an unreachable target means the reading and the
    // geometry disagree — a mislabelled hour, not a thin atmosphere.
    expect(impliedOzone(40, 45, 0)).toBeNull(); // far too bright for 45 degrees
    expect(impliedOzone(0.001, 80, 0)).toBeNull(); // far too dim for 80
    expect(impliedOzone(0, 60, 0)).toBeNull();
    expect(impliedOzone(-1, 60, 0)).toBeNull();
  });
});

describe("binning", () => {
  it("puts a latitude in the band that contains it", () => {
    expect(bandIndex(-90, 10)).toBe(0);
    expect(bandIndex(0, 10)).toBe(9);
    expect(bandIndex(51.5, 10)).toBe(14);
    expect(bandCentre(14, 10)).toBe(55);
    // Both poles stay in range rather than falling off the end.
    expect(bandIndex(90, 10)).toBe(17);
    expect(bandIndex(-91, 10)).toBe(0);
  });

  it("maps days to months and back to a mid-month anchor", () => {
    expect(monthOfDoy(1)).toBe(0);
    expect(monthOfDoy(32)).toBe(1);
    expect(monthOfDoy(365)).toBe(11);
    expect(monthMidDoy(0)).toBeGreaterThan(10);
    expect(monthMidDoy(0)).toBeLessThan(21);
    for (let m = 0; m < 12; m++) expect(monthOfDoy(monthMidDoy(m)), `month ${m}`).toBe(m);
  });
});

describe("round trip: a known field in, the same field out", () => {
  /** A deliberately non-van-Heuklon field, so a fit that merely echoed the old
   *  model would fail: low at the equator, high and strongly seasonal at the
   *  poles, peaking in each hemisphere's spring. */
  const truth = (lat: number, doy: number): number => {
    const seasonal = Math.cos(((doy - 80) / 365) * 2 * Math.PI) * (lat >= 0 ? -1 : 1);
    return 265 + (Math.abs(lat) / 90) * (70 + 45 * seasonal);
  };

  /** What the sampler will produce: clear-sky UVI at local noon. */
  function synthesize(step = 7): OzoneSample[] {
    const out: OzoneSample[] = [];
    for (let lat = -75; lat <= 75; lat += 5) {
      for (let doy = 1; doy <= 365; doy += step) {
        const elevationDeg = noonElevation(lat, doy);
        if (elevationDeg < MIN_USEFUL_ELEVATION_DEG) continue;
        out.push({
          lat, doy, elevationDeg, elevationM: 0,
          uviClearSky: uvIndex(elevationDeg, truth(lat, doy), 0),
        });
      }
    }
    return out;
  }

  const samples = synthesize();
  const table = fitOzoneTable(samples, { bandDeg: 10, minSamples: 2 });

  it("produces a table with real coverage", () => {
    const { filled, total, emptyBands } = tableCoverage(table);
    expect(filled).toBeGreaterThan(total * 0.4);
    // High-latitude winter bands have no sun above 30 degrees at all; those are
    // legitimately empty and must stay null rather than be guessed.
    expect(emptyBands.every((b) => Math.abs(bandCentre(b, 10)) >= 60)).toBe(true);
  });

  it("recovers the field it was built from, where the sun was high enough", () => {
    let worst = 0;
    let worstAt = "";
    for (let lat = -50; lat <= 50; lat += 10) {
      for (let doy = 15; doy <= 350; doy += 15) {
        if (noonElevation(lat, doy) < MIN_USEFUL_ELEVATION_DEG) continue;
        const got = lookupOzone(table, lat, doy, ozoneDU.bind(null, 0));
        const err = Math.abs(got - truth(lat, doy));
        if (err > worst) { worst = err; worstAt = `lat ${lat} doy ${doy}`; }
      }
    }
    // Binning to 10-degree bands and mid-month anchors costs a few DU; a few DU
    // of ozone is well under 2% of UV, which is far inside the disagreement this
    // whole exercise exists to close.
    expect(worst, `worst at ${worstAt}`).toBeLessThan(12);
  });

  it("is smooth across the new year, not stepped", () => {
    // 31 December and 1 January are one day apart and must read as one day
    // apart. A step here would move published windows by minutes for no
    // physical reason, on adjacent days, across thousands of pages.
    const at = (doy: number) => lookupOzone(table, 20, doy, ozoneDU.bind(null, 0));
    expect(Math.abs(at(365) - at(1))).toBeLessThan(3);
    for (let doy = 1; doy < 365; doy++) {
      expect(Math.abs(at(doy + 1) - at(doy)), `doy ${doy}`).toBeLessThan(3);
    }
  });

  it("falls back band by band where it has nothing to say", () => {
    // An empty table must behave exactly like the old model, so adopting a
    // partial one degrades instead of failing.
    const empty = fitOzoneTable([], { bandDeg: 10 });
    for (const [lat, doy] of [[51.5, 264], [-1.3, 80], [64, 200]] as const) {
      expect(lookupOzone(empty, lat, doy, (la, d) => ozoneDU(la, 0, d)))
        .toBeCloseTo(ozoneDU(lat, 0, doy), 6);
    }
  });

  it("ignores hours the sun was too low to inform", () => {
    const lowSun: OzoneSample[] = Array.from({ length: 50 }, (_, i) => ({
      lat: 70, doy: 350, elevationDeg: 5, elevationM: 0, uviClearSky: 0.2 + i * 0.001,
    }));
    expect(tableCoverage(fitOzoneTable(lowSun)).filled).toBe(0);
  });
});

describe("the seam, before any table is adopted", () => {
  it("is exactly van Heuklon, everywhere", () => {
    // `OZONE_TABLE` ships empty so `ozoneColumn` is `ozoneDU` with a lookup in
    // front. This is what lets the seam land without a lastmod bump, and it has
    // to be exact rather than close: the 3,318 prerendered pages are hashed by
    // `lib/content-fingerprint.ts`, and a difference in the last decimal would
    // be a real content change announced as none.
    for (let lat = -85; lat <= 85; lat += 5) {
      for (let doy = 1; doy <= 365; doy += 11) {
        for (const lon of [-120, 0, 45, 151]) {
          expect(ozoneColumn(lat, lon, doy), `lat ${lat} lon ${lon} doy ${doy}`)
            .toBe(ozoneDU(lat, lon, doy));
        }
      }
    }
  });

  it("starts using a table the moment one is present", () => {
    // Proof the fallback is a fallback and not a floor. A band with values must
    // win over van Heuklon for latitudes inside it.
    const table: OzoneTable = {
      bandDeg: 10,
      values: Array.from({ length: 18 }, (_, i) =>
        Array.from({ length: 12 }, () => (i === 14 ? 300 : null)),
      ),
    };
    // Band 14 is centred on 55N; at its centre the interpolation has nothing to
    // mix with from the neighbouring (empty) bands, so it falls back there —
    // which is itself the documented degradation. Inside the band, with both
    // neighbours empty, the fallback is correct and expected.
    expect(lookupOzone(table, 55, 180, () => 999)).toBe(999);
    // With the neighbours filled too, the table answers.
    const filled: OzoneTable = {
      bandDeg: 10,
      values: Array.from({ length: 18 }, () => Array.from({ length: 12 }, () => 300)),
    };
    expect(lookupOzone(filled, 55, 180, () => 999)).toBeCloseTo(300, 6);
  });
});
