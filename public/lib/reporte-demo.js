// Datos de mentira en el formato de las tres queries, para ver el reporte sin
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
// Sedes de mentira: los jugadores se reparten en orden y cada sede tiene además
// jugadores que no juegan, para que los porcentajes no salgan todos en 100.
const SEDES = [['Sede Norte', 6], ['Sede Centro', 8], ['Sede Sur', 5], ['Sede Occidente', 7], ['Sede Oriente', 6]];
const sedeDe = (i) => i % SEDES.length;

// Dos fichas de Google con su calificación de arranque.
const FICHAS = [['demo-g1', 'Cliente Demo Norte', 4.5, 820], ['demo-g2', 'Cliente Demo Centro', 4.3, 540]];

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

  // Reviews: por periodo, igual que la query 3. `rev` -> { nuevas, gali, suma, estrellas, embajadores }
  const reviews = new Map();
  const deReviews = (per, ini) => {
    const clave = `${per}|${ini}`;
    if (!reviews.has(clave)) {
      reviews.set(clave, { per, ini, nuevas: 0, gali: 0, suma: 0, estrellas: [0, 0, 0, 0, 0], embajadores: new Map() });
    }
    return reviews.get(clave);
  };
  const fichas = FICHAS.map(([id, , calificacion, total]) => ({ id, calificacion, total }));
  FICHAS.forEach(([id, nombre]) => fila('ficha', COMPANIA, '', '', '', '', '', '', '', id, q(nombre), '', ''));

  fila('compania', COMPANIA, '', '', '', 32, '', '', '', q('Servicio al cliente | Conoce tu producto | Tutorial'), '', '', '');

  // periodo -> { jugadores: Set(i), partidas: Map(i -> {n, z}), juegos, segundos, preguntas }
  const agregado = new Map();
  const de = (per, ini) => {
    const clave = `${per}|${ini}`;
    if (!agregado.has(clave)) {
      agregado.set(clave, { per, ini, jugadores: new Set(), partidas: new Map(), juegos: 0, segundos: 0, preguntas: 0 });
    }
    return agregado.get(clave);
  };

  const fin = sumarDias(hoyLocal(), -1);
  for (let fecha = inicioMesAnterior(); fecha <= fin; fecha = sumarDias(fecha, 1)) {
    const periodos = periodosDe(fecha).map(([per, ini]) => de(per, ini));
    let delDia = 0;
    JUGADORES.forEach((nombre, i) => {
      if (azar() > 0.45) return;
      const n = 1 + Math.floor(azar() * 4);
      const segundos = n * (150 + Math.floor(azar() * 200));
      const preguntas = n * (8 + Math.floor(azar() * 5));
      const z = 15 + Math.floor(azar() * 30);
      for (const a of periodos) {
        a.jugadores.add(i);
        const p = a.partidas.get(i) || { n: 0, z: 0 };
        a.partidas.set(i, { n: p.n + n, z: Math.max(p.z, z) });
        a.juegos += n;
        a.segundos += segundos;
        a.preguntas += preguntas;
      }
      delDia += preguntas;
      if (azar() < 0.12) {
        const [premio, tipo, montos] = PREMIOS[Math.floor(azar() * (azar() < 0.8 ? 1 : 3))];
        const monto = montos[Math.floor(azar() * montos.length)];
        fila('premio', COMPANIA, '', fecha, `demo-${i}`, monto, '', '', '', q(premio), tipo,
          tipo === 'NEQUI' ? 'REDEEMED' : 'DELIVERED', q(nombre));
      }
    });
    for (const ficha of fichas) {
      const cuantas = Math.floor(azar() * 7);
      for (let n = 0; n < cuantas; n++) {
        const u = azar();
        const e = u < 0.82 ? 5 : u < 0.92 ? 4 : u < 0.96 ? 3 : u < 0.98 ? 2 : 1;
        const gali = azar() < 0.55;
        const quien = Math.floor(azar() * 6);
        for (const [per, ini] of periodosDe(fecha)) {
          const a = deReviews(per, ini);
          a.nuevas += 1;
          if (gali) {
            a.gali += 1;
            a.suma += e;
            a.estrellas[e - 1] += 1;
          }
          if (gali && e === 5) a.embajadores.set(quien, (a.embajadores.get(quien) || 0) + 1);
        }
        ficha.calificacion = (ficha.calificacion * ficha.total + e) / (ficha.total + 1);
        ficha.total += 1;
      }
      // Una foto cada lunes, como las que toma el sistema.
      if (aFecha(fecha).getUTCDay() === 1) {
        fila('foto', COMPANIA, '', fecha, '', ficha.calificacion.toFixed(2), ficha.total, '', '', ficha.id, '', '', '');
      }
    }
    if (delDia) fila('dia', COMPANIA, '', fecha, '', delDia, '', '', '', '', '', '', '');
  }

  for (const a of agregado.values()) {
    fila('resumen', COMPANIA, a.per, a.ini, '', a.jugadores.size, a.juegos, a.segundos,
      a.preguntas, '', '', '', '');
    if (a.per === 'mes') {
      const p = [...a.partidas.values()];
      const clasifica = (x) => x.n >= 15 && x.z >= 30;
      fila('lot', COMPANIA, a.per, a.ini, '', p.filter(clasifica).length, p.filter((x) => x.n >= 10 && !clasifica(x)).length, '', '', '', '', '', '');
    }
    SEDES.map(([nombre, total], k) => ({ nombre, total, activos: [...a.jugadores].filter((i) => sedeDe(i) === k).length }))
      .sort((x, y) => y.activos / y.total - x.activos / x.total || y.activos - x.activos)
      .slice(0, 3)
      .forEach((l) => fila('loc', COMPANIA, a.per, a.ini, '', l.activos, l.total, '', '', q(l.nombre), '', '', ''));
  }
  for (const a of reviews.values()) {
    fila('rev', COMPANIA, a.per, a.ini, '', a.nuevas, a.gali, a.gali ? (a.suma / a.gali).toFixed(2) : '', '', '', '', '', '');
    a.estrellas.forEach((n, i) => n && fila('estrellas', COMPANIA, a.per, a.ini, '', i + 1, n, '', '', '', '', '', ''));
    [...a.embajadores.entries()]
      .forEach(([i, n]) => fila('emp', COMPANIA, a.per, a.ini, `demo-${i}`, n, '', '', '', '', '', '', q(JUGADORES[i])));
  }
  // Una segunda compañía que solo tiene reviews (sin training): sus filas son las
  // de reviews de la primera, con otro nombre. Así el ejemplo muestra los dos
  // casos de lo que una compañía tiene contratado.
  const soloReviews = filas.filter((f) => /^(ficha|rev|estrellas|emp|foto),/.test(f))
    .map((f) => f.replace(`,${COMPANIA},`, ',Demo Solo Reviews,'));
  return [...filas, ...soloReviews].join('\n');
}
