// Pieza vertical para celular: 1080 x 1792, el frame `Plantillas Premios` del
// rediseño (Figma 14985-4931).
//
// A diferencia de la versión anterior, ya NO se dice quién ganó cada premio ni se
// separa por categoría: los premios salen todos juntos en una retícula y los
// ganadores van en un solo bloque al pie. Si hay más de siete premios la pieza se
// parte en varias páginas, repartidas parejo, y cada página lista los ganadores
// de SUS premios.
//
// La geometría de las siete plantillas (una por cantidad de premios) está copiada
// tal cual del diseño, en unidades de 1080 x 1792; el lienzo real sale a `escala`.

import { contener, redondeado, recortar } from './lienzo.js';
import { ESTILO } from './plantillas.js';

export const CARRUSEL = { ancho: 1080, alto: 1792, escala: 2 };

// Lo que cubre el diseño. Con más premios la pieza se parte en páginas.
export const MAX_PREMIOS = 7;

// Las categorías ya no parten la pieza, pero siguen siendo un dato editable del
// catálogo (la Biblioteca las usa), así que el listado se queda aquí.
export const CATEGORIAS = [
  { id: 'plata', titulo: 'Plata' },
  { id: 'bonos', titulo: 'Bonos' },
  { id: 'electro', titulo: 'Electrodomésticos y electrónicos' },
];

export function categoriaPorDefecto(id, desglose) {
  const texto = String(id || '').toLowerCase();
  if (/nequi|daviplata|efectivo|transferencia|plata/.test(texto)) return 'plata';
  if (desglose === 'por-monto' || /bono|gift|netflix|spotify|pass|caja|tarjeta/.test(texto)) return 'bonos';
  return 'electro';
}

const ANCHO = CARRUSEL.ancho;
const ALTO = CARRUSEL.alto;

/* ---------- constantes del diseño ---------- */

const D = {
  // Cabecera. La fila mide 942 y va centrada: los márgenes salen a 69.
  cabecera: { y: 61, ancho: 942, alto: 55.362 },
  kickerFuente: 24,
  logo: { ancho: 138, alto: 55.362 },

  // Chip verde: caja rotada del diseño; se pinta centrado en ella.
  chip: {
    x: 69, y: 170, w: 333.041, h: 78.639,
    giro: -3.78, fuente: 33.597, padX: 21, padY: 10, radio: 25, interlinea: 1.11,
  },

  titulo: { x: 100, y: 225, w: 684, fuente: 100, min: 62, interlinea: 0.94 },

  // Personaje: caja fija, espejado y recortado como en el diseño (las manos se
  // cortan justo donde arranca la retícula).
  personaje: { x: 611, y: 140, w: 422, h: 323, sobrealto: 1.2731, margen: 12 },

  trofeo: { cx: 548.97, cy: 264.97, lado: 128.594, giro: 12.83 },

  // Variante de siete premios: sin personaje ni trofeo, cabecera centrada.
  centrada: { y: 134, ancho: 932, solape: 16 },

  // Tamaño del nombre del premio en una tarjeta grande de 500 x 497. Con pocos
  // premios las tarjetas son más grandes y el nombre —con su «xN» y su total—
  // crece en proporción: ver `escalaNombres`. Nunca baja de esto, y todas las
  // tarjetas de una misma pieza usan la misma escala.
  nombreFuente: 32,
  nombreReferencia: { w: 500, h: 497 },

  tarjeta: {
    radio: 40,
    borde: 0.923,
    // Franja de luz: blanco de arriba a abajo. El diseño declara los topes en 0 y
    // 0,2, pero con los stops en 8,5 % y 105,94 % —los dos fuera de la caja— lo
    // que de verdad se ve va de 0,035 abajo a 0,185 arriba. Medido muestreando el
    // render de Figma contra el fondo por el hueco entre tarjetas: 0,174 a 0,046
    // de arriba abajo, que es lo que dan estos dos valores.
    luz: [0.035, 0.185],
    sombra: { color: 'rgba(0, 0, 0, 0.38)', desenfoque: 11, bajada: 9 },
  },

  // Contador de cuántos se entregaron, al lado del nombre: pill verde con la
  // tinta de marca, como el chip de la cabecera.
  contador: { fuente: 23, padX: 12, padY: 6, hueco: 10, interlinea: 1.11 },

  // Cuánto se repartió, debajo del nombre. Solo lo traen los premios que se
  // entregan por monto: en los demás el valor no cambia de una entrega a otra.
  total: { fuente: 24, min: 18, hueco: 8, interlinea: 1.4 },

  ganadores: {
    radio: 22,
    borde: 0.284,
    padX: 26.487,
    padY: 30.302,
    hueco: 11.363,
    huecoColumna: 11,
    tituloFuente: 32,
    fuente: 24,
    min: 18,
    // Con pocos ganadores la letra crece hasta aquí para llenar la caja: a 24 px
    // tres nombres sueltos se perdían en un recuadro medio vacío. El titular
    // «Ganadores» crece con ellos para seguir mandando en la jerarquía.
    max: 48,
    // Letra mínima con la que una caja acepta las columnas que `preferir` pide.
    // Si a dos columnas los nombres tendrían que quedar más chicos, se usa una.
    legible: 22,
    interlinea: 1.4,
    texto: 'Ganadores',
    // Hasta dónde puede crecer la caja. Su `x`, `w` e `y` son los del diseño —eso
    // es lo que la alinea con la retícula—, pero el alto se estira hasta este pie
    // cuando la caja no tiene nada al lado; así caben más nombres o se leen más
    // grandes.
    // 1736 es donde la apoya la plantilla de seis, la que más baja.
    pie: 1736,
  },
};

const fuenteT = (peso, tam) => `${peso} ${tam}px ${ESTILO.fuenteTitulo}`;
const fuenteG = (peso, tam) => `${peso} ${tam}px ${ESTILO.fuenteGanadores}`;

/* ---------- las siete plantillas ---------- */

// `producto: [padX, hueco, padAbajo]` es el aire que el recorte deja dentro de la
// tarjeta: a los lados, entre el nombre y el recorte, y hasta el borde de abajo.
// Sale de medir el diseño tarjeta por tarjeta.
const tarjeta = (x, y, w, h, extra = {}) => ({ x, y, w, h, estilo: 'arriba', ...extra });

