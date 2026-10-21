/**
 * Las palabras de los juegos de la Terminal (S-04), del mundo de Pol: tecnología, producto, contenido y su portfolio. Se escriben con sus tildes;
 * al jugar, las tildes no cuentan y la ñ es una letra propia. Las comprueba `games.test.ts`.
 */

/** Wordle: cinco letras (contando la ñ como una). */
export const WORDLE_WORDS = [
  'datos', 'clave', 'nodos', 'rutas', 'tabla', 'filas', 'campo', 'error', 'fallo', 'ramas',
  'caché', 'bucle', 'lista', 'pilas', 'colas', 'texto', 'notas', 'tarea', 'ideas', 'metas',
  'plazo', 'líder', 'color', 'icono', 'botón', 'menús', 'ratón', 'píxel', 'audio', 'vídeo',
  'canal', 'clips', 'guion', 'temas', 'envío', 'firma', 'chips', 'placa', 'cable', 'disco',
  'nubes', 'línea', 'marco', 'nivel', 'modos', 'tecla', 'juego', 'robot', 'forma', 'grafo',
  'punto', 'lápiz', 'regla', 'venta', 'marca', 'valor', 'dueño', 'sueño', 'logro', 'mapas',
] as const;

/** Ahorcado: una sola palabra, de cualquier longitud. */
export const HANGMAN_WORDS = [
  'portafolio', 'navegador', 'terminal', 'servidor', 'algoritmo', 'javascript', 'typescript', 'componente', 'interfaz', 'prototipo',
  'newsletter', 'criterio', 'producto', 'usuario', 'contraseña', 'teclado', 'pantalla', 'escritorio', 'ventana', 'carpeta',
  'archivo', 'programa', 'variable', 'función', 'despliegue', 'repositorio', 'navegación', 'accesibilidad', 'rendimiento', 'inteligencia',
  'automatización', 'aplicación', 'plantilla', 'cuaderno', 'documento', 'mensaje', 'reseña', 'favoritos', 'videojuego', 'buscador',
] as const;
