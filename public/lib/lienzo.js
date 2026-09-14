// Render de la pieza sobre un canvas lógico de 4788 x 3486.
// Todo se dibuja en coordenadas absolutas del lienzo, así que la vista previa
// escalada y el PNG exportado son idénticos.

import { LIENZO, ALTO_MINIMO, ESTILO, CABECERA, plantillaPara, altoLienzo } from './plantillas.js';

// Dos familias: `fuente` es la display de marca (titular y chips verdes);
// `fuenteGanadores` la de las cajas grises con los nombres.
const fuente = (peso, tam) => `${peso} ${tam}px ${ESTILO.fuenteTitulo}`;
const fuenteGanadores = (peso, tam) => `${peso} ${tam}px ${ESTILO.fuenteGanadores}`;

export function crearLienzo() {
  const canvas = document.createElement('canvas');
  canvas.width = LIENZO.ancho;
  canvas.height = LIENZO.alto;
  return canvas;
}

/**
 * @param {HTMLCanvasElement} canvas
 * @param {{ kicker:string, titulo:string, etiqueta:string, logo:HTMLImageElement|null,
 *           grupos: Array<{chip:string, lineas:string[], imagen:HTMLImageElement|null, nombre:string}> }} datos
 */
export function dibujarPieza(canvas, datos) {
  const ctx = canvas.getContext('2d');
  const modo = datos.modo === 'collage' ? 'collage' : 'reticula';
  const slots = plantillaPara(datos.grupos.length, modo);
  const grupos = datos.grupos.slice(0, slots.length);

  // El alto se decide antes de pintar: se parte del que pida la plantilla y, en
  // collage, se recorta el aire que sobre por debajo del contenido. Con uno o dos
  // premios eso ahorra medio lienzo vacío.
  canvas.width = LIENZO.ancho;
  canvas.height = modo === 'collage'
    ? altoAjustado(ctx, grupos, slots, altoLienzo(grupos.length, modo), datos.personaje)
    : altoLienzo(grupos.length, modo);

  ctx.save();
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // El fondo va AL FINAL, con `destination-over`: se cuela por debajo de todo lo
  // ya pintado. Así el personaje puede dibujarse detrás de los premios sin tener
  // que adivinar sus cajas antes de medirlas. Componer en este orden da el mismo
  // resultado que pintar de atrás hacia delante.
  cabecera(ctx, datos);

  if (modo === 'collage') dibujarCollage(ctx, grupos, slots, datos);
  else dibujarReticula(ctx, grupos, slots);

  ctx.globalCompositeOperation = 'destination-over';
  fondo(ctx);

  ctx.restore();
  return canvas;
}

// Mide dónde termina de verdad el contenido y devuelve el alto recortado. El
// personaje cuenta como contenido: si no, una pieza corta podría recortarse justo
// por encima de él y dejarlo cortado por los pies.
//
// Salvo que lo hayan colocado a mano: si alguien lo saca aposta por abajo, quiere
// que asome por el borde, no que el lienzo crezca para perseguirlo.
function altoAjustado(ctx, grupos, slots, alto, personaje) {
  let fondoContenido = 0;
  if (personaje && !personaje.aMano && personaje.img && personaje.centro) {
    const r = rectPersonaje(personaje.img, personaje.centro, personaje.escala);
    fondoContenido = Math.max(fondoContenido, r.y + r.h * 0.85 - ESTILO.margen);
  }
  grupos.forEach((grupo, i) => {
    const [, bancho, maxLineas] = slots[i].bloque;
    const [, iancho, ialto] = slots[i].img;
    const altoB = alturaBloque(ctx, grupo, bancho, maxLineas);
    const disponible = slots[i].hasta - slots[i].y - ESTILO.huecoBloqueImagen - altoB;
    const altoImg = Math.max(0, Math.min(altoProducto(grupo.imagen, iancho, ialto), disponible));
    const fin = slots[i].y + altoB + ESTILO.huecoBloqueImagen + altoImg;
    if (fin > fondoContenido) fondoContenido = fin;
  });
  return Math.round(limitar(fondoContenido + ESTILO.margen, ALTO_MINIMO, alto));
}

function dibujarReticula(ctx, grupos, slots) {
  // El bloque manda: la banda de imagen empieza donde termina la lista más larga
  // de su fila, para que los recortes de una misma fila queden alineados.
  const finBloque = grupos.map((grupo, i) => dibujarBloque(ctx, grupo, slots[i].bloque).fin);

  const inicioFila = new Map();
  grupos.forEach((_, i) => {
    const fila = slots[i].img[2];
    inicioFila.set(fila, Math.max(inicioFila.get(fila) ?? 0, finBloque[i]));
  });

  grupos.forEach((grupo, i) => {
    const [ix, iw, hasta] = slots[i].img;
    const iy = inicioFila.get(hasta) + ESTILO.huecoBloqueImagen;
    if (hasta - iy > 180) dibujarImagen(ctx, grupo, [ix, iy, iw, hasta - iy]);
  });
}

