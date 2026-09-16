# Premios entregados — generador de la pieza semanal

Convierte el export de insights (`Compania, Player id, Premio, Fecha entrega, Player`)
en las imágenes de premios de cada compañía.

- **Celular** (por defecto): una imagen vertical de 1080 × 1792 con **todos los premios
  juntos** y los ganadores en un solo bloque al pie, pensada para mandar por WhatsApp. Sigue
  el rediseño de diciembre de 2026 ([Figma, frame `Plantillas Premios`][figma]). Si hay más de
  siete premios se parte en varias páginas, repartidas parejo.

  [figma]: https://www.figma.com/design/Cn8rwdQRIBy8P0iYQGJbCz/Galiverso----Galilei-Learning?node-id=14985-4931
- **Collage / retícula horizontal**: la pieza original de 4788 px de ancho.

Web: <https://jfegalilei.github.io/premios-semanales-galilei/>

## Cómo funciona

- La página es **estática** (GitHub Pages). El CSV se lee en el navegador y **no se sube a
  ningún lado**: trae nombres reales de jugadores.
- La **biblioteca de premios** (nombre, valor, categoría y recorte) y las **posiciones del
  personaje** viven en **Firestore**, en el mismo proyecto de Firebase que el calendario de
  contenidos (`ciclo-de-contenidos-galilei`), colecciones `premios` y `premiosConfig`. Lo que
  una persona sube lo ve todo el equipo al instante.
- Por ahora **sin login**: cualquiera con el enlace puede usarla y editar la biblioteca. Las
  reglas no permiten borrar premios y limitan campos y tamaño de los recortes. Las reglas se
  publican desde el repo del calendario (`firestore.rules`).
- Los recortes se guardan dentro del documento como WebP (máx. 1200 px y < 1 MB), comprimidos
  en el navegador al subirlos.

## Uso

1. Abre la web y suelta el CSV (o «Cargar CSV»).
2. Si algún premio no tiene recorte, aparece **Premios sin imagen**: suelta el PNG sin fondo,
   ajusta nombre, valor y categoría y pulsa Guardar. En **Biblioteca de premios** están todos
   los del catálogo para reemplazar recortes o corregir datos.
3. Elige la compañía, ajusta encabezado / título / etiqueta y la composición.
4. **Descargar JPG** baja las imágenes de esa compañía; **Exportar todo (ZIP)** arma un ZIP con
   las de todas.

En collage, el personaje se puede **arrastrar por la vista previa**; la posición queda guardada
para todas las piezas con esa cantidad de premios.

## Probar en local

```
npm start          # http://localhost:5180
```

Servidor estático sin dependencias; usa la misma Firestore que la web.

`herramientas/importar.html` (solo en local, ignorado por git) subió la biblioteca que existía
antes en `catalogo.json`, `premios/` y `personajes.json`. Se usa una sola vez: repetirlo pisa
lo editado desde la web.

## Estructura

| Ruta | Qué es |
|---|---|
| `index.html` | La página. |
| `server.js` | Servidor estático para probar en local. |
| `herramientas/vista-celular.html` | Banco de pruebas: dibuja las plantillas de celular con premios y ganadores de mentira, sin CSV ni Firestore. Acepta `?n=`, `?ancho=`, `?ganadores=`, `?fondo=` y `?personaje=`. |
| `marca/` | `logo-galilei.png`, exportado a 4x del propio Figma. |
| `Assets/Personajes/` | Las poses de Gali en WebP, listadas en `lista.json`. Una sale en cada pieza. |
| `Assets/Fondos/` | Escenarios recortados a 1080 × 1792 para la pieza de celular, listados en `lista.json`. |
| `Assets/Iconos/` | `trofeo.webp`, el icono 3D de la cabecera de la pieza de celular. |
| `public/app.js` | Orquestación: CSV, biblioteca, vista previa y descargas. |
| `public/lib/nube.js` | Conexión con Firestore. |
| `public/lib/csv.js` | Parseo del export (BOM, comillas, acentos). |
| `public/lib/normalizador.js` | Texto libre del premio → familia del catálogo. |
| `public/lib/carrusel.js` | Pieza de celular: las siete plantillas del rediseño. |
| `public/lib/plantillas.js` | Geometría de la pieza horizontal por cantidad de premios. |
| `public/lib/lienzo.js` | Render de la pieza horizontal y trazado de las punteadas. |

