// Servidor estático para probar la página en local (`npm start`).
//
// La web publicada vive en GitHub Pages y guarda la biblioteca en Firestore, así
// que este servidor ya no escribe nada en disco: solo sirve archivos, igual que
// Pages. Sirve también `catalogo.json`, `personajes.json` y `premios/`, que no van
// al repositorio y solo usa `herramientas/importar.html`.
import { createServer } from 'node:http';
import { readFile, access } from 'node:fs/promises';
import { extname, join, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = fileURLToPath(new URL('.', import.meta.url));
const PUERTO = Number(process.env.PORT) || 5180;

const TIPOS = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
};

// Solo esto es servible. Deja fuera el CSV de insights (trae nombres reales) y salidas/.
const PUBLICAS = ['index.html', 'public', 'marca', 'Assets', 'premios', 'herramientas', 'catalogo.json', 'personajes.json'];

const existe = async (p) => access(p).then(() => true, () => false);

function rutaSegura(urlPath) {
  const limpia = normalize(decodeURIComponent(urlPath)).replace(/^[/\\]+/, '');
  if (limpia.startsWith('..')) return null;
  if (!PUBLICAS.includes(limpia.split(/[/\\]/)[0])) return null;
  return join(RAIZ, limpia).split('/').join(sep);
}

createServer(async (req, res) => {
  const { pathname } = new URL(req.url, `http://localhost:${PUERTO}`);
  const ruta = pathname === '/' ? join(RAIZ, 'index.html') : rutaSegura(pathname);
  if (!ruta || !(await existe(ruta))) {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('No encontrado');
    return;
  }
  res.writeHead(200, {
    'content-type': TIPOS[extname(ruta).toLowerCase()] || 'application/octet-stream',
    'cache-control': 'no-store',
  });
  res.end(await readFile(ruta));
}).listen(PUERTO, () => {
  console.log(`Premios semanales -> http://localhost:${PUERTO}`);
});
