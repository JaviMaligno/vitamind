import { HostBridge, windowTransport, type HostContext } from "./host-bridge";
import { readYearStripMeta } from "./data";
import { renderYearStrip } from "./render";
import { widgetPalette } from "./theme";

const root = document.querySelector<HTMLElement>("#app");
if (!root) throw new Error("year-strip widget root missing");

let hoursByDay: number[] | null = null;

/**
 * The host owns the theme and the CSS variables; the iframe inherits neither, so
 * both get applied by hand. These two are what `applyDocumentTheme` and
 * `applyHostStyleVariables` do in @modelcontextprotocol/ext-apps — three lines
 * each, reproduced here to keep the bundle free of that package at runtime.
 */
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
  const palette = widgetPalette(context?.theme);
  document.body.style.background = palette.pageBackground;
  document.body.style.color = palette.textPrimary;
  root!.innerHTML = renderYearStrip({ hoursByDay, locale: context?.locale, theme: context?.theme });
  bridge.notifySize(Math.ceil(document.documentElement.scrollHeight));
}

const bridge = new HostBridge({
  appInfo: { name: "Vitamin D Year Strip", version: "1.0.0" },
  transport: windowTransport(),
  onToolResult: (result) => {
    hoursByDay = readYearStripMeta(result)?.hoursByDay ?? null;
    render();
  },
  onHostContextChanged: (context) => {
    applyHostAppearance(context);
    render();
  },
});

// Render the empty state immediately: the host can preload the resource before
// the tool has run, and a blank iframe reads as broken.
render();

void bridge.connect().then(() => {
  applyHostAppearance(bridge.getHostContext());
  render();
});
