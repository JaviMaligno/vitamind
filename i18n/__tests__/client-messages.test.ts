import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { CLIENT_NAMESPACES, pickClientMessages } from "@/i18n/client-messages";
import { routing } from "@/i18n/routing";

/**
 * The net under `pickClientMessages`.
 *
 * `app/[locale]/layout.tsx` now passes only the namespaces in
 * CLIENT_NAMESPACES to <NextIntlClientProvider>. If a client component asks for
 * anything else, next-intl does NOT throw: its default `onError` is a
 * `console.error` and its default `getMessageFallback` joins namespace and key,
 * so the miss renders the LITERAL KEY PATH (e.g. `sunrisePage.vitdCta`) into
 * SSR HTML that crawlers index, with a 200 status. There is no custom `onError`
 * in this repo, and every component test that mounts the provider passes a
 * subset built by the same helper, so nothing else in the suite can see the
 * mistake.
 *
 * So this test does not check the helper against a list someone wrote down. It
 * re-derives the client message requirement FROM THE SOURCE — walking the
 * import graph out of every "use client" module and reading the actual
 * `useTranslations` calls — and asserts the picked subset satisfies it in all
 * six locales.
 *
 * The rejected alternative was a runtime check: give the provider an `onError`
 * that throws in development. That was rejected because it only fires on a code
 * path someone happens to render, and the pages that matter here (city, hub and
 * month SEO pages, six locales) are exactly the ones nobody opens locally. A
 * static walk covers every branch, including the error boundary and the offline
 * page.
 */

const ROOT = process.cwd();
const SOURCE_DIRS = ["app", "components", "context", "hooks", "lib", "i18n"];
const EXTENSIONS = [".ts", ".tsx"];

function isTestPath(path: string): boolean {
  return path.includes("__tests__") || /\.test\.tsx?$/.test(path);
}

function listSourceFiles(): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      if (entry === "node_modules" || entry.startsWith(".")) continue;
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) {
        walk(full);
      } else if (EXTENSIONS.some((ext) => entry.endsWith(ext)) && !isTestPath(full)) {
        out.push(full);
      }
    }
  };
  for (const dir of SOURCE_DIRS) walk(join(ROOT, dir));
  return out;
}

/**
 * Resolve an import specifier the way the bundler does for THIS repo only:
 * `@/*` is the repo root (tsconfig paths) and relative specifiers may omit the
 * extension or name a directory with an index file. Bare package specifiers
 * return null — a node_module cannot call this app's `useTranslations` with an
 * app namespace, and walking into them would explode the closure.
 */
function resolveImport(fromFile: string, specifier: string): string | null {
  let base: string;
  if (specifier.startsWith("@/")) base = join(ROOT, specifier.slice(2));
  else if (specifier.startsWith(".")) base = resolve(dirname(fromFile), specifier);
  else return null;

  const candidates = [
    base,
    ...EXTENSIONS.map((ext) => base + ext),
    ...EXTENSIONS.map((ext) => join(base, "index" + ext)),
  ];
  for (const candidate of candidates) {
    try {
      if (statSync(candidate).isFile()) return candidate;
    } catch {
      // not this one
    }
  }
  return null;
}

const IMPORT_RE = /(?:import|export)[\s\S]*?from\s*["']([^"']+)["']|import\s*\(\s*["']([^"']+)["']\s*\)/g;

function importsOf(source: string, file: string): string[] {
  const out: string[] = [];
  for (const match of source.matchAll(IMPORT_RE)) {
    const specifier = match[1] ?? match[2];
    if (!specifier) continue;
    const resolved = resolveImport(file, specifier);
    if (resolved) out.push(resolved);
  }
  return out;
}

