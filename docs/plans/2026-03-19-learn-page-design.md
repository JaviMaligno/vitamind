# Learn Page — Diseño

## Objetivo

Página `/learn` con contenido educativo sobre vitamina D y el sol. Acceso contextual desde la app, no en el nav principal. Multilingüe (6 idiomas).

---

## Navegación / Acceso

**Desde dónde se llega a `/learn`:**

1. **Perfil** — enlace general al fondo de la página (`ℹ️ Más sobre vitamina D y el sol →`)
2. **Dashboard** — card contextual cuando no hay síntesis posible hoy ("¿Sin ventana UV? → Cómo suplementar bien")
3. **Inline links** — los textos de suplementación existentes (`hero.adviceText`, `estimate.supplementAdvice`, `dashboard.supplementHint`) se convierten en links con ancla directa al bloque 3: `/learn#supplement`

El nav principal (Mi día / Explorar / Perfil) no cambia — 3 pestañas.

---

## Estructura de la página

**Formato:** 4 bloques temáticos. Cada bloque tiene título + subtítulo + acordeón de preguntas. El primer bloque abierto por defecto, el resto colapsados.

---

## Bloques y preguntas

### Bloque 1 — ☀️ El sol y la vitamina D

1. ¿Por qué solo el UVB produce vitamina D y no el UVA?
2. ¿Por qué importa el ángulo solar? ¿Qué pasa en invierno?
3. ¿Por qué no funciona a través del cristal?
4. ¿Qué significa el índice UV y por qué la app usa 3 como mínimo?
5. ¿Las nubes anulan el UVB?

### Bloque 2 — 💊 Sol vs suplemento

1. ¿Cuánta vitamina D puedo producir al sol frente a una pastilla?
2. ¿Puedo intoxicarme con el sol? (fotodegradación como mecanismo de seguridad)
3. ¿El sol es mejor que suplementar?
4. ¿D3 o D2 en los suplementos?
5. ¿Con qué niveles en sangre (25-OH-D) estoy bien?

### Bloque 3 — 🧪 Suplementar bien  `#supplement`

1. ¿D3 o D2? ¿Cuánto tomar?
2. ¿Por qué se recomienda tomar K2 con la D3?
3. ¿Qué papel tiene el magnesio?
4. ¿Por qué hay que tomarla con grasa?
5. ¿Qué alimentos contienen vitamina D de forma natural?
6. ¿Cuándo es el mejor momento del día para tomarla?

### Bloque 4 — 🌅 El sol más allá de la vitamina D

1. ¿Qué es el óxido nítrico y qué tiene que ver con el sol?
2. ¿Cómo afecta la luz solar a los ritmos circadianos?
3. ¿Para qué sirve la luz del amanecer si no produce vitamina D?
4. ¿Sol e inmunidad: hay relación más allá de la vitamina D?
5. ¿La exposición solar afecta al estado de ánimo? (serotonina, melatonina)

---

## Arquitectura técnica

### Ruta

`app/learn/page.tsx` — página estática, sin fetch de datos, sin estado global.

### Internacionalización

Nuevo namespace `"learn"` en cada fichero `messages/*.json` (en, es, de, fr, lt, ru).
Estructura de claves:
```
learn.pageTitle
learn.block1.title
learn.block1.subtitle
learn.block1.q1.q
learn.block1.q1.a
learn.block1.q2.q
learn.block1.q2.a
... etc.
```

Los ficheros de mensajes son grandes pero manejables — next-intl los carga por locale de todas formas. No se necesita configuración adicional.

### Componente acordeón

Componente local `LearnAccordion` — estado con `useState<number | null>` para la pregunta abierta dentro de cada bloque. Simple, sin librería externa.

### Anclas

El bloque 3 tiene `id="supplement"` para que los links `/learn#supplement` desde HeroZone/VitDEstimate/Dashboard lleven directamente a esa sección.

---

## Archivos a crear/modificar

**Crear:**
- `app/learn/page.tsx`
- `components/LearnAccordion.tsx`

**Modificar:**
- `messages/en.json` — añadir namespace `learn` con todo el contenido en inglés
- `messages/es.json` — ídem en español
- `messages/de.json` — ídem en alemán
- `messages/fr.json` — ídem en francés
- `messages/lt.json` — ídem en lituano
- `messages/ru.json` — ídem en ruso
- `app/profile/page.tsx` — añadir enlace al fondo
- `app/dashboard/page.tsx` — añadir card contextual en estado "no synthesis"
- `components/HeroZone.tsx` — convertir `adviceText` en link
- `components/VitDEstimate.tsx` — convertir `supplementAdvice` en link

---

## YAGNI

- Sin búsqueda dentro de la página
- Sin CMS ni contenido dinámico
- Sin imágenes/ilustraciones en v1
- Sin tracking de lectura ni progreso
