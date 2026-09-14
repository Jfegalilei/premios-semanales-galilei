// Carrusel para celular: una imagen vertical de 1080 x 1920 por categoría de
// premio (plata, bonos, electrodomésticos y electrónicos).
//
// La pieza horizontal de 4788 px se ve diminuta en un teléfono: siete premios con
// sus listas no caben en una pantalla vertical sin que el texto quede ilegible.
// Aquí cada categoría va en su propia imagen y, si no cabe, se parte en dos.
//
// Todo se dibuja en unidades de 1080 x 1920 y el lienzo real sale a `escala`, así
// que el JPG queda nítido aunque el diseño se piense a tamaño de pantalla.

import { contener, redondeado, recortar, curvaPunteada } from './lienzo.js';
import { ESTILO } from './plantillas.js';

export const CARRUSEL = { ancho: 1080, alto: 1920, escala: 2 };

// Orden en que salen en el carrusel.
export const CATEGORIAS = [
  { id: 'plata', titulo: 'Plata' },
  { id: 'bonos', titulo: 'Bonos' },
  { id: 'electro', titulo: 'Electrodomésticos y electrónicos' },
];

// Para premios que aún no tienen categoría en catalogo.json. Se puede corregir
// desde la Biblioteca.
export function categoriaPorDefecto(id, desglose) {
  const texto = String(id || '').toLowerCase();
  if (/nequi|daviplata|efectivo|transferencia|plata/.test(texto)) return 'plata';
  if (desglose === 'por-monto' || /bono|gift|netflix|spotify|pass|caja|tarjeta/.test(texto)) return 'bonos';
  return 'electro';
}

const C = {
  margen: 64,
  contenidoArriba: 530,
  contenidoAbajo: 1920 - 170,

  chipAlto: 76,
  chipFuente: 36,
  chipFuenteMin: 26,
  chipPadX: 30,

  listaFuente: 34,
  interlinea: 48,
  listaPad: 24,
  sangria: 28,
  listaRadio: 18,
  huecoChipLista: 16,

  // Filas: recorte a un lado y texto al otro, alternando.
  imgAncho: 400,
  // Holgado a propósito: es el pasillo por el que la punteada va del chip al recorte.
  huecoFila: 56,
  separacionFilas: 44,
  imgMinFila: 300,
  imgMaxFila: 500,
  maxLineasFila: 6, // 5 nombres + "+N más", como en la pieza horizontal

  // Destacado: cuando un premio va solo en su imagen, recorte grande arriba y
  // lista debajo, a dos columnas si es larga.
  imgMinHeroe: 360,
  imgMaxHeroe: 820,
  huecoHeroe: 44,
  lineasUnaColumna: 8,
  huecoColumnas: 28,
  // A dos columnas la letra baja un poco para que no se corten los nombres largos.
  listaFuenteColumnas: 31,
  minLista: 27,

  // El personaje solo sale si al contenido le sobra al menos este alto.
  personajeMinHueco: 420,
  personajeMaxAlto: 640,

  // La punteada del collage, llevada a esta escala.
  punteada: { factor: 0.45, trazo: 3.5, guiones: [9, 13], limites: { w: 1080, h: 1920 } },
};

const ANCHO = CARRUSEL.ancho;
const ALTO = CARRUSEL.alto;
const AREA = C.contenidoAbajo - C.contenidoArriba;
const ANCHO_UTIL = ANCHO - C.margen * 2;
const TEXTO_FILA = ANCHO_UTIL - C.imgAncho - C.huecoFila;

const fuente = (peso, tam) => `${peso} ${tam}px ${ESTILO.fuenteTitulo}`;
const fuenteGanadores = (peso, tam) => `${peso} ${tam}px ${ESTILO.fuenteGanadores}`;
const limitar = (v, min, max) => Math.min(Math.max(v, min), max);

/* ---------- reparto en diapositivas ---------- */

/**
 * @param {Array<{id:string, titulo:string, grupos:Array}>} categorias grupos ya
 *   armados (chip, nombres/montos, imagen, conteo) y ordenados.
 * @returns {Array<{categoria:object, grupos:Array}>}
 */
export function armarCarrusel(categorias) {
  const diapositivas = [];
  for (const cat of categorias) {
    if (!cat.grupos.length) continue;
    const alturas = cat.grupos.map((g) => Math.max(
      altoTexto(Math.min(totalLineas(g), C.maxLineasFila)),
      C.imgMinFila,
    ));
    const paginas = paginar(alturas);
    const entregas = cat.grupos.reduce((s, g) => s + (g.conteo || 0), 0);
    paginas.forEach((indices, i) => diapositivas.push({
      categoria: { id: cat.id, titulo: cat.titulo, entregas, parte: i + 1, partes: paginas.length },
      grupos: indices.map((k) => cat.grupos[k]),
    }));
  }
  return diapositivas;
}

