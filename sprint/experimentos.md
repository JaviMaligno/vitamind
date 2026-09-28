# Fase 6 · Experimentos y seguimiento

Decidido el 2026-09-28.

**Plazo de E2:** del 29 de septiembre al 30 de noviembre de 2026. Es el plazo aplazado desde D1.

**Restricciones:**
- Producto congelado (P3).
- Como máximo 3 piezas de contenido.
- Unas 3 h/semana.

**Supuestos que se atacan primero:**
- Cliente 🔴: ¿existe el nicho a contracorriente y llega?
- Diferenciador 1 🟡: ¿la postura propia atrae?

## Escalera de medida (vale para todos los experimentos)
| Peldaño | Qué mide | Si falla, significa… |
|---|---|---|
| 1 · Alcance | Vistas del post, impresiones en Search Console | «No lo vio nadie»: problema de distribución |
| 2 · Visitas | Sesiones en getvitamind.app desde esa fuente (`referrer_host`) | «El titular no interesa» |
| 3 · Uso | Personas que eligen ciudad o calculan desde esas sesiones | «No le importa lo suficiente» |

**Limitación conocida:** `analytics_events` guarda `referrer_host` pero no los parámetros UTM.
- Reddit se distingue por su referrer.
- WhatsApp y Telegram llegan como «(directo)» y se leen contra la línea base de las semanas anteriores.
- Capturar UTM sería código nuevo, y P3 no lo permite.

---

## EXP1 · Pieza a contracorriente en las comunidades del nicho
**Ataca:** el cliente, el diferenciador 1 y la distribución.

**Qué hacer:**
1. **Semana del 29/09.** Escribir **una** pieza, con título de trabajo: *«Octubre: lo que la regla de los 10–20 minutos no te cuenta sobre el sol»*.
   - **Estructura:**
     1. La regla oficial y por qué falla en otoño.
     2. La ventana real: cómo se estrecha y se desplaza de hora, con cifras sacadas de `lib/`.
     3. Lo que el discurso del «sol = peligro» omite, con evidencia enlazada.
     4. El tope antes de quemarse, dicho sin miedo pero sin ocultarlo.
     5. «Calcula la tuya»: enlace a getvitamind.app.
   - **Regla de copy (CLAUDE.md):** cada cifra se comprueba contra el módulo que la calcula (`lib/vitd.ts`, `lib/uv-model.ts`).
   - **Health claims:** nada de «D3 + K2 + magnesio» ni promesas de efectos. Los borradores de `docs/reddit-posts.md` y `docs/community-posts.md` lo incumplen; no se reutilizan tal cual.
2. **Semana del 06/10.** Publicarla **completa y nativa**, no solo el enlace, en 3 sitios:
   - NacionNK (foro o Telegram).
   - Un grupo de dieta carnívora o ancestral en español.
   - r/VitaminD, adaptada al inglés.

   Borradores de mensaje abajo.

**Con quién:** las comunidades del nicho que ya se identificaron en `docs/community-posts.md`.

**Umbral a 19/10, sumando los 3 sitios:**
| Peldaño | Éxito | Fracaso |
|---|---|---|
| 1 · Alcance | ≥ 2.000 vistas | < 500 |
| 2 · Visitas | ≥ 100 sesiones atribuibles | < 30 |
| 3 · Uso | ≥ 15 personas eligen ciudad o calculan | < 5 |
| Señal cualitativa | ≥ 3 comentarios o mensajes pidiendo más o preguntando su caso | 0 |

### Borrador · post en comunidad (ES)
> **Título:** En octubre la regla de «10–20 minutos de sol» deja de valer (y casi nadie lo dice)
>
> Llevo un tiempo calculando la ventana real de síntesis de vitamina D por ciudad, con el UV de verdad y no con la regla genérica. Lo que sale en otoño, en resumen:
> - En [Madrid] la ventana útil pasa de [X h] en septiembre a [Y min] a finales de octubre, y se desplaza: salir a las 16:00 deja de servir hacia el [fecha].
> - En [Bilbao/Zaragoza] se cierra hacia el [fecha] y no vuelve hasta [mes].
> - La regla de 10–20 minutos falla por exceso o por defecto según el día.
>
> [Dos párrafos con la postura: el problema no es el sol, es no saber cuándo sirve.]
>
> Si queréis ver la vuestra, lo tengo en getvitamind.app (gratis, sin registro). Me interesa saber qué hacéis vosotros en otoño: ¿salís, suplementáis, nada?

Las cifras entre corchetes se rellenan con las herramientas o con `lib/` el día de publicar.

### Borrador · r/VitaminD (EN)
> **Title:** The "10–20 minutes of sun" rule quietly stops working in October: here's the actual window for a few cities
>
> [Same structure, with 3 English-speaking and European cities, the calculation method in one paragraph and the discrepancy with the generic rule. Link at the end, not at the start. Ends with a question for the community.]

---

