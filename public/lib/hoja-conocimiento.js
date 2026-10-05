// Página 1 del reporte para clientes: el conocimiento, en el mismo formato y con
// las mismas piezas que la de premios (`carrusel.js`): escenario de fondo, Gali en
// la cabecera, chip verde con las fechas, tarjetas oscuras y la caja oscura de
// los ganadores, aquí con el Top 3.
//
// Geometría en unidades de 1080 x 1792, como el carrusel; el lienzo sale a
// `CARRUSEL.escala`.

import { CARRUSEL, pintarFondo, cabecera, cajaOscura } from './carrusel.js';
import { redondeado, recortar } from './lienzo.js';
import { ESTILO } from './plantillas.js';

const ANCHO = CARRUSEL.ancho;
const ALTO = CARRUSEL.alto;

const H = {
  x: 35,
  w: 1010,
  hueco: 12,
  arriba: 463,   // donde arrancan las tarjetas del carrusel
  pie: 1736,     // donde termina la caja de ganadores más baja
  pad: 40,
  radio: 40,
  etiqueta: 27,
  eyebrow: { espacio: 3, interlinea: 1.3 },   // los títulos de cada dato, en verde: guían la lectura
  valor: 96,
  activos: { h: 228, barra: 14 },
  par: { valor: 84, abajo: 28 },   // el alto sale del título (una o dos líneas)
  pill: { fuente: 26, padX: 20, alto: 50, hueco: 10 },
  pregunta: { fuente: 36, interlinea: 1.2, lineas: 3 },
  respuesta: { fuente: 30, interlinea: 1.3, lineas: 2, pad: 16, etiqueta: 20 },
  top: { titulo: 44, nombre: 38, dato: 26, medalla: 30, fila: 80, padY: 30 },
};

const fT = (peso, tam) => `${peso} ${tam}px ${ESTILO.fuenteTitulo}`;
const fG = (peso, tam) => `${peso} ${tam}px ${ESTILO.fuenteGanadores}`;
const entero = (n) => Math.round(n).toLocaleString('es-CO');
const TRIO = ['Horas capacitadas', 'Juegos', 'Precisión'];
const horas = (n) => (n < 10 ? n.toLocaleString('es-CO', { maximumFractionDigits: 1 }) : entero(n));

// Tarjetas oscuras casi opacas con un filo blanco tenue, como las de
// galileilearning.com: el cristal claro se perdía sobre los escenarios y el
// texto no se leía.
function tarjeta(ctx, c) {
  ctx.save();
  redondeado(ctx, c.x, c.y, c.w, c.h, c.radio);
  ctx.fillStyle = 'rgba(17, 20, 25, 0.86)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.14)';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();
}

/**
 * @param {HTMLCanvasElement} canvas
 * @param {object} op  cabecera (kicker, logoCliente, logo, etiqueta, titulo,
 *   subtitulo, personaje, fondo, trofeo) y `datos`, lo que devuelve
 *   `conocimiento()` de `reporte-datos.js`.
 */
export function dibujarConocimiento(canvas, op) {
  const { escala } = CARRUSEL;
  canvas.width = ANCHO * escala;
  canvas.height = ALTO * escala;
  const ctx = canvas.getContext('2d');
  ctx.save();
  ctx.setTransform(escala, 0, 0, escala, 0, 0);
  ctx.imageSmoothingQuality = 'high';

  const d = op.datos;
  const cajas = repartir(ctx, d);

  pintarFondo(ctx, op.fondo);
  cabecera(ctx, { ...op, tarjetas: Object.values(cajas).filter(Boolean) });

  tarjetaActivos(ctx, cajas.activos, d);
  tarjetaValor(ctx, cajas.horas, TRIO[0], d.juegos ? horas(d.horas) : '—');
  tarjetaValor(ctx, cajas.juegos, TRIO[1], d.juegos ? entero(d.juegos) : '—');
  tarjetaValor(ctx, cajas.precision, TRIO[2], d.precision == null ? '—' : `${Math.round(d.precision)}%`);
  if (cajas.temas) tarjetaTemas(ctx, cajas.temas, d.experiencias);
  if (cajas.pregunta) tarjetaPregunta(ctx, cajas.pregunta, d.masFallada);
  cajaTop(ctx, cajas.top, d.top);

  ctx.restore();
  return canvas;
}

/* ---------- reparto vertical ---------- */

