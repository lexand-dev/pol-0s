# Notas (el blog)

**Estado:** Verificada
**Requisitos que cierra:** S-01
**Fecha de acuerdo:** 2026-10-10

## Qué se construye

La carpeta **Notas** deja de ser un estado vacío. Se abre como una carpeta de macOS con un icono por nota,
ordenadas de la más reciente a la más antigua, con su título y su fecha. Un doble clic (o un toque en móvil)
abre la nota en su ventana: **título**, **subtítulo**, fecha, **etiquetas** y el texto, que puede llevar
encabezados, listas, citas, enlaces, bloques de código, imágenes y GIF. Al final de cada nota, una invitación a
suscribirse a **Con Criterio**.

Cada nota tiene además **su propia página pública** (`/notas/<nombre>`) que se lee **sin JavaScript**, con su
título y su descripción para Google y para compartir, y un enlace *"Abrir en Pol OS"* que entra al escritorio con
esa nota ya abierta. Las notas entran en el `sitemap.xml`. Una dirección que no existe muestra una **página 404**
con el estilo de Pol OS.

Para el lanzamiento entran las **nueve notas del borrador aprobado** por Pol: "De Frankenstein a sistema",
"Spec-driven development, explicado por alguien que no estudió informática", "De la idea a producción en 48
horas", "No soy emprendedor, soy constructor", "Afloat: cuando la IA clásica es suficiente", "Por qué hice Local
Whisper", "Planito: 5 × 14 metros…" y "Por qué mi portfolio es un
sistema operativo". Se borran las tres notas de ejemplo que sobran. Las nueve llevan la fecha del lanzamiento (2026-10-10) y un número de orden.

## Decisiones tomadas

- **Una nota es un archivo Markdown** en `src/content/notes/`, con `title`, `description` (el subtítulo, que es
  también la descripción para Google, de 160 caracteres como mucho), `date`, `order` (desempata las de una misma
  fecha) y `tags`. Se compila a HTML al
  construir el sitio: es contenido del repositorio.
- **El subtítulo es la descripción.** Pol pidió título y subtítulo; el subtítulo hace las dos cosas.
- **Etiquetas sí, categorías no** (todavía no hay tantos temas). Las etiquetas se ven en la nota; filtrar por
  etiqueta queda para después.
- **Las páginas públicas son estáticas**, generadas al compilar, sin la isla del escritorio: ligeras y legibles
  por cualquier buscador. Comparten los estilos de la nota de la ventana.
- **El texto de la ventana se pide al abrirla** a `/notas/<nombre>.json` (también estático), y las apps de Notas se
  cargan bajo demanda: la home solo lleva los metadatos y no crece.
- **El enlace "Abrir en Pol OS"** lleva a `/?nota=<nombre>`: tras la pantalla de acceso, el escritorio abre esa
  nota. Un nombre que no existe se ignora.
- **La invitación a Con Criterio** es la misma en todas y la pone la plantilla, no cada nota.
- **Imágenes y GIF** en `public/notas/<nombre>/`, con texto alternativo obligatorio. Sin vídeo de momento.
- **Código sin colorear** (el resaltado de Astro mete estilos en línea que la CSP bloquea): bloques monoespaciados
  con el estilo del sistema.
- **404:** una página `404.astro` con el estilo de Pol OS y un enlace al escritorio y a las notas. Cloudflare la
  sirve en cualquier dirección inexistente.
- **Terminal:** `notes` lista las notas y `open <nota>` abre una. Es el `cat` que se dejó pendiente para cuando
  existieran las notas.

## Cobertura

| Requisito | Se implementa en | Se valida con |
|-----------|------------------|---------------|
| S-01 | `src/content/notes/*.md`, `src/content.config.ts`, `src/os/apps/notes/NotesFolder.svelte`, `src/os/apps/notes/Note.svelte`, `src/pages/notas/[slug].astro`, `src/pages/404.astro`, `src/lib/seo.ts`, `src/pages/sitemap.xml.ts`, `src/os/OS.svelte`, `src/os/terminal/commands.ts` | `tests/e2e/s-01-notas.spec.ts`, `tests/csp/s-01-notas-publicas.spec.ts`, `src/lib/notes.test.ts`, `src/os/terminal/commands.test.ts`, `tests/csp/m-11-csp.spec.ts` |

Qué comprueba cada test, según el criterio del PRD:

- **e2e (escritorio y móvil):** la carpeta Notas enseña una nota por archivo, de la más reciente a la más antigua;
  abrir una muestra título, subtítulo, fecha, etiquetas, el texto y la invitación a Con Criterio (con su enlace en
  pestaña nueva); `/?nota=<nombre>` abre esa nota tras entrar. Sin errores de accesibilidad.
- **Páginas públicas (contra la versión compilada, `pnpm test:csp`):** cada `/notas/<nombre>` responde 200 con su
  título y su descripción, el texto completo está en el HTML **con JavaScript desactivado**, lleva sus etiquetas
  para compartir y su dirección canónica, y está en el `sitemap.xml`; no hay violaciones de la CSP.
  - *Negativo:* una dirección de nota que no existe devuelve **404** con la página propia de Pol OS.
- **Unitarios (`notes.test.ts`, `seo.test.ts`, `commands.test.ts`):** el orden por fecha, el nombre de cada nota y que
  ninguna descripción pase de 160 caracteres, que ninguna nota lleve un correo ni el nombre de un tercero; el enlace
  directo (un nombre raro se ignora); los datos estructurados; los comandos `notes` y `open <nota>` de la Terminal.
  - *Negativo:* si el texto de una nota no se puede cargar, la ventana avisa en vez de quedarse vacía.

## Hallazgos al construir

- **La home pasó de 11 a 16 peticiones** (tope: 12). Los módulos que comparte con las apps cargadas bajo demanda se
  partían en un archivo por módulo; se agrupan en uno con `manualChunks` en `astro.config.mjs`. Ahora son 9.
- **Contraste en la carpeta:** la fecha de la nota seleccionada no llegaba al contraste mínimo en oscuro; pasa a `--fg`.
  Se ajustó el test de la Terminal y se probó el caso ambiguo.
- **La 404 propia responde con estado 404** en la vista previa local, con las cabeceras de seguridad.

**Lo que no se comprueba aquí:** cómo queda cada nota en Google (la indexación real tarda días). Se revisa con
Search Console tras publicar, si Pol lo da de alta. Tampoco que la producción real de Cloudflare sirva la 404 propia
(solo se ha probado en la vista previa local): se mira tras el primer despliegue.

## Fuera de esta feature

- Filtrar por etiqueta y una página por etiqueta.
- Comentarios, contador de visitas o "me gusta".
- Vídeo dentro de las notas.
- Las notas que quedaron como ideas para más adelante.
- Una versión en inglés.
