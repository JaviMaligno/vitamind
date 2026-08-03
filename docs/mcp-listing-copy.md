# Fichas listas para pegar en los directorios MCP

**Verificado contra producción el 2026-08-02** con `tools/list` sobre
`https://getvitamind.app/api/mcp/mcp`. No editar de memoria: si el servidor cambia,
volver a contar antes de rellenar nada.

> El plan del 27/7 decía «10 herramientas». Hoy son **15**. Ese número aparece en fichas
> ya publicadas (registro oficial, Glama, mcpservers.org) y conviene corregirlo cuando se
> toquen.

## Datos

| Campo | Valor |
|---|---|
| Nombre | Vitamin D Explorer |
| Identificador | `io.github.JaviMaligno/vitamind` |
| Endpoint público (sin auth) | `https://getvitamind.app/api/mcp/mcp` |
| Endpoint con cuenta | `https://getvitamind.app/api/mcp-auth/mcp` |
| Transporte | Streamable HTTP, stateless. **Sin SSE** |
| Repositorio | `https://github.com/JaviMaligno/vitamind` (público, MIT) |
| Paquete npm | `vitamind-mcp` |
| Web | `https://getvitamind.app` |
| Cómo conectar | `https://getvitamind.app/connect` |
| Auth | OAuth 2.1 propio, registro dinámico + PKCE S256 |
| Herramientas | **15** — 9 públicas, 6 con cuenta |

**Públicas (9):** `search_city`, `get_sun_times`, `get_vitamin_d_window`,
`get_vitamin_d_year`, `configure_sun_profile`, `get_sun_forecast`,
`compare_vitamin_d_year`, `get_current_status`, `estimate_sun_session`.

**Con cuenta (6):** `get_my_profile`, `get_my_cities`, `update_my_profile`,
`get_my_history`, `log_sun_session`, `set_history_location`.

## Descripción corta (≤100 caracteres, tope del registro oficial)

```
Know when the sun can make vitamin D where you are, for your skin type. Live UV data.
```

## Descripción media (≤500 caracteres, tope del Connector de Glama)

```
Vitamin D Explorer answers when the sun is strong enough to make vitamin D at any location,
for the user's own skin type, age and exposed skin. It uses live UV from Open-Meteo plus a
Madronich clear-sky model, so answers reflect the actual sky rather than an average. Six
widgets render inline in clients that support MCP Apps. Connecting an account adds a sun
history you can read and correct in conversation. No key needed for the public tools.
```

## Descripción larga

```
Ask "can I make vitamin D right now?" for anywhere on Earth and get an answer that accounts
for your skin type, your age, how much skin is exposed and the weather that is actually
happening — not a seasonal average.

Nine public tools need no account: current status, today's window, the whole year for one
city, a comparison across cities, a five-day forecast, sun times, city search and a session
estimator. Six more work once you connect a Vitamin D account over OAuth: your profile,
your cities, and a sun history you can read, answer and correct from the conversation.

Clients that support MCP Apps get six inline widgets — the day's verdict, the year as a
strip, a city comparison, a forecast, an editable profile and a tappable calendar. Clients
that do not get exactly the same answer as text.

Public endpoint (no auth):  https://getvitamind.app/api/mcp/mcp
Account endpoint (OAuth):   https://getvitamind.app/api/mcp-auth/mcp
Setup guide:                https://getvitamind.app/connect
```

## Aviso técnico para las fichas que lo permitan

Es la causa número uno de «no me responde»:

```
Send both headers: `content-type: application/json` and
`accept: application/json, text/event-stream`. Without the text/event-stream part the
server replies 406 before running anything.
```

## Estado por directorio

| Directorio | Enlace | Estado |
|---|---|---|
| Registro MCP oficial | dofollow | ✅ 27/7 |
| npm | — | ✅ `vitamind-mcp@1.0.0` |
| Glama | — | ✅ server + connector |
| mcpservers.org | `nofollow` | ✅ 28/7 |
| punkpeye/awesome-mcp-servers | dofollow | ⏸️ PR #11026, esperando mantenedores |
| **PulseMCP** | **dofollow** | ⏳ ingiere del registro oficial; ausente el 2/8 |
| **Smithery** | **dofollow** ×2 | ✅ 3/8 — `smithery.ai/server/javimaligno/vitamind` |
| **Cursor Directory** | por comprobar | ✅ enviado 3/8 — `cursor.directory/plugins/vitamin-d-explorer`, en revisión |
| mcp.so | dofollow **solo pagando 39 $** | ❌ **descartado** por el owner el 3/8 |

### PulseMCP

