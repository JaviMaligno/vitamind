# Dónde estamos, antes de lanzar

Escrito el 2026-08-27, después de una sesión larga en la que dos rondas de agentes
concluyeron cosas contradictorias y varias resultaron falsas. Esto no es un plan: es lo
que hay que saber antes de decidir, con lo que se retira marcado como tal.

## 1. Cinco cosas que se creían y no son ciertas

**«No hay usuarios, ni siquiera el autor la usa».** Falso, y el error fue mío: conté
filas en `profiles` y en `push_subscriptions` sin abrir la columna `history`. Hay tres
perfiles con 26, 42 y 90 días de historial; uno creado el 7 de marzo, otro activo el 26
de agosto. Hay uso sostenido. Pocos usuarios, sí, pero no cero, y el autor es uno de
ellos.

**«Las páginas de vitamina D no posicionan».** Falso, medido hoy en Search Console
filtrando por carpeta: **39 impresiones, 0 clics, posición media 7,7** en tres meses.
Están en primera página, mejor que las de amanecer (11,9). No es un problema de ranking.

**«El AI Overview no es el mecanismo».** Demasiado fuerte. Esa conclusión del 14 de
agosto se apoyaba en que `sun-toronto-aug` no tiene AIO y tampoco convierte, pero una
consulta sin AIO que tampoco convierte no refuta el mecanismo en las nueve que sí lo
llevan. Y hoy Toronto mostró «Can't generate an AI overview right now», que es un fallo
transitorio, no una ausencia: **las dos lecturas anteriores pudieron ser este mismo
mensaje**, con lo que el contraejemplo entero queda en duda.

**«El ratio de demanda es 151×».** No. La cifra correcta es unas **5×**, y está medida
con Google Trends en el propio repo (`queries.json`: «vitamina d sol» índice 9 contra «a
que hora anochece» 46). El resto de la brecha no es tema, es que el sitio no aparece
para esas consultas.

**«La estructura de comunidad defiende frente a la IA» (Burtch, Stack Overflow contra
Reddit).** El estudio observó de octubre de 2021 a marzo de 2023; el acuerdo de Reddit
con Google es de febrero de 2024. Fuera de ventana: el confusor propuesto no aplica, y
el argumento que construí sobre él tampoco.

**Y un dato que no tenía fuente:** el «2-6 % de CTR normal en posiciones 5-9» lo puse yo
de memoria. Existe literatura de esa clase, pero el número concreto no estaba verificado
y no debe usarse como suelo. Lo único causal que se localizó es Gleason et al., ICWSM
2023 (1.756 participantes, 477.485 SERP, sin vendedores de SEO detrás): una respuesta
directa resta **−12,1 puntos porcentuales** al CTR **a nivel de SERP** — no es una cifra
que se pueda restar del CTR de un sitio concreto.

## 2. Lo que sí está establecido

**El mecanismo no es el AI Overview: es que el resultado responde la pregunta.**
Comprobado hoy en el navegador. Con AIO, la caja da amanecer, mediodía solar y puesta.
Sin AIO —Toronto— el fragmento del primer orgánico ya trae «6:35 am ↑ 8:01 pm». La
respuesta está servida de las dos formas.

Esto es más general y peor que la hipótesis anterior, porque **subir posiciones tampoco
lo arregla**: el fragmento del número uno regala el dato igual.

**Alpenglow está citado dentro del AIO de Madrid.** En la familia que da el 99 % de los
clics. El sitio no aparece en toda la primera página.

**La pregunta de vitamina D no está resuelta, y el propio Google lo dice.** Para «cuanto
tiempo al sol para vitamina d» el AIO da «10 a 15 minutos, 2 a 3 veces por semana» y
acto seguido enumera los factores de los que depende: área expuesta, cristales,
estación. Una de sus fuentes se matiza sola: «datos orientativos para fototipo II-III en
latitud ~40°N». **El hueco que este producto calcula está reconocido dentro del
resultado que lo ocupa.** Eso no prueba que haya negocio; prueba que la pregunta sigue
abierta.

**Barrera de autoridad, no desierto.** Las fuentes citadas en ese AIO son MedlinePlus,
Rioja Salud, la CUN y un dermatólogo. Es un SERP sanitario (YMYL), donde Google favorece
dominios institucionales. Con 19 enlaces externos —12 de la web propia del autor— ese
territorio no se gana con fontanería SEO.

