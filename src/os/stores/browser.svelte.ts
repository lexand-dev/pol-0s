/**
 * Qué proyecto muestra el Navegador ahora. Lo escribe el Navegador y lo lee la barra de menú
 * (Archivo → "Abrir en pestaña nueva"); así los menús no tienen que conocer el interior de la app.
 */
export const browserView = $state<{ projectId: string | null }>({ projectId: null });
