# Plan — las cuatro páginas que responden «cuánto tiempo al sol»

Ejecuta `docs/superpowers/specs/2026-08-27-fototipo-pages-design.md`. **Lee el spec entero
antes del paso 1**: este plan da los pasos, el spec da las razones, y varias decisiones
aquí parecen arbitrarias sin haberlo leído.

Una madre y tres hijas, en seis idiomas: **24 páginas**. TDD estricto, un paso por commit.

---

## Límites de la máquina — leer antes de ejecutar un comando

Esta máquina se satura y cuando lo hace muere el proceso, llevándose el trabajo por
delante. Ya ocurrió cuatro veces el 2026-08-27.

- Vitest SIEMPRE `--maxWorkers=2` y SOLO ficheros concretos: `npm test -- --maxWorkers=2 <ruta>`.
- **NUNCA la suite entera** salvo en el paso 14. **NUNCA `npm run build`** salvo el paso 15.
- **NUNCA `rtk next build`**: sirve un build cacheado y miente diciendo «0 errors».
- `npm run typecheck` y `npm run lint` son baratos: úsalos en cada paso.
- Si arrancas el dev server, mátalo POR PID al terminar (`TaskStop` no mata el node):
  `Get-NetTCPConnection -LocalPort 3000 -State Listen | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }`
- Scripts temporales en la RAÍZ del repo (los imports necesitan el alias `@/`), **borrados
  inmediatamente después**.

## Lo que ya está medido — no lo vuelvas a medir

- Minutos para 1000 UI (Madrid, 21 jun, 25 % piel, 35 a): I 5,0 · II 6,2 · III 7,5 ·
  IV 11,2 · V 18,7 · VI 30,0.
- **El ratio vitD/quemadura es 0,2396 en los seis tipos**, idéntico a seis decimales y
  constante ante cambios de área, objetivo, edad y UVI. El tipo de piel se cancela.
- Por eso son tres páginas y no seis. Ver §3 del spec.
- Marcado: **`Article`**. `FAQPage` dejó de dar resultado enriquecido el 2026-05-07,
  `HowTo` murió en 2023, `MedicalWebPage` nunca lo leyó Google.
- **No hay marcado que ayude en AI Overviews.** Lo que no esté en el HTML visible no cuenta.
- `/vitamina-d/` en Search Console: 39 impresiones, 0 clics, posición 7,7 en 3 meses.

## Los cuatro avisos que van a morder

1. **El middleware se come cualquier ruta de dos segmentos** cuyo primer segmento sea el
   `CITY_PREFIX` de ese locale (`i18n/on-demand-city-rewrite.ts`, desde el 2026-08-27). Por
   eso las hijas NO cuelgan de `vitamina-d`. El paso 2 lo fija con un test.
2. **`de` y `ru` comparten el prefijo `vitamin-d` con `en`.** Cualquier convención nueva
   tiene que sobrevivir a eso.
3. **Los números no se escriben a mano.** Se calculan en build desde `minutesForVitD`. Es
   la regla de `CLAUDE.md` que ya dejó cinco claims caducadas en producción.
4. **`messages/__tests__/health-claims.test.ts`** vigila las afirmaciones médicas: nada de
   sinergia, nada de K2 cardiovascular, la declaración ósea atribuida a «vitamina K».

---

## FASE 1 — Rutas y seguridad

### Paso 1: los slugs localizados

- [ ] **commit**

Crea `lib/suntime-routes.ts` con el prefijo de la madre y los tres segmentos de las hijas,
en los seis idiomas. Por descripción, nunca por número (§3 del spec).

Base sugerida, ajústala si al escribirla suena forzada en algún idioma:

| locale | madre | clara | media | oscura |
|---|---|---|---|---|
| es | `cuanto-sol-vitamina-d` | `piel-clara` | `piel-media` | `piel-oscura` |
| en | `how-long-in-sun-vitamin-d` | `fair-skin` | `medium-skin` | `dark-skin` |
| fr | `combien-de-soleil-vitamine-d` | `peau-claire` | `peau-mate` | `peau-foncee` |
| de | `wie-lange-sonne-vitamin-d` | `helle-haut` | `mittlere-haut` | `dunkle-haut` |
| ru | `skolko-solnca-vitamin-d` | `svetlaya-kozha` | `srednyaya-kozha` | `temnaya-kozha` |
| lt | `kiek-saules-vitaminui-d` | `sviesi-oda` | `vidutine-oda` | `tamsi-oda` |

Todo ASCII, como ya hacen `lib/city-slugs.ts` y `lib/sun-routes.ts` — mira cómo resuelven
el ruso, que es el caso que obliga a transliterar.

**Hecho cuando:** el módulo exporta el mapa, typecheck y lint limpios.

### Paso 2: el test que impide que el middleware se las coma

- [ ] **commit** — TEST QUE FALLA, y este es el paso que no puedes saltarte

En `app/__tests__/city-route-dynamic.test.ts` (donde ya viven los asserts de la reescritura)
añade que **ninguna de las 24 URLs nuevas es capturada** por `onDemandCityRewrite`.

Genera las 24 desde `lib/suntime-routes.ts`, no las escribas a mano: si mañana cambia un
slug, el test tiene que seguir cubriéndolo.

Ojo a `de` y `ru`, que comparten prefijo con `en`. Y comprueba también la madre suelta
(un segmento) y las hijas (dos segmentos), porque el riesgo está en las de dos.

```bash
npm test -- --maxWorkers=2 app/__tests__/city-route-dynamic.test.ts
```

**Hecho cuando:** el test pasa. Si falla, el paso 1 eligió mal los slugs y se corrige ahí,
no aquí.

---

## FASE 2 — El cálculo

### Paso 3: test que falla — los rangos por banda

- [ ] **commit**

`lib/__tests__/suntime-content.test.ts`. Fija que para cada banda (clara I-II, media III-IV,
oscura V-VI) se obtiene el rango de minutos entre marzo y septiembre a latitud 40°, y que:

- la banda clara siempre pide menos minutos que la media, y esta menos que la oscura;
- en invierno a latitud alta la respuesta es «imposible» y **es la misma para las tres**
  (`MIN_UVI` no depende de la piel — spec §3);
- el ratio vitD/quemadura sale idéntico en las tres bandas, que es el hecho que justifica
  que sean tres páginas y no seis. Si algún día deja de serlo, este test avisa.

### Paso 4: implementar `lib/suntime-content.ts`

- [ ] **commit**

Funciones puras que devuelven, por banda: el rango de minutos, el mínimo de verano, el
máximo de primavera/otoño, los minutos hasta quemadura, y los meses imposibles a una
latitud dada. Reutiliza `minutesForVitD`, `erythemaMinutes`, `uvIndex`, `ozoneDU` y
`solarElev`. **No dupliques el modelo.**

Sigue el patrón de `lib/city-content.ts`, que ya hace esto para las páginas de ciudad.

### Paso 5: test que pasa

- [ ] **commit**

---

## FASE 3 — El copy

### Paso 6: test que falla — las claves en los seis idiomas

- [ ] **commit**

`messages/__tests__/suntime-copy.test.ts`. Exige que las claves existan en los seis
ficheros, que **ninguna contenga un número literal de minutos** (los números llegan por
interpolación desde el paso 4), y que la madre declare los tres supuestos: área expuesta,
edad y objetivo de 1000 UI.

### Paso 7: escribir el copy — el paso más largo, y el que decide si esto sirve

- [ ] **commit**

**Advertencia del spec §3: hoy no existe ni una línea de texto condicionada al tipo de
piel en todo el repo.** Esto se escribe de cero.

Orden obligatorio, para que las tres hijas no acaben siendo la misma página:

1. **Primero las tres hijas**, y cada una desde su propio ángulo:
   - **clara** → riesgo de quemadura. Necesita lo mínimo y el margen absoluto es corto.
   - **media** → el caso por defecto, el que las recomendaciones genéricas asumen.
   - **oscura** → prevalencia de déficit y suplementación en latitudes altas. El NHS
     singulariza ascendencia africana, afrocaribeña y del sur de Asia.