// `nombre.ancho: 0` significa «todo el ancho útil de la tarjeta». El diseño fija
// un ancho concreto (208 en las grandes) porque su texto de muestra —«Nombre de
// Producto»— lo llena justo; con nombres de premio de verdad ese ancho trunca casi
// todo aunque sobre media tarjeta, así que se usa el que hay. Cuando el nombre
// cabe en una línea, el resultado es idéntico al diseño.
//
// El tamaño sale de `D.nombreFuente` y `escalaNombres`: ver los comentarios de ahí.
const GRANDE = { nombre: { x: 44, y: 38, ancho: 0, lineas: 2 }, producto: [56, 26, 67] };
const CHICA = { nombre: { x: 26, y: 24, ancho: 0, lineas: 3 }, producto: [20, 20, 36] };

// Fila de tres tarjetas iguales que reparten un ancho con huecos, como el
// contenedor flex de la variante de siete.
const trio = (x, y, ancho, alto, hueco, extra) => {
  const w = (ancho - hueco * 2) / 3;
  return [0, 1, 2].map((i) => tarjeta(x + i * (w + hueco), y, w, alto, extra));
};

const PLANTILLAS = {
  1: {
    tarjetas: [tarjeta(105.5, 463, 869, 837, {
      radio: 60,
      borde: 1.103,
      nombre: { x: 53.9, y: 38.9, ancho: 0, lineas: 2 },
      producto: [100, 0, 59],
    })],
    ganadores: { x: 105.5, y: 1329, w: 869, h: 312, columnas: 3 },
  },

  2: {
    tarjetas: [
      tarjeta(35, 463, 500, 669, GRANDE),
      tarjeta(544, 463, 500, 669, GRANDE),
    ],
    ganadores: { x: 105.5, y: 1329, w: 869, h: 312, columnas: 3 },
  },

  // Dos arriba y una ancha debajo, con el nombre a la izquierda y el recorte a la
  // derecha: el único caso de tarjeta apaisada del diseño.
  3: {
    tarjetas: [
      tarjeta(35, 463, 500, 544, GRANDE),
      tarjeta(544, 463, 500, 544, GRANDE),
      tarjeta(34.5, 1016, 1011, 389, {
        estilo: 'lado',
        nombre: { x: 65, y: 0, ancho: 405, lineas: 3 },
        producto: [490, 0, 40],
      }),
    ],
    ganadores: { x: 34.5, y: 1424, w: 1011, h: 279, columnas: 3 },
  },

  4: {
    tarjetas: [
      tarjeta(35, 463, 500, 497, GRANDE),
      tarjeta(544, 463, 500, 497, GRANDE),
      tarjeta(35, 970, 500, 497, GRANDE),
      tarjeta(544, 970, 500, 497, GRANDE),
    ],
    ganadores: { x: 105.5, y: 1495, w: 869, h: 267, columnas: 3 },
  },

  // Dos grandes arriba y tres chicas debajo.
  5: {
    tarjetas: [
      tarjeta(35, 463, 500, 497, GRANDE),
      tarjeta(544, 463, 500, 497, GRANDE),
      tarjeta(46, 970, 322, 439, CHICA),
      tarjeta(381, 970, 322, 439, CHICA),
      tarjeta(716, 970, 316, 439, CHICA),
    ],
    ganadores: { x: 105.5, y: 1481, w: 869, h: 265, columnas: 3 },
  },

  6: {
    tarjetas: [
      tarjeta(46, 463, 322, 439, CHICA),
      tarjeta(381, 463, 322, 439, CHICA),
      tarjeta(716, 463, 316, 439, CHICA),
      tarjeta(46, 914, 322, 439, CHICA),
      tarjeta(381, 914, 322, 439, CHICA),
      tarjeta(716, 914, 316, 439, CHICA),
    ],
    ganadores: { x: 105.5, y: 1424, w: 869, h: 312, columnas: 3 },
  },

  // Siete: dos tríos arriba y, abajo, el primer premio en grande con los
  // ganadores al lado en una sola columna. Esta variante no lleva personaje ni
  // trofeo y su cabecera va centrada.
  7: {
    cabecera: 'centrada',
    tarjetas: [
      tarjeta(39, 1113, 500, 497, {
        nombre: { x: 44, y: 38, ancho: 0, lineas: 2 },
        producto: [56, 26, 67],
      }),
      ...trio(39, 369, 1003, 372, 12, CHICA),
      ...trio(39, 751, 1003, 338, 12, CHICA),
    ],
    // Caja angosta: los nombres van cortos (nombre y primer apellido) para que
    // quepan a dos columnas sin bajar a una letra ilegible.
    ganadores: {
      x: 551, y: 1126, w: 491, h: 484, columnas: 2, lado: true, preferir: 2, nombreCorto: true,
    },
  },
};

const plantillaDe = (cuantos) => PLANTILLAS[Math.min(Math.max(cuantos, 1), MAX_PREMIOS)];

// El hueco MÁXIMO para la caja de ganadores. `x`, `w` e `y` son los del diseño
// —lo que la mantiene alineada con la retícula—, y el alto llega hasta el pie
// común. La caja que se pinta mide lo que pida su contenido, hasta este tope.
//
// Las que van `lado` a lado de una tarjeta no se estiran ni se encogen: miden lo
// mismo que su vecina, que si no la pareja queda desigual. Ahí solo se ajusta la
// letra dentro del alto del diseño.
function cajaGanadores(plantilla) {
  const caja = plantilla.ganadores;
  if (caja.lado) return caja;
  return { ...caja, h: Math.max(caja.h, D.ganadores.pie - caja.y) };
}

// Cuántos ganadores entran en la caja de una página con esa cantidad de premios.
// La interfaz lo usa para avisar de que va a salir un «+N más»; el dibujo lo
// recalcula por su cuenta con el tamaño de letra que acabe usando.
export function capacidadGanadores(cuantosPremios) {
  const caja = cajaGanadores(plantillaDe(cuantosPremios));
  return filasYColumnas(caja).celdas;
}

