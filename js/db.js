// Almacenamiento local con IndexedDB (todo queda en el móvil).
// Almacenes: "prendas", "outfits" (favoritos) y "looks" (mis looks de inspiración).

const DB_NAME = 'armario-db';
const DB_VERSION = 2; // v2: almacén "looks" (mis looks de inspiración)
let dbPromise = null;

function openDB() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('prendas')) db.createObjectStore('prendas', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('outfits')) db.createObjectStore('outfits', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('looks')) db.createObjectStore('looks', { keyPath: 'id' });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  return dbPromise;
}

async function run(storeName, mode, fn) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, mode);
    const store = tx.objectStore(storeName);
    const req = fn(store);
    tx.oncomplete = () => resolve(req ? req.result : undefined);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

export const getAll = (store) => run(store, 'readonly', (s) => s.getAll());
export const get = (store, id) => run(store, 'readonly', (s) => s.get(id));
export const put = (store, obj) => run(store, 'readwrite', (s) => s.put(obj));
export const remove = (store, id) => run(store, 'readwrite', (s) => s.delete(id));
export const clear = (store) => run(store, 'readwrite', (s) => s.clear());

export async function putMany(store, items) {
  return run(store, 'readwrite', (s) => { items.forEach((it) => s.put(it)); return null; });
}

export function uid() {
  if (crypto.randomUUID) return crypto.randomUUID();
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}

// Pide al navegador que no borre los datos si falta espacio.
export async function requestPersistence() {
  try {
    if (navigator.storage && navigator.storage.persist) return await navigator.storage.persist();
  } catch { /* sin soporte */ }
  return false;
}
