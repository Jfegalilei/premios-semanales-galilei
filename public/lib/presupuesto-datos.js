// Cálculos del reporte de presupuesto (`presupuesto.html`): de los CSV de las
// queries A y B (`consultas-presupuesto.js`) a las cifras de una compañía.
// Sin DOM, para poder probarlo aparte.

import { aNumero } from './reporte-datos.js';
import { formatearNombre } from './normalizador.js';
import { MESES, MESES_LARGOS } from './periodos.js';

// Premios anunciados que aún no se pueden reclamar: no salen en el catálogo. La
// query ya los quita; esto cubre los CSV bajados antes del filtro.
const PROXIMAMENTE = /coming[\s_-]*soon|pr[oó]ximamente/i;

// Un premio del catálogo es «Coming soon» si lo dice su nombre o su tipo, o
// cualquier campo del premio entero (t5, en JSON): un texto que lo diga o una
// columna con ese nombre prendida (`coming_soon: true`).
function esProximamente(r) {
  if (PROXIMAMENTE.test(`${r.t1} ${r.t2}`)) return true;
  if (vacio(r.t5)) return false;
  let fila;
  try { fila = JSON.parse(r.t5); } catch { return PROXIMAMENTE.test(r.t5); }
  const revisar = (valor, clave = '') => {
    if (PROXIMAMENTE.test(clave)) return valor === true || valor === 'true' || valor === 1;
    if (typeof valor === 'string') return PROXIMAMENTE.test(valor);
    if (valor && typeof valor === 'object') return Object.entries(valor).some(([k, v]) => revisar(v, k));
    return false;
  };
  return revisar(fila);
}

// Los reclamos que no llegaron a nada no cuentan. Los estados exactos de
// `reward` no están documentados: se descarta por palabra.
const ANULADO = /cancel|reject|fail|expir|refund|revers|declin|anul/i;

const ESTADOS = {
  DELIVERED: 'Entregado', PAID: 'Pagado', PENDING: 'Pendiente', GENERATED: 'Generado',
  REDEEMED: 'Canjeado', IN_PROGRESS: 'En proceso', CREATED: 'Creado', APPROVED: 'Aprobado',
};

// `catalog_prize.level`: puede llegar como número (como `team.prize_level`: 2
// oro, 1 plata, 0 bronce) o como texto.
const NIVELES = [
  { id: 'bronce', nombre: 'Catálogo Bronce', es: /^(0|bronze|bronce)$/i },
  { id: 'plata', nombre: 'Catálogo Plata', es: /^(1|silver|plata)$/i },
  { id: 'oro', nombre: 'Catálogo Oro', es: /^(2|gold|oro)$/i },
];

const RENOVACION = [
  [/day|dia|diar/i, 'cada día'],
  [/week|seman/i, 'cada semana'],
  [/quarter|trimes|3 mon/i, 'cada trimestre'],
  [/year|anual|12 mon/i, 'cada año'],
  [/mon|mes/i, 'cada mes'],
];

const vacio = (t) => t == null || String(t).trim() === '';

// «$1.250.000» en pesos; otra moneda, con su código delante.
export function dinero(n, moneda = 'COP') {
  const cifra = Math.round(n).toLocaleString('es-CO');
  const m = (moneda || 'COP').toUpperCase();
  if (m === 'COP') return `$${cifra}`;
  if (m === 'USD') return `US$${cifra}`;
  return `${cifra} ${m}`;
}

// Varias monedas en un total: «$1.200.000 + US$300».
export function dineros(totales) {
  const partes = Object.entries(totales).filter(([, n]) => n);
  if (!partes.length) return dinero(0);
  return partes.map(([m, n]) => dinero(n, m)).join(' + ');
}

export function fechaCorta(iso) {
  if (!iso) return '';
  return `${Number(iso.slice(8, 10))} ${MESES[Number(iso.slice(5, 7)) - 1]} ${iso.slice(0, 4)}`;
}

// «Octubre 2026»
export function mesLargo(mes) {
  if (!mes) return 'Sin fecha';
  const nombre = MESES_LARGOS[Number(mes.slice(5, 7)) - 1];
  return `${nombre.charAt(0).toUpperCase()}${nombre.slice(1)} ${mes.slice(0, 4)}`;
}

