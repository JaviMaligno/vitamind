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
| **Smithery** | **dofollow** | 🔑 requiere login |
| **Cursor Directory** | por comprobar | 🔑 requiere login |
| mcp.so | dofollow **solo pagando 39 $** | 💸 descartado salvo decisión |

### PulseMCP

No hay formulario. Ingiere el registro oficial a diario y publica semanalmente; estamos
en el registro desde el 27/7 y el 2/8 aún no aparecíamos. **Volver a buscar
`pulsemcp.com/servers?q=vitamind` a partir del 3/8**; si sigue sin salir, escribir a
`hello@pulsemcp.com` citando `io.github.JaviMaligno/vitamind`.

### Smithery

```
npx @smithery/cli login
npx @smithery/cli mcp publish "https://getvitamind.app/api/mcp/mcp" -n javimaligno/vitamind
```

### Cursor Directory

`cursor.directory/plugins/new`, entrando con GitHub. Es un formulario de «plugin», no
específico de MCP.

### mcp.so

Pasó a **pago**: 39 $ únicos, y el enlace dofollow es precisamente lo que se compra. Sin
opción gratuita visible el 2/8. Mismo patrón que el Premium de mcpservers.org. Decisión
del owner; por sí solo no justifica el gasto, pero es el único de la lista que se puede
cerrar hoy sin esperar a nadie.
