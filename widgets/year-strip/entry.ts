import { App, applyDocumentTheme, applyHostStyleVariables } from "@modelcontextprotocol/ext-apps";
import { readYearStripMeta } from "./data";
import { renderYearStrip } from "./render";
import { widgetPalette } from "./theme";

const root = document.querySelector<HTMLElement>("#app");
if (!root) throw new Error("year-strip widget root missing");

const app = new App({ name: "Vitamin D Year Strip", version: "1.0.0" }, {}, { autoResize: true });
let hoursByDay: number[] | null = null;

function render() {
  const context = app.getHostContext();
  const palette = widgetPalette(context?.theme);
  document.body.style.background = palette.pageBackground;
  document.body.style.color = palette.textPrimary;
  root!.innerHTML = renderYearStrip({ hoursByDay, locale: context?.locale, theme: context?.theme });
}

function applyHostContext() {
  const context = app.getHostContext();
  if (context?.theme) applyDocumentTheme(context.theme);
  if (context?.styles?.variables) applyHostStyleVariables(context.styles.variables);
  render();
}

app.ontoolresult = (result) => {
  hoursByDay = readYearStripMeta(result)?.hoursByDay ?? null;
  render();
};
app.onhostcontextchanged = applyHostContext;

render();
void app.connect().then(applyHostContext);