function dibujarCollage(ctx, grupos, slots, datos) {
  // Primera pasada: se dibuja todo y se apunta dónde quedó cada cosa. Las
  // punteadas necesitan conocer TODAS las cajas antes de elegir su camino.
  const piezas = grupos.map((grupo, i) => {
    const slot = slots[i];
    const [bx, bancho, maxLineas] = slot.bloque;
    const [ix, iancho, ialto] = slot.img;

    // Bloque y recorte van SIEMPRE pegados, con solo `huecoBloqueImagen` entre
    // ellos, y la caja del recorte se ajusta a lo que de verdad ocupa el producto
    // — un recorte apaisado no reserva el alto entero —. El par resultante se
    // centra en su región, así que ni queda hueco muerto ni se descuelga.
    const arribaVaElBloque = slot.orden !== 'ib';
    const hueco = ESTILO.huecoBloqueImagen;
    const altoB = alturaBloque(ctx, grupo, bancho, maxLineas);

    const disponible = slot.hasta - slot.y - hueco - altoB;
    const alto = Math.max(0, Math.min(altoProducto(grupo.imagen, iancho, ialto), disponible));

    // Normalmente el par se alinea al techo de su región y lo que sobra queda
    // abajo, que es lo que `altoAjustado` recorta del lienzo. Los que van encima
    // del destacado se alinean al pie, para no dejar un vacío entre ellos y él.
    const sobra = Math.max(0, disponible - alto);
    const arranque = slot.alinear === 'abajo' ? slot.y + sobra : slot.y;

    let by;
    let iy;
    if (arribaVaElBloque) {
      by = arranque;
      iy = by + altoB + hueco;
    } else {
      iy = arranque;
      by = iy + alto + hueco;
    }

    const chip = medirChip(ctx, grupo, bx, by, bancho);
    const pintado = dibujarBloque(ctx, grupo, [bx, by, bancho, maxLineas], true);
    const finBloque = pintado.fin;

    // El chip y la caja gris se apuntan por separado: la línea nace pegada a su
    // propio chip, así que ese rectángulo no puede contar como estorbo para ella.
    // Y la caja gris se apunta con su ancho real, ya ajustado al texto.
    const cajaChip = [chip.x, chip.y, chip.w, ESTILO.chipAlto];
    const cajaLista = pintado.caja;
    const cajaImagen = [ix, iy, iancho, Math.max(0, alto)];
    const puesta = alto > 140
      ? dibujarImagen(ctx, grupo, cajaImagen, arribaVaElBloque ? 'arriba' : 'abajo')
      : null;

    // Como estorbo para las demás líneas vale el producto, no la caja con su aire.
    const ocupa = puesta
      ? [puesta.producto.x, puesta.producto.y, puesta.producto.w, puesta.producto.h]
      : cajaImagen;
    return { chip, cajaChip, cajaLista, cajaImagen: ocupa, puesta };
  });

  const estorbos = piezas.flatMap((p) => [p.cajaChip, p.cajaLista, p.cajaImagen]);

  // El personaje NO cuenta como estorbo: las punteadas eligen su camino como si no
  // estuviera y le pasan por encima si les conviene. Es decoración de fondo —va
  // debajo de todo—, y hacer que las líneas lo esquivaran las obligaba a dar
  // rodeos peores que el cruce que evitaban.
  dibujarPersonaje(ctx, datos.personaje);

  // Segunda pasada: las punteadas, esquivando cualquier caja de texto o recorte.
  piezas.forEach((p) => {
    if (!p.puesta) return;
    // Se quitan las dos cajas propias que la línea tiene que poder tocar: su chip
    // (de donde sale) y su recorte (al que llega, y que ya se controla por
    // píxeles). Su propia caja gris sí sigue prohibida.
    const ajenas = estorbos.filter((c) => c !== p.cajaImagen && c !== p.cajaChip);
    curvaPunteada(ctx, p.chip, p.puesta, ajenas, p.cajaChip);
  });
}

// Alto que de verdad ocupa el producto dentro de una caja de ancho x alto. Si el
// recorte es apaisado no llena el alto, y reservárselo dejaría un hueco muerto
// entre él y su bloque.
function altoProducto(imagen, ancho, alto) {
  const c = imagen && imagen.caja;
  if (!imagen || !imagen.naturalWidth) return alto;
  const anchoUtil = ((c ? c.x1 - c.x0 : 1)) * imagen.naturalWidth;
  const altoUtil = ((c ? c.y1 - c.y0 : 1)) * imagen.naturalHeight;
  return Math.min(alto, (ancho / anchoUtil) * altoUtil);
}

// Alto que ocupará un bloque, sin dibujarlo. Hace falta para los pares en los que
// el bloque va debajo del recorte.
function alturaBloque(ctx, grupo, ancho, maxLineas) {
  const lineas = lineasDeLista(ctx, grupo, ancho, maxLineas).lineas.length;
  if (!lineas) return ESTILO.chipAlto;
  return ESTILO.chipAlto + 30 + ESTILO.listaPad * 2 + lineas * ESTILO.listaInterlinea;
}

