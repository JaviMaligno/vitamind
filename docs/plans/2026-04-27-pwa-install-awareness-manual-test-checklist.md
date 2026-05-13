# PWA Install Awareness — Manual Test Checklist

URL de pruebas: **https://vitamind-dev.vercel.app** (después del deploy a `vitamind-dev`).

Para resetear estado entre escenarios cuando el banner ya se mostró: en DevTools → Application → Storage → Local Storage → borrar la key `vitamind:installBannerSeen`.

Para resetear notification permission en navegadores: clicar el candado en la barra de URL → Notifications → Reset.

---

## A. Safari macOS (sin spoof — comportamiento `platform === 'manual'`)

**Setup previo:** Habilita el Develop menu en Safari → Settings → Advanced → marca "Show features for web developers".

### A1. Banner aparece y abre modal fallback genérico
1. Abre Safari macOS en modo privado (Cmd+Shift+N).
2. Visita la URL → completa setup (ciudad + tipo de piel) → llegas a `/dashboard`.
3. **Espera 3 segundos**.
4. ✅ Esperado: barra oscura aparece pegada arriba de la tab bar inferior, con texto "Add to home screen for instant access" / "Añade VitaminD..." y botón "Install" / "Instalar".
5. Pulsa **Install**.
6. ✅ Esperado: modal abre con título "Add VitaminD to your Home Screen" / "Añade VitaminD..." y subtítulo genérico "Use your browser's menu to add VitaminD to your home screen" / "Usa el menú de tu navegador...".
7. ✅ Esperado: el modal **no muestra los pasos numerados de iOS Safari** (porque platform=manual, no ios-manual).
8. Pulsa la X o backdrop → modal cierra.
9. Pulsa la X del banner → banner se cierra con animación.

### A2. Reload no reaparece el banner
1. Recarga la página.
2. ✅ Esperado: banner **NO** reaparece (flag `vitamind:installBannerSeen` ya está en true).

### A3. Notifications toggle (sin gating de instalación)
1. Resetea `installBannerSeen` y la notification permission.
2. Ve a `/profile`.
3. Activa el toggle de notifications.
4. ✅ Esperado: prompt nativo de Safari para permitir notificaciones (Safari macOS soporta Web Push sin necesidad de instalar).
5. Acepta.
6. ✅ Esperado: el toggle se queda en estado "ON" ("🔔 On" / "🔔 Activadas"), **sin** tip toast de instalación (el tip toast solo aparece para `platform === 'native'` con `beforeinstallprompt` API).
7. ✅ Esperado: ningún modal de install aparece.

### A4. Hidden bonus: agregar al Dock (Sonoma+)
1. File menu → Add to Dock → confirma.
2. Cierra Safari → abre VitaminD desde el Dock.
3. ✅ Esperado: app abre en ventana standalone. Banner no aparece (display-mode standalone detectado). Sin barra de URL.

---

## B. Safari macOS con UA spoofing iOS (simula `platform === 'ios-manual'`)

**Setup previo:** Develop menu → User Agent → **Safari iOS** (la opción que muestra como iPhone).

> ⚠️ Spoofing UA cambia detección pero NO simula `navigator.standalone` ni el flujo real "Add to Home Screen". Es para verificar copy y lógica de modales, no install.

### B1. Banner aparece con copy iOS-polished
1. Modo privado + UA spoof a Safari iOS activado.
2. Limpia localStorage (ya estás en modo privado, debería estar limpio).
3. Visita la URL → completa setup → `/dashboard`.
4. Espera 3s.
5. ✅ Esperado: banner aparece igual que en A1.
6. Pulsa **Install**.
7. ✅ Esperado: modal **iOS pulido** con icono "D", título "Add VitaminD to your Home Screen", subtítulo "Two taps and you're done", **dos pasos numerados** con iconos del Share button (⬆︎) y Add to Home Screen (⊞), y nota inferior "VitaminD will appear on your home screen, no app store needed."
8. ✅ Esperado: NO el fallback genérico — los pasos visuales tienen que aparecer.

