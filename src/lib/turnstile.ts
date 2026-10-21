/** Verificación de Turnstile en el servidor (siteverify). Nunca se llama desde el navegador. */

export const SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
const TIMEOUT_MS = 5000;

type FetchLike = (url: string, init: RequestInit) => Promise<Pick<Response, 'ok' | 'json'>>;

/** true solo si Cloudflare confirma el token. Ante cualquier fallo, false: ante la duda, no se envía. */
export async function verifyTurnstile(
  token: string,
  secret: string,
  ip: string | null,
  fetchImpl: FetchLike = fetch,
): Promise<boolean> {
  const body = new URLSearchParams({ secret, response: token });
  if (ip) body.set('remoteip', ip);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetchImpl(SITEVERIFY_URL, { method: 'POST', body, signal: controller.signal });
    if (!res.ok) return false;
    const data = (await res.json()) as { success?: unknown };
    return data.success === true;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}
