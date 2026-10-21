# Reproductor más fácil de usar (móvil y escritorio)

**Estado:** Verificada
**Requisitos que cierra:** S-03 (mejora del mini reproductor de Favoritos)
**Fecha de acuerdo:** 2026-10-16

## Qué se construye

El mini reproductor de Favoritos funciona, pero en el móvil es incómodo: el botón de «siguiente» mide 30 px y está arriba, en la cabecera, junto a la «x», y para pasar de canción
hay que apuntar con precisión. Esta feature rehace sus controles para que se manejen bien con el pulgar y también con ratón y teclado.

- **Una barra de controles bajo el vídeo**, con tres botones grandes: **anterior**, **reproducir/pausar** y **siguiente**. En el móvil miden 48 × 48 px (más de los 44 px que
  recomiendan las guías de accesibilidad táctil) y están separados entre sí para no pulsar el vecino; en el escritorio, 36 × 36 px. Quedan en la parte baja, donde llega el pulgar.
- **La cabecera se queda con el título, el artista y la «x» de cerrar**, que también crece a 44 px en el móvil. El subtítulo dice en qué lugar de la lista va: «Plini · 3 de 10».
- **El botón de play/pausa refleja lo que pasa de verdad**: si el vídeo se pausa con los controles de YouTube, el botón cambia solo.
- **En los tráilers (que no tienen lista)** solo salen reproducir/pausar; no hay anterior ni siguiente. En la primera canción, «anterior» sale desactivado; en la última, «siguiente».
- **En la lista de Música se marca la canción que suena** (fila resaltada y el botón de play de esa fila indica «sonando»), y los botones de play de la lista también pasan a 44 px en el móvil.
- **En el móvil el reproductor va a todo el ancho**, justo encima del dock; en el escritorio sigue abajo a la derecha. El vídeo no cambia de tamaño (16:9, nunca por debajo de 200 px de alto).

## Decisiones tomadas

- **El vídeo sigue siempre a la vista.** No hay botón para plegar o esconder el reproductor: las condiciones de YouTube no permiten ocultarlo ni reproducir solo el audio (ver la ficha de Favoritos).
- **Los controles son botones propios sobre la API oficial** (`playVideo`, `pauseVideo`, `loadVideoById`), igual que el «siguiente» actual; no se tapa ni se altera el reproductor de YouTube.
- **«Anterior» pasa siempre a la canción anterior de la lista**; no reinicia la actual. Es lo más simple y predecible con un solo toque; la barra de progreso de YouTube sigue ahí para volver al principio.
- **Al acabar la última canción, se queda parado** (como ahora); no hay bucle ni modo aleatorio.
- **Los controles van debajo del vídeo y no encima**: encima del vídeo se podrían confundir con los de YouTube y las condiciones piden no solapar su interfaz.
- **El estado del botón sale de `onStateChange`** del reproductor, no de lo último que se pulsó: es la única fuente fiable cuando el visitante usa los controles de YouTube.
- **Mismo componente para móvil y escritorio**; solo cambian tamaños y el ancho.

## Cobertura

