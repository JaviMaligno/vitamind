import { describe, it, expect } from "vitest";
import { ORGANIZATION_ID, PERSON_ID, siteGraph } from "@/lib/schema";
import { SITE_URL } from "@/lib/site";

const nodeOfType = (graph: ReturnType<typeof siteGraph>, type: string) =>
  graph["@graph"].find((n) => n["@type"] === type);

describe("siteGraph", () => {
  it("emits Organization, Person and WebApplication in one graph", () => {
    const g = siteGraph({ locale: "es", description: "desc" });
    expect(g["@context"]).toBe("https://schema.org");
    expect(g["@graph"].map((n) => n["@type"])).toEqual(
      expect.arrayContaining(["Organization", "Person", "WebApplication"]),
    );
  });

  it("gives the entity nodes stable @ids anchored to the canonical host", () => {
    const g = siteGraph({ locale: "es", description: "desc" });
    expect(nodeOfType(g, "Organization")!["@id"]).toBe(`${SITE_URL}/#organization`);
    expect(nodeOfType(g, "Person")!["@id"]).toBe(`${SITE_URL}/#author`);
    expect(ORGANIZATION_ID).toBe(`${SITE_URL}/#organization`);
    expect(PERSON_ID).toBe(`${SITE_URL}/#author`);
  });

  it("attributes the application to the Person and publishes it under the Organization", () => {
    const app = nodeOfType(siteGraph({ locale: "es", description: "desc" }), "WebApplication")!;
    expect(app.author).toEqual({ "@id": PERSON_ID });
    expect(app.publisher).toEqual({ "@id": ORGANIZATION_ID });
  });

  it("points the Person at the about page and their other profiles", () => {
    const person = nodeOfType(siteGraph({ locale: "es", description: "desc" }), "Person")!;
    expect(person.url).toBe(`${SITE_URL}/about`);
    // Cast: graph nodes are Record<string, unknown>, and `toContain` needs an
    // array type to typecheck.
    expect(person.sameAs as string[]).toContain("https://javieraguilar.ai");
  });

  it("carries the locale and description it was given", () => {
    const app = nodeOfType(siteGraph({ locale: "fr", description: "la desc" }), "WebApplication")!;
    expect(app.inLanguage).toBe("fr");
    expect(app.description).toBe("la desc");
  });

  it("omits reviewedBy while no reviewer exists", () => {
    const app = nodeOfType(siteGraph({ locale: "es", description: "d" }), "WebApplication")!;
    expect(app.reviewedBy).toBeUndefined();
    expect(JSON.stringify(siteGraph({ locale: "es", description: "d" }))).not.toContain("reviewedBy");
  });

  it("emits reviewedBy once a reviewer is supplied", () => {
    const g = siteGraph({
      locale: "es",
      description: "d",
      reviewer: { name: "Dra. Ejemplo", jobTitle: "Dermatóloga", url: "https://example.org/dra" },
    });
    const app = nodeOfType(g, "WebApplication")!;
    expect(app.reviewedBy).toEqual({
      "@type": "Person",
      name: "Dra. Ejemplo",
      jobTitle: "Dermatóloga",
      url: "https://example.org/dra",
    });
  });

  it("emits a reviewer without a url, since not every clinician has a public profile", () => {
    const g = siteGraph({
      locale: "es",
      description: "d",
      reviewer: { name: "Dr. Ejemplo", jobTitle: "Endocrino" },
    });
    const app = nodeOfType(g, "WebApplication")!;
    expect(app.reviewedBy).toEqual({ "@type": "Person", name: "Dr. Ejemplo", jobTitle: "Endocrino" });
    expect(JSON.stringify(app.reviewedBy)).not.toContain("url");
  });
});