// Las de arriba tienen alto fijo; «Qué se capacita» y la pregunta crecen con su
// texto, y el Top 3 se queda con lo que sobra hasta el pie. Si no le alcanza para
// sus tres filas, la pregunta cede líneas.
function repartir(ctx, d) {
  const { x, w, hueco } = H;
  const tercio = (w - hueco * 2) / 3;
  let y = H.arriba;
  const cajas = {};

  cajas.activos = { x, y, w, h: H.activos.h, radio: H.radio };
  y += H.activos.h + hueco;
  const titulos = titulosDelTrio(ctx, tercio - H.pad * 2);
  const lineas = Math.max(...titulos.map((t) => t.length));
  const hPar = 34 + altoEtiqueta(lineas) + 14 + H.par.valor * 0.75 + H.par.abajo;
  ['horas', 'juegos', 'precision'].forEach((k, i) => {
    cajas[k] = { x: x + (tercio + hueco) * i, y, w: tercio, h: hPar, radio: H.radio, titulo: titulos[i] };
  });
  y += hPar + hueco;

  if (d.experiencias.length) {
    const filas = filasDePills(ctx, d.experiencias, w - H.pad * 2);
    const h = H.pad + altoEtiqueta() + 22 + filas.length * (H.pill.alto + H.pill.hueco) - H.pill.hueco + H.pad - 14;
    cajas.temas = { x, y, w, h, radio: H.radio, filas };
    y += h + hueco;
  }

  const minTop = H.top.padY * 2 + H.top.titulo * 1.4 + 3 * H.top.fila;
  if (d.masFallada) {
    for (let lineas = H.pregunta.lineas; lineas >= 1; lineas -= 1) {
      const medida = medirPregunta(ctx, d.masFallada, w - H.pad * 2, lineas);
      if (H.pie - (y + medida.h + hueco) >= minTop || lineas === 1) {
        cajas.pregunta = { x, y, w, h: medida.h, radio: H.radio, medida };
        y += medida.h + hueco;
        break;
      }
    }
  }

  cajas.top = { x, y, w, h: Math.max(H.pie - y, minTop * 0.6), radio: 22 };
  return cajas;
}

/* ---------- tarjetas ---------- */

// Alto de un título de `lineas` líneas.
const altoEtiqueta = (lineas = 1) => lineas * H.etiqueta * H.eyebrow.interlinea;

// Los títulos van como los «eyebrows» de galileilearning.com («NUESTRA
// METODOLOGÍA» sobre cada sección): mayúsculas, espaciadas, en negrita y en
// verde. La forma (mayúsculas con aire) los separa de todo lo demás, y el verde
// queda casi solo para ellos: el resto de la hoja va en blanco y gris, como en
// la web. Probado antes: texto verde normal (se mezclaba con cifras y pastillas
// verdes), blanco (se confundía con las cifras) y chips verdes.
function fuenteEtiqueta(ctx) {
  ctx.font = fG(700, H.etiqueta);
  ctx.letterSpacing = `${H.eyebrow.espacio}px`;
}

function etiqueta(ctx, texto, x, y) {
  const lineas = (Array.isArray(texto) ? texto : [texto]).map((l) => l.toUpperCase());
  ctx.save();
  fuenteEtiqueta(ctx);
  ctx.fillStyle = ESTILO.g500;
  ctx.textBaseline = 'top';
  ctx.textAlign = 'left';
  lineas.forEach((l, i) => ctx.fillText(l, x, y + i * H.etiqueta * H.eyebrow.interlinea));
  ctx.restore();
}

// Los títulos de la fila de tres, partidos para que quepan sin achicarse
// («Horas capacitadas» baja a dos líneas). Las cifras van alineadas abajo.
function titulosDelTrio(ctx, ancho) {
  ctx.save();
  fuenteEtiqueta(ctx);
  const titulos = TRIO.map((t) => envolver(ctx, t.toUpperCase(), ancho, 2));
  ctx.restore();
  return titulos;
}

