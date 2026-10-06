// Reporte para clientes: los CSV de las queries -> hojas de celular por compañía
// y periodo -> PDF.
//
// Este archivo solo coordina la página: el estado, los datos cargados, la lista
// de compañías, la vista previa y los botones. Cada pieza vive en su módulo:
//   reporte/panel-carga.js  pasos 1 y 2: queries y CSV
//   reporte/datos-guardados.js  los CSV guardados para el equipo, por query y mes
//   reporte/lista-companias.js  paso 4: compañías por grupo (Training / Reseñas)
//   reporte/loterias.js     paso 3: las loterías del mes (Firestore)
//   reporte/hojas.js        qué hojas lleva cada compañía y cómo se dibujan
//   reporte/exportar.js     PDF, ZIP y descarga
//   lib/reporte-datos.js    de los CSV a las cifras de cada hoja

import { periodosEntre, hoyLocal, inicioMesAnterior } from './lib/periodos.js';
import { csvDeEjemplo } from './lib/reporte-demo.js';
import {
  interpretarArchivo, interpretarTabla, conocimiento, premiosEntregados, reviews, loteria, loteriaAuteco, loteriaResenas, servicios,
  rangoDeDatos, companiasConDatos, SIN_REVIEWS,
} from './lib/reporte-datos.js';
import { ESTILO } from './lib/plantillas.js';
import {
  listaDePersonajes, listaDeFondos, cargarImagen, perfilesOpacos, cajaDelProducto,
} from './lib/imagenes.js';
import {
  escucharPremios, escucharClientes, guardarCliente, escucharDatosReporte, guardarDatosReporte,
} from './lib/nube.js';
import { leerTabla } from './lib/csv.js';
import { tipoDeArchivo } from './lib/consultas.js';
import { documentosDeSubida, tablasGuardadas } from './reporte/datos-guardados.js';
import { slug } from './lib/normalizador.js';
import { pintarConsultas, pintarArchivos, escucharArrastre } from './reporte/panel-carga.js';
import {
  LOTERIAS, loteriaDe, montarLoterias, rifaParaHoja,
} from './reporte/loterias.js';
import { componerReporte } from './reporte/hojas.js';
import { crearListaCompanias, grupoDe } from './reporte/lista-companias.js';
import { montarLogoCliente } from './reporte/logo-cliente.js';
import { montarVistas } from './reporte/vistas.js';
import { pdfDe, zipDe, descargarBlob } from './reporte/exportar.js';

const $ = (sel) => document.querySelector(sel);

let listaCompanias = null;
let logoCliente = null;
let vistas = null;
// Nombres de cliente escritos que Firestore aún no confirmó (slug -> nombre).
const nombresPendientes = {};

const estado = {
  datos: null,          // ver `datosVacios`
  ejemplo: false,       // los datos cargados son los inventados
  guardados: [],        // documentos de `reporteDatos` (los CSV del equipo)
  subidas: {},          // query -> { subido, por }: la última subida de cada una
  periodos: [],
  periodo: null,
  companias: [],
  seleccion: null,
  nombresCliente: {},   // slug de la compañía -> nombre escrito a mano (Firestore, `clientes`)
  rifas: {},            // lotería -> { rifa, foto } (paso 3)
  catalogo: [],
  imagenes: new Map(),  // id del premio -> recorte (HTMLImageElement medido)
  logos: new Map(),     // slug de la compañía -> logo en blanco (HTMLImageElement)
  logo: null,
  trofeo: null,
  galiPreocupado: null, // Gali de la hoja que pide las metas
  medallas: null,       // las medallas de Bronce, Oro y Plata, de la misma hoja
  personajes: [],
  fondos: [],
  listo: false,         // imágenes y fuentes cargadas: antes no se dibuja
  lienzosVista: [],     // se reutilizan entre repintados: cada uno pesa ~30 MB
  lienzosPdf: [],
};

init();

