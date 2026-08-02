import { HostBridge, windowTransport, type HostContext } from "../shared/host-bridge";
import { readHistoryMeta, withDayConfirmed, nextAnswer, type HistoryMeta } from "./data";
import { renderHistory } from "./render";

const root = document.querySelector<HTMLElement>("#app");
if (!root) throw new Error("history widget root missing");

let meta: HistoryMeta | null = null;
/** Days tapped but not yet acknowledged by the server. */
let pending: string[] = [];

function applyHostAppearance(context: HostContext | undefined) {
  const element = document.documentElement;
  if (context?.theme) {
    element.setAttribute("data-theme", context.theme);
    element.style.colorScheme = context.theme;
  }
  for (const [name, value] of Object.entries(context?.styles?.variables ?? {})) {
    if (value !== undefined) element.style.setProperty(name, value);
  }
}

function render() {
  const context = bridge.getHostContext();
  root!.innerHTML = renderHistory({ meta, pending, locale: context?.locale, theme: context?.theme });
  bridge.notifySize(Math.ceil(document.documentElement.scrollHeight));
}

/**
 * The whole point of this widget: answering a day without a chat round trip.
 *
 * Tapping cycles through the same three answers as the app's calendar — went
 * out, stayed in, never said. A control you can only push one way is a trap,
 * because the first thing anyone does after marking a day by mistake is tap it
 * again.
 *
 * The cell goes into a pending state immediately, because a tap that does
 * nothing for a second reads as a broken button; the real state arrives when the
 * server answers. On failure the change is dropped and the calendar returns to
 * the truth rather than keeping an optimistic lie.
 */
async function cycleDay(date: string) {
  if (!meta?.authenticated || pending.includes(date)) return;
  const day = meta.days.find((d) => d.date === date);
  // Days with no usable sun are not answerable, exactly as in the app: there was
  // no window to take or skip.
  if (!day?.viableSun) return;
  const next = nextAnswer(day.wentOutside);

  pending = [...pending, date];
  render();

  try {
    await bridge.callServerTool({ name: "log_sun_session", arguments: { date, confirmed: next } });
    meta = { ...meta, days: withDayConfirmed(meta.days, date, next) };
  } catch {
    // Left as it was on purpose: the calendar shows what the server believes.
  } finally {
    pending = pending.filter((d) => d !== date);
    render();
  }
}

/**
 * Correcting where you were is a different gesture from answering a day, and it
 * works on a stretch: nobody travels for exactly one day, and the location was
 * inherited across the whole run.
 *
 * There is no city picker inside the iframe and building one would be a second
 * app, so this hands the range to the conversation instead — the model already
 * knows how to ask "which city?" and has the tool to write it. Tapping a stretch
 * puts the request in front of it; the answer comes back through the chat.
 */
function correctLocation(from: string, to: string) {
  const span = meta?.locations?.find((s) => s.from === from && s.to === to);
  if (!span) return;
  const range = from === to ? from : `${from} to ${to}`;
  const text =
    `The user wants to correct where they were from ${range}, currently recorded as "${span.name}"`
    + `${span.assumedDays > 0 ? ` (${span.assumedDays} of those ${span.days} days were inherited from a neighbouring day rather than recorded)` : ""}.`
    + ` Ask which city they were in, and say the correction is not stored yet.`;
  void bridge.updateModelContext({
    content: [{ type: "text", text }],
    structuredContent: { correctingLocation: { from, to, currentName: span.name } },
  });
}

root.addEventListener("click", (event) => {
  const button = (event.target as HTMLElement | null)?.closest("button");
  if (!button) return;
  const { date, spanFrom, spanTo } = button.dataset;
  if (date) void cycleDay(date);
  else if (spanFrom && spanTo) correctLocation(spanFrom, spanTo);
});

const bridge = new HostBridge({
  appInfo: { name: "Vitamin D History", version: "1.0.0" },
  transport: windowTransport(),
  onToolResult: (result) => {
    meta = readHistoryMeta(result);
    pending = [];
    render();
  },
  onHostContextChanged: (context) => {
    applyHostAppearance(context);
    render();
  },
});

render();

void bridge.connect().then(() => {
  applyHostAppearance(bridge.getHostContext());
  render();
});
