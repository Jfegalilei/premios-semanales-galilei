// Reporte de presupuesto (`presupuesto.html`): los CSV de las queries A y B ->
// hojas de celular por compañía -> PDF. Mismo estilo que el reporte para
// clientes, pero aparte: no va por periodo, es la foto de hoy.
//
//   lib/consultas-presupuesto.js  las dos queries
//   lib/presupuesto-datos.js      de los CSV a las cifras de cada compañía
//   lib/hoja-presupuesto.js       cómo se dibuja cada hoja
//
// Los CSV se leen solo en el navegador (las reglas de Firestore de `reporteDatos`
// no aceptan estas queries). El nombre y el logo del cliente sí son los del
// equipo (`clientes` en Firestore), los mismos del reporte para clientes.

import { CONSULTAS_PRESUPUESTO } from './lib/consultas-presupuesto.js';
import {
  interpretarPresupuesto, consultaDePresupuesto, unirDatos, datosVacios, companiasDe, presupuestoDe,
  registrosDeEjemplo, dinero, dineros,
} from './lib/presupuesto-datos.js';
import {
  dibujarResumen, dibujarLista, itemsReclamados, itemsCatalogo, paginar,
} from './lib/hoja-presupuesto.js';
import { leerTabla } from './lib/csv.js';
import { ESTILO } from './lib/plantillas.js';
import { listaDePersonajes, listaDeFondos, cargarImagen } from './lib/imagenes.js';
import { escucharClientes, guardarCliente } from './lib/nube.js';
import { personajeDe, azarConSemilla } from './lib/lienzo.js';
import { slug } from './lib/normalizador.js';
import { diaMes, hoyLocal } from './lib/periodos.js';
import { pintarConsultas, escucharArrastre } from './reporte/panel-carga.js';
import { pdfDe, zipDe, descargarBlob } from './reporte/exportar.js';

const $ = (sel) => document.querySelector(sel);
const NOMBRES = { presupuesto: 'Query A · Presupuesto, catálogo y Especiales', reclamados: 'Query B · Premios reclamados' };
// El chat devuelve como mucho 10.000 filas: si una query llega ahí, faltan datos.
const TOPE_CHAT = 10000;

const estado = {
  partes: {},           // query -> datos leídos de su CSV
  ejemplo: false,
  filas: {},            // query -> filas que trajo (para avisar del tope del chat)
  datos: datosVacios(),
  companias: [],
  seleccion: null,
  hoy: hoyLocal(),
  nombresCliente: {},
  logos: new Map(),
  logo: null,
  personajes: [],
  fondos: [],
  listo: false,
  lienzosVista: [],
  lienzosPdf: [],
};
const nombresPendientes = {};

init();

async function init() {
  pintarConsultas($('#listaConsultas'), null, CONSULTAS_PRESUPUESTO);
  pintarArchivos();
  escucharClientes(alCambiarClientes, errorNube);

  $('#botonEjemplo').addEventListener('click', cargarEjemplo);
  $('#entradaCsv').addEventListener('change', (e) => {
    leerArchivos([...e.target.files]);
    e.target.value = '';
  });
  escucharArrastre($('#zonaVacia'), leerArchivos);
  prepararNombreCliente();
  $('#botonDescargar').addEventListener('click', descargar);
  $('#botonExportarTodo').addEventListener('click', exportarTodo);

  // El canvas no cuenta como uso de una webfont: cada peso se pide a mano.
  const caras = ['500', '600', '700'].flatMap((p) => [
    `${p} 32px ${ESTILO.fuenteTitulo}`, `${p} 24px ${ESTILO.fuenteGanadores}`,
  ]);
  [estado.logo, estado.personajes, estado.fondos] = await Promise.all([
    cargarImagen('marca/logo-galilei.png').catch(() => null),
    listaDePersonajes(),
    listaDeFondos(),
    ...caras.map((c) => document.fonts.load(c).catch(() => {})),
  ]);
  estado.listo = true;
  if (new URLSearchParams(location.search).has('demo')) cargarEjemplo();
  else pintar();
}

