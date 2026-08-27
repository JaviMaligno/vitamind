# Las páginas que responden la pregunta que trae la gente

Spec, 2026-08-27. Fase 1 de tres; las fases 2 (UI) y 3 (MCP) se diseñan después pero
condicionan decisiones de esta, así que quedan esbozadas en §7.

## 1. El problema, medido

Las consultas de vitamina D con demanda real **no llevan ciudad**:
«cuanto tiempo al sol para vitamina d», «vitamina d sol», «se puede tomar vitamina d del
sol en invierno», «cuál es la vitamina del sol» (`data/aio-tracking/queries.json`).

Las 438 páginas de vitamina D **son todas de ciudad**. Resultado medido en Search
Console, 3 meses, filtrando por carpeta: **39 impresiones, 0 clics, posición media 7,7**.

**No es un problema de ranking.** 7,7 es primera página — mejor que las páginas de
amanecer, que van en 11,9 y se llevan 99 de 101 clics. Lo que falta es una página para la
forma en que se pregunta.

`/learn` no la cubre: existe, no lleva ciudad, y rinde 14 impresiones. Sus 29 apartados
explican el **mecanismo** (por qué solo el UVB, por qué no a través del cristal, si el
vello bloquea). **Ninguno responde «cuánto tiempo».**

## 2. Lo que Google contesta hoy, y por qué está mal

Comprobado en el navegador el 2026-08-27. Para «cuanto tiempo al sol para vitamina d», el
AI Overview responde **«10 a 15 minutos al día, de 2 a 3 veces por semana»** citando a
Rioja Salud, y a continuación enumera de qué depende: área expuesta, cristales, estación.
Una de sus fuentes se matiza sola: *«Datos orientativos para fototipo II-III en latitud
~40°N (España peninsular)»*.

Medido con el motor de este repo (`minutesForVitD` + `uvIndex` + `solarElev`), Madrid,
21 de junio, 25 % de piel, 35 años, objetivo 1000 UI:

| Fototipo | Minutos |
|---|---|
| I — Muy clara | **5,0** |
| II — Clara | 6,2 |
| III — Media | 7,5 |
| IV — Oliva | 11,2 |
| V — Morena | 18,7 |
| VI — Oscura | **30,0** |

**Factor 6× entre extremos.** La respuesta de consenso (10-15 min) solo es correcta para
los fototipos III y IV: **al tipo I le sobra el doble de tiempo y al tipo VI se le queda
en menos de la mitad.** Está mal para cuatro de los seis.

Como contraste, la latitud varía menos — a fototipo III, 21 de junio: Bogotá 4,9 · Miami
5,5 · Madrid 7,6 · Londres 10,5 · Oslo 13,9. Menos de 3×.

**El eje que decide la respuesta es el fototipo, y es justo el que un buscador no puede
resolver porque no sabe quién pregunta.** Ahí está el hueco.

## 3. Decisión: seis páginas, una por fototipo, más una madre

Se consideraron tres formas (§8 registra las descartadas y por qué). La elegida:

- **`/vitamina-d-sol/` — la madre.** Responde la consulta genérica, que es la que tiene
  volumen. Da el rango honesto (5 a 30 minutos a mediodía de verano en latitud media),
  explica que el número depende del fototipo, y reparte a las seis.
- **Seis hijas**, una por fototipo, cada una con **su** respuesta.

**La razón NO es la indexación.** Es que cualquier página única tendría que elegir un
número para el HTML, y **cualquier número que elija es falso para cuatro de cada seis
lectores** — repetiría el error del AI Overview con otra tipografía. Seis páginas dicen
seis cosas distintas porque **son** seis cosas distintas.

### El riesgo, y cómo se evita

Las 438 páginas de ciudad son el precedente de qué pasa cuando se multiplica una
plantilla: 0,08 impresiones por página. Dos condiciones vinculantes:

1. **Cada página dice en qué se diferencia de las otras cinco**, con su propio texto. No
   una plantilla con el número sustituido. El fototipo I quema en minutos y su límite es
   el eritema; el VI necesita media hora y su riesgo real es la insuficiencia invernal.
   Son artículos distintos, no seis instancias.
2. **Si a los tres meses la madre rinde y las hijas no**, las hijas se consolidan en la
   madre con anclas. Criterio de reversión escrito por adelantado.

## 4. Qué responde cada página

**Arriba, la respuesta, en HTML estático e indexable.** Sin formulario delante: quien
llega de una búsqueda con un formulario se vuelve al buscador.

Para cada fototipo, a latitud 40° y 25 % de piel expuesta, entre marzo y septiembre:

| Fototipo | Rango |
|---|---|
| I | 5-9 min |
| II | 6-11 min |
| III | 8-13 min |
| IV | 11-20 min |
| V | 19-34 min |
| VI | 30-54 min |

**Debajo, de qué depende** — y esto es lo que el AIO admite no dar: la variación por
estación, por latitud, y el hecho de que **en invierno por encima de cierta latitud es
imposible a cualquier duración** (`MIN_UVI = 3`; Madrid el 21 de diciembre da IMPOSIBLE
para el fototipo III).

**Y el puente al cálculo real**, que es lo único que ni Google ni un asistente genérico
tienen: enlace a la app con el fototipo ya preseleccionado.

