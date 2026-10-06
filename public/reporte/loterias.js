// Paso 3 del reporte para clientes: las rifas de cada lotería, una por mes.
// Ninguna está en la base de datos: premio, ganador, empresa, link del live y
// foto se escriben aquí y se guardan en Firestore para todo el equipo, un
// documento por lotería y mes (`loteria-2026-09`, `loteriaResenas-2026-10`…).
//
// Qué rifa sale en un reporte lo decide `mesDeLoteria` (reporte-datos.js): la
// del mes en que termina el periodo, o la del anterior si termina en la primera
// semana del mes (la rifa de un mes se sortea a comienzos del siguiente).
//
// Añadir una lotería es añadir una entrada a `LOTERIAS` (y, si es de una sola
// compañía, su patrón en `loteriaDe`): la tarjeta, el guardado y la hoja del PDF
// salen de esa entrada.

import { escucharLoterias, guardarLoteria } from '../lib/nube.js';
import { cargarImagen } from '../lib/imagenes.js';
import { MESES_LARGOS } from '../lib/periodos.js';
import { RESENAS_PARA_CLASIFICAR } from '../lib/reporte-datos.js';

// `pagaGalilei`: la lotería la financia 100 % Galilei (no le cuesta nada a la
// empresa) y así lo dicen la tarjeta y la hoja. Solo la de Galilei y la de
// Reseñas; cualquier otra (como la de Auteco) no.
export const LOTERIAS = {
  galilei: {
    doc: 'loteria',
    nombre: 'GaliLotería',
    // Sin Gali en la hoja, el título va en una línea a todo lo ancho.
    titulo: 'GaliLotería',
    descripcion: 'La paga 100 % Galilei. Sale en el reporte de todas las compañías, menos Auteco.',
    pagaGalilei: true,
    // Solo requisitos para clasificar: lo demás (la rifa en vivo) va en la nota.
    pasos: ['15 partidas en el mes', '30 puntos o más en una partida'],
    nota: 'La paga 100 % Galilei: no le cuesta nada a tu empresa. Se rifa en vivo cada mes.',
  },
  resenas: {
    doc: 'loteriaResenas',
    nombre: 'GaliLotería de Reseñas',
    titulo: 'GaliLotería de Reseñas',
    descripcion: 'La paga 100 % Galilei. Sale en el reporte de las compañías con reseñas; el live es el mismo de la GaliLotería.',
    pagaGalilei: true,
    pasos: [`${RESENAS_PARA_CLASIFICAR} reviews de 5★ en el mes con tu tarjeta Galilei`],
    nota: 'La paga 100 % Galilei: no le cuesta nada a tu empresa. Se rifa en vivo cada mes.',
    // Comparte el live: el campo no sale en su tarjeta y la hoja toma el de esta.
    liveDe: 'galilei',
  },
  auteco: {
    doc: 'loteriaAuteco',
    nombre: 'Lotería Auteco',
    titulo: 'Lotería Auteco',
    descripcion: 'La propia de Auteco: no la paga Galilei. Pide además escaneos de baterías; sus clasificados salen de la query 4.',
    pasos: ['15 partidas en el mes', '30 puntos o más en una partida', 'Escaneos: 10 técnicos, 20 asesores'],
    nota: 'Lotería exclusiva del equipo Auteco.',
  },
};

// Qué lotería le toca a una compañía: Auteco tiene la suya; el resto, la de Galilei.
export const loteriaDe = (compania) => (/auteco/i.test(compania) ? 'auteco' : 'galilei');

const CAMPOS = [
  { clave: 'premio', etiqueta: 'Premio', ejemplo: 'Una moto' },
  { clave: 'ganador', etiqueta: 'Ganador', ejemplo: 'Nombre y apellido' },
  { clave: 'empresa', etiqueta: 'Empresa del ganador', ejemplo: '' },
  { clave: 'live', etiqueta: 'Link del live', ejemplo: 'https://…', ancho: true },
];
const GUARDABLES = ['premio', 'ganador', 'empresa', 'live', 'foto'];

// Meses: «2026-09» <-> «septiembre 2026».
const nombreMes = (mes) => MESES_LARGOS[Number(mes.slice(5, 7)) - 1];
const conMayuscula = (t) => t.charAt(0).toUpperCase() + t.slice(1);
const mesMas = (mes, n) => {
  const d = new Date(Date.UTC(Number(mes.slice(0, 4)), Number(mes.slice(5, 7)) - 1 + n, 1));
  return d.toISOString().slice(0, 7);
};
const idDoc = (loteria, mes) => `${loteria.doc}-${mes}`;

