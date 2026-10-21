#!/usr/bin/env node
/**
 * Copia de GitHub los lenguajes, las etiquetas y la licencia de los proyectos con repositorio público
 * (campo `repo` de src/content/projects/*.json) y los guarda en su campo `github`.
 *
 * Solo lee la API pública, sin claves. Se lanza a mano y el resultado se commitea: así el sitio no depende de
 * GitHub al compilar ni cuando alguien lo visita.
 *
 *   node scripts/actualizar-proyectos.mjs           # actualiza los JSON
 *   node scripts/actualizar-proyectos.mjs --dry     # solo enseña qué cambiaría
 */
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { toGithubInfo } from '../src/lib/github-info.ts';

const dir = new URL('../src/content/projects/', import.meta.url);
const dry = process.argv.includes('--dry');
// Con token el límite de GitHub es mucho mayor: las IP compartidas de GitHub Actions agotan enseguida el de las
// peticiones anónimas (60 por hora).
const token = process.env.STACK_GITHUB_TOKEN || process.env.GH_TOKEN || process.env.GITHUB_TOKEN;
const headers = {
  Accept: 'application/vnd.github+json',
  'User-Agent': 'pol-os-actualizar-proyectos',
  ...(token ? { Authorization: `Bearer ${token}` } : {}),
};

async function get(path) {
  const res = await fetch(`https://api.github.com/${path}`, { headers });
  if (!res.ok) throw new Error(`${path}: ${res.status} ${res.statusText}`);
  return res.json();
}

let changed = 0;
let failed = 0;
for (const file of readdirSync(dir).filter((f) => f.endsWith('.json')).sort()) {
  const url = new URL(file, dir);
  const project = JSON.parse(readFileSync(url, 'utf8'));
  if (!project.repo) continue;
  try {
    const [repo, languages] = await Promise.all([get(`repos/${project.repo}`), get(`repos/${project.repo}/languages`)]);
    if (repo.private) throw new Error('el repositorio es privado: quita `repo` de este proyecto');
    const info = toGithubInfo(repo, languages);
    const same = JSON.stringify(project.github) === JSON.stringify(info);
    console.log(`${same ? '=' : '~'} ${file}: ${info.languages.map((l) => l.name).join(', ')} · ${info.license ?? 'sin licencia'}`);
    if (same) continue;
    changed += 1;
    if (!dry) writeFileSync(url, `${JSON.stringify({ ...project, github: info }, null, 2)}\n`);
  } catch (error) {
    failed += 1;
    console.error(`! ${file}: ${error.message}`);
  }
}
console.log(`${dry ? 'Cambiarían' : 'Actualizados'}: ${changed}. Con error: ${failed}.`);
process.exitCode = failed ? 1 : 0;
