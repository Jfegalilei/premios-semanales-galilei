// Las dos queries del reporte de clientes (iban en una, pero Analytics Chat corta
// el mensaje hacia los 1.900 caracteres). Traen todo para TODAS las compañías
// desde el primer día del mes anterior, una fila por dato con la columna `tipo`.
// La 1 trae `juego` y `fallo`; la 2, `compania` y `premio`:
//
//   juego    compania, fecha, player_id, n1 juegos, n2 segundos,
//            n3 suma de precisión, n4 puntaje máx.   (agregado por jugador y día)
//   fallo    compania, fecha, n1 fallos, t1 pregunta, t2 respuesta correcta,
//            t3 experiencia                         (por pregunta y día)
//   compania compania, n1 jugadores activos en total, t1 experiencias (" | ")
//   premio   compania, fecha, player_id, n1 cantidad, t1 nombre del
//            premio, t2 tipo de premio, t3 estado   (una fila por entrega)
//
// La 2 no lleva n2–n4: la página no los necesita. Van compactas a propósito (sin
// el esquema `gali_insights.`, que Analytics resuelve solo, y con alias cortos).
//
// No lleva parámetros, así que se puede guardar y pegar igual cada vez. Lo que se
// puede filtrar en el navegador se filtra allá (`reporte-datos.js`): Tutorial y
// GaliMisión, el estado de las entregas, los GaliTickets y el armado del nombre del
// premio. En SQL se quedan solo los filtros que recortan filas de verdad.
//
// Las fechas pasan a hora de Colombia restando 5 h (UTC-5 todo el año).
//
// El nombre del jugador no se pide: `actor` no tiene columna de nombre y Analytics
// lo agrega solo al ver `player_id` (columna `player_name` o `Player`).

export const CONSULTAS = [
  {
    id: 'conocimiento',
    titulo: 'Query 1 · Conocimiento',
    sql: `WITH k AS(SELECT DATE_TRUNC('month',CURRENT_DATE-INTERVAL '1 month')+INTERVAL '5 hours' d),
pc AS(SELECT p.player_id i,c.name co,c.company_id ci,p.active ac,a.is_stealth st FROM player p JOIN actor a ON a.actor_id=p.actor_id JOIN team t ON t.team_id=p.team_id JOIN company c ON c.company_id=t.company_id),
g AS(SELECT game_id gi,player_id pi,experience_id x,time_played_in_secs s,accuracy y,score z,(started_at-INTERVAL '5 hours')::date f FROM game WHERE NOT is_dummy AND started_at>=(SELECT d FROM k))
SELECT 'juego' tipo,co compania,f fecha,i player_id,COUNT(*) n1,SUM(s) n2,SUM(y) n3,MAX(z) n4,NULL t1,NULL t2,NULL t3 FROM g JOIN pc ON i=pi WHERE NOT st GROUP BY 2,3,4
UNION ALL SELECT 'fallo',co,f,NULL,COUNT(*),NULL,NULL,NULL,q.text->>'es',(SELECT string_agg(o.text->>'es',' / ') FROM option o WHERE o.question_id=q.question_id AND o.is_valid),e.name->>'es' FROM game_question gq JOIN g ON gi=gq.game_id JOIN pc ON i=pi JOIN question q ON q.question_id=gq.question_id JOIN experience e ON e.experience_id=x WHERE NOT gq.is_valid AND e.active AND NOT st GROUP BY 2,3,q.question_id,9,11`,
  },
  {
    id: 'premios',
    titulo: 'Query 2 · Compañías y premios',
    sql: `WITH k AS(SELECT DATE_TRUNC('month',CURRENT_DATE-INTERVAL '1 month')+INTERVAL '5 hours' d),
pc AS(SELECT p.player_id i,c.name co,c.company_id ci,p.active ac,a.is_stealth st FROM player p JOIN actor a ON a.actor_id=p.actor_id JOIN team t ON t.team_id=p.team_id JOIN company c ON c.company_id=t.company_id)
SELECT 'compania' tipo,c.name compania,NULL::date fecha,NULL::uuid player_id,(SELECT COUNT(*) FROM pc WHERE ci=c.company_id AND ac AND NOT st) n1,(SELECT string_agg(DISTINCT e.name->>'es',' | ') FROM team_experience te JOIN experience e ON e.experience_id=te.experience_id JOIN team t ON t.team_id=te.team_id WHERE t.company_id=c.company_id AND e.active) t1,NULL t2,NULL t3 FROM company c
UNION ALL SELECT 'premio',co,(r.redeemed_at-INTERVAL '5 hours')::date,i,cp.quantity,COALESCE(pr.name->>'es',pr.internal_name),pr.prize_type,CASE WHEN pr.prize_type='NEQUI' THEN rn.status ELSE r.status END FROM reward r JOIN catalog_prize cp ON cp.catalog_prize_id=r.catalog_prize_id JOIN prize pr ON pr.prize_id=cp.prize_id JOIN pc ON i=r.player_id LEFT JOIN reward_nequi_gift_code rn ON rn.reward_id=r.reward_id WHERE r.redeemed_at>=(SELECT d FROM k)`,
  },
];

// Qué archivo es cada CSV, por sus columnas (ya normalizadas por `normalizarClave`).
// Además de las dos queries se acepta el export de la pieza semanal, para premios.
export function tipoDeArchivo(columnas) {
  if (columnas.includes('tipo') && columnas.includes('n1')) return 'reporte';
  if (columnas.includes('premio')) return 'premios';
  return null;
}
