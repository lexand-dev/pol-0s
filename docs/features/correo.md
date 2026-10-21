# Correo

**Estado:** Verificada
**Requisitos que cierra:** M-08
**Fecha de acuerdo:** 2026-10-10

## Qué se construye

La app Correo deja de ser un estado vacío y pasa a ser un cliente de correo de verdad. Se abre
desde el dock (ventana en escritorio, pantalla completa en móvil) y tiene:

- **Para:** una ficha con el nombre de Pol y un candado. No se puede editar y no enseña la
  dirección, que vive solo en el servidor.
- **De:** el correo del visitante. **Asunto** y **mensaje**.
- La verificación anti-bots de Cloudflare (Turnstile).
- El botón **Enviar**.

Si algo está mal, el error aparece junto al campo y no se envía nada. Si todo va bien, el mensaje
llega al correo de Pol con el del visitante como "responder a", y el visitante ve una pantalla de
confirmación con la opción "Escribir otro". Si el servidor rechaza el envío (demasiados mensajes,
verificación fallida, fallo del servicio de correo), el visitante ve un mensaje claro y **no pierde
lo que había escrito**.

En el servidor nace el primer y único endpoint de Pol OS, `POST /api/contact`, siguiendo el
contrato de `docs/architecture.md`. No guarda el mensaje ni lo escribe en los registros.

## Decisiones tomadas

- **La lógica va separada de Astro:** validación pura en `src/lib/contact.ts` (la usan el cliente y
  el servidor) y el flujo del envío en `src/lib/contact-service.ts`, que recibe sus dependencias
  (límite, Turnstile, correo, configuración) como parámetros. Así se prueba entera con dobles, sin
  red y sin enviar nada. El endpoint solo las conecta con los bindings reales.
- **Orden en el servidor:** método, tipo y tamaño → límite por IP → validación → Turnstile → envío.
  Lo barato va primero y nada cuesta una llamada externa si el cuerpo es inválido.
- **Límites de validación:** correo con formato válido y hasta 254 caracteres, asunto hasta 150,
  mensaje hasta 5.000, ningún campo obligatorio vacío. Se rechazan saltos de línea en correo y
  asunto (inyección de cabeceras) aunque el servicio de correo ya las trate.
- **Respuestas:** 405 método, 415 tipo, 413 cuerpo mayor de 16 KB, 429 límite, 422 validación (con
  el campo), 403 Turnstile, 502 fallo del correo, 200 enviado. JSON `{ ok, code, fields? }`, sin
  detalles internos.
- **Límite por IP:** 3 envíos por minuto con el binding `ratelimit` (el periodo solo admite 10 o
  60 s). La clave es `CF-Connecting-IP`, que Cloudflare fija en el borde.
- **El destino sale de la configuración** (`CONTACT_TO`), nunca de la petición. El mensaje se envía
  solo como texto plano, con `replyTo` al visitante. Se ignora cualquier `to` que venga en el cuerpo.
- **Campo trampa (honeypot):** un campo oculto que un humano no rellena. Si llega relleno, el
  servidor responde 200 sin enviar nada, para no dar pistas al bot.
- **Privacidad:** el contenido del mensaje no se guarda ni se escribe en los registros. Solo se
  registra el código de resultado.
- **Turnstile se carga al abrir Correo**, no en la home, con renderizado explícito. Si el script no
  carga (sin red o bloqueado), Correo lo dice y deja el botón desactivado.
- **Claves en local:** en desarrollo el widget usa siempre la clave pública de prueba de Cloudflare
  y el servidor lee un `.dev.vars` con la secreta de prueba (plantilla `.dev.vars.example`). Las
  reales viven en Cloudflare y, la pública, en `.env.local` para compilar. Ver
  `docs/architecture.md` (decisión de configuración local).
- **Pruebas sin salir a internet:** la interfaz se prueba con el endpoint y el script de Turnstile
  simulados; el flujo del envío, con dobles; y el endpoint real, solo por las ramas que no llaman a
  servicios externos (método, tipo, validación, falta de token y límite de envíos).

## Cobertura

