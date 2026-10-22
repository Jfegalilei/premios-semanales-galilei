// Hojas del reporte de presupuesto (`presupuesto.html`), con las mismas piezas
// que el reporte para clientes: escenario, cabecera con el chip verde, tarjetas
// oscuras y la caja oscura. Geometría en unidades de 1080 x 1792.
//
//   resumen  presupuesto actual, lo reclamado desde el inicio, los Especiales y
//            lo más reclamado
//   listas   reclamados (por premio, con quién), catálogo actual (por nivel) y
//            Especiales: una tarjeta por hoja que se parte en varias hojas si no cabe

import { CARRUSEL, pintarFondo, cabecera, cajaOscura } from './carrusel.js';
import { recortar, redondeado } from './lienzo.js';
import { ESTILO } from './plantillas.js';
import { H, tarjeta, etiqueta, altoEtiqueta, entero, envolver, fT, fG } from './hoja-conocimiento.js';
import { dinero, dineros, mesCorto, fechaCorta } from './presupuesto-datos.js';

const ANCHO = CARRUSEL.ancho;
const ALTO = CARRUSEL.alto;

const R = {
  // `nota`: el alto de la nota de la GaliLotería, al pie de la tarjeta.
  presupuesto: { h: 262, cifra: 104, nota: 92 },
  par: { h: 236, cifra: 64 },
  top: { fila: 72, nombre: 32, dato: 26 },
  // Listas: alto de cada renglón.
  lista: { pad: 40, seccion: 62, huecoSeccion: 26, fila: 58, filaNota: 92, linea: 38, titulo: 31, dato: 27, nota: 23, nombres: 23 },
};

function preparar(canvas) {
  const { escala } = CARRUSEL;
  canvas.width = ANCHO * escala;
  canvas.height = ALTO * escala;
  const ctx = canvas.getContext('2d');
  ctx.save();
  ctx.setTransform(escala, 0, 0, escala, 0, 0);
  ctx.imageSmoothingQuality = 'high';
  return ctx;
}

// Una cifra grande que baja de tamaño antes que salirse.
function cifra(ctx, texto, x, base, ancho, tam, color = ESTILO.blanco) {
  let t = tam;
  ctx.font = fT(700, t);
  while (t > 36 && ctx.measureText(texto).width > ancho) {
    t -= 2;
    ctx.font = fT(700, t);
  }
  ctx.fillStyle = color;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(texto, x, base);
}

function pie(ctx, texto, x, y, ancho) {
  ctx.fillStyle = ESTILO.neutral07;
  ctx.font = fG(500, 25);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'bottom';
  ctx.fillText(recortar(ctx, texto, ancho), x, y);
}

/* ---------- hoja 1: resumen ---------- */

/**
 * @param {object} op  cabecera (kicker, logoCliente, logo, etiqueta, titulo,
 *   personaje, fondo) y `datos`, lo que devuelve `presupuestoDe()`.
 */
export function dibujarResumen(canvas, op) {
  const ctx = preparar(canvas);
  const d = op.datos;
  const { x, w, hueco } = H;
  let y = H.arriba;
  const caja = (h) => {
    const c = { x, y, w, h, radio: H.radio };
    y += h + hueco;
    return c;
  };
  const cajas = { presupuesto: caja(R.presupuesto.h + R.presupuesto.nota), par: caja(R.par.h) };
  cajas.top = { x, y, w, h: H.pie - y, radio: 22 };

  pintarFondo(ctx, op.fondo);
  cabecera(ctx, { ...op, tarjetas: Object.values(cajas) });

  tarjetaPresupuesto(ctx, cajas.presupuesto, d);
  tarjetaPar(ctx, cajas.par, d);
  cajaMasReclamados(ctx, cajas.top, d.reclamados.premios);

  ctx.restore();
  return canvas;
}

function tarjetaPresupuesto(ctx, c, d) {
  const p = d.presupuesto;
  tarjeta(ctx, c);
  const x = c.x + H.pad;
  const ancho = c.w - H.pad * 2;
  etiqueta(ctx, 'Presupuesto actual', x, c.y + 34);
  const base = c.y + 34 + altoEtiqueta() + 14 + R.presupuesto.cifra * 0.78;
  cifra(ctx, p ? dinero(p.monto, p.moneda) : '—', x, base, ancho, R.presupuesto.cifra);

  const partes = [];
  // Lo de loterías (`lottery_amount`) no sale: ese presupuesto ya no tiene
  // lotería, y la nota de abajo cuenta cómo era antes.
  if (p?.fecha) partes.push(`Actualizado el ${fechaCorta(p.fecha)}`);
  if (!p) partes.push('Sin presupuesto cargado para esta compañía');
  const abajo = c.y + c.h - R.presupuesto.nota;
  pie(ctx, partes.join(' · '), x, abajo - 30, ancho);

  // Nota fija, igual para todas las compañías: cómo se repartía antes de la GaliLotería.
  ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
  ctx.fillRect(x, abajo - 6, ancho, 2);
  ctx.font = fG(500, 23);
  const lineas = envolver(ctx, NOTA_LOTERIA, ancho, 2);
  ctx.fillStyle = ESTILO.neutral07;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  lineas.forEach((l, i) => ctx.fillText(l, x, abajo + 16 + i * 31));
}

