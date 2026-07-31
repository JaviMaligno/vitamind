# Diseñar un widget MCP

Escrito tras el [#29](https://github.com/JaviMaligno/vitamind/issues/29), donde
los cinco primeros widgets funcionaban y uno de ellos no servía. Esto es lo que
hay que preguntarse **antes** de escribir un widget, no después de desplegarlo.

---

## El listón

> **¿Lo entiende alguien que no conoce la app, en tres segundos, sin leyenda?**

Si la respuesta es no, el widget no sale — por bonito que sea y por bien que
funcione.

Este listón sustituye al que usó la primera auditoría («¿es el texto peor que una
imagen?»), que aprobó una curva de elevación solar. Era cierto que la imagen era
más rica que la frase; era falso que alguien pudiera leerla.

### Por qué el listón es más alto aquí que en la app

En la app el lector ha navegado, ha visto una leyenda, quizá ha pasado por
`/learn`. En un chat el widget aparece **una vez, a mitad de conversación, sin
contexto y sin segunda oportunidad**. Un gráfico que en la app se aprende en dos
visitas, en el chat no se aprende nunca.

---

## Las cuatro preguntas

**1 · ¿Qué preguntó la persona, con sus palabras?**

El widget contesta esa pregunta, no una parecida. «¿Me da el sol ahora?» se
contesta con un sí o un no y unos minutos. La forma de la curva del día es otra
pregunta, y la hace otra persona en otro momento.

**2 · ¿Qué enseña la app para esa misma pregunta?**

Casi siempre está resuelto. `DayHeroBold` decidió que «ahora mismo» se contesta
con veredicto y cuatro cifras, y dejó la curva en `explore`, que es otra
pantalla para otra intención. Portar la pieza equivocada fue el fallo del #29.

Si la app enseña algo distinto de lo que ibas a poner, la carga de la prueba es
tuya.

**3 · ¿El dibujo responde más rápido que la frase, o solo más bonito?**

Hay tres casos donde el dibujo gana de verdad, y conviene reconocerlos:

- **Comparar formas** — tres años de sol apilados sobre un eje común. Un párrafo
  con tres pares de fechas es peor.
- **Ubicar en el tiempo** — un calendario con los días marcados.
- **Manipular** — un formulario, un control que se toca.

Fuera de eso, sospecha. Los dos widgets que mejor funcionan de los cinco
primeros son el formulario y el calendario: **UI convencional, no visualización
de datos**.

**4 · ¿Lo primero que se lee es la respuesta?**

Aunque el gráfico esté justificado, va **debajo** de una frase que ya contesta.
La tira del año es buena y se quedó — lo que le faltaba era el titular encima.

---

## Reglas de construcción

**El copy sale de la app, no del widget.** Son frases que la misma persona lee en
los dos sitios; si divergen, estamos describiendo el mismo instante con dos
voces. `scripts/build-widgets.mjs` extrae las claves necesarias de
`messages/*.json` en los seis idiomas y las mete en el bundle, y **falla el build**
si falta una. No copiar cadenas a mano.

**Los estados los define la app.** Si la app distingue cinco casos, el widget
distingue cinco. El primer widget de «ahora mismo» colapsó `optimal` y `moderate`
en uno, y con ello perdió la diferencia entre «esto es lo mejor que va a estar» y
«sirve, pero no es ideal» — sobre las que uno actúa distinto.

Cuando la clasificación existe en los dos sitios, **hay que atarla con un test**
que compare contra la función de la app (`getStatusKey`, los formateadores de
duración), no fiarse de que coincidan.

**El idioma y el tema los manda el host.** `ctx.locale`, `ctx.theme`,
`ctx.styles`, fusionados al cambiar y nunca reemplazados: el host envía solo el
campo que cambió, y un reemplazo ingenuo borra el idioma al cambiar de tema.

**El widget no pide nada a la red.** Bundle autocontenido, `csp: {}`, y el dato
llega en el `_meta` del resultado. Nunca en `structuredContent`, que los clientes
sí muestran al modelo.

**El texto para el modelo no cambia.** Un cliente sin soporte de widgets tiene
que recibir exactamente lo que recibía. Hay un test de payload congelado que lo
vigila.

**Tamaño.** Los bundles están entre 9 y 16 KB y viajan enteros en cada
`resources/read`. El techo de 40 KB está puesto en un test. Si algo lo roza, casi
seguro se ha colado una dependencia.

---

## Antes de darlo por bueno

Renderízalo y **míralo**. Las funciones de render son puras y devuelven HTML: se
pintan con datos de ejemplo y se publican como artefacto en un minuto, sin
desplegar y sin abrir un chat de prueba. Hacerlo al final, después de un
despliegue, es trabajo de más para ver algo que ya existía.

Vale la pena mirarlo en los cinco estados, en dos idiomas y en los dos temas.

---

## Los cinco actuales, y por qué

| Widget | Tool | Justificación |
|---|---|---|
| Ahora mismo | `get_current_status` | Veredicto y cifras, como «mi día». Sin gráfico. |
| El año | `get_vitamin_d_year` | La tira muestra los bordes exactos de temporada que los meses redondean. Con titular encima. |
| Comparativa | `compare_vitamin_d_year` | Comparar formas de año es tarea visual. Cada tira rotulada; sin titular, porque uno no habla por cinco. |
| Perfil | `configure_sun_profile` | Manipular. Un formulario no se aprende. |
| Historial | `get_my_history` | Ubicar en el tiempo, y tocar para responder. Un calendario no se aprende. |

Y las siete herramientas **sin** widget lo están por la misma regla: sus
respuestas son dos números o una lista, y una imagen no añadiría nada.