// Punteada del chip verde a su recorte.
//
// Tres reglas, en este orden:
// 1. Sale a 90° del chip y llega a 90° del producto. Al producto no se le mide la
//    caja sino su CONTORNO real: cada punto del borde trae su normal (ver
//    `contorno` en app.js), así que la línea entra perpendicular al zapato, al
//    billete o al vaso, no a un rectángulo imaginario.
// 2. El quiebre deja los dos tramos lo más iguales posible. La curva es una
//    cuadrática cuyo punto de control es el cruce de la normal de salida del chip
//    con la normal de llegada; se prueban todos los puntos del borde del chip y
//    del contorno, y cuando ambos tramos miden lo mismo el arco sale simétrico.
// 3. Va al punto más cercano del producto. Cercanía y simetría se pesan juntas.
//
// Se descartan las rutas que pasan por encima de cajas ajenas (texto, chips y
// otros recortes), de su propia lista o de los píxeles de su propio producto.
// Ningún extremo toca nada: sale a `holguraLinea` del chip y termina a esa misma
// distancia del borde del producto.
//
// `op` deja usarla a otra escala (el carrusel de celular): `factor` multiplica
// holguras, tramos mínimos y márgenes; `limites` es el tamaño lógico del lienzo
// cuando el contexto va escalado; `trazo` y `guiones` fijan el dibujo de la línea.
export function curvaPunteada(ctx, chip, puesta, ajenas, propioChip, op = {}) {
  const f = op.factor ?? 1;
  const cfg = {
    f,
    ancho: op.limites?.w ?? ctx.canvas.width,
    alto: op.limites?.h ?? ctx.canvas.height,
  };
  const h = ESTILO.holguraLinea * f;

  const salidas = bordesDelChip(chip, h);
  const entradas = entradasPosibles(puesta, h);

  // Todas las combinaciones se resuelven (es aritmética), se ordenan por nota y se
  // comprueba el cruce empezando por la mejor: la primera libre gana. Si con los
  // arcos parejos no hay ruta libre, se aceptan más desequilibrados.
  const candidatas = [];
  for (const s of salidas) {
    for (const e of entradas) {
      const r = resolver(s, e);
      if (r) candidatas.push(r);
    }
  }

  let mejor = null;
  for (const [tolerancia, tramo] of [[1.6, 90], [2.5, 60], [Infinity, 30]]) {
    mejor = elegir(cfg, candidatas, tolerancia, tramo * f, ajenas, puesta, propioChip);
    if (mejor) break;
  }

  // Si de verdad no queda ninguna ruta libre, mejor sin línea que cruzando algo.
  if (!mejor) {
    console.warn(`[punteada] sin ruta libre para "${chip.texto}"`);
    return;
  }

  ctx.save();
  ctx.setLineDash(op.guiones || [18, 26]);
  ctx.lineWidth = op.trazo || 6;
  ctx.lineCap = 'round';
  ctx.strokeStyle = ESTILO.punteada;
  ctx.beginPath();
  ctx.moveTo(mejor.salida.x, mejor.salida.y);
  ctx.quadraticCurveTo(mejor.control.x, mejor.control.y, mejor.entrada.x, mejor.entrada.y);
  ctx.stroke();
  ctx.restore();
}

// Puntos del borde del chip por los que puede salir, cada uno con su normal y ya
// separados `h`. El chip es una píldora: tramos rectos arriba y abajo, y dos
// semicírculos en los extremos. Salir por un punto del semicírculo, en la
// dirección de su radio, también es salir a 90° del chip, y da muchas más rutas
// cortas y parejas que limitarse a los tramos rectos.
function bordesDelChip(chip, h) {
  const r = Math.min(chip.h / 2, chip.w / 2);
  const recto = Math.max(0, chip.w - 2 * r);
  const cy = chip.y + chip.h / 2;
  const puntos = [];
  const paso = Math.max(4, r / 6);
  for (let t = 0; t <= recto; t += paso) {
    puntos.push({ p: { x: chip.x + r + t, y: chip.y - h }, d: { x: 0, y: -1 } });
    puntos.push({ p: { x: chip.x + r + t, y: chip.y + chip.h + h }, d: { x: 0, y: 1 } });
  }
  for (let g = 0; g <= 180; g += 10) {
    const ang = ((90 + g) * Math.PI) / 180; // lado izquierdo, de abajo a arriba
    const d = { x: Math.cos(ang), y: Math.sin(ang) };
    puntos.push({ p: { x: chip.x + r + d.x * (r + h), y: cy + d.y * (r + h) }, d });
    puntos.push({
      p: { x: chip.x + chip.w - r - d.x * (r + h), y: cy + d.y * (r + h) },
      d: { x: -d.x, y: d.y },
    });
  }
  return puntos;
}

const cruz = (a, b) => a.x * b.y - a.y * b.x;

// Curva de una salida del chip a un punto del contorno. El quiebre es el cruce de
// la tangente de salida (normal del chip) con la de llegada (normal del
// producto): así la línea sale y llega a 90°. `asimetria` compara los dos tramos
// —del chip al quiebre y del quiebre al producto—; 1 es un arco perfectamente
// parejo.
function resolver(s, e) {
  const { d } = s;
  const { n } = e;
  const k = cruz(d, n);
  // Tangentes casi paralelas: el quiebre se iría al infinito.
  if (Math.abs(k) < 0.35) return null;

  // C = S + a·d = E + b·n, con v = E − S:  a = cruz(v, n) / k,  b = cruz(v, d) / k
  const v = { x: e.p.x - s.p.x, y: e.p.y - s.p.y };
  const a = cruz(v, n) / k;
  const b = cruz(v, d) / k;
  // Los dos tramos tienen que ir hacia delante: fuera del chip y fuera del producto.
  if (a <= 0 || b <= 0) return null;

  const control = { x: s.p.x + d.x * a, y: s.p.y + d.y * a };
  const asimetria = Math.max(a, b) / Math.min(a, b);
  const recta = Math.hypot(v.x, v.y);
  return {
    salida: s.p, control, entrada: e.p, tramoMin: Math.min(a, b), asimetria,
    // Cercanía y simetría pesan juntas: entre dos puntos a distancia parecida gana
    // el arco parejo, pero no se da un rodeo largo solo por serlo.
    nota: recta * (1 + 1.5 * (asimetria - 1)),
  };
}

function elegir(cfg, candidatas, tolerancia, tramoMinimo, ajenas, puesta, propioChip) {
  const validas = candidatas
    .filter((c) => c.asimetria <= tolerancia && c.tramoMin >= tramoMinimo)
    .sort((x, y) => x.nota - y.nota);
  return validas.find((c) => !cruza(cfg, c.salida, c.control, c.entrada, ajenas, puesta, propioChip)) || null;
}

