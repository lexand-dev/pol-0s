# Cómo está hecho (el README del proyecto)

**Estado:** Verificada
**Requisitos que cierra:** S-10
**Fecha de acuerdo:** 2026-10-11

## Qué se construye

El repositorio de Pol OS no es público, así que el portfolio cuenta por sí mismo **cómo está hecho**. Una vista nueva, aparte y mucho más detallada que
la ficha del proyecto en Proyectos: un **documento largo con índice**, como el README de un repositorio, que se abre desde tres sitios:

- un icono propio en el escritorio (y en la pantalla de inicio del móvil),
- un botón en el detalle del proyecto **Pol OS**, dentro de Proyectos,
- la Terminal (`open readme`, `open como`).

El documento tiene estas secciones (el texto lo escribo yo a partir de lo que hemos construido y Pol lo revisa antes de publicarlo):

1. **Qué es Pol OS** y por qué un sistema operativo.
2. **Tecnologías**, cada una **con su logo** y una línea de para qué se usa: Astro, Svelte, TypeScript, Cloudflare (Workers, Turnstile y el servicio de
   correo), Vite, Vitest, Playwright, pnpm, GitHub y GitHub Actions, y Claude Code.
3. **Cómo funciona por dentro:** un sitio estático con un único trozo de servidor, el escritorio como una «isla» de Svelte, el gestor de ventanas, las
   apps que se cargan al abrirlas, el contenido en colecciones del repositorio y la política de seguridad de contenido.
4. **Cómo se actualizan solos los datos:** la tarea diaria de GitHub Actions que cuenta los repositorios, el token de solo lectura, qué se publica (solo
   recuentos, nunca nombres de repositorios privados) y cómo llega el cambio a la web.
5. **El formulario de Correo** (Turnstile, límites y envío sin guardar nada) y **el Libro de visitas** (enlace cifrado, confirmación del correo y aprobación de Pol,
   sin base de datos).
6. **Cómo se trabaja:** fichas antes de código, pruebas que cubren cada requisito y un script que comprueba la cobertura.
7. **Limitaciones: los bloqueos de LaLiga.** Qué pasa (las operadoras bloquean direcciones compartidas de Cloudflare durante los partidos y la web no carga desde
   España durante horas), qué ideas hay para resolverlo (sacar las páginas de Cloudflare, un espejo, una página de aviso con vídeo y cuenta atrás, un servidor
   propio) y **por qué no se ha cambiado**: lo que aporta Cloudflare (Turnstile, los Workers, el envío de correo, los límites de frecuencia), la complejidad de mantener
   un espejo y lo que dicen los datos.

## Decisiones tomadas

- **Es una app más del escritorio**, no una pestaña de Proyectos: un documento con la hoja de papel de Sobre mí, con índice y enlaces internos a cada
  sección. Pol pidió «una vista aparte» porque la ficha del proyecto no cabe todo esto.
- **El texto es un archivo Markdown del repositorio** (`src/content/como-esta-hecho.md`), igual que Sobre mí: se edita sin tocar código y se convierte a HTML al compilar.
- **Los logos salen de `simple-icons`**, una colección de logos de marcas en SVG con licencia CC0 (las marcas siguen siendo de sus dueños; se usan solo para nombrar la
  tecnología). Se importan solo los que se usan, así que no pesan en la home (la app se carga al abrirla). De las tecnologías de la lista, **Playwright y Turnstile no están en
  esa colección**: salen con su nombre dentro de un recuadro, sin logo. Un logo que no se puede mostrar nunca deja un hueco vacío.
- **Es una excepción a «sin logos de otras marcas»** de `CLAUDE.md`, que habla de los iconos de las apps: aquí no son iconos de app, sino la lista de tecnologías. Se
  anota en `CLAUDE.md` junto a las excepciones anteriores.
- **Cuenta cómo funciona, no cómo entrar:** nada de claves, tokens, correos, identificadores de cuenta ni valores de configuración. Se explican los **nombres** de las piezas
  y su comportamiento, no los límites exactos de frecuencia ni los nombres de los secretos (no ayudan al lector y sí a quien quiera abusar). Un test lo vigila.