export function mesCorto(iso) {
  if (!iso) return '';
  return `${MESES[Number(iso.slice(5, 7)) - 1]} ${iso.slice(0, 4)}`;
}

const estadoLegible = (t) => {
  const e = String(t || '').toUpperCase();
  if (ESTADOS[e]) return ESTADOS[e];
  return e ? e.charAt(0) + e.slice(1).toLowerCase().replace(/_/g, ' ') : '';
};

// El nombre del premio: el de Nequi con su monto, el resto con su cantidad.
function nombreDelPremio(nombre, tipo, cantidad) {
  const q = aNumero(cantidad);
  if (tipo === 'NEQUI') return q > 0 ? `Bono Nequi ${dinero(q)}` : 'Bono Nequi';
  const base = nombre || 'Premio sin nombre';
  return q > 0 ? base.replace(/\$?\{quantity\}/g, q.toLocaleString('es-CO')) : base.replace(/\$?\{quantity\}/g, '').trim();
}

const nombreDe = (r) => formatearNombre(r.player || r.playername || r.jugador || '') || '';

// Qué query es una tabla, por los tipos de fila que trae.
export function consultaDePresupuesto(registros) {
  for (const r of registros) {
    if (r.tipo === 'reclamo') return 'reclamados';
    if (['presupuesto', 'catalogo', 'disponible', 'especial'].includes(r.tipo)) return 'presupuesto';
  }
  return null;
}

/** Las filas de una de las queries -> las partes de los datos que trae. */
export function interpretarPresupuesto(registros) {
  const datos = datosVacios();
  for (const r of registros) {
    if (!r.compania) continue;
    const base = { compania: r.compania.trim(), fecha: (r.fecha || '').slice(0, 10) };
    if (r.tipo === 'presupuesto') {
      datos.presupuestos.push({ ...base, monto: aNumero(r.n1), loteria: aNumero(r.n2), moneda: r.t1 || 'COP' });
    } else if (r.tipo === 'catalogo') {
      datos.catalogos.push({ ...base, presupuesto: aNumero(r.n1), moneda: r.t1 || 'COP', renovacion: r.t2 || '' });
    } else if (r.tipo === 'disponible') {
      if (esProximamente(r)) continue;
      datos.disponibles.push({
        ...base,
        costo: aNumero(r.n1),
        stock: vacio(r.n2) ? null : aNumero(r.n2),
        nombre: nombreDelPremio(r.t1, r.t2, r.n3),
        tipo: r.t2 || '',
        moneda: r.t3 || 'COP',
        nivel: r.t4 || '',
      });
    } else if (r.tipo === 'especial') {
      datos.especiales.push({
        ...base,
        jugador: nombreDe(r),
        costo: aNumero(r.n1),
        estado: r.t1 || '',
        ...detalleEspecial(r.t2, r.t3),
      });
    } else if (r.tipo === 'reclamo') {
      const tipo = r.t2 || '';
      const nequi = aNumero(r.n3);
      datos.reclamos.push({
        ...base,
        jugador: nombreDe(r),
        veces: aNumero(r.n1) || 1,
        // Nequi: lo pagado de verdad; el resto, lo que costó en el catálogo.
        costo: tipo === 'NEQUI' && nequi ? nequi : aNumero(r.n2),
        nombre: nombreDelPremio(r.t1, tipo, r.n4),
        tipo,
        estado: r.t3 || '',
        moneda: r.t4 || 'COP',
      });
    }
  }
  return datos;
}

export function datosVacios() {
  return { presupuestos: [], catalogos: [], disponibles: [], especiales: [], reclamos: [] };
}

// Une las partes de dos lecturas (la query A y la B llegan por separado).
export function unirDatos(...partes) {
  const total = datosVacios();
  for (const p of partes) for (const k of Object.keys(total)) total[k].push(...(p[k] || []));
  return total;
}

// El nombre y la fecha de un premio Especial. `special_reward` no documenta qué
// columna trae el nombre, así que la query lo manda entero en JSON (igual que la
// rifa que lo sorteó, si hubo) y aquí se busca el primer campo con pinta de nombre.
const CLAVES_NOMBRE = ['name', 'title', 'prize_name', 'reward_name', 'prize', 'description', 'detail', 'details', 'concept', 'notes'];
const CLAVES_FECHA = ['run_date', 'drawn_at', 'executed_at', 'created_at'];

