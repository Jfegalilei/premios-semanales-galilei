// Hojas de lotería del reporte para clientes.
//   `dibujarLoteria`: una lotería sola (compañías con solo training): la última
//     rifa (premio, ganador y botón al live, que en el PDF es un enlace), cuántos
//     jugadores van clasificados este mes y cómo se clasifica.
//   `dibujarLoterias`: varias en una hoja (compañías con reseñas): la de Galilei
//     y la de Reseñas, cada una en su tarjeta, con un solo botón al live.
//
// La rifa no está en la base de datos: llega de Firestore (`rifa`), escrita a
// mano en la página.

import { CARRUSEL, pintarFondo, cabecera } from './carrusel.js';
import { redondeado, recortar } from './lienzo.js';
import { ESTILO } from './plantillas.js';
import { MESES_LARGOS } from './periodos.js';
import { H, tarjeta, etiqueta, altoEtiqueta, entero, fT, fG } from './hoja-conocimiento.js';

const ANCHO = CARRUSEL.ancho;
const ALTO = CARRUSEL.alto;

const L = {
  clasificados: { h: 200, conPie: 262 },   // con pie: el desglose de Auteco
  pasos: { circulo: 26, fuente: 30, interlinea: 36, abajo: 34 },
  nota: 52,           // franja de la nota del pie
  foto: { radio: 28, min: 220 },
  premio: { fuente: 64, min: 40 },
  boton: { alto: 76, fuente: 30 },
  // Requisitos en la hoja combinada: ✓ verde y texto blanco en negrilla.
  vineta: { radio: 13, fuente: 26, interlinea: 32, sangria: 40, hueco: 8 },
};


// Dónde arrancan las tarjetas. Sin Gali, un título que cabe en una línea deja
// libre la franja de la segunda: las tarjetas suben hasta justo debajo de él.
// Con dos líneas (un título largo) se quedan donde las pone el carrusel.
const ARRIBA_TITULO_CORTO = 360;
function arribaDe(ctx, titulo) {
  ctx.save();
  ctx.font = fT(700, 100);
  const cabe = !String(titulo).includes('\n') && ctx.measureText(titulo).width <= ANCHO - 200;
  ctx.restore();
  return cabe ? ARRIBA_TITULO_CORTO : H.arriba;
}

const nombreMes = (iso) => MESES_LARGOS[Number(iso.slice(5, 7)) - 1];
const conMayuscula = (t) => t.charAt(0).toUpperCase() + t.slice(1);

/**
 * @param {HTMLCanvasElement} canvas
 * @param {object} op  cabecera (kicker, logoCliente, logo, titulo, personaje,
 *   fondo), `pasos` y `nota` (los de cada lotería), `copa` (el trofeo, si no
 *   hay foto del premio), `datos` (lo que devuelve `loteria()`), `rifa` (de Firestore)
 *   y `foto` (la foto del premio, ya cargada).
 * @returns {{x, y, w, h, url} | null} la zona del botón del live, si hay link.
 */
export function dibujarLoteria(canvas, op) {
  const { escala } = CARRUSEL;
  canvas.width = ANCHO * escala;
  canvas.height = ALTO * escala;
  const ctx = canvas.getContext('2d');
  ctx.save();
  ctx.setTransform(escala, 0, 0, escala, 0, 0);
  ctx.imageSmoothingQuality = 'high';

  const d = op.datos;
  const mes = nombreMes(d.mes);
  const pasos = op.pasos || [];
  const cajas = repartir(altoPasos(ctx, pasos), d.pie ? L.clasificados.conPie : L.clasificados.h, arribaDe(ctx, op.titulo));

  pintarFondo(ctx, op.fondo);
  // El chip lleva el mes de la lotería, no las fechas del periodo.
  cabecera(ctx, { ...op, etiqueta: `${conMayuscula(mes)} ${d.mes.slice(0, 4)}`, tarjetas: Object.values(cajas) });

  const enlace = tarjetaRifa(ctx, cajas.rifa, op.rifa || {}, op.foto, op.copa);
  tarjetaClasificados(ctx, cajas.clasificados, d, mes);
  // Los requisitos llegan de `reporte.js` (cambian entre Galilei y Auteco); si
  // cambian, cambiar también la query que cuenta los clasificados.
  tarjetaPasos(ctx, cajas.pasos, pasos);
  if (op.nota) nota(ctx, op.nota);

  ctx.restore();
  return enlace;
}