async function init() {
  estado.datos = datosVacios();
  pintarConsultas($('#listaConsultas'));
  pintarArchivos($('#estadoArchivos'), estado.datos);
  listaCompanias = crearListaCompanias($('#listaCompanias'), { alElegir: elegirCompania });
  logoCliente = montarLogoCliente({ compania: () => estado.seleccion, alError: errorNube });
  vistas = montarVistas($('#vistasCliente'), {
    alCambiar: () => {
      pintarCompanias();
      pintar();
    },
  });
  montarLoterias($('#listaLoterias'), {
    hoy: hoyLocal(),
    alCambiar: (rifas, mes) => {
      estado.rifas = rifas;
      pintarResumenLoterias(mes);
      pintar();
    },
    alError: errorNube,
  });

  escucharDatosReporte(alCambiarGuardados, errorNube);
  escucharPremios(alCambiarCatalogo, errorNube);
  escucharClientes(alCambiarClientes, errorNube);

  $('#botonEjemplo').addEventListener('click', cargarEjemplo);
  $('#entradaCsv').addEventListener('change', (e) => {
    leerArchivos([...e.target.files]);
    e.target.value = '';
  });
  escucharArrastre($('#zonaVacia'), leerArchivos);

  $('#campoPeriodo').addEventListener('change', (e) => {
    estado.periodo = estado.periodos.find((p) => p.id === e.target.value) || null;
    pintarCompanias();
    pintar();
  });
  prepararNombreCliente();
  $('#botonDescargar').addEventListener('click', descargar);
  $('#botonExportarTodo').addEventListener('click', exportarTodo);

  // Lo que dibujan las hojas. El canvas no cuenta como uso de una webfont, así
  // que cada peso se pide a mano antes del primer dibujo.
  const caras = ['500', '600', '700'].flatMap((p) => [
    `${p} 32px ${ESTILO.fuenteTitulo}`, `${p} 24px ${ESTILO.fuenteGanadores}`,
  ]);
  [estado.logo, estado.trofeo, estado.galiPreocupado, estado.medallas, estado.personajes, estado.fondos] = await Promise.all([
    cargarImagen('marca/logo-galilei.png').catch(() => null),
    cargarImagen('Assets/Iconos/trofeo.webp').catch(() => null),
    cargarPersonaje('Assets/Personajes/Gali-preocupado.webp'),
    cargarImagen('Assets/Iconos/medallas.webp').catch(() => null),
    listaDePersonajes(),
    listaDeFondos(),
    ...caras.map((c) => document.fonts.load(c).catch(() => {})),
  ]);
  estado.listo = true;
  if (new URLSearchParams(location.search).has('demo')) cargarEjemplo();
  else pintar();
}

// Una pose suelta (fuera de `lista.json`, que es el sorteo de las demás hojas),
// medida como las de la lista para que la cabecera la sepa colocar.
async function cargarPersonaje(ruta) {
  const img = await cargarImagen(ruta).catch(() => null);
  if (!img) return null;
  img.nombre = ruta;
  img.caja = cajaDelProducto(perfilesOpacos(img).columnas);
  return img;
}

function errorNube(err) {
  const aviso = $('#avisoNube');
  aviso.hidden = false;
  aviso.textContent = `No se pudo leer o guardar en Firestore (${err.code || err.message}). `
    + 'La inversión en premios físicos, los recortes y las loterías pueden no salir.';
}

// Los recortes se miden como en la semanal: la pieza usa la máscara para pegar
// el «xN» sobre el producto. Solo se vuelven a medir los que cambiaron.
async function alCambiarCatalogo(premios) {
  $('#avisoNube').hidden = true;
  const imagenes = new Map();
  await Promise.all(premios.filter((p) => p.imagen).map(async (p) => {
    const previa = estado.imagenes.get(p.id);
    if (previa && previa.fuente === p.imagen) {
      imagenes.set(p.id, previa);
      return;
    }
    const img = await cargarImagen(p.imagen).catch(() => null);
    if (!img) return;
    const perfiles = perfilesOpacos(img);
    Object.assign(img, {
      fuente: p.imagen, mascara: perfiles.mascara, caja: cajaDelProducto(perfiles.columnas),
    });
    imagenes.set(p.id, img);
  }));
  estado.catalogo = premios.map(({ imagen, ...resto }) => resto);
  estado.imagenes = imagenes;
  pintarCompanias();
  pintar();
}

// Logo y nombre a mano de cada cliente, compartidos por todo el equipo.
async function alCambiarClientes(clientes) {
  const logos = new Map();
  await Promise.all(clientes.filter((c) => c.logo).map(async (c) => {
    const img = await cargarImagen(c.logo).catch(() => null);
    if (img) logos.set(c.id, img);
  }));
  estado.logos = logos;
  // Lo que se está escribiendo y aún no se guardó no se pisa.
  const nombres = Object.fromEntries(clientes.filter((c) => c.nombre).map((c) => [c.id, c.nombre]));
  estado.nombresCliente = { ...nombres, ...nombresPendientes };
  pintarCompanias();
  pintar();
}

