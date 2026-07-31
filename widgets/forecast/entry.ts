import { HostBridge, windowTransport, type HostContext } from "../shared/host-bridge";
import { readForecastMeta, type ForecastMeta } from "./data";
import { renderForecast } from "./render";

const root = document.querySelector<HTMLElement>("#app");
if (!root) throw new Error("forecast widget root missing");

let meta: ForecastMeta | null = null;

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
  root!.innerHTML = renderForecast({ meta, locale: context?.locale, theme: context?.theme });
  bridge.notifySize(Math.ceil(document.documentElement.scrollHeight));
}

const bridge = new HostBridge({
  appInfo: { name: "Vitamin D Forecast", version: "1.0.0" },
  transport: windowTransport(),
  onToolResult: (result) => { meta = readForecastMeta(result); render(); },
  onHostContextChanged: (context) => { applyHostAppearance(context); render(); },
});

render();

void bridge.connect().then(() => {
  applyHostAppearance(bridge.getHostContext());
  render();
});