function errorNube(err) {
  const aviso = $('#avisoNube');
  aviso.hidden = false;
  aviso.textContent = `No se pudo leer o guardar en Firestore (${err.code || err.message}). El nombre y el logo del cliente pueden no salir.`;
}

async function alCambiarClientes(clientes) {
  const logos = new Map();
  await Promise.all(clientes.filter((c) => c.logo).map(async (c) => {
    const img = await cargarImagen(c.logo).catch(() => null);
    if (img) logos.set(c.id, img);
  }));
  estado.logos = logos;
  const nombres = Object.fromEntries(clientes.filter((c) => c.nombre).map((c) => [c.id, c.nombre]));
  estado.nombresCliente = { ...nombres, ...nombresPendientes };
  pintarCompanias();
  pintar();
}

// El nombre del cliente es el mismo del reporte para clientes: se guarda para el equipo.
function prepararNombreCliente() {
  const campo = $('#campoCliente');
  let espera = null;
  const enviar = () => {
    clearTimeout(espera);
    for (const [id, nombre] of Object.entries(nombresPendientes)) {
      guardarCliente(id, { nombre })
        .then(() => { if (nombresPendientes[id] === nombre) delete nombresPendientes[id]; })
        .catch(errorNube);
    }
  };
  campo.addEventListener('input', () => {
    if (!estado.seleccion) return;
    const id = slug(estado.seleccion);
    estado.nombresCliente[id] = campo.value;
    nombresPendientes[id] = campo.value;
    pintar();
    clearTimeout(espera);
    espera = setTimeout(enviar, 600);
  });
  campo.addEventListener('blur', enviar);
}

/* ---------- datos ---------- */

async function leerArchivos(archivos) {
  const errores = [];
  if (estado.ejemplo) {
    estado.partes = {};
    estado.filas = {};
    estado.ejemplo = false;
  }
  for (const archivo of archivos) {
    try {
      const { registros } = leerTabla(await archivo.text());
      const consulta = consultaDePresupuesto(registros);
      if (!consulta) throw new Error('no trae las filas de las queries A o B de esta página');
      estado.partes[consulta] = interpretarPresupuesto(registros);
      estado.filas[consulta] = registros.length;
    } catch (err) {
      errores.push(`${archivo.name}: ${err.message}`);
    }
  }
  if (errores.length) alert(`No se pudo leer:\n${errores.join('\n')}`);
  actualizar();
}

function cargarEjemplo() {
  const datos = interpretarPresupuesto(registrosDeEjemplo(estado.hoy));
  estado.partes = { presupuesto: datos };
  estado.filas = {};
  estado.ejemplo = true;
  actualizar();
}

function actualizar() {
  estado.datos = unirDatos(...Object.values(estado.partes));
  estado.companias = companiasDe(estado.datos);
  if (!estado.companias.includes(estado.seleccion)) estado.seleccion = estado.companias[0] || null;
  const hay = estado.companias.length > 0;
  $('#zonaVacia').classList.toggle('compacta', hay);
  $('#panelTrabajo').classList.toggle('oculto', !hay);
  if (hay) $('#panelConsultas details').open = false;
  pintarArchivos();
  pintarCompanias();
  pintar();
}

function pintarArchivos() {
  const pastillas = [
    estado.ejemplo && [true, 'Ejemplo con datos inventados'],
    !estado.ejemplo && [Boolean(estado.partes.presupuesto), NOMBRES.presupuesto],
    !estado.ejemplo && [Boolean(estado.partes.reclamados), NOMBRES.reclamados],
  ].filter(Boolean);
  $('#estadoArchivos').replaceChildren(...pastillas.map(([listo, texto]) => {
    const span = document.createElement('span');
    span.className = listo ? 'listo' : '';
    span.textContent = `${listo ? '✓ ' : ''}${texto}`;
    return span;
  }));
}