// Puntos de llegada: el contorno del producto con su normal hacia fuera, ya
// separados `h` del borde. Sin contorno (el marcador de "falta la imagen") se
// usan los cuatro lados de la caja.
function entradasPosibles(puesta, h) {
  const salida = [];
  if (puesta.contorno && puesta.contorno.length) {
    for (const c of puesta.contorno) {
      const x = puesta.x + c.x * puesta.w;
      const y = puesta.y + c.y * puesta.h;
      salida.push({ p: { x: x + c.nx * h, y: y + c.ny * h }, n: { x: c.nx, y: c.ny } });
    }
    return salida;
  }
  const { x, y, w } = puesta;
  const alto = puesta.h;
  for (let i = 1; i < 20; i += 1) {
    const t = i / 20;
    salida.push({ p: { x: x + t * w, y: y - h }, n: { x: 0, y: -1 } });
    salida.push({ p: { x: x + t * w, y: y + alto + h }, n: { x: 0, y: 1 } });
    salida.push({ p: { x: x - h, y: y + t * alto }, n: { x: -1, y: 0 } });
    salida.push({ p: { x: x + w + h, y: y + t * alto }, n: { x: 1, y: 0 } });
  }
  return salida;
}

// ¿La curva pasa por encima de algo?
//
// `ajenas` están prohibidas en todo el recorrido. Del recorte propio se prohíben
// solo sus PÍXELES —no su caja, que trae aire transparente— y solo hasta el 90 %
// del trayecto, que es cuando ya llega. El chip propio también: la línea sale de
// su borde y no puede volver a entrar.
function cruza(cfg, p0, c, p1, ajenas, propia, propioChip) {
  const { f } = cfg;
  const pasos = 60;
  const borde = 40 * f;
  for (let i = 1; i <= pasos; i += 1) {
    const t = i / pasos;
    const u = 1 - t;
    const x = u * u * p0.x + 2 * u * t * c.x + t * t * p1.x;
    const y = u * u * p0.y + 2 * u * t * c.y + t * t * p1.y;
    if (x < borde || y < borde || x > cfg.ancho - borde || y > cfg.alto - borde) return true;
    if (ajenas.some((caja) => dentro(x, y, caja, 24 * f))) return true;
    if (propioChip && dentro(x, y, propioChip, -2 * f)) return true;
    if (t < 0.9 && sobreElProducto(x, y, propia, 10 * f)) return true;
  }
  return false;
}

const dentro = (x, y, [bx, by, bw, bh], margen) => x > bx - margen && x < bx + bw + margen
  && y > by - margen && y < by + bh + margen;

// ¿El punto cae sobre los píxeles del producto, o a menos de `margen` de ellos?
// Con máscara se mira el píxel y cuatro vecinos a esa distancia; sin ella (el
// marcador de "falta la imagen") cuenta la caja entera.
function sobreElProducto(x, y, puesta, margen) {
  const m = puesta.mascara;
  if (!m) {
    return x > puesta.x - margen && x < puesta.x + puesta.w + margen
      && y > puesta.y - margen && y < puesta.y + puesta.h + margen;
  }
  const opaco = (px, py) => {
    const gx = Math.floor(((px - puesta.x) / puesta.w) * m.w);
    const gy = Math.floor(((py - puesta.y) / puesta.h) * m.h);
    return gx >= 0 && gy >= 0 && gx < m.w && gy < m.h && m.datos[gy * m.w + gx] === 1;
  };
  return opaco(x, y) || opaco(x + margen, y) || opaco(x - margen, y)
    || opaco(x, y + margen) || opaco(x, y - margen);
}

const limitar = (v, min, max) => Math.min(Math.max(v, min), max);

// El ancho del chip depende del texto, así que se mide aparte: lo necesitan
// tanto el dibujo del bloque como el arranque de la punteada.
function medirChip(ctx, grupo, x, y, ancho) {
  ctx.save();
  ctx.font = fuente(700, ESTILO.chipFuente);
  const texto = recortar(ctx, grupo.chip, ancho - ESTILO.chipPadX * 2);
  const w = Math.min(ctx.measureText(texto).width + ESTILO.chipPadX * 2, ancho);
  ctx.restore();
  return { texto, x, y, w, h: ESTILO.chipAlto };
}

function fondo(ctx) {
  const { width: ancho, height: alto } = ctx.canvas;
  const g = ctx.createLinearGradient(0, 0, ancho, alto);
  g.addColorStop(0, ESTILO.fondoDe);
  g.addColorStop(1, ESTILO.fondoA);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, ancho, alto);

  // Halo tenue detrás del centro: da profundidad sin ensuciar el degradado.
  const halo = ctx.createRadialGradient(
    ancho * 0.5, alto * 0.55, 200,
    ancho * 0.5, alto * 0.55, ancho * 0.55,
  );
  halo.addColorStop(0, 'rgba(201, 247, 63, 0.055)');
  halo.addColorStop(1, 'rgba(201, 247, 63, 0)');
  ctx.fillStyle = halo;
  ctx.fillRect(0, 0, ancho, alto);
}

