// Hoja de reviews del reporte para clientes, solo para las compañías con ficha
// de Google activa: la calificación general en Google y, de las
// reviews, solo lo que llegó por Galilei (clic de la tarjeta o del juego):
// cuántas y su promedio, sus estrellas y los tres empleados que más reviews de 5
// estrellas consiguieron. Nada que deje ver cuáles no fueron por Galilei. Mismas
// piezas que la hoja de conocimiento.

import { CARRUSEL, pintarFondo, cabecera, cajaOscura } from './carrusel.js';
import { redondeado, recortar } from './lienzo.js';
import { ESTILO } from './plantillas.js';
import { MESES_LARGOS } from './periodos.js';
import { H, tarjeta, etiqueta, altoEtiqueta, entero, fT, fG } from './hoja-conocimiento.js';

const ANCHO = CARRUSEL.ancho;
const ALTO = CARRUSEL.alto;

const R = {
  calificacion: { h: 250, cifra: 96, estrella: 30 },
  galilei: { h: 196, cifra: 96, estrella: 26 },
  barras: { fila: 50, alto: 18, estrella: 12, etiqueta: 70, dato: 150, fuente: 24 },
};

const decimal = (n) => n.toLocaleString('es-CO', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const porcentaje = (parte, total) => (total ? `${Math.round((parte / total) * 100)}%` : '—');

/**
 * @param {HTMLCanvasElement} canvas
 * @param {object} op  cabecera (kicker, logoCliente, logo, etiqueta, titulo,
 *   personaje, fondo) y `datos`, lo que devuelve `reviews()` de `reporte-datos.js`.
 */
export function dibujarReviews(canvas, op) {
  const { escala } = CARRUSEL;
  canvas.width = ANCHO * escala;
  canvas.height = ALTO * escala;
  const ctx = canvas.getContext('2d');
  ctx.save();
  ctx.setTransform(escala, 0, 0, escala, 0, 0);
  ctx.imageSmoothingQuality = 'high';

  const d = op.datos;
  const cajas = repartir();

  pintarFondo(ctx, op.fondo);
  cabecera(ctx, { ...op, tarjetas: Object.values(cajas) });

  tarjetaCalificacion(ctx, cajas.calificacion, d);
  tarjetaGalilei(ctx, cajas.galilei, d);
  tarjetaEstrellas(ctx, cajas.estrellas, d);
  cajaTop(ctx, cajas.top, d.top, d.porGali > 0);

  ctx.restore();
  return canvas;
}

// Alturas fijas arriba; el Top 3 se queda con lo que sobra hasta el pie.
function repartir() {
  const { x, w, hueco } = H;
  const b = R.barras;
  let y = H.arriba;
  const caja = (h) => {
    const c = { x, y, w, h, radio: H.radio };
    y += h + hueco;
    return c;
  };
  const calificacion = caja(R.calificacion.h);
  const galilei = caja(R.galilei.h);
  const estrellas = caja(34 + altoEtiqueta() + 22 + b.fila * 5 + 18);
  const top = { x, y, w, h: H.pie - y, radio: 22 };
  return { calificacion, galilei, estrellas, top };
}

// Estrella de cinco puntas, rellena.
function estrella(ctx, cx, cy, r, color) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const radio = i % 2 ? r * 0.45 : r;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const px = cx + Math.cos(a) * radio;
    const py = cy + Math.sin(a) * radio;
    if (i) ctx.lineTo(px, py);
    else ctx.moveTo(px, py);
  }
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
}

// Calificación en Google al cierre del periodo, con cuántas calificaciones la
// sostienen.
function tarjetaCalificacion(ctx, c, d) {
  const t = R.calificacion;
  tarjeta(ctx, c);
  const x = c.x + H.pad;
  etiqueta(ctx, 'Calificación en Google', x, c.y + 34);

  const base = c.y + 34 + altoEtiqueta() + 14 + t.cifra * 0.78;
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';
  ctx.fillStyle = ESTILO.blanco;
  ctx.font = fT(700, t.cifra);
  const valor = d.calificacion == null ? '—' : decimal(d.calificacion);
  ctx.fillText(valor, x, base);
  const ancho = ctx.measureText(valor).width;
  if (d.calificacion != null) {
    estrella(ctx, x + ancho + 14 + t.estrella, base - t.cifra * 0.36, t.estrella, ESTILO.g500);
    ctx.fillStyle = ESTILO.neutral07;
    ctx.font = fT(600, 56);
    ctx.fillText('/5', x + ancho + 24 + t.estrella * 2, base);
  }

  ctx.fillStyle = ESTILO.neutral07;
  ctx.font = fG(500, 26);
  ctx.textBaseline = 'bottom';
  const pie = d.totalGoogle ? `${entero(d.totalGoogle)} calificaciones en total` : 'Sin datos de calificación en el periodo';
  ctx.fillText(pie, x, c.y + c.h - 30);
}