**Desajuste de plantilla, medido:** las consultas de vitamina D con volumen real
—«cuanto tiempo al sol para vitamina d», «se puede tomar vitamina d del sol en
invierno»— **no llevan ciudad**. Las 438 páginas de vitamina D son todas de ciudad
(`/vitamina-d/{ciudad}`, «Vitamina D del sol en {ciudad}»). La familia de amanecer sí
encaja con su forma de consulta. Hay una página sin ciudad, `/learn`, y rinde 14
impresiones.

## 3. Lo urgente, y nadie lo había visto

**El tráfico orgánico se paró el 14 de agosto.** Los 119 clics de tres meses se
concentran entre el 21 de julio y el 14 de agosto, con picos de 15 diarios. Desde el 14
la serie está plana en cero: **trece días**.

Ningún análisis de esta sesión lo vio porque todos razonaban sobre agregados de 28 días
o de 3 meses, y un CTR agregado sobre una serie así no describe ningún estado estable.

Y el 14 de agosto es exactamente la fecha del último estudio de patrones: **aquellas
conclusiones se sacaron justo cuando empezaba el desplome.**

Causas candidatas, sin verificar: estacionalidad (agosto termina y las consultas de
amanecer de verano caen), rotación de las páginas de mes hacia septiembre, un cambio en
Google, o algo roto en el sitio. La rotación de mes no lo explica sola.

**Esto se mira antes de lanzar.** Publicar en Product Hunt sobre un sitio cuyo tráfico
orgánico acaba de desaparecer sin explicación es lanzar a ciegas.

## 4. El lanzamiento nunca ocurrió

`docs/ROADMAP.md` tiene sección de estrategia comercial. `PRODUCT_HUNT.md`,
`x-threads.md`, `linkedin-posts.md`, `outreach-templates.md` y
`docs/original_claude_ouput/vitamin-d-estrategia-comercial.md` son borradores completos.
`PRODUCT_HUNT.md` incluye el comentario que hay que publicar «justo después de lanzar».

**No se ha lanzado en ningún sitio.** Los 101 clics al mes son SEO incidental.

Esto reordena toda la discusión de hoy: se ha estado evaluando la demanda de un producto
que nunca se anunció. No es que se intentara conseguir usuarios y fallara — es que el
plan está escrito y guardado.

## 5. Lo que se arregló hoy, y por qué importa para el lanzamiento

Los bugs corregidos son exactamente los que estropearían una punta de tráfico:

- **El push llegaba a las 04:00 en Nueva York** y a la 01:00 en Los Ángeles. Cron a hora
  fija UTC sin mirar la zona de cada suscripción. Quemaría suscriptores el primer día.
- **El banner de instalación se gastaba a los diez segundos**, guardado como booleano, y
  no volvía a aparecer jamás. Desperdiciaría la única petición con toda esa gente.
- **La notificación no estaba en las páginas que reciben el 98 % del tráfico.** Entraban,
  obtenían su respuesta y no se les ofrecía nada.
- Y **12 nodos `Event` de JSON-LD** que se caían en días de cambio de hora.

Tres correcciones que hicieron los agentes a instrucciones mías equivocadas, y que
conviene conocer: el cron horario `0 * * * *` **habría hecho fallar el despliegue**
(Hobby solo admite crons diarios); subir `DOY_REFERENCE_YEAR` a 2027 en agosto **habría
roto los hubs hoy**, porque el guard es simétrico y el bump va en diciembre; y el bug de
DST ya estaba medio arreglado en master, con un alcance real de 36 páginas y no 378.

## 6. Lo que no se sabe, y qué cuesta averiguarlo

**En una hora, con la extensión de Chrome conectada:**

- Qué pasó el 14 de agosto. Comparar ventanas en Search Console y mirar Páginas e
  Indexación.
- Una lectura de SERP con el esquema v2 sobre el conjunto fijo, con viewport móvil y
  captura por consulta.

**En días:**

- El embudo real: de quien aterriza en una página de amanecer, qué fracción toca algo de
  vitamina D. `@vercel/analytics` está instalado y nunca se ha consultado. Una estimación
  previa lo situaba en el 1,3 %, sin verificar.

**No se sabe y no se puede saber sin lanzar:** si existe demanda para el producto. Todo
lo medido describe SEO incidental de algo que no se ha anunciado.

## 7. La pregunta que queda

No es «¿hay demanda?» ni «¿seguir o parar?». Con el lanzamiento en pie, es:

**¿Qué tiene que ser cierto el día que publiques, y cómo lo mides después?**

Y por debajo, una decisión de producto que ningún análisis puede tomar: el registro
tiene fricción y hay que decidir si se toca —dando algo que compense la cuenta— o se
mide de otra forma sin pedirla. Hoy hay 7 perfiles y 1 suscripción push. Después de
lanzar, esa proporción es el dato que dice si la cuenta merece la pena.
