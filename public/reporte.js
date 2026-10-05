// Reporte para clientes: los CSV de las dos queries -> hojas de celular por
// compañía y periodo -> PDF.

import { CONSULTAS, INSTRUCCION } from './lib/consultas.js';
import { periodosEntre, diaMes } from './lib/periodos.js';
import { csvDeEjemplo } from './lib/reporte-demo.js';
import {
  interpretarArchivo, conocimiento, premiosEntregados,
  rangoDeDatos, companiasConDatos,
} from './lib/reporte-datos.js';
import { dibujarConocimiento } from './lib/hoja-conocimiento.js';
import { armarCarrusel, dibujarDiapositiva, CARRUSEL } from './lib/carrusel.js';
import { personajeDe } from './lib/lienzo.js';
import { ESTILO } from './lib/plantillas.js';
import { valorDe, armarGrupo } from './lib/grupos.js';
import {
  listaDePersonajes, listaDeFondos, cargarImagen, perfilesOpacos, cajaDelProducto,
} from './lib/imagenes.js';
import { escucharPremios, escucharClientes } from './lib/nube.js';
import { slug } from './lib/normalizador.js';

const $ = (sel) => document.querySelector(sel);

const estado = {
  datos: { resumenes: [], tops: [], fallos: [], companias: [], premios: [] },
  origen: '',           // qué se cargó, para el aviso bajo la zona de carga
  periodos: [],
  periodo: null,
  companias: [],
  seleccion: null,
  nombresCliente: {},   // compañía -> nombre escrito a mano
  catalogo: [],
  imagenes: new Map(),  // id del premio -> recorte (HTMLImageElement medido)
  logos: new Map(),     // slug de la compañía -> logo en blanco (HTMLImageElement)
  logo: null,
  trofeo: null,
  personajes: [],
  fondos: [],
  listo: false,         // imágenes y fuentes cargadas: antes no se dibuja
  lienzosVista: [],     // se reutilizan entre repintados: cada uno pesa ~30 MB
  lienzosPdf: [],
};

init();

