# Vista previa al compartir y SEO técnico

**Estado:** Verificada
**Requisitos que cierra:** S-06
**Fecha de acuerdo:** 2026-10-10

## Qué se construye

Dos cosas que ve la gente antes de abrir Pol OS, y que hoy faltan:

1. **Cómo se ve el enlace al compartirlo.** Al pegar `example.com` en LinkedIn, WhatsApp, Slack o X,
   sale una tarjeta con tu foto, tu nombre, el título y la descripción, en lugar de un recuadro vacío.
   Además la pestaña del navegador tiene su icono, y el icono sirve para la pantalla de inicio del
   móvil.
2. **Lo que ve un buscador y lo que cuesta cargar.** `robots.txt`, `sitemap.xml` y datos estructurados
   de "persona" (nombre, foto y tus tres perfiles) para que Google asocie el sitio contigo. Y se mide la
   velocidad real de la home, con un presupuesto que, si se rompe, hace fallar un test.

## Decisiones tomadas

- **El icono es el de "Pol OS"**: el cuadrado redondeado con degradado violeta-azul y una "P" blanca, el
  mismo de los iconos del escritorio. Se genera una vez a partir de un SVG y se guarda en `public/`:
  `favicon.svg` (el que usan los navegadores modernos), `favicon.ico` (para los que piden el antiguo),
  `apple-touch-icon.png` de 180 px (iOS, sin esquinas redondeadas porque iOS las pone) y dos PNG de
  192 y 512 px para un pequeño `site.webmanifest`.
- **La imagen para compartir mide 1200 × 630** (la proporción que piden las redes) y es un **JPEG**
  (pesa unos 90 KB: en PNG eran casi 500 KB, y WhatsApp y otras redes no muestran la vista previa de
  imágenes demasiado pesadas), generado con un script del repositorio (`scripts/generar-imagenes.mjs`) a partir de una plantilla
  HTML: tu foto en un círculo, "Pol Marzà" y "Portfolio" sobre el degradado de fondo "Atardecer", con
  los márgenes seguros que recortan LinkedIn y WhatsApp. Se guarda la imagen, no se genera al compilar,
  para no añadir dependencias al despliegue. Si cambias la foto o el texto, se vuelve a ejecutar.
- **No invento tu cargo.** La descripción y la imagen no dicen a qué te dedicas porque ese dato sigue
  pendiente (el "Sobre mí" lleva el rol como pendiente). Cuando lo decidas, es una línea.
- **`sitemap.xml` y `robots.txt` sin dependencias.** El mapa es una ruta pre-renderizada que lista las
  páginas indexables: hoy solo `/`, y las notas (S-01) se añadirán al hacerlas. `robots.txt` permite
  todo, excluye `/api/` y `/demo/` y apunta al mapa.
- **Los datos estructurados** (`Person` en JSON-LD) llevan nombre, dirección, foto y los perfiles de
  LinkedIn, GitHub y Con Criterio. **Ni el correo ni ningún dato privado.** Es un bloque de datos, no
  de código: la CSP no lo afecta.
- **Un `<noscript>`** con tus tres enlaces para quien no ejecute JavaScript (y para algunos
  rastreadores): hoy sin JavaScript solo se ve la pantalla de acceso.
- **El rendimiento se mide en una compilación real** (`pnpm build` + `pnpm preview`), con Chrome, no
  en desarrollo. Presupuesto: **LCP < 2,5 s, CLS < 0,1** (los de `docs/prd.md`) y un tope de
  JavaScript que se fija con la primera medición, con un margen razonable, y se anota aquí.
- **Las pruebas viven en `tests/csp/`**, la configuración que ya compila y sirve la compilación.

## Cobertura

| Requisito | Se implementa en | Se valida con |
|-----------|------------------|---------------|
| S-06 | `src/layouts/Base.astro`, `src/pages/sitemap.xml.ts`, `public/robots.txt`, `public/site.webmanifest`, `public/favicon.*`, `public/og.jpg`, `scripts/generar-imagenes.mjs` | `tests/csp/s-06-seo.spec.ts`, `tests/csp/s-06-rendimiento.spec.ts`, `src/lib/seo.test.ts` |

Qué comprueba cada test, según el criterio del PRD:

- **Metadatos (contra la compilación):**
  - Título, descripción y dirección canónica absolutos; `og:title`, `og:description`, `og:url`,
    `og:site_name`, `og:locale`, `og:image` con su ancho y alto, y `twitter:card` de imagen grande.
  - **La imagen existe**, responde 200 como `image/jpeg`, mide exactamente 1200 × 630 (se lee de su propia
    cabecera) y pesa menos de 300 KB.
  - Los iconos enlazados existen, con el tipo correcto, y el manifiesto es un JSON válido que apunta a PNG reales.
  - `robots.txt` excluye `/api/` y `/demo/` y enlaza el mapa; `sitemap.xml` es XML bien formado, con
    direcciones absolutas de `example.com`, solo de páginas que existen y que responden 200.
  - El JSON-LD se lee como JSON, es de tipo `Person` y sus enlaces son `https://`.
  - *Negativos:* **ningún metadato, ni el JSON-LD, ni el HTML contiene el correo de Pol ni una
    dirección con `@`**; `/demo/estudio.html` lleva `noindex`; `/api/contact` no sale en el mapa.
- **Rendimiento (contra la compilación, Chrome):** LCP y CLS medidos con los observadores del propio
  navegador, JavaScript total descargado, número de peticiones, que ningún recurso se pida fuera del
  sitio al cargar la home, y que `/_astro/*` lleve caché inmutable.
- **Unitarios de `seo.ts`:** la función que arma el JSON-LD y la que genera el mapa del sitio, con sus
  casos límite (sin páginas, direcciones sin barra final, caracteres especiales escapados).

Medidas y hallazgos al construir:

- **Rendimiento real de la home** (compilación, Chrome, 2026-10-10): LCP **104 ms** en escritorio y **132 ms**
  en móvil con la CPU 4 veces más lenta; CLS **0**; 7 peticiones, ninguna a otro dominio; JavaScript 99 KB y
  CSS 26 KB **sin comprimir** (en Cloudflare viajan con Brotli, bastante menos). Presupuesto fijado con ~30 % de
  margen: JavaScript < 130 KB, CSS < 40 KB, ≤ 12 peticiones, además del LCP < 2,5 s y CLS < 0,1 del PRD.
- **La imagen para compartir pasó de PNG (490 KB) a JPEG (61 KB):** WhatsApp y alguna otra red no muestran
  la vista previa de imágenes pesadas. El test exige menos de 300 KB.
- **Al escribir el escape de los separadores de línea de Unicode, el carácter real se coló en el código**
  y rompió la expresión regular (en JavaScript es un salto de línea). Se reescribió como texto `\u2028` y los
  tests de `seo.ts` lo cubren.
- Los iconos se generan con `node scripts/generar-imagenes.mjs` (necesita Chrome) y se commitean:
  `favicon.ico` (16, 32 y 48 px), `apple-touch-icon.png` (180 px, a sangre), `icon-192.png`, `icon-512.png`
  y `og.jpg`. Si cambia la foto, el icono o el texto de `scripts/plantillas/og.html`, se vuelve a ejecutar.
- El `<noscript>` con los tres enlaces solo es visible sin JavaScript; con él, esa persona ya no se queda
  frente a una pantalla de acceso que no puede usar.

**Lo que no se comprueba aquí:** cómo pinta cada red social la tarjeta. Cada una guarda una copia
(LinkedIn y WhatsApp tardan en refrescarla). Se comprueba a mano una vez tras el despliegue, con las
herramientas de depuración de LinkedIn y de Facebook (Sharing Debugger), pegando `example.com`. El
rendimiento medido en local no es el de un visitante con una red real: es un suelo contra regresiones.

## Fuera de esta feature

- Analítica de visitas: no hay ninguna decidida, y si se añade, se documenta en el PRD (privacidad).
- Una imagen distinta por cada nota (llega con S-01).
- Cualquier dato de tu cargo o tu especialidad en el título o la descripción (pendiente de que lo decidas).
- Pasar el sitio a HTTP/3, compresión o caché en el borde: lo gestiona Cloudflare.
- Optimizar el contenido de las apps: las apps cargan su código cuando se abren; se revisa cuando
  cada una tenga contenido real.
