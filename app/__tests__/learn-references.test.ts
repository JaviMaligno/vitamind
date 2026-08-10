import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import es from "@/messages/es.json";
import en from "@/messages/en.json";
import fr from "@/messages/fr.json";
import de from "@/messages/de.json";
import ru from "@/messages/ru.json";
import lt from "@/messages/lt.json";

describe("learn page bibliography", () => {
  const source = readFileSync(join(process.cwd(), "app/[locale]/learn/page.tsx"), "utf8");

  it("reads citations from the module, not from translations", () => {
    expect(source).toMatch(/from "@\/lib\/references"/);
    expect(source).not.toMatch(/t\.raw\(/);
  });

  it.each([["es", es], ["en", en], ["fr", fr], ["de", de], ["ru", ru], ["lt", lt]] as const)(
    "%s carries no citation arrays any more",
    (_locale, messages) => {
      for (const block of Object.values(messages.learn as Record<string, unknown>)) {
        if (!block || typeof block !== "object") continue;
        for (const question of Object.values(block)) {
          if (question && typeof question === "object") expect(question).not.toHaveProperty("sources");
        }
      }
    },
  );
});
