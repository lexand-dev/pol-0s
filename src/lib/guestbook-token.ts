/**
 * El enlace de confirmación del Libro de visitas (S-09) sin guardar nada en el servidor. Lleva dentro la petición, cifrada y
 * autenticada con AES-GCM y una clave secreta del servidor: nadie puede leerla ni cambiarla, y caduca.
 *
 * Solo usa Web Crypto (existe en Workers, en Node y en el navegador); no importa módulos de Node.
 */

export const TOKEN_TTL_MS = 48 * 60 * 60 * 1000;
const VERSION = 1;
const AAD = new TextEncoder().encode('pol-os-guestbook-v1');
const IV_BYTES = 12;
const TAG_BYTES = 16;

export type OpenResult<T> = { ok: true; data: T } | { ok: false; reason: 'invalid' | 'expired' };

const toBase64Url = (bytes: Uint8Array) => {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

function fromBase64Url(text: string): Uint8Array {
  if (!/^[A-Za-z0-9_-]+$/.test(text)) throw new Error('base64url');
  const bin = atob(text.replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

async function key(secret: string): Promise<CryptoKey> {
  const material = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(secret));
  return crypto.subtle.importKey('raw', material, 'AES-GCM', false, ['encrypt', 'decrypt']);
}

/** Cifra `data` y devuelve un texto seguro para ir en una dirección. */
export async function sealToken(data: unknown, secret: string, now: number, ttl = TOKEN_TTL_MS): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const plain = new TextEncoder().encode(JSON.stringify({ v: VERSION, exp: now + ttl, data }));
  const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: AAD }, await key(secret), plain));
  const out = new Uint8Array(iv.length + cipher.length);
  out.set(iv);
  out.set(cipher, iv.length);
  return toBase64Url(out);
}

/** Descifra un token. Si lo han tocado, está cortado o es de otra clave: `invalid`. Si es auténtico pero ha caducado: `expired`. */
export async function openToken<T = unknown>(token: string, secret: string, now: number): Promise<OpenResult<T>> {
  try {
    const bytes = fromBase64Url(token);
    if (bytes.length < IV_BYTES + TAG_BYTES) return { ok: false, reason: 'invalid' };
    const iv = bytes.slice(0, IV_BYTES);
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv, additionalData: AAD }, await key(secret), bytes.slice(IV_BYTES));
    const parsed = JSON.parse(new TextDecoder().decode(plain)) as { v?: unknown; exp?: unknown; data?: T };
    if (parsed.v !== VERSION || typeof parsed.exp !== 'number') return { ok: false, reason: 'invalid' };
    if (parsed.exp < now) return { ok: false, reason: 'expired' };
    return { ok: true, data: parsed.data as T };
  } catch {
    return { ok: false, reason: 'invalid' };
  }
}

/** Una huella corta y estable de un texto, para claves del limitador sin guardar el texto en claro. */
export async function fingerprint(text: string): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)));
  return [...digest.slice(0, 16)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
