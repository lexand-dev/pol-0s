import { describe, expect, test } from 'vitest';
import { PREFS_BOOT_SCRIPT } from './prefs';
import { cspDirectives, embeddableOrigins, inlineScriptHash, scriptResources } from './csp';
import { isSafeProjectUrl } from './project-url';
import { createHash } from 'node:crypto';

describe('isSafeProjectUrl', () => {
  test.each(['https://recetario.example.com', 'https://ejemplo.com/ruta?x=1', '/demo/estudio.html', '/a'])('acepta %s', (url) => {
    expect(isSafeProjectUrl(url)).toBe(true);
  });

  test.each([
    'javascript:alert(1)',
    'JavaScript:alert(1)',
    'data:text/html,<script>alert(1)</script>',
    'http://ejemplo.com',
    'ftp://ejemplo.com',
    '//otro-dominio.com/x',
    '/\\otro-dominio.com',
    'https://usuario:clave@ejemplo.com',
    'https://',
    'ejemplo.com',
    '',
    '/ruta\nconsalto',
  ])('rechaza %j', (url) => {
    expect(isSafeProjectUrl(url)).toBe(false);
  });
});

describe('embeddableOrigins', () => {
  const p = (url: string, embeddable: boolean) => ({ url, embeddable });

  test('solo entran los incrustables con dirección https, con su origen sin ruta', () => {
    expect(embeddableOrigins([p('https://recetario.example.com/app?x=1', true), p('https://panel.ejemplo.com', false)])).toEqual([
      'https://recetario.example.com',
    ]);
  });

  test('una ruta local no añade ningún origen (ya cae bajo \'self\')', () => {
    expect(embeddableOrigins([p('/demo/estudio.html', true)])).toEqual([]);
  });

  test('sin repetidos y ordenados', () => {
    expect(embeddableOrigins([p('https://b.com/1', true), p('https://a.com', true), p('https://b.com/2', true)])).toEqual([
      'https://a.com',
      'https://b.com',
    ]);
  });

  test('una dirección insegura nunca llega a la política', () => {
    expect(embeddableOrigins([p('http://a.com', true), p('javascript:alert(1)', true), p('data:text/html,x', true)])).toEqual([]);
  });
});

describe('cspDirectives', () => {
  const directives = cspDirectives([{ url: 'https://recetario.example.com', embeddable: true }, { url: 'https://panel.test', embeddable: false }]);
  const get = (name: string) => directives.find((d) => d.startsWith(`${name} `)) ?? '';

  test('cierra lo que no se usa', () => {
    expect(get('object-src')).toBe("object-src 'none'");
    expect(get('base-uri')).toBe("base-uri 'none'");
    expect(get('form-action')).toBe("form-action 'self'");
    expect(get('default-src')).toBe("default-src 'self'");
  });

  test('los marcos permitidos son Pol OS, Turnstile, el reproductor de YouTube sin cookies y los proyectos incrustables', () => {
    expect(get('frame-src')).toBe("frame-src 'self' https://challenges.cloudflare.com https://www.youtube-nocookie.com https://recetario.example.com");
    expect(get('frame-src')).not.toContain('panel.test');
  });

  test('YouTube solo puede dar el script de su API y el marco del vídeo: no hay más permisos para él', () => {
    expect(scriptResources()).toEqual(["'self'", 'https://challenges.cloudflare.com', 'https://www.youtube.com']);
    const withYoutube = directives.filter((d) => /youtube/.test(d));
    expect(withYoutube).toEqual([get('frame-src')]);
    expect(get('connect-src')).not.toMatch(/youtube/);
    expect(get('img-src')).not.toMatch(/youtube|ytimg/);
    expect(get('default-src')).not.toMatch(/youtube/);
  });

  test('no hay comodines ni autorizaciones inseguras', () => {
    const all = [...directives, ...scriptResources()].join(' ');
    expect(all).not.toMatch(/\*|unsafe-inline|unsafe-eval|http:\/\//);
  });

  test('frame-ancestors no va aquí: en una etiqueta <meta> el navegador lo ignora', () => {
    expect(directives.some((d) => d.startsWith('frame-ancestors'))).toBe(false);
  });
});

describe('inlineScriptHash', () => {
  test('es el SHA-256 en base64 del texto exacto, sin comillas (como lo pide Astro)', () => {
    const expected = createHash('sha256').update(PREFS_BOOT_SCRIPT).digest('base64');
    expect(inlineScriptHash(PREFS_BOOT_SCRIPT)).toBe(`sha256-${expected}`);
  });

  test('cambia si cambia el script', () => {
    expect(inlineScriptHash('a')).not.toBe(inlineScriptHash('b'));
  });
});