// Llena cada diapositiva hasta donde quepa y luego reparte parejo: con cinco
// premios mejor 3 + 2 que 4 + 1.
function paginar(alturas) {
  const cabe = (indices) => indices.reduce((s, k) => s + alturas[k], 0)
    + C.separacionFilas * (indices.length - 1) <= AREA;

  const paginas = [];
  let actual = [];
  alturas.forEach((_, i) => {
    if (actual.length && !cabe([...actual, i])) {
      paginas.push(actual);
      actual = [];
    }
    actual.push(i);
  });
  if (actual.length) paginas.push(actual);

  if (paginas.length > 1) {
    const tam = Math.ceil(alturas.length / paginas.length);
    const parejas = [];
    for (let i = 0; i < alturas.length; i += tam) {
      parejas.push(alturas.slice(i, i + tam).map((_, k) => i + k));
    }
    if (parejas.length === paginas.length && parejas.every(cabe)) return parejas;
  }
  return paginas;
}

/* ---------- listas de ganadores ---------- */

function seccionesDe(g) {
  return g.montos && g.montos.length
    ? g.montos.map((m) => ({ titulo: m.etiqueta || null, nombres: m.nombres }))
    : [{ titulo: null, nombres: g.nombres || [] }];
}

function totalLineas(g) {
  return seccionesDe(g).reduce((s, x) => s + x.nombres.length + (x.titulo ? 1 : 0), 0);
}

// Líneas a pintar, con un tope. En los premios por monto cada importe va como
// subtítulo y debajo sus ganadores; lo que no cabe se resume en "+N más".
function lineasDe(g, max) {
  const secciones = seccionesDe(g);
  const totalNombres = secciones.reduce((s, x) => s + x.nombres.length, 0);
  const todas = secciones.flatMap((s) => [
    ...(s.titulo ? [{ tipo: 'monto', texto: s.titulo }] : []),
    ...s.nombres.map((n) => ({ tipo: 'nombre', texto: n })),
  ]);
  if (todas.length <= max) return todas;

  const salida = [];
  let presupuesto = max - 1;
  let vistos = 0;
  for (const s of secciones) {
    if (s.titulo) {
      if (presupuesto < 2) break; // un importe sin ningún nombre debajo no sirve
      salida.push({ tipo: 'monto', texto: s.titulo });
      presupuesto -= 1;
    }
    for (const n of s.nombres) {
      if (presupuesto < 1) break;
      salida.push({ tipo: 'nombre', texto: n });
      presupuesto -= 1;
      vistos += 1;
    }
    if (presupuesto < 1) break;
  }
  salida.push({ tipo: 'mas', texto: `+${totalNombres - vistos} más` });
  return salida;
}

function altoTexto(lineas) {
  if (!lineas) return C.chipAlto;
  return C.chipAlto + C.huecoChipLista + C.listaPad * 2 + lineas * C.interlinea;
}

/* ---------- dibujo ---------- */

/**
 * Pinta una diapositiva del carrusel en `canvas`.
 * @param {HTMLCanvasElement} canvas
 */
export function dibujarDiapositiva(canvas, {
  kicker, titulo, etiqueta, logo, diapositiva, indice, total, personaje,
}) {
  const { escala } = CARRUSEL;
  canvas.width = ANCHO * escala;
  canvas.height = ALTO * escala;
  const ctx = canvas.getContext('2d');
  ctx.save();
  ctx.setTransform(escala, 0, 0, escala, 0, 0);
  ctx.imageSmoothingQuality = 'high';
  ctx.clearRect(0, 0, ANCHO, ALTO);

  cabecera(ctx, { kicker, titulo, etiqueta, logo });
  rotulo(ctx, diapositiva.categoria);

  const hayPersonaje = Boolean(personaje && personaje.complete && personaje.naturalWidth);
  const { grupos } = diapositiva;
  const libre = grupos.length === 1
    ? heroe(ctx, grupos[0], hayPersonaje)
    : filas(ctx, grupos, hayPersonaje);

  pie(ctx, indice, total);

  // Personaje y fondo por debajo de lo ya pintado, como en la pieza horizontal.
  ctx.globalCompositeOperation = 'destination-over';
  if (hayPersonaje && libre) dibujarPersonaje(ctx, personaje, libre);
  fondo(ctx);

  ctx.restore();
  return canvas;
}