// El nombre del cliente que sale en el PDF (si no, el de la base). Se guarda en
// Firestore al dejar de escribir, al salir del campo y al cambiar de ventana.
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
  window.addEventListener('blur', enviar);
}

// El paso 3 dice cómo va cada lotería en el mes elegido y, si ya están todas
// listas cuando llegan de Firestore, se pliega solo (una vez: después manda
// quien lo abra o cierre).
let loteriasPlegadas = false;
function pintarResumenLoterias(mes) {
  const ids = Object.keys(LOTERIAS);
  const lista = (id) => {
    const { rifa } = rifaParaHoja(id, mes, estado.rifas);
    return Boolean(rifa.premio && rifa.live);
  };
  const { rifa } = rifaParaHoja(ids[0], mes, estado.rifas);
  $('#resumenLoterias').textContent = `${rifa.mes.charAt(0).toUpperCase()}${rifa.mes.slice(1)}: ${ids
    .map((id) => `${LOTERIAS[id].nombre} ${lista(id) ? '✓' : '· falta completar'}`).join('  ·  ')}`;
  if (!loteriasPlegadas && ids.every(lista)) {
    $('#panelLoterias details').open = false;
    loteriasPlegadas = true;
  }
}

/* ---------- datos ---------- */

// Lo guardado manda: cada vez que cambia (una subida propia o de alguien más) se
// rearman los datos con todo lo que hay.
function alCambiarGuardados(documentos) {
  estado.guardados = documentos;
  const { tablas, subidas } = tablasGuardadas(documentos);
  estado.subidas = subidas;
  if (!Object.keys(tablas).length) return;
  estado.datos = datosVacios();
  for (const tabla of Object.values(tablas)) Object.assign(estado.datos, interpretarTabla(tabla));
  estado.ejemplo = false;
  alCambiarDatos();
}

function datosVacios() {
  return { resumenes: [], locations: [], dias: [], loterias: [], autecos: [], companias: [], premios: [], ...SIN_REVIEWS() };
}

// Cada archivo reemplaza solo lo que trae (ver `interpretarArchivo`) y se guarda
// para el equipo: cada mes que trae queda con esta subida.
async function leerArchivos(archivos) {
  if (!archivos.length) return;
  const errores = [];
  const guardadas = [];
  const existentes = new Set(estado.guardados.map((d) => d.id));
  for (const archivo of archivos) {
    try {
      const texto = await archivo.text();
      Object.assign(estado.datos, interpretarArchivo(texto));
      estado.ejemplo = false;
      const tabla = leerTabla(texto);
      // El export de la pieza semanal no se guarda: no es de las queries.
      if (tipoDeArchivo(tabla.columnas) === 'reporte') {
        aviso(`Guardando «${archivo.name}» para el equipo…`);
        const { consulta, documentos, meses } = documentosDeSubida(tabla, {
          existentes, subido: new Date().toISOString(), por: '',
        });
        await guardarDatosReporte(documentos);
        documentos.forEach((d) => existentes.add(d.id));
        guardadas.push(`${NOMBRES_CONSULTA[consulta]} (${meses.map(nombreMesCorto).join(' y ')})`);
      }
    } catch (err) {
      errores.push(`«${archivo.name}»: ${err.message}`);
    }
  }
  if (errores.length) alert(`No se pudieron leer o guardar:\n${errores.join('\n')}`);
  aviso(guardadas.length ? `✓ Guardado para el equipo: ${guardadas.join(' · ')}` : '');
  alCambiarDatos();
}

const NOMBRES_CONSULTA = {
  conocimiento: 'Query 1', premios: 'Query 2', reviews: 'Query 3', auteco: 'Query 4',
};
const nombreMesCorto = (mes) => new Date(`${mes}-15T12:00:00`).toLocaleString('es-CO', { month: 'long' });

function aviso(texto) {
  const p = $('#estadoSubida');
  p.hidden = !texto;
  p.textContent = texto;
}

function cargarEjemplo() {
  Object.assign(estado.datos, interpretarArchivo(csvDeEjemplo()));
  estado.ejemplo = true;
  alCambiarDatos();
}

