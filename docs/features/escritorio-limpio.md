# Escritorio más limpio y letra más grande

**Estado:** Verificada
**Requisitos que cierra:** M-04, M-09, S-08
**Fecha de acuerdo:** 2026-10-11

## Qué se construye

Seis ajustes que Pol pidió el 2026-10-11 antes de desplegar: los tres primeros, de entrada; los otros tres, tras verlo en pantalla:

1. **Letra más grande.** La base de la interfaz pasa de 13 a 14px. Todo texto de 14px o menos sube 1px (el secundario de 12 a
   13px, los rótulos de 11 a 12px, la Terminal de 12,5 a 13,5px); los tamaños de 15px o más no cambian.
2. **Icono de `project-template`:** una estrella amarilla de cinco puntas sobre un fondo oscuro, para que no se parezca al de
   Planito ni al de Pol OS (que también era una «P»).
3. **Menos iconos en el escritorio.** Hasta ahora había una carpeta Proyectos y, además, un icono suelto por cada proyecto. Ahora
   el escritorio solo tiene la carpeta, y cada proyecto vive dentro de ella. La excepción es `project-template`, que solo existe en
   GitHub: conserva su icono en el escritorio y **sale de la lista de la carpeta**. En móvil pasa igual (carpeta Proyectos y, suelto
   en la pantalla de inicio, el de GitHub).
4. **Tamaño del texto a elección** (retoque tras verlo): en Ajustes y en el menú Visualización, tres pasos (Normal, Grande ×1,1 y Muy
   grande ×1,2), no libres. Se guarda en el navegador como el tema y el fondo (M-09).
5. **Botón del Libro de visitas más corto:** «Dejar reseña» (antes «Escribir una reseña»), siempre en una línea.
6. **Barra de menú más alta:** de 28 a 32px, para que el texto no vaya pegado a los bordes con la letra nueva.

## Decisiones tomadas

- **Un campo en cada proyecto, `placement`** (`folder` por defecto, o `desktop`), en lugar de comprobar un nombre concreto en el
  código. Un proyecto nuevo que solo viva en GitHub se pone en `desktop` y ya está.
- **El icono propio sigue abriendo el detalle en la app Proyectos**, con sus capturas y botones; solo deja de estar en la cuadrícula
  de la vista general. Desde su detalle, «Proyectos» vuelve a la vista general sin él.
- **La Terminal sigue listando todos los proyectos** (`projects`, `open <nombre>`): es una lista de comandos, no la vista del visitante.
  El Navegador mantiene todos en su barra de favoritos.
- **La escala de letra sube un punto** (de 13 a 14px) y no se pasa a `rem`: es el cambio mínimo que mantiene la jerarquía. Las
  ventanas conservan su tamaño (el contenido desplaza si hace falta).
- **El tamaño elegido multiplica cada `font-size`** con una variable CSS (`--text-scale`: 1, 1,1 o 1,2), que pone `data-text` en `<html>`.
  Tres pasos y no un deslizador, a petición de Pol ("no libremente, pero un poco más"). Los pasos se leen antes de pintar con el
  mismo script de arranque del tema y el fondo, así que no hay parpadeo. Lo que no está en `px` (la hora de la pantalla de acceso) no cambia.
- **La barra de menú mide 32px** (antes 28) y el hueco de cada menú crece 1px por lado; el límite de las ventanas (`MENU_H`) acompaña.
- **El icono es un PNG de 256 × 256** generado con Chrome (como los demás de `public/projects/`), para no tocar el esquema de iconos.

## Cobertura

| Requisito | Se implementa en | Se valida con |
|-----------|------------------|---------------|
| M-04 | `src/content.config.ts` (`placement`), `src/content/projects/project-template.json`, `public/projects/project-template.png`, `src/os/items.ts`, `src/pages/index.astro` | `tests/e2e/m-04-proyectos.spec.ts`, `tests/e2e/m-02-escritorio.spec.ts`, `tests/e2e/m-03-movil.spec.ts` |
| M-09 | `src/lib/prefs.ts`, `src/styles/tokens.css`, `src/os/menus.ts`, `src/os/apps/Settings.svelte`, `src/os/OS.svelte`, `src/os/windows/window-manager.ts` | `src/lib/prefs.test.ts`, `src/os/menus.test.ts`, `tests/e2e/m-09-ajustes.spec.ts`, `tests/e2e/s-05-menus.spec.ts` |
| S-08 | `src/os/apps/projects/Projects.svelte` (la vista general solo lista los de la carpeta) | `tests/e2e/s-08-proyectos.spec.ts` |

Qué comprueba cada test, según el criterio del PRD:

- **M-04 (escritorio):** los proyectos de la carpeta no tienen icono suelto; el de GitHub sí, con su nombre y su imagen cargada de
  verdad; abrir la carpeta enseña los de la carpeta y no el de GitHub; su icono abre su detalle y desde ahí se vuelve a la vista
  general sin él; con Proyectos abierto, el icono propio navega en la misma ventana. **En móvil:** la carpeta tiene los de la
  carpeta y el de GitHub sale suelto en el inicio.
  - *Negativo:* un proyecto que no se deja incrustar sigue ofreciendo «Visitar sitio» en una pestaña nueva.
- **S-08:** la vista general tiene una tarjeta por cada proyecto de la carpeta y ninguna por el de GitHub; el detalle de este
  sigue funcionando.
- **M-09 (tamaño del texto):** los tres pasos agrandan el texto en la proporción exacta (×1,1 y ×1,2) y se vuelve al normal; el elegido
  se mantiene al recargar y se aplica antes de pintar; un valor raro guardado se ignora; con el almacenamiento bloqueado funciona durante la
  visita; Ajustes pasa axe en claro y oscuro con el tamaño mayor; la barra de menú contiene su texto con el tamaño mayor; el menú
  Visualización marca el activo y coincide con Ajustes.
  - *Negativo:* un valor guardado que no existe (por ejemplo `9999px; x`) vuelve al normal sin romper nada.
- **La letra base y el icono** no tienen un requisito propio: la accesibilidad (contraste y desbordes) se comprueba con las pruebas de
  axe de cada app, y el aspecto se revisa a ojo.

## Hallazgos al construir

- La etiqueta «project-template» ocupa dos líneas bajo su icono con la letra nueva; sigue sin tocar al icono de debajo.
- Tres especificaciones de e2e (`m-04`, `m-02` y `s-08`) usaban los iconos sueltos de los proyectos: se reescribieron con
  un ayudante común (`openProjectDetail` en `tests/e2e/helpers.ts`) que abre el detalle por la carpeta o por el icono propio.
- Las pasadas completas de e2e fallaron dos veces con tres pruebas distintas cada vez (la caída de Miniflare conocida y un cierre del
  navegador en el arranque); aisladas pasan todas y la tercera pasada completa quedó limpia.

**Lo que no se comprueba aquí:** que la letra «se lea bien»: es una decisión de gusto, se juzga mirando la web.

## Fuera de esta feature

- Pasar toda la tipografía a `rem` o un tamaño de texto libre (un deslizador).
- Quitar `project-template` de la Terminal o del Navegador.
- Rediseñar el Stack (más gráficos que barras): tiene su propia ficha, `stack-graficos`.
