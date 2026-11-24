// Service worker de Armario: cachea la app para que funcione sin conexión.
// Cambia VERSION cada vez que publiques cambios para que los móviles se actualicen.
const VERSION = 'armario-v1';
const APP_CACHE = `${VERSION}-app`;
const RUNTIME_CACHE = `${VERSION}-runtime`;

const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './css/styles.css',
  './js/app.js',
  './js/db.js',
  './js/image.js',
  './js/color.js',
  './js/categories.js',
  './js/classifier.js',
  './js/outfits.js',
  './js/backup.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

// Dominios externos que se guardan en caché la primera vez que se usan
// (tipografías y librerías de TensorFlow.js).
const RUNTIME_HOSTS = ['cdn.jsdelivr.net', 'fonts.googleapis.com', 'fonts.gstatic.com'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(APP_CACHE).then((cache) => cache.addAll(APP_SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Archivos de la propia app: primero caché, si no, red.
  if (url.origin === self.location.origin) {
    // Navegación: devolver siempre index.html (funciona offline).
    if (req.mode === 'navigate') {
      event.respondWith(
        fetch(req).then((res) => {
          const copy = res.clone();
          caches.open(APP_CACHE).then((c) => c.put('./index.html', copy));
          return res;
        }).catch(() => caches.match('./index.html'))
      );
      return;
    }
    event.respondWith(
      caches.match(req, { ignoreSearch: true }).then((cached) => cached || fetch(req).then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(APP_CACHE).then((c) => c.put(req, copy));
        }
        return res;
      }))
    );
    return;
  }

  // CDN y tipografías: caché primero; se descargan solo la primera vez.
  if (RUNTIME_HOSTS.includes(url.hostname)) {
    event.respondWith(
      caches.open(RUNTIME_CACHE).then((cache) =>
        cache.match(req).then((cached) => cached || fetch(req).then((res) => {
          if (res.ok || res.type === 'opaque') cache.put(req, res.clone());
          return res;
        }))
      )
    );
  }
  // El resto (pesos del modelo, etc.) va directo a la red; TensorFlow.js
  // guarda el modelo en IndexedDB tras la primera descarga.
});