## La pieza de celular

`carrusel.js` lleva una **tabla de siete plantillas**, una por cantidad de premios, con la
geometría copiada del Figma en unidades de 1080 × 1792 (el lienzo real sale al doble). Con 1
premio va una tarjeta grande; con 6, una retícula de 3 × 2; con 7, dos tríos y el premio
principal en grande con los ganadores al lado. Los premios se ordenan por valor, así que en la
plantilla de 7 el más caro es el que va grande.

Al lado del nombre va un **contador «xN»** —pill verde con la tinta de marca— cuando de ese
premio se entregó más de uno. Se pega al final de la última línea del nombre y, si ahí no cabe,
baja a una línea propia.

Debajo, en verde, **cuánto se repartió en total**. Solo sale en los premios con
`desglose: por-monto` —Nequi y los bonos—, que son los únicos donde el valor cambia de una
entrega a otra; en una freidora el nombre ya lo dice todo. Se calcula sumando las **entregas**,
no los ganadores: quien recibió dos bonos puso dos veces, así que no se puede sacar de
`datos.montos`, que deduplica jugadores por monto. El valor va aparte del nombre a propósito:
antes se concatenaba («Bono Nequi de $50.000») y solo aparecía cuando la pieza horizontal
abría el premio por monto, de modo que en la pieza de celular se perdía.

No se listan los montos uno por uno: en una semana real Nequi llega a diez valores distintos
(de $5.000 a $100.000), que no caben en una tarjeta de 322 px.

Cuatro cosas se apartan del Figma a propósito:

- **El ancho del nombre del premio.** El diseño le da 208 px en las tarjetas grandes, que es lo
  que mide su texto de muestra («Nombre de Producto»). Con nombres de premio de verdad ese
  ancho trunca casi todo aunque sobre media tarjeta, así que se usa el ancho útil de la
  tarjeta. Cuando el nombre cabe en una línea, el resultado es idéntico.
- **El tamaño del nombre.** El diseño lo escala con la tarjeta: 24 px en las chicas, 32 en las
  grandes, 48 en la de un solo premio y 59,5 en la apaisada. Eso hacía que el mismo premio se
  leyera muy distinto según cuántos hubiera esa semana, así que va a 32 en todas
  (`D.nombreFuente`).
- **El alto de la caja de ganadores.** En el diseño es fijo y cambia por plantilla. Aquí se
  estira hasta un pie común de 1736 cuando la plantilla deja aire debajo, y así caben más
  nombres sin bajar de los 24 px: la de un premio pasa de 15 huecos a 21. Su `x`, `w` e `y`
  siguen siendo los del diseño, que es lo que la mantiene alineada con la retícula. La de siete
  premios no se estira: va pareada con la tarjeta grande de al lado.
- **El desenfoque de la caja de ganadores.** El diseño le pone un `backdrop-blur` de 7,6 px.
  A esa altura el degradado negro del pie ya cubre el fondo al ~56 %, así que el desenfoque no
  se distingue y no se implementa.

Lo que no cabe se resume en **«+N más»** en verde. Cada página lista solo los ganadores de
*sus* premios, y quien ganó dos cosas sale una sola vez.

### Las dos opacidades, medidas

Los valores del CSS de Figma no se pueden copiar tal cual, así que se sacaron muestreando el
render del frame y comparándolo con el fondo desnudo (por el hueco entre tarjetas, y por fuera
de la caja de ganadores):

- **Tarjetas.** El CSS declara la franja de luz de 0 a 0,2, pero con los dos stops fuera de la
  caja (8,5 % y 105,94 %) lo que se ve va de **0,035 abajo a 0,185 arriba** — nunca llega a
  transparente. Tomándolo literal, la mitad inferior de cada tarjeta salía demasiado limpia.