### B2. Flow D — gating de notifications con copy iOS-blocking
1. Limpia `installBannerSeen` (DevTools → Application → Storage). Resetea notification permission.
2. Ve a `/profile`.
3. Pulsa el toggle de notifications (🔕).
4. ✅ Esperado: modal aparece con título "Install VitaminD first to enable notifications" / "Instala VitaminD primero para activar notificaciones" y subtítulo "iOS only delivers daily notifications when the app is on your home screen" / "iOS solo envía notificaciones diarias cuando la app está en tu pantalla de inicio".
5. ✅ Esperado: el toggle **no** cambia de estado (no está ON).
6. Cierra el modal con X.
7. ✅ Esperado: toggle sigue en estado OFF (🔕).

### B3. Flow D suprimido cuando permission ya está concedida
1. Concede manualmente la permission (Safari → Preferences → Websites → Notifications → Allow para localhost/dev URL). Alternativamente, usa el escenario A3 primero para conceder.
2. Con `installBannerSeen` ya seteado, ve a `/profile`.
3. Pulsa el toggle.
4. ✅ Esperado: **NO** abre el modal de install. El toggle se activa o muestra error de subscribe (depende de service worker), pero el modal de install no aparece.

### B4. Flow D suprimido cuando permission ya está denegada
1. Deniega notifications para el sitio (Safari → Preferences → Websites → Notifications → Deny).
2. Visita el sitio. El toggle aparece como "🚫 Blocked" / "🚫 Bloqueadas".
3. ✅ Esperado: ningún modal de install se abre. El toggle muestra el estado denied existente.

---

## C. Chrome desktop (Windows / macOS / Linux) — `platform === 'native'`

### C1. Banner aparece con beforeinstallprompt nativo
1. Modo incógnito.
2. Visita la URL → completa setup → `/dashboard`.
3. Espera 3s.
4. ✅ Esperado: banner aparece. Barra oscura con CTA "Install" / "Instalar".
5. ✅ Verificación opcional: en la barra de URL aparece el icono de "instalar app" de Chrome (≡+ o icono de pantalla con flecha).

### C2. Click Install dispara el diálogo nativo
1. Pulsa **Install** en el banner.
2. ✅ Esperado: aparece el diálogo nativo de Chrome "Install VitaminD?" con botones Install/Cancel.
3. Pulsa **Install**.
4. ✅ Esperado:
   - El banner se desmonta inmediatamente.
   - Aparece un toast con texto "Installed! Open VitaminD from your home screen ☀️" / "¡Instalada! Abre VitaminD desde tu pantalla de inicio ☀️" durante 4 segundos.
   - La app PWA se instala (aparece en Apps de Chrome y/o en menú Start de Windows).

### C3. Banner suprimido cuando ya está instalada
1. Cierra todas las pestañas con la URL.
2. Reabre la URL en el navegador (no la app instalada).
3. ✅ Esperado: visita normal, completa setup, llegas a `/dashboard`. **El banner NO aparece** porque `display-mode: standalone` no se detecta en el browser, pero el flag `installBannerSeen` ya está en true.
4. Abre la app instalada (desde menú Start o Applications).
5. ✅ Esperado: app abre en standalone. Banner no aparece (ahora sí por display-mode).

### C4. Dismiss + reload — banner no reaparece
1. Limpia state: desinstala la app si aplica, borra localStorage `installBannerSeen`, recarga.
2. Espera el banner (3s).
3. Pulsa la **X** (no Install).
4. ✅ Esperado: banner se cierra con animación.
5. Recarga la página.
6. ✅ Esperado: banner **NO** reaparece.

