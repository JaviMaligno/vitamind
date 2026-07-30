import { HostBridge, windowTransport, type HostContext } from "../shared/host-bridge";
import { readDayCurveMeta, type DayCurveMeta } from "./data";
import { renderDayCurve } from "./render";
import { dayCurvePalette } from "./theme";

const root = document.querySelector<HTMLElement>("#app");
if (!root) throw new Error("day-curve widget root missing");

let meta: DayCurveMeta | null = null;

/** The host owns the theme and its CSS variables; an iframe inherits neither. */
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
  const palette = dayCurvePalette(context?.theme, meta?.state ?? "no_synthesis");
  document.body.style.background = palette.pageBackground;
  document.body.style.color = palette.textPrimary;
  root!.innerHTML = renderDayCurve({ meta, locale: context?.locale, theme: context?.theme });
  bridge.notifySize(Math.ceil(document.documentElement.scrollHeight));
}

const bridge = new HostBridge({
  appInfo: { name: "Vitamin D Day Curve", version: "1.0.0" },
  transport: windowTransport(),
  onToolResult: (result) => {
    meta = readDayCurveMeta(result);
    render();
  },
  onHostContextChanged: (context) => {
    applyHostAppearance(context);
    render();
  },
});

// The host may preload the resource before the tool has run; a blank iframe
// reads as broken, so the empty state goes up immediately.
render();

void bridge.connect().then(() => {
  applyHostAppearance(bridge.getHostContext());
  render();
});