function tarjetaActivos(ctx, c, d) {
  tarjeta(ctx, c);
  const x = c.x + H.pad;
  etiqueta(ctx, 'Jugadores activos', x, c.y + 34);

  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = ESTILO.blanco;
  ctx.font = fT(700, H.valor);
  const base = c.y + 34 + altoEtiqueta() + 14 + H.valor * 0.78;
  const activos = entero(d.activos);
  ctx.fillText(activos, x, base);
  if (d.totalJugadores) {
    const ancho = ctx.measureText(activos).width;
    ctx.fillStyle = ESTILO.neutral07;
    ctx.font = fT(600, 56);
    ctx.fillText(`/${entero(d.totalJugadores)}`, x + ancho + 6, base);

    const parte = Math.min(1, d.activos / d.totalJugadores);
    // Porcentaje a la derecha, alineado con la cifra.
    ctx.textAlign = 'right';
    ctx.fillStyle = ESTILO.blanco;
    ctx.font = fT(700, 72);
    ctx.fillText(`${Math.round(parte * 100)}%`, c.x + c.w - H.pad, base);
    ctx.textAlign = 'left';

    const by = c.y + c.h - 34 - H.activos.barra;
    const bw = c.w - H.pad * 2;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.14)';
    redondeado(ctx, x, by, bw, H.activos.barra, H.activos.barra / 2);
    ctx.fill();
    if (parte > 0) {
      ctx.fillStyle = ESTILO.g500;
      redondeado(ctx, x, by, Math.max(H.activos.barra, bw * parte), H.activos.barra, H.activos.barra / 2);
      ctx.fill();
    }
  }
}

function tarjetaValor(ctx, c, titulo, valor) {
  tarjeta(ctx, c);
  etiqueta(ctx, c.titulo || titulo, c.x + H.pad, c.y + 34);
  ctx.fillStyle = ESTILO.blanco;
  // Tres por fila: la cifra baja de tamaño antes que salirse.
  let tam = 84;
  ctx.font = fT(700, tam);
  while (tam > 48 && ctx.measureText(valor).width > c.w - H.pad * 2) {
    tam -= 4;
    ctx.font = fT(700, tam);
  }
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';
  ctx.fillText(valor, c.x + H.pad, c.y + c.h - H.par.abajo);
}

function filasDePills(ctx, textos, ancho) {
  const p = H.pill;
  ctx.save();
  ctx.font = fG(600, p.fuente);
  const filas = [[]];
  let usado = 0;
  for (const t of textos) {
    const texto = recortar(ctx, t, ancho - p.padX * 2);
    const w = ctx.measureText(texto).width + p.padX * 2;
    if (usado && usado + p.hueco + w > ancho) {
      filas.push([]);
      usado = 0;
    }
    filas[filas.length - 1].push({ texto, w });
    usado += (usado ? p.hueco : 0) + w;
  }
  ctx.restore();
  return filas;
}

function tarjetaTemas(ctx, c) {
  const p = H.pill;
  tarjeta(ctx, c);
  etiqueta(ctx, 'Qué se capacita', c.x + H.pad, c.y + 34);
  let y = c.y + 34 + altoEtiqueta() + 22;
  ctx.font = fG(600, p.fuente);
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  for (const fila of c.filas) {
    let x = c.x + H.pad;
    for (const pill of fila) {
      redondeado(ctx, x, y, pill.w, p.alto, p.alto / 2);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = ESTILO.blanco;
      ctx.fillText(pill.texto, x + p.padX, y + p.alto / 2 + 1);
      x += pill.w + p.hueco;
    }
    y += p.alto + p.hueco;
  }
}

function envolver(ctx, texto, ancho, maxLineas) {
  const palabras = String(texto).split(/\s+/).filter(Boolean);
  const lineas = [];
  let actual = '';
  for (const p of palabras) {
    const prueba = actual ? `${actual} ${p}` : p;
    if (ctx.measureText(prueba).width <= ancho || !actual) {
      actual = prueba;
    } else {
      lineas.push(actual);
      actual = p;
    }
  }
  if (actual) lineas.push(actual);
  if (lineas.length > maxLineas) {
    const cortadas = lineas.slice(0, maxLineas);
    cortadas[maxLineas - 1] = recortar(ctx, `${cortadas[maxLineas - 1]} ${lineas.slice(maxLineas).join(' ')}`, ancho);
    return cortadas;
  }
  return lineas.map((l) => recortar(ctx, l, ancho));
}

function medirPregunta(ctx, m, ancho, lineasMax) {
  const q = H.pregunta;
  const r = H.respuesta;
  ctx.save();
  ctx.font = fT(500, q.fuente);
  const pregunta = envolver(ctx, m.pregunta, ancho, lineasMax);
  ctx.font = fT(600, r.fuente);
  const respuesta = m.respuesta ? envolver(ctx, m.respuesta, ancho - r.pad * 2, r.lineas) : [];
  ctx.restore();
  const altoRespuesta = respuesta.length
    ? r.pad * 2 + r.etiqueta + 8 + respuesta.length * r.fuente * r.interlinea : 0;
  const h = 34 + altoEtiqueta() + 16 + pregunta.length * q.fuente * q.interlinea
    + (altoRespuesta ? 16 + altoRespuesta : 0) + 34;
  return { pregunta, respuesta, altoRespuesta, h };
}

