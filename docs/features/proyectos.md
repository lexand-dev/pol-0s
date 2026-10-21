# Proyectos: vista general y detalle

**Estado:** Verificada
**Requisitos que cierra:** S-08, M-04
**Fecha de acuerdo:** 2026-10-10

## Qué se construye

Una app nueva, **Proyectos**, para enseñar cada proyecto con calma, sin depender de cargar su web en una ventana.

**Vista general.** Una cuadrícula con todos los proyectos: icono grande, nombre y una frase. Un clic abre el
detalle.

**Detalle de un proyecto**, con un botón "‹ Proyectos" para volver:
- Cabecera con su icono, nombre y dirección, y los botones: **Abrir en el Navegador** (si el sitio se deja
  incrustar) o **Visitar sitio ↗** en una pestaña nueva (si no, como Yoleo o GitHub), y **Ver repositorio ↗**
  cuando el repositorio es público.
- **Qué es:** unos párrafos escritos para el proyecto.
- **Hecho con:** las tecnologías. Si hay repositorio público, también sus lenguajes (con su porcentaje) y sus
  etiquetas, y la licencia.
- **Capturas de pantalla:** una galería; pulsar una la amplía dentro de la ventana.

En escritorio es una ventana más (con mosaico, minimizar, etc.); en móvil, una pantalla completa con su botón de volver.

**Dónde se llega:** un icono **Proyectos** en el escritorio (con la carpeta de los iconos de los proyectos
dentro, como ya se ve en móvil), la entrada "Proyectos" del menú Archivo y el comando `open proyectos` de la
Terminal. El Navegador sigue con sus Favoritos de icono y nombre para quien quiera ver las webs en vivo.

## Decisiones tomadas

- **Nuevo requisito S-08, y M-04 cambia.** Hoy un doble clic en el icono de un proyecto del escritorio abre el
  Navegador. Se propone que abra **su detalle en Proyectos**, que es donde se cuenta qué es, y que desde ahí el
  botón "Abrir en el Navegador" lo cargue. M-04 se reescribe en el PRD en este mismo trabajo. *(Es el cambio más
  grande del acuerdo: si prefieres que el doble clic siga abriendo el Navegador, se deja M-04 como está.)*
- **El contenido vive en el JSON de cada proyecto**, con campos nuevos y opcionales, validados al compilar:
  `summary` (una frase), `details` (lista de párrafos), `screenshots` (imagen y texto alternativo, este último
  obligatorio) y `repo` (`usuario/nombre`, de donde sale el botón del repositorio). Los lenguajes, las etiquetas
  y la licencia se guardan también en el JSON, como una **copia de lo que dice GitHub**.
- **Sin llamadas a GitHub desde el navegador del visitante ni al compilar.** Un script
  (`scripts/actualizar-proyectos.mjs`) lee la API pública de GitHub (sin claves) y actualiza esos campos en los
  JSON de los proyectos con `repo`; se lanza a mano y el resultado se commitea. Así el sitio no depende de GitHub
  ni de sus límites, y se ve igual aunque GitHub caiga. No se guardan estrellas ni fechas de actividad: caducan.
- **Las capturas son archivos locales** en `public/projects/<id>/`: imágenes WebP de 1280 px de ancho como máximo
  (de 15 a 90 KB) y **GIF animados cuando el proyecto los tiene** (Pol lo decidió al construir: los cuatro de
  project-template, de 115 a 250 KB). Cada GIF lleva además una imagen fija (`still`): quien tiene activado el
  movimiento reducido ve la fija, que se elige con `<picture>` y sin JavaScript. Las de Planito, Afloat y
  project-template salen de sus repositorios; las de Local Whisper y Yoleo, de sus webs en vivo
  (capturadas con permiso de Pol, a 1280 × 800).
- **Solo los repositorios públicos llevan botón y lenguajes.** Públicos: Planito, Afloat, project-template y la app
  de Local Whisper (`localwhisper-app`). **Privados** (Yoleo, Pol OS y la web de Local Whisper): no se enlazan
  ni se publican sus lenguajes; su tecnología se escribe a mano en `stack`, con lo que cuentan sus README.
- **Todo es texto, nunca HTML.** Los párrafos se pintan como texto; los enlaces los construye el código con las
  direcciones validadas (`https://` y `https://github.com/<repo>`). La CSP no cambia: las imágenes son de `'self'`.
- **Lógica pura donde la hay:** el reparto de lenguajes en porcentajes y la elección del botón principal
  (Navegador o pestaña nueva) se calculan en funciones aparte, que se prueban sin navegador.
- **Accesibilidad:** el detalle es una región con su título; las capturas llevan texto alternativo; la barra de
  lenguajes tiene su lista en texto (los colores no son lo único que informa); la galería y la ampliación se
  manejan con teclado y se cierran con Escape (que cierra la ampliación y no la ventana, como en el mosaico).
  Respeta `prefers-reduced-motion`.
- **El texto de cada proyecto (`summary` y `details`) lo redacto yo a partir de su README y su web**, y se marca
  como pendiente de tu revisión hasta que lo apruebes: no afirmo nada que no esté en esas fuentes.

## Cobertura