function fondo(ctx) {
  const g = ctx.createLinearGradient(0, 0, ANCHO, ALTO);
  g.addColorStop(0, ESTILO.fondoDe);
  g.addColorStop(1, ESTILO.fondoA);
  // El halo va primero porque con `destination-over` lo último queda más abajo.
  const halo = ctx.createRadialGradient(ANCHO / 2, ALTO * 0.56, 80, ANCHO / 2, ALTO * 0.56, ANCHO * 0.75);
  halo.addColorStop(0, 'rgba(201, 247, 63, 0.06)');
  halo.addColorStop(1, 'rgba(201, 247, 63, 0)');
  ctx.fillStyle = halo;
  ctx.fillRect(0, 0, ANCHO, ALTO);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, ANCHO, ALTO);
}

function cabecera(ctx, { kicker, titulo, etiqueta, logo }) {
  const logoCaja = [ANCHO - C.margen - 240, 76, 240, 86];

  if (kicker) {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
    ctx.font = fuente(600, 30);
    ctx.textBaseline = 'alphabetic';
    ctx.textAlign = 'left';
    ctx.fillText(recortar(ctx, kicker.toUpperCase(), ANCHO_UTIL - logoCaja[2] - 40), C.margen, 128);
  }

  if (logo && logo.complete && logo.naturalWidth) {
    contener(ctx, logo, ...logoCaja, 'derecha');
  } else {
    ctx.fillStyle = ESTILO.blanco;
    ctx.font = fuente(700, 52);
    ctx.textAlign = 'right';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText('galilei', logoCaja[0] + logoCaja[2], 140);
    ctx.textAlign = 'left';
  }

  const ty = 180;
  const tam = ajustar(ctx, titulo, ANCHO_UTIL, 104, 60, (t) => fuente(ESTILO.pesoTitulo, t));
  ctx.fillStyle = ESTILO.blanco;
  ctx.font = fuente(ESTILO.pesoTitulo, tam);
  ctx.textBaseline = 'top';
  ctx.textAlign = 'left';
  ctx.fillText(titulo, C.margen, ty);
  const anchoTitulo = ctx.measureText(titulo).width;

  if (etiqueta) {
    ctx.save();
    const chipTam = Math.round(tam * 0.3);
    ctx.font = fuente(700, chipTam);
    const w = ctx.measureText(etiqueta).width + 56;
    const h = chipTam * 1.85;
    const x = Math.min(C.margen + anchoTitulo - w * 0.35, ANCHO - C.margen - w);
    const y = ty + tam * 0.98;
    ctx.translate(x + w / 2, y + h / 2);
    ctx.rotate((-2.2 * Math.PI) / 180);
    ctx.fillStyle = ESTILO.lima;
    redondeado(ctx, -w / 2, -h / 2, w, h, h / 2);
    ctx.fill();
    ctx.fillStyle = ESTILO.tinta;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';
    ctx.fillText(etiqueta, 0, 2);
    ctx.restore();
  }
}

// Nombre de la categoría con una barra verde al lado y, debajo, cuántas entregas.
function rotulo(ctx, cat) {
  const y = 385;
  const x = C.margen + 30;
  const tam = ajustar(ctx, cat.titulo, ANCHO_UTIL - 30, 62, 38, (t) => fuente(700, t));

  ctx.fillStyle = ESTILO.lima;
  redondeado(ctx, C.margen, y + tam * 0.08, 10, tam * 0.86, 5);
  ctx.fill();

  ctx.fillStyle = ESTILO.blanco;
  ctx.font = fuente(700, tam);
  ctx.textBaseline = 'top';
  ctx.textAlign = 'left';
  ctx.fillText(cat.titulo, x, y);

  const partes = cat.partes > 1 ? ` · ${cat.parte} de ${cat.partes}` : '';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
  ctx.font = fuenteGanadores(400, 28);
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(`${cat.entregas} ${cat.entregas === 1 ? 'entrega' : 'entregas'}${partes}`, x, y + tam + 44);
}

