// Orquestación: premios de la query 2 (guardados para el equipo) -> periodo ->
// familias de premio -> vista previa -> JPG. Funciona como el reporte para
// clientes, pero solo con los premios: la misma query, los mismos datos
// guardados, el selector de periodo y la alerta de días sin datos.

import { leerEntregas, leerTabla } from './lib/csv.js';
import {
  MESES, periodosEntre, hoyLocal, diaMes,
} from './lib/periodos.js';
import {
  faltaEn, notaIncompleto, pintarAlerta, confirmarDescarga, NOMBRES_CONSULTA,
} from './lib/incompleto.js';
import { interpretarTabla, consultaDe, datosHasta } from './lib/reporte-datos.js';
import { tipoDeArchivo } from './lib/consultas.js';
import { documentosDeSubida, tablasGuardadas } from './reporte/datos-guardados.js';
import { pintarConsultas, pintarArchivos, escucharArrastre } from './reporte/panel-carga.js';
import { agruparPorFamilia, formatearNombre, slug } from './lib/normalizador.js';
import {
  listaDePersonajes, listaDeFondos, cargarImagen, perfilesOpacos, cajaDelProducto,
} from './lib/imagenes.js';
import { valorDe, armarGrupo } from './lib/grupos.js';
import {
  crearLienzo, dibujarPieza, exportarImagen, aBlob, SALIDA,
  personajeDe, posicionAutomatica, rectPersonaje,
} from './lib/lienzo.js';
import { ESTILO, maxGrupos } from './lib/plantillas.js';
import {
  armarCarrusel, dibujarDiapositiva, CATEGORIAS, categoriaPorDefecto,
  MAX_PREMIOS, capacidadGanadores,
} from './lib/carrusel.js';
import {
  escucharPremios, guardarPremio, escucharPosiciones, guardarPosiciones,
  escucharClientes, guardarCliente, escucharDatosReporte, guardarDatosReporte,
} from './lib/nube.js';
import { logoEnBlanco, leerComoDataUrl } from './lib/logos.js';

const $ = (sel) => document.querySelector(sel);

const estado = {
  catalogo: [],
  datos: datosVacios(), // lo que trae la query 2: `companias` y `premios` (todas las entregas)
  guardados: [],        // documentos `premios-…` de `reporteDatos`
  subidas: {},          // query -> { subido, por }: la última subida
  local: false,         // los premios son de un export de insights leído aquí (no se guarda)
  periodos: [],
  periodo: null,
  companias: [],       // [{ nombre, entregas, grupos }] del periodo elegido
  seleccion: null,
  imagenes: new Map(),  // id -> HTMLImageElement
  logo: null,
  trofeo: null,         // el icono 3D de la cabecera de la pieza de celular
  personajes: [],       // poses de Gali: una sale en el hueco de cada pieza
  fondos: [],           // escenarios verticales: uno de fondo en la pieza de celular
  tirada: '',           // el periodo: cada semana reparte los personajes de nuevo
  posiciones: {},       // `modo-cantidad` -> centro colocado a mano
  logosClientes: new Map(), // slug de la compañía -> logo en blanco (HTMLImageElement)
  personajePieza: null, // el de la pieza en pantalla, para poder arrastrarlo
  heroeManual: null,
  // 'carrusel' (celular, todos los premios juntos), 'collage' o 'reticula'.
  modo: 'carrusel',
  lienzosCarrusel: [],  // se reutilizan entre repintados: cada uno pesa ~30 MB
  diapositivas: [],     // [{ canvas, nombre }] del carrusel en pantalla
};

const lienzo = crearLienzo();

/* ---------- arranque ---------- */

init();

async function init() {
  pintarConsultas($('#listaConsultas'), ['premios']);
  pintarArchivos($('#estadoArchivos'), estado.datos, { solo: ['premios'] });
  estado.logo = await cargarImagen('marca/logo-galilei.png').catch(() => null);
  estado.trofeo = await cargarImagen('Assets/Iconos/trofeo.webp').catch(() => null);
  await cargarPersonajes();
  await cargarFondos();

  // Biblioteca y posiciones llegan de Firestore y se quedan escuchando: si otra
  // persona sube un recorte o mueve un personaje, aquí se ve sin recargar.
  escucharPremios(alCambiarCatalogo, errorNube);
  escucharPosiciones((posiciones) => {
    estado.posiciones = posiciones;
    if (companiaActual()) pintar();
  }, errorNube);
  escucharClientes(alCambiarClientes, errorNube);
  escucharDatosReporte(alCambiarGuardados, errorNube, 'premios');

  $('#entradaLogoCliente').addEventListener('change', async (e) => {
    const archivo = e.target.files[0];
    e.target.value = '';
    if (archivo) await subirLogoCliente(archivo);
  });
  $('#botonQuitarLogo').addEventListener('click', async () => {
    const compania = companiaActual();
    if (!compania) return;
    await guardarCliente(slug(compania.nombre), { logo: '' })
      .catch((err) => alert(`No se pudo quitar el logo: ${err.message}`));
  });

  $('#entradaCsv').addEventListener('change', (e) => {
    leerArchivos([...e.target.files]);
    e.target.value = '';
  });
  escucharArrastre($('#zonaVacia'), leerArchivos);
  $('#campoPeriodo').addEventListener('change', (e) => {
    estado.periodo = estado.periodos.find((p) => p.id === e.target.value) || null;
    armarCompanias();
  });

  ['#campoKicker', '#campoTitulo', '#campoEtiqueta'].forEach((sel) => {
    $(sel).addEventListener('input', pintar);
  });
  $('#campoHeroe').addEventListener('change', (e) => {
    estado.heroeManual = e.target.value || null;
    pintar();
  });
  $('#campoModo').addEventListener('change', (e) => {
    estado.modo = e.target.value;
    if (estado.companias.length) pintarCompanias();
    pintar();
  });
  $('#botonDescargar').addEventListener('click', descargar);
  $('#botonExportarTodo').addEventListener('click', exportarTodo);
  $('#botonPersonaje').addEventListener('click', () => {
    if (estado.personajePieza) guardarPosicion(estado.personajePieza.clave, null);
  });
  prepararArrastre();

  // Las dos fuentes de marca tienen que estar listas antes del primer render o el
  // canvas mide mal los anchos. `fonts.ready` no basta: el navegador solo descarga
  // la cara de una webfont cuando alguien la usa, y el canvas no cuenta como uso,
  // así que hay que pedir a mano cada peso que dibujamos.
  const caras = [
    `${ESTILO.pesoTitulo} 300px ${ESTILO.fuenteTitulo}`,
    `700 ${ESTILO.chipFuente}px ${ESTILO.fuenteTitulo}`,
    `600 ${ESTILO.kickerFuente}px ${ESTILO.fuenteTitulo}`,
    `400 ${ESTILO.listaFuente}px ${ESTILO.fuenteGanadores}`,
    // El carrusel pinta los importes en negrita.
    `700 ${ESTILO.listaFuente}px ${ESTILO.fuenteGanadores}`,
    // La pieza de celular: el cliente y la lista de ganadores van en Medium.
    `500 ${ESTILO.listaFuente}px ${ESTILO.fuenteGanadores}`,
  ];
  await Promise.all(caras.map((c) => document.fonts.load(c).catch(() => {})));
  await document.fonts.ready.catch(() => {});
}

