import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { isTreated } from "@/lib/phase2-cities";

describe("prose passage gating", () => {
  const source = readFileSync(
    join(process.cwd(), "app/[locale]/[cityPrefix]/[city]/[month]/page.tsx"),
    "utf8",
  );

  it("asks the assignment before rendering the passage", () => {
    expect(source).toMatch(/from "@\/lib\/phase2-cities"/);
    expect(source).toMatch(/isTreated\(/);
  });

  it("renders the passage from the prose module", () => {
    expect(source).toMatch(/from "@\/lib\/sun-prose"/);
  });

  /**
   * This replaces an assertion that pinned `revalidate = 86400`. That test was
   * named "revalidates daily rather than being frozen at build time" and it
   * guarded a value, not a reason — so it would have passed just as happily on
   * a page that HAD started reading a clock, and it gave no warning to anyone
   * who later added one. What actually makes this page safe to freeze is that
   * its render is a pure function of (city, month, DOY_REFERENCE_YEAR), so that
   * is what gets asserted: the static class AND the property that justifies it.
   * Add a clock read to this render path and this test fails, which is the
   * point.
   */
  it("is static, because nothing on its render path reads a clock", () => {
    expect(source).toMatch(/export const revalidate = false/);

    // `todayDoy()` is the one export of lib/solar.ts whose result depends on
    // when it is called. Everything else there derives from its arguments.
    expect(source).not.toMatch(/todayDoy/);

    // A bare `new Date()` or `Date.now()` is a clock read. `new Date(x)` and
    // `new Date(Date.UTC(...))` are deterministic given their arguments, which
    // is how every date on this path is built.
    const renderPath = [
      "app/[locale]/[cityPrefix]/[city]/[month]/page.tsx",
      "lib/sun-copy.ts",
      "lib/sun-prose.ts",
    ];
    for (const file of renderPath) {
      const text = readFileSync(join(process.cwd(), file), "utf8");
      expect(text, `${file} reads a clock`).not.toMatch(/new Date\(\s*\)/);
      expect(text, `${file} reads a clock`).not.toMatch(/Date\.now\(\s*\)/);
    }
  });

  it("keeps the split honest: the treated list is exactly the one on record", () => {
    expect(isTreated("madrid")).toBe(true);
    expect(isTreated("valencia")).toBe(false);
  });
});
