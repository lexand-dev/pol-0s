/**
 * Flujo del Libro de visitas (S-09), sin depender de Astro ni de Cloudflare. Todo lo externo llega por `deps`, así se prueba
 * entero con dobles, sin red y sin enviar nada.
 *
 * Dos pasos, sin guardar nada en el servidor:
 *  1. `handleSubmit`: valida lo que envía el visitante y le manda un enlace de confirmación (cifrado, con caducidad).
 *  2. `handleConfirm`: abre ese enlace y, si es auténtico, manda la reseña a Pol. Pol decide si la publica.
 *
 * Privacidad: ni el texto de la reseña ni el correo se registran. Lo único que sale por `log` es el código del resultado.
 */
import {
  LIMITS,
  networkLabel,
  relationLabel,
  slugify,
  toEntry,
  validateGuestbook,
  type FieldErrors,
  type GuestbookInput,
  type Kind,
} from './guestbook';
import { fingerprint, openToken, sealToken, TOKEN_TTL_MS } from './guestbook-token';
import { PERSONA } from '../content/persona';

export const MAX_BODY_BYTES = 16 * 1024;

export type GuestbookCode =
  | 'sent'
  | 'confirmed'
  | 'method_not_allowed'
  | 'unsupported_media_type'
  | 'payload_too_large'
  | 'rate_limited'
  | 'invalid_body'
  | 'validation_failed'
  | 'captcha_failed'
  | 'invalid_token'
  | 'expired'
  | 'send_failed'
  | 'not_configured';

export interface GuestbookResponse {
  ok: boolean;
  code: GuestbookCode;
  fields?: FieldErrors;
}

export interface GuestbookResult {
  status: number;
  body: GuestbookResponse;
}

export interface OutgoingEmail {
  from: { email: string; name: string };
  to: string;
  replyTo?: string;
  subject: string;
  text: string;
}

export interface GuestbookDeps {
  /** Límite por IP. */
  ipLimiter: { limit(options: { key: string }): Promise<{ success: boolean }> };
  /** Límite de una vez por minuto por clave (el correo de destino, o el enlace de confirmación). */
  keyLimiter: { limit(options: { key: string }): Promise<{ success: boolean }> };
  verifyTurnstile(token: string, ip: string | null): Promise<boolean>;
  sendEmail(message: OutgoingEmail): Promise<unknown>;
  /** Todo sale de la configuración del servidor, nunca de la petición. */
  config: { to?: string; from?: string; siteUrl?: string; secret?: string };
  now(): number;
  /** Solo recibe códigos y estados, nunca contenido. */
  log?(event: { code: GuestbookCode; status: number }): void;
}

export interface GuestbookRequest {
  method: string;
  contentType: string | null;
  contentLength: number | null;
  ip: string | null;
  readBody(): Promise<string>;
}

const byteLength = (s: string) => new TextEncoder().encode(s).length;

const ACTION: Record<Kind, { verb: string; title: string }> = {
  new: { verb: 'publicar una reseña', title: 'Nueva reseña' },
  edit: { verb: 'editar tu reseña', title: 'Petición de edición' },
  remove: { verb: 'retirar tu reseña', title: 'Petición de retirada' },
};

/** Lectura común: método, tipo, tamaño, límite por IP y JSON. Devuelve el cuerpo o la respuesta de error. */
async function readJson(
  req: GuestbookRequest,
  deps: Pick<GuestbookDeps, 'ipLimiter'>,
  end: (status: number, code: GuestbookCode, fields?: FieldErrors) => GuestbookResult,
): Promise<{ body: Record<string, unknown> } | { error: GuestbookResult }> {
  if (req.method !== 'POST') return { error: end(405, 'method_not_allowed') };
  if (!req.contentType?.toLowerCase().includes('application/json')) return { error: end(415, 'unsupported_media_type') };
  if (req.contentLength !== null && req.contentLength > MAX_BODY_BYTES) return { error: end(413, 'payload_too_large') };

  // Sin IP (no debería pasar detrás de Cloudflare) todos comparten una clave: más estricto, no menos.
  const limited = await deps.ipLimiter.limit({ key: req.ip ?? 'sin-ip' });
  if (!limited.success) return { error: end(429, 'rate_limited') };

  const text = await req.readBody();
  if (byteLength(text) > MAX_BODY_BYTES) return { error: end(413, 'payload_too_large') };

  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { error: end(422, 'invalid_body') };
  }
  if (typeof data !== 'object' || data === null || Array.isArray(data)) return { error: end(422, 'invalid_body') };
  return { body: data as Record<string, unknown> };
}

const makeEnd =
  (deps: Pick<GuestbookDeps, 'log'>) =>
  (status: number, code: GuestbookCode, fields?: FieldErrors): GuestbookResult => {
    deps.log?.({ code, status });
    return { status, body: { ok: status === 200, code, ...(fields ? { fields } : {}) } };
  };