// Un premio solo: recorte grande centrado y la lista debajo. Devuelve el hueco
// libre para el personaje, o null si no sobra sitio.
function heroe(ctx, g, hayPersonaje) {
  const cols = totalLineas(g) <= C.lineasUnaColumna ? 1 : 2;
  const fijo = C.chipAlto + C.huecoChipLista + C.listaPad * 2;
  const porCol = Math.max(1, Math.floor((AREA - C.imgMinHeroe - C.huecoHeroe - fijo) / C.interlinea));
  const lineas = lineasDe(g, porCol * cols);

  let filasCol = cols === 1 ? lineas.length : Math.ceil(lineas.length / 2);
  // Un importe no puede quedarse al pie de la primera columna sin sus nombres.
  if (cols === 2 && lineas[filasCol - 1]?.tipo === 'monto' && lineas.length - (filasCol - 1) <= porCol) {
    filasCol -= 1;
  }
  const columnas = cols === 1 ? [lineas] : [lineas.slice(0, filasCol), lineas.slice(filasCol)];
  const altoLista = lineas.length
    ? C.listaPad * 2 + Math.max(...columnas.map((c) => c.length)) * C.interlinea
    : 0;
  const altoBloque = C.chipAlto + (lineas.length ? C.huecoChipLista + altoLista : 0);

  const caja = limitar(AREA - C.huecoHeroe - altoBloque, C.imgMinHeroe, C.imgMaxHeroe);
  const imgH = altoProducto(g.imagen, ANCHO_UTIL, caja);
  const totalH = imgH + C.huecoHeroe + altoBloque;
  const sobra = AREA - totalH;
  const conPersonaje = hayPersonaje && sobra >= C.personajeMinHueco;
  const y0 = C.contenidoArriba + (conPersonaje ? 0 : Math.max(0, sobra / 2));

  const puesta = imagen(ctx, g, [C.margen, y0, ANCHO_UTIL, imgH]);

  const by = y0 + imgH + C.huecoHeroe;
  const chip = medirChip(ctx, g.chip, ANCHO_UTIL);
  const cx = (ANCHO - chip.w) / 2;
  dibujarChip(ctx, chip, cx, by);
  const pieza = { chip: { ...chip, x: cx, y: by, h: C.chipAlto }, puesta, lista: null };

  if (lineas.length) {
    const colW = cols === 1
      ? ANCHO_UTIL - C.listaPad * 2
      : (ANCHO_UTIL - C.listaPad * 2 - C.huecoColumnas) / 2;
    const tam = tamQueCabe(ctx, lineas, colW, cols === 1 ? C.listaFuente : C.listaFuenteColumnas);
    const anchoTexto = cols === 1
      ? Math.min(colW, anchoLineas(ctx, lineas, colW, tam))
      : ANCHO_UTIL - C.listaPad * 2;
    const boxW = anchoTexto + C.listaPad * 2;
    const boxX = (ANCHO - boxW) / 2;
    const boxY = by + C.chipAlto + C.huecoChipLista;
    cajaLista(ctx, boxX, boxY, boxW, altoLista);
    pieza.lista = [boxX, boxY, boxW, altoLista];
    columnas.forEach((col, c) => {
      pintarLineas(ctx, col, boxX + C.listaPad + c * (colW + C.huecoColumnas), boxY + C.listaPad, colW, tam);
    });
  }

  punteadas(ctx, [pieza]);

  if (!conPersonaje) return null;
  const arriba = y0 + totalH + 30;
  return { x: C.margen, y: arriba, w: ANCHO_UTIL, h: C.contenidoAbajo + 60 - arriba };
}

