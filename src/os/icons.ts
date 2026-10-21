/**
 * Iconos de Pol OS. Los de las apps son dibujos propios, salvo Correo y Navegador (logos de Gmail y Safari). Las otras
 * marcas ajenas son los iconos de los enlaces externos (LinkedIn, GitHub) y de los proyectos de Pol, que Pol autorizó
 * y viven como imágenes en /public.
 * Los SVG son cadenas estáticas de este archivo, nunca contenido externo.
 */

export const stroke = (paths: string, width = 2) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;

const GLYPH_PATHS = {
  browser: '<circle cx="12" cy="12" r="9"/><path d="M15.6 8.4l-2.1 5.1-5.1 2.1 2.1-5.1z"/>',
  mail: '<rect x="3" y="5.5" width="18" height="13" rx="2.5"/><path d="M3.8 7.2L12 13l8.2-5.8"/>',
  notes: '<path d="M7 8h10M7 12h10M7 16h6"/>',
  terminal: '<path d="M5 8l4 4-4 4M11.5 16H19"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.6 9.4a2.5 2.5 0 1 1 3.5 2.3c-.8.4-1.1.9-1.1 1.7M12 16.9v.1"/>',
  settings:
    '<circle cx="12" cy="12" r="3.2"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1"/>',
  checkers: '<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M4 12h16M12 4v16"/><circle cx="8" cy="8" r="1.6"/><circle cx="16" cy="16" r="1.6"/>',
  cards: '<rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/>',
  heart: '<path d="M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.4a4.3 4.3 0 0 1 7.5 2.4C19.5 15.4 12 20 12 20z"/>',
  code: '<path d="M8.5 8L4.5 12l4 4M15.5 8l4 4-4 4M13.2 6.5l-2.4 11"/>',
  book: '<path d="M5 5.5A1.5 1.5 0 0 1 6.5 4H18v14.5H6.5A1.5 1.5 0 0 0 5 20z"/><path d="M5 18.5A1.5 1.5 0 0 1 6.5 17H18M9 8.5h5.5M9 12h4"/>',
  chip: '<rect x="7" y="7" width="10" height="10" rx="2"/><path d="M10 3.5V7M14 3.5V7M10 17v3.5M14 17v3.5M3.5 10H7M3.5 14H7M17 10h3.5M17 14h3.5"/>',
} as const;

export type Glyph = keyof typeof GLYPH_PATHS;

export const glyphSvg = (glyph: Glyph) => stroke(GLYPH_PATHS[glyph]);

export const UI_SVG = {
  back: stroke('<path d="M15 5l-7 7 7 7"/>', 2.4),
  close: stroke('<path d="M7 7l10 10M17 7L7 17"/>', 3),
  next: stroke('<path d="M6 5l9 7-9 7zM18 5v14"/>', 2.2),
  play: stroke('<path d="M8 5l11 7-11 7z"/>', 2.2),
  minimize: stroke('<path d="M6 12h12"/>', 3),
  maximize: stroke('<path d="M12 6v12M6 12h12"/>', 3),
  tick: stroke('<path d="M5 12.5l4.5 4.5L19 7.5"/>', 2.6),
  enter: stroke('<path d="M5 12h14M13 6l6 6-6 6"/>', 2.4),
  forward: stroke('<path d="M9 5l7 7-7 7"/>', 2.2),
  backSmall: stroke('<path d="M15 5l-7 7 7 7"/>', 2.2),
  reload: stroke('<path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3M19.5 4.5v4h-4"/>', 2),
  star: stroke('<path d="M12 3.8l2.5 5.1 5.6.8-4 3.9.9 5.6-5-2.6-5 2.6.9-5.6-4-3.9 5.6-.8z"/>', 1.8),
  external: stroke('<path d="M14 5h5v5M19 5l-8 8M17 14v5H5V7h5"/>', 2),
  lock: stroke('<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>', 2),
  check: stroke('<circle cx="12" cy="12" r="9"/><path d="M8 12.5l2.8 2.8L16 10"/>', 1.8),
  send: stroke('<path d="M4 12l16-8-6 16-2.5-6.5z"/><path d="M11.5 13.5L20 4"/>', 2),
  shield: stroke('<path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z"/><path d="M9.5 14.5l5-5M14.5 14.5l-5-5"/>', 1.6),
  moon: stroke('<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>', 1.8),
  sun: stroke(
    '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"/>',
    1.8,
  ),
  download: stroke('<path d="M12 4v11M7.5 10.5L12 15l4.5-4.5M5 19h14"/>', 2.2),
  tileLeft: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="5" width="17" height="14" rx="2.2" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M5.7 5H12v14H5.7a2.2 2.2 0 0 1-2.2-2.2V7.2A2.2 2.2 0 0 1 5.7 5z" fill="currentColor"/></svg>',
  tileRight: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="5" width="17" height="14" rx="2.2" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M18.3 5H12v14h6.3a2.2 2.2 0 0 0 2.2-2.2V7.2A2.2 2.2 0 0 0 18.3 5z" fill="currentColor"/></svg>',
  fill: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="5" width="17" height="14" rx="2.2" fill="currentColor"/></svg>',
  restore: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="5" width="17" height="14" rx="2.2" fill="none" stroke="currentColor" stroke-width="1.6"/><rect x="8" y="9" width="8" height="6" rx="1.2" fill="currentColor"/></svg>',
  logo: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5.5" fill="currentColor"/><rect x="7" y="8" width="10" height="8.5" rx="1.6" fill="none" stroke="var(--glass-strong)" stroke-width="1.8"/><path d="M7 10.8h10" stroke="var(--glass-strong)" stroke-width="1.8"/></svg>',
} as const;

