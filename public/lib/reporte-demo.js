// Datos de mentira en el formato de la query única, para ver el reporte sin
// cargar nada («Ver ejemplo» o `reporte.html?demo`). Compañía y jugadores
// inventados; las fechas van desde el primer día del mes anterior hasta ayer.

import { hoyLocal, inicioMesAnterior, sumarDias } from './periodos.js';

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
  ['Bono Nequi', 'NEQUI', [10000, 20000, 50000]],
  ['Freidora de Aire', 'PHYSICAL', [0]],
  ['Netflix', 'PHYSICAL', [0]],
];

export function csvDeEjemplo() {
  let semilla = 7;
  const azar = () => (semilla = (semilla * 16807) % 2147483647) / 2147483647;
  const filas = ['tipo,compania,fecha,player_id,player_name,n1,n2,n3,n4,t1,t2,t3'];
  const q = (t) => `"${String(t).replace(/"/g, '""')}"`;

  filas.push(`compania,${COMPANIA},,,,32,,,,${q('Servicio al cliente | Conoce tu producto | Tutorial')},,`);
  const fin = sumarDias(hoyLocal(), -1);
  for (let fecha = inicioMesAnterior(); fecha <= fin; fecha = sumarDias(fecha, 1)) {
    JUGADORES.forEach((nombre, i) => {
      if (azar() > 0.45) return;
      const n = 1 + Math.floor(azar() * 4);
      filas.push(['juego', COMPANIA, fecha, `demo-${i}`, q(nombre), n, n * (150 + Math.floor(azar() * 200)),
        (n * (0.55 + azar() * 0.4)).toFixed(3), 50 + Math.floor(azar() * 70), '', '', ''].join(','));
      if (azar() < 0.12) {
        const [premio, tipo, montos] = PREMIOS[Math.floor(azar() * (azar() < 0.8 ? 1 : 3))];
        const monto = montos[Math.floor(azar() * montos.length)];
        filas.push(['premio', COMPANIA, fecha, `demo-${i}`, q(nombre), monto, '', '', '', q(premio), tipo,
          tipo === 'NEQUI' ? 'REDEEMED' : 'DELIVERED'].join(','));
      }
    });
    PREGUNTAS.forEach(([pregunta, respuesta], i) => {
      if (azar() < 0.7) {
        filas.push(['fallo', COMPANIA, fecha, '', '', 1 + Math.floor(azar() * (6 - i * 2)), '', '', '',
          q(pregunta), q(respuesta), 'Servicio al cliente'].join(','));
      }
    });
  }
  return filas.join('\n');
}