function cabecera(ctx, { kicker, titulo, etiqueta, logo }) {
  if (kicker) {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
    ctx.font = fuente(600, ESTILO.kickerFuente);
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(kicker.toUpperCase(), CABECERA.kicker[0], CABECERA.kicker[1]);
  }

  const [tx, ty, tmax] = CABECERA.titulo;
  const tam = ajustarTamano(ctx, titulo, tmax, ESTILO.tituloMax, ESTILO.pesoTitulo);
  ctx.fillStyle = ESTILO.blanco;
  ctx.font = fuente(ESTILO.pesoTitulo, tam);
  ctx.textBaseline = 'top';
  ctx.fillText(titulo, tx, ty);

  const anchoTitulo = ctx.measureText(titulo).width;

  if (etiqueta) {
    ctx.save();
    const chipTam = Math.round(tam * 0.30);
    ctx.font = fuente(700, chipTam);
    const w = ctx.measureText(etiqueta).width + ESTILO.chipPadX * 2;
    const h = chipTam * 1.85;
    const x = Math.min(tx + anchoTitulo - w * 0.35, ctx.canvas.width - ESTILO.margen - w);
    const y = ty + tam * 0.98;
    ctx.translate(x + w / 2, y + h / 2);
    ctx.rotate((-2.2 * Math.PI) / 180);
    pill(ctx, -w / 2, -h / 2, w, h, h / 2, ESTILO.lima);
    ctx.fillStyle = ESTILO.tinta;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';
    ctx.fillText(etiqueta, 0, 2);
    ctx.restore();
  }

  const [lx, ly, lw, lh] = CABECERA.logo;
  if (logo && logo.complete && logo.naturalWidth) {
    contener(ctx, logo, lx, ly, lw, lh, 'derecha');
  } else {
    // Sustituto tipográfico mientras no exista marca/logo-galilei.png.
    ctx.save();
    ctx.textAlign = 'right';
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = ESTILO.blanco;
    ctx.font = fuente(700, 108);
    ctx.fillText('galilei', lx + lw, ly + lh * 0.62);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.font = fuente(400, 52);
    ctx.fillText('learning', lx + lw, ly + lh * 1.0);
    ctx.restore();
  }
}

function dibujarImagen(ctx, grupo, [x, y, w, h], anclaY = 'abajo') {
  if (grupo.imagen && grupo.imagen.complete && grupo.imagen.naturalWidth) {
    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.55)';
    ctx.shadowBlur = 90;
    ctx.shadowOffsetY = 40;
    // En retícula se apoyan al pie para compartir suelo; en collage van centrados.
    const puesta = contener(ctx, grupo.imagen, x, y, w, h, 'centro', anclaY);
    ctx.restore();

    // Caja de los píxeles opacos: el PNG suele traer aire transparente alrededor
    // y la punteada tiene que apuntar al producto, no al vacío.
    return {
      ...puesta,
      perfil: grupo.imagen.perfil || null,
      perfilFilas: grupo.imagen.perfilFilas || null,
      contorno: grupo.imagen.contorno || null,
      mascara: grupo.imagen.mascara || null,
    };
  }

  // Marcador visible: que se note que a ese premio le falta el recorte.
  ctx.save();
  ctx.setLineDash([26, 22]);
  ctx.lineWidth = 6;
  ctx.strokeStyle = 'rgba(201, 247, 63, 0.45)';
  ctx.fillStyle = 'rgba(201, 247, 63, 0.05)';
  redondeado(ctx, x, y, w, h, 40);
  ctx.fill();
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = 'rgba(201, 247, 63, 0.75)';
  ctx.font = fuente(600, 54);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('Falta la imagen', x + w / 2, y + h / 2 - 34);
  ctx.font = fuente(400, 46);
  ctx.fillText(recortar(ctx, grupo.nombre, w - 120), x + w / 2, y + h / 2 + 36);
  ctx.restore();
  return { x, y, w, h, perfil: null, perfilFilas: null, producto: { x, y, w, h } };
}

// Deja la lista de ganadores lista para pintar: UNA VIÑETA POR NOMBRE, una línea
// cada uno. Se muestran hasta `minNombres` (5) y el resto se resume en una última
// línea "+N más". En los premios con desglose por monto, cada línea lleva delante
// lo que ganó esa persona, para que se lea sola.
//
// Se usa dos veces: al dibujar el bloque y al calcular su altura antes de colocar
// el recorte.
function lineasDeLista(ctx, grupo, ancho, maxLineas) {
  if (maxLineas <= 0) return { lineas: [] };
  ctx.save();
  ctx.font = fuenteGanadores(400, ESTILO.listaFuente);
  const disponible = ancho - ESTILO.listaPad * 2 - ESTILO.sangriaVineta;

  const entradas = grupo.montos && grupo.montos.length
    ? grupo.montos.flatMap((m) => m.nombres.map((n) => `${m.etiqueta} ${n}`.trim()))
    : (grupo.nombres || []);

  const tope = Math.max(1, ESTILO.minNombres);
  const lineas = entradas.slice(0, tope).map((texto) => ({
    texto: recortar(ctx, texto, disponible),
    vineta: true,
  }));

  const sobran = entradas.length - lineas.length;
  if (sobran > 0) lineas.push({ texto: `+${sobran} más`, vineta: false });

  ctx.restore();
  return { lineas };
}

function dibujarBloque(ctx, grupo, [x, y, ancho, maxLineas], sobreImagen = false) {
  // Chip verde con el conteo y el nombre del premio.
  const chip = medirChip(ctx, grupo, x, y, ancho);
  ctx.save();
  ctx.font = fuente(700, ESTILO.chipFuente);
  pill(ctx, x, y, chip.w, ESTILO.chipAlto, ESTILO.chipRadio, ESTILO.lima);
  ctx.fillStyle = ESTILO.tinta;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.fillText(chip.texto, x + ESTILO.chipPadX, y + ESTILO.chipAlto / 2 + 3);
  ctx.restore();

  const finChip = y + ESTILO.chipAlto;
  const sinLista = { fin: finChip, caja: [x, finChip, 0, 0] };
  if (maxLineas <= 0) return sinLista;

  ctx.save();
  ctx.font = fuenteGanadores(400, ESTILO.listaFuente);
  const { lineas } = lineasDeLista(ctx, grupo, ancho, maxLineas);
  if (!lineas.length) {
    ctx.restore();
    return sinLista;
  }

  // La caja se ajusta al texto: mide lo que mide la línea más larga, no el ancho
  // del bloque, para que no le sobre fondo a los lados.
  const masLarga = Math.max(...lineas.map((l) => ctx.measureText(l.texto).width));
  const cajaAncho = Math.min(
    ancho,
    Math.ceil(masLarga) + ESTILO.listaPad * 2 + ESTILO.sangriaVineta,
  );
  const cajaY = finChip + 34;
  const cajaAlto = ESTILO.listaPad * 2 + lineas.length * ESTILO.listaInterlinea;

  ctx.fillStyle = sobreImagen ? ESTILO.cajaFondoCollage : ESTILO.cajaFondo;
  ctx.strokeStyle = sobreImagen ? ESTILO.cajaBordeCollage : ESTILO.cajaBorde;
  ctx.lineWidth = 3;
  redondeado(ctx, x, cajaY, cajaAncho, cajaAlto, ESTILO.listaRadio);
  ctx.fill();
  ctx.stroke();

  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  lineas.forEach((linea, i) => {
    const ly = cajaY + ESTILO.listaPad + ESTILO.listaInterlinea * (i + 0.5);
    if (linea.vineta) {
      ctx.fillStyle = ESTILO.lima;
      ctx.fillText('•', x + ESTILO.listaPad, ly);
    }
    ctx.fillStyle = ESTILO.cajaTexto;
    ctx.fillText(linea.texto, x + ESTILO.listaPad + ESTILO.sangriaVineta, ly);
  });
  ctx.restore();

  return { fin: cajaY + cajaAlto, caja: [x, cajaY, cajaAncho, cajaAlto] };
}

