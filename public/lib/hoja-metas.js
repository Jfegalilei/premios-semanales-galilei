// Hoja de metas del reporte para clientes: le pide a la compañía que nos mande
// las metas de sus sedes (ticket promedio, ventas…), que aún no ha enviado. No
// lleva datos: sale solo si se activa a mano en «Qué mostrar». Gali preocupado
// en la cabecera y, bajo el pedido, las medallas de los niveles que las metas
// desbloquean. Mismas piezas que la hoja de conocimiento.

import { CARRUSEL, pintarFondo, cabecera } from './carrusel.js';
import { contener } from './lienzo.js';
import { ESTILO } from './plantillas.js';
import { MESES_LARGOS } from './periodos.js';
import {
  H, tarjeta, etiqueta, altoEtiqueta, envolver, fT, fG,
} from './hoja-conocimiento.js';

const ANCHO = CARRUSEL.ancho;
const ALTO = CARRUSEL.alto;

const M = { titulo: 64, texto: 32, lineas: 4, medallas: { max: 620, pad: 50, pie: 28 } };

const TEXTO = {
  eyebrow: 'Metas de tus sedes',
  titulo: 'Aún no hemos recibido las metas de tus sedes',
  texto: 'Por favor envíalas a tu contacto de Galilei. Con ellas cada sede puede subir de nivel según sus '
    + 'resultados y desbloquear mejores premios.',
};

// «Metas de\nSeptiembre»: el mes del reporte (la hoja solo sale en el mensual).
export function tituloMetas(mes) {
  const nombre = MESES_LARGOS[Number(mes.slice(5, 7)) - 1];
  return `Metas de\n${nombre.charAt(0).toUpperCase()}${nombre.slice(1)}`;
}

/**
 * @param {HTMLCanvasElement} canvas
 * @param {object} op  cabecera (kicker, logoCliente, logo, etiqueta, titulo,
 *   personaje, fondo) y `medallas`, la imagen de los tres niveles.
 */
export function dibujarMetas(canvas, op) {
  return dibujarAviso(canvas, { ...op, texto: TEXTO });
}

// La misma hoja con otro texto: la de premios entregados cuando en el periodo
// no se reclamó ninguno. Ahí las medallas se estiran hasta el pie, con una nota
// al pie, para que la hoja no quede con un hueco.
export const SIN_PREMIOS = {
  eyebrow: 'Premios del periodo',
  titulo: 'En este periodo no se reclamaron premios',
  texto: 'Los premios que tu equipo reclame en el catálogo de Galilei aparecerán aquí, con la inversión '
    + 'y las sedes que los ganaron.',
  medallas: 'Cada nivel desbloquea mejores premios del catálogo',
};

/**
 * @param {object} op  como `dibujarMetas`, más `texto` ({ eyebrow, titulo,
 *   texto, medallas? }): con `medallas`, la tarjeta de las medallas llega hasta
 *   el pie y lleva ese texto debajo de la imagen.
 */
export function dibujarAviso(canvas, op) {
  const { escala } = CARRUSEL;
  canvas.width = ANCHO * escala;
  canvas.height = ALTO * escala;
  const ctx = canvas.getContext('2d');
  ctx.save();
  ctx.setTransform(escala, 0, 0, escala, 0, 0);
  ctx.imageSmoothingQuality = 'high';

  const { texto } = op;
  const caja = repartir(ctx, texto);
  const medallas = op.medallas ? cajaMedallas(caja, op.medallas, Boolean(texto.medallas)) : null;
  pintarFondo(ctx, op.fondo);
  cabecera(ctx, { ...op, tarjetas: [caja, medallas].filter(Boolean) });
  tarjetaAviso(ctx, caja, texto);
  if (medallas) {
    const m = M.medallas;
    tarjeta(ctx, medallas);
    const pie = texto.medallas ? M.texto * 1.4 + m.pie : 0;
    contener(ctx, op.medallas, medallas.x + m.pad, medallas.y + m.pad,
      medallas.w - m.pad * 2, medallas.h - m.pad * 2 - pie);
    if (pie) {
      ctx.fillStyle = ESTILO.neutral07;
      ctx.font = fG(500, M.texto);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText(texto.medallas, medallas.x + medallas.w / 2, medallas.y + medallas.h - m.pad);
    }
  }

  ctx.restore();
  return canvas;
}

// Una tarjeta arriba, del alto de su texto.
function repartir(ctx, t) {
  const ancho = H.w - H.pad * 2;
  ctx.save();
  ctx.font = fT(700, M.titulo);
  const titulo = envolver(ctx, t.titulo, ancho, M.lineas);
  ctx.font = fG(500, M.texto);
  const texto = envolver(ctx, t.texto, ancho, M.lineas);
  ctx.restore();
  const h = 44 + altoEtiqueta() + 24 + titulo.length * M.titulo * 1.12 + 22 + texto.length * M.texto * 1.4 + 44;
  return { x: H.x, y: H.arriba, w: H.w, h, radio: H.radio, titulo, texto };
}

// Bajo el pedido, las medallas a todo lo ancho, del alto que pida la imagen
// (sin pasarse del pie). `hastaElPie`: llega siempre hasta el pie.
function cajaMedallas(arriba, img, hastaElPie = false) {
  const y = arriba.y + arriba.h + H.hueco;
  const ancho = H.w - M.medallas.pad * 2;
  const h = hastaElPie
    ? H.pie - y
    : Math.min(M.medallas.max, H.pie - y, ancho * (img.height / img.width) + M.medallas.pad * 2);
  return { x: H.x, y, w: H.w, h, radio: H.radio };
}

// El pedido: un título grande en blanco y cómo resolverlo en gris.
function tarjetaAviso(ctx, c, t) {
  tarjeta(ctx, c);
  const x = c.x + H.pad;
  etiqueta(ctx, t.eyebrow, x, c.y + 44);
  let y = c.y + 44 + altoEtiqueta() + 24;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillStyle = ESTILO.blanco;
  ctx.font = fT(700, M.titulo);
  for (const linea of c.titulo) {
    ctx.fillText(linea, x, y);
    y += M.titulo * 1.12;
  }
  y += 22;
  ctx.fillStyle = ESTILO.neutral07;
  ctx.font = fG(500, M.texto);
  for (const linea of c.texto) {
    ctx.fillText(linea, x, y + M.texto * 0.2);
    y += M.texto * 1.4;
  }
}
