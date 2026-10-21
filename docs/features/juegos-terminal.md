# Juegos de la Terminal

**Estado:** Verificada
**Requisitos que cierra:** S-04 (huevos de Pascua de la Terminal)
**Fecha de acuerdo:** 2026-10-16

## Qué se construye

Tres minijuegos de texto dentro de la Terminal, para quien la abra y tenga curiosidad. No hay ninguna app ni ningún icono nuevo en el escritorio: se juega escribiendo.

- **`juegos`** enseña la lista de los tres y cómo empezar (esa lista ya viene con el código de los juegos). Es la única línea nueva de `help` («juegos — tres minijuegos para pasar el rato»); los juegos en sí no salen en `help`.
- **`wordle`:** adivinar una palabra de cinco letras en seis intentos. Cada intento se pinta letra a letra: **en su sitio**, **está pero en otro sitio** o **no está**. Las palabras son
  del mundo de Pol (tecnología, producto, sus proyectos), en español.
- **`ahorcado`:** adivinar una palabra letra a letra antes de seis fallos, con el muñeco dibujado con caracteres. Mismas fuentes de palabras, de longitud variable.
- **`adivina`:** Pol piensa un número del 1 al 100 y el visitante tiene siete intentos, con pistas de «más alto» o «más bajo».

Mientras se juega, la Terminal cambia el aviso (`wordle>` en vez de `pol@pol-os ~ %`) y lo que se escribe va al juego. **`salir`** o **Ctrl+C** terminan la partida y devuelven la
Terminal normal; al acabar (ganando o perdiendo) se enseña la solución y cómo volver a jugar. Funciona igual en el escritorio y en el móvil.

## Decisiones tomadas

- **Dentro de la Terminal, no como app nueva.** Una app más metería su CSS en la home, que ya está en su tope de 12 peticiones (MEJORA-08). Aquí la home no cambia.
- **El código de los juegos se carga al escribir el comando**, en un trozo aparte del de la Terminal (`import()` dinámico). Quien no juega no lo descarga. Objetivo: menos de 10 KB sin
  comprimir para los tres juegos con sus listas de palabras; se mide en el build.
- **Cada juego es una máquina de estados pura** (`empezar` → estado y líneas; `jugar(estado, texto)` → nuevo estado, líneas y si ha terminado), igual que los comandos actuales: sin `eval`,
  sin red y sin HTML en la salida. La Terminal solo guarda el estado de la partida en curso.
- **El azar se inyecta**, para que los tests elijan la palabra o el número; en la web sale de `crypto.getRandomValues`.
- **Wordle acepta cualquier palabra de cinco letras**, sin diccionario completo: un diccionario pesaría cientos de KB. Solo se rechaza lo que no son cinco letras.
- **Las tildes no cuentan** (`acción` = `accion`); la **ñ** sí es una letra propia.
- **El color no es la única pista** en Wordle: cada letra lleva además una marca de texto (por ejemplo `[A]` en su sitio, `(B)` en otro sitio, `·c·` no está) y la línea tiene un texto
  accesible con el resultado. Dos tonos nuevos de la Terminal (`hit` y `near`) con contraste de 4,5:1 sobre su fondo.
- **Una partida nueva cada vez**, con palabra al azar; no hay «palabra del día» ni estadísticas guardadas.
- **Las jugadas no entran en el historial** de comandos (las flechas siguen recorriendo comandos, no letras sueltas).
- **Las listas de palabras las redacto yo y las revisa Pol** antes de cerrar: unas 60 para Wordle y unas 40 para el ahorcado.

## Cobertura

| Requisito | Se implementa en | Se valida con |
|-----------|------------------|---------------|
| S-04 | `juegos` en `help` y la lista de juegos: `src/os/terminal/commands.ts`, `src/os/terminal/games/games.ts` | `src/os/terminal/commands.test.ts`, `src/os/terminal/games/games.test.ts`, `tests/e2e/s-04-juegos.spec.ts` |
| S-04 | Wordle, ahorcado y adivina como máquinas de estados puras: `src/os/terminal/games/games.ts`, `src/os/terminal/games/words.ts` | `src/os/terminal/games/games.test.ts` |
| S-04 | Modo partida en la Terminal (aviso, `salir`, Ctrl+C, historial sin jugadas) y carga bajo demanda: `src/os/apps/terminal/Terminal.svelte`, `src/os/apps/AppView.svelte` | `tests/e2e/s-04-juegos.spec.ts` |
| S-04 | Wordle sin depender solo del color (marcas de texto y tonos con contraste): `src/os/terminal/games/games.ts`, `src/styles/tokens.css`, `src/styles/global.css` | `src/os/terminal/games/games.test.ts`, `tests/e2e/s-04-juegos.spec.ts` |
| S-04 | La home no carga los juegos y sigue dentro de su presupuesto: `astro.config.mjs` (`preload-helper` en `os-shared`) | `tests/csp/s-06-rendimiento.spec.ts`, `tests/e2e/s-04-juegos.spec.ts` |
| S-04 | Que las listas de palabras sean adecuadas | no verificable por interfaz: es una cuestión de criterio; Pol revisa las listas antes de cerrar la feature |

