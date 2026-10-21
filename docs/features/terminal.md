# Terminal

**Estado:** Verificada
**Requisitos que cierra:** S-04
**Fecha de acuerdo:** 2026-10-10

## Qué se construye

La app Terminal deja de ser un estado vacío. Es una terminal de mentira, siempre oscura, con el aviso
`pol@pol-os ~ %`, donde se escriben comandos y se ve su salida. Sirve para que un desarrollador
recorra Pol OS a su manera y para esconder algún detalle de humor. **No ejecuta nada de verdad**: no hay
servidor, ni `eval`, ni red. Cada comando es una función del propio sitio.

**Comandos visibles** (los que enseña `help`):

| Comando | Qué hace |
|---|---|
| `help` | La lista de comandos |
| `about` | Quién es Pol, con sus enlaces. Solo hechos ya públicos |
| `projects` | Los proyectos de la colección, con su descripción |
| `open <algo>` | Abre un proyecto (`open planito`) o una app (`open mail`, `open cv`, `open ajustes`…) |
| `ls` | Lo que hay en el escritorio |
| `social` | Los tres enlaces (se pueden pulsar) |
| `contact` | Abre Correo |
| `theme <claro\|oscuro\|auto>` y `wallpaper <atardecer\|mar\|grafito\|alba>` | Igual que Ajustes |
| `neofetch` | Información del sistema, con el logo en ASCII |
| `history`, `clear`, `date`, `whoami`, `echo <texto>`, `exit`, `lock` | Lo de siempre. `exit` cierra la ventana y `lock` bloquea la pantalla |

**Escondidos** (no salen en `help`, que lo avisa con una línea): `sudo`, `rm`, `vim`/`nano`, `catan`,
`cowsay <texto>`, `make coffee`.

**Cómo se maneja:** Enter ejecuta. Flecha arriba y abajo recorren el historial. **Tab completa**
comandos y argumentos (proyectos, apps, temas, fondos). Ctrl+L limpia y Ctrl+C cancela la línea. Un
comando que no existe responde "comando no encontrado" y, si se parece a uno real, sugiere cuál
(`projcts` → "¿Quisiste decir `projects`?"). Un clic en cualquier punto de la ventana enfoca la línea.
Funciona igual en móvil, con el teclado del teléfono.

## Decisiones tomadas

- **Cada comando es una función pura** en `src/os/terminal/commands.ts`: recibe el texto y el estado
  (proyectos, tema, hora) y devuelve las líneas de salida y las acciones que provoca (abrir una app,
  cambiar el tema). El componente solo pinta. Se prueba entera sin navegador.
- **La salida son segmentos de texto, nunca HTML.** Un enlace es un segmento con `href`, y solo se admiten
  `https://` de la lista de enlaces del sitio. Un `echo <img onerror=…>` se ve como texto. Es la defensa
  contra inyección.
- **Las acciones usan el mismo despachador que los menús** (`Action`): `open`, `theme`, `wallpaper`,
  `lock`, cerrar ventana. Así `theme oscuro` hace exactamente lo mismo que Visualización → Oscuro.
- **Fuente del sistema, sin cargar nada.** Se usa `ui-monospace, "SF Mono", Menlo, Consolas`: en Mac sale la
  de Apple. No se carga JetBrains Mono (que figuraba en el diseño): ahorra una petición y no obliga a
  ampliar la CSP. Se corrige `docs/design-system.md`.
- **`about` solo dice lo que ya es público** (nombre y enlaces). No describe su trabajo mientras ese
  dato siga pendiente, igual que la imagen para compartir.
- **Límites:** una línea admite hasta 200 caracteres, el historial guarda 100 comandos y la pantalla
  conserva las últimas 500 líneas.
- **Arreglo previo que esta app necesita, y que afecta a las demás: las ventanas minimizadas ya no
  se desmontan.** Hoy, al minimizar, la ventana desaparece del documento y al recuperarla empieza de
  cero: la Terminal perdería su historial y **Correo perdería un mensaje a medio escribir** (es un fallo
  que ya existe). Pasan a quedar ocultas (`display: none`) con su estado intacto. Cambian los tests que
  esperaban que desaparecieran.
- **Accesibilidad:** la salida es una región `role="log"` con `aria-live="polite"`; la línea tiene
  etiqueta "Comando"; los colores de la terminal (texto, acento, apagado y enlaces) cumplen 4,5:1 sobre su
  fondo y se definen como tokens.
- **El humor se limita a lo que ya sabemos.** `catan` no promete nada ("todavía no existe"): el juego es un
  COULD (C-02).

## Cobertura

| Requisito | Se implementa en | Se valida con |
|-----------|------------------|---------------|
| S-04 | `src/os/terminal/commands.ts`, `src/os/apps/terminal/Terminal.svelte`, `src/os/stores/os-actions.ts`, `src/os/windows/Window.svelte`, `src/os/shell/Desktop.svelte`, `src/os/OS.svelte`, `src/styles/tokens.css` | `tests/e2e/s-04-terminal.spec.ts`, `src/os/terminal/commands.test.ts`, `tests/csp/m-11-csp.spec.ts` |

Qué comprueba cada test, según el criterio del PRD:

- **e2e (escritorio y móvil):**
  - Abrir Terminal desde el dock muestra el aviso y una línea enfocada; `help` lista los comandos; `about`
    y `projects` muestran su salida (un proyecto por cada uno de la colección).
  - `open planito` abre el Navegador en ese proyecto, `open mail` abre Correo, `theme oscuro` cambia el
    tema (y coincide con Ajustes), `wallpaper mar` cambia el fondo, `lock` bloquea y `exit` cierra la ventana.
  - Flecha arriba y abajo recuperan comandos; Tab completa; Ctrl+L limpia; `clear` también.
  - `social` muestra tres enlaces con `target="_blank"`.
  - **Una ventana minimizada conserva su historial al recuperarla**, y **un mensaje a medio escribir en
    Correo sigue ahí tras minimizar y recuperar**.
  - *Negativos:* un comando que no existe da "comando no encontrado" y la pista de `help`; `projcts` sugiere
    `projects`; `echo <img src=x onerror=…>` se ve como texto, sin crear ningún elemento ni ejecutar nada; una
    línea de más de 200 caracteres se rechaza; `sudo` y `rm` responden sin hacer nada. Sin errores de
    accesibilidad con la terminal abierta.
- **Unitarios de `commands.ts`:** cada comando con su salida y sus acciones; los argumentos (`open` por id,
  por nombre y por alias; `theme` con cada valor y con uno inválido); el autocompletado; las sugerencias; los
  límites; y que **ninguna salida contiene HTML ni enlaces que no sean `https://`**.
- **CSP (`pnpm test:csp`):** el recorrido de la terminal (escribir, ejecutar, `neofetch`) sin ninguna violación.

**Lo que no se comprueba aquí:** el teclado virtual de un móvil real (el comportamiento al escribir con él). El
test móvil usa un viewport táctil, no un teléfono. Se prueba a mano una vez.

## Fuera de esta feature

- Sistema de archivos, `cd`, `cat`, tuberías, redirecciones, variables y alias: es una terminal de mentira.
- Guardar el historial entre visitas.
- Colores o fuente elegibles.
- Un `cat` de las notas: llega con S-01.
- Comandos que dependan de contenido que Pol aún no ha decidido (su cargo, sus herramientas).
