# Cabeceras de seguridad (CSP)

**Estado:** Verificada
**Requisitos que cierra:** M-11
**Fecha de acuerdo:** 2026-10-10

## Qué se construye

Pol OS pasa a enviar una política de seguridad de contenido (CSP) y otras cabeceras de seguridad en
todas sus respuestas. Es lo que falta antes del primer despliegue. El visitante no nota nada: todo
sigue funcionando igual. Lo que cambia es lo que el navegador **se niega a hacer**:

- Ejecutar un script que no sea de Pol OS ni de Turnstile (adiós a la inyección de scripts).
- Cargar imágenes, estilos, conexiones o marcos de dominios que no estén en la lista.
- Que otra web incruste Pol OS dentro de un marco (clickjacking).
- Revelar la dirección completa de la página al abrir un enlace externo.

La lista de marcos permitidos sale de los proyectos: solo los que están marcados como incrustables.
Así, añadir un proyecto nuevo y marcarlo como incrustable lo autoriza sin tocar la política a mano.

## Decisiones tomadas

- **Dos capas, porque cada una cubre lo que la otra no puede:**
  1. `security.csp` de Astro (estable desde Astro 6) escribe en cada página una etiqueta `<meta>` con
     la política y calcula **solo** los hashes de los scripts y estilos que genera el propio Astro
     (la hidratación de la isla, el CSS empaquetado). Esos hashes cambian con cada compilación, por
     eso no se pueden escribir a mano.
  2. `public/_headers` envía, como cabeceras HTTP, lo que una etiqueta `<meta>` **no puede**:
     `frame-ancestors`, además de `X-Content-Type-Options`, `Referrer-Policy` y
     `Permissions-Policy`.
- **`frame-ancestors 'self'`, no `'none'`.** La página de demostración de "Estudio" se carga
  dentro de Pol OS, que es su mismo origen. Con `'none'` Pol OS no podría mostrarla. Ninguna otra web
  puede incrustar Pol OS.
- **`_headers` no vale para las respuestas del Worker.** Según la documentación de Cloudflare solo
  se aplica a los archivos estáticos, así que `/api/contact` añade sus propias cabeceras desde el
  código (`default-src 'none'`, `frame-ancestors 'none'`, `nosniff`).
- **Dominios permitidos, con los mínimos necesarios:**
  - `script-src`: el propio sitio, los hashes de Astro, el script de arranque del tema (por hash) y
    `https://challenges.cloudflare.com`.
  - `frame-src`: `'self'`, `https://challenges.cloudflare.com` y el origen de cada proyecto
    incrustable (en Pol OS, Afloat, Local Whisper y Planito).
  - `connect-src`: `'self'` (el endpoint) y Turnstile si hiciera falta.
  - `img-src`: `'self'` y `data:` (la flecha de los accesos directos es un SVG en línea).
  - `object-src 'none'`, `base-uri 'none'`, `form-action 'self'`.
  - Los directivos exactos de Turnstile se fijan **comprobando con el widget real**, no suponiéndolos:
    Cloudflare no publica una lista cerrada.
- **El script de arranque del tema** (M-09) es en línea. Su hash se calcula al compilar a partir de
  la misma constante que lo genera (`PREFS_BOOT_SCRIPT`), así nunca queda desfasado.
- **Los proyectos solo admiten `https://` o rutas locales** en su `url`, y uno incrustable debe ser
  `https://` o local. Cierra la observación del `/security-review` sobre `javascript:`.
- **Sin tipografías externas por ahora.** El tema usa la fuente del sistema; JetBrains Mono no se
  carga todavía. Cuando llegue la Terminal (S-04), se autoriza Google Fonts o se alojan en local.
