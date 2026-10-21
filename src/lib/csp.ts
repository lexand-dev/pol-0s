/**
 * Política de seguridad de contenido (CSP) de Pol OS (M-11). Funciones puras que usan la
 * configuración de Astro (para construir la política) y los tests (para comprobarla).
 * Los hashes de los scripts y estilos que genera Astro los añade Astro solo; aquí va todo lo demás.
 */
import { createHash } from 'node:crypto';
import { isSafeProjectUrl } from './project-url';

export const TURNSTILE_ORIGIN = 'https://challenges.cloudflare.com';
/** De aquí sale el script de la API del reproductor de YouTube (S-03): solo se pide al pulsar play. */
export const YOUTUBE_SCRIPT_ORIGIN = 'https://www.youtube.com';
/** El vídeo se incrusta desde el dominio sin cookies de YouTube. */
export const YOUTUBE_FRAME_ORIGIN = 'https://www.youtube-nocookie.com';

/** Hash tal como lo pide Astro en `scriptDirective.hashes`: sin comillas simples. */
export type ScriptHash = `sha256-${string}`;

/** Directivas que acepta `security.csp.directives` de Astro (solo las que usamos). */
export type Directive =
  `${'default-src' | 'base-uri' | 'object-src' | 'form-action' | 'img-src' | 'connect-src' | 'frame-src'}${string}`;

export interface ProjectLike {
  url: string;
  embeddable: boolean;
}

/** Origen de cada proyecto incrustable con dirección absoluta; sin repetidos. Los locales no hacen falta. */
export function embeddableOrigins(projects: readonly ProjectLike[]): string[] {
  const origins = new Set<string>();
  for (const p of projects) {
    if (!p.embeddable || !isSafeProjectUrl(p.url) || p.url.startsWith('/')) continue;
    origins.add(new URL(p.url).origin);
  }
  return [...origins].sort();
}

/** Hash SHA-256, en base64, del texto exacto de un script en línea. En la política va entre comillas simples. */
export function inlineScriptHash(script: string): ScriptHash {
  return `sha256-${createHash('sha256').update(script).digest('base64')}`;
}

/**
 * Directivas que añadimos a las de Astro. Las de `script-src` y `style-src` las compone Astro con
 * sus hashes; `frame-ancestors` no cabe en una etiqueta <meta> y va por cabecera (public/_headers).
 */
export function cspDirectives(projects: readonly ProjectLike[]): Directive[] {
  return [
    "default-src 'self'",
    "base-uri 'none'",
    "object-src 'none'",
    "form-action 'self'",
    "img-src 'self' data:",
    `connect-src 'self' ${TURNSTILE_ORIGIN}`,
    `frame-src ${["'self'", TURNSTILE_ORIGIN, YOUTUBE_FRAME_ORIGIN, ...embeddableOrigins(projects)].join(' ')}`,
  ];
}

/** Lo que Astro debe permitir además de sus propios hashes en `script-src`. */
export function scriptResources(): string[] {
  return ["'self'", TURNSTILE_ORIGIN, YOUTUBE_SCRIPT_ORIGIN];
}
