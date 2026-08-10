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

  it("revalidates daily rather than being frozen at build time", () => {
    expect(source).toMatch(/export const revalidate = 86400/);
  });

  it("keeps the split honest: the treated list is exactly the one on record", () => {
    expect(isTreated("madrid")).toBe(true);
    expect(isTreated("valencia")).toBe(false);
  });
});
