// Página 1 del reporte para clientes: el conocimiento, en el mismo formato y con
// las mismas piezas que la de premios (`carrusel.js`): escenario de fondo, Gali en
// la cabecera, chip verde con las fechas, tarjetas oscuras y la caja oscura de
// los ganadores, aquí con el Top 3 de sedes (las `location` de la base: Maximo,
// por ejemplo, tiene sede Medellín y sede Cartagena).
//
// Geometría en unidades de 1080 x 1792, como el carrusel; el lienzo sale a
// `CARRUSEL.escala`.

import { CARRUSEL, pintarFondo, cabecera, cajaOscura } from './carrusel.js';
import { redondeado, recortar } from './lienzo.js';
import { ESTILO } from './plantillas.js';
import { aFecha } from './periodos.js';

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
  // «Qué se capacita», pie de la tarjeta de horas y preguntas: título y
  // pastillas a esta escala, para que no compita con las cifras de arriba.
  temas: { escala: 0.8, arriba: 26, hueco: 18, abajo: 30 },
  // Gráfico de preguntas por día: línea verde continua con un velo verde que
  // baja hasta la línea base, y el día debajo. Su alto se ajusta a lo que deje
  // el Top 3.
  grafico: { min: 240, max: 380, cifra: 22, dia: 20, linea: 5, punto: 7 },
  top: { titulo: 44, nombre: 38, dato: 26, porcentaje: 40, medalla: 30, fila: 80, padY: 30 },
};

const fT = (peso, tam) => `${peso} ${tam}px ${ESTILO.fuenteTitulo}`;
const fG = (peso, tam) => `${peso} ${tam}px ${ESTILO.fuenteGanadores}`;
const entero = (n) => Math.round(n).toLocaleString('es-CO');
const PAR = ['Horas capacitadas', 'Preguntas respondidas'];
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
  tarjetaCapacitacion(ctx, cajas.capacitacion, [
    d.juegos ? horas(d.horas) : '—',
    d.juegos ? entero(d.preguntas) : '—',
  ]);
  tarjetaGrafico(ctx, cajas.grafico, d.porDia);
  cajaTop(ctx, cajas.top, d.locations, d.juegos > 0);

  ctx.restore();
  return canvas;
}

/* ---------- reparto vertical ---------- */

// Jugadores activos tiene alto fijo; la tarjeta de horas y preguntas crece con
// las filas de «Qué se capacita», que van en su pie; el gráfico toma lo que
// pueda sin quitarle al Top 3 sus tres filas, y el Top 3 lo que sobra hasta el pie.
function repartir(ctx, d) {
  const { x, w, hueco } = H;
  let y = H.arriba;
  const cajas = {};

  cajas.activos = { x, y, w, h: H.activos.h, radio: H.radio };
  y += H.activos.h + hueco;
  // Dos columnas separadas por una raya: cada una con su `pad` a cada lado.
  const columna = (w - H.pad * 4) / 2;
  const titulos = titulosDelPar(ctx, columna);
  const lineas = Math.max(...titulos.map((t) => t.length));
  const hPar = 34 + altoEtiqueta(lineas) + 14 + H.par.valor * 0.75 + H.par.abajo;
  let h = hPar;
  let filas = null;
  if (d.experiencias.length) {
    const t = H.temas;
    const pill = H.pill.alto * t.escala;
    const huecoPill = H.pill.hueco * t.escala;
    filas = filasDePills(ctx, d.experiencias, w - H.pad * 2, t.escala);
    h += t.arriba + altoEtiqueta(1, t.escala) + t.hueco + filas.length * (pill + huecoPill) - huecoPill + t.abajo;
  }
  cajas.capacitacion = { x, y, w, h, radio: H.radio, titulos, columna, hPar, filas };
  y += h + hueco;

  const minTop = H.top.padY * 2 + H.top.titulo * 1.4 + 3 * H.top.fila;
  const g = H.grafico;
  const hGrafico = Math.max(g.min, Math.min(g.max, H.pie - y - hueco - minTop));
  cajas.grafico = { x, y, w, h: hGrafico, radio: H.radio };
  y += hGrafico + hueco;

  cajas.top = { x, y, w, h: Math.max(H.pie - y, minTop * 0.6), radio: 22 };
  return cajas;
}

/* ---------- tarjetas ---------- */

// Alto de un título de `lineas` líneas.
const altoEtiqueta = (lineas = 1, escala = 1) => lineas * H.etiqueta * escala * H.eyebrow.interlinea;

