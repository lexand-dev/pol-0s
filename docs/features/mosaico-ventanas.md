# Mosaico de ventanas

**Estado:** Verificada
**Requisitos que cierra:** S-07
**Fecha de acuerdo:** 2026-10-10

## Qué se construye

Lo que hace el botón verde de macOS al pasar el ratón por encima. Con una ventana abierta, si dejas el
puntero sobre su botón verde (medio segundo), aparece debajo un pequeño cuadro de cristal con tres opciones,
cada una con un dibujo de lo que hace:

- **Mitad izquierda** y **Mitad derecha**: la ventana se coloca ocupando justo esa mitad de la pantalla, de
  arriba (bajo la barra de menú) a abajo (sobre el dock), con una animación corta.
- **Ampliar** (o **Restaurar** si ya está ampliada o colocada): lo mismo que el clic en el botón verde de hoy.

Con dos ventanas, una en cada mitad, se ven a la vez sin solaparse. Un clic en el propio botón verde sigue
ampliando, como hasta ahora.

Una ventana colocada en una mitad **se suelta** si la arrastras por su barra: recupera el tamaño que tenía
antes y el puntero se queda en la misma proporción de la barra, como en macOS. Mientras está colocada no tiene
tirador de tamaño: para cambiarlo se suelta arrastrándola o con Restaurar. Si cambia el tamaño del navegador,
las ventanas colocadas se reajustan a su mitad.

No hace falta ratón: el menú **Ventana** gana "Mitad izquierda" y "Mitad derecha" para la ventana activa, y el
cuadro también se abre al dar el foco con el teclado al botón verde. Solo existe en escritorio: en móvil no hay
ventanas.

## Decisiones tomadas

- **Un clic en el botón verde sigue ampliando.** Es lo que hace hoy y lo que hace macOS. El cuadro es un
  añadido al pasar el ratón, no un cambio del botón.
- **Espera de 400 ms antes de abrir** el cuadro y un margen al ir del botón al cuadro, para que no salte al
  cruzar la barra de título de camino a otra cosa. Se cierra al sacar el puntero, con Escape o al elegir.
  Mientras se arrastra una ventana no aparece.
- **La lógica es pura**, en `src/os/windows/window-manager.ts`: una función `tile` y un campo `tile` en el
  estado de la ventana (`'left' | 'right'`), igual que `maximized`. Se prueba sin navegador; el componente
  solo pinta.
- **Una sola copia del tamaño anterior.** `restore` guarda el tamaño de antes de la primera colocación o
  ampliación; pasar de mitad izquierda a ampliada y a derecha no lo pisa, y Restaurar vuelve siempre al
  original.
- **Mismo alto útil que "ampliar":** de la barra de menú al espacio reservado al dock (`DOCK_SPACE`). La
  mitad se calcula sobre el ancho de la pantalla, y en el ancho mínimo de escritorio (768 px) cada mitad
  mide 384 px, por encima del mínimo de ventana (320 px).
- **Escape en el cuadro lo cierra a él, no a la ventana.** Hoy Escape cierra la ventana activa; con el cuadro
  abierto, esa tecla debe ocuparse solo del cuadro.
- **Accesibilidad:** el cuadro es un `menu` con `menuitem`, con etiqueta "Organizar ventana"; los dibujos
  son decorativos (`aria-hidden`) y cada opción tiene su texto. Respeta `prefers-reduced-motion`: sin
  animación, la ventana salta a su sitio.
- **Cerrar o minimizar una ventana colocada** no guarda nada: al recuperarla vuelve a estar colocada en su
  mitad, como una ventana ampliada sigue ampliada.
- **Sin tirador de tamaño mientras está colocada** (cambio respecto a lo previsto al acordar: ahí decía que
  redimensionar también la soltaba). En macOS cambiar el tamaño de una mitad mueve la ventana vecina, y eso
  queda fuera; ocultar el tirador, como ya pasa con una ventana ampliada, es lo coherente y lo más simple.
- **Ampliar/Restaurar desde el cuadro y el clic en el botón verde hacen lo mismo** (`toggleMaximize`): ampliar,
  o volver al tamaño anterior si ya está ampliada o colocada. Solo la elección desde el cuadro se anima; el
  clic directo no, para no cambiar su comportamiento actual.