// Filas que caben en la caja a la letra mínima —la que usa el dibujo antes de
// resumir con «+N más»—, y celdas totales.
function filasYColumnas(caja) {
  const g = D.ganadores;
  const interlinea = g.min * g.interlinea;
  const alto = caja.h - g.padY * 2 - tituloPara(g.min) * g.interlinea - g.hueco;
  const filas = Math.max(1, Math.floor(alto / interlinea));
  return { filas, interlinea, celdas: filas * caja.columnas };
}

/* ---------- reparto en páginas ---------- */

/**
 * Reparte los premios en páginas de como mucho `MAX_PREMIOS`, parejo: con nueve
 * premios salen 5 + 4 (dos plantillas del diseño) en vez de 7 + 2.
 *
 * @param {Array<{nombre:string, imagen:?HTMLImageElement, nombres:string[], montos:Array}>} grupos
 *   ya armados y ordenados, el más valioso primero.
 * @returns {Array<{grupos:Array, ganadores:string[], parte:number, partes:number}>}
 */
export function armarCarrusel(grupos) {
  const lista = (grupos || []).filter(Boolean);
  if (!lista.length) return [];

  const partes = Math.ceil(lista.length / MAX_PREMIOS);
  const tam = Math.ceil(lista.length / partes);
  const paginas = [];
  for (let i = 0; i < lista.length; i += tam) paginas.push(lista.slice(i, i + tam));

  return paginas.map((pagina, i) => ({
    grupos: pagina,
    ganadores: ganadoresDe(pagina),
    parte: i + 1,
    partes: paginas.length,
  }));
}

// Todos los ganadores de esos premios, sin repetir y en el orden en que aparecen.
// El diseño ya no los ata a un premio concreto, así que quien ganó dos cosas sale
// una sola vez.
function ganadoresDe(grupos) {
  const vistos = new Set();
  for (const g of grupos) {
    const nombres = g.montos && g.montos.length
      ? g.montos.flatMap((m) => m.nombres)
      : (g.nombres || []);
    for (const n of nombres) if (n) vistos.add(n);
  }
  return [...vistos];
}

/* ---------- dibujo ---------- */

/**
 * Pinta una página de la pieza en `canvas`.
 * @param {HTMLCanvasElement} canvas
 */
export function dibujarDiapositiva(canvas, {
  kicker, titulo, etiqueta, logo, diapositiva, personaje, fondo, trofeo,
}) {
  const { escala } = CARRUSEL;
  canvas.width = ANCHO * escala;
  canvas.height = ALTO * escala;
  const ctx = canvas.getContext('2d');
  ctx.save();
  ctx.setTransform(escala, 0, 0, escala, 0, 0);
  ctx.imageSmoothingQuality = 'high';
  ctx.clearRect(0, 0, ANCHO, ALTO);

  const plantilla = plantillaDe(diapositiva.grupos.length);

  // Orden natural: el fondo es la capa de abajo del diseño, no un relleno.
  pintarFondo(ctx, fondo);

  if (plantilla.cabecera === 'centrada') {
    cabeceraCentrada(ctx, { kicker, titulo, etiqueta, logo });
  } else {
    cabecera(ctx, { kicker, titulo, etiqueta, logo, personaje, trofeo, tarjetas: plantilla.tarjetas });
  }

  const escalaNombre = escalaNombres(plantilla);
  plantilla.tarjetas.forEach((caja, i) => {
    const grupo = diapositiva.grupos[i];
    if (grupo) dibujarTarjeta(ctx, caja, grupo, escalaNombre);
  });

  // Los dedos de una pose que agarra van POR ENCIMA de las tarjetas.
  if (plantilla.cabecera !== 'centrada') dibujarDedos(ctx, personaje, plantilla.tarjetas);

  dibujarGanadores(ctx, cajaGanadores(plantilla), diapositiva.ganadores || []);

  ctx.restore();
  return canvas;
}

// Foto del escenario a sangre, el degradado negro que sube desde el pie y un velo
// plano encima. Sin foto queda el degradado de marca, para que la pieza no salga
// en negro si el asset no cargó.
function pintarFondo(ctx, fondo) {
  if (fondo && fondo.complete && fondo.naturalWidth) {
    const escala = Math.max(ANCHO / fondo.naturalWidth, ALTO / fondo.naturalHeight);
    const w = fondo.naturalWidth * escala;
    const h = fondo.naturalHeight * escala;
    ctx.drawImage(fondo, (ANCHO - w) / 2, (ALTO - h) / 2, w, h);
  } else {
    const base = ctx.createLinearGradient(0, 0, ANCHO, ALTO);
    base.addColorStop(0, ESTILO.fondoDe);
    base.addColorStop(1, ESTILO.fondoA);
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, ANCHO, ALTO);
  }

  // De abajo hacia arriba: negro opaco al pie, nada a partir del 46,6 % del alto.
  const pie = ctx.createLinearGradient(0, ALTO, 0, ALTO * (1 - 0.46624));
  pie.addColorStop(0, 'rgb(10, 11, 12)');
  pie.addColorStop(1, 'rgba(23, 26, 30, 0)');
  ctx.fillStyle = pie;
  ctx.fillRect(0, 0, ANCHO, ALTO);

  ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
  ctx.fillRect(0, 0, ANCHO, ALTO);
}

/* ---------- cabecera ---------- */

// Fila de arriba: el nombre del cliente a la izquierda y el logo a la derecha.
function filaCliente(ctx, kicker, logo) {
  const x = (ANCHO - D.cabecera.ancho) / 2;
  const cy = D.cabecera.y + D.cabecera.alto / 2;
  const cajaLogo = [x + D.cabecera.ancho - D.logo.ancho, D.cabecera.y, D.logo.ancho, D.logo.alto];

  if (kicker) {
    ctx.fillStyle = ESTILO.neutral07;
    ctx.font = fuenteG(500, D.kickerFuente);
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.fillText(recortar(ctx, kicker.toUpperCase(), D.cabecera.ancho - D.logo.ancho - 40), x, cy);
  }

  if (logo && logo.complete && logo.naturalWidth) {
    contener(ctx, logo, ...cajaLogo, 'derecha', 'centro');
    return;
  }
  ctx.fillStyle = ESTILO.blanco;
  ctx.font = fuenteT(700, 40);
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  ctx.fillText('galilei', cajaLogo[0] + cajaLogo[2], cy);
  ctx.textAlign = 'left';
}