// Los títulos van como los «eyebrows» de galileilearning.com («NUESTRA
// METODOLOGÍA» sobre cada sección): mayúsculas, espaciadas, en negrita y en
// verde. La forma (mayúsculas con aire) los separa de todo lo demás, y el verde
// queda casi solo para ellos: el resto de la hoja va en blanco y gris, como en
// la web. Probado antes: texto verde normal (se mezclaba con cifras y pastillas
// verdes), blanco (se confundía con las cifras) y chips verdes.
function fuenteEtiqueta(ctx, escala = 1) {
  ctx.font = fG(700, H.etiqueta * escala);
  ctx.letterSpacing = `${H.eyebrow.espacio * escala}px`;
}

function etiqueta(ctx, texto, x, y, escala = 1) {
  const lineas = (Array.isArray(texto) ? texto : [texto]).map((l) => l.toUpperCase());
  ctx.save();
  fuenteEtiqueta(ctx, escala);
  ctx.fillStyle = ESTILO.g500;
  ctx.textBaseline = 'top';
  ctx.textAlign = 'left';
  lineas.forEach((l, i) => ctx.fillText(l, x, y + i * H.etiqueta * escala * H.eyebrow.interlinea));
  ctx.restore();
}

// Los títulos de la fila de dos, partidos para que quepan sin achicarse si no
// caben en una línea. Las cifras van alineadas abajo.
function titulosDelPar(ctx, ancho) {
  ctx.save();
  fuenteEtiqueta(ctx);
  const titulos = PAR.map((t) => envolver(ctx, t.toUpperCase(), ancho, 2));
  ctx.restore();
  return titulos;
}

function tarjetaActivos(ctx, c, d) {
  tarjeta(ctx, c);
  const x = c.x + H.pad;
  etiqueta(ctx, 'Jugadores activos', x, c.y + 34);

  // Qué cuenta como activo, a la derecha de la tarjeta, en gris pequeño.
  ctx.save();
  ctx.font = fG(500, 22);
  ctx.fillStyle = ESTILO.neutral07;
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  ctx.fillText('Jugaron al menos una vez', c.x + c.w - H.pad, c.y + 34 + altoEtiqueta() / 2 - 2);
  ctx.restore();

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

// Horas capacitadas y preguntas respondidas lado a lado, separadas por una raya
// vertical, y «Qué se capacita» de pie, bajo una raya horizontal.
function tarjetaCapacitacion(ctx, c, valores) {
  tarjeta(ctx, c);
  ctx.save();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.14)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(c.x + c.w / 2, c.y + 34);
  ctx.lineTo(c.x + c.w / 2, c.y + c.hPar - H.par.abajo);
  if (c.filas) {
    ctx.moveTo(c.x + H.pad, c.y + c.hPar);
    ctx.lineTo(c.x + c.w - H.pad, c.y + c.hPar);
  }
  ctx.stroke();
  ctx.restore();

  valores.forEach((valor, i) => {
    const x = c.x + H.pad + i * (c.columna + H.pad * 2);
    etiqueta(ctx, c.titulos[i], x, c.y + 34);
    ctx.fillStyle = ESTILO.blanco;
    // La cifra baja de tamaño antes que salirse de su columna.
    let tam = H.par.valor;
    ctx.font = fT(700, tam);
    while (tam > 48 && ctx.measureText(valor).width > c.columna) {
      tam -= 4;
      ctx.font = fT(700, tam);
    }
    ctx.textBaseline = 'alphabetic';
    ctx.textAlign = 'left';
    ctx.fillText(valor, x, c.y + c.hPar - H.par.abajo);
  });

  if (c.filas) tarjetaTemas(ctx, c, c.y + c.hPar + H.temas.arriba);
}

