import { describe, expect, it } from "vitest";
import { YEAR_STRIP_WIDGET_HTML } from "../year-strip/generated";
import { DAY_CURVE_WIDGET_HTML } from "../day-curve/generated";
import { PROFILE_WIDGET_HTML } from "../profile/generated";
import { HISTORY_WIDGET_HTML } from "../history/generated";
import { FORECAST_WIDGET_HTML } from "../forecast/generated";

/**
 * Properties every widget bundle must hold, checked on all of them at once so a
 * new widget cannot quietly skip them.
 */
const BUNDLES: Array<[string, string]> = [
  ["year-strip", YEAR_STRIP_WIDGET_HTML],
  ["day-curve", DAY_CURVE_WIDGET_HTML],
  ["profile", PROFILE_WIDGET_HTML],
  ["history", HISTORY_WIDGET_HTML],
  ["forecast", FORECAST_WIDGET_HTML],
];

describe.each(BUNDLES)("%s bundle", (_name, html) => {
  it("is one complete, self-contained MCP App document", () => {
    expect(html).toMatch(/^<!doctype html>/i);
    expect(html).toContain('<div id="app"');
    expect(html).toContain("<script>");
    // A widget runs inside a sandboxed iframe under the host's CSP: anything it
    // has to fetch is something it will not get.
    expect(html).not.toMatch(/<script[^>]+src=/i);
    expect(html).not.toMatch(/<link[^>]+href=/i);
  });

  it("speaks the MCP Apps handshake", () => {
    expect(html).toContain("ui/initialize");
    expect(html).toContain("tool-result");
  });

  it("stays small enough to serve inline on every resources/read", () => {
    // The ceiling is deliberately tight. The first cut of this pipeline shipped
    // 305KB because the official App class drags the MCP SDK and zod into the
    // bundle; the hand-rolled bridge brought it to single digits. A regression
    // back to that would be invisible without this line.
    expect(new TextEncoder().encode(html).byteLength).toBeLessThan(40_000);
  });

  it("carries no zod", () => {
    expect(html).not.toMatch(/_zod|zod\/v4/);
  });
});
