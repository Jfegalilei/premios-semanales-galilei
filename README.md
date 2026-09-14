# Premios entregados — generador de la pieza semanal

Convierte el export de insights (`Compania, Player id, Premio, Fecha entrega, Player`)
en las imágenes de premios de cada compañía.

- **Carrusel celular** (por defecto): una imagen de 1080 × 1920 por categoría —Plata, Bonos,
  Electrodomésticos y electrónicos—, pensada para mandar por WhatsApp.
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
| `marca/` | `logo-galilei.png`, exportado a 4x del propio Figma. |
| `Assets/Personajes/` | Gali y Syderax en WebP, listados en `lista.json`. Uno sale en cada pieza. |
| `public/app.js` | Orquestación: CSV, biblioteca, vista previa y descargas. |
| `public/lib/nube.js` | Conexión con Firestore. |
| `public/lib/csv.js` | Parseo del export (BOM, comillas, acentos). |
| `public/lib/normalizador.js` | Texto libre del premio → familia del catálogo. |
| `public/lib/carrusel.js` | Carrusel para celular. |
| `public/lib/plantillas.js` | Geometría de la pieza horizontal por cantidad de premios. |
| `public/lib/lienzo.js` | Render de la pieza horizontal y trazado de las punteadas. |

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

Cada pieza saca **un personaje, y solo uno**: Gali o Syderax, pose al azar, de
`Assets/Personajes/` (añadir una pose es soltar el PNG en la carpeta; el servidor la
lista en `/api/personajes`). Uno por pieza y no uno por premio a propósito: con siete
estrellas verdes al lado de siete chips verde lima el producto deja de ser el
protagonista.

**Syderax se dibuja al doble de alto que Gali** — 2300 px contra 1150 (`PERSONAJE.alto`
en `lienzo.js`).

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
tienes delante — pero **solo para esa pose**: Syderax mide el doble que Gali y tiene otra
silueta, así que el sitio que le va bien a uno no tiene por qué irle al otro.

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
