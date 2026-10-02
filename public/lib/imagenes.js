// Carga de imágenes y medición de sus píxeles opacos. Lo usan la pieza semanal
// (`app.js`) y el reporte para clientes (`reporte.js`).

// Las poses de Gali. Se listan en Assets/Personajes/lista.json, así que añadir una pose
// es soltar el WebP en la carpeta y apuntarlo en la lista. Se les mide la caja de píxeles
// igual que a los premios, para encajarlos por el dibujo y no por el aire transparente.
export async function listaDePersonajes() {
  const res = await fetch('Assets/Personajes/lista.json').catch(() => null);
  const datos = res && res.ok ? await res.json() : {};
  const rutas = datos.personajes || [];
  const cargadas = await Promise.all(rutas.map(async (ruta) => {
    // Con `?v=` para saltarse la caché: si se reemplaza un PNG en la carpeta,
    // recargar la página tiene que traer el nuevo, no el que guardó el navegador.
    const url = `${ruta.split('/').map(encodeURIComponent).join('/')}?v=${Date.now()}`;
    const img = await cargarImagen(url).catch(() => null);
    if (!img) return null;
    img.nombre = ruta;
    img.caja = cajaDelProducto(perfilesOpacos(img).columnas);
    return img;
  }));
  return cargadas.filter(Boolean);
}

// Escenarios de fondo de la pieza de celular, ya recortados a 1080 x 1792 y
// listados en Assets/Fondos/lista.json. Van a sangre y muy oscurecidos, así que
// no se les mide la caja de píxeles: se dibujan a `cover` y punto.
export async function listaDeFondos() {
  const res = await fetch('Assets/Fondos/lista.json').catch(() => null);
  const datos = res && res.ok ? await res.json() : {};
  const cargadas = await Promise.all((datos.fondos || []).map(async (ruta) => {
    const url = ruta.split('/').map(encodeURIComponent).join('/');
    const img = await cargarImagen(url).catch(() => null);
    if (img) img.nombre = ruta;
    return img;
  }));
  return cargadas.filter(Boolean);
}

export function cargarImagen(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`No se pudo cargar ${src}`));
    img.src = src;
  });
}

// Perfil de píxeles opacos por columna: para cada una de las 72 franjas
// verticales de la imagen, dónde empieza y dónde termina el producto (en
// fracciones del alto). Null si esa franja está vacía.
//
// La punteada lo usa para terminar justo donde arrancan los píxeles, no en el
// borde de la caja — que en un PNG recortado suele ser fondo transparente.
// Se mide sobre una copia reducida: sobra de precisión y evita recorrer millones
// de píxeles por imagen.
export function perfilesOpacos(img) {
  try {
    const columnas = 72;
    const escala = Math.min(240 / img.naturalWidth, 240 / img.naturalHeight, 1);
    const w = Math.max(columnas, Math.round(img.naturalWidth * escala));
    const h = Math.max(1, Math.round(img.naturalHeight * escala));

    const aux = document.createElement('canvas');
    aux.width = w;
    aux.height = h;
    const ctx = aux.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(img, 0, 0, w, h);
    const { data } = ctx.getImageData(0, 0, w, h);

    // Se recorre una sola vez guardando, por franja, el primer y el último píxel
    // opaco: en vertical para las columnas y en horizontal para las filas.
    const cols = Array.from({ length: columnas }, () => null);
    const filas = Array.from({ length: columnas }, () => null);
    const anota = (lista, i, v) => {
      const p = lista[i];
      if (!p) lista[i] = { y0: v, y1: v };
      else if (v < p.y0) p.y0 = v;
      else if (v > p.y1) p.y1 = v;
    };

    for (let y = 0; y < h; y += 1) {
      const filaIdx = Math.min(columnas - 1, Math.floor((y / h) * columnas));
      for (let x = 0; x < w; x += 1) {
        if (data[(y * w + x) * 4 + 3] > 24) {
          anota(cols, Math.min(columnas - 1, Math.floor((x / w) * columnas)), y / h);
          anota(filas, filaIdx, x / w);
        }
      }
    }
    const cerrar = (lista) => lista.map((p) => (p ? { y0: p.y0, y1: Math.min(1, p.y1 + 1 / columnas) } : null));
    return {
      columnas: cols.some(Boolean) ? cerrar(cols) : null,
      filas: filas.some(Boolean) ? cerrar(filas) : null,
      ...contornoOpaco(data, w, h),
    };
  } catch {
    // Un PNG de otro origen ensuciaría el canvas: sin perfil, la línea usa la caja.
    return { columnas: null, filas: null, contorno: null, mascara: null };
  }
}