### C5. Install via menú de Chrome (no via banner)
1. Limpia state.
2. En el banner, **no** pulses Install. Espera o muévete.
3. En la barra de URL de Chrome, pulsa el icono de "instalar app" (o menú ⋮ → "Install VitaminD...").
4. ✅ Esperado: banner se desmonta (`appinstalled` event), toast "Installed!" aparece, app instalada.

### C6. Notifications + Android-style tip toast
1. Limpia state. Asegúrate de no estar en standalone.
2. Ve a `/profile`. Activa el toggle.
3. ✅ Esperado: prompt nativo de Chrome para permitir notifications.
4. Acepta.
5. ✅ Esperado:
   - Toggle se queda en "ON".
   - Aparece un **toast inferior con CTA "Install"** y texto "Tip: install VitaminD for more reliable notifications" / "Tip: instala VitaminD para notificaciones más fiables".
   - El toast tiene un botón **Install** que, al pulsarlo, dispara el diálogo nativo de instalación.
6. Verifica que el flag `installBannerSeen` está seteado (DevTools).
7. Recarga `/dashboard`. ✅ El banner auto NO aparece (porque seen=true).

---

## D. Firefox desktop — `platform === 'manual'`

### D1. Banner + modal fallback genérico
1. Modo privado.
2. Visita URL → setup → `/dashboard`.
3. Espera 3s.
4. ✅ Esperado: banner aparece.
5. Pulsa Install.
6. ✅ Esperado: modal con copy fallback genérico ("Use your browser's menu..."), **sin** los pasos visuales de iOS.
7. ✅ Esperado: NO aparece tip toast de Android (Firefox no tiene `beforeinstallprompt`).

### D2. Notifications funcionan sin install
1. Ve a `/profile`. Pulsa el toggle.
2. ✅ Esperado: Firefox pide permission. Acepta.
3. ✅ Esperado: toggle ON. **Sin** tip toast (porque platform=manual, no native).

---

## E. iPhone Safari real — escenario crítico

### E1. Banner + Add to Home Screen completo
1. Borra el sitio del historial de Safari si lo has visitado antes (Settings → Safari → Clear History & Data, o solo para esa URL).
2. Abre Safari iPhone (no Chrome iOS, no Firefox iOS — Safari proper).
3. Visita la URL → completa setup → llegas a `/dashboard`.
4. Espera 3 segundos.
5. ✅ Esperado: banner aparece.
6. Pulsa **Install**.
7. ✅ Esperado: modal iOS pulido con dos pasos numerados (Share button, Add to Home Screen).
8. **Sigue las instrucciones REALES**:
   - Cierra el modal.
   - Pulsa el icono Share de Safari (⬆︎ en barra inferior).
   - Scroll abajo en el menú Share → "Add to Home Screen".
   - Confirma → la app aparece en home screen.
9. Sale a home screen → abre la app desde el icono.
10. ✅ Esperado: app abre **en standalone** (sin barra de URL, sin tabs).
11. ✅ Esperado: banner **NO** aparece (porque ahora `navigator.standalone === true`).
12. ✅ Esperado: la página de FAQ y otras funciones se ven correctamente sin browser chrome.

### E2. Notifications post-install (iOS 16.4+ requerido)
1. Con la app instalada y abierta desde home screen (standalone).
2. Ve a `/profile`. Pulsa el toggle de notifications (🔕).
3. ✅ Esperado: iOS pide permission de notifications nativa.
4. Acepta.
5. ✅ Esperado: toggle se pone en ON. NO aparece modal de install (estamos en standalone).
6. Verificación opcional: dispara una notificación push manual desde la consola de Vercel cron, o espera al siguiente cron (8 AM UTC).
7. ✅ Esperado: notificación push llega al iPhone.

