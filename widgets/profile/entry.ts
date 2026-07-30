import { HostBridge, windowTransport, type HostContext } from "../shared/host-bridge";
import { readProfileMeta, type ProfileMeta, type SunProfile } from "./data";
import { renderProfile, liveEstimate } from "./render";
import { profileStrings } from "./i18n";

const root = document.querySelector<HTMLElement>("#app");
if (!root) throw new Error("profile widget root missing");

let meta: ProfileMeta | null = null;
let profile: SunProfile | null = null;

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
  root!.innerHTML = renderProfile({
    meta,
    profile: profile ?? undefined,
    locale: context?.locale,
    theme: context?.theme,
  });
  bridge.notifySize(Math.ceil(document.documentElement.scrollHeight));
}

let pushTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Hands the chosen profile back to the model, debounced.
 *
 * Debounced because every tap is a change and the model does not need to watch
 * someone make up their mind; what it needs is the value they settled on, before
 * they type their next message. Context-only: nothing is written to the user's
 * saved profile, which would need a write tool and an account.
 */
function pushToModel() {
  if (!meta || !profile) return;
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = setTimeout(() => {
    const copy = profileStrings(bridge.getHostContext()?.locale);
    const estimate = liveEstimate(profile!, meta!.uvIndex);
    const summary = `${copy.skin} ${profile!.skinType}, `
      + `${Math.round(profile!.exposedSkinFraction * 100)}% ${copy.exposure.toLowerCase()}, `
      + `${profile!.age ?? copy.ageAny}, ${profile!.targetIU} IU`
      + (estimate.minutes !== null ? ` → ${estimate.minutes} ${copy.minutes}` : "");
    void bridge
      .updateModelContext({
        content: [{ type: "text", text: summary }],
        structuredContent: {
          skinType: profile!.skinType,
          exposedSkinFraction: profile!.exposedSkinFraction,
          age: profile!.age,
          targetIU: profile!.targetIU,
        },
      })
      .catch(() => {
        // A host that does not accept context updates is not a reason to break
        // the form; the numbers on screen are still the answer.
      });
  }, 400);
}

function update(change: Partial<SunProfile>) {
  if (!profile) return;
  profile = { ...profile, ...change };
  render();
  pushToModel();
}

root.addEventListener("click", (event) => {
  const target = (event.target as HTMLElement | null)?.closest("button");
  if (!target) return;
  event.preventDefault();
  const skin = target.dataset.skin;
  const exposure = target.dataset.exposure;
  const iu = target.dataset.target;
  if (skin) update({ skinType: Number(skin) as SunProfile["skinType"] });
  else if (exposure) update({ exposedSkinFraction: Number(exposure) });
  else if (iu) update({ targetIU: Number(iu) });
});

root.addEventListener("input", (event) => {
  const target = event.target as HTMLInputElement | null;
  if (target?.id !== "profile-age") return;
  const raw = target.value.trim();
  // Re-rendering on every keystroke would steal the caret, so the age field
  // updates the model without a redraw; the readout follows on the next change.
  if (profile) profile = { ...profile, age: raw === "" ? null : Math.min(120, Math.max(0, Number(raw))) };
  pushToModel();
});

const bridge = new HostBridge({
  appInfo: { name: "Vitamin D Profile", version: "1.0.0" },
  transport: windowTransport(),
  onToolResult: (result) => {
    meta = readProfileMeta(result);
    profile = meta ? meta.profile : null;
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
