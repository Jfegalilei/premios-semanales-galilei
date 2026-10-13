// Periodos con días sin datos: si las queries que usa una pieza no llegan al
// final del periodo, la pieza sale con cifras de menos y con pinta de correcta.
// Lo usan las dos herramientas: el cálculo, la alerta grande sobre la vista
// previa (`#alertaIncompleto`, estilos en `pasos.css`) y la confirmación antes de
// descargar.

import { hoyLocal, sumarDias, diaMes, diaMesLargo } from './periodos.js';

export const NOMBRES_CONSULTA = {
  conocimiento: 'Query 1', premios: 'Query 2', reviews: 'Query 3', auteco: 'Query 4',
};

/**
 * `hasta`: el último día completo de cada query (`datosHasta`); `usadas`: las
 * queries que lleva la pieza. Si alguna no llega al final del periodo:
 * `{ hasta, desde, faltan, queries }` (el corte, el primer día que falta,
 * cuántos días faltan y hasta dónde llega cada query corta); si no, null.
 */
export function faltaEn(periodo, hasta, usadas) {
  if (!periodo) return null;
  const cortas = usadas.filter((q) => hasta[q] && hasta[q] < periodo.fin);
  if (!cortas.length) return null;
  const corte = cortas.map((q) => hasta[q]).sort()[0];
  const desde = corte < periodo.inicio ? periodo.inicio : sumarDias(corte, 1);
  const faltan = Math.round((Date.parse(periodo.fin) - Date.parse(desde)) / 864e5) + 1;
  return {
    hasta: corte, desde, faltan, queries: cortas.map((q) => ({ nombre: NOMBRES_CONSULTA[q], hasta: hasta[q] })),
  };
}

// Lo que dice el periodo en su selector cuando le faltan días.
export const notaIncompleto = (falta) => ` · ⚠ INCOMPLETO (datos hasta ${diaMes(falta.hasta)})`;

/**
 * La alerta grande. `caja` lleva `.titulo-alerta`, `.texto-alerta` y
 * `.detalle-alerta`; `marco` (opcional) es el panel que se enmarca en rojo.
 * `queHacer`: qué volver a correr y subir (cada herramienta nombra sus pasos).
 */
export function pintarAlerta(caja, { periodo, falta, marco = null, queHacer }) {
  caja.hidden = !falta;
  marco?.classList.toggle('con-alerta', Boolean(falta));
  if (!falta) return;
  const rango = `El periodo va del ${diaMesLargo(periodo.inicio)} al ${diaMesLargo(periodo.fin)}, `
    + `pero los datos cargados llegan solo hasta el ${diaMesLargo(falta.hasta)}`;
  const dias = falta.faltan === 1 ? `el ${diaMesLargo(falta.desde)}` : `del ${diaMesLargo(falta.desde)} al ${diaMesLargo(periodo.fin)}`;
  const accion = periodo.fin >= hoyLocal()
    ? 'El periodo aún no termina: espera a que acabe y vuelve a subir los CSV antes de mandarlo.'
    : `${queHacer} antes de mandarlo.`;
  caja.querySelector('.titulo-alerta').textContent = `Datos incompletos: ${falta.faltan === 1 ? 'falta 1 día' : `faltan ${falta.faltan} días`}`;
  caja.querySelector('.texto-alerta').textContent = falta.hasta < periodo.inicio
    ? `${rango}: no hay ningún día de este periodo. ${accion}`
    : `${rango}. Las cifras no incluyen ${dias}. ${accion}`;
  caja.querySelector('.detalle-alerta').textContent = falta.queries
    .map((q) => `${q.nombre}: hasta el ${diaMes(q.hasta)}`).join(' · ');
}

// Antes de bajar algo con días sin cargar, que lo confirme.
export function confirmarDescarga(falta) {
  if (!falta) return true;
  return confirm(
    `⚠ Los datos de este periodo están incompletos: llegan solo hasta el ${diaMesLargo(falta.hasta)} `
    + `y faltan ${falta.faltan} ${falta.faltan === 1 ? 'día' : 'días'}.\n\n¿Descargar de todos modos?`,
  );
}
