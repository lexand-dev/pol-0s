# Stack (sustituye a Herramientas) y su actualización diaria

**Estado:** Verificada
**Requisitos que cierra:** M-05
**Fecha de acuerdo:** 2026-10-10

## Qué se construye

"Herramientas" pasa a llamarse **Stack** y deja de parecer un cajón de utilidades. Es una ventana con aspecto
de **ficha técnica**, como "Información del sistema" de macOS, que no tiene nada clicable:

- Arriba, un resumen: cuántos repositorios se han analizado y cuántas herramientas aparecen.
- Debajo, las herramientas de desarrollo **agrupadas por categoría** (Lenguajes, Interfaz, Escritorio, Datos y
  servidor, IA, Servicios, Publicación y Calidad). Cada una con **en cuántos repositorios aparece**, una barra
  proporcional a ese uso y **el año en que la usó por primera vez**.
- Una línea del tiempo sencilla: qué herramientas entraron cada año, desde finales de 2022.

Solo el stack de desarrollo, sin herramientas no técnicas. En el escritorio, en el menú, en móvil y en la
Terminal (`open stack`) pasa a llamarse Stack, con un icono de chip.

Los datos **se actualizan solos cada día**: una tarea de GitHub Actions analiza los repositorios de Pol,
regenera los datos y, si hay cambios, los publica directamente (la fusión en `main` despliega la web).

## Decisiones tomadas

- **Los datos son un archivo del repositorio** (`src/content/stack.json`), no una consulta en vivo: el sitio no
  depende de GitHub y se ve igual aunque GitHub caiga.
- **Un script los genera** (`scripts/actualizar-stack.mjs`). Lee de cada repositorio sus lenguajes, sus
  dependencias (`package.json`, también en `packages/*`, y `Cargo.toml`) y su año de creación, y traduce cada
  dependencia a una herramienta con un **catálogo** (`src/lib/stack-catalog.ts`): `react-dom` cuenta como React,
  `@supabase/supabase-js` como Supabase, etc. Lo que no está en el catálogo no aparece; así no salen librerías
  menores.
- **Privacidad:** de los repositorios privados solo se publican **recuentos**, nunca sus nombres. Un test lo
  comprueba sobre el archivo generado.
- **Tarea diaria** (`.github/workflows/actualizar-datos.yml`, a las 06:00 UTC y también a mano). Por decisión de
  Pol **publica directamente** si hay cambios: hace commit en `main`. Antes de publicar ejecuta los tests de
  contenido; si fallan, no publica. Aprovecha para refrescar también los datos de GitHub de los proyectos
  (`scripts/actualizar-proyectos.mjs`).
- **Un token de GitHub de solo lectura** para poder contar también los repositorios privados. Lo crea Pol
  (*fine-grained*, permiso de lectura de contenido y metadatos de sus repositorios) y lo guarda como secreto del
  repositorio (`STACK_GITHUB_TOKEN`). Nunca pasa por el chat ni por el código. Sin él, la tarea cuenta solo los
  públicos.
- **"Cada vez que creo o actualizo un repo"** se resuelve con la ejecución diaria: hacerlo al instante exigiría un
  webhook en cada repositorio.
- **Desde qué año:** el año del primer repositorio en que aparece cada herramienta.
- Los colores de las barras salen de tokens, y la información nunca depende solo del color: cada fila lleva su
  número.

## Cobertura

| Requisito | Se implementa en | Se valida con |
|-----------|------------------|---------------|
| M-05 | `src/os/apps/stack/Stack.svelte`, `src/lib/stack.ts`, `src/lib/stack-catalog.ts`, `src/content/stack.json`, `scripts/actualizar-stack.mjs`, `scripts/actualizar-proyectos.mjs`, `.github/workflows/actualizar-datos.yml`, `src/os/items.ts`, `src/os/apps/registry.ts`, `src/os/menus.ts`, `src/os/terminal/commands.ts` | `tests/e2e/m-05-stack.spec.ts`, `src/lib/stack.test.ts`, `src/lib/stack-content.test.ts`, `src/lib/workflow.test.ts`, `src/os/terminal/commands.test.ts`, `tests/csp/m-11-csp.spec.ts` |

