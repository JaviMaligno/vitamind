import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * The layout is an async server component, so it is asserted at the source
 * level: what matters is that it delegates to the schema module instead of
 * hand-rolling a second, drifting copy of the same JSON-LD.
 */
describe("root layout JSON-LD", () => {
  const source = readFileSync(join(process.cwd(), "app/[locale]/layout.tsx"), "utf8");

  it("builds its JSON-LD from the schema module", () => {
    expect(source).toContain("siteGraph");
    expect(source).toMatch(/from "@\/lib\/schema"/);
  });

  it("no longer hand-rolls a WebApplication object inline", () => {
    expect(source).not.toContain('"@type": "WebApplication"');
  });
});
