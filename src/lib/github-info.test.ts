import { describe, expect, test } from 'vitest';
import { toGithubInfo } from './github-info';

describe('toGithubInfo', () => {
  test('convierte una respuesta real de GitHub: lenguajes por tamaño, etiquetas ordenadas y licencia', () => {
    const info = toGithubInfo(
      { topics: ['vite', 'threejs', '3d'], license: { spdx_id: 'AGPL-3.0', name: 'GNU Affero General Public License v3.0' } },
      { JavaScript: 259867, CSS: 14468, HTML: 9219 },
    );
    expect(info).toEqual({
      languages: [
        { name: 'JavaScript', bytes: 259867 },
        { name: 'CSS', bytes: 14468 },
        { name: 'HTML', bytes: 9219 },
      ],
      topics: ['3d', 'threejs', 'vite'],
      license: 'AGPL-3.0',
    });
  });

  test('sin licencia ni etiquetas devuelve null y una lista vacía', () => {
    expect(toGithubInfo({ license: null }, { Python: 10 })).toEqual({
      languages: [{ name: 'Python', bytes: 10 }],
      topics: [],
      license: null,
    });
  });

  test('una licencia que GitHub no identifica (NOASSERTION) usa su nombre, o null si no hay', () => {
    expect(toGithubInfo({ license: { spdx_id: 'NOASSERTION', name: 'Other' } }, {}).license).toBe('Other');
    expect(toGithubInfo({ license: { spdx_id: 'NOASSERTION' } }, {}).license).toBeNull();
  });

  test('descarta tamaños que no son enteros positivos y ordena los empates por nombre', () => {
    const info = toGithubInfo({}, { B: 5, A: 5, Cero: 0, Malo: -3, Decimal: 1.5 });
    expect(info.languages).toEqual([
      { name: 'A', bytes: 5 },
      { name: 'B', bytes: 5 },
    ]);
  });
});
