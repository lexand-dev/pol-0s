import { describe, expect, test } from 'vitest';
import { OTHERS, detailSections, languageShares, primaryAction, repoButton, repoUrl } from './projects-view';

const sum = (xs: { share: number }[]) => xs.reduce((s, x) => s + x.share, 0);

describe('languageShares', () => {
  test('reparte en porcentajes enteros que suman 100, de mayor a menor', () => {
    const r = languageShares([
      { name: 'Rust', bytes: 37 },
      { name: 'TypeScript', bytes: 275 },
      { name: 'CSS', bytes: 38 },
    ]);
    expect(r.map((x) => x.name)).toEqual(['TypeScript', 'CSS', 'Rust']);
    expect(sum(r)).toBe(100);
  });

  test('suma exactamente 100 aunque los redondeos no cuadren', () => {
    // 1/3 cada uno: 33,33… ×3 redondea a 99; el mayor resto reparte el que falta.
    const r = languageShares([
      { name: 'A', bytes: 1 },
      { name: 'B', bytes: 1 },
      { name: 'C', bytes: 1 },
    ]);
    expect(sum(r)).toBe(100);
    expect(r.map((x) => x.share).sort()).toEqual([33, 33, 34]);
  });

  test('con datos reales de un repositorio también suma 100', () => {
    const r = languageShares([
      { name: 'TypeScript', bytes: 274953 },
      { name: 'HTML', bytes: 52030 },
      { name: 'CSS', bytes: 37533 },
      { name: 'Rust', bytes: 37024 },
      { name: 'JavaScript', bytes: 4710 },
    ]);
    expect(sum(r)).toBe(100);
    expect(r[0]).toEqual({ name: 'TypeScript', share: 68 });
  });

  test('agrupa los pequeños (menos del 3 %) en "Otros", al final', () => {
    const r = languageShares([
      { name: 'TypeScript', bytes: 920 },
      { name: 'HTML', bytes: 40 },
      { name: 'CSS', bytes: 20 },
      { name: 'Shell', bytes: 20 },
    ]);
    expect(r.at(-1)?.name).toBe(OTHERS);
    expect(r.map((x) => x.name)).toEqual(['TypeScript', 'HTML', OTHERS]);
    expect(sum(r)).toBe(100);
  });

  test('un solo lenguaje pequeño conserva su nombre en vez de pasar a "Otros"', () => {
    const r = languageShares([
      { name: 'TypeScript', bytes: 990 },
      { name: 'Shell', bytes: 10 },
    ]);
    expect(r.map((x) => x.name)).toEqual(['TypeScript', 'Shell']);
    expect(sum(r)).toBe(100);
  });

  test('un solo lenguaje es el 100 %', () => {
    expect(languageShares([{ name: 'Astro', bytes: 5 }])).toEqual([{ name: 'Astro', share: 100 }]);
  });

  test('sin datos, o con bytes a cero, no hay reparto', () => {
    expect(languageShares([])).toEqual([]);
    expect(languageShares([{ name: 'X', bytes: 0 }])).toEqual([]);
  });

  test('con el mismo tamaño, el orden es estable (alfabético)', () => {
    const r = languageShares([
      { name: 'B', bytes: 50 },
      { name: 'A', bytes: 50 },
    ]);
    expect(r.map((x) => x.name)).toEqual(['A', 'B']);
  });
});

describe('primaryAction', () => {
  test('un sitio incrustable se abre en el Navegador', () => {
    expect(primaryAction({ embeddable: true, url: 'https://afloat.polmarza.workers.dev' })).toEqual({
      kind: 'browser',
      label: 'Abrir en el Navegador',
    });
  });

  test('uno que no se deja incrustar abre una pestaña nueva, nunca una ventana en blanco', () => {
    expect(primaryAction({ embeddable: false, url: 'https://www.yoleo.io' })).toEqual({
      kind: 'external',
      label: 'Visitar sitio',
      href: 'https://www.yoleo.io',
    });
  });

  test('si su dirección es de GitHub, el texto lo dice', () => {
    const a = primaryAction({ embeddable: false, url: 'https://github.com/polmarza/project-template' });
    expect(a).toMatchObject({ kind: 'external', label: 'Ver en GitHub' });
  });
});

describe('repoButton', () => {
  test('un repositorio público da su botón con su dirección', () => {
    expect(repoButton({ repo: 'tu-usuario/planito', url: 'https://planito-sable.vercel.app' })).toEqual({
      label: 'Ver repositorio',
      href: 'https://github.com/tu-usuario/planito',
    });
  });

  test('sin repositorio no hay botón', () => {
    expect(repoButton({ url: 'https://www.yoleo.io' })).toBeNull();
  });

  test('si el repositorio es la propia dirección del proyecto, no se repite el botón', () => {
    expect(repoButton({ repo: 'polmarza/project-template', url: 'https://github.com/polmarza/project-template' })).toBeNull();
  });

  test('repoUrl construye siempre una dirección https de GitHub', () => {
    expect(repoUrl('a/b')).toBe('https://github.com/a/b');
  });
});

describe('detailSections', () => {
  const full = {
    details: ['Un párrafo.'],
    stack: ['Astro'],
    screenshots: [{}],
    github: { languages: [{ name: 'TypeScript', bytes: 10 }], topics: ['3d'], license: 'MIT' },
  };

  test('un proyecto completo enseña todos los apartados', () => {
    expect(detailSections(full)).toEqual({ what: true, madeWith: true, languages: true, topics: true, license: true, screenshots: true });
  });

  test('un proyecto sin capturas ni repositorio no enseña esos apartados', () => {
    const s = detailSections({ details: ['Texto.'], stack: ['Next.js'], screenshots: [] });
    expect(s.screenshots).toBe(false);
    expect(s.languages).toBe(false);
    expect(s.topics).toBe(false);
    expect(s.license).toBe(false);
    expect(s.madeWith).toBe(true);
  });

  test('sin tecnologías ni datos de GitHub, "Hecho con" tampoco aparece', () => {
    const s = detailSections({ details: [], stack: [], screenshots: [] });
    expect(s).toEqual({ what: false, madeWith: false, languages: false, topics: false, license: false, screenshots: false });
  });

  test('con solo la licencia (sin tecnologías ni lenguajes) "Hecho con" aparece por ella', () => {
    const s = detailSections({ details: [], stack: [], screenshots: [], github: { languages: [], topics: [], license: 'MIT' } });
    expect(s.madeWith).toBe(true);
    expect(s.license).toBe(true);
    expect(s.languages).toBe(false);
  });

  test('lenguajes con bytes a cero no cuentan como lenguajes', () => {
    expect(detailSections({ details: [], stack: [], screenshots: [], github: { languages: [{ name: 'X', bytes: 0 }], topics: [], license: null } }).languages).toBe(false);
  });
});

