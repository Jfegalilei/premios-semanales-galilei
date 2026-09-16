// Geometría de la pieza, en coordenadas absolutas sobre el lienzo de 4788 x 3486
// (el mismo tamaño del frame `PREMIOS Template` en Figma).
//
// Los dos modos trabajan igual: la imagen no lleva `y` fijo, se coloca debajo del
// bloque ya dibujado y se estira hasta `hasta`. Así una lista larga nunca pisa el
// recorte, pase lo que pase con el número de ganadores.
//
// - `reticula`: columnas alineadas, sin línea punteada.
// - `collage`: celdas irregulares (anchos, alturas y arranques distintos) y una
//   punteada del chip a su recorte. Cada celda reserva un CARRIL lateral por el
//   que baja esa línea, así no cruza nunca la caja de ganadores. Como cada línea
//   vive dentro de su celda y las celdas no se tocan, tampoco se cruzan entre sí.

// El ancho es fijo; el alto lo decide `altoLienzo` según cuántos premios haya:
// cuadrado de partida, más bajo cuando hay uno o dos (si no, sobra medio lienzo
// vacío) y más alto cuando hay siete, para que quepan todos.
export const LIENZO = { ancho: 4788, alto: 4788 };
export const ALTO_MINIMO = 2600;

export const ESTILO = {
  fondoDe: '#101010',
  fondoA: '#292F36',
  lima: '#C9F73F',
  tinta: '#101010',
  blanco: '#FFFFFF',
  cajaFondo: 'rgba(255, 255, 255, 0.055)',
  cajaBorde: 'rgba(255, 255, 255, 0.10)',
  cajaTexto: 'rgba(255, 255, 255, 0.88)',
  cajaFondoCollage: 'rgba(10, 12, 14, 0.62)',
  cajaBordeCollage: 'rgba(255, 255, 255, 0.16)',
  punteada: 'rgba(255, 255, 255, 0.44)',

  // Tokens del sistema de diseño, tal como los nombra Figma. La pieza de celular
  // (`carrusel.js`) va con estos; el verde `lima` de arriba es el de las piezas
  // horizontales, que el rediseño no toca.
  g500: '#B3F131',
  tintaChip: '#051216',
  neutral00: 'rgba(10, 11, 12, 0.56)',
  neutral05: '#58606C',
  neutral07: '#C7CCD4',

  // Dos familias de marca: la display para titular y chips verdes, la mono-ish
  // para la lista de ganadores. Radio Canada Big llega hasta el peso 700
  // (no tiene 900), así que el titular va en 700.
  fuenteTitulo: '"Radio Canada Big", "Segoe UI", system-ui, sans-serif',
  fuenteGanadores: '"Space Grotesk", "Segoe UI", system-ui, sans-serif',
  pesoTitulo: 700,

  margen: 300,
  chipAlto: 118,
  chipRadio: 59,
  chipPadX: 48,
  chipFuente: 54,
  listaFuente: 43,
  listaInterlinea: 56,
  listaPad: 34,
  listaRadio: 24,
  sangriaVineta: 34,
  huecoBloqueImagen: 70,
  tituloMax: 300,
  kickerFuente: 82,

  // Mínimo de ganadores visibles por premio antes de cortar con "+N más".
  minNombres: 5,

  // Separación que la punteada deja en los dos extremos: ni toca el chip verde
  // ni los píxeles del recorte.
  holguraLinea: 30,
};

export const CABECERA = {
  kicker: [300, 300],
  titulo: [300, 470, 3200],
  logo: [3788, 250, 700, 252],
};

/* ---------- retícula ---------- */

const COL = {
  1: [[300, 4188]],
  2: [[300, 2000], [2488, 2000]],
  3: [[300, 1316], [1736, 1316], [3172, 1316]],
};

const fila = (col, y, maxLineas, hasta) => ({
  bloque: [col[0], y, col[1], maxLineas],
  img: [col[0], col[1], hasta],
});

const RETICULA = {
  1: [fila(COL[1][0], 1120, 12, 4700)],
  2: COL[2].map((c) => fila(c, 1120, 11, 4700)),
  3: COL[3].map((c) => fila(c, 1120, 11, 4700)),
  4: [
    ...COL[2].map((c) => fila(c, 1060, 6, 2900)),
    ...COL[2].map((c) => fila(c, 3020, 6, 4700)),
  ],
  5: [
    fila(COL[3][1], 1060, 5, 3020),
    fila(COL[3][0], 1060, 6, 2900),
    fila(COL[3][2], 1060, 6, 2900),
    fila(COL[3][0], 3020, 6, 4700),
    fila(COL[3][2], 3020, 6, 4700),
  ],
  6: [
    ...COL[3].map((c) => fila(c, 1060, 6, 2900)),
    ...COL[3].map((c) => fila(c, 3020, 6, 4700)),
  ],
};

/* ---------- collage ---------- */

// El destacado va en el centro del lienzo y los demás lo rodean.
//
// Cada premio ocupa una REGIÓN propia (de `y` a `hasta`, y del ancho que abarquen
// su bloque y su recorte). Las regiones no se tocan, así que nada se solapa. Lo
// que va dentro se coloca en tiempo de render: `orden` dice si el bloque va
// arriba y el recorte debajo ('bi') o al revés ('ib'), y el segundo se pega al
// primero — si la lista tiene pocos nombres, el recorte sube en vez de quedarse
// lejos.
// `alinear: 'abajo'` pega el par al pie de su región en vez de a su techo. Lo
// usan los satélites que van encima del destacado, para que el aire que sobre
// quede arriba y no como un vacío entre ellos y el premio grande.
const par = (y, hasta, bloque, img, orden = 'bi', alinear = 'arriba') => (
  { y, hasta, bloque, img, orden, alinear }
);