const NOTA_LOTERIA = 'Antes de la GaliLotería, $500.000 eran para la Lotería y $500.000 para el catálogo. '
  + 'Desde entonces el presupuesto se aumentó.';

// Dos columnas: lo reclamado del catálogo desde el inicio y los Especiales.
function tarjetaPar(ctx, c, d) {
  tarjeta(ctx, c);
  const columna = (c.w - H.pad * 4) / 2;
  const medio = c.x + c.w / 2;
  ctx.save();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.14)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(medio, c.y + 34);
  ctx.lineTo(medio, c.y + c.h - 34);
  ctx.stroke();
  ctx.restore();

  const r = d.reclamados;
  const e = d.especiales;
  const columnas = [
    {
      x: c.x + H.pad,
      titulo: 'Reclamado desde el inicio',
      valor: r.entregas ? dineros(r.totales) : '—',
      pie: r.entregas ? `${entero(r.entregas)} ${r.entregas === 1 ? 'premio' : 'premios'}${r.desde ? ` desde ${mesCorto(r.desde)}` : ''}` : 'Ningún premio reclamado aún',
    },
    {
      x: medio + H.pad,
      titulo: 'Premios Especiales',
      valor: e.lista.length ? dineros(e.totales) : '—',
      pie: e.lista.length ? `${entero(e.lista.length)} ${e.lista.length === 1 ? 'premio' : 'premios'} aparte del catálogo` : 'Sin premios especiales',
    },
  ];
  for (const col of columnas) {
    ctx.save();
    ctx.font = fG(700, H.etiqueta);
    ctx.letterSpacing = `${H.eyebrow.espacio}px`;
    const titulos = envolver(ctx, col.titulo.toUpperCase(), columna, 2);
    ctx.restore();
    etiqueta(ctx, titulos, col.x, c.y + 34);
    const base = c.y + 34 + altoEtiqueta(2) + 12 + R.par.cifra * 0.78;
    cifra(ctx, col.valor, col.x, base, columna, R.par.cifra);
    pie(ctx, col.pie, col.x, c.y + c.h - 30, columna);
  }
}

function cajaMasReclamados(ctx, c, premios) {
  const t = H.top;
  cajaOscura(ctx, c.x, c.y, c.w, c.h);
  const x = c.x + H.pad;
  const derecha = c.x + c.w - H.pad;
  etiqueta(ctx, 'Lo más reclamado', x, c.y + t.padY);

  const arriba = c.y + t.padY + altoEtiqueta() + 20;
  if (!premios.length) {
    ctx.fillStyle = ESTILO.neutral07;
    ctx.font = fG(500, 28);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText('Todavía nadie ha reclamado premios', x, arriba);
    return;
  }
  const caben = Math.max(1, Math.floor((c.y + c.h - t.padY - arriba) / R.top.fila));
  const visibles = premios.slice(0, caben);
  visibles.forEach((p, i) => {
    const cy = arriba + R.top.fila * (i + 0.5);
    // Medalla con el puesto, como el Top 3 de las otras hojas.
    const radio = 24;
    ctx.beginPath();
    ctx.arc(x + radio, cy, radio, 0, Math.PI * 2);
    ctx.fillStyle = i === 0 ? ESTILO.g500 : 'rgba(255, 255, 255, 0.16)';
    ctx.fill();
    ctx.fillStyle = i === 0 ? ESTILO.tintaChip : ESTILO.blanco;
    ctx.font = fT(700, 24);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(i + 1), x + radio, cy + 1);

    ctx.textAlign = 'right';
    ctx.fillStyle = ESTILO.neutral07;
    ctx.font = fG(500, R.top.dato);
    const dato = `${entero(p.conteo)} ${p.conteo === 1 ? 'vez' : 'veces'}`;
    const anchoDato = ctx.measureText(dato).width;
    ctx.fillText(dato, derecha, cy + 1);

    ctx.textAlign = 'left';
    ctx.fillStyle = ESTILO.blanco;
    ctx.font = fT(700, R.top.nombre);
    const xNombre = x + radio * 2 + 22;
    ctx.fillText(recortar(ctx, p.nombre, derecha - anchoDato - 24 - xNombre), xNombre, cy + 1);
  });
  if (premios.length > visibles.length) {
    ctx.fillStyle = ESTILO.g500;
    ctx.font = fG(600, 24);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'bottom';
    ctx.fillText(`+${premios.length - visibles.length} premios más en las hojas siguientes`, x, c.y + c.h - 22);
  }
}