// El documento viejo de cada lotería (una sola «última rifa», con el mes escrito
// a mano) cuenta como la rifa de ese mes, el más reciente con ese nombre.
function mesDelViejo(texto, hoy) {
  const i = MESES_LARGOS.indexOf(String(texto || '').trim().toLowerCase());
  if (i < 0) return null;
  let anio = Number(hoy.slice(0, 4));
  if (i + 1 > Number(hoy.slice(5, 7)) + 1) anio -= 1;
  return `${anio}-${String(i + 1).padStart(2, '0')}`;
}

/**
 * Las rifas de todas las loterías por mes: { [lotería]: { [«2026-09»]: { rifa, foto } } },
 * a partir de los documentos de Firestore. El documento del mes manda sobre el viejo.
 */
async function rifasDe(docs, fotos, hoy) {
  const rifas = {};
  for (const [id, loteria] of Object.entries(LOTERIAS)) {
    rifas[id] = {};
    const viejo = docs[loteria.doc];
    const mesViejo = viejo && mesDelViejo(viejo.mes, hoy);
    if (mesViejo) rifas[id][mesViejo] = { rifa: viejo };
    for (const [clave, datos] of Object.entries(docs)) {
      if (clave.startsWith(`${loteria.doc}-`)) rifas[id][clave.slice(loteria.doc.length + 1)] = { rifa: datos };
    }
    for (const r of Object.values(rifas[id])) r.foto = await fotoCargada(fotos, r.rifa.foto);
  }
  return rifas;
}

// Las fotos se cargan una vez y se reutilizan mientras no cambien.
async function fotoCargada(cache, url) {
  if (!url) return null;
  if (!cache.has(url)) cache.set(url, await cargarImagen(url).catch(() => null));
  return cache.get(url);
}

// La rifa como sale en la hoja: la del mes de la lotería, con su mes escrito y
// con el live de la lotería con la que lo comparte.
export function rifaParaHoja(id, mes, rifas) {
  const clave = mes.slice(0, 7);
  const { rifa = {}, foto = null } = rifas[id]?.[clave] || {};
  const origen = LOTERIAS[id].liveDe;
  const live = origen ? rifas[origen]?.[clave]?.rifa?.live || '' : rifa.live;
  return { rifa: { ...rifa, mes: nombreMes(clave), live }, foto };
}

/**
 * El paso 3: un selector de mes y una tarjeta por lotería con la rifa de ese mes.
 * `alCambiar(rifas, mes)` llega al cargar, con cada cambio de Firestore, mientras
 * se escribe (antes de guardar) y al cambiar de mes.
 */
