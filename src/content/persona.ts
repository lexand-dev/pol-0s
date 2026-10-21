/**
 * Quién eres. Todo lo que la interfaz dice de ti sale de aquí: es lo primero que se cambia al usar la plantilla,
 * junto con el resto de src/content/ (CV, proyectos, notas, favoritos, enlaces) y la foto de src/assets/.
 *
 * Solo sintaxis «borrable» de TypeScript: los scripts de Node (scripts/*.mjs) importan este archivo directamente.
 */
export const PERSONA = {
  /** Nombre completo: pantalla de acceso, CV, Correo, datos para buscadores. */
  name: 'Álex Ejemplo',
  /** Cómo te llama la interfaz en frases cortas («Escribir a Álex…»). */
  firstName: 'Álex',
  /** Dos letras para el avatar del Correo. */
  initials: 'ÁE',
  /** El nombre del sistema: barra de menú, título de la Terminal, correos. */
  osName: 'Álex OS',
  /** Tu línea: título de la página y vista previa al compartir. */
  tagline: 'Diseño y construyo productos digitales',
  /** Lo que responde `whoami` en la Terminal. */
  whoami: 'Diseño y construyo productos digitales, con IA y con método.',
  /** La dirección pública de la web (sin barra final). También va en wrangler.jsonc → SITE_URL. */
  siteUrl: 'https://example.com',
  /** Tu usuario de GitHub: la ventana GitHub, el Stack y los repositorios etiquetados con `showcase`. */
  github: 'tu-usuario',
  /** Nombre del PDF que se descarga desde Mi CV. */
  cvFileName: 'Alex-Ejemplo-CV.pdf',
  /** Tu newsletter, si tienes: sale al final de cada nota y como acceso directo. `null` para quitarla. */
  newsletter: {
    name: 'Mi newsletter',
    url: 'https://example.com/newsletter',
    pitch: 'una newsletter sobre construir productos con IA',
  } as { name: string; url: string; pitch: string } | null,
};
