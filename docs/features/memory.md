# Memory con las herramientas del Stack

**Estado:** Verificada
**Requisitos que cierra:** C-05 (nuevo; se añade al PRD con esta ficha)
**Fecha de acuerdo:** 2026-10-16

## Qué se construye

Un memory clásico con los logos de las herramientas que Pol usa de verdad: **16 cartas boca abajo, 8 parejas**. Se levantan de dos en dos; si son pareja, se quedan
a la vista y debajo del logo aparece su **nombre** (TypeScript, Svelte, Supabase…), y si no, se vuelven a tapar. Arriba, los **movimientos** y las parejas encontradas. Al
completarlo, un mensaje con los movimientos y un botón **«Jugar otra»**, que baraja con otras herramientas.

- **Las cartas salen del Stack:** cada partida elige 8 al azar entre las herramientas de `stack.json` que tienen logo, así que el juego cambia cuando cambia el Stack.
  De las 39 de hoy, `simple-icons` tiene logo para la mayoría. No lo tienen OpenAI, Liveblocks ni Playwright, y otras no tienen uno propio: SQL, «HTML y CSS», o Vercel AI, que repetiría el de Vercel. Quedan unas 32.
- **Se abre desde la Terminal:** `memory`, y aparece en la lista de `minigames` junto a `wordle`, `hangman` y `guess`. No tiene icono en el escritorio, para que siga siendo un
  extra discreto. En el escritorio es una ventana de unos 480 × 600; en el móvil, a pantalla completa como las demás apps, con la cuadrícula de 4 × 4 ajustada al ancho.
- **Con teclado:** cada carta es un botón. Tab las recorre, las flechas se mueven por la cuadrícula y Enter o espacio la levantan. El lector de pantalla oye «Carta 3,
  boca abajo», «Carta 3: Svelte» y si ha sido pareja.

## Decisiones tomadas

- **Una app pequeña, no otro juego de texto:** un memory necesita ver la cuadrícula, y en la Terminal no se podría jugar en el móvil.
- **Sin icono en el escritorio** (se abre con `memory` en la Terminal): los juegos son un extra, el escritorio es para conocer a Pol.
- **Sus estilos van en `global.css` bajo su clase raíz**, como la Terminal, para que la home no sume una petición de CSS (MEJORA-08). El código y los logos se descargan al abrirlo.
- **Los logos son los de `simple-icons`** (licencia CC0), igual que en «Cómo está hecho»: monocromos, del color del texto, y se importan uno a uno por su nombre, así que
  solo entran los que se usan. Un catálogo nuevo (`src/lib/memory-logos.ts`) dice qué herramienta del Stack lleva qué logo; las que no tienen logo en esa colección
  (por ejemplo, OpenAI o Playwright) o que no tienen uno propio (SQL, «HTML y CSS») no salen en el juego, porque una carta con iniciales sería demasiado fácil.
- **Monocromos y no con el color de cada marca:** se ven igual de bien en los dos temas y obligan a fijarse en la forma, que es el juego.
- **La lógica es pura** (barajar, levantar, comprobar pareja, contar movimientos) en `src/lib/memory.ts`, con el azar inyectado para poder probarla. La ventana solo la pinta.
- **Un movimiento es levantar dos cartas.** Si no son pareja se tapan tras un segundo; con movimiento reducido, sin animación de giro.
- **Nada se guarda:** ni récord ni partidas a medias. Cerrar la ventana termina la partida.
- **Depende del PR de los juegos de la Terminal** (`minigames`, Terminal bajo demanda y el patrón de estilos globales): se construye cuando esté fusionado.

## Cobertura