/** Dibujos completos (carpeta, documento, nota): llevan sus propios colores en ambos temas. */
export const ART_SVG = {
  folder:
    '<svg viewBox="0 0 64 52" aria-hidden="true"><path d="M4 9a4 4 0 0 1 4-4h15l6 6h27a4 4 0 0 1 4 4v29a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4z" fill="#4ea7ef"/><path d="M4 17a4 4 0 0 1 4-4h48a4 4 0 0 1 4 4v27a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4z" fill="#86cbfb"/><path d="M4 17a4 4 0 0 1 4-4h48a4 4 0 0 1 4 4v2H4z" fill="#a9dbfd"/></svg>',
  pdf:
    '<svg viewBox="0 0 48 60" aria-hidden="true"><path d="M6 2h26l12 12v42a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z" fill="#fff" stroke="rgba(0,0,0,.18)"/><path d="M32 2v10a2 2 0 0 0 2 2h10" fill="#e9e9ee" stroke="rgba(0,0,0,.18)"/><path d="M11 20h22M11 25h26M11 30h17" stroke="#cfcfd6" stroke-width="2" stroke-linecap="round"/><rect x="4" y="38" width="28" height="12" rx="2" fill="#e5483b"/><text x="18" y="47.2" text-anchor="middle" font-size="8.5" font-weight="700" fill="#fff" font-family="-apple-system,system-ui,sans-serif">PDF</text></svg>',
  notefile:
    '<svg viewBox="0 0 48 60" aria-hidden="true"><path d="M6 2h36a2 2 0 0 1 2 2v52a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z" fill="#fffdf3" stroke="rgba(0,0,0,.18)"/><path d="M4 4a2 2 0 0 1 2-2h36a2 2 0 0 1 2 2v9H4z" fill="#ffcf3f"/><path d="M11 22h26M11 28h26M11 34h26M11 40h16" stroke="#d9d4c3" stroke-width="2" stroke-linecap="round"/></svg>',
} as const;

/**
 * Iconos de app dibujados enteros (64 × 64), a sangre dentro de la casilla con degradado. Colores planos, sin `id` ni
 * degradados internos: el mismo SVG sale muchas veces en la página y los `id` repetidos chocan.
 * Correo y Navegador llevan los logos de Gmail y Safari (decisión de Pol del 2026-10-17); el resto son dibujos propios.
 */