// Periodos con datos de la query 1 (semanas y meses que trae): los demás salen
// marcados en el selector y piden subir los CSV.
const clavePeriodo = (tipo, inicio) => `${tipo}|${inicio}`;
function periodosConDatos() {
  return new Set([...estado.datos.resumenes, ...estado.datos.resenas].map((f) => clavePeriodo(f.periodo, f.inicio)));
}

function alCambiarDatos() {
  pintarArchivos($('#estadoArchivos'), estado.datos, { ejemplo: estado.ejemplo, subidas: estado.subidas });
  const { min, max } = rangoDeDatos(estado.datos);
  estado.periodos = periodosEntre(min, max);
  estado.companias = companiasConDatos(estado.datos);
  // Por defecto, la primera de Training (o la primera que haya).
  if (!estado.companias.includes(estado.seleccion)) {
    estado.seleccion = estado.companias.find((c) => grupoDe(servicios(estado.datos, c)) === 'training')
      || estado.companias[0] || null;
  }

  // Por defecto, el mes anterior (el último mes completo); si no está, la última
  // semana completa con datos (o la más reciente si no hay).
  const conDatos = periodosConDatos();
  const previo = estado.periodos.find((p) => p.id === estado.periodo?.id);
  estado.periodo = previo
    || estado.periodos.find((p) => p.tipo === 'mes' && p.inicio === inicioMesAnterior())
    || estado.periodos.find((p) => p.tipo === 'semana' && !p.parcial && conDatos.has(clavePeriodo(p.tipo, p.inicio)))
    || estado.periodos.find((p) => p.tipo === 'semana' && !p.parcial)
    || estado.periodos[0] || null;
  pintarPeriodos();

  const hayDatos = estado.companias.length > 0;
  $('#zonaVacia').classList.toggle('compacta', hayDatos);
  $('#panelTrabajo').classList.toggle('oculto', !hayDatos);
  // Con datos cargados, las queries ya cumplieron: se pliegan para dejar sitio.
  if (hayDatos) $('#panelConsultas details').open = false;
  pintarCompanias();
  pintar();
}

function pintarPeriodos() {
  const select = $('#campoPeriodo');
  const conDatos = periodosConDatos();
  select.innerHTML = ['semana', 'mes'].map((tipo) => {
    const opciones = estado.periodos.filter((p) => p.tipo === tipo)
      .map((p) => {
        const nota = !conDatos.has(clavePeriodo(p.tipo, p.inicio)) ? ' · sin datos' : p.parcial ? ' (parcial)' : '';
        return `<option value="${p.id}">${p.nombre}${nota}</option>`;
      }).join('');
    return opciones ? `<optgroup label="${tipo === 'semana' ? 'Semanas' : 'Meses'}">${opciones}</optgroup>` : '';
  }).join('');
  if (estado.periodo) select.value = estado.periodo.id;
}

/* ---------- compañías ---------- */

function elegirCompania(nombre) {
  estado.seleccion = nombre;
  pintarCompanias();
  pintar();
}

function pintarCompanias() {
  listaCompanias.pintar(estado.companias.map((nombre) => {
    const r = estado.periodo ? reporteDe(nombre) : null;
    return {
      nombre,
      grupo: grupoDe(servicios(estado.datos, nombre)),
      resumen: r ? resumenDe(r) : '',
    };
  }), estado.seleccion);
}

// Lo que tuvo la compañía en el periodo, solo de lo que tiene contratado.
function resumenDe(r) {
  if (!tuvoActividad(r)) return 'sin actividad';
  return [
    ...(r.servicios.training ? [`${r.conocimiento.juegos} juegos`, `${r.premios.entregas} premios`] : []),
    ...(r.reviews ? [`${r.reviews.porGali} reseñas por Galilei`] : []),
  ].join(' · ');
}

const tuvoActividad = (r) => Boolean(r.conocimiento.juegos || r.premios.entregas || r.reviews?.nuevas);

/* ---------- reporte ---------- */

