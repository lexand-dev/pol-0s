# Favoritos (para conocer a Pol)

**Estado:** Verificada
**Requisitos que cierra:** S-03
**Fecha de acuerdo:** 2026-10-12

## Qué se construye

Una carpeta **Favoritos** en el escritorio (y en la pantalla de inicio del móvil), con la misma forma que Proyectos: una vista de **cuatro tarjetas**, y cada una abre su
ventana con el **top 10** de Pol en esa categoría. No hay notas, justificaciones ni líneas de gusto: los propios elementos dicen cómo es Pol.

- **Juegos:** una cuadrícula de portadas; cada portada enlaza con la ficha del juego en **Shelvid** (shelvid.com, el proyecto de un amigo de
  Pol, que se menciona).
- **Películas y series:** una cuadrícula de pósteres con título, año y una sinopsis breve; cada una con su **tráiler** de YouTube, que se abre en el mini reproductor.
- **Libros:** una cuadrícula de portadas y, al final, un enlace al perfil de Pol en **Yoleo**.
- **Música:** una **lista** de canciones con su portada, el título, el artista y un botón de play; al pulsarlo, se abre el **mini reproductor**.

**El mini reproductor** es una ventana pequeña, fija abajo a la derecha del escritorio (y a pie de pantalla en el móvil), que muestra **solo el vídeo** de YouTube de la canción o del
tráiler que se ha pulsado. Se puede pausar, pasar a la canción siguiente de la lista y cerrar. Sigue sonando aunque se cierre la ventana de Favoritos; al cerrarlo, se detiene.

## Decisiones tomadas

- **Sin claves ni APIs de terceros.** Todo el contenido lo aporta Pol (enlaces, portadas) y vive en el repositorio, como el resto de colecciones; así no hay nada que caduque ni que
  dependa de condiciones de uso ajenas. La ficha de TMDB, IGDB y similares se descarta.
- **Una colección de Astro `favorites`**, un archivo por categoría (`games`, `movies`, `books`, `music`), validado al compilar: cada elemento lleva su título, su portada, su enlace y los
  campos propios de su sección. El máximo es 10 elementos por sección.
- **Las portadas son archivos del repositorio**, en `.jpg` (`public/favoritos/<sección>/<nombre>.jpg`, con el nombre del elemento en minúsculas y con guiones; Pol las sube él). Mientras no estén, sale una portada de relleno claramente falsa, no enlaces a otras webs: no hay peticiones a terceros al abrir una sección.
  Son imágenes que aporta Pol; pertenecen a sus editores y aquí solo sirven para identificar la obra y enlazar con ella.
- **Música y tráilers solo con el reproductor oficial de YouTube**, con el vídeo siempre a la vista, por las condiciones de YouTube: no se puede ocultarlo, reproducir en segundo plano, ni
  descargar o guardar copias del contenido. Tampoco se descargan canciones: sería copyright aunque no se vendan.
- **Nada de YouTube se carga hasta pulsar play.** El script del reproductor (`youtube.com/iframe_api`) y el vídeo (`youtube-nocookie.com`) solo se piden cuando el visitante pulsa; la política de
  seguridad se amplía solo con esos dos dominios.
- **Los controles son los de la API oficial de YouTube** (play, pausa, siguiente), accionados desde botones propios; no se oculta ni se tapa el reproductor.
- **El título, el artista y la duración los escribe Pol** (o se dejan sin duración): no se consulta la API de YouTube, que pide clave.
- **Música como lista, no como cuadrícula**, con el aspecto de una biblioteca de música (portada, título, artista, duración y play). La alternativa de insertar una lista de reproducción de
  YouTube con su panel queda descartada de entrada (no se puede personalizar y no permite el estilo de Pol OS), pero se puede añadir luego un enlace a la lista completa de Pol en YouTube.
- **Cuatro ventanas del mismo tipo:** una sola pieza de código muestra las cuadrículas de portadas (juegos, películas y libros); la música usa su propia lista.
- **El mini reproductor es único:** si se pulsa play en otro elemento mientras suena uno, sustituye al anterior.
- **En el escritorio se apila como una ventana más** (decisión de Pol del 2026-10-17): pasa por delante al ponerse algo a sonar o al tocarlo, y una ventana que se toca después (por ejemplo, Favoritos al volver a la carpeta) pasa por delante de él.

## Cobertura

