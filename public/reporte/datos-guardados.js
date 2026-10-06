// Los CSV de las queries, guardados en Firestore para todo el equipo (colección
// `reporteDatos`; por ahora la lee y escribe cualquiera con el enlace, aunque
// traen nombres de empleados y datos de los clientes). Así no hay que correr las
// queries cada vez.
//
// Cada query se guarda partida por mes (`conocimiento-2026-09`…) y lo que no
// tiene fecha aparte (`premios-fijo`: compañías; `reviews-fijo`: fichas). Una
// subida reemplaza los meses que cubre —la query trae siempre el mes anterior y
// el actual— y deja los demás como estaban: se puede subir siempre, y cada mes
// queda con lo último que se subió. Lo que la query trae de antes de esos meses
// (las fotos de la calificación, 60 días atrás) solo llena meses que aún no
// estén guardados.
//
// Este módulo solo parte y une tablas; leer y escribir en Firestore es de `nube.js`.

import { consultaDe } from '../lib/reporte-datos.js';

// Caracteres por documento: Firestore admite hasta 1 MB y las reglas cortan antes.
const TOPE = 700000;

const mesDe = (fila) => (fila.fecha || '').slice(0, 7) || null;
const mesMas = (mes, n) => {
  const d = new Date(Date.UTC(Number(mes.slice(0, 4)), Number(mes.slice(5, 7)) - 1 + n, 1));
  return d.toISOString().slice(0, 7);
};

/**
 * Los documentos que deja una subida, a partir de la tabla leída del CSV.
 * `existentes`: ids de los documentos ya guardados (para no pisar meses viejos
 * con datos incompletos y para vaciar los trozos que sobren).
 *
 * @returns {{ consulta: string, documentos: { id: string, datos: object }[], meses: string[] } }
 */
export function documentosDeSubida(tabla, { existentes, subido, por }) {
  const consulta = consultaDe(tabla);
  if (!consulta) throw new Error('no se reconoce la query');

  // Por mes, y lo que no tiene fecha aparte.
  const partes = new Map();
  for (const fila of tabla.registros) {
    const clave = mesDe(fila) || 'fijo';
    if (!partes.has(clave)) partes.set(clave, []);
    partes.get(clave).push(fila);
  }
  const meses = [...partes.keys()].filter((k) => k !== 'fijo').sort();
  const ultimo = meses[meses.length - 1];
  const cubiertos = ultimo ? new Set([mesMas(ultimo, -1), ultimo]) : new Set();
  const yaGuardado = (clave) => [...existentes].some((id) => id.startsWith(`${consulta}-${clave}-`));

  const documentos = [];
  for (const [clave, filas] of partes) {
    // Un mes viejo que la query solo trae a medias no pisa lo que ya había.
    if (clave !== 'fijo' && !cubiertos.has(clave) && yaGuardado(clave)) continue;
    const trozos = trocear(filas.map((f) => tabla.columnas.map((c) => f[c] ?? '')));
    trozos.forEach((trozo, n) => documentos.push({
      id: `${consulta}-${clave}-${n}`,
      datos: { columnas: tabla.columnas, filas: JSON.stringify(trozo), subido, por },
    }));
    // Trozos de una subida anterior más grande: se vacían (las reglas no dejan borrar).
    for (let n = trozos.length; existentes.has(`${consulta}-${clave}-${n}`); n++) {
      documentos.push({ id: `${consulta}-${clave}-${n}`, datos: { columnas: tabla.columnas, filas: '[]', subido, por } });
    }
  }
  // Un mes cubierto que esta vez no trae filas (p. ej. aún sin premios) queda vacío.
  for (const mes of cubiertos) {
    if (partes.has(mes)) continue;
    for (let n = 0; existentes.has(`${consulta}-${mes}-${n}`); n++) {
      documentos.push({ id: `${consulta}-${mes}-${n}`, datos: { columnas: tabla.columnas, filas: '[]', subido, por } });
    }
  }
  return { consulta, documentos, meses: [...cubiertos].sort() };
}

// Filas en trozos que quepan en un documento.
function trocear(filas) {
  const trozos = [[]];
  let largo = 0;
  for (const fila of filas) {
    const tam = JSON.stringify(fila).length + 1;
    if (largo + tam > TOPE && trozos[trozos.length - 1].length) {
      trozos.push([]);
      largo = 0;
    }
    trozos[trozos.length - 1].push(fila);
    largo += tam;
  }
  return trozos;
}

/**
 * Los documentos guardados -> una tabla por query, como si fuera un solo CSV, y
 * cuándo y quién subió cada una por última vez.
 *
 * @returns {{ tablas: { [consulta]: { columnas, registros } }, subidas: { [consulta]: { subido, por } } }}
 */
export function tablasGuardadas(documentos) {
  const tablas = {};
  const subidas = {};
  for (const d of [...documentos].sort((a, b) => a.id.localeCompare(b.id))) {
    const consulta = d.id.split('-')[0];
    const filas = JSON.parse(d.filas || '[]');
    if (!tablas[consulta]) tablas[consulta] = { columnas: d.columnas, registros: [] };
    for (const fila of filas) {
      tablas[consulta].registros.push(Object.fromEntries(d.columnas.map((c, i) => [c, fila[i] ?? ''])));
    }
    if (filas.length && (!subidas[consulta] || d.subido > subidas[consulta].subido)) {
      subidas[consulta] = { subido: d.subido, por: d.por };
    }
  }
  return { tablas, subidas };
}