function leerJson(texto) {
  if (vacio(texto)) return null;
  try { return JSON.parse(texto); } catch { return null; }
}

function textoDe(valor) {
  if (typeof valor === 'string') return valor.trim();
  if (valor && typeof valor === 'object') return textoDe(valor.es || valor.en || Object.values(valor)[0]);
  return '';
}

function buscarNombre(obj) {
  if (!obj) return '';
  for (const clave of CLAVES_NOMBRE) {
    const t = textoDe(obj[clave]);
    if (t && !/^[0-9a-f-]{36}$/i.test(t)) return t;
  }
  return '';
}

export function detalleEspecial(jsonRifa, jsonPremio) {
  const rifa = leerJson(jsonRifa);
  const premio = leerJson(jsonPremio);
  const nombre = buscarNombre(premio) || buscarNombre(rifa) || (rifa ? 'Premio de lotería' : 'Premio especial');
  const fechaRifa = rifa && CLAVES_FECHA.map((c) => rifa[c]).find((v) => typeof v === 'string');
  return { nombre, loteria: Boolean(rifa), fechaRifa: fechaRifa ? fechaRifa.slice(0, 10) : '' };
}

/** Las compañías con algo que mostrar, en orden alfabético. */
export function companiasDe(datos) {
  const nombres = new Set();
  for (const k of Object.keys(datos)) for (const f of datos[k]) nombres.add(f.compania);
  return [...nombres].sort((a, b) => a.localeCompare(b, 'es'));
}

const sumarEn = (totales, moneda, n) => {
  const m = (moneda || 'COP').toUpperCase();
  totales[m] = (totales[m] || 0) + n;
};

/**
 * Las cifras del reporte de una compañía.
 *
 * @returns {{ presupuesto, catalogo, reclamados, disponibles, especiales }}
 */
export function presupuestoDe(datos, compania) {
  const de = (lista) => lista.filter((f) => f.compania === compania);

  // Presupuesto: si hubiera más de una fila, la más reciente.
  const [presupuesto = null] = de(datos.presupuestos).sort((a, b) => b.fecha.localeCompare(a.fecha));

  // Catálogos de la compañía: sus presupuestos por periodo, sumados por moneda.
  const catalogos = de(datos.catalogos);
  const presupuestoCatalogo = {};
  for (const c of catalogos) if (c.presupuesto) sumarEn(presupuestoCatalogo, c.moneda, c.presupuesto);
  const renovacion = catalogos.map((c) => renovacionLegible(c.renovacion)).find(Boolean) || '';

  // Reclamados del catálogo: por premio (para «Lo más reclamado») y, para su
  // hoja, por mes junto con los Especiales.
  const reclamos = de(datos.reclamos).filter((r) => !ANULADO.test(r.estado));
  const totalReclamado = {};
  let desde = '';
  let entregas = 0;
  for (const r of reclamos) {
    sumarEn(totalReclamado, r.moneda, r.costo);
    entregas += r.veces;
    if (r.fecha && (!desde || r.fecha < desde)) desde = r.fecha;
  }
  const premios = agruparPorPremio(reclamos);

  // Catálogo actual, por nivel. Lo que queda es el stock menos lo reclamado en
  // el periodo del catálogo (`redeemed` se reinicia al renovarse); sin stock, sin límite.
  const niveles = new Map();
  for (const d of de(datos.disponibles)) {
    const nivel = NIVELES.find((n) => n.es.test(String(d.nivel).trim()));
    const id = nivel?.id || `otro-${d.nivel}`;
    if (!niveles.has(id)) {
      niveles.set(id, { id, nombre: nivel?.nombre || (d.nivel ? `Catálogo ${d.nivel}` : 'Catálogo'), premios: [] });
    }
    // Las unidades del periodo del catálogo (el stock), no las que quedan.
    niveles.get(id).premios.push({ nombre: d.nombre, costo: d.costo, moneda: d.moneda, unidades: d.stock });
  }
  const orden = (id) => {
    const i = NIVELES.findIndex((n) => n.id === id);
    return i === -1 ? NIVELES.length : i;
  };
  const disponibles = [...niveles.values()]
    .sort((a, b) => orden(a.id) - orden(b.id) || a.nombre.localeCompare(b.nombre, 'es'))
    .map((n) => ({ ...n, premios: n.premios.sort((a, b) => b.costo - a.costo || a.nombre.localeCompare(b.nombre, 'es')) }));

  // Especiales: los más recientes primero.
  const especiales = de(datos.especiales)
    .filter((e) => !ANULADO.test(e.estado))
    .map((e) => ({ ...e, fecha: e.fecha || e.fechaRifa, estado: estadoLegible(e.estado) }))
    .sort((a, b) => (b.fecha || '').localeCompare(a.fecha || ''));
  const totalEspeciales = {};
  for (const e of especiales) sumarEn(totalEspeciales, presupuesto?.moneda, e.costo);

  // La hoja de reclamados, por mes (el más reciente primero): los del catálogo y
  // los Especiales, marcados aparte.
  const todos = [
    ...reclamos,
    ...especiales.map((e) => ({
      fecha: e.fecha, nombre: e.nombre, jugador: e.jugador, veces: 1, costo: e.costo,
      moneda: presupuesto?.moneda || 'COP', especial: true,
    })),
  ];
  const porMes = new Map();
  for (const r of todos) {
    const mes = (r.fecha || '').slice(0, 7);
    if (!porMes.has(mes)) porMes.set(mes, []);
    porMes.get(mes).push(r);
  }
  const meses = [...porMes]
    .sort(([a], [b]) => (b || '0').localeCompare(a || '0'))
    .map(([mes, filas]) => {
      const totales = {};
      for (const f of filas) sumarEn(totales, f.moneda, f.costo);
      return {
        mes,
        nombre: mesLargo(mes),
        entregas: filas.reduce((s, f) => s + f.veces, 0),
        totales,
        premios: agruparPorPremio(filas),
      };
    });

  return {
    presupuesto,
    catalogo: { presupuesto: presupuestoCatalogo, renovacion },
    reclamados: { premios, entregas, desde, totales: totalReclamado, meses },
    disponibles,
    especiales: { lista: especiales, totales: totalEspeciales },
  };
}

