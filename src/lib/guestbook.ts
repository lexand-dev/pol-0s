/**
 * Lógica pura del Libro de visitas (S-09): qué se puede enviar, cómo se valida y cómo queda una reseña publicada. La usan el
 * formulario del navegador, el servidor y los tests, así que no toca red ni DOM.
 *
 * Todo es texto plano: nada de lo que llega se interpreta como HTML. Las redes sociales se eligen de una lista cerrada y se
 * guarda la dirección canónica `https://` de esa red, nunca una dirección libre.
 */
import { PERSONA } from '../content/persona';

export const LIMITS = { name: 80, detail: 80, text: 600, textMin: 20, email: 254, links: 3, token: 4096 } as const;

export const RELATIONS = [
  { id: 'companero', label: 'Compañero/a de trabajo' },
  { id: 'cliente', label: 'Cliente' },
  { id: 'alumno', label: 'Alumno/a' },
  { id: 'otro', label: 'Otro' },
] as const;
export type RelationId = (typeof RELATIONS)[number]['id'];

export const NETWORKS = [
  { id: 'linkedin', label: 'LinkedIn' },
  { id: 'github', label: 'GitHub' },
  { id: 'x', label: 'X' },
  { id: 'instagram', label: 'Instagram' },
  { id: 'youtube', label: 'YouTube' },
] as const;
export type NetworkId = (typeof NETWORKS)[number]['id'];

export const KINDS = ['new', 'edit', 'remove'] as const;
export type Kind = (typeof KINDS)[number];

export interface SocialLink {
  network: NetworkId;
  url: string;
}

/** Una reseña publicada: un archivo de `src/content/guestbook/`. Nunca lleva correo. */
export interface GuestbookEntry {
  name: string;
  /** Cargo o lugar, opcional («Product Designer | Barcelona, España»). */
  detail?: string;
  relation: RelationId;
  text: string;
  links: SocialLink[];
  /** Fecha ISO (`2026-10-11`). Las reseñas heredadas de la web antigua no la tienen. */
  date?: string;
  /** Desempata las reseñas de una misma fecha (y ordena las que no tienen fecha). */
  order?: number;
}

export const relationLabel = (id: string) => RELATIONS.find((r) => r.id === id)?.label ?? 'Otro';
export const networkLabel = (id: string) => NETWORKS.find((n) => n.id === id)?.label ?? id;

// ─── Redes sociales ────────────────────────────────────────────────────────────────────────────────────────────
interface NetworkRule {
  hosts: string[];
  /** Cómo es un nombre de usuario válido en esa red. */
  handle: RegExp;
  /** Prefijo de la ruta antes del usuario (`in` en LinkedIn). */
  prefix?: string;
  /** Si la red escribe la arroba en la ruta (YouTube: `/@usuario`). */
  at?: boolean;
  url(handle: string): string;
}

const RULES: Record<NetworkId, NetworkRule> = {
  linkedin: { hosts: ['linkedin.com', 'www.linkedin.com', 'es.linkedin.com'], handle: /^[A-Za-z0-9._%-]{3,100}$/, prefix: 'in', url: (h) => `https://www.linkedin.com/in/${h}` },
  github: { hosts: ['github.com', 'www.github.com'], handle: /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/, url: (h) => `https://github.com/${h}` },
  x: { hosts: ['x.com', 'www.x.com', 'twitter.com', 'www.twitter.com'], handle: /^[A-Za-z0-9_]{1,15}$/, url: (h) => `https://x.com/${h}` },
  instagram: { hosts: ['instagram.com', 'www.instagram.com'], handle: /^[A-Za-z0-9._]{1,30}$/, url: (h) => `https://www.instagram.com/${h}` },
  youtube: { hosts: ['youtube.com', 'www.youtube.com', 'm.youtube.com'], handle: /^[A-Za-z0-9._-]{3,30}$/, at: true, url: (h) => `https://www.youtube.com/@${h}` },
};

/**
 * La dirección canónica de un perfil, o null si no vale. Acepta el usuario (con o sin arroba) o una dirección completa de esa
 * red. Cualquier otro dominio, protocolo, puerto o credencial en la dirección se rechaza.
 */
export function normalizeLink(network: string, input: string): string | null {
  // `Object.hasOwn`: un nombre como `constructor` o `__proto__` no debe encontrar propiedades heredadas.
  const rule = Object.hasOwn(RULES, network) ? RULES[network as NetworkId] : undefined;
  const raw = input.trim();
  if (!rule || !raw) return null;

  if (!/^[a-z][a-z0-9+.-]*:/i.test(raw) && !raw.includes('/')) {
    const handle = raw.replace(/^@/, '');
    return rule.handle.test(handle) ? rule.url(handle) : null;
  }

  let url: URL;
  try {
    url = new URL(/^[a-z][a-z0-9+.-]*:/i.test(raw) ? raw : `https://${raw}`);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
  if (url.username || url.password || url.port) return null;
  if (!rule.hosts.includes(url.hostname.toLowerCase())) return null;

  const segments = url.pathname.split('/').filter(Boolean);
  let handle: string | undefined;
  if (rule.prefix) handle = segments[0]?.toLowerCase() === rule.prefix ? segments[1] : undefined;
  else handle = segments[0];
  if (rule.at) handle = handle?.replace(/^@/, '');
  return handle && rule.handle.test(handle) ? rule.url(handle) : null;
}

// ─── Validación del formulario ─────────────────────────────────────────────────────────────────────────────────
export type FieldName = 'kind' | 'name' | 'detail' | 'relation' | 'text' | 'email' | 'links' | 'consent';
export type FieldErrors = Partial<Record<FieldName, string>>;

export interface GuestbookInput {
  kind: Kind;
  name: string;
  detail: string;
  relation: RelationId;
  text: string;
  email: string;
  links: SocialLink[];
}

export type Validation = { ok: true; value: GuestbookInput } | { ok: false; errors: FieldErrors };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const LINE_BREAK_RE = /[\r\n]/;
/** Caracteres de control (salvo el salto de línea) y los que invierten el sentido del texto para falsear un nombre. */
const FORBIDDEN_RE = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F‪-‮⁦-⁩]/;

