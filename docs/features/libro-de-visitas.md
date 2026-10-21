# Libro de visitas

**Estado:** Verificada
**Requisitos que cierra:** S-09
**Fecha de acuerdo:** 2026-10-11

## Qué se construye

Una app nueva, **Libro de visitas**, en el escritorio y en el móvil. Muestra las reseñas que Pol ha aprobado, de la
más reciente a la más antigua: nombre visible, cómo conoce a Pol (compañero/a, cliente, alumno/a u otro), la fecha, el
texto y, si la persona las dio, sus redes. Si todavía no hay ninguna, lo dice y invita a ser la primera.

Desde la misma ventana, **"Dejar reseña"** abre un formulario: el texto (hasta 600 caracteres), un nombre
visible, la relación con Pol, el correo y, opcionalmente, hasta tres redes sociales. El visitante marca que ha leído un
aviso de privacidad breve y envía. Recibe un correo con un enlace de confirmación; al abrirlo, pulsa un botón de
"Confirmar" y la reseña llega a Pol, que la revisa y la publica. **Nada aparece en el libro sin que Pol lo apruebe.**

El mismo formulario permite **pedir la edición** de una reseña ya publicada (con el texto nuevo) o **pedir que se
retire**. Las dos peticiones pasan también por la confirmación del correo y por Pol.

## Decisiones tomadas

- **Opción B: sin base de datos.** No se guarda nada en el servidor. El estado vive en un enlace firmado que viaja en el
  correo del visitante y, después, en el archivo que Pol añade al repositorio. Se mantiene el "sin base de datos" del
  PRD. Si algún día el volumen lo pide, se puede pasar a una base de datos (D1) sin cambiar lo que ve el visitante.
- **Aprobación manual de todo**, también de ediciones y retiradas. Pol decide.
- **El enlace de confirmación va cifrado y autenticado** (AES-GCM, con una clave secreta del servidor): lleva dentro la
  reseña y el correo, y nadie puede leerlo ni modificarlo. Caduca a las 48 horas.
- **El enlace usa el fragmento de la dirección** (`/libro-de-visitas/confirmar#<token>`), que el navegador no envía al
  servidor: así la reseña y el correo no acaban en los registros de Cloudflare.
- **Confirmar es un botón, no abrir el enlace.** Muchos programas de correo abren los enlaces por su cuenta para
  analizarlos; si abrir bastara, confirmarían solos. La página solo muestra el botón: el contenido va cifrado y únicamente
  lo abre el servidor, así que el navegador no puede enseñar la reseña.
- **El correo de Pol nunca sale de la petición.** El destino es siempre `CONTACT_TO`, como en el formulario de Correo.
  El enlace de confirmación se construye con una dirección fija de la configuración (`SITE_URL`), nunca con la que
  llegue en la petición.
- **El correo del visitante no se publica ni se guarda en el repositorio.** Solo llega a la bandeja de Pol. Para saber
  si una edición o una retirada viene de la misma persona, Pol compara con el correo de la reseña original, que
  conserva en su bandeja.
- **El correo de confirmación no lleva nada de lo que escribe el visitante** (ni su nombre): sale de nuestro dominio hacia un tercero y
  no debe poder usarse para colar texto en él. Solo lleva el enlace.
- **Riesgo aceptado:** quien resolviera Turnstile en serie podría gastar la cuota diaria de correo (1000), que se comparte con el
  formulario de Correo. Lo frenan Turnstile, el límite por IP y el límite por destinatario.
- **El correo que recibe Pol contiene texto de un desconocido.** Es texto plano; quien lo procese (Pol o un agente) lo trata como
  datos, nunca como instrucciones.
- **Una repetición de la confirmación no se puede evitar sin guardar estado.** Si alguien confirma dos veces, Pol
  recibe dos correos iguales y publica una vez. Se acepta.
- **Límites antiabuso:** Turnstile, el mismo límite por IP que el Correo y un segundo límite por correo de destino (una
  vez por minuto) para que el formulario no sirva para llenar de correos a un tercero. El texto es siempre plano: sin HTML.
