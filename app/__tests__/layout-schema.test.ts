import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * The layout is an async server component, so the only thing assertable here is
 * its source. That is a weak instrument, so it is aimed narrowly: whether the
 * layout still delegates its JSON-LD instead of growing a second, drifting copy.
 *
 * What the graph actually contains is asserted where it can be rendered —
 * components/__tests__/SchemaScript.test.tsx — and that it reaches served HTML
 * is asserted in tests/e2e/schema-graph.spec.mjs. This file only covers the gap
 * between them: that the layout renders the component at all.
 */
describe("root layout JSON-LD", () => {
  const source = readFileSync(join(process.cwd(), "app/[locale]/layout.tsx"), "utf8");

  it("renders the SchemaScript component", () => {
    expect(source).toMatch(/<SchemaScript\b/);
    expect(source).toMatch(/from "@\/components\/SchemaScript"/);
  });

  it("passes it the request's locale and description", () => {
    expect(source).toMatch(/<SchemaScript[^/]*locale=\{locale\}/);
    expect(source).toMatch(/<SchemaScript[^/]*description=\{DESCRIPTIONS\[locale\]/);
  });

  it("hand-rolls no JSON-LD of its own", () => {
    expect(source).not.toContain('"@type"');
    expect(source).not.toContain("application/ld+json");
  });
});