- **Caja de ganadores.** Va en `multiply`, no en `source-over`: el fondo baja a un factor de
  0,57-0,71 y eso solo lo da el multiply (con `source-over` daba 0,78, bastante más claro).
  Su degradado tampoco va de esquina a esquina: el eje de un degradado CSS pasa por el centro
  con el ángulo dado (156,77°) y mide `|w·sin| + |h·cos|`; tomándolo por la esquina, el lado
  derecho de la caja se quedaba casi sin oscurecer.

El banco de pruebas sirve para repetir la medición si el diseño cambia.

El **personaje** se recorta solo por abajo, donde el corte lo explica el borde de la retícula.
La banda de recorte va de lado a lado del lienzo a propósito: encajándolo también por el ancho
de su caja (422 px), cuatro de las diez poses —las de proporción ancha, como `image 110365` a
1,20— la llenaban de lado a lado y perdían un costado cortado en el aire. Ahora se escala por
el alto y se le deja asomar a los lados; solo cede tamaño si fuera más ancho que la pieza. El
título se pinta **encima** del personaje, como en el diseño, que es lo que lo mantiene legible
cuando una pose ancha llega a solaparlo.

Escenario y personaje se eligen con la misma semilla (compañía + fecha + página), así que
cambian cada semana pero no entre repintados. **Solo sirven escenarios claros**: el diseño
oscurece el fondo un 45 % y le monta un degradado negro desde el pie, así que los
`frondaria-bg-*` del repositorio —que son versiones nocturnas, del 5 al 17 % de brillo— quedan
en negro y están fuera de `Assets/Fondos/lista.json`. Ahí solo entran los que pasan del 30 %.

## Cómo agrupa los premios

El export trae el premio como texto libre. `normalizador.js` lo resuelve en este orden:

1. **Alias del catálogo** — la vía para corregir a mano sin tocar código. Añade el texto
   exacto al array `alias` de la entrada y todas las variantes caen en la misma familia.
   Ya se usa para que `CinecoPass Premium x2` cuente con `cinecopass-2d-x2`.
2. **Patrones con monto** — `40.00 GaliTickets`, `Bono Nequi de 10000.00 pesos`,
   `Bono Adidas $300000.00`, `Zara ($100.000)`. El monto solo sirve para el desglose.
3. **El texto completo** como familia — `Netflix`, `Freidora de Aire`, `Barril Ahumador`.

Con el export del 2 al 8 de septiembre de 2026, 30 textos distintos colapsan en 14 familias.

### Entradas del catálogo

```json
{
  "id": "nequi",
  "etiqueta": { "singular": "Bono Nequi", "plural": "Bonos Nequi" },
  "imagen": "premios/nequi.png",
  "alias": [],
  "desglose": "por-monto",
  "unidadMonto": "pesos",
  "prioridad": 40
}
```

- `desglose`: `por-monto` lista `$10.000 Fulano, Mengano` (una línea por monto);
  `por-nombre` lista solo los ganadores.
- `valor`: precio aproximado en pesos. Decide **cuál es el premio destacado** (el más
  caro). Los premios con `desglose: por-monto` (los bonos) no lo llevan: el precio va en
  cada fila del CSV, así que en la Biblioteca su campo sale **bloqueado con «No aplica»**
  — y si cambias el desglose de un premio, el campo se bloquea o se libera al momento. Los
  premios físicos sí, y vienen con una **estimación de mercado puesta a mano** que
  conviene revisar: freidora 400.000, barril ahumador 700.000, Xiaomi Redmi Buds 150.000,
  Netflix 35.000, CinecoPass 40.000, caja Dunkin' 30.000. Se corrigen en la Biblioteca.
  El aviso bajo la vista previa dice cuántos premios de esa pieza siguen sin valor.
- `ignorar: true`: el premio no entra en la pieza ni cuenta como entrega. Hoy lo llevan
  los **GaliTickets**. Para volver a incluirlos, quita la clave y recarga el CSV.
- `prioridad`: desempata quién queda de premio destacado cuando dos tienen las mismas
  entregas. El selector de la interfaz manda por encima.

## Composición

La pieza muestra **hasta 7 familias** en collage y 6 en retícula (las de más entregas); el
resto se anuncia en el aviso bajo la vista previa. Hay dos modos, intercambiables desde el selector
**Composición**, y la pieza del collage se guarda con el sufijo `-collage` para poder
comparar los dos.