// Cabecera de las variantes de uno a seis premios: chip y título a la izquierda,
// con el personaje y el trofeo a la derecha.
//
// El orden importa y es el del diseño: chip, personaje, título, fila del cliente y
// trofeo encima de todo. Que el título tape al personaje y no al revés es lo que
// lo mantiene legible cuando toca una pose ancha, que llega a solaparlo.
function cabecera(ctx, { kicker, titulo, etiqueta, logo, personaje, trofeo, tarjetas }) {
  if (etiqueta) dibujarChip(ctx, etiqueta, D.chip.x + D.chip.w / 2, D.chip.y + D.chip.h / 2);

  dibujarPersonaje(ctx, personaje, tarjetas);

  const { tam, lineas } = tituloQueCabe(ctx, titulo, D.titulo.w);
  ctx.fillStyle = ESTILO.blanco;
  ctx.font = fuenteT(700, tam);
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  const alto = tam * D.titulo.interlinea;
  lineas.forEach((linea, i) => ctx.fillText(linea, D.titulo.x, D.titulo.y + alto * (i + 0.5)));

  filaCliente(ctx, kicker, logo);
  dibujarTrofeo(ctx, trofeo);
}

// Variante de siete premios: chip centrado montado sobre un título de una línea,
// ambos centrados en la pieza.
function cabeceraCentrada(ctx, { kicker, titulo, etiqueta, logo }) {
  filaCliente(ctx, kicker, logo);

  const { ancho, solape } = D.centrada;
  let y = D.centrada.y;

  if (etiqueta) {
    const chipAlto = D.chip.fuente * D.chip.interlinea + D.chip.padY * 2;
    dibujarChip(ctx, etiqueta, ANCHO / 2, y + chipAlto / 2);
    y += chipAlto - solape;
  }

  // De una línea: el diseño lo pone todo seguido, así que el tamaño cede antes
  // que partirse en dos.
  let tam = D.titulo.fuente;
  ctx.font = fuenteT(700, tam);
  while (tam > D.titulo.min && ctx.measureText(titulo).width > ancho) {
    tam -= 2;
    ctx.font = fuenteT(700, tam);
  }
  ctx.fillStyle = ESTILO.blanco;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'center';
  ctx.fillText(recortar(ctx, titulo, ancho), ANCHO / 2, y + (tam * D.titulo.interlinea) / 2);
  ctx.textAlign = 'left';
}

function dibujarChip(ctx, texto, cx, cy) {
  const { fuente, padX, padY, radio, giro, interlinea } = D.chip;
  ctx.save();
  ctx.font = fuenteT(700, fuente);
  const w = ctx.measureText(texto).width + padX * 2;
  const h = fuente * interlinea + padY * 2;
  ctx.translate(cx, cy);
  ctx.rotate((giro * Math.PI) / 180);
  ctx.fillStyle = ESTILO.g500;
  redondeado(ctx, -w / 2, -h / 2, w, h, radio);
  ctx.fill();
  ctx.fillStyle = ESTILO.tintaChip;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'center';
  ctx.fillText(texto, 0, 1);
  ctx.restore();
}

// El título del diseño ocupa dos líneas. Se parte por palabras y, si con dos no
// basta, baja de tamaño antes que recortarse.
function tituloQueCabe(ctx, texto, ancho) {
  let tam = D.titulo.fuente;
  while (tam > D.titulo.min) {
    ctx.font = fuenteT(700, tam);
    const lineas = envolver(ctx, texto, ancho, 2);
    if (lineas.every((l) => ctx.measureText(l).width <= ancho)) return { tam, lineas };
    tam -= 2;
  }
  ctx.font = fuenteT(700, tam);
  return { tam, lineas: envolver(ctx, texto, ancho, 2) };
}

// Parte el texto en como mucho `maxLineas`; la última se recorta con puntos
// suspensivos si aún sobra. `anchoUltima` es lo que puede medir la última línea
// cuando algo va pegado detrás de ella (el contador «xN»): si no le cabe, su
// última palabra baja a una línea nueva —o, sin líneas libres, se recorta—.
function envolver(ctx, texto, ancho, maxLineas, anchoUltima = ancho) {
  const palabras = String(texto || '').split(/\s+/).filter(Boolean);
  if (!palabras.length) return [];

  const lineas = [];
  let actual = palabras[0];
  for (const palabra of palabras.slice(1)) {
    const prueba = `${actual} ${palabra}`;
    // Cabe, o ya es la última línea permitida y no queda dónde partir.
    if (ctx.measureText(prueba).width <= ancho || lineas.length + 1 >= maxLineas) {
      actual = prueba;
    } else {
      lineas.push(actual);
      actual = palabra;
    }
  }
  lineas.push(actual);

  const ultima = lineas.length - 1;
  const cola = lineas[ultima].split(' ');
  if (ctx.measureText(lineas[ultima]).width > anchoUltima
    && lineas.length < maxLineas && cola.length > 1) {
    lineas[ultima] = cola.slice(0, -1).join(' ');
    lineas.push(cola[cola.length - 1]);
  }
  const fin = lineas.length - 1;
  lineas[fin] = recortar(ctx, lineas[fin], anchoUltima);
  return lineas;
}

/* ---------- personaje y trofeo ---------- */

// Espejado y recortado como en el diseño: se dibuja más alto que su caja y lo
// que sobra se corta donde arranca la retícula.
//
// Solo se corta donde una tarjeta le pasa por encima: ahí el corte se explica
// solo. Donde hay aire —por arriba, a los lados, o debajo cuando la retícula es
// más angosta que el personaje, como con un solo premio— se ve entero; un corte
// en el vacío (medio zapato flotando) se lee como un error. Solo cede tamaño si
// no cabría ni en el lienzo.
//
// Lo que tapa es el contorno de TODA la retícula, con las esquinas redondeadas de
// las tarjetas, y no cada tarjeta por separado: si no, las piernas se colarían
// por las rendijas de 9 px entre una y otra.
function dibujarPersonaje(ctx, img, tarjetas = []) {
  const g = geometriaPersonaje(img, tarjetas);
  if (!g) return;

  ctx.save();
  if (g.agarre) {
    // Todo lo que queda por encima del borde que agarra; los dedos se pintan
    // después, sobre las tarjetas (`dibujarDedos`).
    ctx.beginPath();
    ctx.rect(0, 0, ANCHO, g.borde);
    ctx.clip();
  } else if (tarjetas.length) {
    const { izq, arr, der, aba } = contorno(tarjetas);
    const r = Math.min(tarjetas[0].radio ?? D.tarjeta.radio, (der - izq) / 2, (aba - arr) / 2);
    // Todo el lienzo menos la retícula: con `evenodd` el segundo trazado resta.
    ctx.beginPath();
    ctx.rect(0, 0, ANCHO, ALTO);
    ctx.moveTo(izq + r, arr);
    ctx.arcTo(der, arr, der, aba, r);
    ctx.arcTo(der, aba, izq, aba, r);
    ctx.arcTo(izq, aba, izq, arr, r);
    ctx.arcTo(izq, arr, der, arr, r);
    ctx.closePath();
    ctx.clip('evenodd');
  }
  pintarPersonaje(ctx, img, g);
  ctx.restore();
}