// Cuántas reviews llegaron por Galilei en el periodo (creadas en esos días) y,
// a la derecha, su promedio de estrellas.
function tarjetaGalilei(ctx, c, d) {
  const t = R.galilei;
  tarjeta(ctx, c);
  const x = c.x + H.pad;
  const derecha = c.x + c.w - H.pad;
  // Corto y claro: de qué periodo son (las fechas exactas van en el chip).
  const cuando = d.periodo.tipo === 'mes'
    ? `en ${MESES_LARGOS[Number(d.periodo.inicio.slice(5, 7)) - 1]}`
    : 'esta semana';
  etiqueta(ctx, `Reseñas gracias a Galilei ${cuando}`, x, c.y + 34);

  const base = c.y + 34 + altoEtiqueta() + 14 + t.cifra * 0.78;
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';
  ctx.fillStyle = ESTILO.blanco;
  ctx.font = fT(700, t.cifra);
  const cifra = entero(d.porGali);
  ctx.fillText(cifra, x, base);
  const anchoCifra = ctx.measureText(cifra).width;
  ctx.fillStyle = ESTILO.neutral07;
  ctx.font = fT(600, 44);
  ctx.fillText(d.porGali === 1 ? 'reseña' : 'reseñas', x + anchoCifra + 16, base);

  // Promedio de estrellas de esas reviews, alineado con la cifra.
  if (d.promedioGali != null) {
    ctx.textAlign = 'right';
    ctx.fillStyle = ESTILO.blanco;
    ctx.font = fT(700, 72);
    const valor = decimal(d.promedioGali);
    const xEstrella = derecha - t.estrella;
    estrella(ctx, xEstrella, base - 72 * 0.36, t.estrella, ESTILO.g500);
    ctx.fillText(valor, xEstrella - t.estrella - 12, base);
  }

}

// Las reviews por Galilei del periodo por estrellas, de 5 a 1: barras
// horizontales que miden la parte de cada una sobre el total, con la cantidad y
// el porcentaje al final.
function tarjetaEstrellas(ctx, c, d) {
  const b = R.barras;
  tarjeta(ctx, c);
  const x = c.x + H.pad;
  etiqueta(ctx, 'Reseñas por estrellas', x, c.y + 34);

  const total = d.estrellas.reduce((s, e) => s + e.reviews, 0);
  const xBarra = x + b.etiqueta;
  const anchoBarra = c.w - H.pad * 2 - b.etiqueta - b.dato;
  let cy = c.y + 34 + altoEtiqueta() + 22 + b.fila / 2;

  for (const e of d.estrellas) {
    ctx.fillStyle = ESTILO.blanco;
    ctx.font = fT(700, 30);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(e.estrellas), x, cy + 1);
    estrella(ctx, x + 34, cy, b.estrella, ESTILO.g500);

    ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
    redondeado(ctx, xBarra, cy - b.alto / 2, anchoBarra, b.alto, b.alto / 2);
    ctx.fill();
    if (e.reviews) {
      ctx.fillStyle = ESTILO.g500;
      redondeado(ctx, xBarra, cy - b.alto / 2, Math.max(b.alto, anchoBarra * (e.reviews / total)), b.alto, b.alto / 2);
      ctx.fill();
    }

    ctx.textAlign = 'right';
    ctx.fillStyle = ESTILO.blanco;
    ctx.font = fG(700, b.fuente);
    const pct = porcentaje(e.reviews, total);
    ctx.fillText(pct, c.x + c.w - H.pad, cy + 1);
    const anchoPct = ctx.measureText('100%').width;
    ctx.fillStyle = ESTILO.neutral07;
    ctx.font = fG(500, b.fuente);
    ctx.fillText(entero(e.reviews), c.x + c.w - H.pad - anchoPct - 16, cy + 1);
    cy += b.fila;
  }
}

// Los tres empleados que más reviews de 5 estrellas consiguieron con su tarjeta
// o el juego.
function cajaTop(ctx, c, top, huboReviews) {
  const t = H.top;
  cajaOscura(ctx, c.x, c.y, c.w, c.h);
  const x = c.x + H.pad;
  etiqueta(ctx, 'Top 3 empleados con más reseñas 5★', x, c.y + t.padY);

  if (!top.length) {
    ctx.fillStyle = ESTILO.neutral07;
    ctx.font = fG(500, 28);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(huboReviews ? 'Ninguna reseña de 5 estrellas llegó por Galilei en este periodo' : 'Ninguna reseña llegó por Galilei en este periodo',
      x, c.y + t.padY + t.titulo * 1.4 + 20);
    return;
  }

  const arriba = c.y + t.padY + t.titulo * 1.4;
  const fila = Math.min(t.fila, (c.y + c.h - t.padY - arriba) / 3);
  top.forEach((e, i) => {
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
    ctx.fillStyle = ESTILO.neutral07;
    ctx.font = fG(500, t.dato);
    const dato = `${entero(e.reviews)} ${e.reviews === 1 ? 'reseña' : 'reseñas'}`;
    const anchoDato = ctx.measureText(dato).width;
    ctx.fillText(dato, derecha, cy + 1);

    ctx.textAlign = 'left';
    ctx.fillStyle = ESTILO.blanco;
    ctx.font = fT(700, t.nombre);
    const xNombre = x + r * 2 + 22;
    ctx.fillText(recortar(ctx, e.nombre, derecha - anchoDato - 24 - xNombre), xNombre, cy + 1);
  });
}