async function init() {
  pintarConsultas();
  pintarArchivos();
  $('#botonEjemplo').addEventListener('click', cargarEjemplo);

  escucharPremios(alCambiarCatalogo, errorNube);
  escucharClientes(alCambiarClientes, errorNube);

  $('#entradaCsv').addEventListener('change', (e) => {
    leerArchivos([...e.target.files]);
    e.target.value = '';
  });
  const zona = $('#zonaVacia');
  ['dragenter', 'dragover'].forEach((ev) => document.addEventListener(ev, (e) => {
    e.preventDefault();
    zona.classList.add('activa');
  }));
  ['dragleave', 'drop'].forEach((ev) => document.addEventListener(ev, (e) => {
    e.preventDefault();
    if (ev === 'dragleave' && e.relatedTarget) return;
    zona.classList.remove('activa');
  }));
  document.addEventListener('drop', (e) => {
    leerArchivos([...(e.dataTransfer?.files || [])].filter((f) => /\.csv$/i.test(f.name)));
  });

  $('#campoPeriodo').addEventListener('change', (e) => {
    estado.periodo = estado.periodos.find((p) => p.id === e.target.value) || null;
    pintarCompanias();
    pintar();
  });
  $('#campoCliente').addEventListener('input', (e) => {
    if (estado.seleccion) estado.nombresCliente[estado.seleccion] = e.target.value;
    pintar();
  });
  $('#botonDescargar').addEventListener('click', descargar);
  $('#botonExportarTodo').addEventListener('click', exportarTodo);

  // Lo que dibujan las hojas. El canvas no cuenta como uso de una webfont, así
  // que cada peso se pide a mano antes del primer dibujo.
  const caras = ['500', '600', '700'].flatMap((p) => [
    `${p} 32px ${ESTILO.fuenteTitulo}`, `${p} 24px ${ESTILO.fuenteGanadores}`,
  ]);
  [estado.logo, estado.trofeo, estado.personajes, estado.fondos] = await Promise.all([
    cargarImagen('marca/logo-galilei.png').catch(() => null),
    cargarImagen('Assets/Iconos/trofeo.webp').catch(() => null),
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
  aviso.textContent = `No se pudo leer la biblioteca de premios (${err.code || err.message}). `
    + 'Los costos de premios físicos y los recortes no van a salir.';
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

async function alCambiarClientes(clientes) {
  const logos = new Map();
  await Promise.all(clientes.filter((c) => c.logo).map(async (c) => {
    const img = await cargarImagen(c.logo).catch(() => null);
    if (img) logos.set(c.id, img);
  }));
  estado.logos = logos;
  pintar();
}

/* ---------- archivos ---------- */

function pintarConsultas() {
  for (const c of CONSULTAS) {
    const caja = document.createElement('div');
    caja.className = 'consulta';
    caja.innerHTML = `
      <header><h3></h3><button type="button" class="boton">Copiar</button></header>
      <pre></pre>`;
    caja.querySelector('h3').textContent = c.titulo;
    caja.querySelector('pre').textContent = INSTRUCCION + c.sql;
    const boton = caja.querySelector('button');
    boton.addEventListener('click', async () => {
      await navigator.clipboard.writeText(INSTRUCCION + c.sql);
      boton.textContent = 'Copiada';
      setTimeout(() => { boton.textContent = 'Copiar'; }, 1500);
    });
    $('#listaConsultas').appendChild(caja);
  }
}

// Cada archivo reemplaza solo lo que trae (ver `interpretarArchivo`).
async function leerArchivos(archivos) {
  if (!archivos.length) return;
  const errores = [];
  for (const archivo of archivos) {
    try {
      cargar(interpretarArchivo(await archivo.text()), `«${archivo.name}»`);
    } catch (err) {
      errores.push(`«${archivo.name}»: ${err.message}`);
    }
  }
  if (errores.length) alert(`No se pudieron leer:\n${errores.join('\n')}`);
  alCambiarDatos();
}

function cargarEjemplo() {
  cargar(interpretarArchivo(csvDeEjemplo()), 'Ejemplo con datos inventados');
  alCambiarDatos();
}

function cargar(partes, origen) {
  Object.assign(estado.datos, partes);
  estado.origen = origen;
}

function pintarArchivos() {
  const d = estado.datos;
  const chip = (listo, texto) => `<span class="${listo ? 'listo' : ''}">${listo ? '✓ ' : ''}${texto}</span>`;
  const demo = estado.origen.startsWith('Ejemplo') ? chip(true, 'Ejemplo con datos inventados') : '';
  $('#estadoArchivos').innerHTML = demo
    + chip(d.resumenes.length > 0, `Query 1 · Conocimiento${d.resumenes.length ? ` · ${d.resumenes.length} periodos` : ''}`)
    + chip(d.companias.length > 0, `Query 2 · Compañías y premios${d.companias.length ? ` · ${d.premios.length} premios` : ''}`);
}

function alCambiarDatos() {
  pintarArchivos();
  const { min, max } = rangoDeDatos(estado.datos);
  estado.periodos = periodosEntre(min, max);
  estado.companias = companiasConDatos(estado.datos);
  if (!estado.companias.includes(estado.seleccion)) estado.seleccion = estado.companias[0] || null;

  // Por defecto, la última semana completa (o la más reciente si ninguna lo está).
  const previo = estado.periodos.find((p) => p.id === estado.periodo?.id);
  estado.periodo = previo
    || estado.periodos.find((p) => p.tipo === 'semana' && !p.parcial)
    || estado.periodos[0] || null;

  const select = $('#campoPeriodo');
  select.innerHTML = ['semana', 'mes'].map((tipo) => {
    const opciones = estado.periodos.filter((p) => p.tipo === tipo)
      .map((p) => `<option value="${p.id}">${p.nombre}${p.parcial ? ' (parcial)' : ''}</option>`).join('');
    return opciones ? `<optgroup label="${tipo === 'semana' ? 'Semanas' : 'Meses'}">${opciones}</optgroup>` : '';
  }).join('');
  if (estado.periodo) select.value = estado.periodo.id;

  $('#zonaVacia').classList.toggle('compacta', estado.companias.length > 0);
  $('#panelTrabajo').classList.toggle('oculto', !estado.companias.length);
  if (estado.datos.resumenes.length) $('#panelConsultas details').open = false;
  pintarCompanias();
  pintar();
}

/* ---------- compañías ---------- */

function pintarCompanias() {
  const lista = $('#listaCompanias');
  lista.innerHTML = '';
  for (const nombre of estado.companias) {
    const r = estado.periodo ? reporteDe(nombre) : null;
    const li = document.createElement('li');
    const boton = document.createElement('button');
    boton.type = 'button';
    boton.setAttribute('aria-current', String(nombre === estado.seleccion));
    const nada = r && !r.conocimiento.juegos && !r.premios.entregas;
    boton.innerHTML = '<span></span><span class="meta"></span>';
    boton.children[0].textContent = nombre;
    boton.children[1].textContent = !r ? '' : nada ? 'sin actividad'
      : `${r.conocimiento.juegos} juegos · ${r.premios.entregas} premios`;
    boton.addEventListener('click', () => {
      estado.seleccion = nombre;
      pintarCompanias();
      pintar();
    });
    li.appendChild(boton);
    lista.appendChild(li);
  }
}

/* ---------- reporte ---------- */

function reporteDe(compania) {
  return {
    cliente: (estado.nombresCliente[compania] || '').trim() || compania,
    periodo: estado.periodo,
    conocimiento: conocimiento(estado.datos, compania, estado.periodo),
    premios: premiosEntregados(estado.datos, compania, estado.periodo, estado.catalogo),
    logoCliente: estado.logos.get(slug(compania)) || null,
  };
}

const enPesos = (n) => `$${Math.round(n).toLocaleString('es-CO')}`;

// Las hojas del reporte, dibujadas en `lienzos`. La 1 es el conocimiento; de la
// 2 en adelante, la pieza de premios de la semanal con el costo total bajo el
// título. Con más de siete premios esa pieza se parte en varias páginas, igual
// que en la semanal.
function dibujarHojas(compania, lienzos) {
  const r = reporteDe(compania);
  const semilla = `${compania}|${r.periodo.id}`;
  const elegir = (lista, i) => personajeDe(lista, `${semilla}|${i}`);
  const comunes = {
    kicker: r.cliente,
    logoCliente: r.logoCliente,
    logo: estado.logo,
    etiqueta: `${diaMes(r.periodo.inicio)} - ${diaMes(r.periodo.fin)}`,
    trofeo: estado.trofeo,
  };

  const grupos = [...r.premios.grupos]
    .sort((a, b) => valorDe(b, estado.catalogo) - valorDe(a, estado.catalogo) || b.conteo - a.conteo)
    .map((g) => armarGrupo(g, estado.catalogo, estado.imagenes));
  const diapositivas = armarCarrusel(grupos);
  if (!diapositivas.length) diapositivas.push({ grupos: [], ganadores: [], parte: 1, partes: 1 });

  while (lienzos.length < diapositivas.length + 1) lienzos.push(document.createElement('canvas'));

  dibujarConocimiento(lienzos[0], {
    ...comunes,
    // El nombre siempre en el renglón siguiente a «Reporte».
    titulo: `Reporte\n${r.cliente}`,
    tituloCompleto: true,
    subtitulo: r.conocimiento.juegos ? '' : 'Sin partidas en este periodo',
    // Sin Gali: el título largo se le montaba encima y no se leía.
    personaje: null,
    fondo: elegir(estado.fondos, 'fondo-0'),
    // El trofeo es de los premios; aquí chocaría con el título.
    trofeo: null,
    datos: r.conocimiento,
  });

  const total = r.premios.entregas ? `Costo total: ${enPesos(r.premios.total)}` : 'Sin premios entregados';
  diapositivas.forEach((d, i) => dibujarDiapositiva(lienzos[i + 1], {
    ...comunes,
    titulo: 'Premios Entregados',
    subtitulo: total,
    diapositiva: d,
    personaje: elegir(estado.personajes, i + 1),
    fondo: elegir(estado.fondos, `fondo-${i + 1}`),
  }));

  return { reporte: r, hojas: lienzos.slice(0, diapositivas.length + 1) };
}

function pintar() {
  const vista = $('#vistaHojas');
  const compania = estado.seleccion;
  if (!compania || !estado.periodo || !estado.listo) {
    vista.innerHTML = '';
    return;
  }
  const escrito = estado.nombresCliente[compania] || '';
  if ($('#campoCliente').value !== escrito) $('#campoCliente').value = escrito;
  $('#campoCliente').placeholder = compania;

  const { reporte, hojas } = dibujarHojas(compania, estado.lienzosVista);
  vista.innerHTML = '';
  hojas.forEach((canvas, i) => {
    const figura = document.createElement('figure');
    figura.className = 'diapositiva';
    const pie = document.createElement('figcaption');
    pie.textContent = i === 0 ? 'Página 1 · Conocimiento'
      : `Página ${i + 1} · Premios${hojas.length > 2 ? ` (${i} de ${hojas.length - 1})` : ''}`;
    figura.append(canvas, pie);
    vista.appendChild(figura);
  });
  $('#avisoReporte').textContent = avisos(reporte).join(' · ');
}

function avisos(r) {
  const lista = [];
  if (!estado.datos.resumenes.length) lista.push('Falta el CSV de la query 1 (conocimiento)');
  if (!estado.datos.companias.length) lista.push('Falta el CSV de la query 2 (compañías y premios)');
  if (r.periodo.parcial) lista.push('El periodo no está completo en los datos cargados');
  if (r.premios.sinValor.length) {
    lista.push(`Sin valor en la biblioteca: ${r.premios.sinValor.map((f) => f.nombre).join(', ')}. `
      + 'Ponlo en la Biblioteca de premios de la pieza semanal para que entre en el costo total');
  }
  const sinRecorte = r.premios.grupos.filter((g) => !estado.imagenes.has(g.id)).length;
  if (sinRecorte) {
    lista.push(`${sinRecorte} ${sinRecorte === 1 ? 'premio' : 'premios'} sin recorte: súbelo en la pieza semanal`);
  }
  return lista;
}

/* ---------- PDF ---------- */

// Una página por hoja, del mismo tamaño que la pieza de celular.
async function pdfDe(compania) {
  const { hojas } = dibujarHojas(compania, estado.lienzosPdf);
  const { jsPDF } = window.jspdf;
  const { ancho, alto } = CARRUSEL;
  const pdf = new jsPDF({ unit: 'pt', format: [ancho, alto], orientation: 'portrait' });
  hojas.forEach((canvas, i) => {
    if (i) pdf.addPage([ancho, alto], 'portrait');
    pdf.addImage(canvas.toDataURL('image/jpeg', 0.9), 'JPEG', 0, 0, ancho, alto);
  });
  return pdf.output('blob');
}

const nombreArchivo = (compania) => (
  `reporte-${slug(compania)}-${estado.periodo.inicio}-al-${estado.periodo.fin}.pdf`
);

async function descargar() {
  if (!estado.seleccion || !estado.periodo) return;
  const boton = $('#botonDescargar');
  boton.disabled = true;
  boton.textContent = 'Generando…';
  try {
    descargarBlob(await pdfDe(estado.seleccion), nombreArchivo(estado.seleccion));
  } catch (err) {
    alert(`No se pudo generar el PDF: ${err.message}`);
  } finally {
    boton.disabled = false;
    boton.textContent = 'Descargar PDF';
  }
}

// Solo las compañías con algo que contar en el periodo elegido.
async function exportarTodo() {
  if (!estado.periodo) return;
  const activas = estado.companias.filter((c) => {
    const r = reporteDe(c);
    return r.conocimiento.juegos || r.premios.entregas;
  });
  if (!activas.length) return;
  const boton = $('#botonExportarTodo');
  const zip = new window.JSZip();
  boton.disabled = true;
  try {
    for (const [i, compania] of activas.entries()) {
      boton.textContent = `Preparando ${i + 1} de ${activas.length}…`;
      // Un respiro para que el contador llegue a pintarse entre reporte y reporte.
      await new Promise((r) => setTimeout(r, 0));
      zip.file(nombreArchivo(compania), await pdfDe(compania));
    }
    boton.textContent = 'Comprimiendo…';
    const contenido = await zip.generateAsync({ type: 'blob', compression: 'STORE' });
    descargarBlob(contenido, `reportes-${estado.periodo.inicio}-al-${estado.periodo.fin}.zip`);
    $('#avisoReporte').textContent = `${activas.length} reportes en el ZIP`;
  } catch (err) {
    alert(`No se pudo armar el ZIP: ${err.message}`);
  } finally {
    boton.disabled = false;
    boton.textContent = 'Exportar todo (ZIP)';
  }
}

function descargarBlob(blob, nombre) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nombre;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