// Segunda pasada de las poses que agarran: solo la franja de los dedos, por
// debajo del borde, encima de las tarjetas ya pintadas.
function dibujarDedos(ctx, img, tarjetas) {
  const g = geometriaPersonaje(img, tarjetas);
  if (!g || !g.agarre) return;
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, g.borde, ANCHO, ALTO - g.borde);
  ctx.clip();
  pintarPersonaje(ctx, img, g);
  ctx.restore();
}

function pintarPersonaje(ctx, img, { px, ancho, alto }) {
  ctx.translate(px + ancho / 2, 0);
  ctx.scale(-1, 1);
  contener(ctx, img, -ancho / 2, D.personaje.y, ancho, alto, 'centro', 'arriba');
}

const contorno = (tarjetas) => ({
  izq: Math.min(...tarjetas.map((t) => t.x)),
  arr: Math.min(...tarjetas.map((t) => t.y)),
  der: Math.max(...tarjetas.map((t) => t.x + t.w)),
  aba: Math.max(...tarjetas.map((t) => t.y + t.h)),
});

// Poses que se asoman AGARRANDO un borde (Gali-24). Medido en fracciones de la
// imagen COMPLETA, sin espejar (el recorte útil se calcula por columnas y es
// aproximado, así que se convierte al dibujar):
// - `borde`: a qué altura (fracción) termina el verde del cuerpo bajo la cara,
//   que es donde estaría el canto que agarran. Se hace coincidir con el borde de
//   arriba de las tarjetas; si se mide más abajo (en los dedos) queda un hueco
//   transparente entre el cuello y la tarjeta. Va un pelo por encima del último
//   píxel verde (985 de 1400) para que no asome una rendija.
// - `manos`: tramo horizontal de cada mano. Las dos tienen que caer sobre una
//   tarjeta: una mano en el aire o sobre la rendija entre dos tarjetas se ve rara.
const AGARRAN = [
  { patron: /gali-24/i, borde: 0.702, manos: [[0.124, 0.282], [0.717, 0.876]] },
];

// Tamaño y posición del personaje en la cabecera.
function geometriaPersonaje(img, tarjetas = []) {
  if (!img || !img.complete || !img.naturalWidth) return null;
  const { x, y, w, h, sobrealto, margen } = D.personaje;
  const caja = img.caja || { x0: 0, y0: 0, x1: 1, y1: 1 };
  const anchoUtil = (caja.x1 - caja.x0) * img.naturalWidth;
  const altoUtil = (caja.y1 - caja.y0) * img.naturalHeight;
  const pose = tarjetas.length ? AGARRAN.find((a) => a.patron.test(img.nombre || img.src || '')) : null;
  // Pasado a fracciones del recorte útil, que es lo que ocupa `ancho` x `alto`.
  const enX = (f) => (f - caja.x0) / (caja.x1 - caja.x0);
  const agarre = pose && {
    borde: (pose.borde - caja.y0) / (caja.y1 - caja.y0),
    manos: pose.manos.map(([a, b]) => [enX(a), enX(b)]),
  };

  // Uno que agarra se escala para que su canto caiga justo en el borde de las
  // tarjetas (con el techo en el de la caja); los demás, más altos que su caja.
  const borde = tarjetas.length ? contorno(tarjetas).arr : y + h;
  let alto = agarre ? (borde - y) / agarre.borde : h * sobrealto;
  let ancho = alto * (anchoUtil / altoUtil);

  // Lo único que no puede rebasar es el lienzo: ahí el corte se vería igual de
  // gratuito. Un personaje más ancho que la pieza entera sí cede tamaño.
  const tope = ANCHO - margen * 2;
  if (ancho > tope) {
    alto *= tope / ancho;
    ancho = tope;
  }

  // Centrado en la caja del diseño y empujado adentro si se saldría del lienzo.
  const dentro = (v) => Math.min(Math.max(v, margen), ANCHO - margen - ancho);
  let px = dentro(x + (w - ancho) / 2);

  if (agarre) {
    // Espejado: una mano en [a, b] del recorte cae en [1 - b, 1 - a] del dibujo.
    const manos = agarre.manos.map(([a, b]) => [1 - b, 1 - a]);
    const apoyada = (base) => manos.every(([a, b]) => tarjetas.some((t) => (
      base + a * ancho >= t.x + 4 && base + b * ancho <= t.x + t.w - 4
    )));
    // El desplazamiento más corto que deja las dos manos sobre tarjeta.
    for (let d = 0; d <= 200; d += 2) {
      const opcion = [px - d, px + d].map(dentro).find(apoyada);
      if (opcion != null) { px = opcion; break; }
    }
  }

  return { px, ancho, alto, agarre, borde };
}

function dibujarTrofeo(ctx, img) {
  if (!img || !img.complete || !img.naturalWidth) return;
  const { cx, cy, lado, giro } = D.trofeo;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate((giro * Math.PI) / 180);
  contener(ctx, img, -lado / 2, -lado / 2, lado, lado);
  ctx.restore();
}

/* ---------- tarjetas de premio ---------- */