// Reclamos -> un premio por nombre, con cuántas veces, cuánto costó y quién lo
// reclamó; los más reclamados primero. Un Especial no se junta con uno del
// catálogo aunque se llamen igual.
function agruparPorPremio(filas) {
  const porPremio = new Map();
  for (const r of filas) {
    const clave = `${r.especial ? 'e' : 'c'}|${r.nombre}`;
    if (!porPremio.has(clave)) {
      porPremio.set(clave, { nombre: r.nombre, especial: Boolean(r.especial), conteo: 0, totales: {}, personas: new Map() });
    }
    const p = porPremio.get(clave);
    p.conteo += r.veces;
    sumarEn(p.totales, r.moneda, r.costo);
    const quien = r.jugador || 'Sin nombre';
    p.personas.set(quien, (p.personas.get(quien) || 0) + r.veces);
  }
  return [...porPremio.values()]
    .map((p) => ({
      ...p,
      total: Object.values(p.totales).reduce((s, n) => s + n, 0),
      personas: [...p.personas].map(([nombre, veces]) => ({ nombre, veces }))
        .sort((a, b) => b.veces - a.veces || a.nombre.localeCompare(b.nombre, 'es')),
    }))
    .sort((a, b) => b.conteo - a.conteo || b.total - a.total);
}

function renovacionLegible(texto) {
  if (vacio(texto)) return '';
  const hit = RENOVACION.find(([re]) => re.test(texto));
  return hit ? hit[1] : '';
}

/* ---------- datos de ejemplo ---------- */

