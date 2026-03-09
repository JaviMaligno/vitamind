# Vitamina D Explorer - Roadmap

## Completado (v6 - Next.js)

- Mapa real del mundo (Natural Earth + d3-geo) con pan, zoom, tap/clic
- Heatmap latitud x dia del ano con drag interactivo
- Curva solar diaria con umbral de vitamina D
- ~80 ciudades built-in + 200K+ ciudades GeoNames cities500 en Supabase
- Busqueda fuzzy server-side (pg_trgm) + Nominatim fallback
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

## Completado (Fase 6c - Mejora de UX/UI)

- Rediseño completo con layout de 3 zonas: Hero (respuesta inmediata), Visualizacion (tabs), Configuracion (colapsable)
- Migracion de inline styles a Tailwind CSS
- Extraccion de hooks: useLocation, useWeather, usePreferences, useAnimation, useGeoLocation
- Componentes: HeroZone, VisualizationZone, ConfigZone
- Botones con min-height 44px para accesibilidad movil
- Jerarquia visual clara: respuesta grande, visualizaciones en tabs, controles ocultos por defecto

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
- Persistencia de suscripciones en Supabase (push_subscriptions table + RLS)

---

## Completado (Fase 8 - Perfil personal)

- Auth opcional via Supabase (app funciona completamente sin cuenta)
- AuthButton en header: login/signup/logout
- On login: sincroniza perfil cloud -> local
- Profile sync: localStorage siempre, Supabase cuando hay sesion
- Campo edad con factor Holick 1989 (-1.3%/año desde 20, min 0.5)
- Tabla profiles con RLS (docs/supabase-schema.sql)
- Supabase configurado (proyecto + env vars en Vercel)
- Estimacion teorica cielo despejado para fechas sin datos meteo (modelo Madronich)

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

## Completado (Fase 10 - v2 Redesign)

- GPS auto-deteccion (navigator.geolocation) con fallback a busqueda de ciudad
- Base de datos de ciudades migrada a Supabase (200K+ ciudades GeoNames cities500)
- Busqueda de ciudad por nombre (pg_trgm) y por proximidad GPS
- API route /api/cities para busqueda server-side
- i18n con next-intl: 6 idiomas (ES, EN, FR, DE, RU, LT)
- Selector de idioma en header
- Deteccion automatica de idioma del navegador
- SEO: meta tags OpenGraph/Twitter, JSON-LD structured data
- Vercel Analytics integrado
- Push notifications: fix critico (RLS bloqueaba escritura de suscripciones)
- Push notifications: soporte test manual (?secret=), mejor reporte de errores
- Testing: vitest configurado con smoke tests para solar math

---

## Pendiente de verificacion

- [x] PWA: instalable en movil
- [x] PWA: modo offline
- [x] Estimacion teorica UV para fechas >14 dias
- [ ] Auth: persistencia de perfil (login -> cambia preferencias -> logout -> login -> se mantienen?)
- [ ] Auth: sincronizacion cloud <-> localStorage al iniciar sesion
- [ ] Push notifications: recibir notificacion diaria a las 8:00 UTC (re-suscribirse tras fix)
- [ ] Push notifications: contenido correcto (minutos, ventana solar, UV pico)
- [ ] Estimacion con datos reales: muestra minutos, mejor hora, barras por hora para fecha de hoy
- [ ] Seed de ciudades: ejecutar scripts/seed-cities.ts en Supabase produccion

---

## Futuro - Funcionalidades adicionales

- Autodeteccion tipo de piel con foto (IA / vision model)
- Chat IA / preguntas comunes sobre vitamina D y sol
- Mensaje contextual de suplementacion (cuando no hay ventana de sintesis)
- Onboarding guiado para nuevos usuarios
- Tooltips y explicaciones contextuales
- Accesibilidad avanzada (aria labels, navegacion por teclado)
- OG image personalizada (screenshot/heatmap)
- Assets para Product Hunt (screenshots, GIF animado con Remotion)

---

## Futuro - App movil nativa

- Evaluar si PWA es suficiente o se necesita app nativa
- Si nativa: React Native / Expo (reutiliza logica de lib/)
- Ventajas nativa: notificaciones mas fiables, presencia en stores
- Solo si la PWA se queda corta en funcionalidad o UX

---

## Estrategia comercial

- Ver docs/original_claude_ouput/vitamin-d-estrategia-comercial.md para plan detallado
- Lanzamiento: Product Hunt, Reddit, Hacker News, Twitter/X
- B2C: freemium (gratis + Pro 2.99€/mes)
- B2B: partnerships con marcas de suplementos
