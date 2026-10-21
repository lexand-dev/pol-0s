/**
 * Puente entre las apps y el sistema: una app (la Terminal) pide una acción y `OS.svelte`, que es quien
 * tiene el gestor de ventanas, la ejecuta con el mismo despachador que usan los menús. Así `theme oscuro`
 * hace exactamente lo mismo que Visualización → Oscuro.
 */
import type { Action } from '../menus';

type Handler = (action: Action) => void;

let handler: Handler | null = null;

/** `OS.svelte` lo registra al montar y lo retira al desmontar. */
export function setActionHandler(next: Handler | null) {
  handler = next;
}

export function dispatch(action: Action) {
  handler?.(action);
}
