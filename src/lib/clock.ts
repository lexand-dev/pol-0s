/** Formatos de fecha y hora en español, como en macOS. */

const LOCALE = 'es-ES';

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** "18:42" */
export const formatTime = (d: Date) => d.toLocaleTimeString(LOCALE, { hour: '2-digit', minute: '2-digit' });

/** "Sábado, 10 de octubre" */
export const formatLockDate = (d: Date) =>
  capitalize(d.toLocaleDateString(LOCALE, { weekday: 'long', day: 'numeric', month: 'long' }));

/** "sáb 10 oct  18:42" */
export const formatMenuClock = (d: Date) =>
  `${d.toLocaleDateString(LOCALE, { weekday: 'short', day: 'numeric', month: 'short' }).replace(/\./g, '').replace(/,/g, '')}  ${formatTime(d)}`;