// Varios premios: una fila por premio, con el recorte alternando de lado.
function filas(ctx, grupos, hayPersonaje) {
  const n = grupos.length;
  const datos = grupos.map((g) => {
    const lineas = lineasDe(g, C.maxLineasFila);
    return { g, lineas, altoT: altoTexto(lineas.length) };
  });

  const huecos = C.separacionFilas * (n - 1);
  const base = datos.reduce((s, d) => s + Math.max(d.altoT, C.imgMinFila), 0);
  const extra = Math.max(0, AREA - huecos - base) / n;
  datos.forEach((d) => {
    const caja = Math.min(C.imgMaxFila, Math.max(d.altoT, C.imgMinFila) + extra);
    d.imgH = altoProducto(d.g.imagen, C.imgAncho, caja);
    d.alto = Math.max(d.altoT, d.imgH);
  });

  const totalH = datos.reduce((s, d) => s + d.alto, 0) + huecos;
  const sobra = AREA - totalH;
  const conPersonaje = hayPersonaje && sobra >= C.personajeMinHueco;
  let y = C.contenidoArriba + (conPersonaje ? 0 : Math.max(0, sobra / 2));

  const piezas = [];
  datos.forEach((d, i) => {
    const imagenIzquierda = i % 2 === 0;
    const ix = imagenIzquierda ? C.margen : C.margen + TEXTO_FILA + C.huecoFila;
    const tx = imagenIzquierda ? C.margen + C.imgAncho + C.huecoFila : C.margen;

    const puesta = imagen(ctx, d.g, [ix, y + (d.alto - d.imgH) / 2, C.imgAncho, d.imgH]);

    const ty = y + (d.alto - d.altoT) / 2;
    const chip = medirChip(ctx, d.g.chip, TEXTO_FILA);
    dibujarChip(ctx, chip, tx, ty);
    const pieza = { chip: { ...chip, x: tx, y: ty, h: C.chipAlto }, puesta, lista: null };
    piezas.push(pieza);

    if (d.lineas.length) {
      const colW = TEXTO_FILA - C.listaPad * 2;
      const tam = tamQueCabe(ctx, d.lineas, colW, C.listaFuente);
      const boxW = Math.min(colW, anchoLineas(ctx, d.lineas, colW, tam)) + C.listaPad * 2;
      const boxY = ty + C.chipAlto + C.huecoChipLista;
      cajaLista(ctx, tx, boxY, boxW, C.listaPad * 2 + d.lineas.length * C.interlinea);
      pieza.lista = [tx, boxY, boxW, C.listaPad * 2 + d.lineas.length * C.interlinea];
      pintarLineas(ctx, d.lineas, tx + C.listaPad, boxY + C.listaPad, colW, tam);
    }
    y += d.alto + C.separacionFilas;
  });

  punteadas(ctx, piezas);

  if (!conPersonaje) return null;
  const arriba = y - C.separacionFilas + 30;
  return { x: C.margen, y: arriba, w: ANCHO_UTIL, h: C.contenidoAbajo + 60 - arriba };
}

// Puntos de posición. Sin "Desliza": las imágenes se mandan sueltas por WhatsApp.
function pie(ctx, indice, total) {
  const y = ALTO - 96;
  if (total > 1) {
    const activo = 44;
    const punto = 14;
    const hueco = 14;
    const ancho = activo + (total - 1) * punto + (total - 1) * hueco;
    let x = (ANCHO - ancho) / 2;
    for (let i = 0; i < total; i += 1) {
      const w = i === indice ? activo : punto;
      ctx.fillStyle = i === indice ? ESTILO.lima : 'rgba(255, 255, 255, 0.28)';
      redondeado(ctx, x, y - punto / 2, w, punto, punto / 2);
      ctx.fill();
      x += w + hueco;
    }
  }
}

function dibujarPersonaje(ctx, img, { x, y, w, h }) {
  const alto = Math.min(h, C.personajeMaxAlto);
  contener(ctx, img, x, y + h - alto, w, alto, 'centro', 'abajo');
}

function imagen(ctx, g, [x, y, w, h]) {
  if (g.imagen && g.imagen.complete && g.imagen.naturalWidth) {
    ctx.save();
    // La sombra no la escala la transformación: va en píxeles reales.
    ctx.shadowColor = 'rgba(0, 0, 0, 0.55)';
    ctx.shadowBlur = 40 * CARRUSEL.escala;
    ctx.shadowOffsetY = 18 * CARRUSEL.escala;
    const puesta = contener(ctx, g.imagen, x, y, w, h, 'centro', 'centro');
    ctx.restore();
    return {
      ...puesta,
      contorno: g.imagen.contorno || null,
      mascara: g.imagen.mascara || null,
    };
  }
  ctx.save();
  ctx.setLineDash([16, 12]);
  ctx.lineWidth = 3;
  ctx.strokeStyle = 'rgba(201, 247, 63, 0.45)';
  ctx.fillStyle = 'rgba(201, 247, 63, 0.05)';
  redondeado(ctx, x, y, w, h, 24);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = 'rgba(201, 247, 63, 0.75)';
  ctx.font = fuente(600, 30);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('Falta la imagen', x + w / 2, y + h / 2);
  ctx.restore();
  return { x, y, w, h, contorno: null, mascara: null, producto: { x, y, w, h } };
}

