import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

const revalidatePath = vi.fn();

vi.mock("next/cache", () => ({
  revalidatePath: (...args: unknown[]) => revalidatePath(...args),
}));

import { GET } from "@/app/api/revalidate-today/route";
import { SUNRISE_CITIES } from "@/lib/sun-routes";
import { routing } from "@/i18n/routing";

const URL_BASE = "http://localhost/api/revalidate-today";
const request = (auth?: string) =>
  new NextRequest(URL_BASE, { headers: auth ? { authorization: auth } : undefined });

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("CRON_SECRET", "test-secret");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("GET /api/revalidate-today", () => {
  it("refuses a request with no bearer token", async () => {
    const res = await GET(request());
    expect(res.status).toBe(401);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("refuses a wrong bearer token", async () => {
    const res = await GET(request("Bearer nope"));
    expect(res.status).toBe(401);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("fails loudly when CRON_SECRET is not configured, rather than running unauthenticated", async () => {
    vi.stubEnv("CRON_SECRET", "");
    const res = await GET(request("Bearer test-secret"));
    expect(res.status).toBe(500);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("revalidates one path per hub page: every sunrise city in every locale", async () => {
    const res = await GET(request("Bearer test-secret"));
    expect(res.status).toBe(200);
    const expected = SUNRISE_CITIES.length * routing.locales.length;
    expect(revalidatePath).toHaveBeenCalledTimes(expected);
    const body = await res.json();
    expect(body.revalidated).toBe(expected);
  });

  it("revalidates the localized path, not the route template", async () => {
    // The point of the cron is to refresh the pages a reader actually fetches.
    // Passing the `[locale]/[cityPrefix]/[city]` template would also sweep the
    // 438 vitamin D city pages that share the segment, which do not need it.
    await GET(request("Bearer test-secret"));
    const paths = revalidatePath.mock.calls.map((c) => c[0] as string);
    expect(paths).toContain("/amanecer/madrid");
    expect(paths).toContain("/en/sunrise/london");
    expect(paths.some((p) => p.includes("["))).toBe(false);
  });

  it("does not touch the month pages, which carry no day-dependent claim", async () => {
    await GET(request("Bearer test-secret"));
    const paths = revalidatePath.mock.calls.map((c) => c[0] as string);
    expect(paths.some((p) => /\/(agosto|august)$/.test(p))).toBe(false);
  });
});
