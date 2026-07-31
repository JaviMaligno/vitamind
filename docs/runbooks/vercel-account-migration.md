# Runbook — mover el proyecto entre cuentas de Vercel

**Escrito tras la caída del 2026-07-30**, en la que `getvitamind.app` estuvo sirviendo
`DEPLOYMENT_NOT_FOUND` con usuarios afectados. Este documento existe para que la
próxima vez no haga falta improvisar.

**Ampliado el 2026-07-31**, tras hacer la migración entera siguiéndolo. Salió **sin
un segundo de caída**, y aun así aparecieron cuatro cosas que el runbook no
contemplaba: la protección de despliegue que traen los proyectos nuevos, que
`domains move` solo envía una solicitud por email (y que esa solicitud puede caducar
en silencio), el TXT de verificación a nivel de proyecto, y que `domains add` deja el
apex redirigiendo a `www`. Todas están abajo, en su paso.

---

## Qué pasó, en una línea

Se borró el proyecto de Vercel **antes** de que el proyecto nuevo estuviera
sirviendo el dominio. Al borrarlo se fueron sus despliegues, y todos los alias que
apuntaban a ellos —incluido el dominio de producción— empezaron a dar 404.

Con el proyecto se fueron también **todas sus variables de entorno**. Sin la copia
que había en `.env.local`, las claves VAPID se habrían perdido y con ellas **todos
los suscriptores de notificaciones push, de forma irreversible**.

### La regla que resume el runbook

> **No se borra nada hasta que el destino sirve el dominio en producción y está
> verificado.** El proyecto viejo es tu única vuelta atrás.

---

## Qué vive dónde (inventario previo, obligatorio)

Antes de tocar nada, hay que saber qué se mueve y qué no. Esto es lo que hay hoy:

| Cosa | Dónde vive | ¿Sobrevive a borrar el proyecto? |
|---|---|---|
| Cuentas de usuario, perfiles, historial | **Supabase** | ✅ Sí. Es otro proveedor, ni se entera |
| Suscripciones push (filas) | **Supabase** | ✅ Sí |
| Tokens OAuth del MCP | **Supabase** | ✅ Sí |
| **Claves VAPID** | Variables de entorno del proyecto | ❌ **No.** Y sin ellas las suscripciones de arriba quedan inservibles |
| Resto de secretos (Supabase, `CRON_SECRET`) | Variables de entorno del proyecto | ❌ No |
| Despliegues y sus alias | El proyecto | ❌ No |
| **El dominio** | **La cuenta**, no el proyecto | ⚠️ Sobrevive al borrado del proyecto, pero **sigue retenido por la cuenta vieja** |
| DNS de `getvitamind.app` | Nameservers de **Vercel**, bajo la cuenta vieja | ⚠️ Ojo: sacar el dominio de la cuenta puede dejar el DNS sin servir |
| Cron diario | `vercel.json`, aplicado al proyecto | ❌ Se recrea con el proyecto, pero necesita `CRON_SECRET` correcto |
| IDs de org y proyecto | `.github/workflows/ci.yml` (en línea) y `.vercel/project.json` | ❌ Cambian; el CI queda roto hasta actualizarlos |

**La trampa principal**: el dominio pertenece a la **cuenta**. Borrar el proyecto no
lo libera, y añadirlo desde otra cuenta pide verificación por TXT porque para
Vercel es un dominio ajeno.

---

## Orden correcto

### 0 · Copia de seguridad de los secretos (antes que nada)

```bash
cd <repo>
cp .env.local .env.local.bak-$(date +%F)
npx vercel@latest env pull --environment=production  .env.prod.bak  --yes --scope <cuenta-origen>
npx vercel@latest env pull --environment=preview     .env.preview.bak --yes --scope <cuenta-origen>
```

Comprobar que las VAPID están ahí y **que no están corruptas** (el bug del `echo`,
dos incidentes en este proyecto):

```bash
grep -cF '\n"' .env.prod.bak   # tiene que imprimir 0
```

> `vercel link` y `vercel env pull` **reescriben `.env.local`**. Por eso la copia va primero.

### 1 · Crear el proyecto en la cuenta destino, sin tocar el dominio

```bash
npx vercel@latest login              # interactivo: hazlo tú
npx vercel@latest deploy --yes --scope <cuenta-destino>
```

**No uses `vercel project add`**: crea el proyecto con preset "Other" y todas las
rutas dan 404. El proyecto tiene que nacer de un `deploy`, que detecta Next.

### 2 · Restaurar variables de entorno en el proyecto nuevo