// `contratado`: lo que la compañía tiene (decide su grupo en la lista).
// `servicios`: lo que sale en este PDF (lo contratado menos lo que se apagó en
// «Qué mostrar»); es lo que usan las hojas.
function reporteDe(compania) {
  const { datos, periodo } = estado;
  const contratado = contratadoDe(compania);
  const visible = vistas.visibles(compania, contratado);
  return {
    compania,
    contratado,
    servicios: visible,
    cliente: (estado.nombresCliente[slug(compania)] || '').trim() || compania,
    periodo,
    conocimiento: conocimiento(datos, compania, periodo),
    premios: premiosEntregados(datos, compania, periodo, estado.catalogo),
    reviews: visible.reviews ? reviews(datos, compania, periodo) : null,
    // La hoja que pide las metas: no lleva datos, solo el mes del reporte.
    metas: visible.metas ? { mes: periodo.inicio } : null,
    loterias: loteriasDe(compania, visible),
    logoCliente: estado.logos.get(slug(compania)) || null,
  };
}

// Lo que tiene la compañía, con la hoja que pide las metas: va con training,
// solo en el reporte mensual y menos en Auteco. En una semana no sale ni la
// hoja ni su interruptor.
const SIN_METAS = /auteco/i;
function contratadoDe(compania) {
  const s = servicios(estado.datos, compania);
  return { ...s, metas: s.training && estado.periodo?.tipo === 'mes' && !SIN_METAS.test(compania) };
}

// Las loterías que salen en el PDF, en orden: la de training (Galilei, o la
// propia de Auteco) y, con reseñas, la de Reseñas. Una compañía de solo reseñas
// abre con la suya y después ve la de training en versión «no participa».
function loteriasDe(compania, contratado) {
  const { datos, periodo } = estado;
  if (!contratado.training && !contratado.reviews) return [];
  const tipo = loteriaDe(compania);
  const deTraining = {
    tipo,
    ...(tipo === 'auteco' ? loteriaAuteco(datos, compania, periodo) : loteria(datos, compania, periodo)),
  };
  // Training apagado en «Qué mostrar»: su lotería va solo con el premio.
  if (!contratado.training) deTraining.training = false;
  if (!contratado.reviews) return [deTraining];
  const deResenas = { tipo: 'resenas', ...loteriaResenas(datos, compania, periodo) };
  return contratado.training ? [deTraining, deResenas] : [deResenas, deTraining];
}

const recursos = () => ({
  logo: estado.logo,
  trofeo: estado.trofeo,
  galiPreocupado: estado.galiPreocupado,
  medallas: estado.medallas,
  personajes: estado.personajes,
  fondos: estado.fondos,
  catalogo: estado.catalogo,
  imagenes: estado.imagenes,
  rifas: estado.rifas,
});