/**
 * Varias loterías en una sola hoja (las compañías con reseñas: la de Galilei y
 * la de Reseñas). Una tarjeta por lotería con su foto, premio y ganador; las
 * que llevan clasificados (`soloPremio` en falso) suman cuántos van y el
 * requisito. El live se comparte: un solo botón abajo (uno por lotería si
 * tienen links distintos).
 *
 * @param {object} op  cabecera (kicker, logoCliente, logo, titulo, personaje,
 *   fondo), `nota`, `copa` y `loterias`: [{ nombre, rifa, foto, datos, pasos,
 *   soloPremio }], en el orden en que salen.
 * @returns {{x, y, w, h, url}[]} las zonas de los botones del live.
 */
export function dibujarLoterias(canvas, op) {
  const { escala } = CARRUSEL;
  canvas.width = ANCHO * escala;
  canvas.height = ALTO * escala;
  const ctx = canvas.getContext('2d');
  ctx.save();
  ctx.setTransform(escala, 0, 0, escala, 0, 0);
  ctx.imageSmoothingQuality = 'high';

  const { mes } = op.loterias[0].datos;
  const lives = [...new Set(op.loterias.map((l) => (l.rifa.live || '').trim()).filter(Boolean))];
  const b = L.boton;
  const pie = H.pie - L.nota;
  const abajoTarjetas = lives.length ? pie - b.alto - H.hueco * 2 : pie;
  const arriba = arribaDe(ctx, op.titulo);
  const alto = (abajoTarjetas - arriba - H.hueco * (op.loterias.length - 1)) / op.loterias.length;
  const cajas = op.loterias.map((_, i) => ({
    x: H.x, y: arriba + i * (alto + H.hueco), w: H.w, h: alto, radio: H.radio,
  }));

  pintarFondo(ctx, op.fondo);
  cabecera(ctx, { ...op, etiqueta: `${conMayuscula(nombreMes(mes))} ${mes.slice(0, 4)}`, tarjetas: cajas });
  op.loterias.forEach((l, i) => tarjetaLoteria(ctx, cajas[i], l, op.copa));

  // Botones del live, en fila bajo las tarjetas.
  const enlaces = [];
  let x = H.x + H.pad;
  for (const url of lives) {
    const de = op.loterias.find((l) => (l.rifa.live || '').trim() === url);
    const texto = lives.length > 1 ? `Live de la ${de.nombre}` : 'Ver el live de las rifas';
    enlaces.push(botonLive(ctx, x, pie - b.alto - H.hueco, texto, url));
    x += enlaces[enlaces.length - 1].w + 16;
  }
  if (op.nota) nota(ctx, op.nota);

  ctx.restore();
  return enlaces;
}