const asText = (v: unknown) => (typeof v === 'string' ? v.trim() : '');

export function validateGuestbook(raw: unknown): Validation {
  const data = typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {};
  const errors: FieldErrors = {};

  const kind = KINDS.find((k) => k === data.kind);
  if (!kind) errors.kind = 'Elige qué quieres hacer.';
  const removing = kind === 'remove';

  const name = asText(data.name);
  if (!name) errors.name = 'Escribe el nombre que quieres que se vea.';
  else if (LINE_BREAK_RE.test(name) || FORBIDDEN_RE.test(name)) errors.name = 'El nombre debe ir en una sola línea y sin caracteres especiales.';
  else if (name.length > LIMITS.name) errors.name = `El nombre admite hasta ${LIMITS.name} caracteres.`;

  const detail = asText(data.detail);
  if (LINE_BREAK_RE.test(detail) || FORBIDDEN_RE.test(detail)) errors.detail = 'Debe ir en una sola línea y sin caracteres especiales.';
  else if (detail.length > LIMITS.detail) errors.detail = `Admite hasta ${LIMITS.detail} caracteres.`;

  const relation = RELATIONS.find((r) => r.id === data.relation)?.id;
  if (!relation && !removing) errors.relation = `Elige cómo conoces a ${PERSONA.firstName}.`;

  const text = asText(data.text).replace(/\r\n?/g, '\n');
  if (!removing) {
    if (!text) errors.text = 'Escribe tu reseña.';
    else if (FORBIDDEN_RE.test(text)) errors.text = 'El texto contiene caracteres no válidos.';
    else if (text.length < LIMITS.textMin) errors.text = `Cuéntanos un poco más: mínimo ${LIMITS.textMin} caracteres.`;
    else if (text.length > LIMITS.text) errors.text = `La reseña admite hasta ${LIMITS.text} caracteres.`;
  }

  const email = asText(data.email);
  if (!email) errors.email = 'Escribe tu correo: lo usamos solo para confirmar que es tuyo.';
  else if (LINE_BREAK_RE.test(email) || !EMAIL_RE.test(email)) errors.email = 'Ese correo no parece válido. Revisa que tenga @ y dominio.';
  else if (email.length > LIMITS.email) errors.email = 'Ese correo es demasiado largo.';

  const links: SocialLink[] = [];
  if (!removing && data.links !== undefined) {
    const list = Array.isArray(data.links) ? data.links : null;
    if (!list || list.length > LIMITS.links) errors.links = `Puedes añadir hasta ${LIMITS.links} redes.`;
    else {
      for (const item of list) {
        const entry = typeof item === 'object' && item !== null ? (item as Record<string, unknown>) : {};
        const value = asText(entry.value ?? entry.url);
        if (!value) continue; // una fila vacía se ignora
        const url = normalizeLink(typeof entry.network === 'string' ? entry.network : '', value);
        if (!url) {
          errors.links = `«${value.slice(0, 40)}» no es un perfil válido de esa red. Usa tu usuario o la dirección de tu perfil.`;
          break;
        }
        const network = entry.network as NetworkId;
        if (!links.some((l) => l.url === url)) links.push({ network, url });
      }
    }
  }

  if (data.consent !== true) errors.consent = 'Necesitamos que aceptes el aviso de privacidad.';

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, value: { kind: kind!, name, detail, relation: relation ?? 'otro', text: removing ? '' : text, email, links } };
}

// ─── Reseñas publicadas ────────────────────────────────────────────────────────────────────────────────────────
/** El nombre del archivo que se le sugiere a Pol: el del autor, en minúsculas y sin acentos. */
export function slugify(name: string): string {
  const slug = name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
    .replace(/-+$/g, '');
  return slug || 'resena';
}

/** La reseña como la guarda el repositorio: sin correo y con la fecha en que se publica. */
export function toEntry(value: GuestbookInput, today: string): GuestbookEntry {
  return {
    name: value.name,
    ...(value.detail ? { detail: value.detail } : {}),
    relation: value.relation,
    text: value.text,
    links: value.links,
    date: today,
  };
}

interface Sortable {
  id: string;
  date?: string | undefined;
  order?: number | undefined;
}

/** De la más reciente a la más antigua. Las que no tienen fecha (las heredadas) cuentan como las más antiguas. */
export function sortEntries<T extends Sortable>(entries: readonly T[]): T[] {
  const time = (e: T) => (e.date ? Date.parse(e.date) : Number.NEGATIVE_INFINITY);
  return [...entries].sort((a, b) => {
    const diff = time(b) === time(a) ? 0 : time(b) > time(a) ? 1 : -1;
    return diff || (a.order ?? 0) - (b.order ?? 0) || a.id.localeCompare(b.id);
  });
}
