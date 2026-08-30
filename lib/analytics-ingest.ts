/**
 * Validation for the public analytics ingest endpoint.
 *
 * `/api/events` takes unauthenticated POSTs from browsers — it has to, that is
 * where the events are. So nothing here trusts its input: the batch is capped,
 * names and values are truncated, non-scalar props are dropped, and browser
 * clocks are clamped to a plausible window. Pure and separately tested, because
 * this is the only thing between the open internet and the table.
 */

export const MAX_BATCH = 50;
export const MAX_NAME = 64;
export const MAX_PROPS = 8;
export const MAX_STRING = 128;
export const MAX_PATH = 256;

/** How far back a browser-supplied timestamp may plausibly reach. */
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export type PropValue = string | number | boolean | null;

export interface CleanEvent {
  name: string;
  props: Record<string, PropValue>;
  path: string | null;
  locale: string | null;
  referrerHost: string | null;
  authed: boolean;
  occurredAt: string;
}

export interface CleanPayload {
  visitorId: string;
  sessionId: string;
  events: CleanEvent[];
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SUPPORTED_LOCALES = new Set(["es", "en", "fr", "de", "ru", "lt"]);

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function cleanProps(raw: unknown): Record<string, PropValue> {
  if (!isRecord(raw)) return {};
  const out: Record<string, PropValue> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (Object.keys(out).length >= MAX_PROPS) break;
    if (value === null || typeof value === "boolean") {
      out[key.slice(0, MAX_NAME)] = value;
    } else if (typeof value === "string") {
      out[key.slice(0, MAX_NAME)] = value.slice(0, MAX_STRING);
    } else if (typeof value === "number" && Number.isFinite(value)) {
      // Infinity and NaN are not representable in JSON; postgrest rejects the
      // whole insert rather than the one column.
      out[key.slice(0, MAX_NAME)] = value;
    }
  }
  return out;
}

/** Host only. A referrer's query string routinely carries identifiers. */
function referrerHost(raw: unknown): string | null {
  if (typeof raw !== "string" || raw.length === 0 || raw.length > 2048) return null;
  try {
    const url = new URL(raw);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.hostname.slice(0, MAX_STRING) || null;
  } catch {
    return null;
  }
}

/** Path without its query string — a page URL can carry a token. */
function cleanPath(raw: unknown): string | null {
  if (typeof raw !== "string" || raw.length === 0) return null;
  const withoutQuery = raw.split(/[?#]/)[0];
  return withoutQuery.slice(0, MAX_PATH) || null;
}

function occurredAt(raw: unknown, now: Date): string {
  const ts = typeof raw === "number" && Number.isFinite(raw) ? raw : NaN;
  if (Number.isNaN(ts)) return now.toISOString();
  const age = now.getTime() - ts;
  // Future stamps and implausibly old ones both mean a clock we cannot trust;
  // arrival time is the honest fallback.
  if (age < 0 || age > MAX_AGE_MS) return now.toISOString();
  return new Date(ts).toISOString();
}

/**
 * Validate and normalise one ingest request.
 *
 * Returns null when the envelope itself is unusable or when no event survived —
 * both cases the route answers with 400. Individual malformed events are dropped
 * rather than failing their neighbours: one bad event in a batch of ten should
 * cost one event, not the visit.
 */
export function parsePayload(body: unknown, now: Date): CleanPayload | null {
  if (!isRecord(body)) return null;

  const { visitorId, sessionId, events } = body;
  if (typeof visitorId !== "string" || !UUID_RE.test(visitorId)) return null;
  if (typeof sessionId !== "string" || !UUID_RE.test(sessionId)) return null;
  if (!Array.isArray(events)) return null;

  const path = cleanPath(body.path);
  const locale = typeof body.locale === "string" && SUPPORTED_LOCALES.has(body.locale)
    ? body.locale
    : null;
  const host = referrerHost(body.referrer);
  const authed = body.authed === true;

  const clean: CleanEvent[] = [];
  for (const raw of events.slice(0, MAX_BATCH)) {
    if (!isRecord(raw)) continue;
    if (typeof raw.name !== "string") continue;
    const name = raw.name.slice(0, MAX_NAME);
    if (!name) continue;
    clean.push({
      name,
      props: cleanProps(raw.props),
      path,
      locale,
      referrerHost: host,
      authed,
      occurredAt: occurredAt(raw.ts, now),
    });
  }

  if (clean.length === 0) return null;
  return { visitorId, sessionId, events: clean };
}