No hay formulario. Ingiere el registro oficial a diario y publica semanalmente; estamos
en el registro desde el 27/7 y el 2/8 aún no aparecíamos. **Volver a buscar
`pulsemcp.com/servers?q=vitamind` a partir del 3/8**; si sigue sin salir, escribir a
`hello@pulsemcp.com` citando `io.github.JaviMaligno/vitamind`.

### Smithery — ✅ hecho el 2026-08-03

```
npx @smithery/cli login
npx @smithery/cli mcp publish "https://getvitamind.app/api/mcp/mcp" -n javimaligno/vitamind
```

Introspecciona solo: salieron **15 herramientas y 5 recursos** sin tocar nada, así que aquí
el número viejo no llegó a colarse. Ficha con **dos enlaces dofollow** a `getvitamind.app`
— tercer dominio enlazante.

**Dos trampas que costaron tiempo:**

1. **Publicar deja el servidor `unlisted` por defecto.** Sale un banner («This server is
   unlisted and won't appear in search results») **que solo se ve con sesión iniciada**.
   Sin entrar al panel, habría quedado publicado y invisible en las búsquedas. Se desactiva
   en Settings → General → *Unlisted*.
2. **El CLI no pone metadatos.** `mcp publish` solo acepta `--name` y `--config-schema`; no
   hay comando de descripción. Display name, descripción, homepage y repositorio se
   rellenan en Settings → General, y **el campo `homepage` es el que produce el backlink**.
   Sin él la ficha no enlaza a la app en absoluto.

**Y el checkbox de `Unlisted` no responde a JavaScript**: ni asignar la propiedad ni
`element.click()` ni el clic por referencia del navegador cambiaron el estado de React.
Solo funcionó un clic real sobre sus coordenadas. Verificar siempre **recargando**, no
leyendo el DOM justo después: los dos primeros intentos parecían haber funcionado.

### Cursor Directory — ✅ enviado el 2026-08-03

`cursor.directory/plugins/new` con sesión de GitHub. Sigue el estándar **Open Plugins**, no
el del registro MCP.

**Su escaneo automático falló al principio**: busca `.mcp.json` (o `mcp.json`) en la raíz
del repo, y `vitamind-mcp` solo tenía `server.json` — mismo nombre de idea, formatos
distintos para consumidores distintos. `server.json` describe la entrada del **registro**;
`.mcp.json` es la **configuración de cliente**.

Se resolvió añadiendo `.mcp.json` al repo del paquete
([commit](https://github.com/JaviMaligno/vitamind-mcp/commit/9134287)):

```json
{ "mcpServers": { "vitamind": { "command": "npx", "args": ["-y", "vitamind-mcp"] } } }
```

Sirve más allá de este directorio: cualquier cliente que siga Open Plugins lo lee.

El escaneo rellena nombre y descripción con plantillas pobres («vitamind-mcp plugin for
Cursor») — hay que reescribirlos a mano antes de publicar.

**Queda pendiente:** la ficha dice *«Scanning your plugin… it will appear publicly once the
security agent finishes»* y *«This plugin is unpublished and hidden from the directory»*.
Mismo patrón que Smithery: enviado no es visible. **Volver a comprobarlo.**

### mcp.so — descartado

Pasó a **pago**: 39 $ únicos, y el enlace dofollow es precisamente lo que se compra. Sin
opción gratuita el 2/8. **El owner decidió no pagarlo** el 3/8. No volver a proponerlo sin
que cambie el precio o el modelo.

---

## Para mañana (2026-08-03): dónde está el número viejo

El «10 herramientas» hay que corregirlo en cada sitio ya publicado. Comprobado el 2/8:

- **`CLAUDE.md:113`** — «10 tools (6 public…)». En el repo, se arregla con un commit.
- **Registro MCP oficial** — `server.json` no enumera herramientas, así que puede que no
  haga falta republicar; el registro las introspecciona. **Verificar** en la ficha antes
  de tocar nada: republicar exige el binario Go y login de GitHub.
- **Glama** — la pestaña Schema se rellena introspeccionando el contenedor. Si muestra 10,
  hace falta un **Make Release** nuevo para que vuelva a leer. Su descripción sí es texto
  editable a mano.
- **mcpservers.org** — ficha editable; comprobar qué dice.
- **npm `vitamind-mcp`** — mirar si su README menciona el número. Republicar exige OTP, así
  que lo hace el owner en una terminal real.
- **PR #11026 de punkpeye** — su entrada es una línea; comprobar si cita el número.

Las descripciones nuevas, ya dimensionadas a cada tope, están arriba en este documento.

Y lo que quedó pendiente de hacer con sesión iniciada: **Smithery** (`npx @smithery/cli
login` + `publish`) y **Cursor Directory** (`cursor.directory/plugins/new` con GitHub).
