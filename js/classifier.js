// Clasificación en el propio móvil con TensorFlow.js + MobileNet v2.
// Las librerías se cargan desde CDN solo la primera vez que se necesitan;
// el modelo se guarda en IndexedDB para funcionar después sin conexión.

import { IMAGENET_A_CATEGORIA } from './categories.js';

const TFJS_URL = 'https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.22.0/dist/tf.min.js';
const MOBILENET_URL = 'https://cdn.jsdelivr.net/npm/@tensorflow-models/mobilenet@2.1.1/dist/mobilenet.min.js';
const MODELO_LOCAL = 'indexeddb://armario-mobilenet-v2';
const UMBRAL_SEGURO = 0.3;

let modeloPromise = null;

function cargarScript(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[data-src="${src}"]`)) return resolve();
    const s = document.createElement('script');
    s.src = src;
    s.async = true;
    s.crossOrigin = 'anonymous';
    s.dataset.src = src;
    s.onload = () => resolve();
    s.onerror = () => { s.remove(); reject(new Error('No se pudo descargar ' + src)); };
    document.head.appendChild(s);
  });
}

export function cargarModelo(onEstado = () => {}) {
  if (!modeloPromise) {
    modeloPromise = (async () => {
      onEstado('Cargando el clasificador…');
      await cargarScript(TFJS_URL);
      await cargarScript(MOBILENET_URL);
      await window.tf.ready();
      try {
        // Copia guardada en el móvil (el modelo de TF Hub usa entrada en rango [0, 1])
        return await window.mobilenet.load({ version: 2, alpha: 1.0, modelUrl: MODELO_LOCAL, inputRange: [0, 1] });
      } catch {
        onEstado('Descargando el modelo (solo la primera vez, ~14 MB)…');
        const m = await window.mobilenet.load({ version: 2, alpha: 1.0 });
        try { await m.model.save(MODELO_LOCAL); } catch (e) { console.warn('No se pudo guardar el modelo', e); }
        return m;
      }
    })().catch((e) => { modeloPromise = null; throw e; });
  }
  return modeloPromise;
}

// Devuelve { categoria, confianza, segura, sugerencias, etiquetas }
export async function clasificar(imagen, onEstado) {
  const modelo = await cargarModelo(onEstado);
  onEstado && onEstado('Analizando la prenda…');
  const preds = await modelo.classify(imagen, 10);
  const puntos = {};
  for (const p of preds) {
    const clave = p.className.split(',')[0].trim().toLowerCase();
    const map = IMAGENET_A_CATEGORIA[clave];
    if (!map) continue;
    const [cat, fiab] = map;
    puntos[cat] = (puntos[cat] || 0) + p.probability * fiab;
  }
  const orden = Object.entries(puntos).sort((a, b) => b[1] - a[1]);
  const [categoria, confianza] = orden[0] || [null, 0];
  return {
    categoria,
    confianza,
    segura: !!categoria && confianza >= UMBRAL_SEGURO,
    sugerencias: orden.map(([c]) => c),
    etiquetas: preds.slice(0, 3).map((p) => `${p.className} (${Math.round(p.probability * 100)} %)`),
  };
}
