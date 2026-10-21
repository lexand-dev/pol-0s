import { PERSONA } from './persona';

/** Accesos directos externos del escritorio (M-07). Se abren siempre en una pestaña nueva. */
export interface ExternalLink {
  id: 'newsletter' | 'github' | 'linkedin' | 'whatsapp';
  label: string;
  url: string;
  /** Icono en /public/links/ (la marca del servicio). */
  icon: string;
  /** `false` si no es un perfil público (WhatsApp es un canal de contacto): no entra en los datos estructurados `sameAs`. */
  profile?: boolean;
}

export const LINKS: ExternalLink[] = [
  // La newsletter sale de src/content/persona.ts: si allí es `null`, este acceso no aparece.
  ...(PERSONA.newsletter ? [{ id: 'newsletter' as const, label: PERSONA.newsletter.name, url: PERSONA.newsletter.url, icon: '/links/newsletter.png' }] : []),
  { id: 'github', label: 'GitHub', url: `https://github.com/${PERSONA.github}`, icon: '/links/github.png' },
  { id: 'linkedin', label: 'LinkedIn', url: 'https://www.linkedin.com/in/tu-perfil/', icon: '/links/linkedin.png' },
  // Abre una conversación de WhatsApp con un primer mensaje que dice de dónde llega. Cambia el número (con prefijo de país, sin «+»)
  // o borra este acceso si no quieres darlo.
  {
    id: 'whatsapp',
    label: 'WhatsApp',
    url: 'https://wa.me/34600000000?text=Hola%2C%20te%20escribo%20desde%20tu%20portfolio.',
    icon: '/links/whatsapp.png',
    profile: false,
  },
];

/** Los perfiles públicos (los que van en los datos estructurados): todos menos los canales de contacto. */
export const PROFILE_LINKS = LINKS.filter((l) => l.profile !== false);
