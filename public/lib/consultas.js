// Las queries del reporte de clientes (iban en una, pero Analytics Chat corta
// el mensaje hacia los 1.900 caracteres). Traen todas las compañías desde el
// primer día del mes anterior, una fila por dato con la columna `tipo`.
//
// Query 1, ya agregada por compañía y periodo (`periodo` = semana | mes, `fecha` =
// su primer día; las semanas van de lunes a domingo, como en la página):
//   resumen  n1 jugadores con partidas, n2 juegos, n3 segundos, n4 preguntas respondidas
//   loc      n1 jugadores con partidas, n2 jugadores activos de la sede (location),
//            t1 nombre   (las 3 con mayor porcentaje de jugadores con partidas)
//   lot      n1 clasificados a la GaliLotería (15+ partidas en el mes y 30+
//            puntos en al menos una)   (solo meses)
//   dia      fecha, n1 preguntas respondidas ese día   (para el gráfico; sin periodo)
// Va agregada porque el chat devuelve como mucho 10.000 filas: con una fila por
// jugador y día no alcanzaba ni para un mes. Así salen unos cientos.
//
// La sede de cada persona es la de su empleado (`employee_location`, la más
// reciente; el empleado sale de `player.employee_id` o del actor). Si no tiene,
// la del team (`team.location_id`): en algunas compañías un solo team junta
// varias sedes (Maximo: el team Medellín tiene gente de Cartagena).
//
// Query 2:
//   compania n1 jugadores activos en total, t1 experiencias (" | ")
//   premio   fecha, player_id, n1 cantidad, t1 nombre del premio, t2 tipo de
//            premio, t3 estado, n2 nivel del team de quien lo reclamó
//            (`team.prize_level`: 2 oro, 1 plata, 0 bronce, -1 sin nivel), t4 su
//            sede   (una fila por entrega)
//
// Query 3, reviews de Google, solo de las compañías con ficha activa
// (`google_location.is_enabled`):
//   ficha     t1 google_location_id, t2 nombre de la ficha   (una por ficha)
//   rev       n1 reviews nuevas, n2 de ellas por Gali (con clic de tarjeta o
//             juego), n3 estrellas promedio de las de Gali   (por periodo)
//   estrellas n1 estrellas (1 a 5), n2 reviews por Gali   (por periodo)
//   foto      fecha, n1 calificación en Google, n2 calificaciones en total,
//             t1 google_location_id   (desde 60 días antes: la calificación al
//             cierre de un periodo es la última foto hasta ese día, que puede ser
//             anterior a su arranque)
//   emp       player_id, n1 reviews de 5 estrellas por Gali   (cada empleado con al
//             menos una, por periodo: de aquí salen el Top 3 y los clasificados a
//             la Lotería de Reseñas).
//             Se cuenta por `review_click.employee_id` (el dueño de la tarjeta):
//             el `player_id` del clic no es el empleado. El jugador sale de
//             `player.employee_id` o del actor del empleado (`actor.employee_id`),
//             solo para el nombre: la base no guarda nombres, Analytics los pone
//             a partir de `player_id`. Sin jugador, sin nombre.
//
// Query 4, lotería propia de Auteco, por mes: además de las 15 partidas y los
// 30 puntos pide escaneos de baterías VALIDATED en el mes (10 los técnicos, 20
// los demás). El rol sale del tag de empleado (`tag.kind = 'employee'`): técnico
// si alguno de sus tags dice «técnico»; sin tag cuenta como asesor.
//   auteco   n1 técnicos clasificados, n2 asesores clasificados, n3 cumplen el
//            juego pero les faltan escaneos, n4 cumplen los escaneos pero les
//            falta el juego
//
// Analytics agrega solo el nombre del jugador al ver `player_id` (columna
// `Player`): `actor` no tiene nombre. Fechas en hora de Colombia (UTC-5).
//
// En el navegador (`reporte-datos.js`) se filtra lo que no hace falta en SQL: el
// estado de las entregas, los GaliTickets, Tutorial y GaliMisión en la lista de
// experiencias, y se arma el nombre del premio.
//
// Para bajar el CSV completo hay que usar el «Export» del pie de la respuesta
// (junto a «Save as report»): el de la barra de la tabla solo baja lo cargado.

// Va delante de cada query al copiarla. Sin ella el chat a veces corre la query
// y después otra «resumida» por su cuenta, y el Export baja esa (probado: una de
// tres veces sin la instrucción; cinco de cinco bien con ella). Suma unos 170
// caracteres: la query 1 queda en ~1.800, por debajo del corte de ~1.900.
export const INSTRUCCION = 'Ejecuta este SQL exactamente como está, una sola vez, sin LIMIT ni cambios. '
  + 'No corras otras consultas ni hagas resúmenes: responde solo con el número de filas.\n\n';