const BLUEPRINT_GRID = Array.from({ length: 7 }, (_, i) => `M${(i + 1) * 8} 0v64M0 ${(i + 1) * 8}h64`).join('');
/** Contorno de una rueda dentada centrada en (32, 32): `teeth` dientes trapezoidales entre los radios `r` y `R`. */
const gearPath = (teeth: number, r: number, R: number) => {
  const pts: string[] = [];
  const step = (Math.PI * 2) / teeth;
  const at = (a: number, rad: number) => `${(32 + rad * Math.cos(a)).toFixed(2)} ${(32 + rad * Math.sin(a)).toFixed(2)}`;
  for (let i = 0; i < teeth; i++) {
    const a = i * step - Math.PI / 2;
    pts.push(at(a - step * 0.3, r), at(a - step * 0.17, R), at(a + step * 0.17, R), at(a + step * 0.3, r));
  }
  return `M${pts.join('L')}Z`;
};
const circle = (rad: number) => `M${32 - rad} 32a${rad} ${rad} 0 1 0 ${rad * 2} 0a${rad} ${rad} 0 1 0 ${-rad * 2} 0Z`;
const SPOKES = [0, 1, 2, 3, 4, 5]
  .map((i) => {
    const a = (i * Math.PI) / 3 + Math.PI / 6;
    return `M${(32 + 6 * Math.cos(a)).toFixed(2)} ${(32 + 6 * Math.sin(a)).toFixed(2)}L${(32 + 16 * Math.cos(a)).toFixed(2)} ${(32 + 16 * Math.sin(a)).toFixed(2)}`;
  })
  .join('');
const tileSvg = (body: string) => `<svg viewBox="0 0 64 64" aria-hidden="true">${body}</svg>`;
export const TILE_SVG = {
  safari: tileSvg(
    '<circle cx="32" cy="32" r="25" fill="#1677f2"/><circle cx="32" cy="32" r="23" fill="#2f97ff"/>' +
      '<circle cx="32" cy="32" r="20.5" fill="none" stroke="#fff" stroke-opacity=".85" stroke-width="2.6" stroke-dasharray=".7 3.59"/>' +
      '<g transform="rotate(45 32 32)"><path d="M32 13l4 19h-8z" fill="#ff3b30"/><path d="M32 51l4-19h-8z" fill="#fff"/></g>' +
      '<circle cx="32" cy="32" r="1.8" fill="#1677f2"/>',
  ),
  gmail: tileSvg(
    '<svg x="9" y="14.75" width="46" height="34.5" viewBox="52 42 88 66">' +
      '<path fill="#4285f4" d="M58 108h14V74L52 59v43c0 3.32 2.69 6 6 6"/>' +
      '<path fill="#34a853" d="M120 108h14c3.32 0 6-2.69 6-6V59l-20 15"/>' +
      '<path fill="#fbbc04" d="M120 48v26l20-15v-8c0-7.42-8.47-11.65-14.4-7.2"/>' +
      '<path fill="#ea4335" d="M72 74V48l24 18 24-18v26L96 92"/>' +
      '<path fill="#c5221f" d="M52 51v8l20 15V48l-5.6-4.2c-5.94-4.45-14.4-.22-14.4 7.2"/></svg>',
  ),
  terminal: tileSvg(
    '<path d="M14 22.5l10.5 9-10.5 9" fill="none" stroke="#7ee2a8" stroke-width="4.4" stroke-linecap="round" stroke-linejoin="round"/>' +
      '<path d="M29 42.5h20" stroke="#e9e9ec" stroke-width="4.4" stroke-linecap="round"/>',
  ),
  notes: tileSvg(
    '<rect width="64" height="19" fill="#ffcf3f"/><path d="M0 19h64" stroke="#e0a800" stroke-width="1.2"/>' +
      '<path d="M12 30h40M12 38h40M12 46h26" stroke="#d6d2c4" stroke-width="2.4" stroke-linecap="round"/>',
  ),
  guestbook: tileSvg(
    '<path d="M32 19.5c-5-3-12-4-19-3v29c7-1 14 0 19 3z" fill="#fff"/>' +
      '<path d="M32 19.5c5-3 12-4 19-3v29c-7-1-14 0-19 3z" fill="#fff" fill-opacity=".9"/>' +
      '<path d="M32 19.5v29" stroke="#e8b9aa" stroke-width="1.2"/>' +
      '<path d="M17 24.5c3.5-.5 7 0 10 1M17 30c3.5-.5 7 0 10 1M17 35.5c3.5-.5 7 0 10 1" fill="none" stroke="#f0a58e" stroke-width="1.8" stroke-linecap="round"/>' +
      '<path d="M36 34c2-5 4.5-5 4.5-.5s2 3.5 4-1 3.5-2.5 4.5 0" fill="none" stroke="#e0553f" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
  ),
  stack: tileSvg(
    '<path d="M12 41l20-9 20 9-20 9z" fill="#fff" fill-opacity=".5"/>' +
      '<path d="M12 32l20-9 20 9-20 9z" fill="#fff" fill-opacity=".75"/>' +
      '<path d="M12 23l20-9 20 9-20 9z" fill="#fff"/>',
  ),
  blueprint: tileSvg(
    `<path d="${BLUEPRINT_GRID}" stroke="#fff" stroke-opacity=".16" stroke-width=".8"/>` +
      '<path d="M24 23l-9 9 9 9M40 23l9 9-9 9M35.5 19l-7 26" fill="none" stroke="#fff" stroke-width="3.8" stroke-linecap="round" stroke-linejoin="round"/>',
  ),
  settings: tileSvg(
    `<path d="${gearPath(36, 25.5, 28.5)}${circle(21.5)}" fill="#3b3b42" fill-rule="evenodd"/>` +
      `<path d="${circle(21.5)}" fill="#c7c7ce"/><path d="${gearPath(10, 13.5, 17)}" fill="#4a4a52"/>` +
      `<path d="${SPOKES}" stroke="#4a4a52" stroke-width="3.2" stroke-linecap="round"/>` +
      `<path d="${circle(18.6)}" fill="none" stroke="#4a4a52" stroke-width="2.4"/>` +
      `<path d="${circle(6.5)}" fill="#c7c7ce"/><path d="${circle(4)}" fill="#3b3b42"/>`,
  ),
  favorites: tileSvg(
    '<path d="M32 51S13 39.5 13 25.5A10.5 10.5 0 0 1 32 19.5a10.5 10.5 0 0 1 19 6C51 39.5 32 51 32 51z" fill="#fff"/>' +
      '<path d="M50 5.5l1.7 4 4 1.7-4 1.7-1.7 4-1.7-4-4-1.7 4-1.7z" fill="#ffe27a"/>',
  ),
} as const;

