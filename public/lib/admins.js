// Jugadores de Galilei que administran y se mueven por todas las compañías: sus
// premios, reseñas y reclamos solo cuentan en Galilei / Galilei Learning. En el
// resto de compañías se descartan al leer los datos (también los ya guardados).
//
// Las queries 1 y 2 los filtran además en SQL: la 2 para el total de jugadores
// de cada compañía, la 1 para que los activos, las horas y el total de cada sede
// cuadren con ese total (si no, salía «7 de 11» arriba y «7 de 12» en la sede).
// La 1, por el tope de caracteres del chat, los reconoce por el inicio del id y
// deja pasar a cualquier compañía cuyo nombre empiece por «Galilei».
// La query 3 no los filtra: en sus cifras agregadas pueden sumar uno.
export const ADMINS = new Set([
  '1cac9040-65ce-471b-a1b4-449897e60755',
  '75e2e926-5f02-4418-a9b4-c9f49a63257c',
]);

const COMPANIAS_GALILEI = new Set(['galilei', 'galilei learning']);

const normalizar = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '')
  .trim().toLowerCase().replace(/\s+/g, ' ');

// true si la fila es de uno de estos admins en una compañía que no es Galilei.
export function esAdminDeOtraCompania(playerId, compania) {
  return ADMINS.has(String(playerId || '').trim().toLowerCase())
    && !COMPANIAS_GALILEI.has(normalizar(compania));
}
