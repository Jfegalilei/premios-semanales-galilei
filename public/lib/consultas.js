// Las dos queries del reporte de clientes (iban en una, pero Analytics Chat corta
// el mensaje hacia los 1.900 caracteres). Traen todas las compañías desde el
// primer día del mes anterior, una fila por dato con la columna `tipo`.
//
// Query 1, ya agregada por compañía y periodo (`periodo` = semana | mes, `fecha` =
// su primer día; las semanas van de lunes a domingo, como en la página):
//   resumen  n1 jugadores con partidas, n2 juegos, n3 segundos, n4 precisión media
//   top      player_id, n1 juegos, n2 puntaje máx.   (los 3 de mayor puntaje)
//   fallo    n1 fallos, t1 pregunta, t2 respuesta correcta   (solo la más fallada)
// Va agregada porque el chat devuelve como mucho 10.000 filas: con una fila por
// jugador y día no alcanzaba ni para un mes. Así salen unos cientos.
//
// Query 2:
//   compania n1 jugadores activos en total, t1 experiencias (" | ")
//   premio   fecha, player_id, n1 cantidad, t1 nombre del premio, t2 tipo de
//            premio, t3 estado   (una fila por entrega)
//
// Analytics agrega solo el nombre del jugador al ver `player_id` (columna
// `Player`): `actor` no tiene nombre. Fechas en hora de Colombia (UTC-5).
//
// En el navegador (`reporte-datos.js`) se filtra lo que no hace falta en SQL: el
// estado de las entregas, los GaliTickets, Tutorial y GaliMisión en la lista de
// experiencias, y se arma el nombre del premio. La pregunta más fallada sí se
// filtra en SQL, porque solo se trae una por periodo.
//
// Para bajar el CSV completo hay que usar el «Export» del pie de la respuesta
// (junto a «Save as report»): el de la barra de la tabla solo baja lo cargado.

export const CONSULTAS = [
  {
    id: 'conocimiento',
    titulo: 'Query 1 · Conocimiento',
    sql: `WITH k AS(SELECT DATE_TRUNC('month',CURRENT_DATE-INTERVAL '1 month')+INTERVAL '5 hours' d),
pc AS(SELECT p.player_id i,c.name co FROM player p JOIN actor a ON a.actor_id=p.actor_id JOIN team t ON t.team_id=p.team_id JOIN company c ON c.company_id=t.company_id WHERE NOT a.is_stealth),
g AS(SELECT game_id gi,player_id pi,experience_id x,time_played_in_secs s,accuracy y,score z,(started_at-INTERVAL '5 hours')::date f FROM game WHERE NOT is_dummy AND started_at>=(SELECT d FROM k)),
gp AS(SELECT g.*,co,v.per,v.ini FROM g JOIN pc ON i=pi,LATERAL(VALUES('semana',DATE_TRUNC('week',f)::date),('mes',DATE_TRUNC('month',f)::date))v(per,ini)),
j AS(SELECT co,per,ini,pi,COUNT(*) n,SUM(s) s,SUM(y) y,MAX(z) z FROM gp GROUP BY 1,2,3,4)
SELECT 'resumen' tipo,co compania,per periodo,ini fecha,NULL::uuid player_id,COUNT(*) n1,SUM(n) n2,SUM(s) n3,SUM(y)/SUM(n) n4,NULL t1,NULL t2 FROM j GROUP BY 2,3,4
UNION ALL SELECT 'top',co,per,ini,pi,n,z,NULL,NULL,NULL,NULL FROM(SELECT j.*,ROW_NUMBER()OVER(PARTITION BY co,per,ini ORDER BY z DESC,n DESC)r FROM j)t WHERE r<=3
UNION ALL SELECT 'fallo',co,per,ini,NULL,fl,NULL,NULL,NULL,pr,(SELECT string_agg(o.text->>'es',' / ') FROM option o WHERE o.question_id=qi AND o.is_valid) FROM(SELECT co,per,ini,q.question_id qi,q.text->>'es' pr,COUNT(*) fl,ROW_NUMBER()OVER(PARTITION BY co,per,ini ORDER BY COUNT(*) DESC)r FROM game_question gq JOIN gp ON gi=gq.game_id JOIN question q ON q.question_id=gq.question_id JOIN experience e ON e.experience_id=x WHERE NOT gq.is_valid AND e.active AND e.name->>'es' NOT ILIKE '%tutorial%' AND e.name->>'es' NOT ILIKE '%galimisi%' GROUP BY 1,2,3,4,5)t WHERE r=1`,
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