// Una lotería dentro de la hoja combinada: foto a la izquierda y, a la derecha,
// premio, ganador y —si lleva— clasificados del mes y requisito.
function tarjetaLoteria(ctx, c, l, copa) {
  const { rifa, datos } = l;
  tarjeta(ctx, c);
  const x = c.x + H.pad;
  const derecha = c.x + c.w - H.pad;
  const mesRifa = rifa.mes ? ` · rifa de ${rifa.mes.trim().toLowerCase()}` : '';
  etiqueta(ctx, `${l.nombre}${mesRifa}`, x, c.y + 34);

  const arriba = c.y + 34 + altoEtiqueta() + 20;
  const abajo = c.y + c.h - 34;
  const anchoFoto = Math.round((c.w - H.pad * 2) * 0.42);
  if (l.foto) {
    fotoEntera(ctx, l.foto, x, arriba, anchoFoto, abajo - arriba, L.foto.radio);
  } else {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.06)';
    redondeado(ctx, x, arriba, anchoFoto, abajo - arriba, L.foto.radio);
    ctx.fill();
    if (copa && copa.complete && copa.naturalWidth) fotoDentro(ctx, copa, x + 24, arriba + 24, anchoFoto - 48, abajo - arriba - 48);
  }

  const x2 = x + anchoFoto + 32;
  const ancho = derecha - x2;
  let y = arriba;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';

  // Premio en hasta dos líneas.
  ctx.fillStyle = ESTILO.blanco;
  ctx.font = fT(700, 50);
  const premio = (rifa.premio || '').trim() || 'Premio por anunciar';
  for (const linea of hastaLineas(ctx, premio, ancho, 2)) {
    ctx.fillText(linea, x2, y);
    y += 56;
  }

  // Quién ganó y de qué empresa, en dos líneas; la empresa en verde.
  if (rifa.ganador) {
    y += 8;
    ctx.font = fG(500, 26);
    ctx.fillStyle = ESTILO.neutral07;
    ctx.fillText('Ganó', x2, y);
    y += 32;
    ctx.font = fG(700, 30);
    ctx.fillStyle = ESTILO.blanco;
    ctx.fillText(recortar(ctx, rifa.ganador.trim(), ancho), x2, y);
    y += 38;
    if (rifa.empresa) {
      ctx.font = fG(600, 26);
      ctx.fillStyle = ESTILO.g500;
      ctx.fillText(recortar(ctx, rifa.empresa.trim(), ancho), x2, y);
      y += 34;
    }
  }
  if (l.soloPremio) {
    if (!l.avisoTraining) return;
    // Que no parezca que su equipo puede ganarla: es de las empresas con training.
    ctx.font = fG(500, 24);
    const aviso = hastaLineas(ctx, 'Esta lotería es solo para los equipos de empresas con Galilei Training.', ancho, 3);
    let ya = Math.max(y + 16, abajo - 18 - aviso.length * 30);
    raya(ctx, x2, ya, derecha, ya);
    ya += 18;
    ctx.fillStyle = ESTILO.neutral07;
    ctx.textBaseline = 'top';
    for (const linea of aviso) {
      ctx.fillText(linea, x2, ya);
      ya += 30;
    }
    return;
  }

  // Clasificados del mes y, debajo, los requisitos en lista con ✓ verde,
  // pegados al pie de la tarjeta.
  const v = L.vineta;
  ctx.font = fT(600, v.fuente);
  const requisitos = (l.pasos || []).map((paso) => hastaLineas(ctx, paso, ancho - v.sangria, 2));
  const altoLista = requisitos.reduce((t, lineas) => t + lineas.length * v.interlinea + v.hueco, -v.hueco);
  const altoBloque = 2 + 18 + altoEtiqueta(1, 0.8) + 10 + 64 + 16 + altoEtiqueta(1, 0.8) + 10 + altoLista;
  let yb = Math.max(y + 16, abajo - altoBloque);
  raya(ctx, x2, yb, derecha, yb);
  yb += 18;
  // Sin el mes: ya va en la cabecera de la tarjeta («Rifa de septiembre») y con
  // él no cabía en la columna.
  etiqueta(ctx, `Tus empleados clasificados${datos.enCurso ? ' (hasta hoy)' : ''}`, x2, yb, 0.8);
  yb += altoEtiqueta(1, 0.8) + 10;
  ctx.textBaseline = 'top';
  ctx.fillStyle = ESTILO.blanco;
  ctx.font = fT(700, 64);
  const cifra = entero(datos.clasificados);
  ctx.fillText(cifra, x2, yb);
  const anchoCifra = ctx.measureText(cifra).width;
  ctx.fillStyle = ESTILO.neutral07;
  ctx.font = fT(600, 32);
  const [una, varias] = datos.unidad || ['empleado', 'empleados'];
  ctx.fillText(datos.clasificados === 1 ? una : varias, x2 + anchoCifra + 12, yb + 26);
  yb += 64 + 16;
  etiqueta(ctx, 'Para clasificar', x2, yb, 0.8);
  yb += altoEtiqueta(1, 0.8) + 10;
  for (const lineas of requisitos) {
    vineta(ctx, x2 + v.radio, yb + v.interlinea / 2, v.radio);
    ctx.fillStyle = ESTILO.blanco;
    ctx.font = fT(600, v.fuente);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    lineas.forEach((linea, i) => ctx.fillText(linea, x2 + v.sangria, yb + v.interlinea * (i + 0.5)));
    yb += lineas.length * v.interlinea + v.hueco;
  }
}

