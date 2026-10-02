// Cálculos del reporte de clientes: de los CSV de las dos queries a las cifras
// de una compañía en un periodo. Sin DOM, para poder probarlo aparte.

import { leerEntregas, leerTabla } from './csv.js';
import { tipoDeArchivo } from './consultas.js';
import { agruparPorFamilia, formatearMonto, formatearNombre } from './normalizador.js';

// "2,026" -> 2026 · "12.5" -> 12.5. Analytics exporta con coma de miles.
export function aNumero(texto) {
  const n = Number(String(texto ?? '').replace(/[,\s$]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

// Los filtros que antes iban en cada query y ahora se hacen aquí.
const NO_CUENTA = /tutorial|galimisi/i;
const ENTREGADO = { NEQUI: ['GENERATED', 'REDEEMED'], otro: ['DELIVERED', 'PAID'] };

export function experienciaCuenta(nombre) {
  return Boolean(nombre) && !NO_CUENTA.test(nombre);
}

// Igual que el CASE del export de la pieza semanal, para que el normalizador
// reconozca los mismos textos ("Bono Nequi de 50000 pesos", "{quantity}"...).
export function textoDelPremio(nombre, tipo, cantidad) {
  const q = aNumero(cantidad);
  if (tipo === 'GALI_TICKETS') return `${q} GaliTickets`;
  if (tipo === 'NEQUI') return `Bono Nequi de ${q} pesos`;
  return q > 0 ? nombre.replace('{quantity}', String(q)) : nombre;
}

// Analytics agrega el nombre por su cuenta junto a `player_id`.
function nombreDe(r) {
  return r.playername || r.player || r.jugador || r.nombre || '';
}

function entregado(tipo, estado) {
  return (ENTREGADO[tipo] || ENTREGADO.otro).includes(estado);
}

// Lee un CSV y devuelve solo las partes de `datos` que trae, para no pisar las
// del otro archivo: la query 1 trae juegos y fallos; la 2, compañías y premios;
// el export de la pieza semanal, solo premios.
export function interpretarArchivo(texto) {
  const { columnas, registros } = leerTabla(texto);
  const tipo = tipoDeArchivo(columnas);
  if (!tipo) throw new Error('no se reconoce: no trae las columnas de la query del reporte');

  if (tipo === 'premios') {
    return { premios: leerEntregas(texto).map((e) => ({ ...e, jugador: formatearNombre(e.jugador) })) };
  }

  const datos = { juegos: [], fallos: [], companias: [], premios: [] };
  for (const r of registros) {
    if (!r.compania) continue;
    const fecha = (r.fecha || '').slice(0, 10);
    if (r.tipo === 'juego') {
      datos.juegos.push({
        compania: r.compania,
        playerId: r.playerid,
        jugador: formatearNombre(nombreDe(r)),
        fecha,
        juegos: aNumero(r.n1),
        segundos: aNumero(r.n2),
        sumaPrecision: aNumero(r.n3),
        puntajeMax: aNumero(r.n4),
      });
    } else if (r.tipo === 'fallo') {
      if (!r.t1 || !experienciaCuenta(r.t3)) continue;
      datos.fallos.push({ compania: r.compania, fecha, pregunta: r.t1, respuesta: r.t2, fallos: aNumero(r.n1) });
    } else if (r.tipo === 'compania') {
      datos.companias.push({
        compania: r.compania,
        totalJugadores: aNumero(r.n1),
        experiencias: (r.t1 || '').split('|').map((e) => e.trim()).filter(experienciaCuenta),
      });
    } else if (r.tipo === 'premio') {
      if (!r.t1 || !entregado(r.t2, r.t3)) continue;
      datos.premios.push({
        compania: r.compania,
        premio: textoDelPremio(r.t1, r.t2, r.n1),
        jugador: formatearNombre(nombreDe(r)),
        playerId: r.playerid,
        fecha,
      });
    }
  }
  const partes = {};
  if (datos.juegos.length || datos.fallos.length) Object.assign(partes, { juegos: datos.juegos, fallos: datos.fallos });
  if (datos.companias.length || datos.premios.length) Object.assign(partes, { companias: datos.companias, premios: datos.premios });
  return partes;
}

const enPeriodo = (periodo) => (f) => f.fecha >= periodo.inicio && f.fecha <= periodo.fin;

// Página 1. `nombres` (playerId -> nombre) completa los que el export de juegos
// no traiga: el de premios sí los tiene.
export function conocimiento(datos, compania, periodo, nombres = new Map()) {
  const juegos = datos.juegos.filter((f) => f.compania === compania).filter(enPeriodo(periodo));
  const info = datos.companias.find((c) => c.compania === compania);

  const porJugador = new Map();
  for (const f of juegos) {
    const j = porJugador.get(f.playerId) || { playerId: f.playerId, nombre: '', juegos: 0, puntajeMax: 0 };
    j.nombre = j.nombre || f.jugador;
    j.juegos += f.juegos;
    j.puntajeMax = Math.max(j.puntajeMax, f.puntajeMax);
    porJugador.set(f.playerId, j);
  }

  const totalJuegos = juegos.reduce((s, f) => s + f.juegos, 0);
  const sumaPrecision = juegos.reduce((s, f) => s + f.sumaPrecision, 0);
  let precision = totalJuegos ? sumaPrecision / totalJuegos : null;
  // La precisión puede venir de 0 a 1 o de 0 a 100.
  if (precision != null && precision <= 1) precision *= 100;

  const top = [...porJugador.values()]
    .sort((a, b) => b.puntajeMax - a.puntajeMax || b.juegos - a.juegos)
    .slice(0, 3)
    .map((j) => ({ ...j, nombre: j.nombre || nombres.get(j.playerId) || 'Jugador sin nombre' }));

  const preguntas = new Map();
  for (const f of datos.fallos.filter((x) => x.compania === compania).filter(enPeriodo(periodo))) {
    const p = preguntas.get(f.pregunta) || { pregunta: f.pregunta, respuesta: f.respuesta, fallos: 0 };
    p.fallos += f.fallos;
    p.respuesta = p.respuesta || f.respuesta;
    preguntas.set(f.pregunta, p);
  }
  const masFallada = [...preguntas.values()].sort((a, b) => b.fallos - a.fallos)[0] || null;

  return {
    activos: porJugador.size,
    totalJugadores: info ? info.totalJugadores : null,
    experiencias: info ? info.experiencias : [],
    horas: juegos.reduce((s, f) => s + f.segundos, 0) / 3600,
    juegos: totalJuegos,
    precision,
    masFallada,
    top,
  };
}

// Página 2. `catalogo` es la biblioteca de Firestore. Los GaliTickets y lo marcado con `ignorar` no cuentan, como en la
// pieza semanal.
export function premiosEntregados(datos, compania, periodo, catalogo = []) {
  const entregas = datos.premios.filter((f) => f.compania === compania).filter(enPeriodo(periodo));
  const ignorado = (id) => id === 'galitickets' || catalogo.find((p) => p.id === id)?.ignorar;
  const grupos = agruparPorFamilia(entregas, catalogo).filter((g) => !ignorado(g.id));

  const filas = grupos.map((g) => {
    const entrada = catalogo.find((p) => p.id === g.id);
    const singular = entrada?.etiqueta?.singular || g.propuesta?.singular || g.id;
    const plural = entrada?.etiqueta?.plural || g.propuesta?.plural || singular;
    const desglose = entrada?.desglose || g.propuesta?.desglose || 'por-nombre';
    const unidad = entrada?.unidadMonto ?? g.propuesta?.unidadMonto ?? null;

    let costo = null;
    let detalle = '';
    // Bonos: cada entrega vale lo que dice su propio texto. Físicos: el valor de
    // la biblioteca por cada entrega.
    if (desglose === 'por-monto' && unidad === 'pesos' && g.entregas.some((e) => e.monto > 0)) {
      costo = g.entregas.reduce((s, e) => s + (e.monto || 0), 0);
      const veces = new Map();
      for (const e of g.entregas) if (e.monto) veces.set(e.monto, (veces.get(e.monto) || 0) + 1);
      detalle = [...veces.entries()]
        .sort((a, b) => b[0] - a[0])
        .map(([m, n]) => `${formatearMonto(m, unidad)} ×${n}`)
        .join(' · ');
    } else if (typeof entrada?.valor === 'number' && entrada.valor > 0) {
      costo = entrada.valor * g.conteo;
      detalle = `${formatearMonto(entrada.valor, 'pesos')} c/u`;
    }

    return {
      id: g.id,
      nombre: g.conteo === 1 ? singular : plural,
      cantidad: g.conteo,
      costo,
      detalle,
    };
  }).sort((a, b) => (b.costo ?? -1) - (a.costo ?? -1) || b.cantidad - a.cantidad);

  const contadas = filas.flatMap((f) => grupos.find((g) => g.id === f.id).entregas);
  return {
    grupos,
    filas,
    total: filas.reduce((s, f) => s + (f.costo || 0), 0),
    sinValor: filas.filter((f) => f.costo == null),
    entregas: contadas.length,
    ganadores: new Set(contadas.map((e) => e.playerId || e.jugador)).size,
  };
}

// playerId -> nombre, de cualquier export que traiga los dos.
export function mapaDeNombres(datos) {
  const mapa = new Map();
  for (const f of [...datos.premios, ...datos.juegos]) {
    if (f.playerId && f.jugador && !mapa.has(f.playerId)) mapa.set(f.playerId, f.jugador);
  }
  return mapa;
}

// Rango de fechas cubierto por los exports con fecha.
export function rangoDeDatos(datos) {
  const fechas = [...datos.juegos, ...datos.fallos, ...datos.premios]
    .map((f) => f.fecha).filter(Boolean).sort();
  return { min: fechas[0] || null, max: fechas[fechas.length - 1] || null };
}

// Compañías con algo que contar (juegos o premios) en los exports.
export function companiasConDatos(datos) {
  return [...new Set([...datos.juegos, ...datos.premios].map((f) => f.compania))]
    .sort((a, b) => a.localeCompare(b, 'es'));
}