/* ---------- utilidades ---------- */

function pill(ctx, x, y, w, h, r, relleno) {
  ctx.fillStyle = relleno;
  redondeado(ctx, x, y, w, h, Math.min(r, h / 2));
  ctx.fill();
}

export function redondeado(ctx, x, y, w, h, r) {
  const radio = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radio, y);
  ctx.arcTo(x + w, y, x + w, y + h, radio);
  ctx.arcTo(x + w, y + h, x, y + h, radio);
  ctx.arcTo(x, y + h, x, y, radio);
  ctx.arcTo(x, y, x + w, y, radio);
  ctx.closePath();
}

// Encaja la imagen en la caja midiendo por su PRODUCTO, no por el archivo: el
// aire transparente que rodea al recorte se sale de la caja (es invisible) y así
// el producto la llena y queda pegado a su bloque en vez de flotar en el centro.
// Devuelve el rectángulo dibujado completo, que es contra el que están medidos
// los perfiles de píxeles.
export function contener(ctx, img, x, y, w, h, anclaX = 'centro', anclaY = 'centro') {
  const c = img.caja || { x0: 0, y0: 0, x1: 1, y1: 1 };
  const anchoUtil = (c.x1 - c.x0) * img.naturalWidth;
  const altoUtil = (c.y1 - c.y0) * img.naturalHeight;
  const escala = Math.min(w / anchoUtil, h / altoUtil);

  const dw = img.naturalWidth * escala;
  const dh = img.naturalHeight * escala;
  const pw = anchoUtil * escala;
  const ph = altoUtil * escala;

  let px = x + (w - pw) / 2;
  if (anclaX === 'derecha') px = x + w - pw;
  if (anclaX === 'izquierda') px = x;

  let py = y + (h - ph) / 2;
  if (anclaY === 'abajo') py = y + h - ph;
  if (anclaY === 'arriba') py = y;

  const dx = px - c.x0 * dw;
  const dy = py - c.y0 * dh;
  ctx.drawImage(img, dx, dy, dw, dh);
  return { x: dx, y: dy, w: dw, h: dh, producto: { x: px, y: py, w: pw, h: ph } };
}

function ajustarTamano(ctx, texto, anchoMax, tamMax, peso) {
  let tam = tamMax;
  while (tam > 40) {
    ctx.font = fuente(peso, tam);
    if (ctx.measureText(texto).width <= anchoMax) break;
    tam -= 6;
  }
  return tam;
}

export function recortar(ctx, texto, anchoMax) {
  if (ctx.measureText(texto).width <= anchoMax) return texto;
  let corte = texto;
  while (corte.length > 1 && ctx.measureText(`${corte}…`).width > anchoMax) {
    corte = corte.slice(0, -1);
  }
  return `${corte.trimEnd()}…`;
}

// La pieza sale en JPG de calidad 0.9. En PNG pesaba 21 MB con siete premios —tanto
// que a veces la exportación se eternizaba— y en JPG son 1,6 MB: el error medio por
// píxel es de 0,9 sobre 255 (PSNR 43 dB), invisible incluso en el texto pequeño de las
// cajas grises y en el degradado del fondo, que es donde el JPG suele hacer bandas.
// Para volver a PNG: tipo 'image/png' y extension 'png' (la calidad se ignora).
export const SALIDA = { tipo: 'image/jpeg', calidad: 0.9, extension: 'jpg' };

// Siempre por `toBlob`: es asíncrono. `toDataURL` corre en el hilo de la interfaz y
// con un lienzo de 4788 x 6600 congela la pestaña mientras comprime.
export function aBlob(canvas) {
  return new Promise((resolve) => canvas.toBlob(resolve, SALIDA.tipo, SALIDA.calidad));
}

export function exportarImagen(canvas, nombre) {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = nombre;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
      resolve();
    }, SALIDA.tipo, SALIDA.calidad);
  });
}

/* ---------- el personaje ---------- */

