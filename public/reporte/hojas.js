// Qué hojas lleva el PDF de una compañía y cómo se dibuja cada una.
//
// `HOJAS` es el registro: cada entrada dice cuándo aplica (según lo que la
// compañía tiene contratado) y qué páginas pone. Añadir una hoja es añadir una
// entrada; el orden del registro es el del PDF.
//   training -> conocimiento y premios entregados (la pieza de la semanal con la
//               inversión total bajo el título; con más de siete premios se parte
//               en varias páginas, el total solo en la primera y sin «Desliza»
//               porque es un PDF)
//   reviews  -> reviews de Google
//   loterías -> las de `r.loterias` (ver `loteriasDe` en reporte.js). Con una
//               sola (solo training), su hoja completa; con varias (con
//               reseñas), todas en una hoja: la de Reseñas con clasificados y
//               la de Galilei con clasificados solo si tiene training (si no,
//               solo el premio).
//   metas    -> la última, solo si se prende en «Qué mostrar» (reporte mensual,
//               con training y menos Auteco): le pide al cliente sus metas

import { diaMes } from '../lib/periodos.js';
import { dibujarConocimiento } from '../lib/hoja-conocimiento.js';
import { dibujarReviews } from '../lib/hoja-reviews.js';
import { dibujarMetas, tituloMetas } from '../lib/hoja-metas.js';
import { dibujarLoteria, dibujarLoterias } from '../lib/hoja-loteria.js';
import { armarCarrusel, dibujarDiapositiva } from '../lib/carrusel.js';
import { personajeDe, azarConSemilla } from '../lib/lienzo.js';
import { valorDe, armarGrupo } from '../lib/grupos.js';
import { LOTERIAS, rifaParaHoja } from './loterias.js';
import { premiosPorSede } from '../lib/reporte-datos.js';

const enPesos = (n) => `$${Math.round(n).toLocaleString('es-CO')}`;

const HOJAS = [
  {
    tipo: 'conocimiento',
    aplica: (r) => r.servicios.training,
    paginas: (r, { comunes }) => [{
      nombre: 'Conocimiento',
      dibujar: (lienzo, fondo) => dibujarConocimiento(lienzo, {
        ...comunes,
        // El nombre siempre en el renglón siguiente a «Reporte».
        titulo: `Reporte\n${r.cliente}`,
        tituloCompleto: true,
        subtitulo: r.conocimiento.juegos ? '' : 'Sin partidas en este periodo',
        // Sin Gali: el título largo se le montaba encima y no se leía.
        personaje: null,
        fondo,
        // El trofeo es de los premios; aquí chocaría con el título.
        trofeo: null,
        datos: r.conocimiento,
      }),
    }],
  },
  {
    tipo: 'premios',
    aplica: (r) => r.servicios.training,
    paginas: (r, { comunes, elegir, recursos }) => {
      const grupos = [...r.premios.grupos]
        .sort((a, b) => valorDe(b, recursos.catalogo) - valorDe(a, recursos.catalogo) || b.conteo - a.conteo)
        // Cada premio lleva sus entregas: de ahí salen las sedes de su página.
        .map((g) => ({ ...armarGrupo(g, recursos.catalogo, recursos.imagenes), entregas: g.entregas }));
      const diapositivas = armarCarrusel(grupos);
      if (!diapositivas.length) diapositivas.push({ grupos: [], ganadores: [], parte: 1, partes: 1 });
      const total = r.premios.entregas ? `Inversión total: ${enPesos(r.premios.total)}` : 'Sin premios entregados';
      return diapositivas.map((d, n) => ({
        nombre: diapositivas.length > 1 ? `Premios (${n + 1} de ${diapositivas.length})` : 'Premios',
        dibujar: (lienzo, fondo) => dibujarDiapositiva(lienzo, {
          ...comunes,
          titulo: 'Premios Entregados',
          subtitulo: n === 0 ? total : '',
          diapositiva: d,
          desliza: false,
          // Para el cliente, las sedes y no los nombres de quienes ganaron: solo
          // las de los premios de esta página.
          sedes: premiosPorSede(d.grupos.flatMap((g) => g.entregas || [])),
          personaje: elegir(recursos.personajes, n + 1),
          fondo,
        }),
      }));
    },
  },
  {
    tipo: 'reviews',
    aplica: (r) => Boolean(r.reviews),
    paginas: (r, { comunes, elegir, recursos }) => [{
      nombre: 'Reseñas',
      dibujar: (lienzo, fondo) => dibujarReviews(lienzo, {
        ...comunes,
        titulo: 'Reseñas\nen Google',
        personaje: elegir(recursos.personajes, 'reviews'),
        fondo,
        trofeo: null,
        datos: r.reviews,
      }),
    }],
  },
  {
    tipo: 'loteria',
    aplica: (r) => r.loterias.length > 0,
    paginas: (r, contexto) => [r.loterias.length === 1
      ? paginaLoteria(r.loterias[0], contexto)
      : paginaLoterias(r, contexto)],
  },
  {
    tipo: 'metas',
    aplica: (r) => Boolean(r.metas),
    paginas: (r, { comunes, recursos }) => [{
      nombre: 'Metas',
      dibujar: (lienzo, fondo) => dibujarMetas(lienzo, {
        ...comunes,
        titulo: tituloMetas(r.metas.mes),
        // El mes siempre en el renglón siguiente: en una línea chocaba con Gali.
        tituloCompleto: true,
        // Gali preocupado, asomado tras la tarjeta: se nota que falta algo sin
        // regañar a nadie.
        personaje: recursos.galiPreocupado,
        medallas: recursos.medallas,
        fondo,
        trofeo: null,
      }),
    }],
  },
];

