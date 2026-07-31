import { HostBridge, windowTransport, type HostContext } from "../shared/host-bridge";
import { readDayMeta, type DayMeta } from "./data";
import { renderDay } from "./render";
import { emptyText } from "./i18n";


const root = document.querySelector<HTMLElement>("#app");
if (!root) throw new Error("day-curve widget root missing");

let meta: DayMeta | null = null;

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
  root!.innerHTML = renderDay({
    meta,
    locale: context?.locale,
    theme: context?.theme,
    emptyText: emptyText(context?.locale),
  });
  bridge.notifySize(Math.ceil(document.documentElement.scrollHeight));
}

const bridge = new HostBridge({
  appInfo: { name: "Vitamin D Day Curve", version: "1.0.0" },
  transport: windowTransport(),
  onToolResult: (result) => {
    meta = readDayMeta(result);
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
