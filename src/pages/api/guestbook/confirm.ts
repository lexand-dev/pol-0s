/**
 * POST /api/guestbook/confirm — paso 2 del Libro de visitas (S-09): abre el enlace de confirmación y manda la reseña a Pol.
 * La lógica está en src/lib/guestbook-service.ts. No lleva Turnstile: el token cifrado ya prueba que se pasó por el primer paso.
 */
import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { handleConfirm } from '../../../lib/guestbook-service';
import { jsonResponse } from '../../../lib/json-response';

export const prerender = false;

// `wrangler types` toma los nombres de los secretos de `.dev.vars` si existe (y puede no tener este), así que no se fía de ese tipo.
const guestbookSecret = () => (env as unknown as Record<string, string | undefined>).GUESTBOOK_SECRET;

export const ALL: APIRoute = async ({ request }) => {
  const length = request.headers.get('content-length');
  const result = await handleConfirm(
    {
      method: request.method,
      contentType: request.headers.get('content-type'),
      contentLength: length !== null && /^\d+$/.test(length) ? Number(length) : null,
      ip: request.headers.get('cf-connecting-ip'),
      readBody: () => request.text(),
    },
    {
      ipLimiter: env.GUESTBOOK_LIMITER,
      keyLimiter: env.GUESTBOOK_KEY_LIMITER,
      sendEmail: (message) => env.EMAIL.send(message),
      config: { to: env.CONTACT_TO, from: env.CONTACT_FROM, siteUrl: env.SITE_URL, secret: guestbookSecret() },
      now: () => Date.now(),
      log: ({ code, status }) => {
        if (status >= 500) console.error(`[guestbook] ${code} ${status}`);
      },
    },
  );
  return jsonResponse(result);
};