// Cuánto crecen los nombres de premio en esta plantilla. Sale de la tarjeta MÁS
// CHICA de la pieza comparada con la grande de referencia (raíz del cociente de
// áreas, para que sea proporcional al tamaño y no solo al ancho): así con uno o
// dos premios el nombre crece con su tarjeta, y en una pieza con tarjetas de
// varios tamaños todas llevan la misma letra. Nunca achica.
function escalaNombres(plantilla) {
  const { w, h } = D.nombreReferencia;
  const menor = Math.min(...plantilla.tarjetas.map((t) => t.w * t.h));
  return Math.max(1, Math.sqrt(menor / (w * h)));
}

function dibujarTarjeta(ctx, caja, grupo, escala = 1) {
  const { x, y, w, h } = caja;
  const radio = caja.radio ?? D.tarjeta.radio;
  const [bajo, alta] = D.tarjeta.luz;

  // Cristal: franja de luz de abajo hacia arriba y un filo blanco.
  const luz = ctx.createLinearGradient(x, y + h, x, y);
  luz.addColorStop(0, `rgba(255, 255, 255, ${bajo})`);
  luz.addColorStop(1, `rgba(255, 255, 255, ${alta})`);
  redondeado(ctx, x, y, w, h, radio);
  ctx.fillStyle = luz;
  ctx.fill();
  ctx.strokeStyle = ESTILO.blanco;
  ctx.lineWidth = caja.borde ?? D.tarjeta.borde;
  ctx.stroke();

  const [padX, hueco, padAbajo] = caja.producto;
  const n = caja.nombre;

  // Apaisada: el nombre a la izquierda, centrado en vertical, y el recorte
  // ocupando la mitad derecha. Puede asomar por arriba, como en el diseño.
  if (caja.estilo === 'lado') {
    const bloque = nombreDelPremio(ctx, grupo, n.ancho, n.lineas, n.x * HOLGURA_CONTADOR, escala);
    pintarNombre(ctx, bloque, x + n.x, y + h / 2 - bloque.alto / 2);
    producto(ctx, grupo, [x + padX, y, w - padX - padAbajo, h]);
    return;
  }

  const bloque = nombreDelPremio(ctx, grupo, n.ancho || w - n.x * 2, n.lineas, n.x * HOLGURA_CONTADOR, escala);
  pintarNombre(ctx, bloque, x + n.x, y + n.y);

  const arriba = y + n.y + bloque.alto + hueco;
  producto(ctx, grupo, [x + padX, arriba, w - padX * 2, y + h - padAbajo - arriba]);
}

// Cuánto del margen derecho de la tarjeta puede invadir lo que va pegado al final
// del nombre («xN» y el total) para no quedarse en un renglón solo: 0,6 del
// margen, así nunca llega a tocar el borde.
const HOLGURA_CONTADOR = 0.6;

// Lo más que se achica el nombre del premio para no robarle renglones al recorte,
// en la escala de referencia (crece con `escala` como todo lo demás).
const NOMBRE_MIN = 26;

/**
 * Maqueta el nombre del premio con lo que va detrás: el contador «xN» si se
 * entregó más de uno y el total repartido en los premios por monto.
 *
 * Todo cabe en `maxLineas` renglones como mucho: cada renglón de más es alto que
 * se le quita al recorte, y con un nombre largo más un total en línea aparte la
 * imagen quedaba diminuta. Por orden de preferencia:
 * 1. Contador y total pegados al final de la última línea, con el nombre a su
 *    tamaño o achicándolo hasta `NOMBRE_MIN` si así no hay que recortarlo. Lo que
 *    va pegado puede salirse `holgura` del ancho del texto.
 * 2. El total en su propio renglón, si el nombre cabe en uno menos.
 * 3. Todo en línea a la letra mínima, recortando el nombre con «…».
 * El contador nunca queda solo: si no le cabe, baja con la última palabra.
 */
function nombreDelPremio(ctx, grupo, ancho, maxLineas, holgura = 0, escala = 1) {
  // Contador y total crecen con el nombre: todo el bloque es proporcional.
  const c = {
    ...D.contador,
    fuente: D.contador.fuente * escala,
    padX: D.contador.padX * escala,
    padY: D.contador.padY * escala,
    hueco: D.contador.hueco * escala,
  };
  const t = { ...D.total, fuente: D.total.fuente * escala, hueco: D.total.hueco * escala };
  const nombre = String(grupo.nombre || '').trim().split(/\s+/).join(' ');

  let pill = null;
  const veces = grupo.conteo > 1 ? `x${grupo.conteo}` : '';
  if (veces) {
    ctx.font = fuenteT(700, c.fuente);
    pill = {
      texto: veces,
      w: ctx.measureText(veces).width + c.padX * 2,
      h: c.fuente * c.interlinea + c.padY * 2,
    };
  }

  let total = null;
  if (grupo.total) {
    ctx.font = fuenteG(500, t.fuente);
    total = { texto: grupo.total, tam: t.fuente, w: ctx.measureText(grupo.total).width };
  }

  const anchoPill = pill ? c.hueco + pill.w : 0;
  const armar = (tam, lineasMax, totalEnLinea) => {
    const cola = anchoPill + (total && totalEnLinea ? c.hueco + total.w : 0);
    ctx.font = fuenteT(700, tam);
    const lineas = envolver(ctx, nombre, ancho, lineasMax, cola ? ancho + holgura - cola : ancho);
    const tras = ctx.measureText(lineas[lineas.length - 1] || '').width;
    const alto = tam * D.chip.interlinea * lineas.length
      + (total && !totalEnLinea ? t.hueco + total.tam * t.interlinea : 0);
    return {
      tam,
      lineas,
      alto,
      contadorFuente: c.fuente,
      hueco: c.hueco,
      huecoTotal: t.hueco,
      completo: lineas.join(' ') === nombre,
      contador: pill ? { ...pill, tras } : null,
      total: total ? { ...total, enLinea: totalEnLinea, tras: tras + anchoPill } : null,
    };
  };

  const mayor = Math.round(D.nombreFuente * escala);
  const menor = Math.round(NOMBRE_MIN * escala);
  for (let tam = mayor; tam >= menor; tam -= 1) {
    const b = armar(tam, maxLineas, true);
    if (b.completo) return b;
  }
  if (total && maxLineas > 1) {
    for (let tam = mayor; tam >= menor; tam -= 1) {
      const b = armar(tam, maxLineas - 1, false);
      if (b.completo) return b;
    }
  }
  return armar(menor, maxLineas, true);
}