- **El texto de los bloqueos de LaLiga se apoya en datos reales** (los de hayahora.futbol que ya hemos consultado) y avisa de que son estimaciones; nada de afirmaciones sobre
  personas ni empresas concretas.
- **Una página pública `/como-esta-hecho/`** con el mismo texto (se lee sin JavaScript, con título, descripción y en el mapa del sitio), igual que las notas: así se puede compartir
  el enlace con quien quiera saber cómo está montado. *(Esto es lo más prescindible: si Pol no la quiere, se quita sin tocar el resto.)*

## Cobertura

| Requisito | Se implementa en | Se valida con |
|-----------|------------------|---------------|
| S-10 | `src/content/como-esta-hecho.md`, `src/lib/tech-logos.ts`, `src/os/apps/howto/HowTo.svelte`, `src/os/apps/registry.ts`, `src/os/items.ts`, `src/os/apps/projects/ProjectDetail.svelte`, `src/os/terminal/commands.ts`, `src/pages/como-esta-hecho.astro`, `src/pages/sitemap.xml.ts` | `src/lib/howto.test.ts`, `tests/e2e/s-10-como-esta-hecho.spec.ts`, `tests/csp/s-10-como-esta-hecho.spec.ts`, `tests/csp/m-11-csp.spec.ts` |

Qué comprobará cada test, según el criterio del PRD:

- **Unitarios (`howto.test.ts`):** el documento tiene todas las secciones acordadas y su índice las enlaza; cada tecnología de la lista tiene su
  logo (SVG válido y de una sola pieza) o, si no lo tiene, su texto de reserva; ningún texto contiene una clave, un token, un correo, una dirección de cuenta ni los nombres de los
  secretos; todos los enlaces son `https://` o internos.
  - *Negativo:* un logo que falta no deja la tecnología sin nombre.
- **e2e (escritorio y móvil, con axe en claro y oscuro):** se abre desde el escritorio, desde el detalle de Pol OS y desde la Terminal; muestra el índice y cada enlace del
  índice lleva a su sección; cada tecnología aparece con su nombre y su logo (o su recuadro de texto); los enlaces externos se abren en pestaña nueva; no se desborda ni con el texto más grande.
- **Contra la compilación:** la página pública responde 200 con su título y su descripción, se lee con JavaScript desactivado, está en el mapa del sitio y no hay violaciones de la
  política; el recorrido de M-11 abre la app.

## Hallazgos al construir

- **Los títulos de sección ya traían un `id` con acentos** (el convertidor de Markdown lo pone): se sustituye por uno sin acentos calculado en el código,
  que es más cómodo de compartir y estable.
- **La descripción del documento llevaba dos puntos** y rompía el bloque de datos del principio del archivo: va entre comillas.
- **La lista de tecnologías heredaba la sangría del texto que la rodea** (los `ul` del documento ganaban en especificidad); se corrigió.
- **Instalar `simple-icons` con el servidor de desarrollo abierto lo dejó devolviendo errores** (la caché de dependencias de Vite): hubo que reiniciarlo.
  Además, la colección de contenido no se actualizaba con el campo nuevo del proyecto hasta reiniciar.
- **En móvil, el documento ocupa la pantalla y la Terminal queda debajo**: el test de la Terminal comprueba `ls` y `open readme` antes de abrirlo.
- El código de los logos pesa unos 15 KB y solo viaja al abrir la app: la home no cambia.

**Lo que no se comprueba aquí:** que el texto sea correcto y esté bien contado: lo revisa Pol antes de publicarlo. **Pendiente de Pol:** leer el texto de `src/content/como-esta-hecho.md` y ajustarlo (sobre todo la sección de LaLiga y lo que cuenta de los datos de GitHub).

## Fuera de esta feature

- Publicar el repositorio o enseñar código fuente dentro de la web.
- Un blog o una versión en inglés.
- Gráficos o diagramas dibujados a mano de la arquitectura (se pueden añadir después; el texto ya describe cada pieza).
- Resolver los bloqueos de LaLiga: aquí solo se cuentan. Las ideas viven en `mejoras/` y en el documento externo de ideas.