const USE_CLIENT_RE = /^\s*(?:\/\/[^\n]*\n|\/\*[\s\S]*?\*\/|\s)*["']use client["']/;

/**
 * Every module that ends up in a client bundle: the "use client" entry points
 * plus everything they import, transitively. The transitive part is not
 * optional — a module WITHOUT the directive still runs in the browser when a
 * client module imports it (`hooks/useCityDisplayName.ts` is exactly that), and
 * a per-file grep for "use client" would miss it.
 */
function clientModuleGraph(): { files: Set<string>; entryPoints: string[] } {
  const all = listSourceFiles();
  const sources = new Map(all.map((f) => [f, readFileSync(f, "utf8")]));
  const entryPoints = all.filter((f) => USE_CLIENT_RE.test(sources.get(f)!));

  const seen = new Set<string>();
  const queue = [...entryPoints];
  while (queue.length) {
    const file = queue.pop()!;
    if (seen.has(file)) continue;
    seen.add(file);
    const source = sources.get(file) ?? readFileSync(file, "utf8");
    sources.set(file, source);
    for (const next of importsOf(source, file)) {
      if (!seen.has(next)) queue.push(next);
    }
  }
  return { files: seen, entryPoints };
}

/** `useTranslations("install.modal")` → namespace "install.modal"; the top-level
 *  namespace the provider must carry is the segment before the first dot. */
function topLevel(namespace: string): string {
  return namespace.split(".")[0];
}

type Demand = {
  /** Top-level namespace the provider must ship. */
  namespace: string;
  /** Full dotted path, when it was statically resolvable, else null. */
  key: string | null;
  file: string;
  detail: string;
};

const DECL_RE =
  /(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*useTranslations\s*\(\s*([^)]*?)\s*\)/g;
const STRING_ARG_RE = /^["']([^"']*)["']$/;

/**
 * Read one client module's translation demands.
 *
 * Two shapes exist in this repo and they fail differently:
 *  - `useTranslations("dashboard")` — the namespace is right there.
 *  - `useTranslations()` — ROOT-scoped, so the namespace hides in the dotted key
 *    of each call site (`t("footer.about")`). Five modules do this and it is the
 *    shape a namespace audit misses; `app`, `footer`, `explore` and `legend`
 *    reach the browser ONLY this way.
 */
function demandsOf(file: string, source: string): Demand[] {
  const demands: Demand[] = [];
  const label = relative(ROOT, file);

  // Anything that would hand the browser the whole message object again defeats
  // the point of the filter, so it is a failure rather than something to parse.
  if (/\buseMessages\s*\(/.test(source)) {
    throw new Error(
      `${label} calls useMessages() in a client module. That reads the entire ` +
        `provider payload, so it would silently depend on namespaces this filter ` +
        `removes. Use useTranslations(namespace) instead.`,
    );
  }

  const rootScoped: string[] = [];
  for (const match of source.matchAll(DECL_RE)) {
    const [, variable, rawArg] = match;
    if (rawArg === "") {
      rootScoped.push(variable);
      continue;
    }
    const literal = STRING_ARG_RE.exec(rawArg);
    if (!literal) {
      throw new Error(
        `${label} calls useTranslations(${rawArg}) with a namespace this test ` +
          `cannot resolve statically. A dynamic namespace cannot be checked ` +
          `against the client subset, and a miss renders the literal key path ` +
          `into indexed HTML. Use a string literal.`,
      );
    }
    demands.push({
      namespace: topLevel(literal[1]),
      key: null,
      file: label,
      detail: `useTranslations("${literal[1]}")`,
    });
  }

  // Every useTranslations occurrence must have been one of the declarations
  // above. An inline `useTranslations("x")("y")` or a re-exported translator
  // would slip past DECL_RE, and silently narrowing the checked set is the one
  // way this test could pass while production leaked key paths.
  const occurrences = (source.match(/\buseTranslations\s*\(/g) ?? []).length;
  const declared = (source.match(DECL_RE) ?? []).length;
  if (occurrences !== declared) {
    throw new Error(
      `${label} has ${occurrences} useTranslations( call(s) but only ${declared} ` +
        `in the "const t = useTranslations(...)" shape this test can read. ` +
        `Rewrite it into that shape, or teach demandsOf about the new shape — ` +
        `do not leave it unchecked.`,
    );
  }

  for (const variable of rootScoped) {
    // `t("a.b")`, `t.rich("a.b", …)`, `t.raw("a.b")`, `t.has("a.b")`,
    // `t.markup("a.b", …)` — the first argument is the key in all of them.
    const callRe = new RegExp(
      `\\b${variable}(?:\\.(?:rich|raw|has|markup))?\\s*\\(\\s*([^,)]*)`,
      "g",
    );
    for (const match of source.matchAll(callRe)) {
      const rawArg = match[1].trim();
      const literal = STRING_ARG_RE.exec(rawArg);
      if (!literal) {
        throw new Error(
          `${label} calls the root-scoped translator ${variable}(${rawArg}) with ` +
            `a key this test cannot resolve statically. For a root-scoped ` +
            `useTranslations() the key IS the namespace, so an unresolvable key ` +
            `means an unknown namespace. Use a literal, or scope the translator ` +
            `to a namespace.`,
        );
      }
      const key = literal[1];
      expect(
        key,
        `${label}: root-scoped ${variable}("${key}") has no namespace segment`,
      ).toContain(".");
      demands.push({
        namespace: topLevel(key),
        key,
        file: label,
        detail: `${variable}("${key}")`,
      });
    }
  }

  return demands;
}

function collectDemands(): Demand[] {
  const { files } = clientModuleGraph();
  const demands: Demand[] = [];
  for (const file of [...files].sort()) {
    const source = readFileSync(file, "utf8");
    if (!source.includes("useTranslations") && !source.includes("useMessages")) continue;
    demands.push(...demandsOf(file, source));
  }
  return demands;
}

function lookup(tree: Record<string, unknown>, key: string): unknown {
  let node: unknown = tree;
  for (const segment of key.split(".")) {
    if (typeof node !== "object" || node === null) return undefined;
    node = (node as Record<string, unknown>)[segment];
  }
  return node;
}

describe("client message subset", () => {
  const graph = clientModuleGraph();
  const demands = collectDemands();

  it("finds the client module graph at all", () => {
    // A broken walker would produce an empty demand set and this whole file
    // would pass while asserting nothing. These floors are deliberately low —
    // they are a smoke check on the walker, not a count to maintain.
    expect(graph.entryPoints.length).toBeGreaterThan(30);
    expect(graph.files.size).toBeGreaterThan(graph.entryPoints.length);
    expect(demands.length).toBeGreaterThan(50);
  });

  it("follows imports into modules that lack the directive", () => {
    // A module WITHOUT "use client" still runs in the browser when a client
    // module imports it, so a per-file grep for the directive is not enough. No
    // such module calls useTranslations today — every current caller carries the
    // directive itself — but that is a fact about today's code, not a property
    // of it, and the whole point of deriving the set from the graph is to keep
    // holding when someone extracts a translated helper into lib/ or ui/.
    // These two are shared leaves reached only by import; if the walk ever stops
    // being transitive they disappear and this fails.
    for (const path of ["hooks/useMounted.ts", "components/ui/Card.tsx"]) {
      const file = join(ROOT, path);
      expect(graph.files.has(file), `${path} missing from the client graph`).toBe(true);
      expect(graph.entryPoints, `${path} is an entry point, pick another anchor`)
        .not.toContain(file);
    }
  });

  it("sees the root-scoped callers, whose namespaces hide in the keys", () => {
    // The failure this guards: an audit that reads useTranslations(<literal>)
    // calls concludes `app`, `footer`, `explore` and `legend` are server-only,
    // because nothing names them as a namespace anywhere.
    const viaRootScope = new Set(
      demands.filter((d) => d.key !== null).map((d) => d.namespace),
    );
    for (const namespace of ["app", "footer", "explore", "legend"]) {
      expect(viaRootScope, `${namespace} must be found via a dotted key`).toContain(
        namespace,
      );
    }
  });

  /**
   * THE BACKSTOP FOR THE SCAN ABOVE, AND WHY IT IS NOT REDUNDANT.
   *
   * `collectDemands()` skips any client-graph module that does not mention
   * `useTranslations` or `useMessages`, and reads namespaces out of the call
   * itself. That is precise and it is also a bypass: a message key can reach a
   * client module without ever appearing next to one of those calls — handed to
   * a helper, held in a lookup table, spread from a constants file, or passed as
   * a prop from a module that imports the hook somewhere else entirely. Such a
   * key would render as the literal path `sunrisePage.someKey` in HTML Google
   * indexes, with a 200 status, because next-intl's default onError only logs.
   *
   * So this scans EVERY string literal in EVERY client-graph module, with no
   * mention filter, and asks a question that needs no knowledge of how the
   * literal is used: does it look like a dotted message path, and does it
   * actually resolve to a string in the message file? If yes, its namespace has
   * to be one the provider ships. A literal that resolves is a message key
   * whatever syntax surrounds it.
   */
  it("ships every namespace reachable by a bare string literal, not just by a hook call", () => {
    const full = JSON.parse(readFileSync(join(ROOT, "messages/es.json"), "utf8")) as Record<
      string,
      unknown
    >;
    const shipped = new Set<string>(CLIENT_NAMESPACES as readonly string[]);

    // Quoted spans only, and only ones shaped like `a.b` / `a.b.c` — enough to
    // exclude file paths, URLs and version strings without needing a parser.
    const LITERAL_RE = /"([^"\\\n]*)"|'([^'\\\n]*)'|`([^`\\$\n]*)`/g;
    const DOTTED_PATH_RE = /^[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)+$/;

    const offenders: string[] = [];
    for (const file of [...graph.files].sort()) {
      const source = readFileSync(file, "utf8");
      for (const match of source.matchAll(LITERAL_RE)) {
        const literal = match[1] ?? match[2] ?? match[3];
        if (!literal || !DOTTED_PATH_RE.test(literal)) continue;
        const namespace = topLevel(literal);
        if (!(namespace in full)) continue;
        if (typeof lookup(full, literal) !== "string") continue;
        if (shipped.has(namespace)) continue;
        offenders.push(`${relative(ROOT, file)} reaches "${literal}" (namespace "${namespace}")`);
      }
    }

    expect(
      offenders,
      "a client module reaches a message key whose namespace the provider does not ship; " +
        "next-intl will render the key path into indexed HTML instead of throwing. " +
        "Either add the namespace to CLIENT_NAMESPACES or move the usage to a server component.",
    ).toEqual([]);
  });

  it("ships every namespace a client component can reach", () => {
    const required = [...new Set(demands.map((d) => d.namespace))].sort();
    const missing = required.filter(
      (namespace) => !(CLIENT_NAMESPACES as readonly string[]).includes(namespace),
    );
    const explain = missing
      .map((namespace) => {
        const where = demands
          .filter((d) => d.namespace === namespace)
          .map((d) => `${d.file} — ${d.detail}`);
        return `  ${namespace}\n${where.map((w) => `    ${w}`).join("\n")}`;
      })
      .join("\n");
    expect(
      missing,
      `These namespaces are used client-side but not in CLIENT_NAMESPACES, so ` +
        `next-intl will render their literal key paths into indexed HTML:\n${explain}`,
    ).toEqual([]);
  });

  it("resolves every statically known client key in every locale", async () => {
    for (const locale of routing.locales) {
      const full = (await import(`@/messages/${locale}.json`)).default;
      const picked = pickClientMessages(full);
      for (const demand of demands) {
        if (demand.key === null) continue;
        expect(
          typeof lookup(picked, demand.key),
          `messages/${locale}.json: ${demand.file} renders ${demand.detail}, but ` +
            `the client subset has no string at "${demand.key}" — next-intl would ` +
            `output the literal key path with a 200 status`,
        ).toBe("string");
      }
    }
  });

  it("does not ship the namespaces that only ever render on the server", () => {
    // Not a byte-count assertion — a statement that the seven namespaces the
    // saving comes from are actually gone. Server components read from
    // i18n/request.ts, not from this subset, so they keep working.
    const full = JSON.parse(readFileSync(join(ROOT, "messages/es.json"), "utf8"));
    const dropped = Object.keys(full).filter(
      (namespace) => !(CLIENT_NAMESPACES as readonly string[]).includes(namespace),
    );
    expect(dropped.sort()).toEqual([
      "about",
      "compass",
      "connect",
      "learn",
      "methodology",
      "notFoundPage",
      "sunrisePage",
    ]);
  });

  it("actually removes bytes, in every locale", () => {
    for (const locale of routing.locales) {
      const full = JSON.parse(
        readFileSync(join(ROOT, `messages/${locale}.json`), "utf8"),
      );
      const fullSize = JSON.stringify(full).length;
      const pickedSize = JSON.stringify(pickClientMessages(full)).length;
      expect(pickedSize).toBeLessThan(fullSize);
      // This is a floor on the SERIALISED MESSAGE OBJECT, not on page HTML —
      // the page numbers are in i18n/client-messages.ts and depend on how much
      // else a given page renders. 25% leaves room for the client namespaces to
      // grow; if it is ever breached, the filter has stopped earning its
      // complexity and should be reconsidered rather than the floor lowered.
      expect(
        1 - pickedSize / fullSize,
        `messages/${locale}.json: client subset saves too little to be worth it`,
      ).toBeGreaterThan(0.25);
    }
  });

  it("keeps the layout going through the helper", () => {
    // The helper is only load-bearing if the provider uses it. A future edit
    // that reverts to `messages={messages}` would restore the 34-namespace blob
    // and nothing else in the suite would notice.
    const layout = readFileSync(join(ROOT, "app/[locale]/layout.tsx"), "utf8");
    expect(layout).toMatch(/pickClientMessages/);
    expect(layout).toMatch(/messages=\{pickClientMessages\(messages\)\}/);
  });
});
