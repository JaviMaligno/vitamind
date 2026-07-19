# Plan: evolución del MCP, cuenta de usuario y marketing IA

**Estado: aprobado en conjunto; sin fecha por fase.** El MCP v1 anónimo está en
producción (`/api/mcp/mcp`, 4 herramientas, ver CLAUDE.md). Este plan recoge lo
que viene después, en tres bloques independientes.

## Bloque A — Optimización de las herramientas MCP

> **Estado 2026-07-19 (2ª pasada):** auditoría EN VIVO ejecutada con 3 agentes
> simulando usuarios (15 preguntas contra el servidor real). Resultado: 12/15
> OK con el mínimo de llamadas; 2 bugs corregidos (criterios contradictorios en
> la herramienta anual → unificados con `viableDays`/`partialMonth` + `summary`
> comparativo; horas sin zero-pad) y 3 gaps cubiertos (`estimate_sun_session`
> con IU estimadas + minutos-hasta-quemadura, `atTime` en la ventana diaria,
> `nextWindow` al estar cerrada, hora dorada matutina, hint de coordenadas en
> `search_city` vacío, nulls explicados). Deferred conscientemente:
> `compare_locations` (2 llamadas + summary bastan), previsión semanal
> (requiere multi-día de Open-Meteo), y ampliar la base de ciudades (Alicante
> no está; el hint de lat/lon lo mitiga).

Feedback real de la primera sesión de uso (2026-07-19): preguntar "¿qué meses
hay vitamina D en Londres?" provocó una cascada de llamadas a
`get_vitamin_d_window` (una por fecha sondeada), porque no existe una
herramienta de perfil anual.

- **`get_vitamin_d_year` (nueva, prioridad alta):** perfil anual en UNA llamada.
  Reusar `cityYearProfile` + `citySeasonalWindows` + `viableDateBoundaries`
  (`lib/city-content.ts`, ya testeado): meses posibles/imposibles, ventana
  exacta del año (primer/último día viable), ventanas y minutos por estación.
  Con el perfil personal opcional como el resto de herramientas.
- **Descripciones anti-cascada:** en `get_vitamin_d_window`, añadir "for a
  SINGLE day — for 'which months of the year', call get_vitamin_d_year
  instead"; revisar el resto con el mismo criterio (cada descripción dice
  cuándo NO usarla y qué usar en su lugar).
- **Revisar respuestas:** auditar qué devuelve cada herramienta ante las
  preguntas frecuentes reales (ventana de hoy, meses del año, comparar
  ciudades, "¿me quemo?") y ajustar campos/redacción de los JSON para que el
  LLM no necesite llamadas extra. Considerar `outputSchema`/structured content
  del spec MCP cuando `mcp-handler` lo soporte bien.
- **Observabilidad ligera:** log de nombre de herramienta + duración (sin args
  con coordenadas exactas, por privacidad) en los logs de función de Vercel,
  para saber qué se usa y qué cascadea.
- **Auditoría preguntas habituales → herramientas candidatas** (anotado
  2026-07-19, sin prioridad aún; validar contra los logs de uso antes de
  construir):
  - "¿Dónde mejor, Madrid o Alicante?" / "¿a qué ciudad me mudo por sol?" →
    `compare_locations` (2-5 lugares, misma métrica anual en paralelo).
  - "¿Qué día de esta semana me conviene salir?" → `get_week_forecast`
    (Open-Meteo multi-día + minutos por día; hoy el cliente encadena
    get_current_status + suposiciones).
  - "He estado 20 min al sol, ¿cuánta vitamina D he hecho?" →
    `estimate_session_iu` (`iuForMinutes` ya existe en `lib/vitd.ts`).
  - "¿Cuánto puedo estar sin quemarme?" → `get_safe_sun_time` (tiempo a 1 MED
    por fototipo; misma física ya implementada — coordinar copy con el futuro
    "sol seguro" de la app).
  - "¿Cuándo es la hora dorada para fotos esta semana?" → cubierto por
    `get_sun_times` con fecha; evaluar si hace falta variante multi-día.
  - Regla general: una pregunta habitual = una llamada; si los logs muestran
    >2 llamadas por pregunta, falta una herramienta o sobra ambigüedad en las
    descripciones.

## Bloque B — Cuenta de usuario: escalera de valor + OAuth del MCP

### B1. Escalera de valor — DECIDIDO (2026-07-19)

