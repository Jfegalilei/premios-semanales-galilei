// Paso 4 del reporte para clientes: el logo de la compañía elegida. Si aún no lo
// tiene, se sube aquí mismo: se pasa a blanco (`lib/logos.js`) y se guarda en
// Firestore para todo el equipo, el mismo que usa la pieza semanal. Solo se
// escribe `logo`: el nombre del cliente se edita aparte.

import { guardarCliente } from '../lib/nube.js';
import { logoEnBlanco, leerComoDataUrl } from '../lib/logos.js';
import { slug } from '../lib/normalizador.js';

const $ = (sel) => document.querySelector(sel);

/**
 * @param {{ compania: () => string | null, alError: (err) => void }} op
 *   `compania` dice cuál está elegida en el momento de subir o quitar.
 * @returns {{ pintar: (compania: string, logo: HTMLImageElement | null) => void }}
 */
export function montarLogoCliente({ compania, alError }) {
  const etiqueta = $('#etiquetaLogoCliente');
  $('#entradaLogoCliente').addEventListener('change', async (e) => {
    const archivo = e.target.files[0];
    e.target.value = '';
    const nombre = compania();
    if (!archivo || !nombre) return;
    etiqueta.classList.add('ocupado');
    $('#textoLogoCliente').textContent = 'Subiendo…';
    try {
      const logo = await logoEnBlanco(await leerComoDataUrl(archivo));
      await guardarCliente(slug(nombre), { logo });
    } catch (err) {
      alError(err);
      alert(`No se pudo subir el logo: ${err.message}`);
    } finally {
      etiqueta.classList.remove('ocupado');
    }
  });
  $('#botonQuitarLogo').addEventListener('click', () => {
    const nombre = compania();
    if (nombre) guardarCliente(slug(nombre), { logo: '' }).catch(alError);
  });

  return {
    pintar(nombre, logo) {
      const miniatura = $('#miniaturaLogo');
      if (logo) {
        const img = document.createElement('img');
        img.src = logo.src;
        img.alt = `Logo de ${nombre}`;
        miniatura.replaceChildren(img);
      } else {
        miniatura.textContent = 'Sin logo';
      }
      $('#textoLogoCliente').textContent = logo ? 'Cambiar logo' : 'Subir logo';
      $('#botonQuitarLogo').hidden = !logo;
    },
  };
}
