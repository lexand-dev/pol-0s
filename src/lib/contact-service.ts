/**
 * Flujo del envío del formulario de Correo (M-08), sin depender de Astro ni de Cloudflare.
 * Todo lo externo (límite, Turnstile, correo, configuración) llega por `deps`: así se prueba entero
 * con dobles, sin red y sin enviar nada.
 *
 * Orden: método, tipo y tamaño → límite por IP → validación → Turnstile → envío.
 * Lo barato va primero: un cuerpo inválido nunca cuesta una llamada externa.
 *
 * Privacidad: el contenido del mensaje no se guarda ni se registra. Lo único que sale por `log` es
 * el código del resultado.
 */
import { LIMITS, validateContact, type FieldErrors } from './contact';
import { PERSONA } from '../content/persona';

export const MAX_BODY_BYTES = 16 * 1024;

export type ContactCode =
  | 'sent'
  | 'method_not_allowed'
  | 'unsupported_media_type'
  | 'payload_too_large'
  | 'rate_limited'
  | 'invalid_body'
  | 'validation_failed'
  | 'captcha_failed'
  | 'send_failed'
  | 'not_configured';

export interface ContactResponse {
  ok: boolean;
  code: ContactCode;
  fields?: FieldErrors;
}

export interface ContactResult {
  status: number;
  body: ContactResponse;
}

export interface OutgoingEmail {
  from: { email: string; name: string };
  to: string;
  replyTo: string;
  subject: string;
  text: string;
}

export interface ContactDeps {
  limiter: { limit(options: { key: string }): Promise<{ success: boolean }> };
  verifyTurnstile(token: string, ip: string | null): Promise<boolean>;
  sendEmail(message: OutgoingEmail): Promise<unknown>;
  /** Destino y remitente salen de la configuración del servidor, nunca de la petición. */
  config: { to?: string; from?: string };
  /** Solo recibe códigos y estados, nunca contenido del mensaje. */
  log?(event: { code: ContactCode; status: number }): void;
}

export interface ContactRequest {
  method: string;
  contentType: string | null;
  contentLength: number | null;
  ip: string | null;
  readBody(): Promise<string>;
}

const byteLength = (s: string) => new TextEncoder().encode(s).length;

export async function handleContact(req: ContactRequest, deps: ContactDeps): Promise<ContactResult> {
  const end = (status: number, code: ContactCode, fields?: FieldErrors): ContactResult => {
    deps.log?.({ code, status });
    return { status, body: { ok: status === 200, code, ...(fields ? { fields } : {}) } };
  };

  if (req.method !== 'POST') return end(405, 'method_not_allowed');
  if (!req.contentType?.toLowerCase().includes('application/json')) return end(415, 'unsupported_media_type');
  if (req.contentLength !== null && req.contentLength > MAX_BODY_BYTES) return end(413, 'payload_too_large');

  // Sin IP (no debería pasar detrás de Cloudflare) todos comparten una clave: más estricto, no menos.
  const limited = await deps.limiter.limit({ key: req.ip ?? 'sin-ip' });
  if (!limited.success) return end(429, 'rate_limited');

  const text = await req.readBody();
  if (byteLength(text) > MAX_BODY_BYTES) return end(413, 'payload_too_large');

  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return end(422, 'invalid_body');
  }
  if (typeof data !== 'object' || data === null || Array.isArray(data)) return end(422, 'invalid_body');
  const body = data as Record<string, unknown>;

  // Campo trampa: un humano no lo ve ni lo rellena. A un bot se le dice que fue bien, sin enviar nada.
  if (typeof body.website === 'string' && body.website.trim() !== '') return end(200, 'sent');

  const validation = validateContact(body);
  if (!validation.ok) return end(422, 'validation_failed', validation.errors);

  const token = typeof body.turnstileToken === 'string' ? body.turnstileToken : '';
  if (!token || token.length > LIMITS.token || !(await deps.verifyTurnstile(token, req.ip))) {
    return end(403, 'captcha_failed');
  }

  const { to, from } = deps.config;
  if (!to || !from) return end(500, 'not_configured');

  const { value } = validation;
  try {
    await deps.sendEmail({
      from: { email: from, name: PERSONA.osName },
      to,
      replyTo: value.from,
      subject: `[${PERSONA.osName}] ${value.subject}`,
      text: `Mensaje enviado desde ${PERSONA.osName}\n\nDe: ${value.from}\nAsunto: ${value.subject}\n\n${value.message}\n`,
    });
  } catch {
    return end(502, 'send_failed');
  }
  return end(200, 'sent');
}
