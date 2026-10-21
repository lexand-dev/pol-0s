/**
 * POST /api/guestbook — paso 1 del Libro de visitas (S-09): valida la reseña y manda el enlace de confirmación al visitante.
 * Aquí solo se conectan los bindings reales; la lógica está en src/lib/guestbook-service.ts.
 */
import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { handleSubmit } from '../../lib/guestbook-service';
import { jsonResponse } from '../../lib/json-response';
import { verifyTurnstile } from '../../lib/turnstile';

// El resto de páginas se pre-renderiza; esta se ejecuta bajo demanda.
export const prerender = false;

// `wrangler types` toma los nombres de los secretos de `.dev.vars` si existe (y puede no tener este), así que no se fía de ese tipo.
const guestbookSecret = () => (env as unknown as Record<string, string | undefined>).GUESTBOOK_SECRET;

export const ALL: APIRoute = async ({ request }) => {
  const length = request.headers.get('content-length');
  const result = await handleSubmit(
    {
      method: request.method,
      contentType: request.headers.get('content-type'),
      contentLength: length !== null && /^\d+$/.test(length) ? Number(length) : null,
      // Cloudflare fija esta cabecera en el borde; un cliente no puede falsearla en producción.
      ip: request.headers.get('cf-connecting-ip'),
      readBody: () => request.text(),
    },
    {
      ipLimiter: env.GUESTBOOK_LIMITER,
      keyLimiter: env.GUESTBOOK_KEY_LIMITER,
      verifyTurnstile: (token, ip) => verifyTurnstile(token, env.TURNSTILE_SECRET_KEY ?? '', ip),
      sendEmail: (message) => env.EMAIL.send(message),
      config: { to: env.CONTACT_TO, from: env.CONTACT_FROM, siteUrl: env.SITE_URL, secret: guestbookSecret() },
      now: () => Date.now(),
      // Solo códigos y estados: ni el texto ni el correo se registran nunca.
      log: ({ code, status }) => {
        if (status >= 500) console.error(`[guestbook] ${code} ${status}`);
      },
    },
  );
  return jsonResponse(result);
};
