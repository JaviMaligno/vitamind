# Posts para Comunidades Específicas

---

## 1. NacionNK (Netkaizen — mejora continua integral)

La comunidad NK valora la optimización personal, el biohacking, la salud extrema. El lenguaje es directo, orientado a resultados, y la gente entiende el concepto de trackear y optimizar métricas.

### Post

¿Estáis trackeando vuestra vitamina D? Si no, deberíais.

La deficiencia de vitamina D afecta al 40% de la población europea. Afecta a testosterona, inmunidad, estado de ánimo, sueño y rendimiento cognitivo. Y la mayoría ni lo sabe.

El problema: no basta con "tomar el sol". La síntesis de vitamina D depende del ángulo solar (que cambia con tu latitud y la época del año), tu tipo de piel, tu edad y las nubes reales de ese día. En España, en invierno, hay meses en los que es literalmente imposible sintetizar vitamina D por el sol.

He construido una herramienta que optimiza esto: getvitamind.app

Te dice:
- Si hoy puedes sintetizar vitamina D en tu ciudad y a qué hora exacta
- Cuántos minutos necesitas según tu tipo de piel (Fitzpatrick I-VI)
- Previsión a 5 días para que planifiques tu exposición
- Cuándo toca suplementar (con guía de D3 + K2 + magnesio)

Basada en modelos científicos publicados (Holick/Dowdy 2010) y datos UV reales. No es una app genérica de "toma el sol 15 minutos" — calcula tu caso concreto.

Gratuita, sin registro. Es una PWA que puedes instalar en el móvil desde el navegador.

Si lleváis al día vuestro kaizen de salud, esto os da un dato más que trackear. Y si no estáis suplementando en los meses que no hay ventana solar, probablemente tenéis los niveles por los suelos.

---

## 2. Grupos de Dieta Carnívora

En carnívora la gente ya entiende bien la importancia de vitamina D, colesterol (precursor de D3), exposición solar y suplementación inteligente. Son audience informada.

### Post

Para los que trackeáis vuestra exposición solar y vitamina D — he hecho una herramienta que os va a gustar.

Los que seguimos carnívora sabemos que la vitamina D es clave: el colesterol de la dieta es el precursor de la D3 que sintetiza tu piel, y estar en déficit afecta a todo (testosterona, inmunidad, inflamación, sueño).

El problema es saber cuándo de verdad puedes sintetizar y cuándo no. "Sal al sol" no es suficiente — depende del ángulo solar, la latitud, la época del año y tu tipo de piel. En buena parte de Europa hay 3-6 meses al año donde la síntesis es imposible por mucho sol que haga.

He creado getvitamind.app — te calcula:
- Si hoy hay ventana de síntesis en tu ciudad
- A qué hora y cuántos minutos necesitas
- Ajustado a tu tipo de piel y edad
- Cuándo te toca suplementar sí o sí

Usa datos UV reales y modelos científicos (Holick/Dowdy 2010). Gratuita, sin registro.

Para los que suplementáis D3 + K2 + magnesio en invierno: la app os dice exactamente el día que podéis dejar de suplementar y el día que tenéis que volver a empezar. No más adivinanzas.

---

## 3. Grupos de WhatsApp de Senderismo

Tono casual, práctico. La gente va al monte y está al sol — el ángulo es "ya que estás ahí fuera, aprovéchalo bien".

### Post

Para los que nos pasamos horas al sol en la montaña — ¿sabíais que no siempre estáis sintetizando vitamina D?

Depende de la hora, la época del año y vuestra latitud. Por debajo de cierto ángulo solar, los rayos UVB no llegan con suficiente intensidad. En invierno en España, incluso con sol a las 12h, hay meses donde es imposible.

He hecho una app gratuita que te dice si hoy puedes sintetizar vitamina D en tu zona y a qué hora es la ventana óptima: getvitamind.app

Así podéis planificar la ruta sabiendo cuándo toca exponerse al sol y cuándo no merece la pena. También tiene previsión a 5 días.

Se instala en el móvil desde el navegador, sin descargar nada de ninguna store.

---

## 4. Grupos de IA / Tecnología

Aquí el ángulo es el side project, el stack técnico, y cómo se creó. Les interesa el proceso.

### Post

He convertido un artefacto de Claude en una PWA de salud desplegada en producción — y creo que es un buen ejemplo de lo que se puede hacer hoy con IA como copiloto de desarrollo.

La app: getvitamind.app — calculadora solar de vitamina D. Te dice cuándo y cuánto tiempo necesitas exponerte al sol para sintetizar vitamina D, basado en tu ubicación, tipo de piel y datos UV reales.

Cómo empezó: le pregunté a Claude si podía sintetizar vitamina D en Londres. Me generó un artefacto interactivo con geometría solar. Vi que era útil de verdad y lo convertí en producto.

Stack:
- Next.js 16 + App Router + React 19
- Supabase (auth + Postgres + push subscriptions)
- D3.js para visualizaciones (heatmap latitud×año, curva diaria)
- Tailwind CSS v4
- Web Push API para notificaciones diarias
- Open-Meteo API para datos UV y meteo en tiempo real
- Vercel (deploy + cron jobs)
- PWA con service worker y soporte offline
- i18n con next-intl (6 idiomas: ES, EN, FR, DE, RU, LT)

El modelo científico es Holick/Dowdy (2010) — calcula producción de vitamina D ajustando por tipo de piel (Fitzpatrick), edad, área corporal expuesta y fotodegradación.

Todo desarrollado con Claude como copiloto. Si alguien tiene preguntas sobre el proceso o el stack, preguntad.

---

## 5. Grupos de Amigos (WhatsApp/Telegram)

Tono informal, directo, sin rollo. El típico "mira lo que he hecho" pero que aporte valor.

### Post

Ey, os comparto una app que he hecho: getvitamind.app

Os dice si hoy podéis sintetizar vitamina D con el sol en vuestra ciudad, a qué hora y cuántos minutos. Ajustado a vuestro tipo de piel.

En invierno en media España es imposible sintetizar vitamina D aunque haga sol — la app os dice cuándo toca suplementar.

Es gratis, sin registro, se instala desde el navegador. Probadla y me decís qué os parece, que me viene bien el feedback.

---

## Timing recomendado

| Comunidad | Mejor momento para publicar |
|-----------|---------------------------|
| NacionNK | Lunes-miércoles (la gente planifica su semana de mejora) |
| Carnívora | Cualquier día, mejor por la mañana |
| Senderismo | Jueves-viernes (planifican ruta del finde) |
| IA/Tech | Martes-jueves |
| Amigos | Cuando haga sol y la app muestre ventana activa — "mirad, hoy hay ventana de síntesis en Madrid" + screenshot |