// ✓ en un círculo verde: marca cada requisito para clasificar.
function vineta(ctx, cx, cy, r) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = ESTILO.g500;
  ctx.fill();
  ctx.strokeStyle = ESTILO.tintaChip;
  ctx.lineWidth = r * 0.28;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(cx - r * 0.45, cy + r * 0.02);
  ctx.lineTo(cx - r * 0.1, cy + r * 0.38);
  ctx.lineTo(cx + r * 0.48, cy - r * 0.32);
  ctx.stroke();
  ctx.restore();
}

// Texto partido en hasta `max` líneas; la última se recorta si sobra.
function hastaLineas(ctx, texto, ancho, max) {
  const lineas = partir(ctx, texto, ancho);
  if (lineas.length <= max) return lineas.map((l) => recortar(ctx, l, ancho));
  const cortadas = lineas.slice(0, max);
  cortadas[max - 1] = recortar(ctx, `${cortadas[max - 1]} ${lineas.slice(max).join(' ')}`, ancho);
  return cortadas;
}

function raya(ctx, x1, y1, x2, y2) {
  ctx.save();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.14)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  ctx.restore();
}

// Botón verde con el triángulo de «play». Devuelve su zona para el enlace.
function botonLive(ctx, x, y, texto, url) {
  const b = L.boton;
  ctx.font = fT(700, b.fuente);
  const w = ctx.measureText(texto).width + 64 + 44;
  ctx.fillStyle = ESTILO.g500;
  redondeado(ctx, x, y, w, b.alto, b.alto / 2);
  ctx.fill();
  triangulo(ctx, x + 40, y + b.alto / 2, 12, ESTILO.tintaChip);
  ctx.fillStyle = ESTILO.tintaChip;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(texto, x + 68, y + b.alto / 2 + 1);
  return { x, y, w, h: b.alto, url };
}

// La rifa se queda con todo el alto que dejan las otras dos y la nota.
function repartir(hPasos, hClasificados, arriba) {
  const { x, w, hueco } = H;
  const pie = H.pie - L.nota;
  const pasos = { x, y: pie - hPasos, w, h: hPasos, radio: H.radio };
  const clasificados = { x, y: pasos.y - hueco - hClasificados, w, h: hClasificados, radio: H.radio };
  const rifa = { x, y: arriba, w, h: clasificados.y - hueco - arriba, radio: H.radio };
  return { rifa, clasificados, pasos };
}

// Foto del premio entera, sin recortar: recortada para llenar la caja se perdía
// medio premio (una moto de lado no cabe en una caja casi cuadrada). Lo que
// sobra a los lados se rellena con la misma foto desenfocada y oscurecida, para
// que no queden franjas vacías.
function fotoEntera(ctx, img, x, y, w, h, radio) {
  const cubre = Math.max(w / img.naturalWidth, h / img.naturalHeight);
  ctx.save();
  redondeado(ctx, x, y, w, h, radio);
  ctx.clip();
  ctx.filter = 'blur(28px) brightness(0.45)';
  const cw = img.naturalWidth * cubre * 1.1;
  const ch = img.naturalHeight * cubre * 1.1;
  ctx.drawImage(img, x + (w - cw) / 2, y + (h - ch) / 2, cw, ch);
  ctx.filter = 'none';
  fotoDentro(ctx, img, x, y, w, h);
  ctx.restore();
}

