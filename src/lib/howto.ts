/**
 * Lógica pura de «Cómo está hecho» (S-10): el texto vive en `src/content/como-esta-hecho.md`; de él salen el documento de la ventana
 * (que lo pide al abrirse a un archivo estático) y la página pública. Aquí están las direcciones, el índice y el reparto del texto en
 * dos mitades, para colocar entre ellas la lista de tecnologías con sus logos. No toca DOM ni red.
 */

export const HOWTO_PATH = '/como-esta-hecho/';
export const HOWTO_DATA_PATH = '/como-esta-hecho.json';

/** El párrafo del texto que se sustituye por la lista de tecnologías. */
export const TECH_MARKER = '{{tecnologias}}';

export interface TocEntry {
  id: string;
  title: string;
}

/** Lo que la ventana pide al abrirse. */
export interface HowToData {
  title: string;
  description: string;
  toc: TocEntry[];
  /** El texto antes y después de la lista de tecnologías. */
  before: string;
  after: string;
}

const stripTags = (html: string) => html.replace(/<[^>]*>/g, '');

const decode = (text: string) =>
  text.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");

/** «Cómo funciona por dentro» → `como-funciona-por-dentro`: minúsculas, sin acentos y solo letras, números y guiones. */
export function slugifyHeading(text: string): string {
  return (
    text
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'seccion'
  );
}

/**
 * Pone un `id` a cada `<h2>`, sin repetir ninguno, para poder enlazar a cada sección. Se calcula aquí y no se aprovecha el que ponga el
 * convertidor de Markdown: ese conserva los acentos, y una dirección con acentos es incómoda de compartir.
 */
export function addHeadingIds(html: string): string {
  const used = new Set<string>();
  return html.replace(/<h2(\s[^>]*)?>([\s\S]*?)<\/h2>/g, (_whole, attrs: string | undefined, inner: string) => {
    const others = (attrs ?? '').replace(/\sid="[^"]*"/, '');
    const base = slugifyHeading(decode(stripTags(inner)));
    let id = base;
    for (let n = 2; used.has(id); n++) id = `${base}-${n}`;
    used.add(id);
    return `<h2${others} id="${id}">${inner}</h2>`;
  });
}

/** El índice: un elemento por cada `<h2>` con `id`. */
export function tableOfContents(html: string): TocEntry[] {
  return [...html.matchAll(/<h2[^>]*\sid="([^"]+)"[^>]*>([\s\S]*?)<\/h2>/g)].map((m) => ({ id: m[1], title: decode(stripTags(m[2])).trim() }));
}

/** Parte el texto en dos por el párrafo de las tecnologías. Si no está, todo va en la primera mitad. */
export function splitAtMarker(html: string): { before: string; after: string } {
  const match = new RegExp(`<p>\\s*${TECH_MARKER.replace(/[{}]/g, '\\$&')}\\s*</p>`).exec(html);
  if (!match) return { before: html, after: '' };
  return { before: html.slice(0, match.index), after: html.slice(match.index + match[0].length) };
}

/** Prepara el texto ya convertido a HTML: ids en los títulos, el índice y las dos mitades. */
export function prepareHowTo(html: string, front: { title?: string; description?: string }): HowToData {
  const withIds = addHeadingIds(html);
  return { title: front.title ?? '', description: front.description ?? '', toc: tableOfContents(withIds), ...splitAtMarker(withIds) };
}