| Requisito | Se implementa en | Se valida con |
|-----------|------------------|---------------|
| C-05 | Lógica del juego (barajar, parejas, movimientos, final): `src/lib/memory.ts` | `src/lib/memory.test.ts` |
| C-05 | Cartas a partir del Stack con su logo (solo logos reconocibles, más GitHub): `src/lib/memory-logos.ts`, `src/content/stack.json` | `src/lib/memory.test.ts` |
| C-05 | La ventana, la cuadrícula y el teclado: `src/os/apps/memory/Memory.svelte`, `src/os/apps/registry.ts`, `src/os/apps/AppView.svelte`, `src/styles/global.css` | `tests/e2e/c-05-memory.spec.ts` |
| C-05 | Se abre con `memory` y sale en `minigames`: `src/os/terminal/commands.ts`, `src/os/terminal/games/games.ts` | `src/os/terminal/commands.test.ts`, `tests/e2e/c-05-memory.spec.ts` |
| C-05 | La home no carga el juego ni sube de peticiones | `tests/csp/s-06-rendimiento.spec.ts`, `tests/e2e/c-05-memory.spec.ts` |

Qué comprobará cada test, según el criterio del PRD:

- **Unitarios (`memory.test.ts`):** con el azar fijado, se reparten 16 cartas con 8 parejas distintas; dos iguales quedan descubiertas y suman pareja; dos distintas cuentan movimiento y
  se tapan; al completar las 8 se acaba con los movimientos justos; cada herramienta del catálogo de logos existe en el Stack y tiene logo; hay al menos 8 para repartir.
  - *Negativo:* levantar una carta ya descubierta, la misma carta dos veces o una tercera con dos levantadas no hace nada ni cuenta movimiento.
- **e2e (escritorio y móvil, con axe en claro y oscuro):** `memory` abre la ventana con 16 cartas boca abajo; una partida completa hasta el final (con el azar fijado desde el test) con su
  mensaje y «Jugar otra»; una pareja enseña el nombre; un fallo se vuelve a tapar; con el teclado (flechas y Enter) se juega; en el móvil la cuadrícula cabe sin desbordar y cada carta mide
  al menos 44 px; antes de abrirlo no se pide su código.
  - *Negativo:* una tercera carta no se levanta mientras hay dos sin pareja a la vista.

## Hallazgos al construir

- **Cambio pedido por Pol a mitad (2026-10-16): solo logos reconocibles, más grandes.** El logo de GitHub Actions no se entendía. El catálogo pasa de 33 logos
  a 19 conocidos (TypeScript, JavaScript, HTML, Python, Rust, Swift, React, Tailwind, Vite, Next.js, Astro, Svelte, Supabase, Cloudflare, Claude, Anthropic, Stripe,
  Vercel y GitHub). **GitHub entra como extra** aunque no esté en el Stack, que cuenta dependencias y no dónde vive el código. El logo ocupa ahora el 66 % de la carta (antes, el 52 %).
- **El comando de la lista se llama `minigames`**, no `juegos`: `juegos` y `games` ya abren los videojuegos de Favoritos con `open`. `memory` no choca con nada.
- **La línea de estado decía el nombre de la carta levantada** antes de emparejarla, y eso era una pista. Ahora lo visible solo dice «No son pareja.» y el nombre lo oye
  solo el lector de pantalla.
- Algunos trazos de `simple-icons` empiezan por `m` minúscula: el test de los logos lo admite.

## Cambios posteriores

- **2026-10-16, estilo «Línea»** (Pol eligió entre tres propuestas en un prototipo). Las cartas levantadas van sin fondo, solo con un filo; el dorso lleva una trama de puntos.
  También se acortan los nombres largos para que quepan («SDK de Anthropic» → «Anthropic», «Cloudflare Workers» → «Cloudflare») y el resultado final sale una sola vez.

## Fuera de esta feature

- Icono en el escritorio o en la pantalla de inicio del móvil, y un botón en la ventana del Stack.
- Niveles de dificultad, tableros más grandes, cronómetro o récords guardados.
- Logos a color de cada marca, o cartas con iniciales para las herramientas sin logo.
- Multijugador o partidas compartidas.