function tarjetaPregunta(ctx, c, m) {
  const q = H.pregunta;
  const r = H.respuesta;
  const { pregunta, respuesta, altoRespuesta } = c.medida;
  tarjeta(ctx, c);
  const x = c.x + H.pad;
  etiqueta(ctx, 'Pregunta más fallada', x, c.y + 34);
  ctx.fillStyle = ESTILO.neutral07;
  ctx.font = fG(500, 24);
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  ctx.fillText(`Fallada ${entero(m.fallos)} ${m.fallos === 1 ? 'vez' : 'veces'}`, c.x + c.w - H.pad, c.y + 34 + altoEtiqueta() / 2);
  ctx.textBaseline = 'top';
  ctx.textAlign = 'left';

  let y = c.y + 34 + altoEtiqueta() + 16;
  ctx.fillStyle = ESTILO.blanco;
  ctx.font = fT(500, q.fuente);
  ctx.textBaseline = 'top';
  for (const linea of pregunta) {
    ctx.fillText(linea, x, y + (q.fuente * (q.interlinea - 1)) / 2);
    y += q.fuente * q.interlinea;
  }

  if (altoRespuesta) {
    y += 16;
    const w = c.w - H.pad * 2;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.07)';
    redondeado(ctx, x, y, w, altoRespuesta, 20);
    ctx.fill();
    ctx.save();
    ctx.fillStyle = ESTILO.g500;
    ctx.font = fG(700, r.etiqueta);
    ctx.letterSpacing = '2px';
    ctx.fillText('RESPUESTA CORRECTA', x + r.pad, y + r.pad);
    ctx.restore();
    let ry = y + r.pad + r.etiqueta + 8;
    ctx.fillStyle = ESTILO.blanco;
    ctx.font = fT(600, r.fuente);
    for (const linea of respuesta) {
      ctx.fillText(linea, x + r.pad, ry + (r.fuente * (r.interlinea - 1)) / 2);
      ry += r.fuente * r.interlinea;
    }
  }
}

function cajaTop(ctx, c, top) {
  const t = H.top;
  cajaOscura(ctx, c.x, c.y, c.w, c.h);
  const x = c.x + H.pad;
  etiqueta(ctx, 'Top 3 jugadores', x, c.y + t.padY);

  if (!top.length) {
    ctx.fillStyle = ESTILO.neutral07;
    ctx.font = fG(500, 28);
    ctx.fillText('Sin partidas en este periodo', x, c.y + t.padY + t.titulo * 1.4 + 20);
    return;
  }

  // Las filas se reparten en el alto que quede, sin pasar de `fila`.
  const arriba = c.y + t.padY + t.titulo * 1.4;
  const fila = Math.min(t.fila, (c.y + c.h - t.padY - arriba) / 3);
  top.forEach((j, i) => {
    const cy = arriba + fila * (i + 0.5);
    const r = t.medalla;
    ctx.beginPath();
    ctx.arc(x + r, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = i === 0 ? ESTILO.g500 : 'rgba(255, 255, 255, 0.16)';
    ctx.fill();
    ctx.fillStyle = i === 0 ? ESTILO.tintaChip : ESTILO.blanco;
    ctx.font = fT(700, 30);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(i + 1), x + r, cy + 1);

    const derecha = c.x + c.w - H.pad;
    ctx.textAlign = 'right';
    ctx.font = fG(500, t.dato);
    const dato = `${entero(j.puntajeMax)} pts máx. · ${entero(j.juegos)} ${j.juegos === 1 ? 'juego' : 'juegos'}`;
    const anchoDato = ctx.measureText(dato).width;
    ctx.fillStyle = ESTILO.neutral07;
    ctx.fillText(dato, derecha, cy + 1);

    ctx.textAlign = 'left';
    ctx.fillStyle = ESTILO.blanco;
    ctx.font = fT(700, t.nombre);
    const xNombre = x + r * 2 + 22;
    ctx.fillText(recortar(ctx, j.nombre, derecha - anchoDato - 24 - xNombre), xNombre, cy + 1);
  });
}