/** Paso 1: el visitante envía su reseña y recibe el enlace de confirmación. */
export async function handleSubmit(req: GuestbookRequest, deps: GuestbookDeps): Promise<GuestbookResult> {
  const end = makeEnd(deps);
  const read = await readJson(req, deps, end);
  if ('error' in read) return read.error;
  const body = read.body;

  // Campo trampa: un humano no lo ve ni lo rellena. A un bot se le dice que fue bien, sin enviar nada.
  if (typeof body.website === 'string' && body.website.trim() !== '') return end(200, 'sent');

  const validation = validateGuestbook(body);
  if (!validation.ok) return end(422, 'validation_failed', validation.errors);

  const captcha = typeof body.turnstileToken === 'string' ? body.turnstileToken : '';
  if (!captcha || captcha.length > 2048 || !(await deps.verifyTurnstile(captcha, req.ip))) return end(403, 'captcha_failed');

  const { from, siteUrl, secret } = deps.config;
  if (!from || !siteUrl || !secret) return end(500, 'not_configured');

  const { value } = validation;
  // Un mismo correo no puede recibir más de un enlace por minuto: el formulario no sirve para llenar de correos a un tercero.
  const limited = await deps.keyLimiter.limit({ key: `email:${await fingerprint(value.email.toLowerCase())}` });
  if (!limited.success) return end(429, 'rate_limited');

  const token = await sealToken(value, secret, deps.now());
  const link = `${siteUrl.replace(/\/+$/, '')}/libro-de-visitas/confirmar#${token}`;
  try {
    await deps.sendEmail({
      from: { email: from, name: PERSONA.osName },
      to: value.email,
      subject: `Confirma tu reseña en el libro de visitas de ${PERSONA.osName}`,
      text: confirmationText(value, link),
    });
  } catch {
    return end(502, 'send_failed');
  }
  return end(200, 'sent');
}

/** Nada de lo que escribe el visitante (ni su nombre) va en el correo de confirmación: este correo sale de nuestro dominio hacia un tercero. */
function confirmationText(value: GuestbookInput, link: string): string {
  const hours = TOKEN_TTL_MS / 3_600_000;
  return [
    'Hola:',
    '',
    `Has pedido ${ACTION[value.kind].verb} en el libro de visitas de ${PERSONA.osName}. Para confirmar que este correo es tuyo, abre este enlace y pulsa «Confirmar»:`,
    '',
    link,
    '',
    `El enlace caduca en ${hours} horas. Cuando lo confirmes, ${PERSONA.firstName} revisará tu petición y, si todo está bien, la publicará. Tu correo no se publica.`,
    '',
    'Si no has sido tú, ignora este mensaje: no pasará nada.',
    '',
  ].join('\n');
}

/** Paso 2: el visitante abre el enlace y pulsa «Confirmar»; la reseña llega a Pol. */
export async function handleConfirm(req: GuestbookRequest, deps: Omit<GuestbookDeps, 'verifyTurnstile'>): Promise<GuestbookResult> {
  const end = makeEnd(deps);
  const read = await readJson(req, deps, end);
  if ('error' in read) return read.error;

  const token = typeof read.body.token === 'string' ? read.body.token : '';
  if (!token || token.length > LIMITS.token) return end(422, 'invalid_token');

  const { to, from, secret } = deps.config;
  if (!to || !from || !secret) return end(500, 'not_configured');

  const opened = await openToken<unknown>(token, secret, deps.now());
  if (!opened.ok) return opened.reason === 'expired' ? end(410, 'expired') : end(422, 'invalid_token');
  // Lo que hay dentro lo escribió este servidor, pero se vuelve a validar: ante la duda, no se manda.
  const checked = validateGuestbook({ ...(opened.data as Record<string, unknown>), consent: true });
  if (!checked.ok) return end(422, 'invalid_token');
  const { value } = checked;

  // Una pulsación repetida no manda otro correo a Pol hasta pasado un minuto.
  const limited = await deps.keyLimiter.limit({ key: `token:${await fingerprint(token)}` });
  if (!limited.success) return end(429, 'rate_limited');

  try {
    await deps.sendEmail({
      from: { email: from, name: PERSONA.osName },
      to,
      replyTo: value.email,
      subject: `[${PERSONA.osName} · Libro de visitas] ${ACTION[value.kind].title}: ${value.name}`,
      text: notificationText(value, new Date(deps.now()).toISOString().slice(0, 10)),
    });
  } catch {
    return end(502, 'send_failed');
  }
  return end(200, 'confirmed');
}

function notificationText(value: GuestbookInput, today: string): string {
  const file = `src/content/guestbook/${slugify(value.name)}.json`;
  const links = value.links.length ? value.links.map((l) => `${networkLabel(l.network)}: ${l.url}`).join('\n') : '(ninguna)';
  const head = [
    `${ACTION[value.kind].title} en el libro de visitas. La persona ha confirmado este correo: ${value.email}`,
    '',
    `Nombre: ${value.name}`,
    `Detalle: ${value.detail || '(ninguno)'}`,
    `Relación: ${relationLabel(value.relation)}`,
    `Redes:\n${links}`,
  ];

  if (value.kind === 'remove') {
    return [
      ...head,
      '',
      '— Qué hacer —',
      'Pide retirar su reseña. Comprueba que este correo es el mismo que el de la reseña original (el correo del mensaje en que la recibiste) y, si lo es, borra su archivo de src/content/guestbook/ y despliega.',
      '',
    ].join('\n');
  }

  const intro =
    value.kind === 'edit'
      ? 'Pide EDITAR su reseña. Comprueba que este correo es el mismo que el de la original y, si lo es, sustituye el archivo existente por este contenido.'
      : 'Si la apruebas, guarda este contenido como archivo nuevo y despliega.';
  return [
    ...head,
    '',
    'Texto:',
    value.text,
    '',
    '— Qué hacer —',
    intro,
    `Archivo sugerido: ${file}`,
    '',
    JSON.stringify(toEntry(value, today), null, 2),
    '',
  ].join('\n');
}