| Requisito | Se implementa en | Se valida con |
|-----------|------------------|---------------|
| S-08 | `src/os/apps/projects/Projects.svelte`, `src/os/apps/projects/ProjectDetail.svelte`, `src/os/apps/projects/projects-view.ts`, `src/content.config.ts`, `src/content/projects/*.json`, `public/projects/`, `src/os/apps/registry.ts`, `src/os/apps/AppView.svelte`, `src/os/items.ts`, `src/os/menus.ts`, `src/os/terminal/commands.ts`, `scripts/actualizar-proyectos.mjs` | `tests/e2e/s-08-proyectos.spec.ts`, `src/os/apps/projects/projects-view.test.ts`, `src/lib/projects-content.test.ts`, `src/lib/github-info.test.ts`, `src/os/menus.test.ts`, `src/os/terminal/commands.test.ts`, `tests/csp/m-11-csp.spec.ts` |
| M-04 | `src/os/items.ts`, `src/os/OS.svelte` | `tests/e2e/m-04-proyectos.spec.ts` |

M-04 no se cierra de cero: su criterio se **reescribe** (el doble clic abre el detalle) y su test se actualiza.

Qué comprueba cada test, según el criterio del PRD:

- **e2e (escritorio y móvil):**
  - Proyectos abre una cuadrícula con un elemento por cada proyecto de la colección, con su icono, nombre y frase.
  - Pulsar un proyecto muestra su detalle (nombre, qué es, hecho con) y "‹ Proyectos" vuelve a la cuadrícula.
  - Un proyecto con repositorio público muestra sus lenguajes y etiquetas y el botón "Ver repositorio"; uno que se deja
    incrustar tiene "Abrir en el Navegador", y ese botón carga el proyecto en la ventana del Navegador.
  - Las capturas se muestran con su texto alternativo, cargan de verdad, y pulsar una la amplía; Escape la cierra sin
    cerrar la ventana. Un GIF se anima y, con movimiento reducido, se ve su imagen fija.
  - El doble clic en el icono de un proyecto del escritorio abre su detalle; el icono Proyectos del escritorio, la
    entrada del menú Archivo y `open proyectos` en la Terminal abren la app.
  - *Negativos:* un proyecto sin capturas o sin repositorio no enseña esos apartados ni botones; uno no incrustable
    (Yoleo, GitHub) tiene "Visitar sitio ↗" con `target="_blank"` y no "Abrir en el Navegador". Sin errores de
    accesibilidad con el detalle abierto, en claro y en oscuro.
- **Unitarios:** el reparto de lenguajes (suma 100, agrupa los pequeños en "Otros", ordena); el botón principal según
  `embeddable`; y la guarda del contenido (cada captura existe en `public/` y tiene texto alternativo, cada GIF tiene su imagen fija, `repo` bien
  formado, ningún `summary` vacío).
- **CSP (`pnpm test:csp`):** el recorrido abre Proyectos, entra en un detalle y amplía una captura sin ninguna violación.
- **Script de actualización:** `no verificable por interfaz: lee la API pública de GitHub y escribe archivos; los
  tests no salen a internet.` Se comprobó lanzándolo a mano (salida en el PR) y su lógica de transformación
  (respuesta de GitHub → campos del JSON) se prueba en `src/lib/github-info.test.ts`.

**Lo que no se comprueba aquí:** que las capturas reflejen la versión actual de cada proyecto, y los lenguajes y
etiquetas de GitHub en vivo (el script los copia a mano cuando se quiere refrescar).

## Fuera de esta feature

- Una URL pública por proyecto (`/proyectos/planito`) con su propio título y descripción para buscadores, como
  tendrán las notas (S-01). Es una buena mejora y encaja después; se anota en `mejoras/` si se quiere.
- Vídeo (por ejemplo, el de una partida de Afloat que hay en su repositorio) y demos interactivas: la galería
  admite imágenes y GIF.
- Estrellas, fechas de actividad, número de commits o cualquier dato que caduque.
- Datos de proyectos sin repositorio público más allá de lo que se escriba a mano (Local Whisper, Yoleo).
- Comentarios, valoraciones o formularios por proyecto.
- Abrir los repositorios de GitHub como proyectos automáticamente (C-01): el script solo refresca los que ya están.

## Hallazgos al construir

- **La ampliación de una captura tapaba su pie de foto y los controles:** `max-height` en porcentaje no se resuelve
  dentro de una caja de alto automático. La imagen rellena ahora su caja y se ajusta con `object-fit`. Lo cazó
  la revisión a ojo, no un test.
- **En la Terminal, `projects` pegaba los ids largos a su nombre** (`project-templateproject-template`): la columna
  tenía un ancho fijo de 12. Ahora sigue al id más largo, usa la frase corta y hay un test.
- **Un negativo no se podía probar de punta a punta:** "un proyecto sin capturas no enseña ese apartado" se salta en
  e2e porque ahora todos tienen capturas. La decisión de qué apartados se enseñan se extrajo a `detailSections`, que
  se prueba con datos vacíos; el e2e se ejecutará solo si algún día hay un proyecto sin capturas.
- **Decisiones cambiadas durante la construcción:** los GIF de project-template se usan animados (Pol, al construir),
  con imagen fija para el movimiento reducido; y el doble clic en un proyecto abre su detalle (M-04 reescrito).
- **GitHub dice que project-template es Python y JavaScript** (son sus scripts), lo que sorprende en una plantilla de
  documentación; se enseña tal cual lo cuenta GitHub.

