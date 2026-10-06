// Logos de los clientes, compartidos por la pieza semanal y el reporte para
// clientes: se guardan ya en blanco en Firestore (`clientes`) y salen en la
// cabecera de las piezas en lugar del nombre escrito.

import { cargarImagen } from './imagenes.js';

export function leerComoDataUrl(archivo) {
  return new Promise((resolve, reject) => {
    const lector = new FileReader();
    lector.onload = () => resolve(lector.result);
    lector.onerror = () => reject(lector.error);
    lector.readAsDataURL(archivo);
  });
}

// Pasa el logo a una máscara blanca: se conserva solo la silueta y todo lo que
// se ve queda en blanco puro, sea del color que sea.
//
// - Con transparencia (PNG, SVG, WebP): la silueta es el canal alfa.
// - Sin transparencia (JPG, o un PNG con fondo): no hay alfa que usar, así que
//   se toma como fondo el color de las esquinas y cada píxel se vuelve tanto más
//   opaco cuanto más se aleja de él. Un logo oscuro sobre blanco o uno claro
//   sobre un color sale igual de limpio.
//
// Después se recorta el aire transparente de los bordes —así se alinea por el
// dibujo— y se guarda en WebP a un tamaño de sobra para la cabecera.
export async function logoEnBlanco(dataUrl) {
  const img = await cargarImagen(dataUrl);
  const escala = Math.min(1, 1600 / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.max(1, Math.round(img.naturalWidth * escala));
  const h = Math.max(1, Math.round(img.naturalHeight * escala));
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0, w, h);
  const datos = ctx.getImageData(0, 0, w, h);
  const p = datos.data;

  let transparentes = 0;
  for (let i = 3; i < p.length; i += 4) if (p[i] < 250) transparentes += 1;
  const conAlfa = transparentes > (p.length / 4) * 0.01;

  let fondo = null;
  if (!conAlfa) {
    const esquinas = [0, w - 1, (h - 1) * w, h * w - 1].map((k) => [p[k * 4], p[k * 4 + 1], p[k * 4 + 2]]);
    fondo = [0, 1, 2].map((canal) => esquinas.reduce((suma, e) => suma + e[canal], 0) / 4);
  }

  let x0 = w;
  let y0 = h;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const i = (y * w + x) * 4;
      let a = p[i + 3];
      if (fondo) {
        const d = Math.hypot(p[i] - fondo[0], p[i + 1] - fondo[1], p[i + 2] - fondo[2]);
        // Por debajo de 24 es ruido de compresión; hacia 120 ya es tinta plena.
        a = Math.round(Math.min(1, Math.max(0, (d - 24) / 96)) * 255);
      }
      p[i] = 255;
      p[i + 1] = 255;
      p[i + 2] = 255;
      p[i + 3] = a;
      if (a > 12) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  if (x1 < 0) throw new Error('el logo quedó vacío: no se encontró ningún dibujo en la imagen.');
  ctx.putImageData(datos, 0, 0);

  const recorte = document.createElement('canvas');
  recorte.width = x1 - x0 + 1;
  recorte.height = y1 - y0 + 1;
  recorte.getContext('2d').drawImage(c, x0, y0, recorte.width, recorte.height, 0, 0, recorte.width, recorte.height);

  // La cabecera lo pinta a ~55 px de alto (110 en el JPG exportado): con 400 de
  // alto o 1200 de ancho sobra, y pesa poco dentro del documento de Firestore.
  const final = Math.min(1, 400 / recorte.height, 1200 / recorte.width);
  const salida = document.createElement('canvas');
  salida.width = Math.max(1, Math.round(recorte.width * final));
  salida.height = Math.max(1, Math.round(recorte.height * final));
  salida.getContext('2d').drawImage(recorte, 0, 0, salida.width, salida.height);
  const url = salida.toDataURL('image/webp', 0.92);
  if (url.length > 280000) throw new Error('el logo pesa demasiado incluso comprimido.');
  return url;
}