// Imagen entera dentro de la caja («contain»), centrada.
function fotoDentro(ctx, img, x, y, w, h) {
  const escala = Math.min(w / img.naturalWidth, h / img.naturalHeight);
  const iw = img.naturalWidth * escala;
  const ih = img.naturalHeight * escala;
  ctx.drawImage(img, x + (w - iw) / 2, y + (h - ih) / 2, iw, ih);
}

function triangulo(ctx, cx, cy, r, color) {
  ctx.beginPath();
  ctx.moveTo(cx - r * 0.5, cy - r);
  ctx.lineTo(cx + r, cy);
  ctx.lineTo(cx - r * 0.5, cy + r);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
}

// Premio de la última rifa con su foto (o el trofeo si no hay), quién ganó y el
// botón al live. Devuelve la zona del botón para volverla enlace en el PDF.
function tarjetaRifa(ctx, c, rifa, foto, trofeo) {
  const p = L.premio;
  const b = L.boton;
  tarjeta(ctx, c);
  const x = c.x + H.pad;
  const ancho = c.w - H.pad * 2;
  const titulo = rifa.mes ? `La rifa de ${rifa.mes.trim().toLowerCase()}` : 'La última rifa';
  etiqueta(ctx, titulo, x, c.y + 34);

  // De abajo hacia arriba: botón, ganador, premio; la foto toma el resto.
  const abajo = c.y + c.h - H.pad;
  const yBoton = rifa.live ? abajo - b.alto : abajo;
  const yGanador = yBoton - (rifa.live ? 28 : 0) - 36;
  const yPremio = yGanador - 24;
  const arribaFoto = c.y + 34 + altoEtiqueta() + 20;
  const altoFoto = yPremio - p.fuente * 0.9 - 26 - arribaFoto;

  if (altoFoto >= L.foto.min) {
    if (foto) {
      fotoEntera(ctx, foto, x, arribaFoto, ancho, altoFoto, L.foto.radio);
    } else {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.06)';
      redondeado(ctx, x, arribaFoto, ancho, altoFoto, L.foto.radio);
      ctx.fill();
      if (trofeo && trofeo.complete && trofeo.naturalWidth) {
        fotoDentro(ctx, trofeo, x, arribaFoto + 30, ancho, altoFoto - 60);
      }
    }
  }

  // Premio: tan grande como quepa en una línea.
  const premio = (rifa.premio || '').trim() || 'Premio por anunciar';
  let tam = p.fuente;
  ctx.font = fT(700, tam);
  while (tam > p.min && ctx.measureText(premio).width > ancho) {
    tam -= 2;
    ctx.font = fT(700, tam);
  }
  ctx.fillStyle = ESTILO.blanco;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(recortar(ctx, premio, ancho), x, yPremio);

  // «Ganó Nombre · Empresa»: el nombre en blanco, la empresa en verde.
  if (rifa.ganador) {
    ctx.font = fG(500, 30);
    ctx.fillStyle = ESTILO.neutral07;
    ctx.fillText('Ganó ', x, yGanador + 30);
    let cx = x + ctx.measureText('Ganó ').width;
    ctx.font = fG(700, 30);
    ctx.fillStyle = ESTILO.blanco;
    const nombre = rifa.ganador.trim();
    ctx.fillText(nombre, cx, yGanador + 30);
    cx += ctx.measureText(nombre).width;
    if (rifa.empresa) {
      ctx.font = fG(600, 30);
      ctx.fillStyle = ESTILO.g500;
      ctx.fillText(recortar(ctx, ` · ${rifa.empresa.trim()}`, x + ancho - cx), cx, yGanador + 30);
    }
  }

  if (!rifa.live) return null;
  return botonLive(ctx, x, yBoton, 'Ver el live de la rifa', rifa.live.trim());
}

