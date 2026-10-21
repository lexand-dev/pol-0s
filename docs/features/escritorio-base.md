# Escritorio base

**Estado:** Verificada
**Requisitos que cierra:** M-01, M-02, M-03, M-07
**Fecha de acuerdo:** 2026-10-10

## Qué se construye

El esqueleto de Pol OS funcionando en local. El visitante abre la home y ve la pantalla de acceso:
fecha y hora grandes, avatar con las iniciales de Pol, su nombre y el campo de contraseña relleno
de puntos. Con un clic o con Enter entra al escritorio.

En pantallas anchas, el escritorio tiene barra de menú de cristal, dock con las apps del sistema
(Navegador, Correo, Notas, Terminal y Ajustes), fondo de pantalla e iconos de contenido en
columnas desde la derecha: uno por proyecto, Sobre mí, la carpeta Notas, Herramientas y los
accesos directos a la newsletter, GitHub y LinkedIn. Un clic selecciona y doble clic abre. Las
ventanas se mueven, se redimensionan, se amplían, se cierran y se traen al frente, y la barra de
título nunca sale de la pantalla. Los accesos directos externos (newsletter, GitHub y LinkedIn) abren su web en una pestaña nueva.

Por debajo de 768px el visitante ve la pantalla de inicio estilo iOS: rejilla de iconos,
carpetas Proyectos y Notas, y dock inferior. Cada elemento se abre a pantalla completa con un botón
"Inicio" para volver. Si el ancho cambia con algo abierto, lo abierto se conserva.

Las apps todavía no tienen contenido propio: cada ventana muestra un estado vacío que dice que la
app llega en una próxima feature. El contenido de cada una es el de sus requisitos (M-04 a M-10).

## Decisiones tomadas

- Se monta el proyecto desde cero: Astro con `@astrojs/cloudflare`, Svelte 5, TypeScript estricto,
  Vitest y Playwright, con pnpm v11. Así lo fija `docs/architecture.md`.
- Las versiones exactas de Astro, Svelte y el adaptador se eligen al montar el proyecto, a partir
  de la documentación oficial. Se anotan en el changelog.
- Los tokens de color, radio y sombra salen tal cual de `docs/design-system.md` a
  `src/styles/tokens.css`. El prototipo v0.1 es la referencia visual.
- Los iconos del escritorio se leen de colecciones de contenido (`projects`, `notes`) con datos de
  ejemplo marcados como tales. Así M-04 y S-01 solo añaden contenido y vistas, sin rehacer el
  escritorio.
- Las apps sin construir abren una ventana con un estado vacío, en lugar de no hacer nada al
  hacer doble clic: así M-02 se comprueba de verdad.
- El tema sigue a `prefers-color-scheme`. El selector manual (menú y Ajustes) es de M-09.
- No se despliega nada en esta feature. Se deja `wrangler.jsonc` listo, pero el despliegue es de
  Pol y depende de la migración del dominio.
- Los e2e se ejecutan en dos tamaños de ventana: escritorio (1280 × 800) y móvil (390 × 844).

Decisiones que salieron durante la construcción:

- Versiones: Astro 7.3.8, `@astrojs/cloudflare` 14.3.4, `@astrojs/svelte` 9.0.1, Svelte 5.57.2.
  TypeScript se queda en 6.0.3 porque `astro check` y el tooling de Svelte aún no admiten la 7.
- `session: false` en `astro.config.mjs`: sin él, el adaptador pide un KV `SESSION` y el despliegue
  lo crearía en la cuenta de Cloudflare. Pol OS no usa sesiones.
- Barra de desarrollo de Astro desactivada: se pintaba encima del dock y se llevaba los clics.
- `astro dev` pasa a segundo plano cuando lo lanza un agente. Para Playwright se arranca con
  `--ignore-lock`, que lo mantiene en primer plano.
- Playwright usa el Google Chrome instalado (`channel: 'chrome'`) en lugar de descargar Chromium.
- Las celdas de los iconos del escritorio pasan de 90 a 96px para que "Herramientas" quepa en una
  línea (actualizado en `docs/design-system.md`).
- El sistema va dentro de un `<main>`: axe lo pedía para que todo el contenido esté en una región.

## Cobertura

| Requisito | Se implementa en | Se valida con |
|-----------|------------------|---------------|
| M-01 | `src/os/shell/LockScreen.svelte` | `tests/e2e/m-01-acceso.spec.ts` |
| M-02 | `src/os/shell/`, `src/os/windows/` | `tests/e2e/m-02-escritorio.spec.ts`, `src/os/windows/window-manager.test.ts` |
| M-03 | `src/os/shell/MobileHome.svelte`, `src/os/shell/MobileSheet.svelte` | `tests/e2e/m-03-movil.spec.ts` |
| M-07 | `src/os/shell/DesktopIcon.svelte`, `src/content/links.ts` | `tests/e2e/m-07-accesos.spec.ts` |

Qué comprueba cada test, según los criterios del PRD:

- **M-01:** al cargar se ven el nombre y los ocho puntos; clic y Enter entran al escritorio.
  *Negativo:* escribir en el campo no cambia nada y no aparece ningún error.
- **M-02:** barra de menú, dock e iconos visibles. Doble clic abre una ventana, un clic solo
  selecciona. La ventana se mueve, se redimensiona, se cierra y pasa al frente al pulsarla.
  *Negativo:* arrastrar una ventana fuera de la
  pantalla deja la barra de título visible (también en el test unitario del gestor de ventanas).
  Incluye un análisis de accesibilidad con axe.
- **M-07:** los tres accesos directos aparecen con sus URL (concriterio.blog, github.com/polmarza y
  linkedin.com/in/polmarza), llevan `target="_blank"` y `rel="noopener"`, y un solo clic no navega
  en escritorio.
- **M-03:** a 390px se ve la rejilla, un toque abre a pantalla completa e "Inicio" vuelve. Las
  carpetas muestran sus elementos. *Negativo:* cambiar el ancho con algo abierto lo conserva.

## Fuera de esta feature

- El contenido de las apps: Navegador y proyectos (M-04, M-10), Herramientas (M-05), Sobre mí
  (M-06), Correo (M-08), Ajustes (M-09), Notas (S-01) y Terminal (S-04).
- El selector manual de tema y fondo de pantalla (M-09).
- El endpoint de contacto, Turnstile y Email Service (M-08).
- Despliegue, dominio y DNS (en curso aparte, ver `mejoras/backlog.md`).
- La foto real de Pol: se usan las iniciales hasta que exista `src/assets/pol.jpg`.
