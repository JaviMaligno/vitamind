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

- **`/cuanto-sol-vitamina-d` — la madre** (slug decidido en §9). Responde la consulta genérica, que es la que tiene
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
- **Marcado: `Article`/`BlogPosting`, y nada más.** Investigado el 2026-08-27 contra la
  documentación de Google, y las tres opciones que el borrador barajaba están muertas:
  `HowTo` se retiró en 2023; **`FAQPage` dejó de mostrar resultado enriquecido el
  2026-05-07 y su documentación se borró el 2026-06-15** — la excepción para sitios
  sanitarios ya no existe; y `MedicalWebPage` **nunca fue un tipo que Google leyera**, no
  está en la galería de resultados enriquecidos. `Article` es el único con resultado
  enriquecido real (título, imagen, fechas). Con `author` (Person + `sameAs`),
  `datePublished`, `dateModified` y `BreadcrumbList` para la jerarquía madre→hija.
- **No hay marcado que ayude a ser citado en un AI Overview.** Google lo dice literal:
  «There's also no special schema.org structured data that you need to add». Y medido por
  Ahrefs sobre 1.885 páginas que añadieron JSON-LD contra 4.000 de control: **−4,6 % en
  AI Overviews**, significativo. Otro estudio encontró que los cinco sistemas probados
  extraen **solo HTML visible e ignoran el JSON-LD**. Corolario vinculante para el plan:
  **lo que no esté en el HTML visible no cuenta**. Si hay preguntas, van en el cuerpo.
- Enlace desde `/learn`, desde el índice de ciudades y desde el footer.

**YMYL, corregido con evidencia (2026-08-27).** El borrador daba por hecho que Google
favorece dominios institucionales en salud y que sin firma médica no hay nada que hacer.
**Es falso, y hay un contraejemplo directo.**

Para «how much sun for vitamin D by skin type» la primera página en inglés la ocupan
sitios NO institucionales: examine.com, dummies.com, una tienda de suplementos, una
calculadora — y, sobre todo, **`getbask.app`, el blog de una app competidora de vitamina
D**. Verificado abriendo la página: **no tiene autor, no tiene revisor médico, no tiene
credenciales**. Tiene cuatro citas revisadas por pares (incluido Holick 2004), una tabla
por fototipo × índice UV, preguntas y un descargo de responsabilidad. Su marcado es
`BlogPosting` — ni `MedicalWebPage`, ni `FAQPage`, ni `HowTo`.

Es literalmente el molde de este spec, ya posicionando.

En español el reparto es mixto: hay clínicas, pero también prensa generalista y un blog
de farmacia. Ahí la ventaja es autoridad de dominio, no credenciales.

**Conclusión que cambia la apuesta: la barrera no es la firma médica ni el marcado, es el
perfil de enlaces** — 19 externos, 12 propios. Bask posiciona con el blog de una app; la
diferencia con nosotros es dominio, no schema.

Lo que sí separa a los no institucionales que posicionan de los que no es la
**transparencia metodológica**: examine.com es el caso canónico, sin plantilla de médicos
pero con metodología publicada y citas. Publicar Holick y Dowdy 2010, los supuestos y los
límites del cálculo es la vía realista. Un revisor con credenciales seguiría siendo la
única forma de cumplir la letra de las directrices de calidad de Google, pero **no es
requisito para posicionar**.

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

## 9. Decisiones cerradas con el usuario (2026-08-27)

**El slug.** El primer borrador proponía `/vitamina-d-sol/` y era mal slug por tres
razones, no solo por la colisión. Se parece tanto a `/vitamina-d/` que confunde a un
humano leyendo la URL; **no describe la consulta** (la gente pregunta *cuánto tiempo*, no
«vitamina d sol»); y cierra la puerta a colgar las hijas debajo.

Queda:

```
/cuanto-sol-vitamina-d              ← la madre
/cuanto-sol-vitamina-d/{fototipo}   ← las hijas
```

Localizado por idioma con la forma en que se pregunta en cada uno
(`/how-long-in-sun-vitamin-d`, `/wie-lange-sonne-vitamin-d`…), mismo principio que los
prefijos de ciudad ya existentes.

**AVISO DE MIDDLEWARE, verificado leyendo `i18n/on-demand-city-rewrite.ts`:** desde el
2026-08-27 la reescritura captura **cualquier** ruta de exactamente dos segmentos cuyo
primer segmento sea el `CITY_PREFIX` de ese locale, y la manda a la ruta bajo demanda —
ya no solo los slugs con forma de ciudad. Consecuencias:

- `/vitamina-d/sol` o `/vitamina-d/piel-clara` **serían tragados** como ciudad inexistente.
  Por eso las hijas NO pueden colgar de `vitamina-d`.
- `/cuanto-sol-vitamina-d/piel-clara` sale por el `return null` del check de prefijo,
  pero **el orden de comprobaciones importa y hay que fijarlo con un test**, no confiarlo.
- Ojo también a que `de` y `ru` comparten el prefijo `vitamin-d` con `en`.

**Supuestos: se declaran todos.** Área expuesta (25 %, «brazos y cara»), edad (35 años,
entra por `ageFactor` y la síntesis cae con los años) y el objetivo de **1000 UI como
elección del producto, no como consenso** — hay recomendaciones de 600, 800 y 2000.
Ocultar un supuesto es lo que hace que la cifra de otro parezca autoritaria, y es
precisamente el defecto que estas páginas existen para corregir. Cuidado con
`health-claims.test.ts` al redactar la parte de dosis.

**Las siete a la vez.** Se descartó construir la madre primero y medir: si todas van en
el mismo despliegue, medir por separado no ahorra trabajo. La condición de reversión de
§3 sigue en pie — si a los tres meses la madre rinde y las hijas no, se consolidan.

## 10. Lo que queda para el plan

**¿Seis páginas o tres?** Los fototipos I y II difieren en **un minuto** (5,0 y 6,2), y
III y IV en cuatro. Agrupados de dos en dos —clara, media, oscura— serían tres páginas
con diferencias grandes de verdad y menos riesgo de contenido casi idéntico. Seis dan más
superficie pero acercan el problema de las 438 páginas de ciudad. **Decidir en el plan,
con el criterio de "¿estas dos páginas dirían cosas distintas?" delante.**

**El marcado estructurado** de las hijas (`Article` vs `MedicalWebPage`): decidir con la
documentación de Google delante, no de memoria.

**Orden de construcción interno**, dado que se despliegan juntas: qué se hace primero
para que el copy de las hijas no sea plantilla.
