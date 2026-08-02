import { it } from "vitest";
import { readFileSync } from "node:fs";
import { myHistoryTool, type ProfileStore, type ProfileRow } from "../lib/mcp-personal";

/**
 * Runs a real dumped profile through the tool against the real weather provider,
 * and prints the window. Skipped unless asked for: it needs the network and a
 * profile dump, so it is a hand tool rather than part of the suite.
 *
 *   PROFILE_JSON=<path> npx vitest run scripts/diag-real-history.test.ts
 */
it.skipIf(!process.env.PROFILE_JSON)("answers the July gap with the real weather", async () => {
  const dump = JSON.parse(readFileSync(process.env.PROFILE_JSON!, "utf8"));
  const row = (Array.isArray(dump) ? dump[0] : dump) as ProfileRow;
  const store: ProfileStore = {
    async getProfile() { return row; },
    async updateHistory() {},
    async updateProfile() {},
  };

  const r = await myHistoryTool(store, "u", { days: 30 }, new Date("2026-08-02T12:00:00Z"));
  if (!("records" in r)) throw new Error(JSON.stringify(r));

  console.log(`ventana ${r.from} → ${r.to} | ${r.records.length} días | ${r.daysNotAnswered} sin respuesta`);
  console.log("fecha       ubicación                  supuesta  uv    ventana        min  fuente     saliste");
  for (const d of [...r.records].reverse()) {
    if (d.date < "2026-07-12") continue;
    const win = d.window ? `${d.window.start}–${d.window.end}` : "—".padEnd(11);
    console.log(
      `${d.date}  ${String(d.cityId).padEnd(24)}  ${String(d.locationAssumed).padEnd(8)}  ${String(d.peakUVI ?? "—").padEnd(4)}  ${win.padEnd(13)}  ${String(d.minutesNeeded ?? "—").padEnd(3)}  ${String(d.uvSource).padEnd(9)}  ${d.wentOutside ?? "—"}`,
    );
  }
});