## EXP2 · Bloque «lo que la regla no te dice» en páginas de mes que ya posicionan
**Ataca:** la distribución por el canal que ya existe. Compara canal propio frente a comunidades.

**Qué hacer (semana del 06/10):**
- Un bloque debajo del contenido, **solo** en 5 ciudades españolas (Madrid, Barcelona, Valencia, Sevilla, Zaragoza) × octubre y noviembre, 6 locales.
- Contenido del bloque: la ventana de ese mes, cómo se desplaza y dónde falla la regla genérica, más el enlace a la calculadora.

**Guardarraíles:**
- **No tocar title, meta ni FAQ** (lección de `b5ef203`).
- Subir la revisión con `npx vitest run lib/__tests__/content-revision.test.ts`.
- Leer el copy contra `lib/`.

**Umbral a 02/11:**
- Hoy: 6 de 484 personas eligen ciudad en todo el sitio (1,2 %).
- **Éxito:** ≥ 5 % de las sesiones que entran por esas páginas eligen ciudad o calculan.
- **Fracaso:** < 2 %.

**Consulta para medirlo (se ejecuta el 02/11):**
```sql
with entradas as (
  select session_id, min(occurred_at) t
  from analytics_events
  where host = 'getvitamind.app' and name = 'visit'
    and path ~ '/(amanecer|sunrise|lever-du-soleil|sonnenaufgang|voskhod|sauletekis)/(madrid|barcelona|valencia|sevilla|zaragoza)/'
    and occurred_at > '2026-10-06'
  group by session_id)
select count(*) as sesiones,
       count(*) filter (where exists (select 1 from analytics_events e
         where e.session_id = entradas.session_id and e.name = 'city_selected')) as usan_calculadora
from entradas;
```
La ruta está en la columna `path`, sin query string (`lib/analytics-ingest.ts`, `cleanPath`), así que tampoco se pueden recuperar UTM de ahí.

**Nota:** si el tiempo no da para las dos cosas, EXP1 va primero.

---

## EXP3 · 5 conversaciones con personas del nicho
**Ataca:** el cliente 🔴. Busca nombres reales y lo que hicieron de verdad, no lo que dicen que harían.

**Con quién:** personas que comenten o escriban en EXP1. Ni familia ni amigos.

**Mensaje de reclutamiento (MP):**
> Hola, vi tu comentario en el post del sol en octubre. Estoy intentando entender cómo decide la gente cuándo salir al sol (o no) en otoño. ¿Te importaría contarme 15 minutos cómo lo haces tú? No te voy a vender nada.

**Guion (5 preguntas, siempre sobre el pasado):**
1. ¿Cuándo fue la última vez que decidiste salir al sol pensando en tu salud? ¿Qué hiciste exactamente?
2. ¿Cómo decidiste la hora y cuánto rato? ¿De dónde sacaste esa idea?
3. ¿Tomas suplemento? ¿Desde cuándo y por qué, o por qué no?
4. ¿Qué te hace desconfiar, o no, del consejo oficial sobre el sol? ¿De quién te fías para estas cifras?
5. ¿Has vuelto a abrir la calculadora después del post? ¿Por qué sí o por qué no?

**Umbral a 26/10:**
- **Éxito:** ≥ 3 de 5 describen una decisión concreta del último mes que la herramienta habría cambiado, **y** ≥ 2 la han vuelto a abrir sin recordatorio.
- **Fracaso:** ≤ 1 de 5 en cualquiera de las dos.

---

## Criterio de muerte
**Fecha:** 30/11/2026.

**Se aparca (R5), sin reabrir la sprint, si se cumplen las dos:**
- Menos de 30 personas en total usan la calculadora desde el contenido de EXP1 y EXP2 (peldaño 3).
- Menos de 5 personas con nombre (EXP3 y otras) vuelven sin recordatorio.

**Documento de cierre:** por qué, qué se aprendió y qué condición haría reabrir.

**Señal de absorción que obliga a replantear antes de esa fecha:**
- Google, ChatGPT Health o Apple lanzan una cifra nativa de exposición o síntesis de vitamina D por ubicación y piel.
- Las piezas de EXP1 o EXP2 tienen impresiones pero la página de resultados las responde con un AI Overview sin clic (peldaño 1 bien, peldaño 2 a cero).

## Calendario
| Semana | Qué |
|---|---|
| 29/09 | Escribir la pieza de EXP1 (copy contra `lib/`) |
| 06/10 | Publicar EXP1 en 3 sitios · montar el bloque de EXP2 |
| 13/10 | Contestar comentarios · reclutar para EXP3 |
| 19/10 | **Medir EXP1** |
| 20–26/10 | Conversaciones de EXP3 · **medir EXP3 el 26/10** |
| 02/11 | **Medir EXP2** · decidir si hay pieza 2 (máximo 3 en total) |
| 30/11 | **Criterio de muerte** · volver a la sprint («Retomar») |