2. **Después la madre**, que resume y reparte. Escribirla antes contamina las hijas con su
   texto.

**Prueba a la que se somete el resultado:** pon las tres hijas en columnas. Si una frase
podría estar en cualquiera de las tres cambiando el número, esa frase sobra.

es y en son finales. fr, de, ru y lt van best-effort y **marcados para revisión nativa** —
la última pasada sobre esas cuatro encontró 13 errores reales, no es un trámite.

Cuidado con `health-claims`: las 1000 UI son **la elección de este producto**, no un
consenso; hay recomendaciones de 600, 800 y 2000. Y hace falta un descargo de
responsabilidad — Bask lo tiene y este sitio también debería.

### Paso 8: test que pasa

- [ ] **commit**

---

## FASE 4 — Las páginas

### Paso 9: test que falla — las rutas

- [ ] **commit**

`app/__tests__/suntime-routes.test.ts`. Fija que las 24 existen, que llevan `Article` en el
JSON-LD (**no `FAQPage`**, spec §6), canonical propio, hreflang entre las seis, y que **la
respuesta en minutos está en el HTML visible** — no solo en el marcado. Es la consecuencia
directa de que los sistemas de IA ignoren el JSON-LD.

### Paso 10: implementar la madre

- [ ] **commit**

`app/[locale]/[suntimePrefix]/page.tsx`. Estática (`generateStaticParams` + `revalidate =
false`), como las páginas de ciudad. Responde arriba **sin formulario delante** (spec §4),
declara los supuestos y enlaza a las tres hijas.

### Paso 11: implementar las hijas

- [ ] **commit**

`app/[locale]/[suntimePrefix]/[band]/page.tsx`. Misma forma. Cada una enlaza a la madre, a
las otras dos, a `/learn` para el mecanismo, y **a la app con el fototipo preseleccionado**
— que es lo único que ni Google ni un asistente genérico tienen.

### Paso 12: test que pasa

- [ ] **commit**

---

## FASE 5 — Integración

### Paso 13: sitemap, enlaces y `/learn`

- [ ] **commit**

- Las 24 al sitemap, **indexables** (a diferencia de las páginas bajo demanda, que son
  `noindex`). Con su propia constante de revisión en `lib/content-revision.ts`; **no
  reutilices `CITY_PAGE_REVISION`**, es otra familia con otro ciclo.
- Comprueba que IndexNow las recoge: `lib/indexnow.ts` importa `app/sitemap.ts`, así que
  deberían entrar solas. **Verifícalo, no lo supongas.**
- Enlace desde `/learn`, desde el footer y desde el índice de ciudades.
- **Reenfocar `/learn`** (spec §5): cambian `title`, `description` y el encuadre hacia el
  mecanismo. **Los 29 apartados no se tocan**, ni su `FAQPage`, ni su URL.

### Paso 14: la suite completa, UNA vez

- [ ] **sin commit**

```bash
npm run typecheck && npm run lint
npm test -- --maxWorkers=2
```

Compara el recuento de ficheros ejecutados contra `rg --files -g '*.test.ts*'` menos
`tests/e2e`: bajo carga vitest ejecuta menos ficheros y sale con éxito igualmente.

### Paso 15: CHECKPOINT HUMANO

- [ ] **para aquí**

Build de producción y verificación en navegador, móvil real incluido. Enseña al humano:
una hija, la madre, y `/learn` reenfocado. **No abras PR sin este checkpoint** — es copy
de salud en seis idiomas y cuatro de ellos sin revisión nativa.

---

## Criterio de reversión, escrito por adelantado

Si a los tres meses la madre rinde y las hijas no, **las hijas se consolidan en la madre
con anclas**. Las 438 páginas de ciudad rinden 0,08 impresiones por página; el precedente
está demasiado fresco para no escribir esto antes de empezar.