| Requisito | Se implementa en | Se valida con |
|-----------|------------------|---------------|
| S-03 | `src/content/favorites/*.json`, `src/content.config.ts`, `src/lib/favorites.ts`, `src/lib/youtube-player.ts`, `src/os/apps/favorites/`, `src/os/shell/MiniPlayer.svelte`, `src/os/OS.svelte`, `src/os/shell/Desktop.svelte`, `src/os/stores/player.svelte.ts`, `src/os/apps/registry.ts`, `src/os/items.ts`, `src/os/terminal/commands.ts`, `src/lib/csp.ts`, `public/favoritos/` | `src/lib/favorites.test.ts`, `src/lib/youtube-player.test.ts`, `src/lib/csp.test.ts`, `tests/e2e/s-03-favoritos.spec.ts`, `tests/csp/s-03-favoritos.spec.ts`, `tests/csp/m-11-csp.spec.ts` |

Qué comprobará cada test, según el criterio del PRD:

- **Unitarios (`favorites.test.ts`):** cada elemento tiene título, portada que existe en `public/favoritos/`, enlace `https://` y, en la música y los tráilers, un identificador de YouTube válido; no hay
  más de 10 por sección; ningún enlace va a un dominio ajeno a los acordados; el orden de reproducción y el paso a la siguiente canción.
  - *Negativo:* un identificador de YouTube mal formado se rechaza al compilar.
- **e2e (escritorio y móvil, con axe en claro y oscuro):** la carpeta se abre y tiene las cuatro tarjetas; cada sección enseña sus elementos con portada, título y enlace seguro (pestaña nueva); la
  música es una lista con play; pulsar play abre el mini reproductor con el vídeo a la vista (con YouTube simulado); pulsar otra canción lo sustituye; «siguiente» pasa a la canción siguiente; cerrarlo lo
  detiene; el enlace a Yoleo y las menciones a Shelvid están.
  - *Negativo:* **antes de pulsar play no se pide nada a YouTube**; y si el vídeo no se puede cargar, el elemento sigue enlazando a YouTube sin dejar un reproductor roto.
- **Contra la compilación (`pnpm test:csp`):** la política permite exactamente los dos dominios de YouTube (y solo en los destinos que toca), y el recorrido con el reproductor simulado no registra violaciones.

## Hallazgos al construir

- **La región con desplazamiento de las secciones no era accesible con el teclado** (axe: `scrollable-region-focusable`): ahora es una región enfocable, como en el Stack.
- **La home superó su tope de 12 peticiones** (14): la nueva app añadió su CSS (Astro enlaza el de las apps cargadas bajo demanda, MEJORA-08) y dos trozos de código compartidos
  (la tienda del reproductor y las preferencias, además del cliente de Turnstile). Se agruparon en `os-shared` con `manualChunks` y quedó en 12, **justo en el tope**: la
  próxima app cargada bajo demanda ya no cabe sin arreglar MEJORA-08 de verdad.
- Tres pruebas de la política de seguridad se actualizaron porque la nueva política nombra a YouTube: los marcos permitidos de M-11 (ahora incluyen el vídeo sin cookies) y,
  en la nueva, que la home no lleve nada de YouTube *fuera de la propia política* y que Chrome informa de un marco bloqueado como `frame-src` (no `frame-src-elem`).
- Las portadas se nombran con el título sin apóstrofes (`ill-tell-you-someday.jpg`), para que coincidan con los nombres que se le dieron a Pol.
- **No se ha podido ver reproducir un vídeo real:** el navegador de revisión crea el reproductor con el dominio sin cookies pero no llega a YouTube y deja el hueco en negro.

**Lo que no se comprueba aquí:** que YouTube reproduzca de verdad (los tests no salen a internet y lo simulan); se prueba a mano con un vídeo real tras construirlo.

## Qué necesita Pol hacer (y qué queda pendiente)

- **Subir las portadas reales** con el mismo nombre que las de ejemplo, en `.jpg`.
- **La dirección de su perfil de Yoleo** (el enlace final de los libros no sale hasta que esté en `books.json`).
- **Probar a mano** una canción y un tráiler con YouTube de verdad.
- Opcional: la duración de cada canción (`duration`, como `3:45`).

## Lo que se pidió (histórico)

- Los **10 libros**, **10 canciones** (enlace de YouTube, título y artista), **10 juegos** (con su enlace a Shelvid) y **10 películas o series** (con su enlace de tráiler), cada uno con su **portada**
  como imagen.
- La **dirección de tu perfil de Yoleo**.
- La construcción puede empezar ya con contenido de ejemplo (marcado como tal) y sustituirlo cuando lleguen los datos.

## Fuera de esta feature

- Cualquier API con clave (TMDB, IGDB, YouTube Data, Spotify) y la importación automática de fichas.
- Descargar o alojar canciones, o un reproductor de audio sin vídeo.
- Notas o justificaciones de cada elemento, valoraciones o comentarios.
- Más de 10 elementos por sección, filtros o búsqueda.
- Listas de reproducción completas de YouTube dentro de la web (solo se enlazan).
