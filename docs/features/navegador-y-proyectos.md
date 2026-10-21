# Navegador y proyectos

**Estado:** Verificada
**Requisitos que cierra:** M-04, M-10
**Fecha de acuerdo:** 2026-10-10

## Qué se construye

El Navegador deja de ser un estado vacío y pasa a ser la forma de ver los proyectos de Pol. Doble
clic en el icono de un proyecto del escritorio (o un toque dentro de la carpeta Proyectos en
móvil) abre el Navegador con ese proyecto cargado dentro de la ventana. Abierto desde el dock, el
Navegador muestra la página de Favoritos: una ficha por proyecto con su icono, nombre,
descripción y tecnologías.

La ventana tiene:

- **Barra de navegación:** atrás y adelante (entre los proyectos visitados en esta ventana),
  recargar, una barra de dirección que muestra el dominio con su candado (solo lectura), un botón
  de Favoritos y otro de "Abrir en pestaña nueva".
- **Barra de favoritos:** todos los proyectos. Un clic carga ese proyecto.
- **Página:** el sitio del proyecto dentro de un `iframe`, con un indicador mientras carga.

Si un proyecto está marcado como no incrustable, en lugar de una ventana en blanco aparece el aviso
"no se puede abrir dentro de Pol OS" con el botón "Abrir en pestaña nueva".

## Decisiones tomadas

- **El Navegador solo carga la URL de un proyecto de la colección.** No hay barra de direcciones
  editable ni forma de pasarle otra dirección, ni desde la terminal en el futuro.
- **`url` pasa a ser obligatoria** en cada proyecto: es lo que se carga o se abre en pestaña nueva.
- **No se puede detectar de forma fiable si una web prohíbe el iframe**, así que manda el campo
  `embeddable` de cada proyecto. Para tus proyectos se comprueba con sus cabeceras antes de
  marcarlos.
- **El `iframe` va con `sandbox`** (scripts, formularios y ventanas emergentes) y
  `referrerpolicy="strict-origin-when-cross-origin"`. Las webs de otro dominio reciben además
  `allow-same-origin`, que necesitan para funcionar. Las páginas locales no: con ese permiso y los
  scripts, una página del mismo origen podría salir del sandbox.
- **Primer proyecto real**, una web externa. Hoy no envía cabeceras que
  impidan incrustarlo (comprobado con `curl -I`), así que va como incrustable. Su descripción y sus
  tecnologías salen del README del repositorio (Next.js, Supabase, Claude, ElevenLabs y Twilio como
  principales) y ya no lleva la etiqueta "Ejemplo".
- **Proyectos de ejemplo:**
  - "Estudio" carga una página de demostración local (`public/demo/estudio.html`), así el
    Navegador se ve funcionando sin depender de webs externas.
  - "Panel" y "Pol OS" se quedan como no incrustables, para enseñar el aviso. Pol OS no puede
    cargarse dentro de sí mismo.
- **La CSP con `frame-src`** (dominios permitidos en el `iframe`) llega con `public/_headers` en
  M-08. Queda anotado en `docs/architecture.md`.

Decisiones que salieron durante la construcción:

- Cada ventana cuenta las veces que se pide abrirla (`opens` en el gestor de ventanas). Así, con el
  Navegador ya abierto, el doble clic en otro proyecto navega en esa misma ventana.
- El historial de atrás y adelante es lógica pura (`src/os/apps/browser/history.ts`) y solo admite
  identificadores de proyectos conocidos.
- La URL de un proyecto puede ser absoluta o una ruta local que empiece por `/` (páginas de
  demostración en `public/demo/`).
- Una web que se hidrata con JavaScript tarda unos segundos en pintarse dentro del `iframe` (su página se hidrata con JavaScript):
  no es un fallo del Navegador.

## Cobertura

| Requisito | Se implementa en | Se valida con |
|-----------|------------------|---------------|
| M-04 | `src/os/items.ts`, `src/os/apps/browser/` | `tests/e2e/m-04-proyectos.spec.ts` |
| M-10 | `src/os/apps/browser/`, `src/os/apps/browser/history.ts` | `tests/e2e/m-10-navegador.spec.ts`, `src/os/apps/browser/history.test.ts` |

Qué comprueba cada test, según los criterios del PRD:

- **M-04 (escritorio y móvil):** cada proyecto de la colección tiene su icono con su nombre;
  doble clic (o toque en la carpeta, en móvil) abre el Navegador con el `iframe` apuntando a la
  URL de ese proyecto y la dirección mostrando su dominio. *Negativo:* un proyecto no incrustable
  abre el aviso, no un `iframe`.
- **M-10:** la barra de favoritos contiene exactamente los proyectos de la colección; un clic
  carga cada uno; atrás y adelante recorren lo visitado; "Abrir en pestaña nueva" abre la URL del
  proyecto. *Negativo:* el aviso aparece con su botón para un proyecto no incrustable, y en el
  `iframe` nunca aparece una URL que no sea la de un proyecto. Las webs externas se sustituyen en
  los tests por una página local (nada sale a internet).
- **Unitario:** el historial de la ventana (visitar, atrás, adelante, visitar después de volver
  atrás descarta lo de delante, ignorar proyectos que no existen).

## Fuera de esta feature

- La CSP y `public/_headers` (con M-08).
- Abrir repositorios de GitHub como proyectos (C-01).
- Pestañas múltiples dentro del Navegador.
- Las descripciones reales del resto de proyectos: contenido pendiente de Pol.