// Llega el catálogo completo cada vez que cambia algo. Solo se vuelven a medir
// los recortes que cambiaron: medir el contorno de todos en cada guardado se nota.
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
    img.fuente = p.imagen;
    img.perfil = perfiles.columnas;
    img.perfilFilas = perfiles.filas;
    img.contorno = perfiles.contorno;
    img.mascara = perfiles.mascara;
    img.caja = cajaDelProducto(perfiles.columnas);
    imagenes.set(p.id, img);
  }));

  // El recorte no se guarda en el estado del catálogo: ya vive en `imagenes`.
  estado.catalogo = premios
    .map(({ imagen, ...resto }) => ({ ...resto, tieneImagen: imagenes.has(resto.id) }))
    .sort((a, b) => a.id.localeCompare(b.id));
  estado.imagenes = imagenes;

  pintarBiblioteca();
  if (estado.companias.length) {
    reagrupar();
    pintarFaltantes();
    pintarCompanias();
    pintar();
  }
}

/* ---------- logos de clientes ---------- */

async function alCambiarClientes(clientes) {
  const logos = new Map();
  await Promise.all(clientes.filter((c) => c.logo).map(async (c) => {
    const previo = estado.logosClientes.get(c.id);
    if (previo && previo.fuente === c.logo) {
      logos.set(c.id, previo);
      return;
    }
    const img = await cargarImagen(c.logo).catch(() => null);
    if (!img) return;
    img.fuente = c.logo;
    logos.set(c.id, img);
  }));
  estado.logosClientes = logos;
  if (companiaActual()) pintar();
}

function logoDe(compania) {
  return compania ? estado.logosClientes.get(slug(compania.nombre)) || null : null;
}

async function subirLogoCliente(archivo) {
  const compania = companiaActual();
  if (!compania) return;
  const boton = $('#etiquetaLogoCliente');
  boton.classList.add('ocupado');
  try {
    const logo = await logoEnBlanco(await leerComoDataUrl(archivo));
    // Solo el logo: `nombre` es el nombre del cliente que se escribe en el reporte.
    await guardarCliente(slug(compania.nombre), { logo });
  } catch (err) {
    alert(`No se pudo subir el logo: ${err.message}`);
  } finally {
    boton.classList.remove('ocupado');
  }
}

function pintarLogoCliente(compania) {
  const logo = logoDe(compania);
  const miniatura = $('#miniaturaLogo');
  miniatura.innerHTML = '';
  if (logo) {
    const img = document.createElement('img');
    img.src = logo.src;
    img.alt = `Logo de ${compania.nombre}`;
    miniatura.appendChild(img);
  } else {
    miniatura.textContent = 'Sin logo';
  }
  $('#textoLogoCliente').textContent = logo ? 'Cambiar logo' : 'Subir logo';
  $('#botonQuitarLogo').hidden = !logo;
}

function errorNube(err) {
  console.error(err);
  const aviso = $('#avisoNube');
  aviso.textContent = `No se pudo conectar con la biblioteca compartida: ${err.message}`;
  aviso.hidden = false;
}