**Retícula.** Bloque arriba (chip verde + caja de ganadores) y recorte debajo. La banda de
imagen arranca donde termina la lista más larga de su fila, así que una lista larga nunca
pisa el recorte y los recortes de una fila comparten suelo. Nada se solapa.

**Collage.** El premio **destacado va en el centro del lienzo** (centrado en x = 2394 y con
el recorte más grande) y los demás lo rodean.

Cada premio ocupa una **región** propia y las regiones no se tocan, así que nada se solapa.
Lo que va dentro se coloca en tiempo de render: el bloque se mide primero y el recorte se
pega a él dejando solo `ESTILO.huecoBloqueImagen`, así que **si la lista trae pocos nombres
el par entero encoge** en vez de dejar el recorte colgado lejos de la caja gris.

El destacado lleva el bloque arriba y el recorte debajo; los demás al revés — recorte
arriba, texto debajo. No es capricho: con el bloque encima y del mismo ancho que el recorte
no queda por dónde bajar la punteada sin cruzar la propia caja de ganadores.

### Las líneas punteadas

Bézier **cuadrática** con el punto de control en el cruce de las dos tangentes: es el filete
que se dibujaría a mano para empalmar dos rectas en ángulo, así que sale una sola curva,
suave y perpendicular al llegar.

`curvaPunteada` prueba las **cuatro salidas del chip** (arriba, abajo, izquierda, derecha)
contra **todas las franjas del perfil de píxeles** del recorte, una de cada tres, por sus
cuatro bordes: entre 20 y 100 puntos de llegada por premio. Solo valen las combinaciones
perpendiculares. De ahí se descartan las que pasan por encima de algo y gana la de menor
**distancia en línea recta del chip al punto donde aterriza**, encarecida según lo desiguales
que sean sus dos tramos: así sale corta, hacia el punto más cercano del recorte, y con forma
de arco cóncavo parejo (partida por la mitad, los dos lados casi en espejo). Por eso cada premio saca su línea por un lado distinto y casi siempre pegada.

El chip y la caja gris de un mismo bloque se apuntan como obstáculos **por separado**: la
línea nace pegada a su propio chip, así que ese rectángulo no puede contar como estorbo para
ella — su caja gris sí. Si aun así no queda ninguna ruta libre, el premio se queda sin línea
(se avisa por consola) antes que dibujar una que cruce algo.

**Ninguna línea pasa por encima de nada.** Las cajas de los demás premios —texto y recorte—
están prohibidas en todo el recorrido. El recorte al que va la propia línea también, pero ahí
la prueba es contra sus **píxeles**, no contra su caja: un PNG recortado trae mucho fondo
transparente, y por ese aire la línea sí puede acercarse. Esa prueba se levanta en el último
12 % del trayecto, que es justo cuando llega a arrimarse.

Ningún extremo toca nada: sale a `ESTILO.holguraLinea` (30 px) del chip verde y termina a esa
misma distancia de los **píxeles opacos** del producto. `perfilesOpacos` en `app.js` mide el
alfa de cada PNG y guarda, para 72 franjas verticales y 72 horizontales, dónde empieza y
termina el producto; si la franja elegida está vacía, la línea busca la siguiente con píxeles.

### Los nombres

`formatearNombre` en `normalizador.js` los deja con inicial mayúscula —el CSV los trae en
mayúsculas, en minúsculas y mezclados— y los corta a **tres partes**: dos nombres y un
apellido, o un nombre y dos apellidos. Las partículas (`de`, `del`, `la`...) no cuentan como
parte y se quedan en minúscula, así que "Maria de los Angeles Perez Gomez" queda
"Maria de los Angeles Perez". Se aplica una sola vez al leer el CSV, así que vale igual para
la pieza, para el conteo y para el desduplicado.

La caja gris se ajusta al ancho de su línea más larga, no al del bloque, para que no le sobre
fondo a los lados.

### Cuando hay muy pocos premios

Una compañía con un solo premio distinto deja la pieza vacía. `abrirPorMonto` en `app.js`
detecta ese caso y abre los premios desglosados por monto en un item por monto — "6 Bonos
Nequi de $100.000", "4 de $50.000", "3 de $10.000" — hasta llegar a cuatro items. Todos
comparten el mismo recorte. Si todos los bonos son del mismo monto no hay nada que abrir y
la pieza se queda como está.

