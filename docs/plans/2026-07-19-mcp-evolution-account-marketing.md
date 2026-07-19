# Plan: evolución del MCP, cuenta de usuario y marketing IA

**Estado: aprobado en conjunto; sin fecha por fase.** El MCP v1 anónimo está en
producción (`/api/mcp/mcp`, 4 herramientas, ver CLAUDE.md). Este plan recoge lo
que viene después, en tres bloques independientes.

## Bloque A — Optimización de las herramientas MCP

> **Estado 2026-07-19:** `get_vitamin_d_year`, descripciones anti-cascada y el
> log de uso implementados. Queda pendiente la auditoría fina de respuestas con
> más sesiones reales de uso.

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
