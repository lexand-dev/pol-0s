import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';
import { splitFrontmatter } from './cv';
import { NOTE_ID, formatNoteDate, noteDataHref, noteFromSearch, noteHref, openInOsHref, sortNotes } from './notes';

describe('sortNotes', () => {
  test('de la más reciente a la más antigua', () => {
    const sorted = sortNotes([
      { id: 'a', date: '2026-01-01' },
      { id: 'b', date: '2026-03-01' },
      { id: 'c', date: '2026-02-01' },
    ]);
    expect(sorted.map((n) => n.id)).toEqual(['b', 'c', 'a']);
  });

  test('las de una misma fecha, por su número y, si empatan, por su nombre', () => {
    const sorted = sortNotes([
      { id: 'z', date: '2026-10-10', order: 2 },
      { id: 'y', date: '2026-10-10', order: 1 },
      { id: 'b', date: '2026-10-10', order: 3 },
      { id: 'a', date: '2026-10-10', order: 3 },
    ]);
    expect(sorted.map((n) => n.id)).toEqual(['y', 'z', 'a', 'b']);
  });

  test('acepta fechas como objeto Date y no modifica la lista original', () => {
    const input = [
      { id: 'a', date: new Date('2026-01-01') },
      { id: 'b', date: new Date('2026-02-01') },
    ];
    expect(sortNotes(input).map((n) => n.id)).toEqual(['b', 'a']);
    expect(input.map((n) => n.id)).toEqual(['a', 'b']);
  });
});

describe('direcciones y enlace profundo', () => {
  test('las direcciones de una nota', () => {
    expect(noteHref('mi-nota')).toBe('/notas/mi-nota/');
    expect(noteDataHref('mi-nota')).toBe('/notas/mi-nota.json');
    expect(openInOsHref('mi-nota')).toBe('/?nota=mi-nota');
  });

  test('noteFromSearch devuelve la nota pedida si existe', () => {
    expect(noteFromSearch('?nota=mi-nota', ['mi-nota', 'otra'])).toBe('mi-nota');
    expect(noteFromSearch('?x=1&nota=otra', ['mi-nota', 'otra'])).toBe('otra');
  });

  test('un nombre que no existe, vacío o raro se ignora', () => {
    const known = ['mi-nota'];
    for (const search of ['', '?nota=', '?nota=no-existe', '?nota=<script>alert(1)</script>', '?nota=../../etc/passwd', '?nota=MI-NOTA', '?nota=mi-nota%00', '?otro=mi-nota']) {
      expect(noteFromSearch(search, known), search).toBeNull();
    }
  });

  test('NOTE_ID solo admite minúsculas, números y guiones sueltos', () => {
    for (const ok of ['a', 'mi-nota', 'planito-5-por-14-metros']) expect(NOTE_ID.test(ok), ok).toBe(true);
    for (const bad of ['', 'Mi-nota', 'mi_nota', '-a', 'a-', 'a--b', 'a b', 'ñ']) expect(NOTE_ID.test(bad), bad).toBe(false);
  });

  test('formatNoteDate da una fecha larga en español, sin depender de la zona horaria', () => {
    expect(formatNoteDate('2026-10-10')).toBe('10 de octubre de 2026');
    expect(formatNoteDate(new Date('2026-01-05T00:00:00Z'))).toBe('5 de enero de 2026');
  });
});

// Guardas sobre el contenido real: lo que se publica en las páginas públicas y en la ventana.
const dir = join(process.cwd(), 'src/content/notes');
const files = readdirSync(dir).filter((f) => f.endsWith('.md'));
const notes = files.map((f) => {
  const raw = readFileSync(join(dir, f), 'utf8');
  const { data, body } = splitFrontmatter(raw);
  return { id: f.replace(/\.md$/, ''), raw, data, body };
});

describe('src/content/notes', () => {
  test('hay notas', () => {
    expect(notes.length).toBeGreaterThanOrEqual(3); // las tres notas de ejemplo
  });

  test('cada nota tiene un nombre válido para la dirección', () => {
    for (const n of notes) expect(NOTE_ID.test(n.id), n.id).toBe(true);
  });

  test('cada nota tiene título, una descripción de hasta 160 caracteres y una fecha válida', () => {
    for (const n of notes) {
      expect(n.data.title?.length, `${n.id}: título`).toBeGreaterThan(5);
      const description = n.data.description.replace(/^"|"$/g, '');
      expect(description.length, `${n.id}: descripción`).toBeGreaterThanOrEqual(20);
      expect(description.length, `${n.id}: descripción de ${description.length} caracteres`).toBeLessThanOrEqual(160);
      expect(Number.isNaN(Date.parse(n.data.date)), `${n.id}: fecha`).toBe(false);
    }
  });

  test('cada nota tiene etiquetas y un número de orden propio dentro de su fecha', () => {
    const seen = new Set<string>();
    for (const n of notes) {
      expect(n.data.tags, `${n.id}: etiquetas`).toMatch(/^\[.+\]$/);
      const key = `${n.data.date}#${n.data.order}`;
      expect(seen.has(key), `${n.id}: orden repetido ${key}`).toBe(false);
      seen.add(key);
    }
  });

  test('cada nota tiene un texto con cuerpo', () => {
    for (const n of notes) expect(n.body.trim().length, n.id).toBeGreaterThan(400);
  });

  test('no se publica ningún correo, ningún nombre de tercero ni lo acordado no publicar', () => {
    for (const n of notes) {
      expect(n.raw, `${n.id}: correo`).not.toMatch(/[\w.+-]+@[\w-]+\.[\w.-]+|mailto:/);
      for (const excluded of ['Lucía Ejemplo', 'Marcos Ejemplo']) {
        expect(n.raw, `${n.id}: ${excluded}`).not.toContain(excluded);
      }
    }
  });

  test('no quedan marcas de revisión pendientes', () => {
    for (const n of notes) expect(n.raw, n.id).not.toMatch(/CONFIRMAR|\[¿\?|TODO|Nota de ejemplo/);
  });

  test('los enlaces son https y las imágenes llevan texto alternativo', () => {
    for (const n of notes) {
      for (const [, href] of n.body.matchAll(/\]\(([^)]+)\)/g)) expect(href, `${n.id}: ${href}`).toMatch(/^(https:\/\/|\/notas\/|\/projects\/)/);
      for (const [, alt] of n.body.matchAll(/!\[([^\]]*)\]/g)) expect(alt.length, `${n.id}: imagen sin texto alternativo`).toBeGreaterThan(3);
    }
  });
});
