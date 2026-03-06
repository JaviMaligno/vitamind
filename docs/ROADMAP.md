# Vitamina D Explorer - Roadmap

## Completado (v6 - Next.js)

- Mapa real del mundo (Natural Earth + d3-geo) con pan, zoom, tap/clic
- Heatmap latitud x dia del ano con drag interactivo
- Curva solar diaria con umbral de vitamina D
- ~80 ciudades built-in + 33,390 ciudades GeoNames con fuzzy search (Fuse.js)
- Busqueda Nominatim (OpenStreetMap) como fallback
- Favoritos editables, animacion temporal, umbrales 45/50
- Soporte movil (touch, pinch-to-zoom)
- Modo scrub opcional en mapa (toggle explorar/mover)
- Ubicaciones custom guardables con nombre
- Persistencia localStorage (favoritos, preferencias, cache meteo)
- Integracion Open-Meteo (UV index + cobertura nubes) via API route
- Overlay de nubes en curva diaria
- Proyecto Next.js modular (TypeScript, Tailwind)
- Deploy en Vercel, repo en GitHub
- Curva solar verificada: formula astronomica estandar (NOAA), error <0.3 grados, forma realista confirmada
- Renderizado robusto de curva (buildVisiblePath con interpolacion de bordes, verificado 187K combinaciones)

---

## Completado (Fase 6b - Calculo preciso con UV real)

- Formula Holick/Dowdy (2010): time = target_IU * MED / (24000 * area * UVI)
- MED por tipo Fitzpatrick (I-VI): 200-1200 J/m2
- Umbral UVI >= 3 para sintesis
- Cap a 1/3 MED (rendimiento decreciente)
- Selector de piel con guia Fitzpatrick interactiva (boton ?)
- Presets de area expuesta (10%-40%)
- Panel de resultados: minutos para 1000 IU, mejor hora, ventana UV
- Grafico de barras por hora coloreado por tiempo necesario
- Persistencia de preferencias en localStorage

---

## Fase 6c - Mejora de UX/UI

- Rediseño visual general (layout, espaciado, responsive)
- Onboarding para nuevos usuarios (tipo de piel, ubicacion)
- Tooltips y explicaciones contextuales mas claras
- Mejor jerarquia visual entre controles y resultados
- Accesibilidad (aria labels, contraste, teclado)

---

## Completado (Fase 7 - Notificaciones push)

- Web Push API con VAPID keys (web-push library)
- Service Worker: push event handler + notification click abre la app
- API routes: POST/DELETE /api/push/subscribe, GET /api/push/notify
- Vercel Cron: check diario a las 8:00 UTC
- Notificacion incluye: minutos para 1000 IU, ventana solar, UV pico
- Auto-limpieza de suscripciones expiradas (410/404)
- Actualiza suscripcion al cambiar ciudad/piel/area
- Toggle de notificaciones en el banner de estado
- **Pendiente**: Configurar Vercel KV para persistencia de suscripciones
  (sin KV usa memoria, que se pierde entre invocaciones serverless)

---

## Fase 8 - Perfil personal

- Tipo de piel (escala Fitzpatrick I-VI) -> ajusta tiempo necesario
- Edad -> ajusta eficiencia de sintesis
- % de piel expuesta -> multiplica tiempo
- Requiere autenticacion (Firebase Auth o Supabase Auth)
- Migracion de localStorage a base de datos (Supabase/Firestore)

---

## Completado (Fase 9 - PWA)

- manifest.json con iconos (192, 512, maskable), nombre, colores
- Service Worker con cache-first para assets, network-first para paginas
- Pagina offline con boton de reintentar
- Apple Web App meta tags (capable, status-bar-style, touch-icon)
- Favicon SVG con icono sol+D
- "Anadir a pantalla de inicio" en movil
- Comportamiento tipo app nativa (display: standalone)

---

## Fase 10 - App movil nativa

- Evaluar si PWA es suficiente o se necesita app nativa
- Si nativa: React Native / Expo (reutiliza logica de lib/)
- Ventajas nativa: GPS automatico, notificaciones mas fiables, stores
- Solo si la PWA se queda corta en funcionalidad o UX
