// Salida del reporte para clientes: el PDF de una compañía, el ZIP con varios y
// la descarga en el navegador. No sabe nada de los datos: recibe lienzos ya
// dibujados.

import { CARRUSEL } from '../lib/carrusel.js';

// Una página por hoja, del mismo tamaño que la pieza de celular. Las unidades
// del PDF son las de la hoja (1080 × 1792): las zonas con enlace van tal cual.
export function pdfDe(hojas, enlaces = []) {
  const { jsPDF } = window.jspdf;
  const { ancho, alto } = CARRUSEL;
  const pdf = new jsPDF({ unit: 'pt', format: [ancho, alto], orientation: 'portrait' });
  hojas.forEach((canvas, i) => {
    if (i) pdf.addPage([ancho, alto], 'portrait');
    pdf.addImage(canvas.toDataURL('image/jpeg', 0.9), 'JPEG', 0, 0, ancho, alto);
    for (const e of enlaces.filter((x) => x.hoja === i)) pdf.link(e.x, e.y, e.w, e.h, { url: e.url });
  });
  return pdf.output('blob');
}

/**
 * ZIP con un archivo por entrada. Cada `crear()` se llama de a uno, con un
 * respiro entre medio para que `alProgreso(n, total)` alcance a pintarse.
 *
 * @param {{ nombre: string, crear: () => Promise<Blob> | Blob }[]} entradas
 */
export async function zipDe(entradas, alProgreso = () => {}) {
  const zip = new window.JSZip();
  for (const [i, e] of entradas.entries()) {
    alProgreso(i + 1, entradas.length);
    await new Promise((r) => setTimeout(r, 0));
    zip.file(e.nombre, await e.crear());
  }
  return zip.generateAsync({ type: 'blob', compression: 'STORE' });
}

export function descargarBlob(blob, nombre) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nombre;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
