// Paso 4 del reporte para clientes: qué partes del reporte salen para la
// compañía elegida. Por defecto, todo lo que tiene contratado; desde aquí se
// puede apagar training o reseñas para mandar solo una cosa, y prender la hoja
// que pide las metas, que viene apagada.
//
// Lo que se elige es del equipo: se guarda en Firestore, en el documento de la
// compañía en `clientes` (campo `ocultos`, junto al nombre y el logo), y le sale
// igual a cualquiera que abra la página, desde donde sea. Antes vivía en el
// navegador (`localStorage`, `reporte.ocultos`); lo que quede ahí se sube una
// vez y se borra.

import { slug } from '../lib/normalizador.js';

const CLAVE_VIEJA = 'reporte.ocultos';
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

// Lo que quedó en este navegador de antes ({ compañía: { parte: apagada } }).
function leerViejo() {
  try {
    return JSON.parse(localStorage.getItem(CLAVE_VIEJA)) || {};
  } catch {
    return {};
  }
}

function borrarViejo() {
  try {
    localStorage.removeItem(CLAVE_VIEJA);
  } catch {
    // Sin almacenamiento: no hay nada que borrar.
  }
}

/**
 * @param {HTMLElement} raiz  donde van los interruptores.
 * @param {{ alCambiar: () => void, alGuardar: (id: string, ocultos: object) => Promise,
 *   alError: (err: Error) => void }} op  `alGuardar` escribe `ocultos` en `clientes/{id}`.
 */
export function montarVistas(raiz, { alCambiar, alGuardar, alError }) {
  // slug de la compañía -> { training, reviews, metas }: true = apagada.
  let ocultos = {};
  let migrado = false;

  const guardar = (id, fuera) => {
    ocultos[id] = fuera;
    return alGuardar(id, fuera);
  };

  // Sube lo que había en este navegador, solo para las compañías que aún no
  // tienen nada guardado en Firestore (lo del equipo manda).
  function migrar() {
    migrado = true;
    const viejo = leerViejo();
    const subidas = Object.entries(viejo)
      .filter(([compania, fuera]) => fuera && Object.keys(fuera).length && !ocultos[slug(compania)])
      .map(([compania, fuera]) => guardar(slug(compania), fuera));
    // Si falla, lo del navegador se queda para intentarlo la próxima vez.
    Promise.all(subidas).then(borrarViejo).catch(alError);
  }

  return {
    // Lo guardado en `clientes` ({ slug: ocultos }), cada vez que cambia.
    recibir(mapa) {
      ocultos = { ...mapa };
      if (!migrado) migrar();
    },

    // Lo que sale de una compañía: lo contratado menos lo que se apagó.
    visibles(compania, contratado) {
      const fuera = ocultos[slug(compania)] || {};
      return {
        training: contratado.training && !apagada(fuera, 'training'),
        reviews: contratado.reviews && !apagada(fuera, 'reviews'),
        // Las metas van con training: si se apaga, se van con él.
        metas: contratado.metas && !apagada(fuera, 'training') && !apagada(fuera, 'metas'),
      };
    },

    pintar(compania, contratado) {
      const id = slug(compania);
      const fuera = ocultos[id] || {};
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
          guardar(id, { ...(ocultos[id] || {}), [p.id]: !input.checked }).catch(alError);
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
