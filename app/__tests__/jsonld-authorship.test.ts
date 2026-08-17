import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * Every JSON-LD block on the site should attribute itself to the same entities,
 * by `@id`, rather than declaring anonymous ones. A FAQPage that names no author
 * is an island: it says a question was answered, not who answered it — which is
 * the one thing this phase exists to establish.
 *
 * Derived from the filesystem rather than a hardcoded list, so a new emitter
 * fails here instead of shipping unattributed.
 */
function filesEmittingJsonLd(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === "__tests__" || entry === ".next") continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      filesEmittingJsonLd(full, acc);
    } else if (/\.tsx?$/.test(entry)) {
      const src = readFileSync(full, "utf8");
      if (src.includes("application/ld+json")) acc.push(full);
    }
  }
  return acc;
}

describe("JSON-LD authorship", () => {
  const root = process.cwd();
  const emitters = filesEmittingJsonLd(join(root, "app")).concat(
    filesEmittingJsonLd(join(root, "components")),
  );

  it("finds the emitters at all, so a passing suite means something", () => {
    expect(emitters.length).toBeGreaterThanOrEqual(4);
  });

  /**
   * The marker is the shared-module call that carries the attribution. Most
   * pages spread `authorship()` into a node they assemble themselves; the
   * sunrise month page hands the whole graph to `sunPageGraph`, which spreads it
   * into both the WebPage and the FAQPage — asserted directly, on the emitted
   * nodes rather than on the source text, in lib/__tests__/schema.test.ts.
   */
  it.each([
    ["app/[locale]/learn/layout.tsx", "authorship()"],
    ["app/[locale]/[cityPrefix]/page.tsx", "authorship()"],
    ["app/[locale]/[cityPrefix]/[city]/page.tsx", "authorship()"],
    ["app/[locale]/[cityPrefix]/[city]/[month]/page.tsx", "sunPageGraph("],
  ])("%s attributes its JSON-LD to the shared entities", (relative, marker) => {
    const src = readFileSync(join(root, relative), "utf8");
    expect(src).toMatch(/from "@\/lib\/schema"/);
    expect(src).toContain(marker);
  });

  it("has no emitter that skips the shared module", () => {
    const unattributed = emitters
      .filter((f) => !readFileSync(f, "utf8").includes("@/lib/schema"))
      .map((f) => f.replace(root, "").replace(/\\/g, "/"));
    expect(unattributed).toEqual([]);
  });
});
