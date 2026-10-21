# Damas en 3D

**Estado:** Verificada
**Requisitos que cierra:** C-06 (nuevo; se añade al PRD con esta ficha)
**Fecha de acuerdo:** 2026-10-16

## Qué se construye

Una partida de **damas españolas contra la máquina**, con un tablero en 3D dibujado en el navegador: casillas claras y **negras** dentro de un **marco de
madera con grosor**, con sombra sobre la mesa y **perspectiva** (lo cercano se ve más grande). Las fichas son **blancas y rojas**, con volumen y un brillo suave;
la dama lleva dos fichas apiladas. Hay una animación corta al mover.

Aspecto acordado con el prototipo: [Damas de Pol OS](https://claude.ai/artifact/F8XjGJgrwVZsPBwoqF6Zys), versión 5. Es privado.

- **En el escritorio, el tablero se gira y se inclina arrastrando con el ratón:** de lado a lado lo gira (arrastrar a la derecha lo gira hacia la izquierda, como
  si empujaras la mesa) y arriba o abajo lo inclina (hacia abajo se ve más desde arriba), entre 28° y 82°. Un arrastre no cuenta como clic. Debajo hay botones para
  girar de 45° en 45°, inclinar y «Restablecer», que también sirven con el teclado. **La vista inicial es desde el lado de quien juega**, como sentado a la mesa, y
  **la vista elegida se guarda** en este navegador para la próxima partida. Se abre con **`checkers`** en la Terminal y aparece en la lista de `minigames` junto a `memory`. Como el memory, no tiene icono en el escritorio.

- **El color se sortea en cada partida** (decisión de Pol al dar el visto bueno). Las blancas salen primero: si te tocan las rojas, empieza la máquina y el tablero
  se da la vuelta para que tus fichas queden de tu lado. El nivel (**Fácil** o **Normal**) se cambia en cualquier momento arriba a la derecha.
- **Para mover**, se toca o se pulsa una ficha propia y se marcan sus destinos posibles; al tocar uno, la ficha se mueve. Si hay una captura en cadena, se marca
  el recorrido completo. Si es obligatorio capturar, solo se pueden elegir las fichas que capturan, y un aviso lo explica.
- **La máquina** contesta tras una pausa corta, para que se vea su jugada. Su última jugada queda marcada en el tablero.
- **Arriba** se ve de quién es el turno y las fichas que quedan a cada lado. Hay botones para **Deshacer** (vuelve a antes de la última jugada propia) y **Rendirse**.
- **Al acabar**, un aviso sobre el tablero dice quién ha ganado y por qué («La máquina se ha quedado sin fichas», «No te quedan movimientos», «Tablas»), con un botón
  «Jugar otra». Arriba pasa a poner «Partida terminada», y «Rendirse» se convierte en «Jugar otra». En el móvil sale el mismo aviso. Aspecto en la versión 5 del prototipo.
- **En el móvil, el tablero se ve desde arriba y no se gira**, a pantalla completa, con casillas de al menos 44 px (arrastrar con el dedo chocaría con tocar las fichas). En perspectiva isométrica, en 375 px de ancho las casillas quedarían en
  unos 40 × 20 px y no se podrían tocar con precisión.

## Reglamento (damas españolas)

- **Tablero y salida:** 8 × 8, 12 fichas por bando en las casillas de juego de las tres primeras filas. Empiezan las blancas.
- **Fichas (peones):** avanzan en diagonal una casilla, solo hacia delante, y capturan también solo hacia delante, saltando una ficha contraria a una casilla vacía.
- **Damas:** una ficha corona al **terminar** su jugada en la última fila; si solo pasa por ella en mitad de una captura, no corona. La dama se mueve y captura a cualquier
  distancia en diagonal (dama «voladora») y puede caer en cualquier casilla vacía tras la ficha capturada.
- **Captura obligatoria, con la ley de la cantidad y la de la calidad:** hay que capturar el máximo de fichas posible. Con el mismo número, hay que capturar con dama antes
  que con peón y, si sigue el empate, la jugada que se lleve más damas. Las fichas capturadas se retiran al final de la jugada y no se puede saltar dos veces la misma.
- **Fin de la partida:** pierde quien se queda sin fichas o sin movimientos. Son **tablas** si se repite tres veces la misma posición, o si pasan 40 jugadas por bando sin
  capturas ni movimientos de peón.
- Al construirlo **compruebo el reglamento de la Federación Española de Damas**: la orientación del tablero, el número de jugadas para las tablas y los desempates de la
  ley de la calidad. Lo que cambie respecto a esta lista se anota en la ficha.

## Decisiones tomadas

Las tres primeras son las que te recomendé; las doy por buenas salvo que digas otra cosa:

1. **Reglas españolas**, no inglesas: son las que conoce el público de aquí, aunque la dama voladora y la ley de la cantidad las hacen más complejas.
2. **Contra la máquina, con nivel Fácil y Normal.** Dos personas en el mismo dispositivo queda fuera, aunque costaría poco añadirlo después.
3. **En 3D en el escritorio (con giro e inclinación) y visto desde arriba en el móvil**, por el tamaño de las casillas.

Además:

- **Una app pequeña**, como el memory: se abre con `checkers` (o `open damas`), no tiene icono en el escritorio y su código (19,7 KB sin comprimir, medido en el build) se
  descarga al abrirla.
- **El tablero es un SVG generado en código** con una proyección en perspectiva calculada en cada vista (`src/lib/checkers/view.ts`), sin imágenes ni librerías 3D.
- **Sus estilos van en su propio archivo** (`src/os/apps/checkers/checkers.css`, 4,4 KB), importado con `?url` y enlazado con `<svelte:head>` al abrir la ventana:
  la home no lo carga, no cuenta en su presupuesto de CSS y no suma ninguna petición. Mientras llega, la ventana está oculta.
- **El reglamento es lógica pura** en `src/lib/checkers/rules.ts` (generar jugadas legales, aplicar una jugada, detectar el final), sin DOM. Es lo que más se prueba.
- **La máquina es un minimax con poda alfa-beta** (`src/lib/checkers/ai.ts`), con un tope de tiempo de unos 300 ms por jugada para no bloquear la ventana. **Fácil** busca
  poco y a veces elige una jugada peor a propósito; **Normal** busca más hondo. Se ejecuta en la página, sin Web Worker, porque un Worker obligaría a ampliar la política de
  seguridad. Si se nota lenta en el móvil, se replantea.
- **Accesible con teclado:** las flechas recorren las casillas en el orden lógico del tablero (no en el del dibujo girado), y Enter o espacio eligen ficha y destino. Cada
  jugada se anuncia con coordenadas: «Blancas: c3 a d4», «Negras: e5 por d4 a c3, captura».
- **Movimiento reducido:** sin animación de las fichas.
- **Solo se guarda la vista del tablero** (giro e inclinación, en el almacenamiento del navegador, con el mismo cuidado que las preferencias: si no se puede leer, se usa la vista inicial). La partida no se guarda: cerrar la ventana la termina.

## Cobertura

| Requisito | Se implementa en | Se valida con |
|-----------|------------------|---------------|
| C-06 | Reglamento español (jugadas, capturas, ley de la cantidad y la calidad, coronar, final y tablas): `src/lib/checkers/rules.ts` | `src/lib/checkers/rules.test.ts` |
| C-06 | La máquina, en los dos niveles, juega siempre jugadas legales y dentro del tope de tiempo: `src/lib/checkers/ai.ts` | `src/lib/checkers/ai.test.ts` |
| C-06 | Proyección (cabe en el lienzo en cualquier vista, tamaño fijo, perspectiva) y vista guardada: `src/lib/checkers/view.ts` | `src/lib/checkers/view.test.ts` |
| C-06 | Tablero en 3D con giro e inclinación (ratón y botones) y vista guardada en el escritorio, desde arriba en el móvil, ratón, dedo y teclado: `src/os/apps/checkers/Checkers.svelte`, `src/os/apps/checkers/checkers.css`, `src/lib/checkers/view.ts`, `src/os/apps/registry.ts`, `src/os/apps/AppView.svelte` | `tests/e2e/c-06-damas.spec.ts` |
| C-06 | Se abre con `checkers` y sale en `minigames`: `src/os/terminal/commands.ts`, `src/os/terminal/games/games.ts` | `src/os/terminal/commands.test.ts`, `tests/e2e/c-06-damas.spec.ts` |
| C-06 | La home no carga el juego ni su CSS, ni suma peticiones, y la política de seguridad deja cargar su hoja | `tests/csp/s-06-rendimiento.spec.ts`, `tests/csp/m-11-csp.spec.ts`, `tests/e2e/c-06-damas.spec.ts` |
| C-06 | Que el nivel Normal sea un rival razonable | no verificable por interfaz: la dificultad es una sensación; Pol juega unas partidas y se ajusta la profundidad de búsqueda |

Qué comprobará cada test, según el criterio del PRD:

- **Unitarios (`rules.test.ts`):** la posición inicial y sus 7 jugadas legales; peones que solo avanzan y capturan hacia delante; capturas en cadena; la dama voladora (mueve y
  captura a distancia, y cae en cualquier casilla libre tras la ficha); la ley de la cantidad y la de la calidad con posiciones preparadas; coronar solo al terminar en la
  última fila; no saltar dos veces la misma ficha; el final sin fichas o sin movimientos; tablas por repetición y por el límite de jugadas.
  - *Negativo:* una jugada que no está en la lista de legales se rechaza, y una que no captura cuando es obligatorio, también.
- **Unitarios (`ai.test.ts`):** desde muchas posiciones, la jugada de la máquina está siempre entre las legales; si hay una captura que gana la partida, Normal la elige; el tope de tiempo se respeta.
- **e2e (escritorio y móvil, con axe en claro y oscuro):** `checkers` abre la ventana con el color sorteado (blancas o rojas, con el tablero dado la vuelta); mover una ficha marca sus destinos y la mueve; la máquina contesta; una captura obligatoria
  bloquea las demás fichas con su aviso; Deshacer y Rendirse; arrastrar gira e inclina sin mover fichas, los botones de vista y «Restablecer», y la vista se recupera al reabrir; el aviso final con «Jugar otra» (al rendirse); el teclado; en el escritorio el tablero es
  en 3D y en el móvil se ve desde arriba con casillas de al menos 44 px; antes de abrirlo no se pide su código.

## Hallazgos al construir

- **Reglamento:** la FEDA no publica su reglamento en línea. Se contrastó con Ludoteka, Wikipedia y Magnojuegos, que coinciden en lo de la ficha (salen las blancas, peones
  que no capturan hacia atrás, dama voladora que no captura dos fichas seguidas, fichas capturadas que se retiran al final, leyes de la cantidad y la calidad y triple repetición).
  Ninguna da la cifra de jugadas para tablas: se queda en 40 por bando. La ley de la calidad se aplica en tres pasos (con dama, más damas, la que encuentra antes una dama).
- **El presupuesto de CSS de la home saltó (53,9 KB frente a 50)** con los estilos de las damas en `global.css`, como avisaba la ficha. En vez de subir el tope, la hoja
  se carga al abrir la ventana (`?url` + `<svelte:head>`). Es la solución general de **MEJORA-08**, probada aquí; la CSP real la deja pasar (`m-11`).
- **El color al azar** cambió el final de la ficha: no hay selector de color. Con rojas, el tablero y el teclado se dan la vuelta; los nombres de las casillas siguen siendo
  los de las blancas (a1 abajo a la izquierda de las blancas), que es la convención.
- **Las fichas salían desplazadas respecto a las casillas en el navegador de Pol** (2026-10-16, tras fusionar). Se colocaban con una transformación CSS en píxeles dentro del SVG
  escalado, y los navegadores no la interpretan igual (en Chromium y en el navegador interno se veía bien, y por eso los tests no lo vieron). Ahora se colocan con el atributo
  `transform` del SVG, y el deslizamiento se calcula en el componente. Hay un test que comprueba que cada ficha cae sobre su casilla en tres vistas y con la ventana ampliada.
  Los tests corren solo en Chromium, así que otros motores (Safari, Firefox) quedan sin probar automáticamente.
- **Las partidas ganadas o perdidas no se prueban en el navegador** con una posición preparada (no hay forma de prepararla sin meter código de prueba en la web):
  el final lo cubren los tests unitarios (`outcome`) y el aviso, con «Rendirse».
- **El recorrido de la CSP no abría las apps de juegos**: ahora abre un juego de texto, el memory y las damas.
- La prueba visual se hizo sobre el prototipo y, ya construido, en el navegador interno (escritorio y móvil).

## Fuera de esta feature

- Dos personas en el mismo dispositivo, partidas en línea o contra otras personas.
- Reglas inglesas, internacionales (10 × 10) u otras variantes, y un selector de reglas.
- Más de dos niveles, apertura con libro de jugadas o una IA en Web Worker.
- Guardar partidas, récords o estadísticas, e historial de jugadas en notación completa.
- WebGL, texturas o sonido.
- Girar el tablero en el móvil.