Qué comprobará cada test, según el criterio del PRD:

- **Unitarios (`games.test.ts`):** con el azar fijado, Wordle pinta bien letras repetidas (una letra que sale una vez en la solución y dos en el intento solo se marca una vez), gana al acertar y
  pierde al sexto fallo; el ahorcado descubre todas las apariciones de una letra, no cuenta dos veces la misma letra fallada y pierde al sexto fallo; adivina da «más alto» o «más bajo», gana
  y pierde al séptimo intento. Todas las palabras de las listas son válidas (longitud, solo letras) y no se repiten.
  - *Negativo:* entradas inválidas (vacío, cifras en Wordle, varias letras en el ahorcado, un número fuera de 1–100 o texto en adivina) dan un aviso y **no gastan intento**.
- **e2e (escritorio y móvil, con axe):** `help` enseña `juegos` sin descargar los juegos; `juegos` lista los tres; se juega una partida de cada uno hasta ganar y hasta perder (con la solución fijada desde el test); el aviso cambia
  durante la partida; `salir` y Ctrl+C la terminan; la flecha arriba recupera el último comando y no una jugada; antes de escribir `juegos` o un juego no se pide su código.
  - *Negativo:* escribir `wordle` estando ya en una partida no la reinicia sin avisar; un comando de la Terminal (`help`) durante la partida se trata como jugada inválida y recuerda cómo salir.

## Hallazgos al construir

- **La home se pasaba de su presupuesto de JavaScript** (130,9 KB frente a 130): la Terminal iba en el paquete inicial, así que todo lo que se le añadía pesaba en la home.
  Se probó primero a sacar a `games/` la lista de `juegos` y a recortar la Terminal, y no bastó (seguía en unos 130,4 KB). La solución fue **cargar la Terminal bajo
  demanda**, como las demás apps, con sus estilos movidos a `global.css` bajo `.term` para no añadir una petición de CSS. Además, la ayuda de Vite para importaciones
  dinámicas se agrupó en `os-shared`, porque se había ido a su propio archivo (13 peticiones). Resultado: la home baja a unos 117 KB y sigue en 12 peticiones.
- **La salida de la Terminal no era accesible con el teclado** cuando una partida la hacía desplazable (axe: `scrollable-region-focusable`): ahora es enfocable.
- `juegos` también descarga el código de los juegos, porque la lista vive ahí; lo que no lo descarga es abrir la Terminal ni escribir `help`.
- **Lo que se escribía mientras se descargaba el juego se tomaba por un comando** (visto a ojo en el navegador): ahora la línea espera a que el juego cargue. Lo cubre un test que retrasa la descarga.
- Los alias en inglés (`hangman`, `guess`) se quitaron para no pesar en la home; no estaban en la ficha.

## Cambios posteriores

- **2026-10-16:** `ahorcado` y `adivina` pasan a llamarse **`hangman`** y **`guess`** (decisión de Pol: los comandos de la Terminal van en inglés). Los nombres en español siguen funcionando, escondidos; los textos de los juegos siguen en español.
- **2026-10-16:** el comando de la lista pasa de `juegos` a **`minigames`** (decisión de Pol): `juegos` y `games` ya abrían los videojuegos de Favoritos con `open`. Se cambió con el memory (C-05).

## Fuera de esta feature

- Snake, 2048, Buscaminas o cualquier juego con tablero o tiempo real (necesitarían controles táctiles o una app propia).
- Una app «Juegos» en el escritorio (pendiente de MEJORA-08) y el Catán como proyecto independiente.
- Palabra del día, estadísticas, rachas o compartir resultados.
- Un diccionario completo para validar las palabras de Wordle.