/* ---------- hojas de lista ---------- */

// Renglones de una lista:
//   { tipo: 'seccion', texto, dato }        título verde de un grupo
//   { tipo: 'fila', titulo, dato, nota }     un premio; `nota` va debajo, en gris
//   { tipo: 'linea', texto }                 un renglón de nombres, en gris
const medidor = () => document.createElement('canvas').getContext('2d');
const ANCHO_LISTA = H.w - R.lista.pad * 2;

function altoDe(item, primero) {
  const l = R.lista;
  if (item.tipo === 'seccion') return l.seccion + (primero ? 0 : l.huecoSeccion);
  if (item.tipo === 'fila') return item.nota ? l.filaNota : l.fila;
  return l.linea;
}

// Los premios reclamados por mes, el más reciente primero: cada premio con
// cuántas veces y cuánto costó, y debajo quién lo reclamó («×2» si fue más de
// una vez). Los Especiales van en el mes en que se entregaron, marcados.
export function itemsReclamados(reclamados) {
  const ctx = medidor();
  ctx.font = fG(500, R.lista.nombres);
  const items = [];
  for (const m of reclamados.meses) {
    items.push({
      tipo: 'seccion',
      texto: m.nombre,
      dato: `${entero(m.entregas)} ${m.entregas === 1 ? 'premio' : 'premios'} · ${dineros(m.totales)}`,
    });
    items.push(...itemsDePremios(ctx, m.premios));
  }
  return items;
}

function itemsDePremios(ctx, premios) {
  const items = [];
  for (const p of premios) {
    const veces = `${entero(p.conteo)} ${p.conteo === 1 ? 'vez' : 'veces'}`;
    items.push({
      tipo: 'fila',
      titulo: p.nombre,
      especial: p.especial,
      dato: p.especial ? dineros(p.totales) : `${veces} · ${dineros(p.totales)}`,
    });
    // El «·» va pegado al nombre de antes (espacio duro): así ningún renglón empieza con él.
    const texto = p.personas.map((g) => (g.veces > 1 ? `${g.nombre} ×${g.veces}` : g.nombre)).join(' · ');
    for (const linea of envolver(ctx, texto, ANCHO_LISTA, 999)) items.push({ tipo: 'linea', texto: linea });
  }
  return items;
}

// El catálogo actual por nivel, con cuántas unidades trae cada periodo
// (`renovacion`: «cada mes»; las unidades ya llegan pasadas a mes), a la derecha. Sin el costo de cada premio (para
// el cliente solo va el costo total del catálogo, bajo el título) ni cuántas quedan.
export function itemsCatalogo(niveles, renovacion = '') {
  const items = [];
  for (const n of niveles) {
    items.push({ tipo: 'seccion', texto: n.nombre, dato: `${n.premios.length} ${n.premios.length === 1 ? 'premio' : 'premios'}` });
    for (const p of n.premios) {
      let dato = 'Sin límite';
      if (p.unidades != null) {
        // Corto: «32/Mes». Sin periodo reconocible, solo el número.
        dato = renovacion ? `${entero(p.unidades)}/Mes` : entero(p.unidades);
      }
      items.push({ tipo: 'fila', titulo: p.nombre, dato });
    }
  }
  return items;
}

// Parte los renglones en hojas. Un premio no se queda solo al pie: baja con su
// primer renglón de nombres, y un mes baja con su primer premio y ese renglón.
export function paginar(items) {
  const l = R.lista;
  const disponible = H.pie - H.arriba - l.pad * 2;
  const paginas = [[]];
  let usado = 0;
  const pegadoA = (i) => {
    const item = items[i];
    const siguiente = items[i + 1];
    if (!siguiente) return 0;
    if (item.tipo === 'seccion') return altoDe(siguiente, false) + pegadoA(i + 1);
    if (item.tipo === 'fila' && siguiente.tipo === 'linea') return altoDe(siguiente, false);
    return 0;
  };
  // Una hoja que sigue a media sección repite su título («Abril 2026 · continúa»).
  let seccion = null;
  items.forEach((item, i) => {
    const pagina = paginas[paginas.length - 1];
    const alto = altoDe(item, pagina.length === 0);
    const pegado = pegadoA(i);
    if (item.tipo === 'seccion') seccion = item;
    if (pagina.length && usado + alto + pegado > disponible) {
      if (item.tipo !== 'seccion' && seccion) {
        const repetida = { ...seccion, texto: `${seccion.texto} · continúa`, dato: '' };
        paginas.push([repetida, item]);
        usado = altoDe(repetida, true) + altoDe(item, false);
      } else {
        paginas.push([item]);
        usado = altoDe(item, true);
      }
    } else {
      pagina.push(item);
      usado += alto;
    }
  });
  return paginas;
}

