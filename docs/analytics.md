# Analítica de producto

Dónde viven los datos, qué se mide y las consultas que responden a las preguntas
por las que se montó todo esto.

## Por qué no es Vercel

Vercel Web Analytics sigue montado y sirve las **páginas vistas**, que en Hobby
funcionan. Los **eventos personalizados no**: son una función de Pro (`Custom
Events: –` en la tabla de planes), así que `track()` en este proyecto no
registraría nada. De ahí `/api/events` + Supabase.

## Arquitectura

```
componente → lib/analytics.ts  (emit)
           → lib/analytics-queue.ts   cola en memoria, lote de 20
           → navigator.sendBeacon → POST /api/events
                                  → lib/analytics-ingest.ts  (saneado, puro)
                                  → lib/analytics-store.ts   (service role)
                                  → tabla analytics_events
```

Se envía **por lotes**, no evento a evento: en Vercel cada petición es una
invocación de función, y una visita que dispara ocho eventos costaría ocho. El
vaciado ocurre cuando la pestaña se oculta (`visibilitychange`, la señal fiable
en móvil) o al llegar a 20 eventos.

**Separa entornos.** `host` lleva el dominio al que llegó la petición, puesto por el servidor
desde la cabecera `Host` (nunca por el cliente). Producción y la preview de dev comparten este
proyecto de Supabase, así que **toda consulta debe filtrar** o mezclarás pruebas con visitantes:

```sql
where host = 'getvitamind.app'   -- solo producción
```

Todas las consultas de abajo ya lo llevan. Si escribes una nueva, **empieza por ese filtro**:
es la diferencia entre un visitante de verdad y una pestaña que abrí yo para probar. Las filas
anteriores al 31/8/2026 tienen `host` a NULL (origen desconocido) y quedan fuera del filtro, que
es lo que se quiere.

**Nada identifica a una persona:** no se guarda IP, ni user agent, ni el
referrer completo (solo el host). `visitor_id` es un UUID aleatorio del
navegador. `authed` es un booleano y no un id de usuario a propósito — la
pregunta es si quien tiene cuenta se comporta distinto, y eso lo responde una
bandera sin atar conducta a identidad.

## Catálogo de eventos

| Evento | Propiedades | Para qué |
|---|---|---|
| `visit` | `kind` (first/same_day/returning), `days`, `days_since_first`, `standalone` | Retención sin cuenta |
| `city_selected` | `method` (gps/builtin/geonames/nominatim/custom) | Primer acto de intención |
| `prefs_changed` | `field` (skin/area/age/target) | ¿Se personaliza o se mira y ya? |
| `push_enabled` · `_disabled` · `_denied` · `_failed` · `_gated` | `platform` | **La conversión** |
| `install_accepted` · `_dismissed` · `_manual` · `_installed` | `platform` | La otra conversión |
| `install_banner_shown` | `platform` | Denominador de las anteriores |
| `gps_denied` | — | Fricción en el camino más corto |
| `auth_form_opened` · `auth_signup` · `auth_login` · `auth_logout` · `auth_reset_requested` | `outcome` | Embudo de cuenta |
| `favorite_added` · `favorite_removed` | `total` | Proxy de valor de cuenta |
| `custom_location_saved` | — | Proxy de valor de cuenta |
| `history_override` | `synced` | Proxy de valor de cuenta |

Los tres últimos existen para una decisión concreta: **una cuenta solo merece
construirse si la gente acumula algo que odiaría perder.** Hoy eso es una
suposición; estos eventos la convierten en medida.

## Consultas

Pegar en el editor SQL de Supabase.

### ¿Convierte alguien? (la pregunta de los anuncios)

```sql
select
  count(*) filter (where name = 'visit' and props->>'kind' = 'first')      as visitantes_nuevos,
  count(*) filter (where name = 'push_enabled')                            as push_activado,
  count(*) filter (where name = 'install_accepted' or name = 'install_installed') as instalada,
  count(*) filter (where name = 'visit' and props->>'kind' = 'returning')  as volvieron
from analytics_events
where host = 'getvitamind.app'
  and occurred_at > now() - interval '7 days';
```

Si `visitantes_nuevos` es alto y las otras tres son cero, comprar tráfico
multiplica un cero. Esa es la respuesta a si los anuncios rentan.

### Retención: ¿vuelve la gente?

```sql
select
  (props->>'days')::int as dias_distintos,
  count(distinct visitor_id) as personas
from analytics_events
where host = 'getvitamind.app'
  and name = 'visit'
group by 1
order by 1;
```

### Embudo de instalación (con denominador)

```sql
select
  count(*) filter (where name = 'install_banner_shown')  as se_les_ofrecio,
  count(*) filter (where name = 'install_accepted')      as aceptaron,
  count(*) filter (where name = 'install_dismissed')     as rechazaron
from analytics_events
where host = 'getvitamind.app'
  and occurred_at > now() - interval '30 days';
```

Sin `se_les_ofrecio` un número bajo de instalaciones es ilegible: puede ser una
oferta mala o una oferta que nadie vio.

### ¿Merece la pena construir la cuenta?

```sql
-- Gente que ha acumulado algo que una cuenta preservaría entre dispositivos.
select count(distinct visitor_id) as personas_con_algo_que_perder
from analytics_events
where host = 'getvitamind.app'
  and name in ('favorite_added', 'custom_location_saved', 'history_override');

-- Y de esos, cuántos vuelven otro día (los únicos a quienes sincronizar sirve).
select count(distinct e.visitor_id)
from analytics_events e
where e.host = 'getvitamind.app'
  and e.name in ('favorite_added', 'custom_location_saved', 'history_override')
  and exists (
    -- El filtro va también aquí dentro: una visita de vuelta hecha en dev
    -- convertiría a esta persona en recurrente sin serlo.
    select 1 from analytics_events v
    where v.visitor_id = e.visitor_id
      and v.host = 'getvitamind.app'
      and v.name = 'visit'
      and v.props->>'kind' = 'returning'
  );
```

