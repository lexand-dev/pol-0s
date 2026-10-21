#!/usr/bin/env node
/**
 * Crea una portada de ejemplo (claramente falsa) para cada elemento de Favoritos que todavía no tiene la suya. Nunca pisa una portada
 * que ya exista: Pol sube las reales con el mismo nombre en public/favoritos/<sección>/. Necesita Chrome (como generar-cv.mjs).
 *
 * Uso: node scripts/generar-portadas-ejemplo.mjs
 */
import { existsSync, mkdirSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const SIZES = { juegos: [600, 800], peliculas: [600, 900], libros: [600, 900], musica: [600, 600] };

const hue = (text) => [...text].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 7);
const esc = (t) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const dir = join(root, 'src/content/favorites');
const missing = [];
for (const file of readdirSync(dir).filter((f) => f.endsWith('.json'))) {
  const section = JSON.parse(readFileSync(join(dir, file), 'utf8'));
  for (const item of section.items) {
    const path = join(root, 'public', item.cover);
    if (!existsSync(path)) missing.push({ path, title: item.title, sub: item.artist ?? item.author ?? (item.year ? String(item.year) : ''), folder: item.cover.split('/')[2] });
  }
}
if (missing.length === 0) {
  console.log('Todas las portadas existen: no hay nada que crear.');
  process.exit(0);
}

const browser = await chromium.launch({ channel: 'chrome' });
for (const m of missing) {
  const [w, h] = SIZES[m.folder];
  const a = hue(m.title);
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  await page.setContent(`<style>
    html,body{margin:0}
    body{width:${w}px;height:${h}px;display:flex;flex-direction:column;justify-content:space-between;box-sizing:border-box;padding:44px;font-family:-apple-system,system-ui,sans-serif;color:#fff;
      background:repeating-linear-gradient(45deg,hsl(${a} 45% 38%) 0 28px,hsl(${a} 45% 33%) 28px 56px)}
    .tag{font-size:26px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;opacity:.9}
    .title{font-size:${w > 500 && h === w ? 58 : 64}px;font-weight:800;line-height:1.08;text-shadow:0 2px 12px rgba(0,0,0,.35)}
    .sub{font-size:30px;margin-top:14px;opacity:.9}
    .foot{font-size:22px;opacity:.85}
  </style>
  <div class="tag">Portada de ejemplo</div>
  <div><div class="title">${esc(m.title)}</div><div class="sub">${esc(m.sub)}</div></div>
  <div class="foot">Sustitúyela subiendo la real con este mismo nombre</div>`);
  mkdirSync(dirname(m.path), { recursive: true });
  await page.screenshot({ path: m.path, type: 'jpeg', quality: 82 });
  await page.close();
  console.log('creada', m.path.replace(`${root}/`, ''));
}
await browser.close();