// Cuántos de la compañía van clasificados en el mes y, si lo trae (Auteco),
// el desglose al pie. Sin más texto: entre menos, mejor.
function tarjetaClasificados(ctx, c, d, mes) {
  tarjeta(ctx, c);
  const x = c.x + H.pad;
  etiqueta(ctx, `Tus empleados clasificados en ${mes}${d.enCurso ? ' (hasta hoy)' : ''}`, x, c.y + 34);

  const base = c.y + 34 + altoEtiqueta() + 14 + 96 * 0.78;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = ESTILO.blanco;
  ctx.font = fT(700, 96);
  const cifra = entero(d.clasificados);
  ctx.fillText(cifra, x, base);
  const anchoCifra = ctx.measureText(cifra).width;
  ctx.fillStyle = ESTILO.neutral07;
  ctx.font = fT(600, 44);
  const [una, varias] = d.unidad || ['empleado', 'empleados'];
  ctx.fillText(d.clasificados === 1 ? una : varias, x + anchoCifra + 16, base);

  if (d.pie) {
    ctx.textBaseline = 'bottom';
    ctx.font = fG(500, 26);
    ctx.fillStyle = ESTILO.neutral07;
    ctx.fillText(d.pie, x, c.y + c.h - 30);
  }
}

// Alto de la tarjeta de pasos: sale del paso que más líneas ocupa en su columna.
function altoPasos(ctx, pasos) {
  const t = L.pasos;
  ctx.save();
  ctx.font = fT(600, t.fuente);
  const columna = (H.w - H.pad * 2) / Math.max(1, pasos.length);
  const lineas = Math.max(1, ...pasos.map((p) => partir(ctx, p, columna - 24).length));
  ctx.restore();
  return 34 + altoEtiqueta() + 22 + t.circulo * 2 + 16 + lineas * t.interlinea + t.abajo - (t.interlinea - t.fuente);
}

// Cómo se clasifica, en pasos numerados.
function tarjetaPasos(ctx, c, pasos) {
  const r = L.pasos.circulo;
  tarjeta(ctx, c);
  const x = c.x + H.pad;
  etiqueta(ctx, 'Para clasificar', x, c.y + 34);
  const columna = (c.w - H.pad * 2) / pasos.length;
  const cy = c.y + 34 + altoEtiqueta() + 22 + r;
  pasos.forEach((paso, i) => {
    const px = x + columna * i;
    if (!paso) return;
    // Todos son requisitos del mismo peso: el mismo ✓ verde, sin orden.
    vineta(ctx, px + r, cy, r);

    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillStyle = ESTILO.blanco;
    ctx.font = fT(600, L.pasos.fuente);
    let y = cy + r + 16;
    for (const linea of partir(ctx, paso, columna - 24)) {
      ctx.fillText(linea, px, y);
      y += L.pasos.interlinea;
    }
  });
}

function partir(ctx, texto, ancho) {
  const lineas = [];
  let actual = '';
  for (const palabra of texto.split(' ')) {
    const prueba = actual ? `${actual} ${palabra}` : palabra;
    if (actual && ctx.measureText(prueba).width > ancho) {
      lineas.push(actual);
      actual = palabra;
    } else {
      actual = prueba;
    }
  }
  if (actual) lineas.push(actual);
  return lineas;
}

// Que quede claro de quién es la lotería.
function nota(ctx, texto) {
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = fG(500, 24);
  ctx.fillStyle = ESTILO.neutral07;
  ctx.fillText(texto, ANCHO / 2, H.pie - L.nota / 2 + 8);
  ctx.restore();
}
