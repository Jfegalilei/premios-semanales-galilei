// Pasos 1 y 2 del reporte para clientes: las queries para Analytics Chat y la
// zona donde se sueltan los CSV. Solo pinta y avisa; qué hacer con los archivos
// lo decide quien llama.

import { CONSULTAS, INSTRUCCION } from '../lib/consultas.js';

// Una tarjeta por query: qué trae, cuánto mide, el botón de copiar (ya con la
// instrucción para el chat delante) y el SQL plegado.
export function pintarConsultas(contenedor) {
  contenedor.replaceChildren(...CONSULTAS.map(tarjetaConsulta));
}

function tarjetaConsulta(c) {
  const texto = INSTRUCCION + c.sql;
  const caja = document.createElement('article');
  caja.className = 'consulta';
  caja.innerHTML = `
    <header><h3></h3><button type="button" class="boton primario">Copiar</button></header>
    <p class="tenue descripcion"></p>
    <p class="meta"><span class="largo"></span></p>
    <details><summary>Ver SQL</summary><pre></pre></details>`;
  caja.querySelector('h3').textContent = c.titulo;
  caja.querySelector('.descripcion').textContent = c.descripcion || '';
  caja.querySelector('.largo').textContent = `${texto.length.toLocaleString('es-CO')} caracteres`;
  if (c.soloPara) {
    const solo = document.createElement('span');
    solo.className = 'solo';
    solo.textContent = `· ${c.soloPara}`;
    caja.querySelector('.meta').appendChild(solo);
  }
  caja.querySelector('pre').textContent = texto;

  const boton = caja.querySelector('button');
  boton.addEventListener('click', async () => {
    await navigator.clipboard.writeText(texto);
    boton.textContent = 'Copiada';
    setTimeout(() => { boton.textContent = 'Copiar'; }, 1500);
  });
  return caja;
}

// Qué datos hay, en pastillas bajo la zona de carga: de cada query, si está y
// cuándo se subió por última vez (`subidas`, de lo guardado para el equipo).
export function pintarArchivos(contenedor, datos, { ejemplo = false, subidas = {} } = {}) {
  const cuando = (consulta) => {
    const s = subidas[consulta];
    if (!s) return '';
    const fecha = new Date(s.subido).toLocaleString('es-CO', {
      day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
    });
    return ` · subida ${fecha}`;
  };
  const pastillas = [
    ejemplo && [true, 'Ejemplo con datos inventados'],
    [datos.resumenes.length > 0, `Query 1 · Conocimiento${cuando('conocimiento')}`],
    [datos.companias.length > 0, `Query 2 · Compañías y premios${cuando('premios')}`],
    [datos.fichas.length > 0, `Query 3 · Reseñas${cuando('reviews')}`],
    [datos.autecos.length > 0, `Query 4 · Lotería Auteco${cuando('auteco')}`],
  ].filter(Boolean);
  contenedor.replaceChildren(...pastillas.map(([listo, texto]) => {
    const span = document.createElement('span');
    span.className = listo ? 'listo' : '';
    span.textContent = `${listo ? '✓ ' : ''}${texto}`;
    return span;
  }));
}

// Arrastrar CSV a cualquier parte de la página: la zona se ilumina mientras
// tanto y `alSoltar` recibe solo los .csv.
export function escucharArrastre(zona, alSoltar) {
  ['dragenter', 'dragover'].forEach((ev) => document.addEventListener(ev, (e) => {
    e.preventDefault();
    zona.classList.add('activa');
  }));
  ['dragleave', 'drop'].forEach((ev) => document.addEventListener(ev, (e) => {
    e.preventDefault();
    if (ev === 'dragleave' && e.relatedTarget) return;
    zona.classList.remove('activa');
  }));
  document.addEventListener('drop', (e) => {
    alSoltar([...(e.dataTransfer?.files || [])].filter((f) => /\.csv$/i.test(f.name)));
  });
}
