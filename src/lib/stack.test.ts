import { describe, expect, test } from 'vitest';
import { CATEGORIES, TOOLS } from './stack-catalog';
import { barPercent, buildTools, byYear, groupByCategory, sameData, summary, usesTool, type RepoFacts, type StackData } from './stack';

const repo = (over: Partial<RepoFacts> = {}): RepoFacts => ({ createdYear: 2025, languages: {}, deps: [], files: [], ...over });
const tool = (id: string) => TOOLS.find((t) => t.id === id)!;

describe('usesTool: cuándo un repositorio usa una herramienta', () => {
  test('por dependencia: react-dom cuenta como React', () => {
    expect(usesTool(repo({ deps: ['react-dom'] }), tool('react'))).toBe(true);
    expect(usesTool(repo({ deps: ['preact'] }), tool('react'))).toBe(false);
  });

  test('por prefijo: cualquier paquete de @radix-ui cuenta como Radix UI', () => {
    expect(usesTool(repo({ deps: ['@radix-ui/react-select'] }), tool('radix'))).toBe(true);
    expect(usesTool(repo({ deps: ['radix-ui-falso'] }), tool('radix'))).toBe(false);
  });

  test('por archivo: CLAUDE.md es Claude Code, y wrangler.jsonc en una subcarpeta es Cloudflare', () => {
    expect(usesTool(repo({ files: ['CLAUDE.md'] }), tool('claude-code'))).toBe(true);
    expect(usesTool(repo({ files: ['packages/server/wrangler.jsonc'] }), tool('cloudflare'))).toBe(true);
    expect(usesTool(repo({ files: ['docs/CLAUDE.mdx'] }), tool('claude-code'))).toBe(false);
  });

  test('por carpeta: cualquier archivo de .github/workflows cuenta como GitHub Actions', () => {
    expect(usesTool(repo({ files: ['.github/workflows/ci.yml'] }), tool('github-actions'))).toBe(true);
    expect(usesTool(repo({ files: ['docs/.github-no/workflows'] }), tool('github-actions'))).toBe(false);
  });

  test('por lenguaje: solo si supera el 5 % del código (si no, HTML y CSS saldrían en todos)', () => {
    expect(usesTool(repo({ languages: { TypeScript: 900, HTML: 100 } }), tool('html-css'))).toBe(true);
    expect(usesTool(repo({ languages: { TypeScript: 990, HTML: 10 } }), tool('html-css'))).toBe(false);
    expect(usesTool(repo({ languages: {} }), tool('html-css'))).toBe(false);
  });

  test('Tauri también se detecta por Cargo, y entonces Rust cuenta', () => {
    const tauri = repo({ deps: ['cargo:tauri'] });
    expect(usesTool(tauri, tool('tauri'))).toBe(true);
    expect(usesTool(tauri, tool('rust'))).toBe(true);
  });
});

describe('buildTools', () => {
  const repos = [
    repo({ createdYear: 2024, deps: ['react', 'react-dom', 'next', 'tailwindcss'], languages: { TypeScript: 100 } }),
    repo({ createdYear: 2025, deps: ['react', 'react-dom', 'vitest'], files: ['CLAUDE.md'], languages: { TypeScript: 100 } }),
    repo({ createdYear: 2026, deps: ['astro'], files: ['CLAUDE.md'], languages: { Astro: 100 } }),
  ];
  const tools = buildTools(repos);
  const by = (id: string) => tools.find((t) => t.id === id)!;

  test('cuenta en cuántos repositorios aparece cada herramienta', () => {
    expect(by('react').repos).toBe(2);
    expect(by('typescript').repos).toBe(2);
    expect(by('claude-code').repos).toBe(2);
    expect(by('nextjs').repos).toBe(1);
  });

  test('el año es el del primer repositorio donde aparece', () => {
    expect(by('react').since).toBe(2024);
    expect(by('claude-code').since).toBe(2025);
    expect(by('astro').since).toBe(2026);
  });

  test('el año nunca es anterior a la existencia de la herramienta (un repo de 2023 con CLAUDE.md no usa Claude Code desde 2023)', () => {
    const old = buildTools([repo({ createdYear: 2023, files: ['CLAUDE.md'], deps: ['react'] })]);
    expect(old.find((t) => t.id === 'claude-code')!.since).toBe(2025);
    expect(old.find((t) => t.id === 'react')!.since).toBe(2023);
  });

  test('lo que no aparece en ningún repositorio no sale, y lo que no está en el catálogo tampoco', () => {
    expect(tools.find((t) => t.id === 'swift')).toBeUndefined();
    expect(buildTools([repo({ deps: ['una-libreria-menor'] })])).toEqual([]);
  });

  test('sale ordenado por categoría, luego por uso y luego por nombre', () => {
    const order = CATEGORIES.map((c) => c.id);
    const categories = tools.map((t) => order.indexOf(t.category));
    expect(categories).toEqual([...categories].sort((a, b) => a - b));
    const interfaz = tools.filter((t) => t.category === 'interfaz');
    expect(interfaz[0].id).toBe('react');
  });

  test('sin repositorios no hay herramientas', () => {
    expect(buildTools([])).toEqual([]);
  });

  test('cada herramienta del catálogo tiene un id único y una categoría que existe', () => {
    const ids = TOOLS.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const t of TOOLS) expect(CATEGORIES.some((c) => c.id === t.category), t.id).toBe(true);
  });
});

describe('presentación', () => {
  const tools = buildTools([
    repo({ createdYear: 2023, deps: ['react-dom'], languages: { JavaScript: 100 } }),
    repo({ createdYear: 2026, deps: ['react-dom', 'astro'], files: ['CLAUDE.md'] }),
  ]);

  test('groupByCategory conserva el orden del catálogo y omite las categorías vacías', () => {
    const groups = groupByCategory(tools);
    expect(groups.map((g) => g.id)).toEqual(['lenguajes', 'interfaz', 'ia']);
    expect(groups.every((g) => g.tools.length > 0)).toBe(true);
  });

  test('barPercent es proporcional al más usado y siempre se ve algo', () => {
    expect(barPercent(10, 10)).toBe(100);
    expect(barPercent(5, 10)).toBe(50);
    expect(barPercent(1, 100)).toBe(4);
    expect(barPercent(0, 10)).toBe(0);
    expect(barPercent(3, 0)).toBe(0);
  });

  test('byYear agrupa por año de primer uso, del más antiguo al más reciente', () => {
    const years = byYear(tools);
    expect(years.map((y) => y.year)).toEqual([2023, 2026]);
    expect(years[0].tools).toContain('React');
    expect(years[1].tools).toEqual(expect.arrayContaining(['Astro', 'Claude Code']));
  });

  test('summary da el número de herramientas y de repositorios', () => {
    expect(summary({ repos: { total: 12, public: 3, private: 9 }, tools })).toEqual({ tools: tools.length, repos: 12 });
  });

  test('sameData ignora la fecha de generación pero no los datos', () => {
    const a: StackData = { generatedAt: '2026-10-01', repos: { total: 1, public: 1, private: 0 }, tools };
    expect(sameData(a, { ...a, generatedAt: '2026-10-09' })).toBe(true);
    expect(sameData(a, { ...a, repos: { total: 2, public: 2, private: 0 } })).toBe(false);
    expect(sameData(a, { ...a, tools: tools.slice(1) })).toBe(false);
  });
});