- **Token nuevo `--accent-solid`** para fondos con texto blanco encima. El test de accesibilidad del cuadro,
  con Correo abierto, destapó que el botón "Enviar" en tema oscuro (blanco sobre `--accent`) tenía un contraste
  de 3,29:1. `--accent-solid` es el mismo azul en claro y uno algo más oscuro en oscuro (4,78:1), y sustituye a
  `--accent` en los seis sitios con texto blanco: Enviar y el avatar de Correo, el botón del Navegador, el
  elemento resaltado de los menús y del cuadro, y el nombre seleccionado de un icono del escritorio.
- **Iconos propios** para los dibujos del cuadro (rectángulos con una mitad rellena), no copiados de macOS.

## Cobertura

| Requisito | Se implementa en | Se valida con |
|-----------|------------------|---------------|
| S-07 | `src/os/windows/window-manager.ts`, `src/os/windows/Window.svelte`, `src/os/windows/TileMenu.svelte`, `src/os/menus.ts`, `src/os/OS.svelte`, `src/os/shell/Desktop.svelte`, `src/os/icons.ts`, `src/styles/tokens.css` | `tests/e2e/s-07-mosaico.spec.ts`, `src/os/windows/window-manager.test.ts`, `src/os/menus.test.ts`, `tests/csp/m-11-csp.spec.ts` |

Qué comprueba cada test, según el criterio del PRD:

- **e2e (escritorio):**
  - Con el ratón sobre el botón verde aparece el cuadro con sus tres opciones; al sacar el puntero se cierra.
  - "Mitad izquierda" deja la ventana en `x = 0` con la mitad del ancho; "Mitad derecha" en la otra mitad;
    ambas con el alto útil. Dos ventanas, una en cada mitad, no se solapan. Una ventana colocada sigue en su
    mitad tras minimizarla y recuperarla, y se reajusta si cambia el tamaño del navegador.
  - "Ampliar" ocupa todo el ancho y "Restaurar" vuelve al tamaño original, también tras pasar por una mitad.
  - Un clic en el botón verde sigue ampliando y no abre el cuadro.
  - Menú Ventana: "Mitad izquierda" y "Mitad derecha" actúan sobre la ventana activa.
  - Teclado: dar el foco al botón verde abre el cuadro, se recorre con las flechas, Enter elige y Escape lo
    cierra **sin cerrar la ventana**.
  - *Negativos:* arrastrar una ventana colocada la suelta y recupera su tamaño anterior; una ventana colocada
    no tiene tirador de tamaño; si el puntero solo pasa por el botón verde, el cuadro no se abre; sin ventanas,
    las dos entradas del menú Ventana salen desactivadas; con `prefers-reduced-motion` la ventana se coloca sin animar. Sin errores de
    accesibilidad con el cuadro abierto, en claro y en oscuro.
- **Unitarios de `window-manager.ts`:** el rectángulo de cada mitad, sin huecos ni solapes, para varios
  tamaños de pantalla; que el tamaño anterior se conserva al encadenar mitades y ampliar; que mover suelta la mitad y
  que una colocada no se redimensiona; que `fitToViewport` reajusta las colocadas; que `cascade` no las toca.
- **Unitarios de `menus.ts`:** las dos entradas existen en Ventana y se desactivan sin ventanas.
- **CSP (`pnpm test:csp`):** el recorrido abre el cuadro y coloca una ventana sin ninguna violación.

**Lo que no se comprueba aquí:** una pantalla táctil de escritorio sin ratón (no hay "pasar por encima"); se
cubre con el menú Ventana y el teclado, que sí se prueban.

## Fuera de esta feature

- Colocar arrastrando la ventana contra el borde de la pantalla (como el imán de macOS o Windows) y el
  asistente de macOS que ofrece elegir otra ventana para la otra mitad. Se anotará en `mejoras/` si se quiere.
- Cuartos de pantalla, tercios y "mover y cambiar tamaño" con más opciones: solo mitades y ampliar.
- Recordar la disposición entre visitas.
- Atajos de teclado globales (el navegador los reserva), igual que en los menús.
