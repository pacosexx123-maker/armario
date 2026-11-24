// Service worker de Armario: cachea la app para que funcione sin conexión.
// Cambia VERSION cada vez que publiques cambios (además, los archivos de la
// app se piden siempre primero a la red, así que los cambios llegan solos).
const VERSION = 'armario-v6';
const APP_CACHE = `${VERSION}-app`;
const RUNTIME_CACHE = `${VERSION}-runtime`;
const ESPERA_RED_MS = 4000; // con conexión lenta, usar la caché pasado este tiempo

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
  './js/label.js',
  './js/backup.js',
  './js/ui.js',
  './js/palette.js',
  './js/matching.js',
  './js/illustration.js',
  './js/inspiration.js',
  './js/lookeditor.js',
  './js/segment.js',
  './looks.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

// Dominios externos que se guardan en caché la primera vez que se usan
// (tipografías, TensorFlow.js y el lector de etiquetas).
const RUNTIME_HOSTS = ['cdn.jsdelivr.net', 'fonts.googleapis.com', 'fonts.gstatic.com', 'tessdata.projectnaptha.com'];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(APP_CACHE);
    // cache: 'reload' evita la caché HTTP del navegador (GitHub Pages da 10 min),
    // para no guardar archivos antiguos en la versión nueva.
    await cache.addAll(APP_SHELL.map((url) => new Request(url, { cache: 'reload' })));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    // Se conserva la caché de librerías (runtime) de versiones anteriores para no
    // volver a descargarlas; solo se borran las cachés antiguas de la app.
    await Promise.all(keys
      .filter((k) => k.endsWith('-app') && k !== APP_CACHE)
      .map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

// Red primero (sin caché HTTP); si no hay conexión o tarda demasiado, caché.
// `respaldo`: otra entrada de la caché a usar si esta no está (p. ej. index.html).
async function redPrimero(req, respaldo) {
  const cache = await caches.open(APP_CACHE);
  const red = fetch(req.url, { cache: 'no-cache', credentials: 'same-origin' })
    .then((res) => {
      if (res.ok) cache.put(req.url.split('#')[0].split('?')[0], res.clone());
      return res;
    });
  red.catch(() => {}); // evita avisos si gana la caché y luego falla la red
  const enCache = (await cache.match(req, { ignoreSearch: true })) || (respaldo && (await cache.match(respaldo)));
  if (!enCache) return red;
  const tiempo = new Promise((resolve) => setTimeout(() => resolve(null), ESPERA_RED_MS));
  try {
    return (await Promise.race([red, tiempo])) || enCache;
  } catch {
    return enCache;
  }
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  if (url.origin === self.location.origin) {
    // Navegación: la página pedida; sin conexión, la app (index.html) de la caché
    if (req.mode === 'navigate') {
      event.respondWith(redPrimero(req, './index.html'));
      return;
    }
    event.respondWith(redPrimero(req));
    return;
  }

  // CDN, modelos y tipografías: caché primero (son versiones fijas).
  if (RUNTIME_HOSTS.includes(url.hostname)) {
    event.respondWith((async () => {
      const keys = await caches.keys();
      for (const k of keys.filter((n) => n.endsWith('-runtime'))) {
        const hit = await (await caches.open(k)).match(req);
        if (hit) return hit;
      }
      const res = await fetch(req);
      if (res.ok || res.type === 'opaque') (await caches.open(RUNTIME_CACHE)).put(req, res.clone());
      return res;
    })());
  }
});
