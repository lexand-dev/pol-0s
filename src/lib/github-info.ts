/**
 * De la respuesta de la API pública de GitHub a lo que guarda cada proyecto (campo `github` del JSON).
 * Es una función pura y solo usa sintaxis que Node ejecuta tal cual, porque la importa
 * scripts/actualizar-proyectos.mjs sin compilar.
 */

export interface GithubInfo {
  languages: { name: string; bytes: number }[];
  topics: string[];
  license: string | null;
}

interface RepoResponse {
  topics?: string[];
  license?: { spdx_id?: string | null; name?: string | null } | null;
}

export function toGithubInfo(repo: RepoResponse, languages: Record<string, number>): GithubInfo {
  const license = repo.license;
  const spdx = license?.spdx_id && license.spdx_id !== 'NOASSERTION' ? license.spdx_id : null;
  return {
    languages: Object.entries(languages)
      .filter(([, bytes]) => Number.isInteger(bytes) && bytes > 0)
      .map(([name, bytes]) => ({ name, bytes }))
      .sort((a, b) => b.bytes - a.bytes || a.name.localeCompare(b.name)),
    topics: [...(repo.topics ?? [])].sort(),
    license: spdx ?? license?.name ?? null,
  };
}
