// Convierte el texto libre de la columna "Premio" en una familia del catálogo.
// 30 textos distintos del export de septiembre colapsan en ~13 familias.

export function slug(texto) {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'premio';
}

// "10000.00" / "10.000" / "$130000.00" -> 10000
function aNumero(texto) {
  if (!texto) return null;
  const limpio = String(texto).replace(/[^0-9.,]/g, '');
  // Quita separadores de miles y decimales ".00" del export.
  const sinDecimales = limpio.replace(/[.,]00$/, '');
  const n = Number(sinDecimales.replace(/[.,]/g, ''));
  return Number.isFinite(n) && n > 0 ? n : null;
}

// Reglas en orden. La primera que casa gana.
const REGLAS = [
  {
    prueba: /^([\d.,]+)\s*GaliTickets?$/i,
    familia: () => ({
      id: 'galitickets',
      singular: 'GaliTickets',
      plural: 'GaliTickets',
      desglose: 'por-monto',
      unidadMonto: 'tickets',
    }),
    monto: (m) => aNumero(m[1]),
  },
  {
    prueba: /^Bono\s+Nequi\s+de\s+([\d.,]+)\s*pesos$/i,
    familia: () => ({
      id: 'nequi',
      singular: 'Bono Nequi',
      plural: 'Bonos Nequi',
      desglose: 'por-monto',
      unidadMonto: 'pesos',
    }),
    monto: (m) => aNumero(m[1]),
  },
  {
    // "Bono Adidas $300000.00", "Bono Crepes & Waffles $60000.00", "Bono Starbucks $20.000"
    prueba: /^Bono\s+(.+?)\s*\$?\s*([\d.,]+)$/i,
    familia: (m) => ({
      id: `bono-${slug(m[1])}`,
      singular: `Bono ${m[1].trim()}`,
      plural: `Bonos ${m[1].trim()}`,
      desglose: 'por-monto',
      unidadMonto: 'pesos',
    }),
    monto: (m) => aNumero(m[2]),
  },
  {
    // "Zara ($100.000)"
    prueba: /^(.+?)\s*\(\s*\$?\s*([\d.,]+)\s*\)$/,
    familia: (m) => ({
      id: `bono-${slug(m[1])}`,
      singular: `Bono ${m[1].trim()}`,
      plural: `Bonos ${m[1].trim()}`,
      desglose: 'por-monto',
      unidadMonto: 'pesos',
    }),
    monto: (m) => aNumero(m[2]),
  },
];

// Devuelve { id, monto, unidadMonto, propuesta } — `propuesta` es lo que la UI
// precarga en el formulario cuando la familia todavía no está en el catálogo.
export function normalizarPremio(texto, catalogo = []) {
  const bruto = texto.trim();

  // 1. Alias explícitos del catálogo: la vía para corregir a mano sin tocar código.
  for (const entrada of catalogo) {
    if ((entrada.alias || []).some((a) => a.toLowerCase() === bruto.toLowerCase())) {
      return {
        id: entrada.id,
        // El monto solo se rasca del texto si la familia se desglosa por monto.
        // `montoSuelto` coge el primer número que encuentra, y en un alias como
        // "CinecoPass Premium x2" ese número es el "2" de la cantidad de entradas,
        // no un precio: leerlo como monto le ponía un valor de $2 al premio.
        monto: entrada.desglose === 'por-monto' ? montoSuelto(bruto) : null,
        unidadMonto: entrada.unidadMonto || null,
        propuesta: null,
      };
    }
  }

  // 2. Patrones con monto.
  for (const regla of REGLAS) {
    const m = regla.prueba.exec(bruto);
    if (!m) continue;
    const propuesta = regla.familia(m);
    return {
      id: propuesta.id,
      monto: regla.monto(m),
      unidadMonto: propuesta.unidadMonto,
      propuesta,
    };
  }

  // 3. El texto completo es la familia (Netflix, Freidora de Aire, Barril Ahumador...).
  return {
    id: slug(bruto),
    monto: null,
    unidadMonto: null,
    propuesta: {
      id: slug(bruto),
      singular: bruto,
      plural: bruto,
      desglose: 'por-nombre',
      unidadMonto: null,
    },
  };
}

function montoSuelto(texto) {
  const m = /([\d.,]+)/.exec(texto.replace(/\.00\b/g, ''));
  return m ? aNumero(m[1]) : null;
}

export function formatearMonto(monto, unidad) {
  if (monto == null) return '';
  if (unidad === 'tickets') return `${monto.toLocaleString('es-CO')} tickets`;
  return `$${monto.toLocaleString('es-CO')}`;
}

// Agrupa las entregas de una compañía por familia de premio.
export function agruparPorFamilia(entregas, catalogo = []) {
  const mapa = new Map();

  for (const fila of entregas) {
    const n = normalizarPremio(fila.premio, catalogo);
    if (!mapa.has(n.id)) {
      mapa.set(n.id, {
        id: n.id,
        propuesta: n.propuesta,
        entregas: [],
        textos: new Set(),
      });
    }
    const grupo = mapa.get(n.id);
    grupo.entregas.push({ ...fila, monto: n.monto, unidadMonto: n.unidadMonto });
    grupo.textos.add(fila.premio);
  }

  return [...mapa.values()]
    .map((g) => ({ ...g, textos: [...g.textos], conteo: g.entregas.length }))
    .sort((a, b) => b.conteo - a.conteo || a.id.localeCompare(b.id));
}

// Nombres del CSV: vienen en mayúsculas, en minúsculas y con apellidos de más.
// Se dejan con inicial mayúscula y se cortan a tres partes — dos nombres y un
// apellido, o un nombre y dos apellidos —, que es hasta donde se quiere mostrar.
//
// Las partículas ("de", "del", "la"...) no cuentan como parte y se quedan en
// minúscula: "Maria de los Angeles" son dos partes, no cuatro.
const PARTICULAS = new Set(['de', 'del', 'la', 'las', 'los', 'y', 'da', 'das', 'do', 'san', 'santa']);

export function formatearNombre(bruto) {
  const palabras = String(bruto || '').trim().split(/\s+/).filter(Boolean);
  if (!palabras.length) return '';

  const partes = [];
  let pendiente = [];

  for (const palabra of palabras) {
    const limpia = palabra.toLocaleLowerCase('es');
    if (PARTICULAS.has(limpia)) {
      pendiente.push(limpia);
      continue;
    }
    partes.push([...pendiente, capitalizar(limpia)].join(' '));
    pendiente = [];
    if (partes.length === 3) break;
  }

  return partes.join(' ') || capitalizar(palabras[0].toLocaleLowerCase('es'));
}

function capitalizar(palabra) {
  // Respeta los compuestos con guion: "Ana-Maria" -> "Ana-Maria".
  return palabra
    .split('-')
    .map((t) => (t ? t.charAt(0).toLocaleUpperCase('es') + t.slice(1) : t))
    .join('-');
}