export function montarLoterias(contenedor, { alCambiar, alError, hoy }) {
  const mesHoy = hoy.slice(0, 7);
  // Por defecto, la rifa que corresponde hoy (la del mes pasado en la primera semana).
  let mes = Number(hoy.slice(8, 10)) <= 7 ? mesMas(mesHoy, -1) : mesHoy;
  let docs = {};
  let rifas = {};
  const fotos = new Map();
  // Lo escrito que Firestore aún no confirmó, por documento: { id, mes, datos }.
  const pendientes = {};

  const selector = crearSelector(contenedor);
  const tarjetas = Object.entries(LOTERIAS).map(([id, loteria]) => {
    const t = crearTarjeta(loteria, CAMPOS.filter((c) => !(c.clave === 'live' && loteria.liveDe)));
    contenedor.appendChild(t.raiz);
    return { id, loteria, t };
  });

  const rifaMostrada = (id) => ({
    ...(rifas[id]?.[mes]?.rifa || {}),
    ...(pendientes[idDoc(LOTERIAS[id], mes)]?.datos || {}),
  });
  // Lo pendiente cuenta también para la vista previa.
  const conPendientes = () => Object.fromEntries(Object.keys(LOTERIAS).map((id) => {
    const porMes = { ...(rifas[id] || {}) };
    if (pendientes[idDoc(LOTERIAS[id], mes)]) porMes[mes] = { foto: porMes[mes]?.foto || null, rifa: rifaMostrada(id) };
    return [id, porMes];
  }));
  const avisar = () => alCambiar(conPendientes(), mes);

  const pintarTarjetas = () => {
    pintarSelector(selector, mes, mesHoy, rifas);
    for (const { id, t } of tarjetas) {
      const rifa = rifaMostrada(id);
      for (const [clave, input] of Object.entries(t.entradas)) {
        if (document.activeElement !== input && input.value !== (rifa[clave] || '')) input.value = rifa[clave] || '';
      }
      pintarFoto(t, rifa.foto);
      pintarEstado(t, rifa);
      // Rifa nueva (sin premio) y la del mes anterior escrita: se ofrece copiarla.
      const anterior = rifas[id]?.[mesMas(mes, -1)]?.rifa;
      t.copiar.hidden = Boolean(rifa.premio) || !anterior?.premio;
      if (!t.copiar.hidden) t.copiar.textContent = `Copiar premio y foto de ${nombreMes(mesMas(mes, -1))}`;
    }
  };

  // Guardado: lo pendiente de cada documento, todo junto. Si el documento del
  // mes aún no existe, se escribe la rifa completa (así lo que venía del
  // documento viejo pasa al del mes).
  let espera = null;
  const enviar = async () => {
    clearTimeout(espera);
    for (const [doc, { id, mes: mesDoc, datos }] of Object.entries(pendientes)) {
      if (!Object.keys(datos).length) continue;
      const { t } = tarjetas.find((x) => x.id === id);
      const completa = docs[doc] ? datos : { ...soloGuardables(rifas[id]?.[mesDoc]?.rifa || {}), ...datos };
      pintarGuardado(t, 'guardando');
      try {
        await guardarLoteria(doc, completa);
        const actual = pendientes[doc].datos;
        for (const [clave, valor] of Object.entries(datos)) if (actual[clave] === valor) delete actual[clave];
        if (!Object.keys(actual).length) delete pendientes[doc];
        pintarGuardado(t, pendientes[doc] ? 'pendiente' : 'guardado');
      } catch (err) {
        pintarGuardado(t, 'error', err);
        alError(err);
      }
    }
  };
  const anotar = (id, datos) => {
    const doc = idDoc(LOTERIAS[id], mes);
    pendientes[doc] = { id, mes, datos: { ...(pendientes[doc]?.datos || {}), ...datos } };
    const { t } = tarjetas.find((x) => x.id === id);
    pintarGuardado(t, 'pendiente');
    pintarEstado(t, rifaMostrada(id));
    clearTimeout(espera);
    espera = setTimeout(enviar, 600);
    avisar();
  };

  for (const { id, t } of tarjetas) {
    for (const [clave, input] of Object.entries(t.entradas)) {
      input.addEventListener('input', () => anotar(id, { [clave]: input.value }));
      input.addEventListener('blur', enviar);
    }
    t.subir.addEventListener('change', async () => {
      const archivo = t.subir.files[0];
      t.subir.value = '';
      if (!archivo) return;
      const reducida = await fotoReducida(archivo).catch(() => null);
      if (!reducida) return;
      anotar(id, { foto: reducida });
      enviar();
    });
    // Copia lo que suele repetirse de un mes a otro: el premio y su foto. Ganador,
    // empresa y live son de cada rifa: quedan en blanco.
    t.copiar.addEventListener('click', () => {
      const anterior = rifas[id]?.[mesMas(mes, -1)]?.rifa || {};
      anotar(id, { premio: anterior.premio || '', ...(anterior.foto ? { foto: anterior.foto } : {}) });
      pintarTarjetas();
      enviar();
    });
    t.quitar.addEventListener('click', () => {
      anotar(id, { foto: '' });
      enviar();
    });
  }
  selector.addEventListener('change', async () => {
    await enviar();
    mes = selector.value;
    for (const { t } of tarjetas) t.guardado.textContent = '';
    pintarTarjetas();
    avisar();
  });
  // Al cambiar de ventana o de pestaña se guarda de una vez, sin esperar.
  window.addEventListener('blur', enviar);
  document.addEventListener('visibilitychange', () => { if (document.hidden) enviar(); });
  window.addEventListener('beforeunload', (e) => {
    if (Object.keys(pendientes).length) e.preventDefault();
  });

  escucharLoterias(async (recibidos) => {
    docs = recibidos;
    rifas = await rifasDe(docs, fotos, hoy);
    pintarTarjetas();
    avisar();
  }, alError);
}

const soloGuardables = (rifa) => Object.fromEntries(Object.entries(rifa).filter(([k]) => GUARDABLES.includes(k)));

