#!/usr/bin/env node
/**
 * Genera el PDF del currículum (M-06) a partir del mismo texto que enseña la ventana Sobre mí:
 *   src/content/sobre-mi.md  →  public/cv.pdf  +  src/content/sobre-mi.pdf.sha256
 *
 * El texto se convierte con el procesador de Markdown de Astro, el mismo que usa la web, así que documento y PDF
 * no pueden decir cosas distintas. La huella guarda con qué texto se hizo el PDF: un test falla si
 * `sobre-mi.md` cambia y no se vuelve a ejecutar esto.
 *
 * Se ejecuta a mano cuando cambia el texto o scripts/plantillas/cv.html, y el resultado se commitea. No forma
 * parte del despliegue (Workers Builds no tiene Chrome).
 *
 * Uso:  node scripts/generar-cv.mjs     (necesita Google Chrome instalado)
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { chromium } from '@playwright/test';
import { splitFrontmatter, withoutAppLinks } from '../src/lib/cv.ts';
import { cvHash } from '../src/lib/cv-hash.ts';
import { PERSONA } from '../src/content/persona.ts';

const raiz = new URL('../', import.meta.url);
const ruta = (p) => new URL(p, raiz);
const escapar = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// El procesador de Markdown (@astrojs/markdown-satteri) es una dependencia de Astro y pnpm no la expone en la raíz:
// se resuelve desde Astro, que es quien lo usa para las páginas.
const desdeAstro = createRequire(createRequire(import.meta.url).resolve('astro/package.json'));
const { satteri } = await import(pathToFileURL(desdeAstro.resolve('@astrojs/markdown-satteri')).href);

const markdown = readFileSync(ruta('src/content/sobre-mi.md'), 'utf8');
const { data, body } = splitFrontmatter(markdown);
const renderizador = await satteri().createRenderer({ syntaxHighlight: false });
const { code } = await renderizador.render(body);

const foto = `data:image/webp;base64,${readFileSync(ruta('src/assets/foto.webp')).toString('base64')}`;
const html = readFileSync(ruta('scripts/plantillas/cv.html'), 'utf8')
  .replaceAll('{{NOMBRE}}', PERSONA.name)
  .replace('{{NOMBRE_CORTO}}', PERSONA.firstName)
  .replace('{{DOMINIO}}', new URL(PERSONA.siteUrl).host)
  .replace('{{FOTO}}', foto)
  .replace('{{TAGLINE}}', escapar(data.tagline))
  .replace('{{HOOK}}', escapar(data.hook))
  .replace('{{CUERPO}}', withoutAppLinks(code));

const navegador = await chromium.launch({ channel: 'chrome' });
const pagina = await navegador.newPage();
await pagina.setContent(html, { waitUntil: 'load' });
// La foto original pesa más de 500 KB y el PDF la incrustaría tal cual: se reduce a 320 px (de sobra para 64 pt).
await pagina.evaluate(async () => {
  const img = document.querySelector('header img');
  await img.decode();
  const lienzo = document.createElement('canvas');
  lienzo.width = lienzo.height = 320;
  lienzo.getContext('2d').drawImage(img, 0, 0, 320, 320);
  img.src = lienzo.toDataURL('image/jpeg', 0.85);
  await img.decode();
});
const pdf = await pagina.pdf({ format: 'A4', printBackground: true, preferCSSPageSize: true });
await navegador.close();

writeFileSync(ruta('public/cv.pdf'), pdf);
writeFileSync(ruta('src/content/sobre-mi.pdf.sha256'), `${cvHash(markdown)}\n`);
console.log(`PDF generado: public/cv.pdf (${Math.round(pdf.length / 1024)} KB)`);