Con `printf`, **nunca con `echo`** — `echo` añade un `\n` literal que Vercel guarda
dentro del valor y corrompe el secreto en silencio (VAPID rotas 53 días, Supabase
58 días; ambos incidentes están en `CLAUDE.md`):

```bash
printf '%s' "$VALOR" | npx vercel@latest env add NOMBRE production --force --scope <cuenta-destino>
```

Las siete que necesita la app: `NEXT_PUBLIC_SUPABASE_URL`,
`NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`,
`NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_CONTACT`, `CRON_SECRET`.

**Las VAPID se copian tal cual.** Generar un par nuevo no es una molestia menor: las
suscripciones se filtran por `vapid_public_key`, así que un par nuevo deja a todos
los suscriptores actuales sin notificaciones y sin manera de recuperarlos.

`CRON_SECRET` y las VAPID deben ser **distintas entre Production y Preview**; el
resto son iguales en ambos entornos.

### 2 bis · Desactivar Deployment Protection en el proyecto nuevo

**Los proyectos nuevos nacen con `ssoProtection` activada**, en modo
`all_except_custom_domains`. Consecuencia concreta: el dominio propio pasa, pero
cualquier URL `*.vercel.app` devuelve un **302 al SSO de Vercel** — y ahí está el
alias de dev, que es el host del conector MCP de pruebas. Claude recibiría el
redirect en vez de JSON y el servidor MCP sería inalcanzable.

En el panel: **Settings → Deployment Protection → Vercel Authentication →
Disabled**. Por API:

```bash
curl -s -X PATCH "https://api.vercel.com/v9/projects/<proyecto>?teamId=<team>" \
  -H "Authorization: Bearer $TOKEN" -H "content-type: application/json" \
  -d '{"ssoProtection":null}'
```

⚠️ El token que guarda el CLI en `com.vercel.cli/Data/auth.json` **no sirve** para
esto: devuelve 403. Hace falta un token de API creado en
`vercel.com/account/settings/tokens`.

Comprobar por la URL de **despliegue**, no por el alias de producción: el alias
está exento y da 200 aunque la protección siga puesta.

### 3 · Desplegar a producción y verificar **por la URL del proyecto**, sin dominio

```bash
npx vercel@latest --prod --yes --scope <cuenta-destino>
```

Verificar contra la URL `*.vercel.app` que da el despliegue, **antes** de tocar el
dominio:

```bash
curl -s -o /dev/null -w "%{http_code}\n" https://<proyecto>.vercel.app/
curl -s -o /dev/null -w "%{http_code}\n" https://<proyecto>.vercel.app/es
curl -s https://<proyecto>.vercel.app/api/mcp/mcp -X POST \
  -H 'content-type: application/json' -H 'accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"p","version":"0"}}}'
```

Si algo de esto falla, **para aquí**. El proyecto viejo sigue sirviendo a los
usuarios y no se ha perdido nada.

### 4 · Mover el dominio entre cuentas

Esta es la parte que se hizo mal. **No** se borra el dominio de la cuenta vieja para
volver a añadirlo en la nueva: eso obliga a verificar por TXT y, con nameservers de
Vercel, puede dejar el DNS sin servidor. Se **mueve**:

```bash
# desde la cuenta ORIGEN
npx vercel@latest domains move getvitamind.app <cuenta-destino> --scope <cuenta-origen>
```

Mover conserva los registros DNS y no pide TXT, porque no cambia de dueño a ojos de
la verificación: cambia de cuenta dentro de Vercel.

**El comando NO mueve nada por sí solo.** Contesta:

> Success! Sent "<cuenta-destino>" an email to approve the "getvitamind.app" move request.

Ese «Success» es de la *solicitud*, no del traslado. El dominio se queda en la
cuenta origen — y por tanto producción sigue sirviendo, que es la parte buena —
hasta que alguien acepta el email en la cuenta destino. También se puede aceptar
desde `vercel.com/dashboard/domains` con la cuenta destino.

⚠️ **Una solicitud puede caducar sin avisar.** Nos pasó el 2026-07-30: se envió, y
un rato después no había ni dominio movido ni solicitud pendiente
(`transferredAt: null`, ningún campo de transferencia). Hubo que relanzarla.

**Cómo saber si el traslado se completó de verdad** — y no confundirlo con el
dominio simplemente *adjuntado* a un proyecto, que es otra cosa y puede existir sin
que la cuenta sea dueña:

```bash
# el dominio debe DESAPARECER de la cuenta origen y APARECER en la destino
curl -s "https://api.vercel.com/v5/domains?teamId=<team-origen>"  -H "Authorization: Bearer $TOKEN_ORIGEN"  | grep -c '"name":"getvitamind.app"'   # → 0
curl -s "https://api.vercel.com/v5/domains?teamId=<team-destino>" -H "Authorization: Bearer $TOKEN_DESTINO" | grep -c '"name":"getvitamind.app"'   # → 1
```

Mirar `/v9/projects/<proyecto>/domains` **no vale** para esto: ahí el dominio
aparece en cuanto se adjunta, con `verified: false`, aunque la cuenta no lo posea.
Confundir las dos cosas nos costó dar el traslado por hecho cuando no lo estaba.

Después, asignarlo al proyecto nuevo:

```bash
npx vercel@latest domains add getvitamind.app <proyecto> --scope <cuenta-destino>
```

**Y comprobar inmediatamente qué ha hecho con `www`.** Ese comando añade también la
variante `www` y la deja como principal, con el apex **redirigiendo hacia ella**.
Resultado en producción: `getvitamind.app` responde 308 hacia `www`, que a su vez
devuelve otro redirect porque ni siquiera está verificada. El sitio "responde", pero
ninguna URL es la que era — y todos los canónicos y hreflang apuntan al apex.

```bash
curl -s "https://api.vercel.com/v9/projects/<proyecto>/domains?teamId=<team>" \
  -H "Authorization: Bearer $TOKEN" | grep -o '"name":"[^"]*","[^}]*redirect":"[^"]*"'
```

Para dejarlo como debe estar — el apex sirve, `www` redirige al apex:

```bash
# el apex deja de redirigir
curl -s -X PATCH "https://api.vercel.com/v9/projects/<proyecto>/domains/getvitamind.app?teamId=<team>" \
  -H "Authorization: Bearer $TOKEN" -H "content-type: application/json" -d '{"redirect":null}'
# www apunta al apex
curl -s -X PATCH "https://api.vercel.com/v9/projects/<proyecto>/domains/www.getvitamind.app?teamId=<team>" \
  -H "Authorization: Bearer $TOKEN" -H "content-type: application/json" \
  -d '{"redirect":"getvitamind.app","redirectStatusCode":308}'
```

#### El TXT de verificación, si aparece

Tras adjuntar el dominio, el proyecto puede quedarse en `verified: false` pidiendo un
TXT en `_vercel.<dominio>`, y sin eso **el alias no se puede asignar**
(«The domain is not verified and cannot be used as an alias»).

No hace falta tocar el registrador: si el DNS lo sirve Vercel y el dominio ya está en
la cuenta destino, el propio registro se crea por API.

```bash
# el valor exacto sale de aquí, campo `verification`
curl -s "https://api.vercel.com/v9/projects/<proyecto>/domains/getvitamind.app?teamId=<team>" \
  -H "Authorization: Bearer $TOKEN"

curl -s -X POST "https://api.vercel.com/v2/domains/getvitamind.app/records?teamId=<team>" \
  -H "Authorization: Bearer $TOKEN" -H "content-type: application/json" \
  -d '{"name":"_vercel","type":"TXT","value":"vc-domain-verify=..."}'

npx vercel@latest domains verify getvitamind.app --scope <cuenta-destino>
```

Éste es el TXT que Vercel pide cuando se intenta añadir el dominio desde una cuenta
que no lo posee. Con el orden correcto —mover primero, adjuntar después— se resuelve
en un segundo, porque el DNS ya es tuyo.

#### El alias final

Adjuntar el dominio **no** hace que sirva: hace falta un despliegue de producción en
el proyecto destino y apuntarle el alias.

```bash
npx vercel@latest alias set <deploy-de-produccion>.vercel.app getvitamind.app --scope <cuenta-destino>

# comprobar a qué apunta realmente
curl -s "https://api.vercel.com/v4/aliases?domain=getvitamind.app&teamId=<team>" \
  -H "Authorization: Bearer $TOKEN"
```

Ese `v4/aliases` es la respuesta a «¿quién sirve el dominio ahora mismo?». Mientras
apunte a un despliegue de la cuenta origen, el tráfico sigue yendo allí por mucho que
el dominio haya cambiado de dueño.

### 5 · Verificar producción de verdad