const PASTILLA = { texto: 'ESPECIAL', fuente: 17, padX: 12, alto: 30 };

function anchoPastilla(ctx) {
  ctx.save();
  ctx.font = fG(700, PASTILLA.fuente);
  ctx.letterSpacing = '1.5px';
  const w = ctx.measureText(PASTILLA.texto).width + PASTILLA.padX * 2;
  ctx.restore();
  return w;
}

function pintarPastilla(ctx, x, medio) {
  const w = anchoPastilla(ctx);
  ctx.save();
  redondeado(ctx, x, medio - PASTILLA.alto / 2, w, PASTILLA.alto, PASTILLA.alto / 2);
  ctx.fillStyle = ESTILO.g500;
  ctx.fill();
  ctx.font = fG(700, PASTILLA.fuente);
  ctx.letterSpacing = '1.5px';
  ctx.fillStyle = ESTILO.tintaChip;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(PASTILLA.texto, x + PASTILLA.padX, medio + 1);
  ctx.restore();
}

/**
 * Una hoja de lista: la cabecera y una tarjeta con los renglones de esa hoja.
 * @param {object} op  cabecera y `items` (los de una página de `paginar`), y
 *   `vacio`: el texto si no hay renglones.
 */
export function dibujarLista(canvas, op) {
  const ctx = preparar(canvas);
  const l = R.lista;
  const items = op.items || [];
  const alto = items.length
    ? items.reduce((s, it, i) => s + altoDe(it, i === 0), 0) + l.pad * 2
    : 160;
  const c = { x: H.x, y: H.arriba, w: H.w, h: Math.min(alto, H.pie - H.arriba), radio: H.radio };

  pintarFondo(ctx, op.fondo);
  cabecera(ctx, { ...op, tarjetas: [c] });
  tarjeta(ctx, c);

  const x = c.x + l.pad;
  const derecha = c.x + c.w - l.pad;
  if (!items.length) {
    ctx.fillStyle = ESTILO.neutral07;
    ctx.font = fG(500, 28);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(op.vacio || 'Nada que mostrar', x, c.y + c.h / 2);
    ctx.restore();
    return canvas;
  }

  let y = c.y + l.pad;
  items.forEach((it, i) => {
    const h = altoDe(it, i === 0);
    if (it.tipo === 'seccion') {
      const arriba = y + h - l.seccion + 4;
      etiqueta(ctx, it.texto, x, arriba);
      if (it.dato) {
        ctx.fillStyle = ESTILO.neutral07;
        ctx.font = fG(500, 24);
        ctx.textAlign = 'right';
        ctx.textBaseline = 'top';
        ctx.fillText(it.dato, derecha, arriba);
      }
      // Raya bajo el título del grupo.
      ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
      ctx.fillRect(x, y + h - 14, derecha - x, 2);
    } else if (it.tipo === 'fila') {
      const medio = y + l.fila / 2;
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'right';
      ctx.fillStyle = ESTILO.blanco;
      ctx.font = fG(600, l.dato);
      const anchoDato = it.dato ? ctx.measureText(it.dato).width : 0;
      if (it.dato) ctx.fillText(it.dato, derecha, medio);

      ctx.textAlign = 'left';
      // Los Especiales llevan su pastilla verde detrás del nombre.
      const pastilla = it.especial ? anchoPastilla(ctx) + 14 : 0;
      ctx.font = fT(700, l.titulo);
      const titulo = recortar(ctx, it.titulo, derecha - x - anchoDato - 24 - pastilla);
      ctx.fillText(titulo, x, medio);
      if (it.especial) pintarPastilla(ctx, x + ctx.measureText(titulo).width + 14, medio);
      ctx.fillStyle = ESTILO.blanco;
      if (it.nota) {
        ctx.fillStyle = ESTILO.neutral07;
        ctx.font = fG(500, l.nota);
        ctx.fillText(recortar(ctx, it.nota, derecha - x), x, y + l.fila + 8);
      }
    } else {
      ctx.fillStyle = ESTILO.neutral07;
      ctx.font = fG(500, l.nombres);
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(it.texto, x, y + h / 2 - 4);
    }
    y += h;
  });

  ctx.restore();
  return canvas;
}
