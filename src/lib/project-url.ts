/**
 * Qué direcciones puede tener un proyecto. Solo `https://` o una ruta local (`/ruta.html`):
 * nada de `javascript:`, `data:`, `http:` ni rutas que empiecen por `//` (que el navegador lee como
 * otro dominio).
 */
export function isSafeProjectUrl(url: string): boolean {
  if (/^\/(?![/\\])/.test(url)) return !/[\r\n]/.test(url);
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' && parsed.username === '' && parsed.password === '';
  } catch {
    return false;
  }
}
