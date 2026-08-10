import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import SchemaScript from "@/components/SchemaScript";
import { PERSON_ID, ORGANIZATION_ID } from "@/lib/schema";

/**
 * Rendered with the server renderer rather than testing-library, because that
 * is what actually runs for this markup: the layout is a server component and
 * the tag ships in the initial HTML. React 19 also hoists <script> out of the
 * DOM tree, which would make a jsdom-based assertion test the wrong thing.
 *
 * This replaces a source-grep test that would have passed if the <script> were
 * deleted, if its type attribute changed, or if siteGraph() were computed and
 * never rendered.
 */
function graphFrom(markup: string) {
  // [\s\S] rather than the `s` flag: the tsconfig target predates dotAll.
  const m = markup.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
  if (!m) throw new Error(`no ld+json script in markup: ${markup.slice(0, 200)}`);
  return JSON.parse(m[1]);
}

describe("SchemaScript", () => {
  const markup = renderToStaticMarkup(<SchemaScript locale="es" description="una descripción" />);

  it("emits a JSON-LD script tag", () => {
    expect(markup).toContain('<script type="application/ld+json">');
  });

  it("emits parseable JSON containing the identity graph", () => {
    const graph = graphFrom(markup);
    expect(graph["@context"]).toBe("https://schema.org");
    expect(graph["@graph"].map((n: { "@type": string }) => n["@type"])).toEqual(
      expect.arrayContaining(["Organization", "Person", "WebApplication"]),
    );
  });

  it("attributes the application to the Person node by @id", () => {
    const graph = graphFrom(markup);
    const app = graph["@graph"].find((n: { "@type": string }) => n["@type"] === "WebApplication");
    expect(app.author).toEqual({ "@id": PERSON_ID });
    expect(app.publisher).toEqual({ "@id": ORGANIZATION_ID });
  });

  it("passes the locale and description through to the graph", () => {
    const app = graphFrom(
      renderToStaticMarkup(<SchemaScript locale="lt" description="lietuviškai" />),
    )["@graph"].find((n: { "@type": string }) => n["@type"] === "WebApplication");
    expect(app.inLanguage).toBe("lt");
    expect(app.description).toBe("lietuviškai");
  });

  it("claims no medical reviewer", () => {
    expect(markup).not.toContain("reviewedBy");
  });
});