function pintarNombre(ctx, bloque, x, y) {
  const { tam, lineas, contador, total, hueco, huecoTotal, contadorFuente } = bloque;
  const alto = tam * D.chip.interlinea;

  ctx.font = fuenteT(700, tam);
  ctx.fillStyle = ESTILO.blanco;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  lineas.forEach((linea, i) => ctx.fillText(linea, x, y + alto * (i + 0.5)));

  const abajo = y + alto * lineas.length;
  const medioUltima = abajo - alto / 2;

  if (contador) {
    const px = x + contador.tras + hueco;
    const py = medioUltima - contador.h / 2;
    ctx.fillStyle = ESTILO.g500;
    redondeado(ctx, px, py, contador.w, contador.h, contador.h / 2);
    ctx.fill();
    ctx.fillStyle = ESTILO.tintaChip;
    ctx.font = fuenteT(700, contadorFuente);
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';
    ctx.fillText(contador.texto, px + contador.w / 2, py + contador.h / 2 + 1);
    ctx.textAlign = 'left';
  }

  if (total) {
    ctx.font = fuenteG(500, total.tam);
    ctx.fillStyle = ESTILO.g500;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    if (total.enLinea) {
      ctx.fillText(total.texto, x + total.tras + hueco, medioUltima + 1);
    } else {
      const altoTotal = total.tam * D.total.interlinea;
      ctx.fillText(total.texto, x, abajo + huecoTotal + altoTotal / 2);
    }
  }
}

// El recorte del premio, o un marcador punteado si todavía no tiene imagen.
function producto(ctx, grupo, [x, y, w, h]) {
  if (w <= 0 || h <= 0) return;

  if (grupo.imagen && grupo.imagen.complete && grupo.imagen.naturalWidth) {
    ctx.save();
    // La sombra no la escala la transformación: va en píxeles reales.
    ctx.shadowColor = D.tarjeta.sombra.color;
    ctx.shadowBlur = D.tarjeta.sombra.desenfoque * CARRUSEL.escala;
    ctx.shadowOffsetY = D.tarjeta.sombra.bajada * CARRUSEL.escala;
    contener(ctx, grupo.imagen, x, y, w, h);
    ctx.restore();
    return;
  }

  ctx.save();
  ctx.setLineDash([16, 12]);
  ctx.lineWidth = 3;
  ctx.strokeStyle = 'rgba(179, 241, 49, 0.45)';
  ctx.fillStyle = 'rgba(179, 241, 49, 0.05)';
  redondeado(ctx, x, y, w, h, 24);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = 'rgba(179, 241, 49, 0.75)';
  ctx.font = fuenteT(600, 26);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('Falta la imagen', x + w / 2, y + h / 2);
  ctx.restore();
}

/* ---------- bloque de ganadores ---------- */

// Tamaño del titular «Ganadores» para una letra de nombres dada: el del diseño
// (32 sobre 24) mientras los nombres no crezcan, y proporcional cuando lo hacen.
function tituloPara(tam) {
  const g = D.ganadores;
  return Math.max(g.tituloFuente, Math.round((tam * g.tituloFuente) / g.fuente));
}

// Resuelve la lista antes de pintarla: cuánta letra, cuántas filas, qué nombres
// entran y qué alto acaba teniendo la caja.
//
// Prioridades, en orden:
// 1. Que entre toda la gente posible. La caja usa todo el alto hasta el pie y, si
//    hace falta, la letra baja hasta `min` antes de resumir con «+N más».
// 2. Con eso asegurado, la letra más GRANDE (hasta `max`) que siga cabiendo de
//    ancho en su columna y de alto en el hueco.
// 3. La caja se cierra a `padY` del texto: el margen es el mismo en todas las
//    plantillas por más que el hueco disponible cambie.
//
// Las columnas del diseño son un máximo, no una obligación: se prueba con todas
// hasta una sola. Columnas más anchas dejan crecer la letra y bajan la lista por
// el alto que sobra; si con menos no se gana letra (o se esconde más gente), se
// quedan las del diseño. Así el tamaño depende de cuántos ganadores hay y no del
// largo de sus nombres: un ganador solo sale igual de grande se llame como se
// llame.
//
// Una caja con `preferir` se queda con ese número de columnas siempre que no
// esconda a más gente y la letra no baje de `legible`, aunque con menos columnas
// saliera más grande.
function medirGanadores(ctx, caja, nombres) {
  const g = D.ganadores;
  const opciones = [];
  for (let columnas = caja.columnas; columnas >= 1; columnas -= 1) {
    opciones.push(medirConColumnas(ctx, caja, nombres, columnas));
  }
  const mejor = opciones.reduce((a, m) => (
    m.resto < a.resto || (m.resto === a.resto && m.tam > a.tam) ? m : a
  ));
  const preferida = caja.preferir && opciones.find((m) => m.columnas === caja.preferir);
  if (preferida && preferida.resto <= mejor.resto && preferida.tam >= g.legible) return preferida;
  return mejor;
}

// «Nombre y primer apellido»: `Mariana Perez Arboleda` → `Mariana Perez`,
// `Juan Carlos Gómez Ruiz` → `Juan Gómez`. Las partículas (de, del, la…) van
// pegadas a la palabra que las sigue, así `María de la Cruz Pérez` queda
// `María de la Cruz` y no `María de`.
const PARTICULAS = new Set(['de', 'del', 'la', 'las', 'los', 'y', 'da', 'do', 'dos', 'van', 'von']);
function nombreCorto(nombre) {
  const palabras = String(nombre).trim().split(/\s+/).filter(Boolean);
  const partes = [];
  let pendiente = [];
  for (const p of palabras) {
    pendiente.push(p);
    if (!PARTICULAS.has(p.toLowerCase())) {
      partes.push(pendiente.join(' '));
      pendiente = [];
    }
  }
  if (pendiente.length) partes.push(pendiente.join(' '));
  if (partes.length <= 2) return partes.join(' ');
  // Con tres partes no se sabe si son dos nombres o dos apellidos; lo más común
  // en los datos es «nombre apellido apellido». Con cuatro o más, el primer
  // apellido va en la tercera.
  return `${partes[0]} ${partes[partes.length === 3 ? 1 : 2]}`;
}