// Borde del producto con su normal hacia fuera, para que la punteada llegue a 90°
// del dibujo real y no de su caja. La normal sale del gradiente de la silueta
// suavizada: sin suavizar, los escalones de píxel darían normales a 0° o 90°.
//
// Se queda un punto por celda de 3x3 px de la copia reducida (unos cientos por
// imagen) y la máscara binaria, con la que la línea comprueba que no pisa el
// producto.
function contornoOpaco(data, w, h) {
  const mascara = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i += 1) mascara[i] = data[i * 4 + 3] > 24 ? 1 : 0;

  // Desenfoque de caja separable, radio 3.
  const r = 3;
  const tmp = new Float32Array(w * h);
  const suave = new Float32Array(w * h);
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      let s = 0;
      for (let k = -r; k <= r; k += 1) s += mascara[y * w + Math.min(w - 1, Math.max(0, x + k))];
      tmp[y * w + x] = s / (2 * r + 1);
    }
  }
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      let s = 0;
      for (let k = -r; k <= r; k += 1) s += tmp[Math.min(h - 1, Math.max(0, y + k)) * w + x];
      suave[y * w + x] = s / (2 * r + 1);
    }
  }

  const val = (x, y) => (x < 0 || y < 0 || x >= w || y >= h ? 0 : suave[y * w + x]);
  const opaco = (x, y) => x >= 0 && y >= 0 && x < w && y < h && mascara[y * w + x] === 1;
  const celdas = new Set();
  const contorno = [];
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      if (!opaco(x, y)) continue;
      if (opaco(x - 1, y) && opaco(x + 1, y) && opaco(x, y - 1) && opaco(x, y + 1)) continue;
      const celda = `${Math.floor(x / 3)},${Math.floor(y / 3)}`;
      if (celdas.has(celda)) continue;
      const gx = val(x + 2, y) - val(x - 2, y);
      const gy = val(x, y + 2) - val(x, y - 2);
      const largo = Math.hypot(gx, gy);
      if (largo < 0.05) continue; // pelos sueltos: sin dirección clara
      celdas.add(celda);
      contorno.push({ x: (x + 0.5) / w, y: (y + 0.5) / h, nx: -gx / largo, ny: -gy / largo });
    }
  }
  return { contorno: contorno.length ? contorno : null, mascara: { w, h, datos: mascara } };
}

// Rectángulo que ocupa el producto dentro del PNG, en fracciones. Se deriva del
// perfil de columnas y sirve para encajar por los píxeles y no por el archivo:
// así el producto llena su caja en vez de flotar dentro del aire transparente.
export function cajaDelProducto(columnas) {
  if (!columnas || !columnas.length) return null;
  const n = columnas.length;
  let x0 = 1;
  let x1 = 0;
  let y0 = 1;
  let y1 = 0;
  columnas.forEach((c, i) => {
    if (!c) return;
    x0 = Math.min(x0, i / n);
    x1 = Math.max(x1, (i + 1) / n);
    y0 = Math.min(y0, c.y0);
    y1 = Math.max(y1, c.y1);
  });
  return x1 > x0 && y1 > y0 ? { x0, y0, x1, y1 } : null;
}