// Punteada de cada chip a su recorte, como en el collage. Esquiva los chips,
// listas y productos de los demás premios, y su propia lista.
function punteadas(ctx, piezas) {
  const cajaChip = (p) => [p.chip.x, p.chip.y, p.chip.w, p.chip.h];
  const producto = (p) => [p.puesta.producto.x, p.puesta.producto.y, p.puesta.producto.w, p.puesta.producto.h];
  piezas.forEach((p) => {
    const ajenas = piezas.flatMap((o) => (o === p
      ? (o.lista ? [o.lista] : [])
      : [cajaChip(o), producto(o), ...(o.lista ? [o.lista] : [])]));
    curvaPunteada(ctx, p.chip, p.puesta, ajenas, cajaChip(p), C.punteada);
  });
}

// Alto que ocupa de verdad el producto en una caja de ese ancho: un recorte
// apaisado no llena el alto y reservárselo dejaría un hueco muerto.
function altoProducto(img, ancho, alto) {
  if (!img || !img.naturalWidth) return alto;
  const c = img.caja || { x0: 0, y0: 0, x1: 1, y1: 1 };
  const anchoUtil = (c.x1 - c.x0) * img.naturalWidth;
  const altoUtil = (c.y1 - c.y0) * img.naturalHeight;
  return Math.min(alto, (ancho / anchoUtil) * altoUtil);
}

function medirChip(ctx, texto, anchoMax) {
  const tam = ajustar(ctx, texto, anchoMax - C.chipPadX * 2, C.chipFuente, C.chipFuenteMin, (t) => fuente(700, t));
  ctx.font = fuente(700, tam);
  const recortado = recortar(ctx, texto, anchoMax - C.chipPadX * 2);
  return { texto: recortado, tam, w: Math.min(anchoMax, ctx.measureText(recortado).width + C.chipPadX * 2) };
}

function dibujarChip(ctx, chip, x, y) {
  ctx.fillStyle = ESTILO.lima;
  redondeado(ctx, x, y, chip.w, C.chipAlto, C.chipAlto / 2);
  ctx.fill();
  ctx.fillStyle = ESTILO.tinta;
  ctx.font = fuente(700, chip.tam);
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.fillText(chip.texto, x + C.chipPadX, y + C.chipAlto / 2 + 2);
}

function cajaLista(ctx, x, y, w, h) {
  ctx.fillStyle = ESTILO.cajaFondoCollage;
  ctx.strokeStyle = ESTILO.cajaBordeCollage;
  ctx.lineWidth = 2;
  redondeado(ctx, x, y, w, h, C.listaRadio);
  ctx.fill();
  ctx.stroke();
}

const fuenteLinea = (l, tam = C.listaFuente) => fuenteGanadores(l.tipo === 'monto' ? 700 : 400, tam);

// Tamaño de letra al que caben todas las líneas sin cortar ningún nombre. Baja
// como mucho hasta `minLista`; más allá se recorta con puntos suspensivos.
function tamQueCabe(ctx, lineas, ancho, tamMax) {
  let tam = tamMax;
  while (tam > C.minLista) {
    const sobra = lineas.some((l) => {
      ctx.font = fuenteLinea(l, tam);
      return ctx.measureText(l.texto).width + (l.tipo === 'monto' ? 0 : C.sangria) > ancho;
    });
    if (!sobra) break;
    tam -= 1;
  }
  return tam;
}

function anchoLineas(ctx, lineas, anchoMax, tam) {
  let max = 0;
  for (const l of lineas) {
    ctx.font = fuenteLinea(l, tam);
    const sangria = l.tipo === 'monto' ? 0 : C.sangria;
    max = Math.max(max, ctx.measureText(l.texto).width + sangria);
  }
  return Math.min(anchoMax, Math.ceil(max));
}

function pintarLineas(ctx, lineas, x, y, ancho, tam) {
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  lineas.forEach((l, i) => {
    const ly = y + C.interlinea * (i + 0.5);
    ctx.font = fuenteLinea(l, tam);
    if (l.tipo === 'monto') {
      ctx.fillStyle = ESTILO.lima;
      ctx.fillText(recortar(ctx, l.texto, ancho), x, ly);
      return;
    }
    if (l.tipo === 'nombre') {
      ctx.fillStyle = ESTILO.lima;
      ctx.fillText('•', x, ly);
      ctx.fillStyle = ESTILO.cajaTexto;
    } else {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    }
    ctx.fillText(recortar(ctx, l.texto, ancho - C.sangria), x + C.sangria, ly);
  });
}

function ajustar(ctx, texto, anchoMax, tamMax, tamMin, fuenteDe) {
  let tam = tamMax;
  while (tam > tamMin) {
    ctx.font = fuenteDe(tam);
    if (ctx.measureText(texto).width <= anchoMax) break;
    tam -= 2;
  }
  return tam;
}