// Una sola aparición por pieza: Gali o Syderax, pose al azar. Uno por pieza y no
// uno por premio a propósito — con siete estrellas verdes al lado de siete chips
// verde lima el producto deja de ser el protagonista.
//
// Va DETRÁS de todo (ver `dibujarPieza`: el fondo se pinta al final con
// `destination-over`) y se coloca en el HUECO MÁS GRANDE de la plantilla, centrado
// en él.
//
// La posición se calcula sobre las REGIONES DE LA PLANTILLA, no sobre las cajas
// que de verdad ocuparon los textos: así todas las piezas de la misma cantidad de
// premios sacan el personaje en el mismo sitio, aunque una traiga listas de
// ganadores más largas que otra. Y sale en fracciones del lienzo, no en píxeles,
// para que el sitio sea el mismo aunque el alto se haya recortado.
//
// Se puede guardar una posición a mano por cantidad de premios (la interfaz deja
// arrastrarlo): entonces manda esa y no se calcula nada.
//
// El azar de QUIÉN sale va con semilla (compañía y fecha): la misma pieza saca
// siempre el mismo personaje —si no, cambiaría de bicho en cada repintado de la
// vista previa—, pero cada compañía saca el suyo.
const PERSONAJE = {
  celda: 32,
  // Alto al que se dibuja cada uno, en píxeles del lienzo. Syderax va al doble.
  alto: { gali: 1150, syderax: 2300 },
  // Aire que se les deja a los premios al medir los huecos.
  holgura: 60,
  // Fracción máxima del personaje que puede quedar tapada o fuera del lienzo.
  maxOculto: 0.3,
  // La cabeza se protege aparte: que a un personaje le tapen la cola es una cosa
  // y que le caiga un chip en la cara es otra, aunque el porcentaje total salga
  // igual. `cabeza` es la fracción de su alto que se considera cabeza.
  cabeza: 0.38,
  maxOcultoCabeza: 0.12,
  // Si centrado no cumple, se le deja rebuscar alrededor del centro del hueco:
  // esta fracción de su propio tamaño. Poco a propósito — cuanto más lejos del
  // centro acabe, más cara de puesto al azar tiene.
  margenBusqueda: 0.45,
  // Si aun así no encuentra sitio, encoge hasta aquí antes de renunciar.
  minEncogido: 0.55,
  // Un hueco más estrecho que esto no es un hueco.
  minHueco: 420,
};

