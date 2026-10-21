/**
 * Respuesta JSON de los endpoints del Worker. `_headers` no se aplica a las respuestas del Worker, así que las cabeceras de
 * seguridad (M-11) van aquí: es JSON, no necesita cargar nada y nadie debería poder incrustarla.
 */
const JSON_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store',
  'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'",
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
};

export function jsonResponse(result: { status: number; body: unknown }): Response {
  const headers: Record<string, string> = { ...JSON_HEADERS };
  if (result.status === 405) headers.Allow = 'POST';
  return new Response(JSON.stringify(result.body), { status: result.status, headers });
}