export type TileArt = keyof typeof TILE_SVG;

export type IconSpec =
  | { kind: 'glyph'; glyph: Glyph; from: string; to: string; fg?: string }
  | { kind: 'tile'; art: TileArt; from: string; to: string }
  | { kind: 'monogram'; letter: string; from: string; to: string }
  | { kind: 'image'; src: string }
  | { kind: 'art'; art: keyof typeof ART_SVG }
  | { kind: 'folder'; children: IconSpec[] };

/** Degradados de los iconos de app (docs/design-system.md → Iconos de aplicación). */
const GLYPH_COLORS: Record<Glyph, { from: string; to: string; fg?: string }> = {
  browser: { from: '#5ad0ff', to: '#0a7cff' },
  mail: { from: '#6fc6ff', to: '#1765ea' },
  notes: { from: '#ffe680', to: '#ffc42e', fg: '#7a5a00' },
  terminal: { from: '#3d3d42', to: '#18181b', fg: '#e9e9ec' },
  settings: { from: '#b9b9c2', to: '#6b6b74' },
  chip: { from: '#8a8cff', to: '#4a4bd6' },
  book: { from: '#ff9f7a', to: '#e0553f' },
  code: { from: '#3ddc97', to: '#0f9a68' },
  heart: { from: '#ff7aa8', to: '#e0306a' },
  cards: { from: '#ffb35c', to: '#f0782a' },
  checkers: { from: '#d9534a', to: '#9e2a22' },
  help: { from: '#7fd0ff', to: '#3b86f2' },
};

export const glyphIcon = (glyph: Glyph): IconSpec => ({ kind: 'glyph', glyph, ...GLYPH_COLORS[glyph] });

/** Fondo de cada icono dibujado (docs/design-system.md → Iconos de aplicación). */
const TILE_COLORS: Record<TileArt, { from: string; to: string }> = {
  safari: { from: '#ffffff', to: '#e9e9ee' },
  gmail: { from: '#ffffff', to: '#ececf1' },
  terminal: { from: '#232328', to: '#0b0b0d' },
  notes: { from: '#ffffff', to: '#f3f1ea' },
  guestbook: { from: '#ff9f7a', to: '#e0553f' },
  stack: { from: '#8a8cff', to: '#4a4bd6' },
  blueprint: { from: '#3a7cf0', to: '#1a3f9e' },
  favorites: { from: '#ff7aa8', to: '#e0306a' },
  settings: { from: '#e4e4e9', to: '#9a9aa3' },
};

export const tileIcon = (art: TileArt): IconSpec => ({ kind: 'tile', art, ...TILE_COLORS[art] });
