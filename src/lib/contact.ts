/**
 * Validación del formulario de Correo (M-08). La usan el cliente y el servidor, así el visitante
 * ve el mismo error que el servidor habría dado. Es pura: no toca red ni DOM.
 */
import { PERSONA } from '../content/persona';

export const LIMITS = { email: 254, subject: 150, message: 5000, token: 2048 } as const;

export type FieldName = 'from' | 'subject' | 'message';
export type FieldErrors = Partial<Record<FieldName, string>>;

export interface ContactInput {
  from: string;
  subject: string;
  message: string;
}

export type Validation = { ok: true; value: ContactInput } | { ok: false; errors: FieldErrors };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
/** Un salto de línea en una cabecera permitiría colar otras cabeceras. */
const LINE_BREAK_RE = /[\r\n]/;

const asText = (v: unknown) => (typeof v === 'string' ? v.trim() : '');

export function validateContact(raw: unknown): Validation {
  const data = typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {};
  const from = asText(data.from);
  const subject = asText(data.subject);
  const message = asText(data.message);
  const errors: FieldErrors = {};

  if (!from) errors.from = `Escribe tu correo para que ${PERSONA.firstName} pueda responderte.`;
  else if (LINE_BREAK_RE.test(from) || !EMAIL_RE.test(from)) {
    errors.from = 'Ese correo no parece válido. Revisa que tenga @ y dominio.';
  } else if (from.length > LIMITS.email) errors.from = 'Ese correo es demasiado largo.';

  if (!subject) errors.subject = 'Añade un asunto.';
  else if (LINE_BREAK_RE.test(subject)) errors.subject = 'El asunto debe ir en una sola línea.';
  else if (subject.length > LIMITS.subject) errors.subject = `El asunto admite hasta ${LIMITS.subject} caracteres.`;

  if (!message) errors.message = 'El mensaje está vacío.';
  else if (message.length > LIMITS.message) {
    errors.message = `El mensaje admite hasta ${LIMITS.message.toLocaleString('es-ES')} caracteres.`;
  }

  return Object.keys(errors).length > 0 ? { ok: false, errors } : { ok: true, value: { from, subject, message } };
}
