// Del grupo de entregas de una familia de premio a lo que dibuja la pieza de
// celular. Lo usan la pieza semanal (`app.js`) y el reporte para clientes.

import { formatearMonto } from './normalizador.js';

// Precio de referencia del premio: el del catálogo si está, y si no el mayor
// monto en pesos que traiga el propio CSV (los bonos lo llevan en el texto).
export function valorDe(grupo, catalogo) {
  const declarado = catalogo.find((p) => p.id === (grupo.baseId || grupo.id))?.valor;
  if (typeof declarado === 'number' && declarado > 0) return declarado;
  const montos = grupo.entregas
    .filter((e) => e.unidadMonto === 'pesos' && e.monto)
    .map((e) => e.monto);
  return montos.length ? Math.max(...montos) : 0;
}

export function armarGrupo(grupo, catalogo, imagenes) {
  const familia = grupo.baseId || grupo.id;
  const entrada = catalogo.find((p) => p.id === familia);
  const singular = entrada?.etiqueta?.singular || grupo.propuesta?.singular || grupo.id;
  const plural = entrada?.etiqueta?.plural || grupo.propuesta?.plural || singular;
  const desglose = entrada?.desglose || grupo.propuesta?.desglose || 'por-nombre';
  const unidad = entrada?.unidadMonto ?? grupo.propuesta?.unidadMonto ?? null;
  const nombre = grupo.conteo === 1 ? singular : plural;
  // Un item abierto por monto lo lleva en el chip y ya no repite la lista.
  const sufijo = grupo.monto ? ` de ${formatearMonto(grupo.monto, unidad)}` : '';

  const datos = {
    conteo: grupo.conteo,
    nombre: nombre + sufijo,
    chip: `${grupo.conteo} ${nombre}${sufijo}`,
    imagen: imagenes.get(familia) || null,
    montos: [],
    nombres: [],
  };

  // Se entregan los ganadores sin maquetar: el render necesita contarlos para
  // garantizar el mínimo visible, así que no puede recibir líneas ya armadas.
  if (desglose === 'por-monto' && !grupo.baseId && grupo.entregas.some((e) => e.monto != null)) {
    const porMonto = new Map();
    for (const e of grupo.entregas) {
      const clave = e.monto ?? 0;
      if (!porMonto.has(clave)) porMonto.set(clave, new Set());
      porMonto.get(clave).add(e.jugador);
    }
    datos.montos = [...porMonto.entries()]
      .sort((a, b) => b[0] - a[0])
      .map(([monto, jugadores]) => ({
        etiqueta: monto ? formatearMonto(monto, unidad) : '',
        nombres: [...jugadores],
      }));
  } else {
    datos.nombres = [...new Set(grupo.entregas.map((e) => e.jugador))];
  }

  // Cuánto se repartió en total. Solo sale en los premios que se entregan por
  // monto —Nequi y los bonos—, que son los únicos donde el valor cambia de una
  // entrega a otra: el resto ya lo dice el nombre del producto.
  //
  // Suma las ENTREGAS, no los ganadores: quien recibió dos bonos puso dos veces.
  // Por eso no se puede sacar de `datos.montos`, que deduplica jugadores.
  //
  // Hace falta comprobar el desglose y no solo que haya monto: un premio por
  // nombre puede arrastrar un número rascado de su propio texto —el "x2" de
  // "CinecoPass Premium x2"— y sumarlo daba un total de "$2".
  const porMontos = desglose === 'por-monto' && unidad && !grupo.monto
    ? grupo.entregas.filter((e) => e.monto > 0)
    : [];
  datos.total = porMontos.length
    ? formatearMonto(porMontos.reduce((s, e) => s + e.monto, 0), unidad)
    : null;

  // Nequi lleva además el desglose en la propia tarjeta: cada monto que se
  // entregó y cuántas veces, del mayor al menor. Cuenta ENTREGAS, igual que el
  // total.
  if (familia === 'nequi' && porMontos.length) {
    const veces = new Map();
    for (const e of porMontos) veces.set(e.monto, (veces.get(e.monto) || 0) + 1);
    datos.valores = [...veces.entries()]
      .sort((a, b) => b[0] - a[0])
      .map(([monto, n]) => ({ texto: formatearMonto(monto, unidad), veces: n }));
  }

  return datos;
}
