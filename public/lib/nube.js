// Datos compartidos en Firestore: la biblioteca de premios y las posiciones del
// personaje. Así, lo que alguien suba o corrija desde la página lo ven todos, sin
// servidor propio: la web es estática (GitHub Pages).
//
// Comparte el proyecto de Firebase con el calendario de contenidos. Estas claves
// son públicas por diseño; quien decide qué se puede leer y escribir son las
// reglas de Firestore (bloques `premios` y `premiosConfig`).
//
// Por ahora sin login: cualquiera con el enlace puede usar y editar la biblioteca.

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js';
import {
  getFirestore, collection, doc, onSnapshot, setDoc,
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';

const app = initializeApp({
  apiKey: 'AIzaSyBRmGScmcJKATSX1EAiXSSGHlMtN-Z-IeE',
  authDomain: 'ciclo-de-contenidos-galilei.firebaseapp.com',
  projectId: 'ciclo-de-contenidos-galilei',
  storageBucket: 'ciclo-de-contenidos-galilei.appspot.com',
  messagingSenderId: '253360502665',
  appId: '1:253360502665:web:15df55d7901d95c4585358',
}, 'premios');

const db = getFirestore(app);

// Cada documento de `premios` es una entrada del catálogo con su recorte dentro,
// como data URI WebP (`imagen`). El id del documento es el id del premio.
export function escucharPremios(alCambiar, alError) {
  return onSnapshot(collection(db, 'premios'), (snap) => {
    alCambiar(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  }, alError);
}

// Fusiona: guardar solo textos no borra el recorte que ya estaba.
export function guardarPremio(id, datos) {
  return setDoc(doc(db, 'premios', id), datos, { merge: true });
}

export function escucharPosiciones(alCambiar, alError) {
  return onSnapshot(doc(db, 'premiosConfig', 'posiciones'), (snap) => {
    alCambiar((snap.exists() && snap.data().posiciones) || {});
  }, alError);
}

// Reemplaza el mapa entero: así quitar una posición la quita de verdad.
export function guardarPosiciones(posiciones) {
  return setDoc(doc(db, 'premiosConfig', 'posiciones'), { posiciones });
}
