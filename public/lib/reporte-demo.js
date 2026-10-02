// Datos de mentira en el formato de las dos queries, para ver el reporte sin
// cargar nada («Ver ejemplo» o `reporte.html?demo`). Compañía y jugadores
// inventados; las fechas van desde el primer día del mes anterior hasta ayer.
//
// Se inventan partidas jugador por jugador y día y luego se agregan por semana y
// por mes, igual que hace la query 1.

import { hoyLocal, inicioMesAnterior, sumarDias, aFecha } from './periodos.js';

const COMPANIA = 'Cliente Demo';
const JUGADORES = [
  'Laura Gómez', 'Andrés Restrepo', 'Camila Torres', 'Julián Ospina', 'Valentina Ríos',
  'Santiago Mejía', 'Daniela Cárdenas', 'Felipe Arango', 'Mariana López', 'Tomás Herrera',
  'Sara Jiménez', 'Mateo Castaño', 'Isabella Franco', 'Sebastián Vélez', 'Natalia Duque',
  'Juan David Rojas', 'Paula Salazar', 'Esteban Muñoz', 'Manuela Giraldo', 'Nicolás Zapata',
];
const PREGUNTAS = [
  ['¿Cuál es el primer paso al recibir una queja de un cliente?', 'Escuchar sin interrumpir y confirmar lo que entendiste'],
  ['¿Cada cuánto se debe revisar la fecha de vencimiento del inventario?', 'Todos los días al abrir'],
  ['¿Qué se le ofrece al cliente si el producto está agotado?', 'Una alternativa similar y la fecha de reposición'],
];
const PREMIOS = [
  ['Bono Nequi de ${quantity} pesos', 'NEQUI', [10000, 20000, 50000]],
  ['Freidora de Aire', 'STANDARD', [0]],
  ['Netflix', 'STANDARD', [0]],
];

// Lunes de la semana y primer día del mes de una fecha.
function periodosDe(fecha) {
  const dia = aFecha(fecha).getUTCDay();
  return [['semana', sumarDias(fecha, -((dia + 6) % 7))], ['mes', `${fecha.slice(0, 7)}-01`]];
}

export function csvDeEjemplo() {
  let semilla = 7;
  const azar = () => (semilla = (semilla * 16807) % 2147483647) / 2147483647;
  const q = (t) => `"${String(t).replace(/"/g, '""')}"`;
  const filas = ['tipo,compania,periodo,fecha,player_id,n1,n2,n3,n4,t1,t2,t3,player'];
  const fila = (...c) => filas.push(c.join(','));

  fila('compania', COMPANIA, '', '', '', 32, '', '', '', q('Servicio al cliente | Conoce tu producto | Tutorial'), '', '', '');

  // periodo -> { jugadores: Map(i -> {n, z}), juegos, segundos, precision, fallos: [] }
  const agregado = new Map();
  const de = (per, ini) => {
    const clave = `${per}|${ini}`;
    if (!agregado.has(clave)) {
      agregado.set(clave, { per, ini, jugadores: new Map(), juegos: 0, segundos: 0, precision: 0, fallos: PREGUNTAS.map(() => 0) });
    }
    return agregado.get(clave);
  };

  const fin = sumarDias(hoyLocal(), -1);
  for (let fecha = inicioMesAnterior(); fecha <= fin; fecha = sumarDias(fecha, 1)) {
    const periodos = periodosDe(fecha).map(([per, ini]) => de(per, ini));
    JUGADORES.forEach((nombre, i) => {
      if (azar() > 0.45) return;
      const n = 1 + Math.floor(azar() * 4);
      const segundos = n * (150 + Math.floor(azar() * 200));
      const precision = n * (55 + azar() * 40);
      const z = 50 + Math.floor(azar() * 70);
      for (const a of periodos) {
        const j = a.jugadores.get(i) || { n: 0, z: 0 };
        a.jugadores.set(i, { n: j.n + n, z: Math.max(j.z, z) });
        a.juegos += n;
        a.segundos += segundos;
        a.precision += precision;
      }
      if (azar() < 0.12) {
        const [premio, tipo, montos] = PREMIOS[Math.floor(azar() * (azar() < 0.8 ? 1 : 3))];
        const monto = montos[Math.floor(azar() * montos.length)];
        fila('premio', COMPANIA, '', fecha, `demo-${i}`, monto, '', '', '', q(premio), tipo,
          tipo === 'NEQUI' ? 'REDEEMED' : 'DELIVERED', q(nombre));
      }
    });
    PREGUNTAS.forEach((_, k) => {
      if (azar() < 0.7) {
        const veces = 1 + Math.floor(azar() * (6 - k * 2));
        for (const a of periodos) a.fallos[k] += veces;
      }
    });
  }

  for (const a of agregado.values()) {
    fila('resumen', COMPANIA, a.per, a.ini, '', a.jugadores.size, a.juegos, a.segundos,
      (a.precision / a.juegos).toFixed(2), '', '', '', '');
    [...a.jugadores.entries()]
      .sort((x, y) => y[1].z - x[1].z || y[1].n - x[1].n)
      .slice(0, 3)
      .forEach(([i, j]) => fila('top', COMPANIA, a.per, a.ini, `demo-${i}`, j.n, j.z, '', '', '', '', '', q(JUGADORES[i])));
    const k = a.fallos.indexOf(Math.max(...a.fallos));
    fila('fallo', COMPANIA, a.per, a.ini, '', a.fallos[k], '', '', '', q(PREGUNTAS[k][0]), q(PREGUNTAS[k][1]), '', '');
  }
  return filas.join('\n');
}