function pintarCompanias() {
  const lista = $('#listaCompanias');
  lista.replaceChildren(...estado.companias.map((nombre) => {
    const r = presupuestoDe(estado.datos, nombre);
    const boton = document.createElement('button');
    boton.type = 'button';
    boton.setAttribute('aria-current', String(nombre === estado.seleccion));
    boton.innerHTML = '<span></span><span class="meta"></span>';
    boton.children[0].textContent = nombre;
    boton.children[1].textContent = [
      r.presupuesto ? `Presupuesto ${dinero(r.presupuesto.monto, r.presupuesto.moneda)}` : 'Sin presupuesto',
      `${r.reclamados.entregas} reclamados`,
    ].join(' · ');
    boton.addEventListener('click', () => {
      estado.seleccion = nombre;
      pintarCompanias();
      pintar();
    });
    const li = document.createElement('li');
    li.appendChild(boton);
    return li;
  }));
}

/* ---------- hojas ---------- */

function reporteDe(compania) {
  return {
    compania,
    cliente: estado.nombresCliente[slug(compania)] || compania,
    logoCliente: estado.logos.get(slug(compania)) || null,
    ...presupuestoDe(estado.datos, compania),
  };
}

// Las páginas del PDF de una compañía: el resumen y las tres listas, cada una
// partida en las hojas que necesite.
function paginasDe(r) {
  const semilla = `${r.compania}|presupuesto|${estado.hoy}`;
  const comunes = {
    kicker: r.cliente,
    logoCliente: r.logoCliente,
    logo: estado.logo,
    etiqueta: `Al ${diaMes(estado.hoy)} ${estado.hoy.slice(0, 4)}`,
    trofeo: null,
    tituloCompleto: true,
  };
  const paginas = [{
    nombre: 'Presupuesto',
    dibujar: (lienzo, fondo) => dibujarResumen(lienzo, {
      ...comunes,
      titulo: 'Presupuesto\nde premios',
      personaje: personajeDe(estado.personajes, `${semilla}|resumen`),
      fondo,
      datos: r,
    }),
  }];

  const catalogo = Object.keys(r.catalogo.presupuesto).length
    ? `Presupuesto del catálogo: ${dineros(r.catalogo.presupuesto)}${r.catalogo.renovacion ? ` ${r.catalogo.renovacion}` : ''}`
    : '';
  // Reclamados lleva también los Especiales: el subtítulo los cuenta.
  const meses = r.reclamados.meses;
  const entregas = meses.reduce((s, m) => s + m.entregas, 0);
  const totales = {};
  for (const m of meses) for (const [mon, n] of Object.entries(m.totales)) totales[mon] = (totales[mon] || 0) + n;
  const listas = [
    {
      nombre: 'Reclamados',
      // En un renglón: sin Gali, el título tiene todo el ancho.
      titulo: 'Premios reclamados',
      subtitulo: entregas ? `${entregas} premios · ${dineros(totales)}` : '',
      items: itemsReclamados(r.reclamados),
      vacio: 'Todavía nadie ha reclamado premios',
    },
    {
      nombre: 'Catálogo',
      titulo: 'Catálogo actual',
      subtitulo: catalogo,
      items: itemsCatalogo(r.disponibles, r.catalogo.renovacion),
      vacio: 'No hay premios activos en el catálogo',
    },
  ];
  for (const l of listas) {
    const hojas = l.items.length ? paginar(l.items) : [[]];
    hojas.forEach((items, n) => paginas.push({
      nombre: hojas.length > 1 ? `${l.nombre} (${n + 1} de ${hojas.length})` : l.nombre,
      dibujar: (lienzo, fondo) => dibujarLista(lienzo, {
        ...comunes,
        titulo: l.titulo,
        subtitulo: n === 0 ? l.subtitulo : '',
        // Sin Gali: la lista ocupa la hoja y el título va a todo el ancho.
        personaje: null,
        fondo,
        items,
        vacio: l.vacio,
      }),
    }));
  }
  return { paginas, fondos: barajar(estado.fondos, `${semilla}|fondos`) };
}

function componer(r, lienzos) {
  const { paginas, fondos } = paginasDe(r);
  while (lienzos.length < paginas.length) lienzos.push(document.createElement('canvas'));
  paginas.forEach((p, i) => p.dibujar(lienzos[i], fondos[i % fondos.length] || null));
  return { hojas: lienzos.slice(0, paginas.length), nombres: paginas.map((p) => p.nombre) };
}

