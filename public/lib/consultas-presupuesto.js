// Las queries del reporte de presupuesto (`presupuesto.html`). Sin parámetros:
// traen todas las compañías y desde el primer día, así que se pegan siempre
// igual en Analytics Chat. Una fila por dato, con la columna `tipo`.
//
// Query A · Presupuesto, catálogo y Especiales:
//   presupuesto  fecha (última actualización), n1 presupuesto actual
//                (`company_reward_budget.amount`), n2 para loterías
//                (`lottery_amount`), t1 moneda
//   catalogo     n1 presupuesto del catálogo (`prize_catalog.budget`), t1 moneda,
//                t2 cada cuánto se renueva (`renovation_period`)
//   disponible   n1 costo, n2 stock (unidades por periodo del catálogo), n3
//                reclamados en el periodo (`catalog_prize.redeemed`; no se muestra),
//                t1 nombre, t2 tipo, t3 moneda, t4 nivel   (los premios activos del
//                catálogo, sin los «Coming soon»: ni en el nombre, ni en el nombre
//                interno, ni en el tipo)
//   especial     fecha de entrega, player_id, n1 costo, t1 estado,
//                t2 la rifa que lo sorteó (`lottery_run`, en JSON), t3 el premio
//                especial entero (`special_reward`, en JSON): la vista documentada
//                no dice qué columna trae su nombre, así que se busca en el navegador.
//
// Query B · Premios reclamados, desde el primero de cada compañía, agrupados por
// compañía, mes, jugador, premio, estado y cantidad (sin agrupar pasaría de las
// 10.000 filas que devuelve el chat):
//   reclamo  fecha (primer día del mes), player_id, n1 cuántos, n2 suma de `reward.cost`,
//            n3 suma de lo pagado en Nequi (`amount_cop`), n4 cantidad del premio
//            (`${quantity}` en el nombre), t1 nombre, t2 tipo, t3 estado, t4 moneda
//
// Analytics agrega el nombre del jugador al ver `player_id` (columna `Player`).
// Fechas en hora de Colombia (UTC-5).

export const CONSULTAS_PRESUPUESTO = [
  {
    id: 'presupuesto',
    titulo: 'Query A · Presupuesto, catálogo y Especiales',
    descripcion: 'Presupuesto actual de cada compañía, los premios activos de su catálogo y los premios Especiales.',
    sql: `WITH c AS(SELECT company_id ci,name co FROM company)
SELECT 'presupuesto' tipo,co compania,(b.updated_at-INTERVAL '5 hours')::date fecha,NULL::uuid player_id,b.amount::numeric n1,b.lottery_amount::numeric n2,NULL::numeric n3,b.currency::text t1,NULL t2,NULL t3,NULL t4 FROM company_reward_budget b JOIN c ON ci=b.company_id
UNION ALL SELECT 'catalogo',co,NULL,NULL,k.budget,NULL,NULL,k.currency::text,k.renovation_period::text,NULL,NULL FROM prize_catalog k JOIN c ON ci=k.company_id
UNION ALL SELECT 'disponible',co,NULL,NULL,cp.cost,cp.stock,cp.redeemed,COALESCE(p.name->>'es',p.internal_name),p.prize_type::text,cp.currency::text,cp.level::text FROM catalog_prize cp JOIN prize_catalog k ON k.prize_catalog_id=cp.prize_catalog_id JOIN prize p ON p.prize_id=cp.prize_id JOIN c ON ci=k.company_id WHERE cp.active AND cp.disabled_at IS NULL AND p.active AND p.deleted_at IS NULL AND CONCAT(p.name::text,' ',p.internal_name,' ',p.prize_type) NOT ILIKE '%coming%soon%'
UNION ALL SELECT 'especial',co,s.delivered_date::date,s.player_id,s.cost,NULL,NULL,s.status::text,(SELECT to_jsonb(l)::text FROM lottery_run l WHERE l.special_reward_id=s.special_reward_id LIMIT 1),to_jsonb(s)::text,NULL FROM special_reward s JOIN c ON ci=s.company_id WHERE s.deleted_at IS NULL`,
  },
  {
    id: 'reclamados',
    titulo: 'Query B · Premios reclamados',
    descripcion: 'Cada premio reclamado desde el inicio y quién lo reclamó, por compañía.',
    sql: `SELECT 'reclamo' tipo,c.name compania,DATE_TRUNC('month',r.redeemed_at-INTERVAL '5 hours')::date fecha,r.player_id,COUNT(*) n1,SUM(r.cost) n2,SUM(rn.amount_cop) n3,cp.quantity n4,COALESCE(pr.name->>'es',pr.internal_name) t1,pr.prize_type::text t2,(CASE WHEN pr.prize_type='NEQUI' THEN rn.status ELSE r.status END)::text t3,cp.currency::text t4
FROM reward r JOIN catalog_prize cp ON cp.catalog_prize_id=r.catalog_prize_id JOIN prize pr ON pr.prize_id=cp.prize_id JOIN player p ON p.player_id=r.player_id JOIN team t ON t.team_id=p.team_id JOIN company c ON c.company_id=t.company_id LEFT JOIN reward_nequi_gift_code rn ON rn.reward_id=r.reward_id
WHERE r.redeemed_at IS NOT NULL AND pr.prize_type<>'GALI_TICKETS'
GROUP BY 2,3,4,8,9,10,11,12`,
  },
];