// Una lotería sola, en su hoja completa. Devuelve la zona del botón del live,
// que el PDF vuelve enlace.
function paginaLoteria(datos, { comunes, elegir, recursos }) {
  const loteria = LOTERIAS[datos.tipo];
  const { rifa, foto } = rifaParaHoja(datos.tipo, datos.mes, recursos.rifas);
  return {
    nombre: loteria.nombre,
    dibujar: (lienzo, fondo) => dibujarLoteria(lienzo, {
      ...comunes,
      titulo: loteria.titulo,
      tituloCompleto: true,
      pasos: loteria.pasos,
      nota: loteria.nota,
      // Sin Gali: la hoja de lotería va limpia, solo con el título.
      personaje: null,
      fondo,
      // El trofeo va dentro de la hoja, en lugar de la foto del premio si no
      // hay; en la cabecera chocaba con «Galilei».
      trofeo: null,
      copa: recursos.trofeo,
      datos,
      rifa,
      foto,
    }),
  };
}

// Varias loterías en una hoja. La de una lotería de training en una compañía
// sin training va solo con el premio: sin clasificados ni requisitos.
function paginaLoterias(r, { comunes, elegir, recursos }) {
  return {
    nombre: 'Loterías',
    dibujar: (lienzo, fondo) => dibujarLoterias(lienzo, {
      ...comunes,
      // Sin Gali, el título va en una línea a todo lo ancho.
      titulo: 'GaliLoterías',
      // El salto de línea del título manda: en una línea quedaba debajo de Gali.
      tituloCompleto: true,
      nota: notaDeLoterias(r.loterias),
      personaje: null,
      fondo,
      trofeo: null,
      copa: recursos.trofeo,
      loterias: r.loterias.map((datos) => ({
        nombre: LOTERIAS[datos.tipo].nombre,
        pasos: LOTERIAS[datos.tipo].pasos,
        datos,
        // Sin training (o con training apagado en «Qué mostrar», que queda igual
        // que una de solo reseñas): solo el premio y el aviso de para quién es.
        soloPremio: !datos.training,
        ...rifaParaHoja(datos.tipo, datos.mes, recursos.rifas),
      })),
    }),
  };
}

// Nota al pie de la hoja con varias loterías: cuáles paga Galilei. Solo la de
// Galilei y la de Reseñas (`pagaGalilei`); de las demás no se dice nada.
function notaDeLoterias(loterias) {
  const pagadas = loterias.filter((l) => LOTERIAS[l.tipo].pagaGalilei);
  if (!pagadas.length) return 'Se rifan en vivo cada mes.';
  if (pagadas.length === loterias.length) return 'Las paga 100 % Galilei: no le cuestan nada a tu empresa. Se rifan en vivo cada mes.';
  const nombres = pagadas.map((l) => `la ${LOTERIAS[l.tipo].nombre}`).join(' y ');
  return `${nombres.charAt(0).toUpperCase()}${nombres.slice(1)} la paga 100 % Galilei. Se rifan en vivo cada mes.`;
}

/**
 * Dibuja el reporte `r` en `lienzos` (se reutilizan entre llamadas: cada uno
 * pesa ~30 MB) y devuelve las hojas usadas, el nombre de cada una y las zonas
 * con enlace.
 *
 * @param {object} recursos  logo, trofeo, personajes, fondos, catalogo,
 *   imagenes y rifas ({ [lotería]: { rifa, foto } }).
 */
export function componerReporte(r, recursos, lienzos) {
  const semilla = `${r.compania}|${r.periodo.id}`;
  const contexto = {
    recursos,
    elegir: (lista, i) => personajeDe(lista, `${semilla}|${i}`),
    comunes: {
      kicker: r.cliente,
      logoCliente: r.logoCliente,
      logo: recursos.logo,
      etiqueta: `${diaMes(r.periodo.inicio)} - ${diaMes(r.periodo.fin)}`,
      trofeo: recursos.trofeo,
    },
  };
  const paginas = HOJAS.filter((h) => h.aplica(r)).flatMap((h) => h.paginas(r, contexto));
  const fondos = barajar(recursos.fondos, `${semilla}|fondos`);

  while (lienzos.length < paginas.length) lienzos.push(document.createElement('canvas'));
  const enlaces = [];
  paginas.forEach((p, i) => {
    // Una hoja devuelve una zona con enlace, varias (en un array) o ninguna.
    const zonas = [].concat(p.dibujar(lienzos[i], fondos[i % fondos.length] || null) || []);
    for (const z of zonas) if (z && z.url) enlaces.push({ hoja: i, ...z });
  });
  return { hojas: lienzos.slice(0, paginas.length), nombres: paginas.map((p) => p.nombre), enlaces };
}

// Los fondos, barajados con la semilla y repartidos en orden: no se repiten
// mientras haya hojas de sobra para todos (hoy son cuatro).
function barajar(lista, semilla) {
  const azar = azarConSemilla(semilla);
  return lista.map((f) => [azar(), f]).sort((a, b) => a[0] - b[0]).map(([, f]) => f);
}