// El recorte es más ancho que su bloque a propósito: el sobrante lateral es por
// donde baja la punteada sin cruzar la caja de ganadores.
const L = [300, 1120];
const R = [3368, 1120];
const CENTRO = [1494, 1800];
const BLOQUE_LATERAL = 1060;
// Los satélites de arriba y abajo comparten medidas con los de los costados:
// mismo ancho de recorte, centrado en la banda del destacado.
const SAT = [CENTRO[0] + (CENTRO[1] - L[1]) / 2, L[1]];

const COLLAGE = {
  // Con pocos premios no tiene sentido un destacado en el centro rodeado de nada:
  // se reparten por el lienzo, todos del mismo tamaño, y crecen hasta llenarlo.
  1: [par(1000, 3500, [1494, 1400, 10], [1194, 2400, 2400], 'ib')],

  2: [
    par(1000, 3500, [300, 1900, 8], [350, 1900, 2000], 'ib'),
    par(1000, 3500, [2438, 1900, 8], [2488, 1900, 2000], 'ib'),
  ],

  3: [
    par(1000, 4600, [1714, 1360, 9], [1714, 1360, 1900], 'ib'),
    par(1000, 4600, [300, 1360, 9], [300, 1360, 1900], 'ib'),
    par(1000, 4600, [3128, 1360, 9], [3128, 1360, 1900], 'ib'),
  ],

  // Con cuatro: el destacado al centro, uno encima y dos a los costados. Los tres
  // pequeños miden lo mismo —el de arriba ya no se queda enano— y para eso el
  // lienzo se alarga hasta donde haga falta.
  4: [
    par(2880, 5160, [CENTRO[0], 1000, 5], [...CENTRO, 1500], 'ib'),
    par(1000, 2780, [SAT[0], BLOQUE_LATERAL, 5], [...SAT, 1100], 'bi', 'abajo'),
    par(2880, 4660, [L[0], BLOQUE_LATERAL, 5], [L[0], L[1], 1100], 'ib'),
    par(2880, 4660, [R[0], BLOQUE_LATERAL, 5], [R[0], R[1], 1100], 'ib'),
  ],

  5: [
    par(1000, 3340, [CENTRO[0], 1000, 5], [...CENTRO, 1640]),
    par(1000, 2680, [L[0], BLOQUE_LATERAL, 5], [L[0], L[1], 900], 'ib'),
    par(1000, 2680, [R[0], BLOQUE_LATERAL, 5], [R[0], R[1], 900], 'ib'),
    par(2900, 4680, [L[0], BLOQUE_LATERAL, 5], [L[0], L[1], 1000], 'ib'),
    par(2900, 4680, [R[0], BLOQUE_LATERAL, 5], [R[0], R[1], 1000], 'ib'),
  ],

  6: [
    par(1000, 3160, [CENTRO[0], 1000, 4], [...CENTRO, 1500]),
    par(1000, 2500, [L[0], BLOQUE_LATERAL, 4], [L[0], L[1], 820], 'ib'),
    par(1000, 2500, [R[0], BLOQUE_LATERAL, 4], [R[0], R[1], 820], 'ib'),
    par(2680, 4260, [L[0], BLOQUE_LATERAL, 4], [L[0], L[1], 900], 'ib'),
    par(2680, 4260, [R[0], BLOQUE_LATERAL, 4], [R[0], R[1], 900], 'ib'),
    par(3300, 4600, [CENTRO[0], 1600, 4], [...CENTRO, 640], 'ib'),
  ],

  // Con siete, los seis pequeños rodean al grande —uno encima, uno debajo y dos
  // por costado— y TODOS miden lo mismo. Igualar los de arriba y abajo con los
  // laterales obliga a alargar bastante el lienzo: es el precio de que no se vean
  // más chicos.
  7: [
    par(2620, 4880, [CENTRO[0], 1000, 4], [...CENTRO, 1480], 'ib'),
    par(1000, 2520, [SAT[0], BLOQUE_LATERAL, 4], [...SAT, 820], 'bi', 'abajo'),
    par(4980, 6500, [SAT[0], BLOQUE_LATERAL, 4], [...SAT, 820], 'ib'),
    par(1960, 3480, [L[0], BLOQUE_LATERAL, 4], [L[0], L[1], 820], 'ib'),
    par(1960, 3480, [R[0], BLOQUE_LATERAL, 4], [R[0], R[1], 820], 'ib'),
    par(3580, 5100, [L[0], BLOQUE_LATERAL, 4], [L[0], L[1], 820], 'ib'),
    par(3580, 5100, [R[0], BLOQUE_LATERAL, 4], [R[0], R[1], 820], 'ib'),
  ],
};

export const PLANTILLAS = { reticula: RETICULA, collage: COLLAGE };
export const MODOS = ['reticula', 'collage'];
export const MAX_GRUPOS = 7;

// La retícula solo llega a seis; el collage admite siete alargando el lienzo.
export function maxGrupos(modo = 'reticula') {
  return modo === 'collage' ? 7 : 6;
}

// Alto del lienzo antes de recortar el aire sobrante. Con uno o dos premios se
// parte de un lienzo más bajo, y con siete de uno más alto.
export function altoLienzo(cantidad, modo = 'reticula') {
  if (modo !== 'collage') return LIENZO.alto;
  if (cantidad >= 7) return 6800;
  if (cantidad <= 2) return 3600;
  if (cantidad === 4) return 5500;
  return LIENZO.alto;
}

export function plantillaPara(cantidad, modo = 'reticula') {
  const n = Math.min(Math.max(cantidad, 1), maxGrupos(modo));
  return (PLANTILLAS[modo] || RETICULA)[n];
}
