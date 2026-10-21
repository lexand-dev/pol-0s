# Sobre mí (el documento) y la línea de presentación

**Estado:** Verificada
**Requisitos que cierra:** M-06
**Fecha de acuerdo:** 2026-10-10

## Qué se construye

El icono **Sobre mí.pdf** del escritorio deja de abrir un estado vacío y abre un **documento**: una hoja
blanca sobre fondo gris, como una vista previa de macOS, con la foto de Pol, su nombre, su línea de
presentación (*"Convierto ideas en productos que funcionan, rápido y con método."*), el gancho (*"Construir
con IA es fácil. Construir productos que no se rompan ya es otra historia."*) y las secciones del borrador
aprobado: **De dónde vengo**, **Cuando llegó la IA**, **Cómo trabajo**, **Ahora mismo**, **Proyectos de los
que estoy orgulloso** (que lleva a la app Proyectos), **Qué busco** y **Datos**.

En la barra de la ventana, un botón **Descargar PDF** baja una versión del mismo texto pensada para
imprimir. En móvil se ve a pantalla completa, con el mismo botón.

La línea de presentación pasa también a la **descripción del sitio**: el título para Google será *"Pol Marzà ·
Convierto ideas en productos que funcionan"* (54 caracteres) y la descripción, *"Mi portfolio en forma de
sistema operativo, dentro del navegador. Abre mis proyectos, lee mis notas y escríbeme desde su correo."* La
imagen para compartir el enlace añade la línea bajo el nombre.

## Decisiones tomadas

- **Un solo texto, en Markdown, en el repositorio** (`src/content/sobre-mi.md`). De él salen el documento de la
  ventana y el PDF. Se compila a HTML al construir el sitio y la ventana lo pinta tal cual: es contenido del
  propio repositorio, nunca algo que escriba un visitante.
- **El PDF se genera, no se escribe a mano.** Un script (`scripts/generar-cv.mjs`) lo crea con Chrome a partir
  del mismo texto, como ya se hace con la imagen para compartir, y se commitea en `public/`. Workers Builds no
  tiene Chrome, así que no se genera al desplegar.
- **Para que el PDF nunca se quede atrás:** el script guarda una huella del texto con el que se generó, y un
  test falla si `sobre-mi.md` cambia sin volver a generar el PDF.
- **Sin PDF, sin botón** (el negativo de M-06): si el archivo no está al compilar, el documento se ve igual y el
  botón no aparece.
- **Lo que no se publica**, según lo acordado: nombres de terceros (salen como "mi jefe", "un amigo
  desarrollador"…) y los datos personales que Pol decidió dejar fuera del CV.
- **Contacto:** solo la app Correo, sin dirección visible. Para un currículum estándar, el enlace a LinkedIn.
- **Diseño:** el `PaperDoc` del sistema de diseño (hoja blanca en ambos temas, como un documento real),
  tipografía del sistema, y el título del documento a 26 px.

## Cobertura

| Requisito | Se implementa en | Se valida con |
|-----------|------------------|---------------|
| M-06 | `src/content/sobre-mi.md`, `src/os/apps/about/About.svelte`, `src/os/apps/AppView.svelte`, `src/pages/index.astro`, `astro.config.mjs`, `src/lib/cv.ts`, `src/lib/cv-hash.ts`, `scripts/generar-cv.mjs`, `public/cv.pdf`, `scripts/plantillas/og.html` | `tests/e2e/m-06-sobre-mi.spec.ts`, `src/lib/cv.test.ts`, `src/lib/browser-safe.test.ts`, `tests/csp/s-06-seo.spec.ts`, `tests/csp/m-11-csp.spec.ts` |

Qué comprueba cada test, según el criterio del PRD:

- **e2e (escritorio y móvil):** doble clic (o toque) en Sobre mí abre el documento con la foto cargada, el nombre,
  la línea de presentación y todas las secciones; el botón **Descargar PDF** apunta al PDF, que se sirve como
  `application/pdf`; el enlace a Proyectos abre la app Proyectos y el de LinkedIn abre una pestaña nueva. Sin
  errores de accesibilidad en claro y en oscuro.
  - *Negativo:* el documento no contiene ninguna dirección de correo ni los datos excluidos.
- **Unitarios (`cv.test.ts`):** la huella del texto coincide con la del PDF publicado; sin PDF, la función que
  decide el botón devuelve "sin botón".
- **SEO y CSP:** el título y la descripción nuevos están en la página y en las etiquetas para compartir; el
  documento no provoca violaciones de la política.

**Lo que no se comprueba aquí:** cómo queda el PDF impreso en papel. Se revisa a ojo una vez y se enseña en el PR.

## Fuera de esta feature

- Personalizar el PDF con los colores de cada empresa (idea descartada por Pol).
- Una trayectoria clásica con empresas y fechas, y la formación: Pol prefirió solo la presentación.
- Versión en inglés.

## Hallazgos al construir

- **Un `import` de `node:crypto` rompía toda la web.** La huella del PDF estaba en el mismo archivo que la lógica que usa la
  ventana; en el navegador `node:crypto` no existe y la hidratación de **todo** el escritorio fallaba. Lo cazaron los e2e, no
  los unitarios. Se separó la huella en `cv-hash.ts` y una guarda (`browser-safe.test.ts`) impide que vuelva a pasar.
- **El botón de descargar no salía.** La página se ejecuta dentro del emulador de Cloudflare, donde `existsSync` no ve el
  disco. La existencia del PDF se decide ahora en `astro.config.mjs`.
- **El PDF pesaba 1,5 MB** por la foto original; el script la reduce a 320 px y pesa 213 KB.
- **Astro 7 ya no usa `@astrojs/markdown-remark`:** su procesador es `@astrojs/markdown-satteri`.
- El título y la descripción para Google salen del texto aprobado; el test de SEO ya comprobaba los límites (título ≤ 60,
  descripción 70–160) y no hizo falta cambiarlo.