function crearSelector(contenedor) {
  const label = document.createElement('label');
  label.className = 'mes-rifa';
  const span = document.createElement('span');
  span.textContent = 'Mes de la rifa';
  const select = document.createElement('select');
  label.append(span, select);
  contenedor.appendChild(label);
  return select;
}

// Del mes pasado al siguiente, más cualquier otro mes que ya tenga rifa escrita.
function pintarSelector(select, mes, mesHoy, rifas) {
  const meses = new Set([mesMas(mesHoy, -2), mesMas(mesHoy, -1), mesHoy, mesMas(mesHoy, 1), mes]);
  for (const porMes of Object.values(rifas)) for (const m of Object.keys(porMes)) meses.add(m);
  select.innerHTML = [...meses].sort().reverse().map((m) => {
    const escritas = Object.values(rifas).filter((porMes) => porMes[m]?.rifa?.premio).length;
    return `<option value="${m}">${conMayuscula(nombreMes(m))} ${m.slice(0, 4)}${escritas ? ` · ${escritas} escritas` : ''}</option>`;
  }).join('');
  select.value = mes;
}

function crearTarjeta(loteria, campos) {
  const raiz = document.createElement('article');
  raiz.className = 'rifa';
  raiz.innerHTML = `
    <header><h3></h3><span class="estado"></span></header>
    <p class="tenue descripcion"></p>
    <button type="button" class="enlace copiar" hidden></button>
    <div class="campos"></div>
    <div class="foto">
      <span class="miniatura">Sin foto</span>
      <label class="boton">Subir foto<input type="file" accept="image/*" hidden></label>
      <button type="button" class="boton quitar" hidden>Quitar</button>
    </div>
    <p class="guardado"></p>`;
  raiz.querySelector('h3').textContent = loteria.nombre;
  raiz.querySelector('.descripcion').textContent = loteria.descripcion;

  const entradas = {};
  for (const campo of campos) {
    const label = document.createElement('label');
    if (campo.ancho) label.className = 'ancho';
    const span = document.createElement('span');
    span.textContent = campo.etiqueta;
    const input = document.createElement('input');
    input.type = 'text';
    input.autocomplete = 'off';
    input.placeholder = campo.ejemplo;
    label.append(span, input);
    raiz.querySelector('.campos').appendChild(label);
    entradas[campo.clave] = input;
  }
  return {
    raiz,
    entradas,
    estado: raiz.querySelector('.estado'),
    miniatura: raiz.querySelector('.miniatura'),
    subir: raiz.querySelector('input[type="file"]'),
    quitar: raiz.querySelector('.quitar'),
    guardado: raiz.querySelector('.guardado'),
    copiar: raiz.querySelector('.copiar'),
  };
}

function pintarEstado(t, rifa) {
  const conLive = 'live' in t.entradas;
  const listo = Boolean(rifa.premio && (rifa.live || !conLive));
  t.estado.className = `estado${listo ? ' listo' : ''}`;
  t.estado.textContent = listo ? '✓ Lista' : rifa.premio ? 'Falta el link del live' : 'Sin escribir';
}

// Si lo escrito ya quedó en Firestore. Un error se queda a la vista hasta el
// próximo guardado que salga bien: lo escrito sigue en la tarjeta, sin perderse.
function pintarGuardado(t, estado, err) {
  const textos = {
    pendiente: 'Cambios sin guardar…',
    guardando: 'Guardando…',
    guardado: '✓ Guardado para todo el equipo',
    error: `No se pudo guardar (${err?.code || err?.message || 'error'}). Lo escrito sigue aquí: no cierres la página`,
  };
  t.guardado.className = `guardado${estado === 'error' ? ' error' : ''}`;
  t.guardado.textContent = textos[estado];
}

function pintarFoto(t, url) {
  t.quitar.hidden = !url;
  if (url) {
    const img = document.createElement('img');
    img.src = url;
    img.alt = 'Foto del premio';
    t.miniatura.replaceChildren(img);
  } else {
    t.miniatura.textContent = 'Sin foto';
  }
}

// La foto va dentro del documento de Firestore (máximo 1 MB): se reduce a 900 px
// de lado y se pasa a WebP.
async function fotoReducida(archivo) {
  const url = URL.createObjectURL(archivo);
  try {
    const img = await cargarImagen(url);
    const escala = Math.min(1, 900 / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement('canvas');
    c.width = Math.round(img.naturalWidth * escala);
    c.height = Math.round(img.naturalHeight * escala);
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL('image/webp', 0.85);
  } finally {
    URL.revokeObjectURL(url);
  }
}