### E3. Flow D bloqueante en Safari iPhone (sin instalar)
1. Pre-condición: app NO instalada en home screen, abre en Safari (no standalone).
2. Borra localStorage `installBannerSeen` y resetea notification permission para el sitio.
3. Ve a `/profile`. Pulsa el toggle.
4. ✅ Esperado: modal aparece con copy iOS-blocking ("Install VitaminD first to enable notifications", subtítulo "iOS only delivers daily notifications...").
5. ✅ Esperado: el toggle **no** cambia. Sigue en 🔕.
6. Cierra el modal.

### E4. Permission already granted/denied no abre modal en iOS
1. Si previamente concediste permission (ej. tras E2) pero abriste en Safari (no standalone), pulsa el toggle.
2. ✅ Esperado: NO modal se abre. El comportamiento del toggle es el normal (intenta subscribe).

---

## F. Android Chrome real

### F1. Banner + native install + appinstalled
1. Chrome incógnito.
2. Visita URL → setup → `/dashboard`. Espera 3s.
3. ✅ Esperado: banner aparece.
4. Pulsa Install.
5. ✅ Esperado: diálogo nativo Android "Install VitaminD?" con botones Install/Cancel.
6. Pulsa Install.
7. ✅ Esperado: app se instala. Aparece en app drawer. Banner se desmonta. Toast "Installed!" aparece.
8. Abre la app desde el app drawer.
9. ✅ Esperado: standalone, sin barra de URL.

### F2. Notifications + tip toast Android
1. Limpia state (desinstala app si aplica, borra `installBannerSeen`).
2. En Chrome (no en la PWA standalone), ve a `/profile`.
3. Activa el toggle.
4. ✅ Esperado: Android pide permission. Acepta.
5. ✅ Esperado: toggle ON. Aparece **tip toast inferior** con texto "Tip: install VitaminD..." y botón Install.
6. Pulsa el botón Install del tip toast.
7. ✅ Esperado: dispara el diálogo nativo de instalación.

### F3. Notifications + push real
1. Con la app instalada y abierta en standalone.
2. Ve a `/profile`. Activa toggle si no está activado.
3. ✅ Esperado: subscribe exitoso.
4. Espera al cron 8AM UTC o dispara manual: `curl "https://vitamind-dev.vercel.app/api/push/notify?secret=$CRON_SECRET_DEV"`.
5. ✅ Esperado: notificación push llega al móvil.

---

## G. In-app browser (Instagram / Facebook / TikTok)

### G1. Banner + modal "Open in Safari first"
1. En tu móvil (iOS o Android), comparte la URL `https://vitamind-dev.vercel.app` por DM de Instagram a ti mismo (o simula con un post privado).
2. Abre el link DESDE Instagram (se abre en su webview interno, no Safari).
3. Completa setup → `/dashboard`. Espera 3s.
4. ✅ Esperado: banner aparece.
5. Pulsa Install.
6. ✅ Esperado: modal con título "Open in Safari first" / "Abre primero en Safari" + botón "Copy link" / "Copiar enlace".
7. Pulsa Copy link.
8. ✅ Esperado: el botón cambia momentáneamente a "Link copied" / "Enlace copiado", URL en clipboard.

### G2. Notifications toggle también abre modal
1. Sin haber visto el banner (o tras dismissarlo), ve a `/profile`.
2. Activa el toggle.
3. ✅ Esperado: **mismo modal** "Open in Safari first" se abre. El toggle no se activa.

---

## Resumen de cobertura

| Sistema | Escenarios cubiertos |
|---|---|
| Safari macOS (sin spoof) | A1–A4 |
| Safari macOS (UA iOS spoof) | B1–B4 (cubre lógica iOS sin install real) |
| Chrome desktop | C1–C6 |
| Firefox desktop | D1–D2 |
| iPhone Safari real | E1–E4 (los únicos que cubren el flujo "Add to Home Screen" y push real iOS) |
| Android Chrome real | F1–F3 |
| Instagram in-app | G1–G2 (ideal en móvil real) |

**Total: 30 sub-checks** sobre los 11 escenarios del spec original. Cualquier ✗ que encuentres bloquea merge a master.
