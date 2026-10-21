/**
 * Lógica pura del Stack (M-05): de los datos de cada repositorio a lo que enseña la ventana. La usan
 * scripts/actualizar-stack.mjs (sin compilar), la ventana y los tests, así que solo lleva sintaxis que Node ejecuta
 * tal cual y nada de `node:`.
 */
import { CATEGORIES, TOOLS, type CategoryId, type ToolDef } from './stack-catalog.ts';

/** Lo que el script averigua de cada repositorio. Nunca lleva su nombre. */
export interface RepoFacts {
  createdYear: number;
  /** Bytes de código por lenguaje, como los da GitHub. */
  languages: Record<string, number>;
  /** Dependencias de todos sus `package.json`, y las de Cargo como `cargo:nombre`. */
  deps: string[];
  /** Rutas de los archivos del repositorio. */
  files: string[];
}

export interface StackTool {
  id: string;
  name: string;
  category: CategoryId;
  /** En cuántos repositorios aparece. */
  repos: number;
  /** Año del primer repositorio en que aparece. */
  since: number;
}

export interface StackData {
  generatedAt: string;
  repos: { total: number; public: number; private: number };
  tools: StackTool[];
}

/** Un lenguaje cuenta si supera este porcentaje del código del repositorio (si no, HTML y CSS saldrían en todos). */
export const LANGUAGE_MIN_SHARE = 5;

const hasFile = (files: readonly string[], wanted: string) =>
  files.some((f) => f === wanted || f.endsWith(`/${wanted}`) || f.startsWith(`${wanted}/`) || f.includes(`/${wanted}/`));

export function usesTool(repo: RepoFacts, tool: ToolDef): boolean {
  const total = Object.values(repo.languages).reduce((sum, b) => sum + b, 0);
  const byLanguage = (tool.languages ?? []).some((name) => total > 0 && ((repo.languages[name] ?? 0) / total) * 100 >= LANGUAGE_MIN_SHARE);
  const byDep = repo.deps.some((dep) => (tool.deps ?? []).includes(dep) || (tool.depPrefixes ?? []).some((p) => dep.startsWith(p)));
  const byFile = (tool.files ?? []).some((f) => hasFile(repo.files, f));
  return byLanguage || byDep || byFile;
}

/** Cuenta cada herramienta del catálogo en los repositorios. Las que no aparecen en ninguno no salen. */
export function buildTools(repos: readonly RepoFacts[], catalog: readonly ToolDef[] = TOOLS): StackTool[] {
  const order = new Map<CategoryId, number>(CATEGORIES.map((c, i) => [c.id, i]));
  const tools: StackTool[] = [];
  for (const tool of catalog) {
    const using = repos.filter((r) => usesTool(r, tool));
    if (using.length === 0) continue;
    tools.push({
      id: tool.id,
      name: tool.name,
      category: tool.category,
      repos: using.length,
      // El año del primer repositorio, pero nunca antes de que la herramienta existiera.
      since: Math.max(tool.introduced ?? 0, Math.min(...using.map((r) => r.createdYear))),
    });
  }
  return tools.sort(
    (a, b) => (order.get(a.category) ?? 99) - (order.get(b.category) ?? 99) || b.repos - a.repos || a.name.localeCompare(b.name, 'es'),
  );
}

export interface CategoryGroup {
  id: CategoryId;
  label: string;
  tools: StackTool[];
}

/** Las herramientas agrupadas por categoría, en el orden del catálogo y sin categorías vacías. */
export function groupByCategory(tools: readonly StackTool[]): CategoryGroup[] {
  return CATEGORIES.map((c) => ({ id: c.id, label: c.label, tools: tools.filter((t) => t.category === c.id) })).filter((g) => g.tools.length > 0);
}

/** Ancho de la barra de una herramienta: proporcional al uso de la más usada, con un mínimo para que se vea. */
export function barPercent(repos: number, max: number): number {
  if (max <= 0 || repos <= 0) return 0;
  return Math.max(4, Math.round((repos / max) * 100));
}

export interface YearEntry {
  year: number;
  tools: string[];
}

/** Qué herramientas entraron cada año, de más antiguo a más reciente. */
export function byYear(tools: readonly StackTool[]): YearEntry[] {
  const years = new Map<number, StackTool[]>();
  for (const t of tools) years.set(t.since, [...(years.get(t.since) ?? []), t]);
  return [...years.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([year, list]) => ({ year, tools: [...list].sort((a, b) => b.repos - a.repos || a.name.localeCompare(b.name, 'es')).map((t) => t.name) }));
}

export const summary = (data: Pick<StackData, 'repos' | 'tools'>) => ({ tools: data.tools.length, repos: data.repos.total });

/** Dos resultados son iguales si solo difiere la fecha: así la tarea diaria no hace commits sin cambios reales. */
export const sameData = (a: StackData, b: StackData) => JSON.stringify({ ...a, generatedAt: '' }) === JSON.stringify({ ...b, generatedAt: '' });