- **Dónde se prueba.** La CSP no existe en `astro dev` (limitación de Astro: "no se admite en el
  servidor de desarrollo"). Se prueba contra la compilación (`pnpm build` + `pnpm preview`) con una
  configuración de Playwright propia (`playwright.csp.config.ts`, `pnpm test:csp`), que usa el mismo
  servidor local de Cloudflare. Comprobado al construir: `preview` **sí** aplica `_headers`, así que
  no hizo falta el plan alternativo.
- **No se activa HSTS desde el código.** Lo gestiona Cloudflare en el dominio, y es decisión de Pol.

## Cobertura

| Requisito | Se implementa en | Se valida con |
|-----------|------------------|---------------|
| M-11 | `astro.config.mjs`, `public/_headers`, `src/pages/api/contact.ts`, `src/lib/csp.ts`, `src/content.config.ts` | `tests/csp/m-11-csp.spec.ts`, `src/lib/csp.test.ts` |

Qué comprueba cada test, según el criterio del PRD:

- **e2e contra la compilación** (proyecto `produccion`, en escritorio):
  - Las cabeceras de `/`, de la página de demostración y de `/api/contact` llevan lo esperado
    (`frame-ancestors`, `nosniff`, `Referrer-Policy`), y la etiqueta `<meta>` de la CSP está en la home.
  - **Recorrido completo sin violaciones:** entrar, abrir cada app, cambiar tema y fondo, abrir un
    proyecto incrustable y uno no incrustable en el Navegador, y enviar un mensaje (con el endpoint
    y Turnstile simulados). El test escucha `securitypolicyviolation` y los errores de consola y
    exige que haya **cero**.
  - **Todo script en línea de la página tiene su hash** en la política, y la política no contiene
    `unsafe-eval` ni `unsafe-inline` en `script-src`.
  - *Negativos:* un script en línea sin hash, una imagen de un dominio no permitido y un `iframe`
    a un dominio no incluido son bloqueados y generan la violación esperada. Una página de otro
    origen que incruste Pol OS no lo consigue (el marco no se muestra).
- **Unitarios de `csp.ts`:** el origen de cada proyecto incrustable entra en `frame-src` y los no
  incrustables no; una `url` con `javascript:`, `data:` o `http:` se rechaza; un proyecto
  incrustable con una ruta local no añade ningún origen; el hash del script de arranque coincide con
  el SHA-256 de `PREFS_BOOT_SCRIPT`.

Hallazgos al construir, que cambian cómo se trabaja:

- **`.env.local` gana a una variable de shell** en `pnpm build`: la clave pública de Turnstile que se
  compila es la de `.env.local` aunque se pase otra por línea de comandos. Para `pnpm deploy` desde la
  máquina de Pol es justo lo que se quiere. Para compilar con otra, un `.env.production.local` (Vite
  lo lee después). Lo usé temporalmente para la comprobación con el widget real y lo borré.
- **`pnpm build` y `pnpm preview` comparten con `pnpm dev` la caché de Vite** (`node_modules/.vite`).
  Si se ejecutan con `pnpm dev` abierto, el servidor de desarrollo puede quedarse devolviendo 500
  ("The file does not exist … deps_ssr"). Se arregla parándolo y volviendo a lanzarlo.
- La **404 por defecto de Cloudflare** (`/404.html`) no pasa por `_headers`: no lleva estas
  cabeceras. Se revisará cuando haya una página 404 propia (S-01).
- `/demo/estudio.html` responde con una redirección 307 a `/demo/estudio` antes de servirse (el
  manejo de `.html` de Cloudflare). Las cabeceras están en la respuesta final.
- Playwright evalúa por el protocolo de depuración, que **se salta la CSP**: no se puede probar el
  bloqueo de `eval` desde un test. Se cubre comprobando que la política no lleva `unsafe-eval`.
- Comprobación puntual con Chrome real, que no se commitea: con una compilación con la clave de
  prueba, el widget **real** de Turnstile entregó token bajo la política, el envío al endpoint real
  respondió 200 y no hubo ninguna violación.
- Se desactivó el resaltado de código de Markdown (`markdown.syntaxHighlight: false`): Shiki usa
  estilos en línea que la CSP bloquea. Las notas (S-01) aún no llevan código; cuando lo lleven, hay
  que elegir Prism o un resaltado propio.

**Lo que no se comprueba aquí:** el comportamiento con el dominio real y con Turnstile real en
producción. Se hace una comprobación manual tras el primer despliegue, mirando la consola del
navegador y probando el widget, el envío de un mensaje y la carga de un proyecto en el Navegador.

## Fuera de esta feature

- `Strict-Transport-Security` y los ajustes de TLS del dominio: los gestiona Cloudflare.
- Informes de violaciones (`report-to`, `report-uri`): necesitarían un receptor.
- Aislamiento de origen cruzado (`COOP`, `COEP`, `CORP`): riesgo de romper Turnstile y los marcos, sin
  beneficio claro en un sitio sin sesión.
- Alojar tipografías en local o autorizar un dominio de fuentes (llega con la Terminal, S-04).
- `Subresource Integrity` para el script de Turnstile: Cloudflare no lo permite, el script cambia.