1. **Nada de lo actual se mueve detrás de la cuenta.** Push sigue anónimo
   (funciona y no se toca). En IA, las herramientas públicas del MCP siguen
   públicas: no se fuerza cuenta para lo que naturalmente no la necesita. La
   cuenta es puramente aditiva: sync multi-dispositivo, historial persistente
   y las herramientas MCP personales (B2).
2. **Venta contextual en varios puntos**, no una única pantalla: el historial
   ("consérvalo y llévatelo a todos tus dispositivos"), el perfil, y la futura
   sección "Conecta tu IA" (para las herramientas personales). Cada punto
   vende el beneficio de su propio contexto.
3. **Premium: hueco abierto, sin compromiso.** Candidatos si algún día llega:
   opciones avanzadas de IA, personalización avanzada dentro de la app, y
   "sin anuncios" cuando existan partners con presencia publicitaria. La copy
   de la cuenta no debe prometer "todo gratis para siempre".

### B2. OAuth 2.1 para el MCP (técnica — la pieza grande)

> **Estado 2026-07-19: núcleo implementado.** AS completo (authorize/token/
> register + well-knowns, PKCE S256 obligatorio, códigos single-use, tokens
> hasheados con rotación de refresh), consentimiento en `/oauth-consent`
> (6 idiomas, login Supabase reutilizando AuthButton), verificación con
> `withMcpAuth (required:false)` y 4 herramientas personales. Migración:
> `supabase/migrations/20260719_mcp_oauth.sql` — **aplicar antes de desplegar**.
> Pendiente: prueba end-to-end con el conector real, UI de revocación en el
> perfil, rate limit del token endpoint, y limpieza periódica de filas
> caducadas.

Los conectores de Claude/ChatGPT autentican vía OAuth 2.1. Arquitectura:

- Identidad: Supabase Auth (la existente). La app implementa el authorization
  server: `/api/oauth/authorize` (login Supabase + pantalla de consentimiento),
  `/api/oauth/token` (PKCE obligatorio), registro dinámico de clientes
  (RFC 7591) y metadata (`/.well-known/oauth-authorization-server` +
  `oauth-protected-resource`, RFC 9728).
- Verificación en el endpoint MCP con `withMcpAuth` (mcp-handler); tokens
  opacos en una tabla Supabase (hash, expiración, scopes, revocación desde el
  perfil de la app).
- Scopes: `profile:read`, `history:read`, `history:write`.
- Herramientas nuevas (solo con token): `get_my_profile` (fototipo, edad,
  ciudad guardada → el resto de tools dejan de necesitar parámetros),
  `get_my_cities` (favoritas), `get_my_history` (¿cómo llevo el mes?),
  `log_sun_session` (la potente: "he salido 20 min, apúntalo" → confirma el
  día en el historial).
- Las 4 herramientas públicas siguen sin auth — el MCP anónimo no se rompe.
- Nota de producto: la personalización de LECTURA ya funciona sin cuenta vía la
  memoria del cliente IA (Claude recuerda tu fototipo y lo pasa como
  parámetro); el valor real del OAuth es historial + escritura + favoritas.

Seguridad: revisar contra la sección OAuth del spec MCP antes de desplegar;
rate limit en token endpoint; nunca aceptar tokens de Supabase directamente
como bearer del MCP.

## Bloque C — Marketing del MCP (sin prisa; documentado para no perderlo)

- **Sección "Conecta tu IA" en la app** (Guía o Perfil, 6 idiomas):
  instrucciones para Claude (Ajustes → Conectores → URL) y ChatGPT (modo
  desarrollador), con el truco de la memoria ("dile una vez tu tipo de piel y
  tu ciudad; lo recordará"). URL oficial: `https://getvitamind.app/api/mcp/mcp`.
- **Página SEO/landing** tipo "Conecta la vitamina D a tu IA" — hook: pocas
  apps de salud indie tienen conector MCP; es historia diferencial.
- **Directorios MCP:** enviar el conector al registry de MCP y directorios
  (mcp.so, Smithery, etc.) cuando esté estable en producción.
- **Announcement** (cuando B esté o antes si se quiere): Product Hunt, X,
  comunidades (r/QuantifiedSelf, r/Biohackers, foros PWA). Mensaje: "tu
  relación con el sol, ahora también desde Claude/ChatGPT".

## Orden propuesto

1. **A** (barato, mejora la experiencia ya visible del conector).
2. **B1** (decisión de producto, conversación + doc).
3. **B2** (implementación OAuth + herramientas personales).
4. **C** en paralelo cuando B2 esté cerca — el announcement luce más con
   "conéctalo Y accede a tu historial".
