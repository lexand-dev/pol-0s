# pol-os-template

Una plantilla de portfolio con forma de **sistema operativo de escritorio en el navegador**: pantalla de acceso, ventanas,
dock, Terminal con minijuegos, proyectos que se abren en un navegador interno, el CV como documento, notas con su página
pública, un Libro de visitas y un correo que llega de verdad.

Nace de **[Pol OS](https://polmarza.com)**, el portfolio de Pol Marzà. Esta copia trae el mismo sistema con el contenido de
una persona ficticia, Álex Ejemplo, para que cambies los datos y lo publiques como tuyo.

![El escritorio de la plantilla: iconos a la derecha, el dock abajo y la barra de menú arriba](.github/capturas/escritorio.webp)

| | |
|---|---|
| ![Un proyecto abierto dentro del Navegador del escritorio](.github/capturas/navegador.webp) | ![Las damas en 3D, abiertas desde la Terminal](.github/capturas/terminal-damas.webp) |
| ![Una nota en modo oscuro](.github/capturas/nota.webp) | ![La pantalla de inicio en el móvil](.github/capturas/movil.webp) |

## Qué hay dentro

- **Proyectos**: una carpeta con tus proyectos, su detalle, capturas (también GIF) y un **Navegador** interno que los abre en una ventana.
- **Mi CV**: tu currículum como documento, con su PDF descargable generado a partir del mismo texto.
- **Notas**: una carpeta de entradas en Markdown. Cada una tiene además su página pública, con vista previa al compartir, para que Google la encuentre.
- **Correo**: un formulario con forma de cliente de correo que te llega de verdad (Cloudflare Email Service, con anti-bots y límite de envíos). No guarda nada.
- **Libro de visitas**: reseñas que pasan por la confirmación del correo de su autor y por tu aprobación, sin base de datos.
- **Favoritos**: tu top de videojuegos, películas, libros y música, con un mini reproductor de YouTube.
- **Stack** y **GitHub**: tus herramientas y tus repositorios destacados (los que llevan el topic `showcase`), calculados desde GitHub por una tarea programada.
- **Terminal**: comandos, huevos de Pascua y `minigames` (Wordle, ahorcado, adivina el número, `memory` y `checkers`, damas en 3D contra la máquina).
- **Ajustes**: tema claro u oscuro, fondo de pantalla y tamaño del texto.
- **Cómo está hecho**: un documento que explica el sistema por dentro.
- **En el móvil**, una pantalla de inicio estilo iOS con el mismo contenido.

Sin cuentas ni base de datos: el contenido vive en el repositorio y cada cambio es un commit.

## Hazlo tuyo

1. **Crea tu copia**: botón *Use this template* de GitHub (o haz un fork) y clónala.
2. **Instala** (Node 22.12 o superior, pnpm 11 y Google Chrome para las pruebas):
   ```bash
   pnpm install
   cp .dev.vars.example .dev.vars   # valores de prueba: en local, el correo no sale de tu máquina
   pnpm dev                          # http://localhost:4321
   ```
3. **Tus datos**, todos en `src/content/`:

   | Archivo | Qué es |
   |---------|--------|
   | `persona.ts` | Tu nombre, el nombre del sistema («Álex OS»), tu web, tu usuario de GitHub y tu newsletter (o `null`) |
   | `links.ts` | Los accesos directos del escritorio: GitHub, LinkedIn y WhatsApp (cambia el número o quita el acceso) |
   | `sobre-mi.md` | Tu CV |
   | `projects/*.json` | Un archivo por proyecto. Sus capturas van en `public/projects/<proyecto>/` |
   | `notes/*.md` | Tus notas. Las cuatro de ejemplo explican cómo funciona la plantilla |
   | `favorites/*.json` | Tus favoritos. Las portadas, en `public/favoritos/<sección>/` |
   | `guestbook/*.json` | Las reseñas aprobadas (las de ejemplo son inventadas: bórralas) |
   | `como-esta-hecho.md` | El documento «Cómo está hecho» |

   Tu foto va en `src/assets/foto.webp`.
4. **Genera las imágenes** (necesitan Google Chrome):
   ```bash
   node scripts/generar-cv.mjs                 # el PDF del CV, desde sobre-mi.md
   node scripts/generar-imagenes.mjs           # iconos e imagen para compartir, con tu foto y tu nombre
   node scripts/generar-portadas-ejemplo.mjs   # portadas de ejemplo para los favoritos que aún no tengan la suya
   ```
5. **Publica** en Cloudflare: la guía paso a paso está en [`docs/despliegue.md`](docs/despliegue.md). Cambia antes
   `SITE_URL` y el remitente (`CONTACT_FROM`) en `wrangler.jsonc`.

Para que el Stack y la ventana GitHub se rellenen solos, lanza la tarea **Actions → Actualizar datos** (o activa su horario
diario en `.github/workflows/actualizar-datos.yml`). Para destacar un repositorio en la ventana GitHub, añádele el topic
`showcase`.

## Comandos

```bash
pnpm dev          # servidor local
pnpm check        # tipos de Cloudflare y comprobación de tipos
pnpm test         # pruebas unitarias
pnpm test:e2e     # pruebas en Chrome, escritorio y móvil (E2E_PORT=4323 si el 4321 está ocupado)
pnpm test:csp     # cabeceras de seguridad contra la compilación (sin `pnpm dev` abierto)
pnpm build        # compila el sitio
```

## Stack

Astro 7 con una isla de Svelte 5, en Cloudflare Workers con activos estáticos. El Correo y el Libro de visitas usan
Cloudflare Email Service, Turnstile y límites de frecuencia. TypeScript estricto, Vitest y Playwright.
El detalle y el porqué de cada decisión están en [`docs/architecture.md`](docs/architecture.md).

## El método

Pol OS se construyó con un agente de código (Claude Code) y un método: nada se programa sin acordar antes qué se
construye y con qué prueba se demostrará cada requisito. Se ve en el repositorio:

- [`docs/`](docs): el PRD (requisitos por prioridad MoSCoW), la arquitectura, el sistema de diseño y la estrategia de pruebas.
  Son los documentos de Pol OS: déjalos como ejemplo o reescríbelos para tu proyecto.
- [`docs/features/`](docs/features): una ficha por cada funcionalidad, con su tabla de cobertura. `node scripts/verificar-cobertura.mjs`
  comprueba que ningún requisito se quede sin su test, y un workflow lo vigila en cada pull request.
- [`CLAUDE.md`](CLAUDE.md) y [`.claude/skills/`](.claude/skills): las reglas y los procedimientos que sigue el agente.

El método completo, como plantilla para cualquier proyecto, está en [project-template](https://github.com/polmarza/project-template).

## Créditos del contenido de ejemplo

- Películas: *Big Buck Bunny*, *Sintel*, *Tears of Steel*, *Spring* y *Charge*, películas abiertas de la
  [Blender Foundation](https://studio.blender.org/films/) (CC BY).
- Música: temas de [Kevin MacLeod](https://incompetech.com) (CC BY).
- Los videojuegos y libros de Favoritos solo se nombran; sus portadas son de ejemplo, generadas por `scripts/generar-portadas-ejemplo.mjs`.

## Licencia

MIT, de [Pol Marzà](https://polmarza.com). Ver [`LICENSE`](LICENSE).
