/**
 * Asserts the identity graph is in the HTML a crawler gets — not in a module,
 * not after hydration. Run against a running server:
 *
 *   BASE_URL=http://localhost:3000 node tests/e2e/schema-graph.spec.mjs
 *
 * Standalone script, not a @playwright/test spec, matching tests/e2e/.
 */
const BASE_URL = process.env.BASE_URL ?? "http://localhost:3000";

const PAGES = ["/", "/about", "/en/about", "/vitamina-d/madrid", "/amanecer/madrid/agosto"];

let failures = 0;
const fail = (msg) => { console.error(`FAIL ${msg}`); failures++; };

for (const path of PAGES) {
  const res = await fetch(`${BASE_URL}${path}`);
  if (!res.ok) { fail(`${path} -> HTTP ${res.status}`); continue; }
  const html = await res.text();

  const blocks = [...html.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/gs)]
    .map((m) => { try { return JSON.parse(m[1]); } catch { return null; } })
    .filter(Boolean);

  const graph = blocks.find((b) => Array.isArray(b["@graph"]));
  if (!graph) { fail(`${path} has no @graph block`); continue; }

  const types = graph["@graph"].map((n) => n["@type"]);
  for (const t of ["Organization", "Person", "WebApplication"]) {
    if (!types.includes(t)) fail(`${path} graph is missing ${t}`);
  }

  const person = graph["@graph"].find((n) => n["@type"] === "Person");
  const app = graph["@graph"].find((n) => n["@type"] === "WebApplication");
  if (!person?.["@id"]?.endsWith("/#author")) fail(`${path} Person has no stable @id`);
  if (app?.author?.["@id"] !== person?.["@id"]) fail(`${path} author does not resolve to the Person`);
  if (JSON.stringify(graph).includes("reviewedBy")) fail(`${path} claims a reviewer that does not exist`);

  // Every other JSON-LD block on the page must point at those same entities by
  // @id. An unattributed FAQPage says a question was answered, not who answered
  // it — which is the whole claim this phase is making.
  for (const block of blocks) {
    if (Array.isArray(block["@graph"])) continue;
    const t = block["@type"];
    if (!t) continue;
    if (block.author?.["@id"] !== person?.["@id"]) {
      fail(`${path} ${t} block is not attributed to the Person`);
    }
  }

  console.log(`ok   ${path}`);
}

console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