function barajar(lista, semilla) {
  const azar = azarConSemilla(semilla);
  return lista.map((f) => [azar(), f]).sort((a, b) => a[0] - b[0]).map(([, f]) => f);
}

function pintar() {
  const vista = $('#vistaHojas');
  const compania = estado.seleccion;
  if (!compania || !estado.listo) {
    vista.replaceChildren();
    $('#avisoReporte').replaceChildren();
    return;
  }
  const campo = $('#campoCliente');
  const escrito = estado.nombresCliente[slug(compania)] || '';
  if (document.activeElement !== campo && campo.value !== escrito) campo.value = escrito;
  campo.placeholder = compania;

  const r = reporteDe(compania);
  const { hojas, nombres } = componer(r, estado.lienzosVista);
  vista.replaceChildren(...hojas.map((canvas, i) => {
    const figura = document.createElement('figure');
    figura.className = 'diapositiva';
    const pie = document.createElement('figcaption');
    pie.textContent = `Página ${i + 1} · ${nombres[i]}`;
    figura.append(canvas, pie);
    return figura;
  }));
  pintarAvisos(avisos(r));
}

function pintarAvisos(lista) {
  $('#avisoReporte').replaceChildren(...lista.map(({ texto, info }) => {
    const li = document.createElement('li');
    if (info) li.className = 'info';
    li.textContent = texto;
    return li;
  }));
}

function avisos(r) {
  const lista = [];
  if (estado.ejemplo) lista.push({ info: true, texto: 'Datos inventados: carga los CSV de las queries A y B para ver los de verdad' });
  if (!estado.ejemplo && !estado.partes.presupuesto) lista.push({ texto: `Falta el CSV de la ${NOMBRES.presupuesto}` });
  if (!estado.ejemplo && !estado.partes.reclamados) lista.push({ texto: `Falta el CSV de la ${NOMBRES.reclamados}` });
  for (const [consulta, n] of Object.entries(estado.filas)) {
    if (n >= TOPE_CHAT - 1) lista.push({ texto: `La ${NOMBRES[consulta]} llegó al tope de ${TOPE_CHAT.toLocaleString('es-CO')} filas del chat: pueden faltar datos` });
  }
  if (estado.partes.presupuesto && !r.presupuesto) lista.push({ texto: 'Esta compañía no tiene presupuesto en la base' });
  const sinNombre = r.especiales.lista.filter((e) => /^Premio (especial|de lotería)$/.test(e.nombre)).length;
  if (sinNombre) lista.push({ info: true, texto: `${sinNombre} premios Especiales salen sin nombre: la base no trae uno` });
  return lista;
}

/* ---------- PDF ---------- */

const nombreArchivo = (compania) => `presupuesto-${slug(compania)}-${estado.hoy}.pdf`;

function pdfDeCompania(compania) {
  const { hojas } = componer(reporteDe(compania), estado.lienzosPdf);
  return pdfDe(hojas);
}

async function conBoton(boton, tarea) {
  const texto = boton.textContent;
  boton.disabled = true;
  try {
    await tarea((t) => { boton.textContent = t; });
  } finally {
    boton.disabled = false;
    boton.textContent = texto;
  }
}

async function descargar() {
  if (!estado.seleccion) return;
  await conBoton($('#botonDescargar'), async (rotulo) => {
    rotulo('Generando…');
    await new Promise((r) => setTimeout(r, 0));
    try {
      descargarBlob(pdfDeCompania(estado.seleccion), nombreArchivo(estado.seleccion));
    } catch (err) {
      alert(`No se pudo generar el PDF: ${err.message}`);
    }
  });
}

async function exportarTodo() {
  if (!estado.companias.length) return;
  await conBoton($('#botonExportarTodo'), async (rotulo) => {
    try {
      const zip = await zipDe(
        estado.companias.map((c) => ({ nombre: nombreArchivo(c), crear: () => pdfDeCompania(c) })),
        (n, total) => rotulo(`Preparando ${n} de ${total}…`),
      );
      descargarBlob(zip, `presupuestos-${estado.hoy}.zip`);
    } catch (err) {
      alert(`No se pudo armar el ZIP: ${err.message}`);
    }
  });
}
