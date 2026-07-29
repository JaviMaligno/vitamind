import { describe, expect, it } from "vitest";
import { YEAR_STRIP_WIDGET_HTML } from "../generated";

describe("year-strip widget bundle", () => {
  it("is one complete, self-contained MCP App document", () => {
    expect(YEAR_STRIP_WIDGET_HTML).toMatch(/^<!doctype html>/i);
    expect(YEAR_STRIP_WIDGET_HTML).toContain('<div id="app"');
    expect(YEAR_STRIP_WIDGET_HTML).toContain("<script>");
    expect(YEAR_STRIP_WIDGET_HTML).not.toMatch(/<script[^>]+src=/i);
    expect(YEAR_STRIP_WIDGET_HTML).not.toMatch(/<link[^>]+href=/i);
  });

  it("bundles the MCP Apps bridge and widget code", () => {
    expect(YEAR_STRIP_WIDGET_HTML).toContain("Vitamin D Year Strip");
    expect(YEAR_STRIP_WIDGET_HTML).toContain("getvitamind/year-strip");
    expect(YEAR_STRIP_WIDGET_HTML).toContain("ui/initialize");
  });

  it("stays small enough to serve inline from a serverless function", () => {
    expect(new TextEncoder().encode(YEAR_STRIP_WIDGET_HTML).byteLength).toBeLessThan(40_000);
  });
});