Qué comprueba cada test, según el criterio del PRD:

- **e2e (escritorio y móvil):** el icono **Stack** abre la ventana; se ven las categorías y, en cada herramienta,
  su número de repositorios y su año; el resumen cuadra con los datos. Sin errores de accesibilidad.
  - *Negativo:* la ventana no tiene **ningún enlace ni botón** aparte de los de la propia ventana; el icono ya no
    se llama Herramientas.
- **Unitarios (`stack.test.ts`):** el catálogo traduce dependencias a herramientas (y agrupa varias en una); el
  recuento por herramienta, el año de primer uso y el resumen; lo que no está en el catálogo se ignora.
- **Contenido (`stack-content.test.ts`):** el archivo generado es válido, no contiene ningún nombre de
  repositorio privado y no tiene herramientas fuera del catálogo.
- **Tarea diaria y script:** `no verificable por interfaz: se ejecuta en GitHub con un token de Pol y lee la API
  de GitHub`. Se comprueba lanzando el script en local una vez (salida en el PR) y, tras la fusión, lanzando la
  tarea a mano desde la pestaña Actions y comprobando que su commit llega a `main`.

## Fuera de esta feature

- Herramientas no técnicas (Figma, Notion, editores).
- Logos de cada herramienta: solo texto, como manda `CLAUDE.md`.
- Un "para qué la uso" por herramienta: se puede añadir después a mano en el catálogo.
- Actualizar al instante con cada `push` (webhooks).

## Hallazgos al construir

- **"Claude Code desde 2023" era falso.** El año que se calculaba era el de creación del repositorio, y un repo de 2023 puede
  haber recibido un `CLAUDE.md` en 2026. El catálogo lleva ahora el año de lanzamiento (`introduced`) y el año mostrado nunca
  es anterior; un test lo cubre.
- **Los recuentos grandes vienen de los repositorios que nacieron de un generador** (React, Tailwind, shadcn/ui, Radix,
  TanStack, Zod y ESLint salen en 70 a 117 repositorios, casi todos de plantilla). No lo escondo: la ventana lo dice en una
  nota, que Pol puede quitar o reformular.
- **Sin token, la tarea publicaría números recortados** (36 repositorios en vez de 182). El script se niega a escribir si antes
  había repositorios privados y ahora no, y la tarea falla en lugar de publicar. También hace que el script de proyectos
  use el token: las IP compartidas de Actions agotan enseguida el límite anónimo.
- **Un scroll sin foco no pasa la accesibilidad:** la ficha es una región con nombre y `tabindex="0"` para desplazarla con
  el teclado; dentro no hay nada que enfocar.
- Se renombró la app `tools` por `stack` en el registro, los iconos, los menús, la Terminal (`open stack`, y `herramientas` y
  `tools` siguen funcionando como alias) y los tests.
- El análisis cuenta 182 repositorios sin forks (36 públicos y 146 privados); el perfil de GitHub de Pol dice 172, porque
  él midió en otro momento y descontó otros.
- **La home superó el presupuesto de JavaScript** (134 KB sin comprimir frente al límite de 130 de S-06) con todo lo que se fue
  añadiendo. Sobre mí, Proyectos y Stack se cargan ahora al abrirlas: es lo que la ficha de SEO dejó anotado ("las apps cargan
  su código cuando se abren; se revisa cuando cada una tenga contenido real").
- Al ser Stack una ventana mayor (620 × 600), un test de `m-02` que pulsaba la barra de título de la ventana de atrás ya no la
  alcanzaba (la nueva la tapa); ahora pulsa la franja que queda a la vista.