function medirConColumnas(ctx, caja, nombres, columnas) {
  const g = D.ganadores;
  const { w } = caja;
  const anchoColumna = (w - g.padX * 2 - g.huecoColumna * (columnas - 1)) / columnas;

  const reparto = (tam) => {
    const tituloTam = tituloPara(tam);
    const altoTitulo = tituloTam * g.interlinea;
    const interlinea = tam * g.interlinea;
    // Lo que la caja deja libre por debajo del titular, con esta letra.
    const disponible = caja.h - g.padY * 2 - altoTitulo - (nombres.length ? g.hueco : 0);
    const filas = Math.max(1, Math.floor(disponible / interlinea));
    const celdas = filas * columnas;
    const resto = nombres.length > celdas ? nombres.length - (celdas - 1) : 0;
    const lista = resto > 0
      ? [...nombres.slice(0, celdas - 1), `+${resto} más`]
      : nombres.slice();
    const usadas = lista.length ? Math.min(filas, Math.ceil(lista.length / columnas)) : 0;
    ctx.save();
    ctx.font = fuenteG(500, tam);
    const cabeDeAncho = !lista.some((n) => ctx.measureText(n).width > anchoColumna);
    ctx.restore();
    return {
      tam, tituloTam, altoTitulo, interlinea, filas, resto, lista, usadas, anchoColumna, columnas,
      cabeDeAncho,
      alto: g.padY * 2 + altoTitulo + (usadas ? g.hueco + usadas * interlinea : 0),
    };
  };

  if (!nombres.length) return reparto(g.fuente);

  // Lo mínimo que se esconde es lo que se esconde a la letra más chica.
  const minimo = reparto(g.min);
  for (let tam = g.max; tam > g.min; tam -= 1) {
    const m = reparto(tam);
    if (m.cabeDeAncho && m.resto <= minimo.resto) return m;
  }
  // Ni a la mínima cabe algún nombre de ancho: ese se recorta con «…».
  return minimo;
}

// Caja oscura con «Ganadores» y la lista a varias columnas. El alto lo pone
// `medirGanadores`; lo que aun así no cabe se resume en «+N más».
function dibujarGanadores(ctx, caja, nombres) {
  const { x, y, w } = caja;
  const g = D.ganadores;

  // Primero se mide, después se pinta: el alto de la caja SALE del contenido, no
  // al revés. Así el aire entre el texto y el borde es `padY` en todas las
  // plantillas, en vez de depender de cuánto se haya estirado el recuadro.
  if (caja.nombreCorto) nombres = nombres.map(nombreCorto);
  const medida = medirGanadores(ctx, caja, nombres);
  const h = caja.lado ? caja.h : medida.alto;

  // El diseño la oscurece con un degradado a 156,77° en modo `multiply`. Con
  // `source-over` la caja quedaba bastante más clara: muestreando el render de
  // Figma, el fondo baja a un factor de 0,57-0,71, y eso solo lo da el multiply.
  //
  // El eje de un degradado CSS no va de esquina a esquina: pasa por el centro con
  // ese ángulo y su largo es |w·sin| + |h·cos|. Salía torcido cuando lo tomaba por
  // la esquina, y el lado derecho de la caja se quedaba casi sin oscurecer.
  const rad = (156.76878754062267 * Math.PI) / 180;
  const dx = Math.sin(rad);
  const dy = -Math.cos(rad);
  const largo = Math.abs(w * dx) + Math.abs(h * dy);
  const cx = x + w / 2;
  const cy = y + h / 2;
  const oscuro = ctx.createLinearGradient(
    cx - (dx * largo) / 2, cy - (dy * largo) / 2,
    cx + (dx * largo) / 2, cy + (dy * largo) / 2,
  );
  // Los stops del diseño están en 25,5 % y 115,15 %; el segundo cae fuera del eje,
  // así que se reproyecta a 100 % interpolando color y opacidad.
  const fuera = (1 - 0.25555) / (1.1515 - 0.25555);
  const mezcla = (a, b) => Math.round(a + (b - a) * fuera);
  oscuro.addColorStop(0, ESTILO.neutral00);
  oscuro.addColorStop(0.25555, ESTILO.neutral00);
  oscuro.addColorStop(1, `rgba(${mezcla(10, 199)}, ${mezcla(11, 204)}, ${mezcla(12, 212)}, ${(0.56 * (1 - fuera)).toFixed(4)})`);

  ctx.save();
  redondeado(ctx, x, y, w, h, g.radio);
  ctx.clip();
  ctx.globalCompositeOperation = 'multiply';
  ctx.fillStyle = oscuro;
  ctx.fillRect(x, y, w, h);
  ctx.restore();

  redondeado(ctx, x, y, w, h, g.radio);
  ctx.strokeStyle = ESTILO.neutral05;
  ctx.lineWidth = g.borde;
  ctx.stroke();

  const {
    usadas, interlinea, anchoColumna, columnas, lista, resto, tam, tituloTam, altoTitulo,
  } = medida;

  // Mismo margen arriba que abajo. Si la caja se cerró sobre el texto, esto es
  // `padY` justo; si tiene el alto de su vecina, el aire sobrante se reparte.
  const arriba = y + (h - (medida.alto - g.padY * 2)) / 2;

  ctx.fillStyle = ESTILO.g500;
  ctx.font = fuenteG(700, tituloTam);
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.fillText(g.texto, x + g.padX, arriba + altoTitulo / 2);

  if (!lista.length) return;

  const listaArriba = arriba + altoTitulo + g.hueco;
  // Se llena fila por fila: con pocos nombres ocupan primero el ancho de las
  // columnas y solo bajan cuando la fila está completa. Así la lista nunca pasa
  // de las `usadas` filas con las que se cerró la caja.
  lista.forEach((nombre, i) => {
    const col = i % columnas;
    const fila = Math.floor(i / columnas);
    if (fila >= usadas) return;
    const esResto = resto > 0 && i === lista.length - 1;
    ctx.font = fuenteG(esResto ? 700 : 500, tam);
    ctx.fillStyle = esResto ? ESTILO.g500 : ESTILO.neutral07;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.fillText(
      recortar(ctx, nombre, anchoColumna),
      x + g.padX + col * (anchoColumna + g.huecoColumna),
      listaArriba + interlinea * (fila + 0.5),
    );
  });
}