### La regla dura que aplica aquí

Toda cifra de estas páginas es una afirmación sobre `lib/`. `CLAUDE.md` documenta cinco
claims caducadas que llegaron a producción. **Los números no se escriben a mano en
`messages/*.json`: se calculan en build** desde `minutesForVitD`, como ya hacen las
páginas de ciudad. Si el modelo cambia, el texto cambia solo.

`messages/__tests__/health-claims.test.ts` aplica: nada de sinergia, nada de K2
cardiovascular, la declaración ósea atribuida a «vitamina K» genérica.

## 5. `/learn` se reenfoca en el mismo lote

Decisión del usuario, condicionada a que la fase dure más de una semana. **Dura más**:
siete páginas × seis idiomas con copy que no puede ser plantilla, más revisión nativa.

Hoy `/learn` se titula «Guía Completa de Síntesis Solar y Suplementación» y su
descripción enumera D3, K2, magnesio, dosis y niveles en sangre. Eso compite por «guía de
vitamina D» contra MedlinePlus y la Clínica Universidad de Navarra — **imposible con 19
enlaces externos, 12 de ellos propios**.

Se reenfoca a lo que de verdad cubre: **el mecanismo**. Por qué el UVB y no el UVA, por
qué el cristal lo bloquea, qué significa el índice UV. Deja de pelear por la consulta de
entrada, que pasa a las páginas nuevas, y estas le mandan el detalle.

Solo cambian `title`, `description` y el encuadre. **Los 29 apartados no se tocan**, ni
el `FAQPage`, ni la URL.

## 6. SEO

- **Indexables** (a diferencia de las páginas bajo demanda, que son `noindex`).
- En el sitemap, con `lastmod` declarado por `CITY_PAGE_REVISION` o constante propia.
- Slug **sin ciudad** y localizado por idioma, con hreflang entre las seis locales.
- `FAQPage` en la madre; las hijas, `Article` o `MedicalWebPage` — a decidir en el plan
  con la documentación de Google delante, no de memoria.
- Enlace desde `/learn`, desde el índice de ciudades y desde el footer.

**Advertencia YMYL:** es territorio sanitario. Google favorece dominios institucionales y
esto no se gana en semanas. La apuesta no es ganarle a MedlinePlus en «vitamina D», es
ganar en **«cuánto tiempo al sol *si tengo la piel clara*»**, que es una consulta que las
instituciones no responden con un número porque no personalizan.

## 7. Fases posteriores, esbozadas (condicionan esta)

**Fase 2 — UI.** La app entra por `/` → `/dashboard`. Estas páginas son una puerta nueva
para quien no tiene ciudad puesta. Decisiones abiertas: si el enlace a la app preselecciona
el fototipo por parámetro o por localStorage; si aparecen en la navegación o solo desde
`/learn` y el footer; y si el selector de fototipo del dashboard debe enlazar de vuelta.

**Fase 3 — MCP.** Hallazgo relevante: **el MCP ya responde esta pregunta mejor que el
AIO** — `get_vitamin_d_window` da los minutos y `estimate_sun_session` la producción de
una sesión, ambas con fototipo real. Lo que falta no es herramienta, es que un asistente
sepa que existe. Pendiente: si las páginas nuevas deben declarar el servidor MCP en su
marcado, y si conviene una herramienta que responda la consulta genérica sin ciudad.

**Ninguna de las dos bloquea la fase 1**, pero la fase 1 no debe cerrar puertas: los
números se calculan en build (reutilizables), y el enlace a la app lleva el fototipo.

## 8. Alternativas descartadas

**Una sola página con controles interactivos.** El HTML tendría que traer un número
concreto y cualquiera es falso para cuatro de seis fototipos. Además, lo que Google
indexa es el HTML inicial: la variación que da valor quedaría detrás de JavaScript.

**Pedir fototipo y ubicación antes de responder.** Google indexaría una página sin
respuesta, y quien llega de una búsqueda con un formulario delante se vuelve al buscador.
Es la fricción que este spec existe para evitar.

**Absorber `/learn` en la página nueva.** Tira el `FAQPage` y la indexación que ya tiene,
y mezcla dos intenciones de búsqueda distintas — el mecanismo y la respuesta.

**Ampliar `/learn` con un apartado más.** La pregunta no es una entrada de FAQ: es *la*
pregunta, y necesita el número arriba. Como apartado 30 queda enterrada bajo un
`<details>`, que es exactamente donde está hoy el problema.

## 9. Preguntas abiertas

1. **Slug de la madre.** `/vitamina-d-sol/` colisiona conceptualmente con el prefijo
   `/vitamina-d/` de las páginas de ciudad. Hay que comprobar que el middleware no lo
   capture y decidir si conviene una raíz distinta.
2. **Supuestos de la tabla.** Los rangos usan 25 % de piel y 35 años. El área es un
   supuesto declarable; la edad afecta vía `ageFactor` y habría que decidir si se declara
   o se omite.
3. **Objetivo de 1000 UI.** Es el preset del producto, no un consenso universal. La
   página debe declararlo como elección, no presentarlo como La Cifra.
4. **Orden de construcción.** Madre primero y hijas después, o las siete a la vez. Lo
   primero permite medir si la madre sola basta antes de multiplicar por seis.
