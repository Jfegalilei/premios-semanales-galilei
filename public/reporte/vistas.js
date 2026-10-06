// Paso 4 del reporte para clientes: qué partes del reporte salen para la
// compañía elegida. Por defecto, todo lo que tiene contratado; desde aquí se
// puede apagar training o reseñas para mandar solo una cosa, y prender la hoja
// que pide las metas, que viene apagada. Se recuerda por compañía en este
// navegador (es una elección de quien arma el PDF, no un dato del equipo).

const CLAVE = 'reporte.ocultos';
// `de`: lo contratado que hace falta para que salga el interruptor.
// `apagada`: viene apagada hasta que se prenda.
const PARTES = [
  { id: 'training', nombre: 'Training', de: 'training' },
  { id: 'metas', nombre: 'Pedir metas', de: 'metas', apagada: true },
  { id: 'reviews', nombre: 'Reseñas', de: 'reviews' },
];

// Si una parte está apagada para la compañía: lo que se eligió o, si nunca se
// tocó, como viene.
const apagada = (fuera, id) => (id in fuera ? fuera[id] : Boolean(PARTES.find((p) => p.id === id)?.apagada));

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
        training: contratado.training && !apagada(fuera, 'training'),
        reviews: contratado.reviews && !apagada(fuera, 'reviews'),
        // Las metas van con training: si se apaga, se van con él.
        metas: contratado.metas && !apagada(fuera, 'training') && !apagada(fuera, 'metas'),
      };
    },

    pintar(compania, contratado) {
      const fuera = ocultos[compania] || {};
      const partes = PARTES.filter((p) => contratado[p.de]);
      raiz.hidden = !partes.length;
      raiz.querySelector('.interruptores').replaceChildren(...partes.map((p) => {
        const label = document.createElement('label');
        label.className = 'interruptor';
        const input = document.createElement('input');
        input.type = 'checkbox';
        input.checked = !apagada(fuera, p.id);
        // Pedir metas va con training: con training apagado, no se puede prender.
        if (p.id === 'metas' && apagada(fuera, 'training')) {
          input.disabled = true;
          label.title = 'Prende Training para poder pedir las metas';
        }
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
