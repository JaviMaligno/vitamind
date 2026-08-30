import { describe, expect, it, vi } from "vitest";
import { createQueue } from "../analytics-queue";

function setup(over: Partial<Parameters<typeof createQueue>[0]> = {}) {
  const sent: unknown[] = [];
  let clock = 1_000;
  const q = createQueue({
    maxBatch: 3,
    send: (batch) => { sent.push(batch); },
    now: () => clock,
    ...over,
  });
  return { q, sent, tick: (ms: number) => { clock += ms; } };
}

describe("createQueue", () => {
  it("holds events until something asks for a flush", () => {
    const { q, sent } = setup();
    q.push("visit");
    q.push("city_selected", { method: "gps" });
    expect(sent).toHaveLength(0);
    expect(q.size()).toBe(2);
  });

  it("sends one batch carrying every queued event, then empties", () => {
    const { q, sent } = setup();
    q.push("visit");
    q.push("city_selected", { method: "gps" });
    q.flush();

    expect(sent).toEqual([[
      { name: "visit", props: undefined, ts: 1000 },
      { name: "city_selected", props: { method: "gps" }, ts: 1000 },
    ]]);
    expect(q.size()).toBe(0);
  });

  // A beacon costs a function invocation on Vercel. Flushing an empty queue on
  // every tab switch would burn the invocation budget to send nothing.
  it("sends nothing when the queue is empty", () => {
    const { q, sent } = setup();
    q.flush();
    q.flush();
    expect(sent).toHaveLength(0);
  });

  it("flushes on its own once the batch is full, so a long session cannot pile up unsent", () => {
    const { q, sent } = setup();
    q.push("a"); q.push("b"); q.push("c");
    expect(sent).toHaveLength(1);
    expect((sent[0] as unknown[]).map((e) => (e as { name: string }).name)).toEqual(["a", "b", "c"]);
    expect(q.size()).toBe(0);
  });

  it("stamps each event when it happened, not when the batch left", () => {
    const { q, sent, tick } = setup();
    q.push("first");
    tick(5000);
    q.push("second");
    q.flush();
    const batch = sent[0] as Array<{ name: string; ts: number }>;
    expect(batch.map((e) => e.ts)).toEqual([1000, 6000]);
  });

  /**
   * The send path ends in `navigator.sendBeacon`, which returns false when the
   * browser refuses (queue full, blocked by an extension) and throws in some
   * contexts. Losing analytics is acceptable; breaking the page is not — and the
   * queue must not wedge, or every later event is lost too.
   */
  it("keeps working after a send throws", () => {
    const send = vi.fn()
      .mockImplementationOnce(() => { throw new Error("beacon refused"); })
      .mockImplementation(() => {});
    const { q } = setup({ send });

    expect(() => { q.push("a"); q.flush(); }).not.toThrow();
    expect(q.size()).toBe(0);

    q.push("b");
    q.flush();
    expect(send).toHaveBeenCalledTimes(2);
  });

  // Dropping the batch on failure is deliberate: retrying would mean holding
  // events across a page hide, which is exactly when they are lost anyway.
  it("does not re-send a failed batch on the next flush", () => {
    const send = vi.fn().mockImplementationOnce(() => { throw new Error("nope"); });
    const { q } = setup({ send });
    q.push("a");
    q.flush();
    q.push("b");
    q.flush();
    expect(send.mock.calls[1][0]).toEqual([{ name: "b", props: undefined, ts: 1000 }]);
  });
});
