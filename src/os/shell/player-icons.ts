import { stroke } from '../icons';

// Los iconos que solo usan el mini reproductor y la lista de Música: viven aparte para que la home no los cargue.
export const PLAYER_SVG = {
  prev: stroke('<path d="M18 5l-9 7 9 7zM6 5v14"/>', 2.2),
  pause: stroke('<path d="M8.5 5v14M15.5 5v14"/>', 3),
  sound: stroke('<path d="M6 10v4M10 7v10M14 9v6M18 11v2"/>', 2.4),
} as const;