| Requisito | Se implementa en | Se valida con |
|-----------|------------------|---------------|
| S-03 | Barra bajo el vídeo con anterior, reproducir/pausar y siguiente: `src/os/shell/MiniPlayer.svelte`, `src/os/shell/player-icons.ts`, `src/lib/player-queue.ts` (`previousTrack`, `trackPosition`) | `src/lib/favorites.test.ts`, `tests/e2e/s-03-reproductor.spec.ts` |
| S-03 | Botones de 44 px o más en el móvil (48 px los de la barra) y 36 px en el escritorio: `src/os/shell/MiniPlayer.svelte`, `src/os/apps/favorites/MusicList.svelte` | `tests/e2e/s-03-reproductor.spec.ts` |
| S-03 | El botón de pausa refleja el estado real del vídeo (`onStateChange`): `src/os/shell/MiniPlayer.svelte` | `tests/e2e/s-03-reproductor.spec.ts` |
| S-03 | Posición «3 de 10» y marca de la canción que suena en la lista: `src/os/shell/MiniPlayer.svelte`, `src/os/apps/favorites/MusicList.svelte` | `tests/e2e/s-03-reproductor.spec.ts` |
| S-03 | Tráilers sin anterior ni siguiente; extremos de la lista desactivados: `src/os/shell/MiniPlayer.svelte`, `src/lib/player-queue.ts` | `src/lib/favorites.test.ts`, `tests/e2e/s-03-reproductor.spec.ts` |
| S-03 | Reproductor a ancho completo sobre el dock en el móvil, sin desbordar y sin tapar el final de la lista: `src/os/shell/MiniPlayer.svelte`, `src/os/apps/favorites/Favorites.svelte` | `tests/e2e/s-03-reproductor.spec.ts` |
| S-03 | Que se maneje bien con el pulgar en un teléfono real | no verificable por interfaz: la comodidad real no la mide un test; la prueba Pol a mano en su móvil antes de dar la feature por buena |

Qué comprobará cada test, según el criterio del PRD:

- **Unitarios (`favorites.test.ts`):** `previousTrack` devuelve la anterior, null en la primera y null si la canción no está en la lista; `trackPosition` da «3 de 10» y nada para un tráiler suelto.
  - *Negativo:* con una lista de un solo elemento no hay anterior ni siguiente.
- **e2e (escritorio y móvil, con axe):** los tres botones existen con nombre accesible y se manejan con teclado; «siguiente» y «anterior» cambian de vídeo y de subtítulo; el botón de pausa pausa y
  vuelve a reproducir, y cambia solo si el vídeo cambia de estado; en el móvil cada botón mide al menos 44 px y no se solapa con el vecino; el reproductor cabe en el ancho sin scroll horizontal; la fila
  que suena queda marcada.
  - *Negativo:* un tráiler no enseña anterior ni siguiente; en la primera y la última canción el botón correspondiente está desactivado; si el vídeo no carga, siguen el aviso y el enlace a YouTube.

## Hallazgos al construir

- **En el móvil el reproductor tapaba las últimas canciones de la lista** (a ancho completo cubre unos 420 px de abajo, y la lista no podía desplazarse más allá de su final). Ahora, mientras hay algo
  sonando, la región con desplazamiento deja 460 px de margen inferior en el móvil. Lo cubre un test (la última canción se puede alcanzar y pulsar sin que el reproductor esté encima).
- **El botón desactivado usa `aria-disabled` y no `disabled`**, para que siga enfocable: con el teclado, al llegar a la última canción con «siguiente» el foco no se pierde. Playwright trata `aria-disabled` como
  desactivado, así que los tests de «pulsarlo no hace nada» fuerzan el clic.
- **La home volvió a pasarse del presupuesto de JavaScript (130,26 KB frente a 130)** por el código nuevo. Se resolvió sacando lo que solo usa el reproductor de los trozos compartidos con la home:
  los iconos (`src/os/shell/player-icons.ts`) y la lógica de anterior y posición (`src/lib/player-queue.ts`). La home queda por debajo del tope sin tocar el presupuesto.
- El YouTube simulado de los tests ahora responde como el real: `play` y `pause` emiten el cambio de estado, y hay una ayuda para simular que el visitante pausa con los controles del vídeo.
- Sigue sin verse un vídeo real reproducirse en el entorno de revisión: la comodidad real y la reproducción las prueba Pol a mano.

## Fuera de esta feature

- Plegar, minimizar u ocultar el vídeo (lo prohíben las condiciones de YouTube).
- Controles en la pantalla de bloqueo del teléfono o teclas multimedia, y cualquier reproducción en segundo plano.
- Bucle, modo aleatorio, cola editable, barra de progreso o control de volumen propios (YouTube ya trae los suyos en el vídeo).
- Mover o cambiar de tamaño el reproductor arrastrando.
- Gestos de deslizar para cambiar de canción.
- Cambios de contenido de Favoritos.