function azarConSemilla(texto) {
  let h = 2166136261;
  for (let i = 0; i < texto.length; i += 1) {
    h ^= texto.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return () => {
    h += 0x6d2b79f5;
    let t = h;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Quién sale en esta pieza. Se resuelve aparte de dónde se pone, porque la
// interfaz necesita saberlo para dibujar el asa de arrastre.
export function personajeDe(personajes, semilla) {
  if (!personajes || !personajes.length) return null;
  const azar = azarConSemilla(semilla || 'pieza');
  const img = personajes[Math.floor(azar() * personajes.length) % personajes.length];
  return img && img.complete && img.naturalWidth ? img : null;
}

// Alto al que se dibuja: Syderax al doble que Gali, por nombre de archivo.
function altoDe(img) {
  return /syderax/i.test(img.nombre || '') ? PERSONAJE.alto.syderax : PERSONAJE.alto.gali;
}

// Lo que ocupa en el lienzo, medido por su caja de píxeles: el aire transparente
// de un PNG recortado no es parte del personaje ni para el tamaño ni para el
// tapado. `centro` va en píxeles absolutos del lienzo, como toda la geometría de
// la pieza: así queda en el mismo punto respecto de los premios, que también
// están en absolutas, y no se corre cuando el lienzo se recorta más o menos.
export function rectPersonaje(img, centro, escala = 1) {
  const caja = img.caja || { x0: 0, y0: 0, x1: 1, y1: 1 };
  const anchoUtil = (caja.x1 - caja.x0) * img.naturalWidth;
  const altoUtil = (caja.y1 - caja.y0) * img.naturalHeight;
  const h = altoDe(img) * escala;
  const w = h * (anchoUtil / altoUtil);
  return { x: centro.x - w / 2, y: centro.y - h / 2, w, h };
}

// Rejilla de ocupación. Devuelve la rejilla en crudo —para buscar huecos— y una
// suma acumulada, con la que preguntar en cuatro lecturas qué fracción de un
// rectángulo cualquiera está pisada.
function mapaOcupacion(ancho, alto, ocupados, holgura) {
  const c = PERSONAJE.celda;
  const cols = Math.ceil(ancho / c);
  const filas = Math.ceil(alto / c);
  const rejilla = new Uint8Array(cols * filas);

  ocupados.forEach(([x, y, w, h]) => {
    const x0 = Math.max(0, Math.floor((x - holgura) / c));
    const x1 = Math.min(cols - 1, Math.ceil((x + w + holgura) / c));
    const y0 = Math.max(0, Math.floor((y - holgura) / c));
    const y1 = Math.min(filas - 1, Math.ceil((y + h + holgura) / c));
    for (let f = y0; f <= y1; f += 1) {
      for (let k = x0; k <= x1; k += 1) rejilla[f * cols + k] = 1;
    }
  });

  const suma = new Int32Array((cols + 1) * (filas + 1));
  for (let f = 0; f < filas; f += 1) {
    for (let k = 0; k < cols; k += 1) {
      suma[(f + 1) * (cols + 1) + k + 1] = rejilla[f * cols + k]
        + suma[f * (cols + 1) + k + 1]
        + suma[(f + 1) * (cols + 1) + k]
        - suma[f * (cols + 1) + k];
    }
  }

  // Fracción del rectángulo que está tapada o fuera del lienzo. Lo que se sale
  // cuenta como oculto: da igual que a un personaje le tape media ala un recorte
  // o que se le quede fuera del papel.
  const oculto = (x, y, w, h) => {
    const celdas = Math.max(1, Math.round((w / c) * (h / c)));
    const x0 = Math.max(0, Math.floor(x / c));
    const x1 = Math.min(cols, Math.ceil((x + w) / c));
    const y0 = Math.max(0, Math.floor(y / c));
    const y1 = Math.min(filas, Math.ceil((y + h) / c));
    if (x1 <= x0 || y1 <= y0) return 1;

    const dentro = (x1 - x0) * (y1 - y0);
    const pisadas = suma[y1 * (cols + 1) + x1]
      - suma[y0 * (cols + 1) + x1]
      - suma[y1 * (cols + 1) + x0]
      + suma[y0 * (cols + 1) + x0];
    return (pisadas + (celdas - dentro)) / celdas;
  };

  return { rejilla, cols, filas, oculto };
}

// El hueco donde mejor entra un personaje de esta proporción. Se recorren los
// rectángulos libres por el método del histograma y gana el que deje meter al
// personaje más grande — no el de más área: una franja ancha y plana tiene mucha
// área y no sirve para un bicho de pie.
function mejorHueco(mapa, proporcion) {
  const c = PERSONAJE.celda;
  const { rejilla, cols, filas } = mapa;
  const altura = new Uint16Array(cols);
  let mejor = null;

  for (let f = 0; f < filas; f += 1) {
    for (let k = 0; k < cols; k += 1) {
      altura[k] = rejilla[f * cols + k] ? 0 : altura[k] + 1;
    }

    const pila = [];
    for (let k = 0; k <= cols; k += 1) {
      const h = k === cols ? 0 : altura[k];
      while (pila.length && altura[pila[pila.length - 1]] >= h) {
        const alt = altura[pila.pop()];
        const izq = pila.length ? pila[pila.length - 1] + 1 : 0;
        const ancho = (k - izq) * c;
        const alto = alt * c;
        if (alt) {
          // Puntúa el personaje que cabe dentro, no el tamaño del hueco.
          const cabe = Math.min(alto, ancho / proporcion);
          const nota = cabe * 1000 + (ancho * alto) / 1e6;
          if (!mejor || nota > mejor.nota) {
            mejor = { nota, x: izq * c, y: (f - alt + 1) * c, w: ancho, h: alto };
          }
        }
      }
      pila.push(k);
    }
  }
  return mejor;
}

// Dónde pondría el personaje por su cuenta, en píxeles del lienzo. Se calcula
// sobre las regiones de la plantilla, no sobre las cajas que de verdad ocuparon
// los textos, así que para una misma cantidad de premios y un mismo modo siempre
// da lo mismo.
export function posicionAutomatica(img, cantidad, modo) {
  if (!img) return null;

  const ancho = LIENZO.ancho;
  const alto = altoLienzo(cantidad, modo);
  const slots = plantillaPara(cantidad, modo);

  // Región de cada premio: lo que la plantilla le reserva, bloque y recorte
  // juntos. No se miden las cajas reales a propósito (ver arriba).
  const regiones = slots.map((s) => {
    const izquierda = Math.min(s.bloque[0], s.img[0]);
    const derecha = Math.max(s.bloque[0] + s.bloque[1], s.img[0] + s.img[1]);
    return [izquierda, s.y, derecha - izquierda, s.hasta - s.y];
  });
  regiones.push([0, 0, ancho, CABECERA.titulo[1] + ESTILO.tituloMax]);

  const mapa = mapaOcupacion(ancho, alto, regiones, PERSONAJE.holgura);
  const base = rectPersonaje(img, { x: 0, y: 0 });
  const proporcion = base.w / base.h;

  // Sin un hueco decente —pasa cuando la plantilla deja el lienzo casi lleno— se
  // asoma por la esquina de abajo a la derecha en vez de no salir. Un personaje
  // que no se dibuja tampoco se puede arrastrar, y entonces no habría manera de
  // colocarlo a mano.
  const deReserva = () => {
    const f = PERSONAJE.minEncogido;
    return { x: ancho - base.w * f * 0.42, y: alto - base.h * f * 0.5, escala: f };
  };

  const hueco = mejorHueco(mapa, proporcion);
  if (!hueco || Math.min(hueco.w, hueco.h) < PERSONAJE.minHueco) return deReserva();

  const centro = { x: hueco.x + hueco.w / 2, y: hueco.y + hueco.h / 2 };

  // Se prueba su alto y, si no hay manera, se va encogiendo.
  for (let f = 1; f >= PERSONAJE.minEncogido; f -= 0.1) {
    const h = base.h * f;
    const w = base.w * f;
    const paso = PERSONAJE.celda;
    const radio = Math.max(w, h) * PERSONAJE.margenBusqueda;

    // Se empieza en el centro justo del hueco y se abre hacia fuera: la primera
    // posición que cumple es la más cercana al centro, así que el personaje sale
    // centrado siempre que pueda y solo se corre lo justo cuando no.
    for (let dy = 0; dy <= radio; dy += paso) {
      for (let dx = 0; dx <= radio; dx += paso) {
        for (const [sx, sy] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) {
          const x = centro.x - w / 2 + dx * sx;
          const y = centro.y - h / 2 + dy * sy;
          if (mapa.oculto(x, y, w, h) > PERSONAJE.maxOculto) continue;
          if (mapa.oculto(x, y, w, h * PERSONAJE.cabeza) > PERSONAJE.maxOcultoCabeza) continue;
          return { x: x + w / 2, y: y + h / 2, escala: f };
        }
      }
    }
  }

  return deReserva();
}

// Pinta el personaje en la posición que le den, en píxeles del lienzo.
function dibujarPersonaje(ctx, personaje) {
  if (!personaje || !personaje.img || !personaje.centro) return null;
  const { img, centro, escala = 1 } = personaje;
  const { x, y, w, h } = rectPersonaje(img, centro, escala);

  ctx.save();
  // Detrás de lo ya pintado. El fondo entra después, también por debajo.
  ctx.globalCompositeOperation = 'destination-over';
  contener(ctx, img, x, y, w, h);
  ctx.restore();

  return [x, y, w, h];
}
