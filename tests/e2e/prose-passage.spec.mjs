/**
 * Phase 2 ships to half the sunrise cities. This checks both halves: the passage
 * present where it should be, absent where it should not. A leak into the
 * control group does not break any page — it just quietly makes the experiment
 * unable to answer anything.
 *
 *   BASE_URL=http://localhost:3000 node tests/e2e/prose-passage.spec.mjs
 *
 * ── On the marker, because the obvious one is wrong twice over ──
 *
 * Matching the bare word "latitude"/"latitud" fails: the site footer renders on
 * every page and reads "the solar elevation needed varies with latitude and
 * season". Every control page would report as contaminated.
 *
 * Matching the passage's own phrase — "° de latitud)" / "° latitude)" — fails
 * too, and less visibly. next-intl serialises the WHOLE message bundle into the
 * RSC flight payload of every page, so each control page's HTML carries the
 * untranslated templates "En {city} ({lat}° de latitud), …" verbatim, plus the
 * learn page's "(a partir de ~66,6° de latitud)". Measured on this build:
 * /amanecer/valencia/agosto, which renders no passage at all, carries four of
 * those hits.
 *
 * So the marker has to be something only RENDERING produces, and it is checked
 * against the document with <script> elements removed — the flight payload is
 * served bytes, but it is not the prose a crawler reads. What renders and the
 * template cannot is the interpolated latitude: "(40.4° de latitud)" against the
 * template's "({lat}° de latitud)". Requiring a signed decimal immediately after
 * the opening parenthesis also excludes the learn page's "(a partir de ~66,6° …",
 * where prose separates the parenthesis from the number. Measured on the same
 * build: 1 hit on treated /amanecer/madrid/agosto, 0 on control, against 1 hit
 * for the bare word on BOTH (the footer's "varía con la latitud y la estación").
 *
 * All three regimes open with that parenthetical, so one pattern per locale
 * covers the passage whichever regime a city-month lands in — and only two of
 * the three are reachable from a URL: every one of the 40 sunrise cities is
 * south of the Arctic Circle, so across all 480 city-months 327 render
 * `synthesis` and 153 `none`, and none render `polar`. The polar branch is
 * exercised in `lib/__tests__/sun-prose.test.ts` on Tromsø, which has no page.
 * The two sub-arctic cities below are the closest a URL gets, and both are
 * `synthesis` — asserting "polar" for them here would be asserting a fiction.
 */
const BASE_URL = process.env.BASE_URL ?? "http://localhost:3000";

const ES = /\(-?\d+\.\d+° de latitud\)/;
const EN = /\(-?\d+\.\d+° latitude\)/;

/** The rendered document, minus the RSC payload and any other script content. */
const rendered = (html) => html.replace(/<script\b[\s\S]*?<\/script>/gi, " ");

// Both sides, in Spanish (no prefix) and English, in matched pairs: each treated
// page has a control page of the same regime and latitude band, so a failure
// names which half broke rather than which city is unusual.
const PAGES = [
  { path: "/amanecer/madrid/agosto", marker: ES, treated: true, note: "synthesis" },
  { path: "/en/sunrise/madrid/august", marker: EN, treated: true, note: "synthesis, en" },
  { path: "/amanecer/roma/diciembre", marker: ES, treated: true, note: "no synthesis" },
  { path: "/amanecer/oslo/junio", marker: ES, treated: true, note: "synthesis, sub-arctic" },
  { path: "/amanecer/valencia/agosto", marker: ES, treated: false, note: "synthesis" },
  { path: "/en/sunrise/valencia/august", marker: EN, treated: false, note: "synthesis, en" },
  { path: "/amanecer/lisboa/diciembre", marker: ES, treated: false, note: "no synthesis" },
  { path: "/amanecer/reikiavik/junio", marker: ES, treated: false, note: "synthesis, sub-arctic" },
];

let failures = 0;
const fail = (m) => { console.error(`FAIL ${m}`); failures++; };

for (const { path, marker, treated, note } of PAGES) {
  const res = await fetch(`${BASE_URL}${path}`);
  if (!res.ok) { fail(`${path} -> HTTP ${res.status}`); continue; }
  const has = marker.test(rendered(await res.text()));
  if (treated && !has) fail(`${path} is treated but has no passage`);
  else if (!treated && has) fail(`${path} is control but HAS the passage — the experiment is contaminated`);
  else console.log(`ok   ${treated ? "treated" : "control"}  ${path.padEnd(30)} (${note})`);
}

console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
