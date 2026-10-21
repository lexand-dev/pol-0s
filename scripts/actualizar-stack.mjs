#!/usr/bin/env node
/**
 * Actualiza `src/content/stack.json` (la ventana Stack, M-05) analizando los repositorios de Pol en GitHub:
 * lenguajes, dependencias de `package.json` y de Cargo, archivos reveladores y año de creación. Cada dependencia se
 * traduce a una herramienta con el catálogo de `src/lib/stack-catalog.ts`.
 *
 * Privacidad: de los repositorios privados solo se publican recuentos. Ningún nombre de repositorio llega al archivo, y
 * el script se niega a escribirlo si alguno se colara.
 *
 * Necesita un token de GitHub en `STACK_GITHUB_TOKEN`, `GH_TOKEN` o `GITHUB_TOKEN`:
 *  - con un token de Pol (permiso de lectura de sus repositorios) cuenta también los privados;
 *  - con el token por defecto de GitHub Actions, solo los públicos.
 * Sin token el límite de peticiones de GitHub (60 por hora) se agota enseguida, así que no se intenta.
 *
 *   node scripts/actualizar-stack.mjs           # actualiza el archivo si hay cambios
 *   node scripts/actualizar-stack.mjs --dry     # solo enseña el resultado
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { buildTools, sameData } from '../src/lib/stack.ts';
import { PERSONA } from '../src/content/persona.ts';

const OWNER = PERSONA.github;
const salida = new URL('../src/content/stack.json', import.meta.url);
const dry = process.argv.includes('--dry');
const token = process.env.STACK_GITHUB_TOKEN || process.env.GH_TOKEN || process.env.GITHUB_TOKEN;
if (!token) {
  console.error('Falta un token de GitHub (STACK_GITHUB_TOKEN, GH_TOKEN o GITHUB_TOKEN).');
  process.exit(1);
}
const headers = { Accept: 'application/vnd.github+json', Authorization: `Bearer ${token}`, 'User-Agent': 'pol-os-actualizar-stack' };

async function get(path, { allow = [] } = {}) {
  const res = await fetch(path.startsWith('http') ? path : `https://api.github.com/${path}`, { headers });
  if (allow.includes(res.status)) return null;
  if (!res.ok) throw new Error(`${path.split('?')[0].replace(/repos\/[^/]+\/[^/]+/, 'repos/…')}: ${res.status} ${res.statusText}`);
  return res.json();
}

async function paginated(path) {
  const all = [];
  for (let page = 1; ; page++) {
    const batch = await get(`${path}${path.includes('?') ? '&' : '?'}per_page=100&page=${page}`);
    all.push(...batch);
    if (batch.length < 100) return all;
  }
}

// ¿El token es de Pol? Entonces ve también sus repositorios privados.
const yo = await get('user', { allow: [401, 403] }).catch(() => null);
const esDePol = yo?.login === OWNER;
const listado = esDePol ? await paginated('user/repos?affiliation=owner&visibility=all') : await paginated(`users/${OWNER}/repos?type=owner`);
const repos = listado.filter((r) => !r.fork && r.owner.login === OWNER);
console.log(`Repositorios a analizar: ${repos.length} (${esDePol ? 'públicos y privados' : 'solo públicos'}).`);

const decodificar = (c) => Buffer.from(c.content, 'base64').toString('utf8');
const rutasDe = (arbol, patron, max) => arbol.filter((p) => patron.test(p) && !p.includes('node_modules/')).slice(0, max);

async function analizar(repo) {
  const base = `repos/${repo.full_name}`;
  const [lenguajes, arbol] = await Promise.all([get(`${base}/languages`), get(`${base}/git/trees/HEAD?recursive=1`, { allow: [409, 404] })]);
  const files = (arbol?.tree ?? []).filter((n) => n.type === 'blob' || n.type === 'tree').map((n) => n.path);
  const deps = [];
  for (const ruta of rutasDe(files, /(^|\/)package\.json$/, 6)) {
    const archivo = await get(`${base}/contents/${ruta}`, { allow: [404] });
    if (!archivo?.content) continue;
    try {
      const json = JSON.parse(decodificar(archivo));
      deps.push(...Object.keys({ ...json.dependencies, ...json.devDependencies }));
    } catch {
      /* un package.json roto no debe tumbar el análisis */
    }
  }
  for (const ruta of rutasDe(files, /(^|\/)Cargo\.toml$/, 3)) {
    const archivo = await get(`${base}/contents/${ruta}`, { allow: [404] });
    if (!archivo?.content) continue;
    for (const [, nombre] of decodificar(archivo).matchAll(/^\s*([A-Za-z0-9_-]+)\s*=/gm)) deps.push(`cargo:${nombre}`);
  }
  return { createdYear: new Date(repo.created_at).getFullYear(), languages: lenguajes ?? {}, deps, files };
}

// Pocas peticiones a la vez: GitHub limita las simultáneas y esto no tiene prisa.
const hechos = new Array(repos.length);
const errores = [];
let siguiente = 0;
await Promise.all(
  Array.from({ length: 5 }, async () => {
    while (siguiente < repos.length) {
      const i = siguiente++;
      try {
        hechos[i] = await analizar(repos[i]);
      } catch (error) {
        errores.push(error.message);
      }
    }
  }),
);
if (errores.length > 0) {
  // Publicar recuentos a medias sería peor que no publicar nada.
  console.error(`No se pudo analizar ${errores.length} repositorio(s); no se escribe nada:\n  ${[...new Set(errores)].slice(0, 5).join('\n  ')}`);
  process.exit(1);
}

const datos = {
  generatedAt: new Date().toISOString().slice(0, 10),
  repos: { total: repos.length, public: repos.filter((r) => !r.private).length, private: repos.filter((r) => r.private).length },
  tools: buildTools(hechos),
};

// Red de seguridad: ningún nombre de repositorio puede llegar al archivo.
const texto = `${JSON.stringify(datos, null, 2)}\n`;
const filtrados = repos.map((r) => r.name).filter((n) => n.length > 3 && texto.toLowerCase().includes(n.toLowerCase()));
if (filtrados.length > 0) {
  console.error(`El resultado contiene ${filtrados.length} nombre(s) de repositorio; no se escribe nada.`);
  process.exit(1);
}

let anterior = null;
try {
  anterior = JSON.parse(readFileSync(salida, 'utf8'));
} catch {
  /* primera vez */
}
// Si antes se contaban repositorios privados y ahora no, el token de Pol falta o ha caducado: publicar eso recortaría
// los números en silencio. Mejor que la tarea falle y se vea.
if (anterior && anterior.repos.private > 0 && datos.repos.private === 0) {
  console.error('Antes había repositorios privados y ahora no: el token de Pol (STACK_GITHUB_TOKEN) falta o ha caducado. No se escribe nada.');
  process.exit(1);
}
console.log(`${datos.tools.length} herramientas en ${datos.repos.total} repositorios (${datos.repos.public} públicos, ${datos.repos.private} privados).`);
if (anterior && sameData(anterior, datos)) {
  console.log('Sin cambios.');
} else if (dry) {
  console.log('Habría cambios (modo --dry: no se escribe).');
} else {
  writeFileSync(salida, texto);
  console.log('src/content/stack.json actualizado.');
}
