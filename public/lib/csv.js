// Parseo del export de insights: RFC4180 (comillas dobles, saltos dentro de campo)
// más el BOM que Excel/el exportador dejan al principio de la primera columna.

export function parsearCSV(texto) {
  const limpio = texto.replace(/^﻿/, '');
  const filas = [];
  let campo = '';
  let fila = [];
  let entreComillas = false;

  for (let i = 0; i < limpio.length; i += 1) {
    const c = limpio[i];

    if (entreComillas) {
      if (c === '"') {
        if (limpio[i + 1] === '"') {
          campo += '"';
          i += 1;
        } else {
          entreComillas = false;
        }
      } else {
        campo += c;
      }
      continue;
    }

    if (c === '"') {
      entreComillas = true;
    } else if (c === ',') {
      fila.push(campo);
      campo = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && limpio[i + 1] === '\n') i += 1;
      fila.push(campo);
      filas.push(fila);
      campo = '';
      fila = [];
    } else {
      campo += c;
    }
  }
  if (campo !== '' || fila.length) {
    fila.push(campo);
    filas.push(fila);
  }

  return filas.filter((f) => f.some((v) => v.trim() !== ''));
}

// Convierte el CSV en registros con las columnas que nos importan.
// Tolera variantes de encabezado (con/sin tilde, mayúsculas).
export function leerEntregas(texto) {
  const filas = parsearCSV(texto);
  if (!filas.length) throw new Error('El archivo está vacío');

  const encabezado = filas[0].map((h) => normalizarClave(h));
  const idx = (...nombres) => {
    for (const n of nombres) {
      const i = encabezado.indexOf(n);
      if (i !== -1) return i;
    }
    return -1;
  };

  const iCompania = idx('compania', 'compañia', 'empresa', 'cliente');
  const iPremio = idx('premio');
  const iJugador = idx('player', 'jugador', 'nombre');
  const iFecha = idx('fechaentrega', 'fecha');
  const iPlayerId = idx('playerid');

  const faltan = [];
  if (iCompania === -1) faltan.push('Compania');
  if (iPremio === -1) faltan.push('Premio');
  if (iJugador === -1) faltan.push('Player');
  if (faltan.length) {
    throw new Error(`Al CSV le faltan columnas: ${faltan.join(', ')}`);
  }

  return filas.slice(1).map((f) => ({
    compania: (f[iCompania] || '').trim(),
    premio: (f[iPremio] || '').trim(),
    jugador: (f[iJugador] || '').trim(),
    playerId: iPlayerId === -1 ? '' : (f[iPlayerId] || '').trim(),
    fecha: iFecha === -1 ? '' : (f[iFecha] || '').trim().slice(0, 10),
  })).filter((r) => r.compania && r.premio);
}

function normalizarClave(h) {
  return h
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}
