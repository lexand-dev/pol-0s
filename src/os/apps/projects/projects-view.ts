/**
 * Lógica pura de la app Proyectos (S-08): qué botón principal lleva un proyecto, a dónde apunta su repositorio
 * y cómo se reparten sus lenguajes. Los componentes solo pintan lo que esto decide.
 */

export interface LanguageBytes {
  name: string;
  bytes: number;
}

export interface LanguageShare {
  name: string;
  /** Porcentaje entero. Todos los de una lista suman 100. */
  share: number;
}

export const OTHERS = 'Otros';

/**
 * Reparte los lenguajes en porcentajes enteros que suman 100 (método del mayor resto), de mayor a menor. Los que
 * no llegan a `minShare` % se agrupan en "Otros", al final, salvo que fuera uno solo: entonces conserva su nombre.
 */
export function languageShares(languages: readonly LanguageBytes[], minShare = 3): LanguageShare[] {
  const valid = languages.filter((l) => l.bytes > 0);
  const total = valid.reduce((sum, l) => sum + l.bytes, 0);
  if (total === 0) return [];

  const sorted = [...valid].sort((a, b) => b.bytes - a.bytes || a.name.localeCompare(b.name));
  const pct = (bytes: number) => (bytes / total) * 100;
  const big = sorted.filter((l) => pct(l.bytes) >= minShare);
  const small = sorted.filter((l) => pct(l.bytes) < minShare);

  const parts: { name: string; bytes: number }[] = [...big];
  if (small.length === 1) parts.push(small[0]);
  else if (small.length > 1) parts.push({ name: OTHERS, bytes: small.reduce((sum, l) => sum + l.bytes, 0) });

  const raw = parts.map((p) => ({ name: p.name, exact: pct(p.bytes) }));
  const floors = raw.map((r) => Math.floor(r.exact));
  let missing = 100 - floors.reduce((sum, f) => sum + f, 0);
  const byRemainder = raw.map((r, i) => ({ i, rest: r.exact - floors[i] })).sort((a, b) => b.rest - a.rest || a.i - b.i);
  for (const { i } of byRemainder) {
    if (missing <= 0) break;
    floors[i] += 1;
    missing -= 1;
  }
  return raw.map((r, i) => ({ name: r.name, share: floors[i] }));
}

export const repoUrl = (repo: string) => `https://github.com/${repo}`;

export type PrimaryAction =
  | { kind: 'browser'; label: string }
  | { kind: 'external'; label: string; href: string };

const isGithub = (url: string) => {
  try {
    return new URL(url).hostname === 'github.com';
  } catch {
    return false;
  }
};

/**
 * El botón principal de un proyecto: abrirlo en el Navegador si su sitio se deja incrustar y, si no, una pestaña
 * nueva (nunca una ventana en blanco). Si su dirección es la de GitHub, el texto lo dice.
 */
export function primaryAction(p: { embeddable: boolean; url: string }): PrimaryAction {
  if (p.embeddable) return { kind: 'browser', label: 'Abrir en el Navegador' };
  return { kind: 'external', label: isGithub(p.url) ? 'Ver en GitHub' : 'Visitar sitio', href: p.url };
}

/** El botón del repositorio: solo si es público y no repite la dirección del botón principal. */
export function repoButton(p: { repo?: string; url: string }): { label: string; href: string } | null {
  if (!p.repo) return null;
  const href = repoUrl(p.repo);
  return href === p.url ? null : { label: 'Ver repositorio', href };
}

export interface DetailSections {
  what: boolean;
  madeWith: boolean;
  languages: boolean;
  topics: boolean;
  license: boolean;
  screenshots: boolean;
}

/** Qué apartados del detalle se enseñan: solo los que tienen contenido, nunca uno vacío ni un botón roto. */
export function detailSections(p: {
  details: readonly string[];
  stack: readonly string[];
  screenshots: readonly unknown[];
  github?: { languages: readonly LanguageBytes[]; topics: readonly string[]; license: string | null };
}): DetailSections {
  const languages = languageShares(p.github?.languages ?? []).length > 0;
  const topics = (p.github?.topics.length ?? 0) > 0;
  const license = !!p.github?.license;
  return {
    what: p.details.length > 0,
    madeWith: p.stack.length > 0 || languages || topics || license,
    languages,
    topics,
    license,
    screenshots: p.screenshots.length > 0,
  };
}