function pintar() {
  const vista = $('#vistaHojas');
  const compania = estado.seleccion;
  if (!compania || !estado.periodo || !estado.listo) {
    vista.replaceChildren();
    $('#avisoReporte').replaceChildren();
    return;
  }
  const escrito = estado.nombresCliente[slug(compania)] || '';
  const campo = $('#campoCliente');
  if (document.activeElement !== campo && campo.value !== escrito) campo.value = escrito;
  campo.placeholder = compania;
  vistas.pintar(compania, contratadoDe(compania));
  logoCliente.pintar(compania, estado.logos.get(slug(compania)) || null);

  const r = reporteDe(compania);
  const { hojas, nombres } = componerReporte(r, recursos(), estado.lienzosVista);
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

// Lo que falta o conviene revisar antes de mandar el PDF. `info` no es un
// problema: solo dice qué hojas salen y por qué.
function avisos(r) {
  const lista = [];
  const contratado = [r.contratado.training && 'training', r.contratado.reviews && 'reseñas'].filter(Boolean);
  lista.push({
    info: true,
    texto: contratado.length ? `Contratado: ${contratado.join(' y ')}` : 'Sin training ni reseñas en los datos cargados',
  });
  const apagado = [
    r.contratado.training && !r.servicios.training && 'training',
    r.contratado.reviews && !r.servicios.reviews && 'reseñas',
  ].filter(Boolean);
  if (apagado.length) {
    lista.push({
      info: true,
      texto: r.servicios.training || r.servicios.reviews
        ? `No sale en este PDF: ${apagado.join(' ni ')} (Qué mostrar)`
        : 'Apagaste todo en «Qué mostrar»: el PDF sale vacío',
    });
  }
  const sinDatos = estado.datos.resumenes.length && !periodosConDatos().has(clavePeriodo(r.periodo.tipo, r.periodo.inicio));
  if (sinDatos) lista.push({ texto: 'Este periodo no tiene datos: corre las queries (paso 1) y sube los CSV (paso 2)' });
  if (!estado.datos.resumenes.length) lista.push({ texto: 'Falta el CSV de la query 1 (conocimiento)' });
  if (!estado.datos.companias.length) lista.push({ texto: 'Falta el CSV de la query 2 (compañías y premios)' });
  if (r.periodo.parcial && !sinDatos) lista.push({ texto: 'El periodo no está completo en los datos cargados' });
  for (const l of r.loterias) {
    const { nombre } = LOTERIAS[l.tipo];
    const { rifa } = rifaParaHoja(l.tipo, l.mes, estado.rifas);
    if (!rifa.premio) lista.push({ texto: `Falta el premio de la ${nombre} de ${rifa.mes} (paso 3)` });
    else if (!rifa.live) lista.push({ texto: `Falta el link del live de la ${nombre} de ${rifa.mes} (paso 3)` });
    if (l.tipo === 'auteco' && !l.cargada) lista.push({ texto: 'Falta el CSV de la query 4 (Lotería Auteco)' });
  }
  if (r.metas) lista.push({ info: true, texto: 'Con la hoja que le pide al cliente sus metas' });
  if (!r.logoCliente) lista.push({ texto: 'Sin logo del cliente: súbelo junto al nombre (sale en lugar del nombre escrito)' });
  if (r.servicios.training && r.premios.sinSedes) {
    lista.push({ texto: 'El CSV de la query 2 es de una versión vieja (sus premios no traen sede): vuelve a correrla y súbela' });
  }
  if (r.reviews?.estrellasViejas) {
    lista.push({ texto: 'El CSV de la query 3 es de una versión vieja (sus estrellas cuentan todas las reseñas): vuelve a correrla y súbela' });
  }
  if (r.servicios.training && r.premios.sinValor.length) {
    lista.push({
      texto: `Sin valor en la biblioteca: ${r.premios.sinValor.map((f) => f.nombre).join(', ')}. `
        + 'Ponlo en la Biblioteca de premios de la pieza semanal para que entre en la inversión total',
    });
  }
  const sinRecorte = r.servicios.training ? r.premios.grupos.filter((g) => !estado.imagenes.has(g.id)).length : 0;
  if (sinRecorte) {
    lista.push({ texto: `${sinRecorte} ${sinRecorte === 1 ? 'premio' : 'premios'} sin recorte: súbelo en la pieza semanal` });
  }
  return lista;
}

/* ---------- PDF ---------- */

function pdfDeCompania(compania) {
  const { hojas, enlaces } = componerReporte(reporteDe(compania), recursos(), estado.lienzosPdf);
  return pdfDe(hojas, enlaces);
}

const nombreArchivo = (compania) => (
  `reporte-${slug(compania)}-${estado.periodo.inicio}-al-${estado.periodo.fin}.pdf`
);

// Deshabilita el botón y cambia su texto mientras trabaja; lo deja como estaba al terminar.
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
  if (!estado.seleccion || !estado.periodo) return;
  await conBoton($('#botonDescargar'), async (rotulo) => {
    rotulo('Generando…');
    // Un respiro para que el rótulo alcance a pintarse antes del trabajo pesado.
    await new Promise((r) => setTimeout(r, 0));
    try {
      descargarBlob(pdfDeCompania(estado.seleccion), nombreArchivo(estado.seleccion));
    } catch (err) {
      alert(`No se pudo generar el PDF: ${err.message}`);
    }
  });
}

// Solo las compañías con algo que contar en el periodo elegido.
async function exportarTodo() {
  if (!estado.periodo) return;
  const activas = estado.companias.filter((c) => tuvoActividad(reporteDe(c)));
  if (!activas.length) return;
  await conBoton($('#botonExportarTodo'), async (rotulo) => {
    try {
      const zip = await zipDe(
        activas.map((c) => ({ nombre: nombreArchivo(c), crear: () => pdfDeCompania(c) })),
        (n, total) => rotulo(`Preparando ${n} de ${total}…`),
      );
      descargarBlob(zip, `reportes-${estado.periodo.inicio}-al-${estado.periodo.fin}.zip`);
      pintarAvisos([{ info: true, texto: `${activas.length} reportes en el ZIP` }]);
    } catch (err) {
      alert(`No se pudo armar el ZIP: ${err.message}`);
    }
  });
}