function filasDePills(ctx, textos, ancho, escala = 1) {
  const p = pillA(escala);
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

const pillA = (escala) => ({
  fuente: H.pill.fuente * escala,
  padX: H.pill.padX * escala,
  alto: H.pill.alto * escala,
  hueco: H.pill.hueco * escala,
});

// «Qué se capacita» desde `arriba`, dentro de la tarjeta `c`.
function tarjetaTemas(ctx, c, arriba) {
  const { escala } = H.temas;
  const p = pillA(escala);
  etiqueta(ctx, 'Qué se capacita', c.x + H.pad, arriba, escala);
  let y = arriba + altoEtiqueta(1, escala) + H.temas.hueco;
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

const DIAS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

// Preguntas respondidas por día, en una línea continua. En una semana cada día
// lleva su punto, su cifra encima y su nombre debajo; en un mes, con ~30 días,
// solo el más alto lleva punto y cifra, y el día se marca cada cinco.
function tarjetaGrafico(ctx, c, serie) {
  const g = H.grafico;
  tarjeta(ctx, c);
  const x0 = c.x + H.pad;
  const ancho = c.w - H.pad * 2;
  etiqueta(ctx, 'Preguntas respondidas por día', x0, c.y + 34);

  const semana = serie.length <= 7;
  const max = Math.max(0, ...serie.map((d) => d.preguntas));
  const base = c.y + c.h - 30 - g.dia * 1.2;
  const techo = c.y + 34 + altoEtiqueta() + 24 + g.cifra * 1.3;
  const paso = ancho / serie.length;
  const puntos = serie.map((d, i) => ({
    ...d,
    x: x0 + paso * (i + 0.5),
    y: base - (max ? (d.preguntas / max) * (base - techo) : 0),
  }));

  ctx.save();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x0, base);
  ctx.lineTo(x0 + ancho, base);
  ctx.stroke();

  if (puntos.length) {
    const trazo = () => {
      ctx.beginPath();
      puntos.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
    };
    // Velo bajo la línea, de verde tenue a nada en la base.
    trazo();
    ctx.lineTo(puntos[puntos.length - 1].x, base);
    ctx.lineTo(puntos[0].x, base);
    ctx.closePath();
    const velo = ctx.createLinearGradient(0, techo, 0, base);
    velo.addColorStop(0, 'rgba(179, 241, 49, 0.32)');
    velo.addColorStop(1, 'rgba(179, 241, 49, 0)');
    ctx.fillStyle = velo;
    ctx.fill();

    trazo();
    ctx.strokeStyle = ESTILO.g500;
    ctx.lineWidth = g.linea;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.stroke();
  }

  const iMax = puntos.findIndex((p) => p.preguntas === max);
  puntos.forEach((p, i) => {
    if (semana || (i === iMax && max > 0)) {
      // Punto con un aro del color de la tarjeta, para que se separe de la línea.
      ctx.beginPath();
      ctx.arc(p.x, p.y, g.punto + 3, 0, Math.PI * 2);
      ctx.fillStyle = 'rgb(17, 20, 25)';
      ctx.fill();
      ctx.beginPath();
      ctx.arc(p.x, p.y, g.punto, 0, Math.PI * 2);
      ctx.fillStyle = ESTILO.g500;
      ctx.fill();

      ctx.fillStyle = ESTILO.blanco;
      ctx.font = fG(700, g.cifra);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText(entero(p.preguntas), p.x, p.y - g.punto - 10);
    }
    const dia = Number(p.fecha.slice(8, 10));
    if (semana || dia === 1 || dia % 5 === 0) {
      ctx.fillStyle = ESTILO.neutral07;
      ctx.font = fG(500, g.dia);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      const nombre = semana ? `${DIAS[aFecha(p.fecha).getUTCDay()]} ${dia}` : String(dia);
      ctx.fillText(nombre, p.x, base + 10);
    }
  });
  ctx.restore();
}

// Las tres sedes con mayor porcentaje de sus jugadores con partidas: el
// porcentaje grande a la derecha y, a su lado, cuántos de cuántos.
function cajaTop(ctx, c, top, huboPartidas) {
  const t = H.top;
  cajaOscura(ctx, c.x, c.y, c.w, c.h);
  const x = c.x + H.pad;
  etiqueta(ctx, 'Top 3 sedes más activas', x, c.y + t.padY);

  if (!top.length) {
    ctx.fillStyle = ESTILO.neutral07;
    ctx.font = fG(500, 28);
    ctx.textBaseline = 'top';
    ctx.fillText(huboPartidas ? 'Sin sedes asignadas' : 'Sin partidas en este periodo', x, c.y + t.padY + t.titulo * 1.4 + 20);
    return;
  }

  // Las filas se reparten en el alto que quede, sin pasar de `fila`.
  const arriba = c.y + t.padY + t.titulo * 1.4;
  const fila = Math.min(t.fila, (c.y + c.h - t.padY - arriba) / 3);
  top.forEach((l, i) => {
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
    ctx.fillStyle = ESTILO.blanco;
    ctx.font = fT(700, t.porcentaje);
    const porcentaje = `${Math.round(l.parte * 100)}%`;
    const anchoPorcentaje = ctx.measureText(porcentaje).width;
    ctx.fillText(porcentaje, derecha, cy + 1);

    ctx.font = fG(500, t.dato);
    const dato = `${entero(l.activos)}/${entero(l.total)} jugadores`;
    const xDato = derecha - anchoPorcentaje - 20;
    const anchoDato = ctx.measureText(dato).width;
    ctx.fillStyle = ESTILO.neutral07;
    ctx.fillText(dato, xDato, cy + 1);

    ctx.textAlign = 'left';
    ctx.fillStyle = ESTILO.blanco;
    ctx.font = fT(700, t.nombre);
    const xNombre = x + r * 2 + 22;
    ctx.fillText(recortar(ctx, l.nombre, xDato - anchoDato - 24 - xNombre), xNombre, cy + 1);
  });
}

// Piezas que reusan las hojas de reviews y de metas.
export { H, tarjeta, etiqueta, altoEtiqueta, entero, envolver, fT, fG };