// Los recortes se guardan dentro del documento de Firestore, que admite hasta
// 1 MB. En WebP y a 1200 px de lado ocupan una fracción de eso y se siguen viendo
// bien al tamaño al que se dibujan; si alguno aún pesa demasiado, se baja un poco.
async function comprimirRecorte(dataUrl) {
  const img = await cargarImagen(dataUrl);
  for (const [lado, calidad] of [[1200, 0.9], [1000, 0.85], [800, 0.8], [600, 0.75]]) {
    const escala = Math.min(1, lado / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement('canvas');
    c.width = Math.round(img.naturalWidth * escala);
    c.height = Math.round(img.naturalHeight * escala);
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    const salida = c.toDataURL('image/webp', calidad);
    if (salida.length < 900000) return salida;
  }
  throw new Error('El recorte es demasiado pesado incluso comprimido.');
}

async function cargarPersonajes() {
  estado.personajes = await listaDePersonajes();
}

async function cargarFondos() {
  estado.fondos = await listaDeFondos();
}

/* ---------- datos ---------- */

function datosVacios() {
  return { companias: [], premios: [] };
}

// Lo guardado manda: cada vez que cambia (una subida propia o de alguien más) se
// rearman los premios. Un export de insights leído aquí se queda hasta que llegue
// una subida nueva de la query 2.
function alCambiarGuardados(documentos) {
  estado.guardados = documentos;
  const { tablas, subidas } = tablasGuardadas(documentos);
  const nueva = subidas.premios?.subido !== estado.subidas.premios?.subido;
  estado.subidas = subidas;
  if (estado.local && !nueva) return;
  estado.local = false;
  estado.datos = { ...datosVacios(), ...(tablas.premios ? interpretarTabla(tablas.premios) : {}) };
  alCambiarDatos();
}

// Los CSV de la query 2 (o de cualquier query del reporte) se guardan para el
// equipo, como en el reporte para clientes; el export de insights solo se lee aquí.
async function leerArchivos(archivos) {
  if (!archivos.length) return;
  const errores = [];
  const avisos = [];
  const existentes = new Set(estado.guardados.map((d) => d.id));
  for (const archivo of archivos) {
    try {
      const texto = await archivo.text();
      const tabla = leerTabla(texto);
      const tipo = tipoDeArchivo(tabla.columnas);
      if (tipo === 'reporte') {
        if (consultaDe(tabla) !== 'premios') throw new Error('no es la query 2: súbelo en el reporte para clientes');
        aviso(`Guardando «${archivo.name}» para el equipo…`);
        const { documentos, meses } = documentosDeSubida(tabla, {
          existentes, subido: new Date().toISOString(), por: '',
        });
        await guardarDatosReporte(documentos);
        documentos.forEach((d) => existentes.add(d.id));
        avisos.push(`✓ Guardado para el equipo: ${NOMBRES_CONSULTA.premios} (${meses.map(nombreMes).join(' y ')})`);
      } else if (tipo === 'premios') {
        // Los nombres se normalizan aquí, una sola vez: así el corte y las
        // mayúsculas valen igual para la pieza, el conteo y el desduplicado.
        const premios = leerEntregas(texto).map((f) => ({ ...f, jugador: formatearNombre(f.jugador) }));
        estado.datos = { ...datosVacios(), premios };
        estado.local = true;
        avisos.push(`Export de insights «${archivo.name}» leído solo en este navegador: no se guarda para el equipo`);
        alCambiarDatos();
      } else {
        throw new Error('no se reconoce: no es la query 2 ni el export de insights');
      }
    } catch (err) {
      errores.push(`«${archivo.name}»: ${err.message}`);
    }
  }
  if (errores.length) alert(`No se pudieron leer o guardar:\n${errores.join('\n')}`);
  aviso(avisos.join(' · '));
}

const nombreMes = (mes) => new Date(`${mes}-15T12:00:00`).toLocaleString('es-CO', { month: 'long' });

function aviso(texto) {
  const p = $('#estadoSubida');
  p.hidden = !texto;
  p.textContent = texto;
}

// Hasta dónde llegan los premios: si el periodo pasa de ahí, faltan días. Un
// export de insights leído aquí no dice cuándo se sacó: no se avisa.
function incompleto(periodo) {
  if (estado.local) return null;
  return faltaEn(periodo, datosHasta(estado.datos, estado.subidas), ['premios']);
}

const entregasDe = (periodo) => estado.datos.premios
  .filter((f) => f.fecha && f.fecha >= periodo.inicio && f.fecha <= periodo.fin);

function alCambiarDatos() {
  pintarArchivos($('#estadoArchivos'), estado.datos, { subidas: estado.subidas, solo: ['premios'] });
  const fechas = estado.datos.premios.map((f) => f.fecha).filter(Boolean).sort();
  const hoy = hoyLocal();
  const ultima = fechas[fechas.length - 1];
  estado.periodos = fechas.length ? periodosEntre(fechas[0], ultima > hoy ? ultima : hoy) : [];

  // Por defecto, la última semana ya terminada y completa (o la última terminada).
  const terminada = (p) => p.tipo === 'semana' && p.fin < hoy;
  estado.periodo = estado.periodos.find((p) => p.id === estado.periodo?.id)
    || estado.periodos.find((p) => terminada(p) && !incompleto(p))
    || estado.periodos.find(terminada)
    || estado.periodos[0] || null;
  pintarPeriodos();

  const hayDatos = estado.periodos.length > 0;
  $('#zonaVacia').classList.toggle('compacta', hayDatos);
  $('#panelTrabajo').classList.toggle('oculto', !hayDatos);
  // Con datos cargados, la query ya cumplió: se pliega para dejar sitio.
  if (hayDatos) $('#panelConsultas details').open = false;
  armarCompanias();
}

function pintarPeriodos() {
  const select = $('#campoPeriodo');
  select.innerHTML = ['semana', 'mes'].map((tipo) => {
    const opciones = estado.periodos.filter((p) => p.tipo === tipo).map((p) => {
      const falta = incompleto(p);
      const nota = !entregasDe(p).length ? ' · sin premios'
        : falta ? notaIncompleto(falta)
          : p.parcial ? ' (parcial)' : '';
      return `<option value="${p.id}">${p.nombre}${nota}</option>`;
    }).join('');
    return opciones ? `<optgroup label="${tipo === 'semana' ? 'Semanas' : 'Meses'}">${opciones}</optgroup>` : '';
  }).join('');
  if (estado.periodo) select.value = estado.periodo.id;
}

// Las compañías con premios en el periodo elegido.
function armarCompanias() {
  const { periodo } = estado;
  const porCompania = new Map();
  for (const fila of periodo ? entregasDe(periodo) : []) {
    if (!porCompania.has(fila.compania)) porCompania.set(fila.compania, []);
    porCompania.get(fila.compania).push(fila);
  }
  estado.companias = [...porCompania.entries()]
    .map(([nombre, filas]) => construirCompania(nombre, filas))
    .filter((c) => c.entregas.length)
    .sort((a, b) => b.entregas.length - a.entregas.length);

  // Cada periodo reparte los personajes de nuevo: dos semanas seguidas no le
  // tocan los mismos bichos a las mismas compañías, y dentro de una semana no
  // cambian a cada repintado ni al volver a abrir la página.
  estado.tirada = periodo?.id || '';
  // La etiqueta arranca con las fechas del periodo, pero queda escrita en el
  // campo para que se pueda corregir a mano.
  $('#campoEtiqueta').value = periodo ? fechasDe(periodo) : '';

  if (!estado.companias.some((c) => c.nombre === estado.seleccion)) {
    estado.seleccion = estado.companias[0]?.nombre || null;
  }
  estado.heroeManual = null;
  pintarFaltantes();
  pintarCompanias();
  pintar();
}

/* ---------- biblioteca de premios ---------- */

function familiasUsadas() {
  const mapa = new Map();
  for (const compania of estado.companias) {
    for (const grupo of compania.grupos) {
      const familia = grupo.baseId || grupo.id;
      if (!mapa.has(familia)) mapa.set(familia, { ...grupo, id: familia, textos: new Set() });
      grupo.textos.forEach((t) => mapa.get(familia).textos.add(t));
    }
  }
  return [...mapa.values()].map((g) => ({ ...g, textos: [...g.textos] }));
}

// Una sola fila editable, que sirve tanto para dar de alta un premio nuevo como
// para reemplazar el recorte de uno que ya está en la biblioteca.
function crearFilaPremio(id, { grupo = null, entrada = null } = {}) {
  const base = entrada || grupo?.propuesta || { id, etiqueta: {} };
  const singular = entrada?.etiqueta?.singular || base.singular || id;
  const plural = entrada?.etiqueta?.plural || base.plural || singular;
  const desglose = entrada?.desglose || base.desglose || 'por-nombre';
  const unidad = entrada?.unidadMonto ?? base.unidadMonto ?? null;
  const valor = entrada?.valor ?? '';
  const categoria = entrada?.categoria || categoriaPorDefecto(id, desglose);
  const imagenActual = estado.imagenes.get(id)?.src || null;

  const fila = document.createElement('div');
  fila.className = 'faltante';
  fila.innerHTML = `
    <label class="miniatura" title="Soltar o elegir un PNG sin fondo">
      <span class="pista">Soltar PNG<br>sin fondo</span>
      <img alt="" hidden>
      <input type="file" accept="image/png" hidden></label>
    <div class="campos">
      <label><span>Singular</span><input type="text" data-campo="singular"></label>
      <label><span>Plural</span><input type="text" data-campo="plural"></label>
      <label><span>Lista de ganadores</span>
        <select data-campo="desglose">
          <option value="por-nombre">Solo nombres</option>
          <option value="por-monto">Agrupada por monto</option>
        </select>
      </label>
      <label><span>Valor aprox. (COP)</span>
        <input type="text" data-campo="valor" inputmode="numeric" placeholder="sin definir"></label>
      <label><span>Categoría</span>
        <select data-campo="categoria">
          ${CATEGORIAS.map((c) => `<option value="${c.id}">${c.titulo}</option>`).join('')}
        </select>
      </label>
      <p class="textos"></p>
    </div>
    <button type="button" class="boton" disabled>Guardar</button>
  `;

  const miniatura = fila.querySelector('.miniatura');
  const archivoInput = fila.querySelector('input[type="file"]');
  const guardar = fila.querySelector('button');

  fila.querySelector('[data-campo="singular"]').value = singular;
  fila.querySelector('[data-campo="plural"]').value = plural;
  fila.querySelector('[data-campo="desglose"]').value = desglose;
  fila.querySelector('[data-campo="categoria"]').value = categoria;

  // Los premios con desglose por monto traen el precio en el propio CSV (los
  // bonos lo llevan en el texto), así que el campo de valor no se puede editar.
  const campoValor = fila.querySelector('[data-campo="valor"]');
  const campoDesglose = fila.querySelector('[data-campo="desglose"]');
  const sincronizarValor = () => {
    const vieneDelCsv = campoDesglose.value === 'por-monto';
    campoValor.disabled = vieneDelCsv;
    campoValor.placeholder = vieneDelCsv ? 'No aplica' : 'sin definir';
    campoValor.value = vieneDelCsv ? '' : valor;
  };
  sincronizarValor();
  campoDesglose.addEventListener('change', sincronizarValor);

  fila.querySelector('.textos').textContent = grupo
    ? `${id} · ${grupo.conteo} entregas · ${grupo.textos.join(' / ')}`
    : `${id}${imagenActual ? '' : ' · sin recorte'}`;

  // Se pinta sobre el <img> que ya existe: reescribir el innerHTML de la etiqueta
  // se llevaría por delante el input de archivo y la fila dejaría de aceptar otro.
  const vista = miniatura.querySelector('img');
  const mostrar = (src) => {
    vista.src = src;
    vista.hidden = false;
    miniatura.querySelector('.pista').hidden = true;
  };
  if (imagenActual) mostrar(imagenActual);

  // Con recorte ya subido también se puede guardar solo el cambio de textos.
  const habilitar = () => { guardar.disabled = false; };
  if (imagenActual) {
    fila.querySelectorAll('[data-campo]').forEach((c) => c.addEventListener('input', habilitar));
  }

  let dataUrl = null;
  const tomarArchivo = async (archivo) => {
    if (!archivo || archivo.type !== 'image/png') {
      alert('El recorte tiene que ser un PNG con fondo transparente.');
      return;
    }
    dataUrl = await leerComoDataUrl(archivo);
    mostrar(dataUrl);
    habilitar();
  };

  archivoInput.addEventListener('change', () => tomarArchivo(archivoInput.files[0]));
  miniatura.addEventListener('dragover', (e) => e.preventDefault());
  miniatura.addEventListener('drop', (e) => {
    e.preventDefault();
    e.stopPropagation();
    tomarArchivo(e.dataTransfer.files[0]);
  });

  guardar.addEventListener('click', async () => {
    guardar.disabled = true;
    guardar.textContent = 'Guardando…';
    try {
      const datos = {
        etiqueta: {
          singular: fila.querySelector('[data-campo="singular"]').value.trim() || id,
          plural: fila.querySelector('[data-campo="plural"]').value.trim()
            || fila.querySelector('[data-campo="singular"]').value.trim() || id,
        },
        desglose: fila.querySelector('[data-campo="desglose"]').value,
        unidadMonto: unidad,
        valor: campoValor.disabled
          ? null
          : Number(campoValor.value.replace(/[^0-9]/g, '')) || null,
        categoria: fila.querySelector('[data-campo="categoria"]').value,
        alias: entrada?.alias || [],
        prioridad: entrada?.prioridad ?? 50,
      };
      if (dataUrl) datos.imagen = await comprimirRecorte(dataUrl);
      // No hace falta repintar aquí: Firestore avisa del cambio a todas las
      // pestañas abiertas, esta incluida, y `alCambiarCatalogo` se encarga.
      await guardarPremio(slug(id), datos);
    } catch (err) {
      alert(err.message);
      guardar.disabled = false;
      guardar.textContent = 'Guardar';
    }
  });

  return fila;
}

// Panel de urgencia: solo los premios del CSV cargado que aún no tienen recorte.
function pintarFaltantes() {
  const panel = $('#panelFaltantes');
  const lista = $('#listaFaltantes');
  const faltantes = familiasUsadas().filter((g) => !estado.imagenes.has(g.id));

  lista.innerHTML = '';
  panel.classList.toggle('oculto', faltantes.length === 0);

  for (const grupo of faltantes) {
    const entrada = estado.catalogo.find((p) => p.id === grupo.id) || null;
    lista.appendChild(crearFilaPremio(grupo.id, { grupo, entrada }));
  }
}

// Biblioteca completa: todo lo que hay en catalogo.json, para reemplazar recortes
// o corregir etiquetas aunque el premio no aparezca en el CSV de esta semana.
function pintarBiblioteca() {
  const lista = $('#listaBiblioteca');
  lista.innerHTML = '';
  for (const entrada of estado.catalogo) {
    lista.appendChild(crearFilaPremio(entrada.id, { entrada }));
  }
  $('#resumenBiblioteca').textContent =
    `Biblioteca de premios (${estado.imagenes.size} de ${estado.catalogo.length} con recorte)`;
}

// Los premios marcados con "ignorar" en catalogo.json no entran en la pieza
// ni cuentan como entregas: hoy es el caso de los GaliTickets.
function esIgnorado(id) {
  return Boolean(estado.catalogo.find((p) => p.id === id)?.ignorar);
}

// Guarda las filas crudas aparte para poder reagrupar si cambia el catálogo.
function construirCompania(nombre, filas) {
  const base = agruparPorFamilia(filas, estado.catalogo).filter((g) => !esIgnorado(g.id));
  const grupos = abrirPorMonto(base);
  // El carrusel usa `base`: ahí sobra sitio y los bonos no hace falta abrirlos por monto.
  return { nombre, filas, grupos, base, entregas: base.flatMap((g) => g.entregas) };
}

// Cuando una compañía tiene muy pocos premios distintos, la pieza queda vacía.
// En ese caso los que van desglosados por monto (los bonos) se abren en un item
// por monto — "3 Bonos Nequi de $50.000" — hasta llenar el hueco. Todos siguen
// apuntando al mismo recorte, que es `baseId`.
const MIN_ITEMS = 4;

function abrirPorMonto(grupos) {
  const abiertos = [...grupos];

  while (abiertos.length < MIN_ITEMS) {
    const candidato = abiertos
      .filter((g) => !g.baseId && montosDe(g).length > 1)
      .sort((a, b) => montosDe(b).length - montosDe(a).length)[0];
    if (!candidato) break;

    const entrada = estado.catalogo.find((p) => p.id === candidato.id);
    if ((entrada?.desglose || candidato.propuesta?.desglose) !== 'por-monto') break;

    const partes = montosDe(candidato).map((monto) => {
      const entregas = candidato.entregas.filter((e) => e.monto === monto);
      return {
        ...candidato,
        id: `${candidato.id}#${monto}`,
        baseId: candidato.id,
        monto,
        entregas,
        conteo: entregas.length,
      };
    });

    abiertos.splice(abiertos.indexOf(candidato), 1, ...partes);
    if (partes.length <= 1) break;
  }

  return abiertos;
}

function montosDe(grupo) {
  return [...new Set(grupo.entregas.map((e) => e.monto).filter(Boolean))].sort((a, b) => b - a);
}

function reagrupar() {
  estado.companias = estado.companias.map((c) => construirCompania(c.nombre, c.filas));
}


/* ---------- compañías ---------- */

function pintarCompanias() {
  const lista = $('#listaCompanias');
  lista.innerHTML = '';
  for (const compania of estado.companias) {
    const sinImagen = compania.grupos.filter((g) => !estado.imagenes.has(g.baseId || g.id)).length;
    const cuenta = estado.modo === 'carrusel'
      ? ((n) => `${n} ${n === 1 ? 'imagen' : 'imágenes'}`)(diapositivasDe(compania).length)
      : `${compania.grupos.length} premios`;
    const li = document.createElement('li');
    const boton = document.createElement('button');
    boton.type = 'button';
    boton.setAttribute('aria-current', String(compania.nombre === estado.seleccion));
    boton.innerHTML = `
      <span>${escapar(compania.nombre)}</span>
      <span class="meta${sinImagen ? ' alerta' : ''}">${cuenta}${
        sinImagen ? ` · ${sinImagen} sin imagen` : ''
      }</span>`;
    boton.addEventListener('click', () => {
      estado.seleccion = compania.nombre;
      estado.heroeManual = null;
      pintarCompanias();
      pintar();
    });
    li.appendChild(boton);
    lista.appendChild(li);
  }
}

/* ---------- construcción de la pieza ---------- */

function companiaActual() {
  return estado.companias.find((c) => c.nombre === estado.seleccion) || null;
}

// Ordena los grupos y coloca de héroe el premio más caro (o el elegido a mano).
function gruposOrdenados(compania) {
  const orden = [...compania.grupos].sort((a, b) => {
    const pa = estado.catalogo.find((p) => p.id === a.id)?.prioridad ?? 50;
    const pb = estado.catalogo.find((p) => p.id === b.id)?.prioridad ?? 50;
    return b.conteo - a.conteo || pb - pa || a.id.localeCompare(b.id);
  });

  const masCaro = [...orden].sort((a, b) => valorDe(b, estado.catalogo) - valorDe(a, estado.catalogo) || b.conteo - a.conteo)[0];
  const visibles = orden.slice(0, maxGrupos(estado.modo));

  // El premio más caro siempre entra en la pieza, aunque tenga pocas entregas:
  // si se quedó fuera del corte, desplaza al último.
  if (masCaro && !visibles.some((g) => g.id === masCaro.id)) visibles[visibles.length - 1] = masCaro;

  const idHeroe = estado.heroeManual || masCaro?.id;
  const i = visibles.findIndex((g) => g.id === idHeroe);
  if (i > 0) visibles.unshift(...visibles.splice(i, 1));

  return { visibles, sobran: orden.length - visibles.length };
}

// Quién sale y dónde. La posición se guarda por CANTIDAD DE PREMIOS y por POSE:
// así todas las piezas de cinco premios llevan a Gali sentado en el mismo sitio,
// pero el Syderax que ríe —que es el doble de grande y tiene otra silueta— puede
// tener el suyo propio.
//
// Mientras una pose no tenga posición propia, toma prestada la de otra pose de esa
// misma cantidad; en cuanto se la acomoda, se queda con la suya y deja de seguir a
// las demás. Y si no hay ninguna guardada, se calcula sobre la plantilla.
function claveDePosicion(cantidad, img) {
  const n = Math.min(Math.max(cantidad, 1), maxGrupos(estado.modo));
  const pose = slug((img.nombre || '').split('/').pop().replace(/\.(png|webp)$/i, ''));
  return `${estado.modo}-${n}-${pose}`;
}

// Posición de otra pose para esta misma cantidad de premios. Sirve de punto de
// partida para una pose que aún no se ha colocado. También recoge las claves
// antiguas `modo-cantidad`, de cuando la posición no distinguía de quién era.
function posicionPrestada(clave) {
  const familia = clave.split('-').slice(0, 2).join('-');
  const otra = Object.keys(estado.posiciones)
    .filter((k) => k === familia || k.startsWith(`${familia}-`))
    .sort()[0];
  return otra ? estado.posiciones[otra] : null;
}

function resolverPersonaje(compania, cantidad) {
  // Qué personaje sale: al azar, pero fijado por la tirada de esta carga del CSV.
  // Si fuera `Math.random()` a secas, cambiaría de bicho en cada repintado de la
  // vista previa y sería imposible trabajar.
  const semilla = `${estado.tirada}|${compania.nombre}|${fechaMaxima(compania.entregas)}`;
  const img = personajeDe(estado.personajes, semilla);
  if (!img) {
    estado.personajePieza = null;
    return null;
  }

  const clave = claveDePosicion(cantidad, img);
  const propia = estado.posiciones[clave];
  const prestada = propia ? null : posicionPrestada(clave);
  const colocada = propia || prestada;
  const auto = colocada ? null : posicionAutomatica(img, cantidad, estado.modo);
  const centro = colocada || (auto ? { x: auto.x, y: auto.y } : null);
  if (!centro) {
    estado.personajePieza = null;
    return null;
  }

  // Una posición puesta a mano manda tal cual, sea propia o prestada: ni se le
  // aplican los límites de tapado ni el lienzo crece para perseguirla.
  const personaje = {
    img,
    centro,
    escala: auto ? auto.escala : 1,
    aMano: Boolean(colocada),
  };
  estado.personajePieza = { ...personaje, clave, propia: Boolean(propia) };
  return personaje;
}

// Arrastrar el personaje por la vista previa. Lo que se suelta se guarda para
// todas las piezas con esa misma cantidad de premios.
function prepararArrastre() {
  const vista = $('#vistaPrevia');
  let arrastrando = null;

  const aLienzo = (evento) => {
    const caja = vista.getBoundingClientRect();
    return {
      x: ((evento.clientX - caja.left) / caja.width) * vista.width,
      y: ((evento.clientY - caja.top) / caja.height) * vista.height,
    };
  };

  vista.addEventListener('pointerdown', (e) => {
    const p = estado.personajePieza;
    if (!p) return;
    const r = rectPersonaje(p.img, p.centro, p.escala);
    const punto = aLienzo(e);
    const dentro = punto.x >= r.x && punto.x <= r.x + r.w && punto.y >= r.y && punto.y <= r.y + r.h;
    if (!dentro) return;

    // Al colocarlo a mano se dibuja a su tamaño normal. El automático a veces lo
    // encoge para que quepa; si se guardara encogido, al soltarlo crecería de
    // golpe y no sería lo que estabas colocando. Crece alrededor de su centro, así
    // que el cursor se queda donde está.
    arrastrando = { dx: punto.x - (r.x + r.w / 2), dy: punto.y - (r.y + r.h / 2) };
    estado.personajePieza.escala = 1;
    repintarConPersonaje();
    vista.setPointerCapture(e.pointerId);
    vista.classList.add('arrastrando');
    e.preventDefault();
  });

  vista.addEventListener('pointermove', (e) => {
    if (!arrastrando || !estado.personajePieza) return;
    const punto = aLienzo(e);
    estado.personajePieza.centro = {
      x: punto.x - arrastrando.dx,
      y: punto.y - arrastrando.dy,
    };
    // Se repinta con la posición nueva sin pasar por `pintar`, que volvería a
    // resolverla desde lo guardado y desharía el arrastre.
    repintarConPersonaje();
  });

  const soltar = async (e) => {
    if (!arrastrando) return;
    arrastrando = null;
    vista.classList.remove('arrastrando');
    if (e.pointerId != null && vista.hasPointerCapture(e.pointerId)) {
      vista.releasePointerCapture(e.pointerId);
    }
    const p = estado.personajePieza;
    if (p) await guardarPosicion(p.clave, p.centro);
  };
  vista.addEventListener('pointerup', soltar);
  vista.addEventListener('pointercancel', soltar);
}

function repintarConPersonaje() {
  const compania = companiaActual();
  if (!compania || !estado.personajePieza) return;
  const { visibles } = gruposOrdenados(compania);
  const { img, centro, escala } = estado.personajePieza;
  dibujarPieza(lienzo, {
    kicker: $('#campoKicker').value.trim(),
    logoCliente: logoDe(compania),
    titulo: $('#campoTitulo').value.trim() || 'Premios entregados',
    etiqueta: etiquetaDe(compania),
    logo: estado.logo,
    modo: estado.modo,
    grupos: visibles.map((g) => armarGrupo(g, estado.catalogo, estado.imagenes)),
    // `aMano` mientras se arrastra: el lienzo no debe crecer detrás del personaje
    // si lo estás sacando aposta por el borde.
    personaje: { img, centro, escala, aMano: true },
  });
  const vista = $('#vistaPrevia');
  vista.width = lienzo.width;
  vista.height = lienzo.height;
  vista.getContext('2d').drawImage(lienzo, 0, 0);
}

// Las posiciones son un solo mapa compartido en Firestore. Se pinta al momento con
// la nueva y luego se guarda; si falla, se avisa.
async function guardarPosicion(clave, centro) {
  const posiciones = { ...estado.posiciones };
  if (centro) posiciones[clave] = { x: Math.round(centro.x), y: Math.round(centro.y) };
  else delete posiciones[clave];
  estado.posiciones = posiciones;
  pintar();
  try {
    await guardarPosiciones(posiciones);
  } catch (err) {
    alert(`No se pudo guardar la posición: ${err.message}`);
  }
}

function avisoPersonaje(cantidad) {
  const p = estado.personajePieza;
  if (!p) return '';
  if (p.propia) return `Personaje colocado a mano para las piezas de ${cantidad} premios`;
  if (p.aMano) return 'Esta pose sigue la posición de otra; arrástrala para darle la suya';
  return '';
}

function pintar() {
  pintarIncompleto();
  const compania = companiaActual();
  if (!compania) {
    $('#vistaCarrusel').replaceChildren();
    $('#avisoPieza').textContent = estado.periodo ? 'Nadie reclamó premios en este periodo' : '';
    return;
  }

  if ($('#campoKicker').dataset.compania !== compania.nombre) {
    $('#campoKicker').value = compania.nombre;
    $('#campoKicker').dataset.compania = compania.nombre;
  }
  pintarLogoCliente(compania);
  pintarInfoFechas(compania);

  const carrusel = estado.modo === 'carrusel';
  $('#vistaUnica').classList.toggle('oculto', carrusel);
  $('#vistaCarrusel').classList.toggle('oculto', !carrusel);
  $('#campoHeroe').closest('label').classList.toggle('oculto', carrusel);
  if (carrusel) {
    pintarCarrusel(compania);
    return;
  }

  const { visibles, sobran } = gruposOrdenados(compania);

  const selector = $('#campoHeroe');
  selector.innerHTML = visibles
    .map((g) => `<option value="${escapar(g.id)}">${escapar(armarGrupo(g, estado.catalogo, estado.imagenes).nombre)}</option>`)
    .join('');
  selector.value = visibles[0]?.id || '';

  // Si el render falla a medias, el lienzo queda con las imágenes pero sin textos.
  // Mejor decirlo que dejar una pieza incompleta con pinta de correcta.
  try {
    dibujarPieza(lienzo, {
      kicker: $('#campoKicker').value.trim(),
      logoCliente: logoDe(compania),
      titulo: $('#campoTitulo').value.trim() || 'Premios entregados',
      etiqueta: etiquetaDe(compania),
      logo: estado.logo,
      modo: estado.modo,
      grupos: visibles.map((g) => armarGrupo(g, estado.catalogo, estado.imagenes)),
      personaje: resolverPersonaje(compania, visibles.length),
    });
  } catch (err) {
    $('#avisoPieza').textContent = `Error dibujando la pieza: ${err.message}`;
    console.error(err);
    return;
  }

  // El lienzo cambia de alto según la plantilla, así que la vista previa copia
  // el tamaño real en vez de darlo por sentado.
  const vista = $('#vistaPrevia');
  vista.width = lienzo.width;
  vista.height = lienzo.height;
  vista.getContext('2d').drawImage(lienzo, 0, 0);

  const sinImagen = visibles.filter((g) => !estado.imagenes.has(g.baseId || g.id)).length;
  const sinValor = visibles.filter((g) => valorDe(g, estado.catalogo) === 0).length;
  const avisos = [
    compania.grupos.length
      ? `${compania.entregas.length} entregas · ${compania.grupos.length} premios distintos`
      : 'Esta compañía no tiene premios que mostrar',
    sobran > 0 ? `${sobran} premios quedan fuera (la pieza muestra máximo ${maxGrupos(estado.modo)})` : '',
    sinImagen > 0 ? `${sinImagen} sin recorte: aparecen como marcador` : '',
    sinValor > 0 ? `${sinValor} sin valor definido: el destacado puede no ser el más caro` : '',
    !estado.logo ? 'Falta marca/logo-galilei.png' : '',
    avisoPersonaje(visibles.length),
  ].filter(Boolean);
  $('#botonPersonaje').hidden = !estado.personajePieza?.propia;
  $('#avisoPieza').textContent = avisos.join(' · ');
}

// La alerta grande de días sin cargar: la pieza saldría con premios de menos.
function pintarIncompleto() {
  pintarAlerta($('#alertaIncompleto'), {
    periodo: estado.periodo,
    falta: incompleto(estado.periodo),
    marco: $('#panelTrabajo .principal'),
    queHacer: 'Vuelve a correr la query (paso 1) y sube el CSV (paso 2)',
  });
}

/* ---------- pieza de celular ---------- */

// Todos los premios de la compañía, los de más valor primero. El rediseño los
// muestra juntos y sin separar por categoría; si pasan de `MAX_PREMIOS` se
// reparten en varias páginas.
function diapositivasDe(compania) {
  const grupos = [...compania.base]
    .sort((a, b) => valorDe(b, estado.catalogo) - valorDe(a, estado.catalogo) || b.conteo - a.conteo)
    .map((g) => armarGrupo(g, estado.catalogo, estado.imagenes));
  return armarCarrusel(grupos);
}

function pintarCarrusel(compania) {
  const diapositivas = diapositivasDe(compania);
  const contenedor = $('#vistaCarrusel');
  while (estado.lienzosCarrusel.length < diapositivas.length) {
    estado.lienzosCarrusel.push(document.createElement('canvas'));
  }

  const fecha = fechaMaxima(compania.entregas);
  const semilla = `${estado.tirada}|${compania.nombre}|${fecha}`;
  const comunes = {
    kicker: $('#campoKicker').value.trim(),
    logoCliente: logoDe(compania),
    titulo: $('#campoTitulo').value.trim() || 'Premios entregados',
    etiqueta: etiquetaDe(compania),
    logo: estado.logo,
  };

  contenedor.innerHTML = '';
  estado.diapositivas = [];
  estado.personajePieza = null;
  try {
    diapositivas.forEach((d, i) => {
      const canvas = estado.lienzosCarrusel[i];
      dibujarDiapositiva(canvas, {
        ...comunes,
        diapositiva: d,
        personaje: personajeDe(estado.personajes, `${semilla}|${i}`),
        // `personajeDe` es solo «elige uno de la lista con esta semilla»: sirve
        // igual para el escenario, y así el fondo también cambia cada semana.
        fondo: personajeDe(estado.fondos, `fondo|${semilla}|${i}`),
        trofeo: estado.trofeo,
      });

      const figura = document.createElement('figure');
      figura.className = 'diapositiva';
      const pie = document.createElement('figcaption');
      const parte = d.partes > 1 ? `Página ${d.parte} de ${d.partes}` : 'Pieza de celular';
      pie.textContent = `${parte} · ${d.grupos.length} ${d.grupos.length === 1 ? 'premio' : 'premios'}`;
      figura.append(canvas, pie);
      contenedor.append(figura);

      const sufijo = d.partes > 1 ? `-${i + 1}` : '';
      estado.diapositivas.push({
        canvas,
        nombre: `premios-${slug(compania.nombre)}-${sufijoPeriodo()}-celular${sufijo}.${SALIDA.extension}`,
      });
    });
  } catch (err) {
    $('#avisoPieza').textContent = `Error dibujando el carrusel: ${err.message}`;
    console.error(err);
    return;
  }

  const sinImagen = compania.base.filter((g) => !estado.imagenes.has(g.id)).length;
  const sobran = diapositivas.some((d) => d.ganadores.length > capacidadGanadores(d.grupos.length));
  const avisos = [
    diapositivas.length
      ? `${compania.entregas.length} entregas · ${diapositivas.length} ${diapositivas.length === 1 ? 'imagen' : 'imágenes'} de 1080 x 1792`
      : 'Esta compañía no tiene premios que mostrar',
    diapositivas.length > 1
      ? `${compania.base.length} premios: pasan de ${MAX_PREMIOS}, así que van en ${diapositivas.length} páginas`
      : '',
    sobran ? 'Hay más ganadores que sitio: los últimos se resumen en «+N más»' : '',
    sinImagen > 0 ? `${sinImagen} sin recorte: aparecen como marcador` : '',
    !estado.logo ? 'Falta marca/logo-galilei.png' : '',
    !estado.fondos.length ? 'Faltan los escenarios de Assets/Fondos' : '',
  ].filter(Boolean);
  $('#botonPersonaje').hidden = true;
  $('#avisoPieza').textContent = avisos.join(' · ');
}

/* ---------- salida ---------- */

// «2026-10-05-al-2026-10-11»: el periodo, en el nombre de cada archivo.
const sufijoPeriodo = () => `${estado.periodo.inicio}-al-${estado.periodo.fin}`;

function nombreArchivo(compania) {
  const sufijo = estado.modo === 'collage' ? '-collage' : '';
  return `premios-${slug(compania.nombre)}-${sufijoPeriodo()}${sufijo}.${SALIDA.extension}`;
}

// Lo que se exporta de la compañía en pantalla: una pieza en los modos
// horizontales y una imagen por diapositiva en el carrusel. Hay que llamarla
// después de `pintar()`.
function piezasActuales(compania) {
  if (estado.modo === 'carrusel') return estado.diapositivas;
  return [{ canvas: lienzo, nombre: nombreArchivo(compania) }];
}

async function descargar() {
  const compania = companiaActual();
  if (!compania) return;
  if (!confirmarDescarga(incompleto(estado.periodo))) return;
  for (const [i, pieza] of piezasActuales(compania).entries()) {
    // Chrome pide permiso una vez para descargas múltiples; con un respiro entre
    // ellas no se come ninguna.
    if (i) await new Promise((r) => setTimeout(r, 400));
    await exportarImagen(pieza.canvas, pieza.nombre);
  }
}

// Todas las compañías de una pasada, en un ZIP. Va una a una porque los lienzos
// se reutilizan: se selecciona, se pinta y se comprime cada imagen antes de pasar
// a la siguiente. Al terminar deja seleccionada la compañía que estaba.
async function exportarTodo() {
  if (!estado.companias.length) return;
  if (!confirmarDescarga(incompleto(estado.periodo))) return;
  const boton = $('#botonExportarTodo');
  const seleccionPrevia = estado.seleccion;
  const total = estado.companias.length;
  const zip = new window.JSZip();
  let imagenes = 0;

  boton.disabled = true;
  try {
    for (const [i, compania] of estado.companias.entries()) {
      boton.textContent = `Preparando ${i + 1} de ${total}…`;
      estado.seleccion = compania.nombre;
      estado.heroeManual = null;
      pintarCompanias();
      pintar();
      // Un respiro entre piezas: si no, el navegador no llega a repintar el
      // contador y la pestaña parece colgada durante toda la tanda.
      await new Promise((r) => setTimeout(r, 0));
      for (const pieza of piezasActuales(compania)) {
        zip.file(pieza.nombre, await aBlob(pieza.canvas));
        imagenes += 1;
      }
    }
    boton.textContent = 'Comprimiendo…';
    // Los JPG ya van comprimidos: se guardan tal cual, sin volver a comprimir.
    const contenido = await zip.generateAsync({ type: 'blob', compression: 'STORE' });
    descargarBlob(contenido, `premios-${sufijoPeriodo()}.zip`);
    $('#avisoPieza').textContent = `${imagenes} imágenes de ${total} compañías en el ZIP`;
  } catch (err) {
    alert(`No se pudo armar el ZIP: ${err.message}`);
  } finally {
    estado.seleccion = seleccionPrevia;
    estado.heroeManual = null;
    pintarCompanias();
    pintar();
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

// La etiqueta verde. Al elegir el periodo el campo se llena con sus fechas,
// p. ej. «5 Oct - 11 Oct»: es la misma para todas las compañías. Se puede
// editar; si se deja vacío, vuelve a salir la automática.
function etiquetaDe(compania) {
  const escrita = $('#campoEtiqueta').value.trim();
  if (escrita || !compania || !estado.periodo) return escrita;
  return fechasDe(estado.periodo);
}

const fechasDe = (periodo) => `${diaMes(periodo.inicio)} - ${diaMes(periodo.fin)}`;

// Solo informativo, debajo de la etiqueta: de qué fecha a qué fecha van las
// entregas de esta compañía en el periodo.
function pintarInfoFechas(compania) {
  const fechas = compania.entregas.map((e) => e.fecha).filter(Boolean).sort();
  const info = $('#infoFechas');
  if (!fechas.length) {
    info.textContent = 'Las entregas no traen fecha';
    return;
  }
  const texto = (iso) => {
    const [a, m, d] = iso.split('-').map(Number);
    return `${d} ${MESES[m - 1]} ${a}`;
  };
  const primera = fechas[0];
  const ultima = fechas[fechas.length - 1];
  info.textContent = primera === ultima
    ? `Premios del periodo: ${texto(primera)}`
    : `Premios del periodo: ${texto(primera)} – ${texto(ultima)}`;
}

function fechaMaxima(entregas) {
  const fechas = entregas.map((e) => e.fecha).filter(Boolean).sort();
  return fechas[fechas.length - 1] || new Date().toISOString().slice(0, 10);
}

function escapar(texto) {
  return String(texto).replace(/[&<>"]/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]
  ));
}
