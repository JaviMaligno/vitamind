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

## 3. Decisión: TRES páginas, no seis, más una madre

**Corregido el 2026-08-27 tras medir. La versión anterior de esta sección proponía seis y
su premisa era falsa; queda al final, en §8, con el error explicado.**

- **`/cuanto-sol-vitamina-d` — la madre.** Responde la consulta genérica, que es la que
  tiene volumen. Da el rango honesto, explica que el número depende del tono de piel, y
  reparte a las tres.
- **Tres hijas**, tituladas por descripción y nunca por número:
  **piel clara (I-II)**, **piel media u oliva (III-IV)**, **piel morena u oscura (V-VI)**.

Tres URLs por idioma, 18 en total. El número de Fitzpatrick aparece como glosa dentro de
la página, jamás en el título ni en el slug. Los seis tipos siguen existiendo como entrada
del calculador: **seis en el control, tres en el contenido.**

Criterio: **una URL por promesa distinta, no por parámetro distinto.**

### Por qué seis era un error: el margen de seguridad es idéntico

La versión anterior argumentaba que seis páginas dicen seis cosas distintas porque el
número varía 6×. Medido, eso es solo la mitad de la historia:

| Tipo | vitD (min) | Quemadura (min) | Ratio |
|---|---|---|---|
| I | 5,0 | 20,9 | **0,2396** |
| II | 6,2 | 26,1 | **0,2396** |
| III | 7,5 | 31,3 | **0,2396** |
| IV | 11,2 | 46,9 | **0,2396** |
| V | 18,7 | 78,2 | **0,2396** |
| VI | 30,0 | 125,1 | **0,2396** |

**El ratio es el mismo a seis decimales**, y se mantiene barriendo área, objetivo, edad y
UVI — verificado en tres configuraciones distintas además de la del informe. Es
estructural: en `lib/vitd.ts`, `tau = 0.8·MED/uvi` y `erythemaMinutes = MED/uvi`, así que
**el tipo de piel se cancela**. Todo lo derivado es el mismo número multiplicado por
{1; 1,25; 1,5; 2,25; 3,75; 6}.

Y la estacionalidad tampoco separa: la ventana depende de `MIN_UVI = 3`, que **no depende
de la piel**. Madrid en enero devuelve `null` para los seis. La frase «en invierno aquí no
puedes sintetizar» sería idéntica en las seis páginas.

Es decir: seis páginas serían la misma página con un número escalado. **Thin content por
definición** — exactamente el error de las 438 páginas de ciudad.

### Lo que sí separa, y son tres cosas

El contenido distinto no sale del motor, sale de la salud pública, y se agrupa en tres:

- **Piel clara:** el ángulo es el **riesgo de quemadura**. Necesitas lo mínimo y el margen
  es corto en términos absolutos (5 minutos de vitamina D contra 21 de quemadura).
- **Piel media:** el caso por defecto. Es la referencia sobre la que están escritas las
  recomendaciones genéricas, incluida la del AI Overview.
- **Piel oscura:** el ángulo es la **prevalencia de déficit** y la suplementación en
  latitudes altas. El NHS singulariza explícitamente ascendencia africana, afrocaribeña y
  del sur de Asia.

Tres promesas, tres páginas.

### Por descripción, no por número

- El mercado ya convergió: **Bask agrupa I-II / III-IV / V-VI**, Cancer Council NSW
  agrupa igual, Healthline ni menciona Fitzpatrick y titula «darker skin» / «lighter
  skin». El numeral solo sobrevive como campo de formulario.
- En español «fototipo» sí es vocabulario de consumo, pero **atado a elegir protector
  solar, no a vitamina D**; los artículos de vitamina D dicen «piel clara / morena /
  oscura». Proxy: la Wikipedia española de *Fototipo* recibe 2.462 vistas al año contra
  685 de *Escala Fitzpatrick*.
- Las consultas compuestas existen y son el objetivo: Bask las tiene como encabezados
  literales («How long should someone with dark skin sit in the sun for vitamin D?»).
  Ninguna lleva número.
- **El Fitzpatrick autodeclarado es poco fiable**, sobre todo en personas de color
  (PubMed 24928709). Seis páginas piden un dato que el lector no sabe dar; «piel clara,
  media u oscura» sí lo sabe.

**Sin volumen de búsqueda citable:** no hay cifras públicas para estas consultas. Lo
anterior es evidencia cualitativa y proxies, no volumen medido.

### La condición de reversión sigue en pie

Si a los tres meses la madre rinde y las hijas no, las hijas se consolidan en la madre con
anclas. El precedente de las 438 páginas de ciudad a 0,08 impresiones por página está
demasiado fresco para no escribirlo por adelantado.

### Aviso para quien escriba el copy

Hoy **no existe ni una línea de texto condicionada al tipo de piel** en todo el repo (cero
condicionales sobre `skinType` en `lib/`, `components/` y `app/`), y las páginas de ciudad
fijan `DEFAULT_SKIN = 3`. Todo el contenido diferencial hay que escribirlo de cero. Con
seis páginas habría que escribir seis veces la misma cosa; con tres, tres cosas distintas.

## 4. Qué responde cada página

**Arriba, la respuesta, en HTML estático e indexable.** Sin formulario delante: quien
llega de una búsqueda con un formulario se vuelve al buscador.

Para cada banda, a latitud 40° y 25 % de piel expuesta, entre marzo y septiembre:

| Página | Fototipos | Rango |
|---|---|---|
| Piel clara | I-II | 5-11 min |
| Piel media u oliva | III-IV | 8-20 min |
| Piel morena u oscura | V-VI | 19-54 min |

(Los seis valores individuales quedan dentro de cada página como detalle, no como
páginas propias.)

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
cuatro páginas × seis idiomas con copy que no puede ser plantilla, más revisión nativa.

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

**Las cuatro a la vez.** Se descartó construir la madre primero y medir: si todas van en
el mismo despliegue, medir por separado no ahorra trabajo. La condición de reversión de
§3 sigue en pie — si a los tres meses la madre rinde y las hijas no, se consolidan.

## 10. Lo que queda para el plan

Las dos preguntas grandes del borrador quedaron cerradas con medición: el marcado (§6, es
`Article`, y las otras tres opciones están muertas) y el número de páginas (§3, son tres,
porque el margen de seguridad es idéntico entre fototipos).

Queda:

**Los slugs de las tres hijas**, localizados en seis idiomas y por descripción, no por
número: `piel-clara`, `piel-media`, `piel-oscura` y sus equivalentes. Ojo al alemán y al
ruso, que comparten prefijo con el inglés en las rutas de ciudad — comprobar que la
convención nueva no reproduce esa colisión.

**Un test que fije el orden de comprobaciones de `onDemandCityRewrite`**, para que ninguna
de las cuatro URLs nuevas pueda ser capturada como ciudad. Es el riesgo concreto de §9 y
no debe quedar en confianza.

**El orden de escritura del copy**, dado que las cuatro se despliegan juntas: qué se
redacta primero para que las tres hijas no acaben siendo la misma página con el número
cambiado. Recordatorio de §3: hoy no existe ni una línea de texto condicionada al tipo de
piel en todo el repo, así que esto se escribe de cero.

**La redacción del objetivo de 1000 UI** sin que la toque `health-claims.test.ts`, y con
el descargo de responsabilidad que Bask sí tiene y este sitio tendría que tener.
