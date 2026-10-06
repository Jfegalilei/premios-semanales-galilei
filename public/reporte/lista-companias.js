// Paso 4 del reporte para clientes: la lista de compañías, partida en grupos por
// lo que tienen contratado, con un selector arriba para ver un grupo a la vez.
// Solo pinta y avisa qué compañía se eligió; qué es cada compañía lo decide
// quien llama (`grupo` y `resumen` de cada una).

// Una compañía con training y reseñas va en Training: su reporte arranca por ahí.
export const GRUPOS = [
  { id: 'training', nombre: 'Training' },
  { id: 'reviews', nombre: 'Reseñas' },
];

export const grupoDe = (servicios) => (servicios.training || !servicios.reviews ? 'training' : 'reviews');

/**
 * @param {HTMLElement} raiz  donde van el selector y la lista.
 * @param {{ alElegir: (compania: string) => void }} op
 * @returns {{ pintar: (companias: {nombre, grupo, resumen}[], seleccion: string) => void }}
 */
export function crearListaCompanias(raiz, { alElegir }) {
  const selector = document.createElement('div');
  selector.className = 'selector-grupo';
  selector.setAttribute('role', 'tablist');
  const lista = document.createElement('ul');
  lista.className = 'companias';
  raiz.replaceChildren(selector, lista);

  let grupo = GRUPOS[0].id;
  let companias = [];
  let seleccion = null;

  const pintar = () => {
    // Si un grupo no tiene a nadie, se queda en el que sí tenga.
    const cuantas = (id) => companias.filter((c) => c.grupo === id).length;
    if (!cuantas(grupo)) grupo = GRUPOS.find((g) => cuantas(g.id))?.id || grupo;

    selector.replaceChildren(...GRUPOS.map((g) => {
      const boton = document.createElement('button');
      boton.type = 'button';
      boton.setAttribute('role', 'tab');
      boton.setAttribute('aria-selected', String(g.id === grupo));
      boton.disabled = !cuantas(g.id);
      boton.innerHTML = '<span></span><span class="cuenta"></span>';
      boton.children[0].textContent = g.nombre;
      boton.children[1].textContent = cuantas(g.id);
      boton.addEventListener('click', () => {
        if (g.id === grupo) return;
        grupo = g.id;
        // Al cambiar de grupo se abre su primera compañía: la vista previa
        // siempre corresponde a lo que se ve en la lista.
        const primera = companias.find((c) => c.grupo === grupo);
        if (primera) alElegir(primera.nombre);
        else pintar();
      });
      return boton;
    }));

    lista.replaceChildren(...companias.filter((c) => c.grupo === grupo).map((c) => {
      const boton = document.createElement('button');
      boton.type = 'button';
      boton.setAttribute('aria-current', String(c.nombre === seleccion));
      boton.innerHTML = '<span></span><span class="meta"></span>';
      boton.children[0].textContent = c.nombre;
      boton.children[1].textContent = c.resumen;
      boton.addEventListener('click', () => alElegir(c.nombre));
      const li = document.createElement('li');
      li.appendChild(boton);
      return li;
    }));
  };

  return {
    pintar(nuevas, elegida) {
      companias = nuevas;
      seleccion = elegida;
      // La compañía elegida manda: el selector se pone en su grupo.
      const actual = companias.find((c) => c.nombre === seleccion);
      if (actual) grupo = actual.grupo;
      pintar();
    },
  };
}
