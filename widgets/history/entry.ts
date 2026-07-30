import { HostBridge, windowTransport, type HostContext } from "../shared/host-bridge";
import { readHistoryMeta, withDayConfirmed, type HistoryMeta } from "./data";
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
 * The whole point of this widget: confirming a day without a chat round trip.
 *
 * The cell goes into a pending state immediately, because a tap that does
 * nothing for a second reads as a broken button; the real state arrives when the
 * server answers. On failure the pending mark is dropped and the calendar
 * returns to the truth rather than keeping an optimistic lie.
 */
async function confirmDay(date: string) {
  if (!meta?.authenticated || pending.includes(date)) return;
  const already = meta.days.find((d) => d.date === date)?.wentOutside;
  if (already) return;

  pending = [...pending, date];
  render();

  try {
    await bridge.callServerTool({ name: "log_sun_session", arguments: { date } });
    meta = { ...meta, days: withDayConfirmed(meta.days, date), streak: meta.streak };
  } catch {
    // Left unmarked on purpose: the calendar shows what the server believes.
  } finally {
    pending = pending.filter((d) => d !== date);
    render();
  }
}

root.addEventListener("click", (event) => {
  const button = (event.target as HTMLElement | null)?.closest("button");
  const date = button?.dataset.date;
  if (date) void confirmDay(date);
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