export const CONSULTAS = [
  {
    id: 'conocimiento',
    titulo: 'Query 1 · Conocimiento',
    descripcion: 'Jugadores, horas, preguntas por día, Top 3 de sedes y clasificados a la GaliLotería.',
    sql: `WITH k AS(SELECT DATE_TRUNC('month',CURRENT_DATE-INTERVAL '1 month')+INTERVAL '5 hours' d),
pc AS(SELECT p.player_id i,c.name co,COALESCE((SELECT location_id FROM employee_location WHERE employee_id=COALESCE(p.employee_id,a.employee_id) ORDER BY created_at DESC LIMIT 1),t.location_id) l,p.active ac FROM player p JOIN actor a ON a.actor_id=p.actor_id JOIN team t ON t.team_id=p.team_id JOIN company c ON c.company_id=t.company_id WHERE NOT a.is_stealth),
g AS(SELECT game_id gi,player_id pi,experience_id x,time_played_in_secs s,(SELECT COUNT(*) FROM game_question WHERE game_id=game.game_id) y,score z,(started_at-INTERVAL '5 hours')::date f FROM game WHERE NOT is_dummy AND started_at>=(SELECT d FROM k)),
gp AS(SELECT g.*,co,l,v.per,v.ini FROM g JOIN pc ON i=pi,LATERAL(VALUES('semana',DATE_TRUNC('week',f)::date),('mes',DATE_TRUNC('month',f)::date))v(per,ini)),
j AS(SELECT co,per,ini,pi,l,COUNT(*) n,SUM(s) s,SUM(y) y,MAX(z) z FROM gp GROUP BY 1,2,3,4,5),
lc AS(SELECT l,COUNT(*) t FROM pc WHERE ac GROUP BY 1)
SELECT 'resumen' tipo,co compania,per periodo,ini fecha,NULL::uuid player_id,COUNT(*) n1,SUM(n) n2,SUM(s) n3,SUM(y) n4,NULL t1,NULL t2 FROM j GROUP BY 2,3,4
UNION ALL SELECT 'loc',co,per,ini,NULL,a,t,NULL,NULL,o.name,NULL FROM(SELECT co,per,ini,j.l,COUNT(*) a,t,ROW_NUMBER()OVER(PARTITION BY co,per,ini ORDER BY COUNT(*)::float/t DESC,COUNT(*) DESC)r FROM j JOIN lc ON lc.l=j.l GROUP BY 1,2,3,4,6)x JOIN location o ON o.location_id=x.l WHERE r<=3
UNION ALL SELECT 'lot',co,per,ini,NULL,COUNT(*)FILTER(WHERE n>=15 AND z>=30),NULL,NULL,NULL,NULL,NULL FROM j WHERE per='mes' GROUP BY 2,3,4
UNION ALL SELECT 'dia',co,NULL,f,NULL,SUM(y),NULL,NULL,NULL,NULL,NULL FROM g JOIN pc ON i=pi GROUP BY 2,4`,
  },
  {
    id: 'premios',
    titulo: 'Query 2 · Compañías y premios',
    descripcion: 'Jugadores y experiencias de cada compañía, y cada premio entregado.',
    sql: `WITH k AS(SELECT DATE_TRUNC('month',CURRENT_DATE-INTERVAL '1 month')+INTERVAL '5 hours' d),
pc AS(SELECT p.player_id i,c.name co,c.company_id ci,p.active ac,a.is_stealth st,o.name se,t.prize_level nv FROM player p JOIN actor a ON a.actor_id=p.actor_id JOIN team t ON t.team_id=p.team_id JOIN company c ON c.company_id=t.company_id LEFT JOIN location o ON o.location_id=COALESCE((SELECT location_id FROM employee_location WHERE employee_id=COALESCE(p.employee_id,a.employee_id) ORDER BY created_at DESC LIMIT 1),t.location_id))
SELECT 'compania' tipo,c.name compania,NULL::date fecha,NULL::uuid player_id,(SELECT COUNT(*) FROM pc WHERE ci=c.company_id AND ac AND NOT st) n1,(SELECT string_agg(DISTINCT e.name->>'es',' | ') FROM team_experience te JOIN experience e ON e.experience_id=te.experience_id JOIN team t ON t.team_id=te.team_id WHERE t.company_id=c.company_id AND e.active) t1,NULL t2,NULL t3,NULL n2,NULL t4 FROM company c
UNION ALL SELECT 'premio',co,(r.redeemed_at-INTERVAL '5 hours')::date,i,cp.quantity,COALESCE(pr.name->>'es',pr.internal_name),pr.prize_type,CASE WHEN pr.prize_type='NEQUI' THEN rn.status ELSE r.status END,nv,se FROM reward r JOIN catalog_prize cp ON cp.catalog_prize_id=r.catalog_prize_id JOIN prize pr ON pr.prize_id=cp.prize_id JOIN pc ON i=r.player_id LEFT JOIN reward_nequi_gift_code rn ON rn.reward_id=r.reward_id WHERE r.redeemed_at>=(SELECT d FROM k)`,
  },
  {
    id: 'reviews',
    titulo: 'Query 3 · Reseñas de Google',
    descripcion: 'Calificación en Google y, de lo que llegó por Galilei, las reviews, sus estrellas y el Top 3 de empleados.',
    sql: `WITH k AS(SELECT DATE_TRUNC('month',CURRENT_DATE-INTERVAL '1 month')+INTERVAL '5 hours' d),
gl AS(SELECT g.google_location_id gi,c.name co,g.title ti FROM google_location g JOIN company c ON c.company_id=g.company_id WHERE g.is_enabled),
gc AS(SELECT DISTINCT ON(google_review_id) google_review_id ri,employee_id em FROM review_click WHERE google_review_id IS NOT NULL ORDER BY 1,2),
r AS(SELECT review_id ri,co,array_position(ARRAY['ONE','TWO','THREE','FOUR','FIVE'],rating) e,(create_time-INTERVAL '5 hours')::date f FROM google_review JOIN gl ON gi=google_location_id WHERE create_time>=(SELECT d FROM k)),
rp AS(SELECT r.*,em,gc.ri IS NOT NULL ga,v.per,v.ini FROM r LEFT JOIN gc USING(ri),LATERAL(VALUES('semana',DATE_TRUNC('week',f)::date),('mes',DATE_TRUNC('month',f)::date))v(per,ini))
SELECT 'ficha' tipo,co compania,NULL periodo,NULL fecha,NULL::uuid player_id,NULL n1,NULL n2,NULL n3,NULL n4,gi t1,ti t2 FROM gl
UNION ALL SELECT 'rev',co,per,ini,NULL,COUNT(*),COUNT(*)FILTER(WHERE ga),AVG(e)FILTER(WHERE ga),NULL,NULL,NULL FROM rp GROUP BY 2,3,4
UNION ALL SELECT 'estrellas',co,per,ini,NULL,e,COUNT(*),NULL,NULL,NULL,NULL FROM rp WHERE ga GROUP BY 2,3,4,6
UNION ALL SELECT 'emp',co,per,ini,(SELECT p.player_id FROM player p JOIN actor a USING(actor_id) WHERE em IN(p.employee_id,a.employee_id) LIMIT 1),COUNT(*),NULL,NULL,NULL,NULL,NULL FROM rp WHERE ga AND e=5 AND em IS NOT NULL GROUP BY co,per,ini,em
UNION ALL SELECT 'foto',co,NULL,snapshot_date,NULL,average_rating,total_rating_count,NULL,NULL,gi,NULL FROM location_rating_snapshot JOIN gl ON gi=google_location_id WHERE snapshot_date>=(SELECT d FROM k)::date-60`,
  },
  {
    id: 'auteco',
    titulo: 'Query 4 · Lotería Auteco',
    descripcion: 'Clasificados a la lotería propia de Auteco, con escaneos de baterías por rol.',
    soloPara: 'Solo Auteco',
    sql: `WITH m AS(SELECT DATE_TRUNC('month',CURRENT_DATE-INTERVAL '1 month')::date d),
p AS(SELECT p.player_id pi,c.name co,COALESCE(bool_or(lower(t.name) LIKE '%cnic%'),false) tec FROM player p JOIN team tm ON tm.team_id=p.team_id JOIN company c ON c.company_id=tm.company_id JOIN actor a ON a.actor_id=p.actor_id LEFT JOIN employee_tag et ON et.employee_id=p.employee_id LEFT JOIN tag t ON t.tag_id=et.tag_id AND t.kind='employee' WHERE c.name ILIKE '%auteco%' AND NOT a.is_stealth GROUP BY 1,2),
g AS(SELECT player_id pi,DATE_TRUNC('month',started_at-INTERVAL '5 hours')::date mes,COUNT(*) n,MAX(score) z FROM game WHERE NOT is_dummy AND started_at>=(SELECT d FROM m)+INTERVAL '5 hours' GROUP BY 1,2),
s AS(SELECT player_id pi,DATE_TRUNC('month',created_at-INTERVAL '5 hours')::date mes,COUNT(*) e FROM metric_qr_code_scan WHERE status='VALIDATED' AND created_at>=(SELECT d FROM m)+INTERVAL '5 hours' GROUP BY 1,2),
x AS(SELECT co,mes,tec,n>=15 AND z>=30 j,COALESCE(e,0)>=CASE WHEN tec THEN 10 ELSE 20 END q FROM g JOIN p USING(pi) LEFT JOIN s USING(pi,mes))
SELECT 'auteco' tipo,co compania,'mes' periodo,mes fecha,NULL::uuid player_id,COUNT(*)FILTER(WHERE tec AND j AND q) n1,COUNT(*)FILTER(WHERE NOT tec AND j AND q) n2,COUNT(*)FILTER(WHERE j AND NOT q) n3,COUNT(*)FILTER(WHERE q AND NOT j) n4,NULL t1,NULL t2 FROM x GROUP BY 2,4`,
  },
];

// Qué archivo es cada CSV, por sus columnas (ya normalizadas por `normalizarClave`).
// Además de las dos queries se acepta el export de la pieza semanal, para premios.
export function tipoDeArchivo(columnas) {
  if (columnas.includes('tipo') && columnas.includes('n1')) return 'reporte';
  if (columnas.includes('premio')) return 'premios';
  return null;
}