Los layouts viven en `public/lib/plantillas.js`, en coordenadas absolutas sobre el lienzo.
Para retocar la pieza se editan ahí, no en el render.

## Tipografías

Dos familias de marca, ambas desde Google Fonts:

- **Radio Canada Big** (`ESTILO.fuenteTitulo`) — titular, chip de etiqueta, encabezado y
  los chips verdes de cada premio. Su peso máximo es **700**, no 900: por eso el titular
  va en `ESTILO.pesoTitulo`.
- **Space Grotesk** (`ESTILO.fuenteGanadores`) — solo el texto de las cajas grises con los
  ganadores. En `lienzo.js` lo aplica el helper `fuenteGanadores()`; `fuente()` es la otra.

El navegador solo descarga una webfont cuando alguien la usa, y **dibujar en canvas no
cuenta como uso**: `document.fonts.ready` por sí solo no garantiza nada. Por eso `app.js`
pide a mano con `document.fonts.load()` cada peso que se dibuja antes del primer render.
Si se añade un peso nuevo en `lienzo.js`, hay que añadirlo también a esa lista.

Para dejarlo offline basta con poner los `.woff2` en `marca/` y cambiar las dos familias.

## El personaje

Cada pieza saca **un personaje, y solo uno**: una pose de Gali al azar de las que lista
`Assets/Personajes/lista.json`. Uno por pieza y no uno por premio a propósito: con siete
estrellas verdes al lado de siete chips verde lima el producto deja de ser el
protagonista.

**Solo Galis.** Syderax y el dragón salieron de la lista; sus WebP siguen en la carpeta
por si hicieran falta, pero nada los usa. `PERSONAJE.alto` en `lienzo.js` aún tiene la
regla que dibujaba a Syderax al doble de alto (2300 px contra 1150) y `personajes.json`
guarda posiciones suyas: no molestan, pero ya no se ejercitan.

Para añadir una pose: suelta el PNG en la carpeta, conviértelo a WebP (alto 1400,
calidad 88) y apúntalo en `lista.json`. Los PNG originales no van al repositorio.

### Dónde se pone

**En el hueco más grande de la plantilla, centrado en él.** El hueco se busca con el
método del histograma sobre una rejilla de ocupación, y gana **el que deje meter al
personaje más grande**, no el de más área: una franja ancha y plana tiene mucha área y no
sirve para un bicho de pie.

Centrado, y no en la mejor posición suelta que se encuentre. Probar posiciones por todo el
lienzo y quedarse con la menos tapada daba dos resultados malos: personajes descolgados en
una esquina, con pinta de puestos al azar, y personajes metidos justo detrás de un premio
—que es lo contrario de llenar un vacío—. El hueco manda y dentro del hueco se pone en
medio: la búsqueda arranca en el centro exacto y se abre hacia fuera, así que la primera
posición válida es la más cercana al centro y solo se corre lo justo cuando centrado no
cumple. Puede apartarse como mucho un 45 % de su propio tamaño (`margenBusqueda`).

**La misma cantidad de premios da siempre la misma posición.** El hueco se mide sobre las
**regiones que la plantilla reserva a cada premio**, no sobre las cajas que de verdad
ocuparon los textos: dos compañías de cinco premios sacan el personaje en el mismo sitio
aunque una traiga listas de ganadores más largas. La posición va en **píxeles absolutos**,
como toda la geometría de la pieza, para que quede en el mismo punto respecto de los
premios aunque el lienzo se recorte a distinto alto. Y el recorte del lienzo cuenta al
personaje como contenido, así que una pieza corta no se corta justo por encima de él —
solo cuando la posición es la calculada; una puesta a mano no alarga la pieza.

Si la plantilla no deja ningún hueco decente (pasa con dos premios, que ocupan el lienzo
casi entero), el personaje **se asoma por la esquina de abajo a la derecha** en vez de no
salir: uno que no se dibuja tampoco se puede arrastrar, y entonces no habría manera de
colocarlo a mano.

### Colocarlo a mano