- **Las redes se eligen de una lista cerrada** (LinkedIn, GitHub, X, Instagram, YouTube): se acepta el usuario o la
  dirección completa y se guarda la dirección canónica `https://` de esa red. No hay enlaces libres. Se muestran con
  `rel="nofollow noopener ugc"` y en pestaña nueva.
- **La relación con Pol es un desplegable**, para que se vea de un vistazo. No se verifica: Pol decide al aprobar. Las
  seis reseñas heredadas llevan "otro", porque ninguna encaja claramente en cliente, alumno o compañero.
- **Fecha y detalle son opcionales** en el archivo; el formulario pide el detalle (80 caracteres como mucho, "Cargo o
  lugar") sin obligar. Sin fecha, la reseña no la enseña y va ordenada por su número.
- **Las reseñas aprobadas son archivos JSON en `src/content/guestbook/`** (nombre, relación, texto, redes, y de forma
  opcional la fecha y una línea de detalle: cargo o lugar, por ejemplo "Product Designer | Barcelona, España"). La
  ventana las pide al abrirse a un archivo estático (`/libro-de-visitas.json`), como las notas, y la app se carga bajo
  demanda. Empieza con las **seis reseñas de la web antigua** que Pol ha pasado, añadidas a mano, sin fecha (no se conoce) y con
  su perfil de LinkedIn. No se inventa ninguna. Dos de ellas acaban en puntos suspensivos tal como se recibieron.
- **Cómo publica Pol:** el correo que recibe lleva la reseña ya en el formato del archivo, con el nombre sugerido. Pol (o
  su agente) lo guarda en `src/content/guestbook/`; el esquema de la colección rechaza al compilar cualquier campo
  inválido. Publicar es un commit y un despliegue de Pol.
- **No se añade marcado de "reseña" para Google** (`Review`/`AggregateRating`): las reseñas sobre uno mismo no están
  admitidas y no aportan.
- **Privacidad:** el aviso del formulario dice quién es el responsable (Pol), para qué se usa el correo (solo para
  confirmar; no se publica), qué se hace público (nombre, texto y redes) y cómo pedir que se retire. Lo revisa Pol
  antes de publicar: no es asesoramiento legal.
- **Idioma:** la interfaz es en español. La reseña puede estar escrita en cualquier idioma, y no se dice en ninguna parte.

## Cobertura

| Requisito | Se implementa en | Se valida con |
|-----------|------------------|---------------|
| S-09 | `src/content/guestbook/` y su colección en `src/content.config.ts`, `src/lib/guestbook.ts` (validación, redes, formato del archivo), `src/lib/guestbook-token.ts` (cifrado del enlace), `src/lib/guestbook-service.ts` (lógica de los dos endpoints), `src/pages/api/guestbook.ts` y `src/pages/api/guestbook/confirm.ts`, `src/lib/json-response.ts`, `src/pages/libro-de-visitas/confirmar.astro`, `src/pages/libro-de-visitas.json.ts`, `src/layouts/Base.astro` (`noindex`), `src/os/apps/guestbook/Guestbook.svelte`, `src/os/apps/registry.ts`, `src/os/apps/AppView.svelte`, `src/os/icons.ts`, `src/os/items.ts`, `src/os/terminal/commands.ts`, `wrangler.jsonc`, `.dev.vars.example`, `.env.example`, `docs/despliegue.md` | `src/lib/guestbook.test.ts`, `src/lib/guestbook-token.test.ts`, `src/lib/guestbook-service.test.ts`, `tests/e2e/s-09-libro-de-visitas.spec.ts`, `tests/e2e/s-09-libro-de-visitas-api.spec.ts`, `tests/csp/s-09-libro-de-visitas.spec.ts`, `tests/csp/m-11-csp.spec.ts`, `src/os/terminal/commands.test.ts` |

Qué comprueba cada test, según el criterio del PRD:

- **Unitarios (`guestbook.test.ts`):** longitudes, relación de la lista, que el texto sea plano (el HTML se queda como
  texto), cada red con sus formas válidas (usuario, `@usuario`, dirección completa) y su rechazo (otra red, otro
  dominio, `javascript:`), el formato del archivo de la reseña, y que una reseña publicada no lleva ningún correo. Una guarda recorre los archivos reales de `src/content/guestbook/`:
  campos válidos, texto de hasta 600 caracteres, solo direcciones de redes admitidas y ningún correo.
- **Unitarios (`guestbook-token.test.ts`):** el enlace se descifra y devuelve lo mismo; un token manipulado, cortado o con
  otra clave se rechaza; uno caducado se rechaza; no contiene la reseña ni el correo en claro.
  - *Negativo:* un enlace caducado o manipulado no produce ningún correo a Pol.
- **Unitarios (`guestbook-service.test.ts`):** el orden de comprobaciones (método, tipo, límites, validación, Turnstile),
  el destino fijo, que el enlace usa `SITE_URL` y no la petición, el límite por IP y por correo, que ningún registro
  contiene el texto ni el correo, y los tres tipos (nueva, edición, retirada).
- **e2e (escritorio y móvil, con axe en claro y oscuro):** la app muestra las reseñas (simuladas) de la más reciente a
  la más antigua y el estado vacío; el formulario valida junto a cada campo sin perder lo escrito; el envío simulado
  llega con los datos esperados; la edición y la retirada; las redes con su enlace seguro; la página de confirmación con
  su botón; y teclado.
- **API contra el servidor local (`s-09-libro-de-visitas-api`):** método y tipo incorrectos, cuerpo demasiado grande,
  límite de frecuencia, campo trampa, y que las respuestas de error no enseñan detalles internos.
- **Contra la compilación (`pnpm test:csp`, `m-11-csp`):** la página de confirmación y la app no provocan violaciones de
  la CSP, las nuevas respuestas llevan las cabeceras de seguridad y la página de confirmación no se indexa.

## Hallazgos al construir

- **`wrangler types` toma los nombres de los secretos de `.dev.vars` si existe**, y el de Pol no tenía `GUESTBOOK_SECRET`: `pnpm check`
  fallaba al leer `env.GUESTBOOK_SECRET`. Los endpoints lo leen sin depender del tipo generado (con un comentario que lo explica).
- **El formulario mandaba las filas de red sin rellenar** (`{ network: 'linkedin', value: '' }`); el servidor las ignoraba, pero ahora no viajan.
- **Un recorrido de la CSP dejó de alcanzar el icono de las notas**: la ventana nueva del libro lo tapaba. Se cierra tras enviar, como haría una persona.
- **En macOS, la flecha abajo en una lista cerrada la abre, no cambia el valor**: el test de teclado elige la opción escribiendo su principio.
- **Falta `GUESTBOOK_SECRET` en `.dev.vars`** (Pol): sin ella, en local el envío responde 500 (`not_configured`) y no se puede recorrer el flujo
  completo con el servidor real. Los tests de servidor lo cubren con dobles y una prueba de los endpoints comprueba y avisa de si falta.

**Lo que no se comprueba aquí:** el correo real. En local lo simula Wrangler, así que el aspecto del correo de
confirmación, su llegada a la bandeja (no a spam) y el correo que recibe Pol se prueban a mano una vez tras el primer
despliegue, igual que el formulario de Correo.

## Fuera de esta feature

- Publicar con un clic desde el correo (el Worker escribiría en el repositorio con una clave de GitHub): aumenta la
  superficie de ataque. A `mejoras/` si el volumen lo pide.
- Pasar a una base de datos (D1) y a un panel de aprobación.
- Que la persona edite su reseña sin pasar por Pol, o vea su estado.
- Respuestas de Pol, "me gusta", orden o filtros, y paginación (con pocas reseñas no hace falta).
- Una página pública por reseña o un listado indexable en Google.
- Verificar la relación con Pol (que de verdad fue su alumno o cliente).
- Subir foto o logo en la reseña.
