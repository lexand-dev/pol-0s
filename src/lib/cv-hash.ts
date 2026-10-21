/**
 * Huella del texto de Sobre mí: el PDF guarda la del texto con el que se generó, y un test falla si ya no coincide.
 * Solo para Node (scripts y tests): usa `node:crypto`, que no existe en el navegador, así que la ventana no debe
 * importar este archivo.
 */
import { createHash } from 'node:crypto';

export const cvHash = (markdown: string) => createHash('sha256').update(markdown.replace(/\r\n/g, '\n')).digest('hex');