Si el segundo número es pequeño, construir el registro es trabajo para nadie —
y eso es un resultado, no un fracaso.

### Embudo de cuenta: ¿lo pide alguien sin que se lo pidamos?

```sql
select name, count(*)
from analytics_events
where host = 'getvitamind.app'
  and name like 'auth_%'
group by 1 order by 2 desc;
```

### De dónde llega la gente

```sql
select coalesce(referrer_host, '(directo)') as origen, count(distinct session_id) as visitas
from analytics_events
where host = 'getvitamind.app'
  and name = 'visit'
  and occurred_at > now() - interval '30 days'
group by 1 order by 2 desc limit 20;
```

## Mantenimiento

La tabla crece sin límite. Cuando estorbe, borrar lo viejo:

```sql
delete from analytics_events where occurred_at < now() - interval '12 months';
```

Y para tirar el ruido de las pruebas en dev sin tocar los datos de producción:

```sql
delete from analytics_events where host is distinct from 'getvitamind.app';
```

No hay política de RLS a propósito: el acceso es solo por service role, igual que
`push_subscriptions`. **No añadir un `using (true)`** para "que funcione algo" —
la clave anon viaja a todos los navegadores.


## Medición de producción del 2026-09-28

Resultado guardado en [analytics-results/2026-09-28-28-days.json](analytics-results/2026-09-28-28-days.json).
Ventana: 2026-08-31 12:38:07 UTC a 2026-09-28 12:38:07 UTC; host getvitamind.app.
Obtenido mediante la API de Supabase y agrupado en memoria con la misma lógica que
count(*) y count(distinct visitor_id); no se guardaron identificadores. El reloj del
servidor fijó el corte de 28 días; la lectura paginada no es una transacción SQL.

| Evento | Eventos | Identificadores de navegador distintos |
|---|---:|---:|
| visit | 627 | 483 |
| install_banner_shown | 36 | 36 |
| city_selected | 7 | 6 |
| gps_denied | 8 | 3 |
| history_override | 32 | 2 |
| prefs_changed | 1 | 1 |

Total: 711 eventos. No aparecen eventos de instalación completada, activación de push
ni autenticación en esta ventana. Esto describe eventos registrados, no demuestra que
ninguna de esas acciones haya ocurrido. No sumar los visitantes de distintas filas.

## Uso persistente del MCP

La implementación guarda una fila en mcp_call_events por invocación que entra en un
handler registrado en lib/mcp-server.ts, en ambos endpoints MCP. No utiliza
analytics_events: una llamada de un asistente no tiene visitor_id de navegador.
No permite contar personas únicas ni atribuir llamadas a usuarios o clientes.

**Migración aplicada el 2026-09-28:** supabase/migrations/20260928_mcp_call_events.sql.
RLS y permisos comprobados en el proyecto remoto. La recogida empieza al desplegar
el colector; no hay histórico MCP anterior que reconstruir a partir del navegador.

Campos: tool, occurred_at (inicio), duration_ms, outcome y env (VERCEL_ENV; development
fuera de Vercel). Las consultas de producción siempre filtran env = 'production'.
No se almacenan argumentos, coordenadas, respuestas, mensajes de error, tokens ni IDs.
RLS está habilitado sin políticas públicas; anon y authenticated no tienen acceso.

La escritura se programa con Next.js after(): termina después de enviar la respuesta,
con un timeout de 3 segundos. No hay log por llamada; solo un mensaje genérico si falla
la persistencia. No se reintenta para evitar duplicados. Una caída de Supabase puede
perder eventos: una tabla vacía no distingue falta de uso de un fallo del colector.
Fuera de una petición Next (scripts/tests), el wrapper espera la escritura.

Resultados: success, tool_error (incluye errores JSON devueltos por las herramientas),
authentication_required, insufficient_scope y exception. Un resultado legítimo sin
ventana solar cuenta como success. No se cuentan tools/list, initialize, recursos,
JSON-RPC malformado, argumentos rechazados por el SDK ni HTTP 401 anteriores al handler.
Las negativas de autenticación dentro de una herramienta personal sí se cuentan.
La duración mide el handler, sin incluir la escritura de analytics ni el transporte.

### Volumen y latencia por herramienta: últimos 28 días

```sql
select tool,
       count(*) as llamadas,
       count(*) filter (where outcome = 'success') as correctas,
       count(*) filter (where outcome in ('tool_error', 'exception')) as errores,
       count(*) filter (where outcome in ('authentication_required', 'insufficient_scope')) as rechazos_auth,
       round(avg(duration_ms)) as media_ms,
       percentile_cont(0.95) within group (order by duration_ms) as p95_ms
from public.mcp_call_events
where env = 'production' and occurred_at > now() - interval '28 days'
group by tool order by llamadas desc;
```

### Serie diaria y cobertura temporal

```sql
select (occurred_at at time zone 'UTC')::date as dia_utc, outcome, count(*) as llamadas
from public.mcp_call_events
where env = 'production' and occurred_at > now() - interval '28 days'
group by 1, 2 order by 1, 2;

select min(occurred_at) as primera_llamada, max(occurred_at) as ultima_llamada,
       count(*) as llamadas_guardadas
from public.mcp_call_events where env = 'production';
```

Tras desplegar, ejecutar get_sun_times una vez y comprobar su fila, entorno y resultado
con service role; comprobar que la clave anon no puede leer la tabla. Esa llamada de
verificación contará como uso técnico. No hay borrado automático de este histórico.
