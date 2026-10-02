// Fechas y periodos. Todo va en 'AAAA-MM-DD' y se opera en UTC para que la zona
// horaria del navegador no corra los días (las fechas ya llegan en hora de
// Colombia desde las queries).

export const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sept', 'Oct', 'Nov', 'Dic'];
export const MESES_LARGOS = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

export function aFecha(iso) {
  const [a, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(a, m - 1, d));
}

export function aISO(fecha) {
  return fecha.toISOString().slice(0, 10);
}

export function sumarDias(iso, dias) {
  const f = aFecha(iso);
  f.setUTCDate(f.getUTCDate() + dias);
  return aISO(f);
}

// «22 Sept»
export function diaMes(iso) {
  const f = aFecha(iso);
  return `${f.getUTCDate()} ${MESES[f.getUTCMonth()]}`;
}

// «22 de septiembre»
export function diaMesLargo(iso) {
  const f = aFecha(iso);
  return `${f.getUTCDate()} de ${MESES_LARGOS[f.getUTCMonth()]}`;
}

// Fecha de hoy en la zona horaria del navegador.
export function hoyLocal() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Primer día del mes anterior: desde ahí se piden los datos, así entra el último
// mes completo y todas las semanas que van del actual.
export function inicioMesAnterior(hoy = hoyLocal()) {
  const f = aFecha(hoy);
  return aISO(new Date(Date.UTC(f.getUTCFullYear(), f.getUTCMonth() - 1, 1)));
}

// Semanas de lunes a domingo y meses calendario que tocan el rango [min, max].
// Los que el rango no cubre entero salen marcados como parciales. Del más reciente
// al más antiguo: lo normal es querer el último.
export function periodosEntre(min, max) {
  if (!min || !max) return [];
  const periodos = [];

  const f = aFecha(min);
  let lunes = sumarDias(min, -((f.getUTCDay() + 6) % 7));
  while (lunes <= max) {
    const domingo = sumarDias(lunes, 6);
    periodos.push({
      tipo: 'semana',
      id: `semana-${lunes}`,
      inicio: lunes,
      fin: domingo,
      nombre: `Semana ${diaMes(lunes)} – ${diaMes(domingo)}`,
      parcial: lunes < min || domingo > max,
    });
    lunes = sumarDias(lunes, 7);
  }

  let [a, m] = min.split('-').map(Number);
  for (;;) {
    const inicio = aISO(new Date(Date.UTC(a, m - 1, 1)));
    if (inicio > max) break;
    const fin = aISO(new Date(Date.UTC(a, m, 0)));
    periodos.push({
      tipo: 'mes',
      id: `mes-${inicio.slice(0, 7)}`,
      inicio,
      fin,
      nombre: `${MESES_LARGOS[m - 1].replace(/^./, (c) => c.toUpperCase())} ${a}`,
      parcial: inicio < min || fin > max,
    });
    m += 1;
    if (m > 12) { m = 1; a += 1; }
  }

  return periodos.sort((x, y) => (x.tipo === y.tipo ? y.inicio.localeCompare(x.inicio) : x.tipo === 'semana' ? -1 : 1));
}