// Una compañía inventada con las cuatro partes, en el formato de las filas que
// salen de los CSV (claves ya normalizadas). Para `presupuesto.html?demo`.
export function registrosDeEjemplo(hoy) {
  const co = 'Cliente Demo';
  const filas = [];
  const fila = (o) => filas.push({ compania: co, fecha: '', playerid: '', n1: '', n2: '', n3: '', n4: '', t1: '', t2: '', t3: '', t4: '', player: '', ...o });
  const dias = (n) => {
    const d = new Date(`${hoy}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() - n);
    return d.toISOString().slice(0, 10);
  };

  fila({ tipo: 'presupuesto', fecha: dias(3), n1: '4800000', n2: '600000', t1: 'COP' });
  fila({ tipo: 'catalogo', n1: '1500000', t1: 'COP', t2: 'MONTHLY' });
  [
    ['Bono Nequi de ${quantity} pesos', 'NEQUI', 20000, '', 20000, '0'],
    ['Netflix 1 mes', 'STANDARD', 35000, 10, 4, '0'],
    ['CinecoPass 2D x2', 'STANDARD', 40000, 8, 8, '0'],
    ['Audífonos Xiaomi Redmi Buds', 'STANDARD', 150000, 5, 2, '1'],
    ['Bono Adidas', 'STANDARD', 200000, 3, 1, '1'],
    ['Freidora de Aire', 'STANDARD', 400000, 2, 1, '2'],
    ['Barril Ahumador', 'STANDARD', 700000, 1, 0, '2'],
    ['Coming soon', 'STANDARD', 0, '', 0, '2'],
    ['Bono Nequi de ${quantity} pesos', 'NEQUI', 50000, '', 50000, '1'],
  ].forEach(([t1, t2, n1, n2, n3, t4]) => fila({ tipo: 'disponible', n1: String(n1), n2: String(n2), n3: String(n3), t1, t2, t3: 'COP', t4 }));
  fila({ tipo: 'disponible', n1: '90000', n2: '2', t1: 'Parlante JBL', t2: 'STANDARD', t3: 'COP', t4: '1', t5: '{"internal_name":"jbl","status":"COMING_SOON"}' });

  const gente = ['LAURA GOMEZ', 'andres restrepo', 'Camila Torres', 'Julián Ospina', 'Valentina Ríos', 'Santiago Mejía',
    'Daniela Cárdenas', 'Felipe Arango', 'Mariana López', 'Tomás Herrera', 'Sara Jiménez', 'Mateo Castaño'];
  const reclamos = [
    ['Bono Nequi de ${quantity} pesos', 'NEQUI', 50000, 'REDEEMED', [0, 1, 2, 3, 4, 5, 6, 7]],
    ['Bono Nequi de ${quantity} pesos', 'NEQUI', 20000, 'GENERATED', [2, 8, 9, 10, 11]],
    ['Netflix 1 mes', 'STANDARD', 0, 'DELIVERED', [1, 3, 5, 7, 9]],
    ['CinecoPass 2D x2', 'STANDARD', 0, 'DELIVERED', [0, 4, 6, 8, 10, 11]],
    ['Audífonos Xiaomi Redmi Buds', 'STANDARD', 0, 'DELIVERED', [2, 6]],
    ['Freidora de Aire', 'STANDARD', 0, 'PAID', [0]],
    ['Bono Adidas', 'STANDARD', 0, 'CANCELLED', [3]],
  ];
  const costo = { 'Netflix 1 mes': 35000, 'CinecoPass 2D x2': 40000, 'Audífonos Xiaomi Redmi Buds': 150000, 'Freidora de Aire': 400000, 'Bono Adidas': 200000 };
  reclamos.forEach(([t1, t2, cantidad, t3, quienes], i) => quienes.forEach((g, j) => {
    const veces = (g + i) % 4 === 0 ? 2 : 1;
    const valor = t2 === 'NEQUI' ? cantidad : costo[t1];
    fila({
      tipo: 'reclamo', fecha: dias(220 - i * 17 - j * 3), playerid: `demo-${g}`, player: gente[g],
      n1: String(veces), n2: String(valor * veces), n3: t2 === 'NEQUI' ? String(valor * veces) : '',
      n4: t2 === 'NEQUI' ? String(cantidad) : '', t1, t2, t3, t4: 'COP',
    });
  }));

  fila({ tipo: 'especial', fecha: dias(20), playerid: 'demo-3', player: gente[3], n1: '1200000', t1: 'DELIVERED', t2: '{"run_date":"x"}', t3: '{"name":"Televisor 50 pulgadas"}' });
  fila({ tipo: 'especial', fecha: dias(52), playerid: 'demo-7', player: gente[7], n1: '450000', t1: 'DELIVERED', t2: '', t3: '{"description":"Bono de cumpleaños de la empresa"}' });
  fila({ tipo: 'especial', fecha: '', playerid: 'demo-10', player: gente[10], n1: '300000', t1: 'PENDING', t2: '', t3: '{}' });
  return filas;
}