```bash
for p in / /en /fr /vitamina-d/madrid /amanecer/madrid/julio /connect /manifest.json /sitemap.xml /robots.txt; do
  printf "%-26s " "$p"; curl -s -o /dev/null -w "%{http_code}\n" "https://getvitamind.app$p"
done
curl -s -o /dev/null -w "cities  %{http_code}\n" "https://getvitamind.app/api/cities?q=madrid"
curl -s -o /dev/null -w "cron    %{http_code} (401 = bien)\n" "https://getvitamind.app/api/push/notify"
curl -sI https://www.getvitamind.app/ | grep -i location   # → https://getvitamind.app/
```

**Un 200 no basta**: el fallo del `www` devolvía 308 y 307, no errores. Hay que mirar
el código exacto y, en los redirects, hacia dónde.

Y a mano, en el navegador: cargar la home, iniciar sesión, ver el perfil. El
certificado puede tardar un par de minutos en emitirse tras el movimiento.

### 6 · Recolocar todo lo que apunta al proyecto viejo

- **`.vercel/project.json`** — se regenera con `vercel link --scope <destino>`.
- **`.github/workflows/ci.yml`** — lleva `VERCEL_ORG_ID` y `VERCEL_PROJECT_ID` **en
  línea, no como secretos**. Hay que cambiarlos a mano.
- **`VERCEL_TOKEN`** en los secretos del repo: el token es de la cuenta vieja y no
  sirve. Crear uno nuevo en la cuenta destino y sustituirlo.
- **Alias de dev**: lo pone el job `deploy-dev` con
  `vercel alias set <url> getvitamind-dev.vercel.app`. Ese hostname también es un
  dominio `.vercel.app` de la cuenta: hay que asegurarse de que existe en la nueva.
- **Cron**: sale de `vercel.json` y se recrea solo, pero solo corre en despliegues de
  **Production**. Verificar en el panel que aparece.
- **PWA instalada**: la que tengan los usuarios apunta al mismo origen, así que
  sobrevive **si el dominio no cambia**. Si cambiara, es una instalación muerta que
  nadie va a reinstalar por su cuenta.

**Orden importante**: el token del repo y los IDs del workflow hay que cambiarlos
**a la vez**. Con los IDs nuevos y el token viejo, los despliegues fallan con
«Project not found»; con los IDs viejos y el token nuevo, igual. Y hay una ventana
peor: si el dominio ya sirve desde la cuenta nueva pero el workflow sigue apuntando
al proyecto viejo, los despliegues **funcionan** y no llegan a producción. Nada
falla visiblemente y los cambios dejan de aparecer.

Mientras esa ventana esté abierta, no empujar nada.

### 7 · Solo ahora, borrar el proyecto viejo

Con producción verificada en la cuenta nueva durante al menos un día. Antes no.

**El proyecto viejo no estorba.** Ya no tiene el dominio, así que no sirve tráfico:
solo ocupa un hueco en la lista. Ese hueco es la vuelta atrás, y es barato.

---

## Vuelta atrás

Mientras no se haya borrado el proyecto viejo, la vuelta atrás es mover el dominio
de vuelta:

```bash
npx vercel@latest domains move getvitamind.app <cuenta-origen> --scope <cuenta-destino>
npx vercel@latest domains add getvitamind.app <proyecto-viejo> --scope <cuenta-origen>
```

Una vez borrado el proyecto viejo, **no hay vuelta atrás**: hay que reconstruir
desde el repo y desde la copia de los secretos. Que es exactamente lo que hubo que
hacer el 2026-07-30.

---

## Recuperación de urgencia (si ya está caído)

1. `npx vercel@latest deploy --yes --scope <cuenta>` — recrea el proyecto.
2. Restaurar las siete variables desde `.env.local` con `printf`.
3. `npx vercel@latest --prod --yes --scope <cuenta>`.
4. `npx vercel@latest domains add getvitamind.app <proyecto> --scope <cuenta>` — sin
   TXT si el dominio sigue en esa misma cuenta.

Restaurar **en la cuenta donde ya está el dominio** es siempre lo más rápido, aunque
no sea la cuenta a la que se quería migrar. La migración se rehace después, con
calma y siguiendo el orden de arriba.

---

## Lo que NO hay que tocar durante una migración

- **Supabase.** Los usuarios, perfiles, historial y tokens OAuth no están en Vercel.
  Ninguna operación de este runbook los afecta, y ninguna debería.
- **El registrador del dominio.** `getvitamind.app` está en un registrador de
  terceros con nameservers apuntando a Vercel. Mientras el dominio se mueva *dentro*
  de Vercel, en el registrador no se toca nada.
- **La clave de IndexNow.** Vive en `lib/indexnow.ts` y en `public/<clave>.txt`, no en
  variables de entorno. Sobrevive sola.