En la vista previa el personaje **se arrastra**. Al soltarlo, la posición se guarda en
`personajes.json` bajo la clave `modo-cantidad-pose` (`collage-5-gali-42`), así que vale
para **todas las piezas con esa misma cantidad de premios**, no solo para la compañía que
tienes delante — pero **solo para esa pose**: cada Gali tiene su silueta y su proporción,
así que el sitio que le va bien a uno no tiene por qué irle al otro.

Al agarrar un personaje se dibuja a su tamaño normal, aunque el cálculo lo hubiera
encogido para que cupiera: así lo que arrastras es lo que queda.

Mientras una pose no tenga posición propia **toma prestada la de otra pose** de esa misma
cantidad de premios, para no empezar de cero; en cuanto la acomodas se queda con la suya y
deja de seguir a las demás. El aviso bajo la vista previa distingue los dos casos. El enlace **Devolver a su sitio automático**, bajo la vista previa, borra la posición
propia de esa pose y la devuelve a la prestada o a la calculada; solo aparece cuando esa
pose tiene posición propia que deshacer.

Una posición puesta a mano se respeta tal cual: mandas tú, así que ahí no se aplican los
límites de tapado de abajo **y el lienzo tampoco crece para perseguirlo**. Si lo sacas
aposta por el borde de abajo, es porque quieres que asome, no que la pieza se alargue.

### Qué se le permite

**Va por detrás de todo y puede desbordar su hueco**, tanto por detrás de los premios
vecinos como fuera del lienzo. Lo único que se le exige es que se le vea: nunca más del
**30 %** tapado (`maxOculto`), contando igual lo que le pisan los premios y lo que se le
sale del lienzo. La **cabeza se protege aparte** —el 38 % superior no puede pasar del 12 %
tapado—, porque que le tapen la cola no es lo mismo que que le caiga un chip verde en la
cara. Si no encuentra sitio, encoge hasta el 55 % antes de renunciar; si aun así no cabe,
la pieza sale sin personaje.

La comprobación se hace sobre su **caja**, no sobre su silueta; como la caja incluye el
aire transparente, el criterio es algo más estricto que lo pedido, no más flojo.

### Cómo queda detrás

Sale gratis gracias al orden de composición: **el fondo se pinta al final con
`destination-over`** (ver `dibujarPieza`), así que todo lo dibujado antes ya está por
encima del personaje sin tener que adivinar las cajas de los premios antes de medirlas.
El personaje **no cuenta como obstáculo para las líneas punteadas**: eligen su camino como
si no estuviera y le pasan por encima si les conviene. Es decoración de fondo, y hacer que
lo esquivaran obligaba a las líneas a dar rodeos peores que el cruce que evitaban.

**Cada carga del CSV reparte los personajes de nuevo**: al leer el archivo se saca una
tirada al azar que entra en la semilla, así que dos semanas seguidas no le tocan los mismos
bichos a las mismas compañías. Dentro de una misma carga la tirada no cambia, y por eso la
vista previa no muda de personaje a cada repintado — con `Math.random()` a secas sería
imposible trabajar.

## El archivo de salida

**JPG de calidad 0.9**, a tamaño completo (`SALIDA` en `lienzo.js`). La pieza de siete
premios pasa de **21 MB en PNG a 1,6 MB**, y la pérdida es invisible: el error medio por
píxel es de 0,9 sobre 255 (PSNR 43 dB en el texto pequeño de las cajas grises, 49 dB en el
degradado del fondo, que es donde el JPG suele hacer bandas). A ojo, al 100 %, no se
distingue del PNG. Para volver a PNG basta con cambiar `tipo` y `extension` en `SALIDA`;
el servidor acepta los dos.

Tanto la descarga como el guardado usan **`toBlob`, que es asíncrono**, y la imagen viaja
en crudo al servidor (`POST /api/pieza?nombre=…`). Con `toDataURL` —síncrono, y encima
inflando a base64— la pestaña se quedaba congelada mientras comprimía. Ahora guardar la
pieza más grande tarda unos 5 segundos y la interfaz sigue viva.

## Pendientes

- Los recortes PNG sin fondo de cada premio. La web los va pidiendo.
