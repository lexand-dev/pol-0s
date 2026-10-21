# Ajustes

**Estado:** Verificada
**Requisitos que cierra:** M-09
**Fecha de acuerdo:** 2026-10-10

## Qué se construye

La app Ajustes deja de ser un estado vacío. Se abre desde el dock (en escritorio y en móvil) y
desde el menú de Pol OS, y tiene dos secciones:

- **Apariencia:** Claro, Oscuro o Automático (sigue al sistema), con una miniatura de cada opción.
- **Fondo de pantalla:** Atardecer, Mar, Grafito y Alba, los cuatro degradados del prototipo.

Al elegir una opción, el escritorio cambia en el momento, sin recargar. La elección se guarda en
el navegador del visitante: si recarga o vuelve otro día, la encuentra igual. Debajo hay una nota
que dice que los ajustes se guardan solo en este navegador.

La barra de menú gana el conmutador rápido de tema (sol o luna), como en el prototipo. Usa la
misma preferencia que Ajustes.

## Decisiones tomadas

- Las preferencias viven en `localStorage` con la clave `polos.prefs`. Toda lectura y escritura va
  en `try/catch`. Si el almacenamiento está bloqueado, se usan los valores por defecto (Automático y
  Atardecer) y el cambio funciona igualmente durante la visita, sin errores.
- Los valores leídos se validan: un tema o un fondo que no existe vuelve al valor por defecto.
- El tema y el fondo se aplican como atributos de `<html>` (`data-theme`, `data-wall`). Un script
  mínimo en el `<head>` los aplica antes de pintar la página, para que no parpadee el tema ni el
  fondo al cargar (también en la pantalla de acceso). Cuando se añada la CSP (`public/_headers`),
  ese script necesitará su hash; queda anotado en `docs/architecture.md`.
- "Automático" quita `data-theme` y deja que mande `prefers-color-scheme`, que es como ya
  funcionan los tokens.
- Los fondos siguen siendo degradados CSS, sin imágenes, y siguen siendo provisionales.

Decisiones que salieron durante la construcción:

- Cada fondo es una variable CSS (`--wall-atardecer`, `--wall-mar`…) en `src/styles/global.css`;
  `data-wall` elige cuál va en `--wallpaper`. Así las miniaturas de Ajustes pintan el mismo
  degradado que el escritorio.
- El script del `<head>` se genera desde `src/lib/prefs.ts` (`PREFS_BOOT_SCRIPT`), con las mismas
  listas de temas y fondos válidos: no hay reglas duplicadas a mano.
- El estado compartido vive en `src/os/stores/prefs.svelte.ts`; lo usan Ajustes y la barra de menú.
- Ajustes también se abre desde el menú de Pol OS ("Ajustes…").

## Cobertura

| Requisito | Se implementa en | Se valida con |
|-----------|------------------|---------------|
| M-09 | `src/os/apps/Settings.svelte`, `src/lib/prefs.ts`, `src/layouts/Base.astro` | `tests/e2e/m-09-ajustes.spec.ts`, `src/lib/prefs.test.ts` |

Qué comprueba cada test, según el criterio del PRD:

- **e2e (escritorio y móvil):** elegir Oscuro pone `data-theme="dark"` y cambia el color de fondo
  de las ventanas; elegir Mar cambia el fondo de pantalla; tras recargar y volver a entrar, ambas
  elecciones siguen ahí; Automático quita `data-theme`. El conmutador de la barra de menú alterna
  el tema. *Negativo:* con `localStorage` bloqueado, la página carga sin errores en consola,
  Ajustes muestra Automático y Atardecer, y cambiar el tema sigue funcionando en la visita.
- **Unitario:** lectura con almacenamiento vacío, bloqueado (lanza excepción) y con valores
  inválidos; escritura que no rompe si el almacenamiento falla.

## Fuera de esta feature

- Fondos de pantalla definitivos o con imagen (`mejoras/backlog.md`, MEJORA-04).
- Otros ajustes (tamaño de iconos, sonido, idioma).
- La CSP en `public/_headers`: llega con el endpoint de contacto (M-08).
