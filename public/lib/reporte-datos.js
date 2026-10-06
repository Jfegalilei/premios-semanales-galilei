// Cálculos del reporte de clientes: de los CSV de las dos queries a las cifras
// de una compañía en un periodo. Sin DOM, para poder probarlo aparte.

import { leerEntregas, leerTabla } from './csv.js';
import { tipoDeArchivo } from './consultas.js';
import { agruparPorFamilia, formatearMonto, formatearNombre } from './normalizador.js';
import { hoyLocal, sumarDias } from './periodos.js';

// "2,026" -> 2026 · "12.5" -> 12.5. Analytics exporta con coma de miles.
export function aNumero(texto) {
  const n = Number(String(texto ?? '').replace(/[,\s$]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

// Filtros que se hacen aquí y no en la query, para que quepa en un mensaje.
const NO_CUENTA = /tutorial|galimisi/i;
const ENTREGADO = { NEQUI: ['GENERATED', 'REDEEMED'], otro: ['DELIVERED', 'PAID'] };

export function experienciaCuenta(nombre) {
  return Boolean(nombre) && !NO_CUENTA.test(nombre);
}

// Igual que el CASE del export de la pieza semanal, para que el normalizador
// reconozca los mismos textos ("Bono Nequi de 50000 pesos"...). El nombre del
// premio trae la cantidad como `${quantity}` o `{quantity}`.
export function textoDelPremio(nombre, tipo, cantidad) {
  const q = aNumero(cantidad);
  if (tipo === 'GALI_TICKETS') return `${q} GaliTickets`;
  if (tipo === 'NEQUI') return `Bono Nequi de ${q} pesos`;
  return q > 0 ? nombre.replace(/\$?\{quantity\}/g, String(q)) : nombre;
}

// Analytics agrega el nombre por su cuenta junto a `player_id`.
function nombreDe(r) {
  return r.playername || r.player || r.jugador || r.nombre || '';
}

function entregado(tipo, estado) {
  return (ENTREGADO[tipo] || ENTREGADO.otro).includes(estado);
}

// Lee un CSV y devuelve solo las partes de `datos` que trae, para no pisar las
// del otro archivo: la query 1 trae resúmenes y Top 3 de sedes por periodo y
// preguntas por día; la 2, compañías y premios; la 3, reviews de Google; la 4,
// la lotería de Auteco; el export de la pieza semanal, solo premios.
export function interpretarArchivo(texto) {
  const tabla = leerTabla(texto);
  const tipo = tipoDeArchivo(tabla.columnas);
  if (!tipo) throw new Error('no se reconoce: no trae las columnas de las queries del reporte');

  if (tipo === 'premios') {
    return { premios: leerEntregas(texto).map((e) => ({ ...e, jugador: formatearNombre(e.jugador) })) };
  }
  return interpretarTabla(tabla);
}

// Qué query es una tabla, por los tipos de fila que trae (para guardarla aparte).
const CONSULTA_DE_TIPO = {
  resumen: 'conocimiento', loc: 'conocimiento', lot: 'conocimiento', dia: 'conocimiento',
  compania: 'premios', premio: 'premios',
  ficha: 'reviews', rev: 'reviews', estrellas: 'reviews', emp: 'reviews', foto: 'reviews',
  auteco: 'auteco',
};
export function consultaDe({ registros }) {
  for (const r of registros) if (CONSULTA_DE_TIPO[r.tipo]) return CONSULTA_DE_TIPO[r.tipo];
  return null;
}

// Las filas de una query (ya leídas del CSV o guardadas en Firestore) -> las
// partes de `datos` que traen.
export function interpretarTabla({ registros }) {
  const datos = { resumenes: [], locations: [], dias: [], loterias: [], autecos: [], companias: [], premios: [], ...SIN_REVIEWS() };
  for (const r of registros) {
    if (!r.compania) continue;
    const fecha = (r.fecha || '').slice(0, 10);
    const periodo = { compania: r.compania, periodo: r.periodo, inicio: fecha };
    if (r.tipo === 'resumen') {
      datos.resumenes.push({
        ...periodo,
        activos: aNumero(r.n1),
        juegos: aNumero(r.n2),
        segundos: aNumero(r.n3),
        preguntas: aNumero(r.n4),
      });
    } else if (r.tipo === 'loc') {
      datos.locations.push({
        ...periodo,
        nombre: (r.t1 || '').trim(),
        activos: aNumero(r.n1),
        total: aNumero(r.n2),
      });
    } else if (r.tipo === 'lot') {
      datos.loterias.push({ ...periodo, clasificados: aNumero(r.n1) });
    } else if (r.tipo === 'auteco') {
      datos.autecos.push({
        ...periodo,
        tecnicos: aNumero(r.n1),
        asesores: aNumero(r.n2),
        faltanEscaneos: aNumero(r.n3),
        faltaJuego: aNumero(r.n4),
      });
    } else if (r.tipo === 'ficha') {
      datos.fichas.push({ compania: r.compania, id: r.t1, nombre: r.t2 || '' });
    } else if (r.tipo === 'rev') {
      datos.resenas.push({
        ...periodo,
        nuevas: aNumero(r.n1),
        porGali: aNumero(r.n2),
        promedio: aNumero(r.n3),
      });
    } else if (r.tipo === 'estrellas') {
      datos.estrellas.push({ ...periodo, estrellas: aNumero(r.n1), reviews: aNumero(r.n2) });
    } else if (r.tipo === 'emp') {
      datos.embajadores.push({ ...periodo, playerId: r.playerid, nombre: formatearNombre(nombreDe(r)), reviews: aNumero(r.n1) });
    } else if (r.tipo === 'foto') {
      datos.fotos.push({ compania: r.compania, ficha: r.t1, fecha, calificacion: aNumero(r.n1), total: aNumero(r.n2) });
    } else if (r.tipo === 'dia') {
      datos.dias.push({ compania: r.compania, fecha, preguntas: aNumero(r.n1) });
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
        // Sede y nivel del team de quien lo reclamó (query 2 desde que los trae).
        sede: (r.t4 || '').trim(),
        nivel: r.n2 === '' || r.n2 == null ? null : aNumero(r.n2),
        conSede: 't4' in r,
      });
    }
  }
  const partes = {};
  if (datos.resumenes.length) Object.assign(partes, { resumenes: datos.resumenes, locations: datos.locations, dias: datos.dias, loterias: datos.loterias });
  if (datos.companias.length || datos.premios.length) Object.assign(partes, { companias: datos.companias, premios: datos.premios });
  if (datos.autecos.length) partes.autecos = datos.autecos;
  if (datos.fichas.length) {
    const { fichas, resenas, estrellas, embajadores, fotos } = datos;
    Object.assign(partes, { fichas, resenas, estrellas, embajadores, fotos });
  }
  return partes;
}

// Qué tiene contratado cada compañía, para darle solo esas hojas.
//   training: tiene partidas en los datos cargados, experiencias activas
//             asignadas (sin Tutorial ni GaliMisión) o premios entregados. No
//             sirve contar jugadores: las de solo reviews también tienen
//             empleados registrados como jugadores por las tarjetas.
//   reviews:  tiene al menos una ficha de Google activa.
export function servicios(datos, compania) {
  const de = (f) => f.compania === compania;
  const info = datos.companias.find(de);
  return {
    training: datos.resumenes.some(de) || datos.premios.some(de) || Boolean(info && info.experiencias.length),
    reviews: datos.fichas.some(de),
  };
}

// El mes de las loterías de un reporte: el del día en que termina el periodo;
// si ese día cae en la primera semana del mes, el anterior (la rifa de un mes
// se sortea a comienzos del siguiente). Un reporte mensual es de su mes.
// Devuelve el primer día del mes («2026-09-01»), como las filas de la query.
export function mesDeLoteria(periodo) {
  const fin = periodo.fin;
  if (periodo.tipo !== 'mes' && Number(fin.slice(8, 10)) <= 7) {
    const d = new Date(Date.UTC(Number(fin.slice(0, 4)), Number(fin.slice(5, 7)) - 2, 1));
    return d.toISOString().slice(0, 10);
  }
  return `${fin.slice(0, 7)}-01`;
}

// GaliLotería: los clasificados del mes en el que termina el periodo (en
// una semana, el mes en curso hasta el día en que se corrió la query).
// `training` dice si la compañía juega: si solo tiene reviews, la hoja le
// muestra la lotería sin clasificados.
export function loteria(datos, compania, periodo) {
  const mes = mesDeLoteria(periodo);
  const fila = datos.loterias.find((f) => f.compania === compania && f.periodo === 'mes' && f.inicio === mes);
  return {
    mes,
    enCurso: mes === `${hoyLocal().slice(0, 7)}-01`,
    training: servicios(datos, compania).training,
    clasificados: fila ? fila.clasificados : 0,
  };
}

// Lotería de Auteco (query 4): mismo mes que `loteria()`, con los clasificados
// partidos por rol (el desglose va al pie de la tarjeta).
export function loteriaAuteco(datos, compania, periodo) {
  const mes = mesDeLoteria(periodo);
  const fila = datos.autecos.find((f) => f.compania === compania && f.inicio === mes);
  const tecnicos = fila ? fila.tecnicos : 0;
  const asesores = fila ? fila.asesores : 0;
  return {
    mes,
    enCurso: mes === `${hoyLocal().slice(0, 7)}-01`,
    training: true,
    cargada: datos.autecos.length > 0,
    clasificados: tecnicos + asesores,
    pie: `${entero(tecnicos)} ${tecnicos === 1 ? 'técnico' : 'técnicos'} · ${entero(asesores)} ${asesores === 1 ? 'asesor' : 'asesores'}`,
  };
}

const entero = (n) => Math.round(n).toLocaleString('es-CO');

// GaliLotería de Reseñas: empleados con al menos `RESENAS_PARA_CLASIFICAR`
// reviews de 5 estrellas por Gali en el mes en que termina el periodo. Sale de
// las filas `emp` del mes (query 3).
export const RESENAS_PARA_CLASIFICAR = 50;
export function loteriaResenas(datos, compania, periodo) {
  const mes = mesDeLoteria(periodo);
  const del = datos.embajadores.filter((e) => e.compania === compania && e.periodo === 'mes' && e.inicio === mes);
  const meta = RESENAS_PARA_CLASIFICAR;
  return {
    mes,
    enCurso: mes === `${hoyLocal().slice(0, 7)}-01`,
    training: true,
    unidad: ['empleado', 'empleados'],
    clasificados: del.filter((e) => e.reviews >= meta).length,
  };
}

export const SIN_REVIEWS = () => ({ fichas: [], resenas: [], estrellas: [], embajadores: [], fotos: [] });

// Calificación de la compañía en Google en una fecha: la última foto de cada
// ficha hasta ese día, promediada según cuántas calificaciones tiene cada una.
function calificacionAl(fotos, fecha) {
  const ultima = new Map();
  for (const f of fotos) {
    if (f.fecha > fecha) continue;
    const previa = ultima.get(f.ficha);
    if (!previa || f.fecha > previa.fecha) ultima.set(f.ficha, f);
  }
  const lista = [...ultima.values()].filter((f) => f.total > 0);
  const total = lista.reduce((s, f) => s + f.total, 0);
  if (!total) return null;
  return { calificacion: lista.reduce((s, f) => s + f.calificacion * f.total, 0) / total, total };
}

// Hoja de reviews: la calificación general en Google y, de las
// reviews, solo lo que llegó por Galilei (clic de la tarjeta o del juego): nada
// que deje ver cuáles no fueron por Galilei. `null` si la compañía no tiene
// ficha de Google activa: no tiene el servicio y la hoja no sale. `nuevas`
// (todas) solo sirve para saber si hubo actividad; no sale en la hoja.
export function reviews(datos, compania, periodo) {
  if (!datos.fichas.some((f) => f.compania === compania)) return null;
  const r = datos.resenas.find(delPeriodo(compania, periodo));
  const fotos = datos.fotos.filter((f) => f.compania === compania);
  const cierre = calificacionAl(fotos, periodo.fin);
  const estrellas = [5, 4, 3, 2, 1].map((e) => ({
    estrellas: e,
    reviews: datos.estrellas.filter(delPeriodo(compania, periodo)).find((f) => f.estrellas === e)?.reviews || 0,
  }));
  return {
    calificacion: cierre ? cierre.calificacion : null,
    totalGoogle: cierre ? cierre.total : null,
    // Para decir en la hoja de qué periodo son las cifras.
    periodo: { tipo: periodo.tipo, inicio: periodo.inicio },
    nuevas: r ? r.nuevas : 0,
    porGali: r ? r.porGali : 0,
    promedioGali: r && r.porGali ? r.promedio : null,
    // CSV de una query 3 vieja: sus estrellas cuentan todas las reviews (suman
    // las nuevas) y no solo las de Galilei. Hay que volver a correrla.
    estrellasViejas: Boolean(r && r.nuevas !== r.porGali
      && estrellas.reduce((t, e) => t + e.reviews, 0) === r.nuevas),
    estrellas,
    top: datos.embajadores.filter(delPeriodo(compania, periodo))
      .sort((a, b) => b.reviews - a.reviews)
      .slice(0, 3)
      .map((e) => ({ ...e, nombre: e.nombre || 'Empleado sin nombre registrado' })),
  };
}

const enPeriodo = (periodo) => (f) => f.fecha >= periodo.inicio && f.fecha <= periodo.fin;
const delPeriodo = (compania, periodo) => (f) => (
  f.compania === compania && f.periodo === periodo.tipo && f.inicio === periodo.inicio
);

// Preguntas respondidas cada día del periodo, con los días sin partidas en 0.
function porDia(dias, compania, periodo) {
  const cuenta = new Map(dias.filter((d) => d.compania === compania).map((d) => [d.fecha, d.preguntas]));
  const serie = [];
  for (let f = periodo.inicio; f <= periodo.fin; f = sumarDias(f, 1)) serie.push({ fecha: f, preguntas: cuenta.get(f) || 0 });
  return serie;
}

// Página 1. La query ya trae cada periodo agregado (semanas de lunes a domingo y
// meses): aquí solo se busca la fila de la compañía y el periodo.
export function conocimiento(datos, compania, periodo) {
  const r = datos.resumenes.find(delPeriodo(compania, periodo));
  const info = datos.companias.find((c) => c.compania === compania);

  return {
    activos: r ? r.activos : 0,
    totalJugadores: info ? info.totalJugadores : null,
    experiencias: info ? info.experiencias : [],
    horas: r ? r.segundos / 3600 : 0,
    juegos: r ? r.juegos : 0,
    preguntas: r ? r.preguntas : 0,
    porDia: porDia(datos.dias, compania, periodo),
    // Un jugador inactivo que jugó cuenta en `activos` pero no en `total`: el
    // porcentaje se topa en 100.
    locations: datos.locations.filter(delPeriodo(compania, periodo))
      .map((l) => ({ ...l, nombre: l.nombre || 'Sin nombre', parte: l.total ? Math.min(1, l.activos / l.total) : 0 }))
      .sort((a, b) => b.parte - a.parte || b.activos - a.activos)
      .slice(0, 3),
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
    sedes: premiosPorSede(contadas),
    // CSV de una query 2 vieja: sus premios no traen sede.
    sinSedes: contadas.length > 0 && !contadas.some((e) => e.conSede),
  };
}

// Premios reclamados por sede, con el mejor nivel entre los teams de la sede
// que reclamaron (una sede puede tener uno en plata y otro en oro). Los teams
// sin sede no salen: sus premios cuentan en el total, pero no tienen fila.
export function premiosPorSede(entregas) {
  const sedes = new Map();
  for (const e of entregas) {
    if (!e.sede) continue;
    const s = sedes.get(e.sede) || { nombre: e.sede, nivel: null, premios: 0 };
    s.premios += 1;
    if (e.nivel != null && (s.nivel == null || e.nivel > s.nivel)) s.nivel = e.nivel;
    sedes.set(e.sede, s);
  }
  return [...sedes.values()].sort((a, b) => b.premios - a.premios || a.nombre.localeCompare(b.nombre, 'es'));
}

// Rango de fechas cubierto por los exports. Los resúmenes llegan hasta el día en
// que se corrió la query, que se toma como hoy. El arranque sale de los meses:
// una semana puede empezar antes (la del 31 de agosto) sin que haya datos de ese
// mes.
export function rangoDeDatos(datos) {
  const meses = datos.resumenes.filter((f) => f.periodo === 'mes').map((f) => f.inicio);
  const fechas = [...meses, ...datos.premios.map((f) => f.fecha)]
    .filter(Boolean).sort();
  if (!fechas.length) return { min: null, max: null };
  const hoy = hoyLocal();
  const max = datos.resumenes.length && hoy > fechas[fechas.length - 1] ? hoy : fechas[fechas.length - 1];
  return { min: fechas[0], max };
}

// Compañías con algo que contar (partidas, premios o reviews) en los exports.
export function companiasConDatos(datos) {
  return [...new Set([...datos.resumenes, ...datos.premios, ...datos.fichas].map((f) => f.compania))]
    .sort((a, b) => a.localeCompare(b, 'es'));
}