| Requisito | Se implementa en | Se valida con |
|-----------|------------------|---------------|
| M-08 | `src/os/apps/mail/Mail.svelte`, `src/lib/contact.ts`, `src/lib/contact-service.ts`, `src/pages/api/contact.ts`, `wrangler.jsonc` | `tests/e2e/m-08-correo.spec.ts`, `tests/e2e/m-08-correo-api.spec.ts`, `src/lib/contact.test.ts`, `src/lib/contact-service.test.ts` |

Qué comprueba cada test, según el criterio del PRD:

- **e2e de la interfaz (escritorio y móvil):** "Para" aparece relleno, con candado, no es un campo
  editable y no muestra ninguna dirección. Con correo, asunto y mensaje válidos y Turnstile
  resuelto, enviar muestra la confirmación; "Escribir otro" vuelve al formulario vacío.
  *Negativos:* un correo con formato inválido y los campos vacíos muestran su error junto al campo
  y no llaman al endpoint; un 429, un 403 y un 502 del servidor muestran su mensaje claro y
  conservan lo escrito; si el script de Turnstile no carga, aparece el aviso y el botón queda
  desactivado.
- **e2e del endpoint real:** 405 con GET, 415 sin JSON, 422 con el campo que falla (campos
  vacíos, correo inválido, saltos de línea, longitudes), 403 sin token, y 429 a partir del cuarto
  envío en un minuto desde la misma IP.
- **Unitarios de `contact.ts`:** cada regla de validación, sus límites exactos y los saltos de línea.
- **Unitarios de `contact-service.ts`, con dobles:** el correo se envía a `CONTACT_TO` aunque el
  cuerpo traiga otro `to`; va como texto plano y con `replyTo` del visitante; con el límite
  superado, con la validación fallida o con Turnstile rechazado **no se llama al envío**; el
  honeypot responde 200 sin enviar; un fallo del correo da 502 sin detalles; y **nada del
  mensaje aparece en lo que se registra**.

Decisiones y hallazgos que salieron durante la construcción:

- El binding `send_email` va restringido con `allowed_sender_addresses`: solo puede enviar desde
  `contacto@m.example.com`. El destino no se restringe en la configuración porque es el correo de
  Pol y no debe estar en el repositorio.
- Los tipos de Cloudflare (`worker-configuration.d.ts`, más de 16.000 líneas) no se commitean:
  `pnpm check` los genera. Chocan con el DOM en `Element.append`, así que el cargador de Turnstile
  usa `appendChild`.
- Los análisis de accesibilidad, ahora también en Ajustes y en el Navegador, encontraron cuatro
  fallos de contraste ajenos al correo: el botón "Inicio" del móvil y la etiqueta seleccionada de
  Ajustes (nuevo token `--accent-text`), el gris `--muted` sobre las barras (de `#6e6e73` a
  `#636368`) y un `aria-label` sin rol en el candado del Navegador. Corregidos y documentados en
  `docs/design-system.md`.
- Comprobación puntual, que no se commitea: con Chrome real, el script real de Turnstile con su clave
  de prueba y el servidor local, el flujo completo (widget → token → `siteverify` → envío simulado)
  respondió 200 y el correo simulado salió con el remitente y el contenido esperados.
- Con la clave real del widget en `localhost` Turnstile responde `110200` (dominio no permitido): por
  eso en desarrollo se usa siempre la de prueba.

**Lo que no se comprueba aquí:** que el correo llegue de verdad a la bandeja de Pol, ni la
verificación real de Turnstile. Las pruebas no envían correo real ni usan claves reales (límite 1
de `CLAUDE.md`). Se comprobará a mano una vez, tras el primer despliegue: enviar un mensaje desde
Pol OS y ver que llega con el "responder a" correcto. Queda anotado en el PR.

## Fuera de esta feature

- **Cabeceras de seguridad y CSP** (`public/_headers`), que incluyen el hash del script de
  arranque de M-09 y `frame-src` para el Navegador. Es la siguiente feature y es **obligatoria
  antes del primer despliegue**.
- Alta del dominio en Email Sending, verificación del correo de destino y creación del widget de
  Turnstile en Cloudflare: son pasos de Pol (ver `docs/architecture.md`).
- Guardar los mensajes, adjuntos y respuestas automáticas al visitante.
- Dar de alta los secretos reales en producción: lo hace Pol con `wrangler secret put`.
