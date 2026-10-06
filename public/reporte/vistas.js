// Paso 4 del reporte para clientes: qué partes del reporte salen para la
// compañía elegida. Por defecto, todo lo que tiene contratado; desde aquí se
// puede apagar training o reseñas para mandar solo una cosa. Se recuerda por
// compañía en este navegador (es una elección de quien arma el PDF, no un dato
// del equipo).

const CLAVE = 'reporte.ocultos';
const PARTES = [
  { id: 'training', nombre: 'Training' },
  { id: 'reviews', nombre: 'Reseñas' },
];

function leer() {
  try {
    return JSON.parse(localStorage.getItem(CLAVE)) || {};
  } catch {
    return {};
  }
}

function guardar(ocultos) {
  try {
    localStorage.setItem(CLAVE, JSON.stringify(ocultos));
  } catch {
    // Sin almacenamiento (modo privado): la elección dura lo que dure la página.
  }
}

/**
 * @param {HTMLElement} raiz  donde van los interruptores.
 * @param {{ alCambiar: () => void }} op
 */
export function montarVistas(raiz, { alCambiar }) {
  const ocultos = leer();

  return {
    // Lo que sale de una compañía: lo contratado menos lo que se apagó.
    visibles(compania, contratado) {
      const fuera = ocultos[compania] || {};
      return {
        training: contratado.training && !fuera.training,
        reviews: contratado.reviews && !fuera.reviews,
      };
    },

    pintar(compania, contratado) {
      const fuera = ocultos[compania] || {};
      const partes = PARTES.filter((p) => contratado[p.id]);
      raiz.hidden = !partes.length;
      raiz.querySelector('.interruptores').replaceChildren(...partes.map((p) => {
        const label = document.createElement('label');
        label.className = 'interruptor';
        const input = document.createElement('input');
        input.type = 'checkbox';
        input.checked = !fuera[p.id];
        input.addEventListener('change', () => {
          ocultos[compania] = { ...(ocultos[compania] || {}), [p.id]: !input.checked };
          guardar(ocultos);
          alCambiar();
        });
        const texto = document.createElement('span');
        texto.textContent = p.nombre;
        label.append(input, texto);
        return label;
      }));
    },
  };
}
