// Detección de prendas en una foto con transformers.js + SegFormer entrenado para ropa
// (Xenova/segformer_b2_clothes, versión ONNX cuantizada de ~29 MB).
// Se carga solo al usarlo; transformers.js guarda el modelo en la caché del navegador.

import { rgbToLab, labToRgb, rgbToHex, nombreColor, kmeans } from './color.js';

const TRANSFORMERS_URL = 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1/dist/transformers.min.js';
const MODELO = 'Xenova/segformer_b2_clothes';

// Etiqueta del modelo → [categoría propuesta, nombre en español, área mínima (fracción de la foto)]
const ETIQUETAS = {
  'Upper-clothes': ['camiseta', 'Parte de arriba', 0.003],
  'Pants': ['pantalon', 'Pantalón', 0.003],
  'Skirt': ['falda', 'Falda', 0.003],
  'Dress': ['vestido', 'Vestido', 0.003],
  'Shoes': ['zapatos', 'Calzado', 0.0006],
  'Bag': ['bolso', 'Bolso', 0.001],
  'Scarf': ['bufanda', 'Bufanda', 0.001],
  'Belt': ['cinturon', 'Cinturón', 0.0006],
  'Hat': ['gorro', 'Gorro', 0.001],
};

let segPromise = null;

function cargarSegmentador(onEstado) {
  if (!segPromise) {
    segPromise = (async () => {
      onEstado('Cargando el detector de prendas…');
      const { pipeline, env } = await import(TRANSFORMERS_URL);
      env.allowLocalModels = false;
      env.useBrowserCache = true; // el modelo queda guardado en el móvil
      const progreso = {};
      return pipeline('image-segmentation', MODELO, {
        dtype: 'q8',
        device: 'wasm',
        progress_callback: (p) => {
          if (p.status !== 'progress' || !p.total) return;
          progreso[p.file] = [p.loaded, p.total];
          let l = 0, t = 0;
          Object.values(progreso).forEach(([a, b]) => { l += a; t += b; });
          if (t > 2e6) onEstado(`Descargando el detector (solo la primera vez)… ${Math.round((l / t) * 100)} % de ${Math.round(t / 1048576)} MB`);
        },
      });
    })().catch((e) => { segPromise = null; throw e; });
  }
  return segPromise;
}

// Color dominante solo con los píxeles de la máscara (sin los bordes), k-means en Lab
function colorDeMascara(datos, w, h, mascara, area) {
  const paso = Math.max(1, Math.floor(Math.sqrt(area / 5000)));
  const e = Math.max(2, Math.round(Math.min(w, h) / 200)); // margen para ignorar bordes
  const dentro = (x, y) => x >= 0 && y >= 0 && x < w && y < h && mascara[y * w + x];
  const pts = [], todos = [];
  for (let y = 0; y < h; y += paso) {
    for (let x = 0; x < w; x += paso) {
      if (!mascara[y * w + x]) continue;
      const k = (y * w + x) * 4;
      const lab = rgbToLab(datos[k], datos[k + 1], datos[k + 2]);
      todos.push(lab);
      if (dentro(x - e, y) && dentro(x + e, y) && dentro(x, y - e) && dentro(x, y + e)) pts.push(lab);
    }
  }
  const usar = pts.length >= 30 ? pts : todos;
  const grupos = kmeans(usar, null, 4);
  const lab = grupos[0].center;
  return { hex: rgbToHex(labToRgb(lab)), nombre: nombreColor(lab) };
}

export async function detectarPrendas(canvas, onEstado = () => {}) {
  const seg = await cargarSegmentador(onEstado);
  onEstado('Buscando prendas en la foto…');
  const w = canvas.width, h = canvas.height;
  const salida = await seg(canvas.toDataURL('image/jpeg', 0.92));

  // Juntar zapato izquierdo y derecho en un solo «calzado»
  const mascaras = {};
  for (const s of salida) {
    const etiqueta = /shoe/i.test(s.label) ? 'Shoes' : s.label;
    if (!ETIQUETAS[etiqueta]) continue;
    const m = s.mask;
    let bin;
    if (m.width === w && m.height === h) {
      bin = new Uint8Array(w * h);
      for (let i = 0; i < bin.length; i++) bin[i] = m.data[i * m.channels] > 127 ? 1 : 0;
    } else {
      // Redimensionar (vecino más cercano) al tamaño de la foto
      bin = new Uint8Array(w * h);
      for (let y = 0; y < h; y++) {
        const sy = Math.min(m.height - 1, Math.floor((y * m.height) / h));
        for (let x = 0; x < w; x++) {
          const sx = Math.min(m.width - 1, Math.floor((x * m.width) / w));
          bin[y * w + x] = m.data[(sy * m.width + sx) * m.channels] > 127 ? 1 : 0;
        }
      }
    }
    if (mascaras[etiqueta]) { const a = mascaras[etiqueta]; for (let i = 0; i < a.length; i++) a[i] |= bin[i]; }
    else mascaras[etiqueta] = bin;
  }

  const datos = canvas.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, w, h).data;
  const prendas = [];
  for (const [etiqueta, mascara] of Object.entries(mascaras)) {
    let area = 0, sx = 0, sy = 0;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      if (mascara[y * w + x]) { area++; sx += x; sy += y; }
    }
    const [catBase, nombre, minimo] = ETIQUETAS[etiqueta];
    if (area < w * h * minimo) continue;
    const color = colorDeMascara(datos, w, h, mascara, area);
    let cat = catBase;
    if (cat === 'pantalon' && ['vaquero', 'azul', 'celeste', 'azul marino'].includes(color.nombre)) cat = 'vaqueros';
    if (cat === 'zapatos' && ['blanco', 'gris claro', 'crudo'].includes(color.nombre)) cat = 'zapatillas';
    // Centro para el número: el píxel de la máscara más cercano al centro de masas
    let cx = sx / area, cy = sy / area;
    if (!mascara[Math.round(cy) * w + Math.round(cx)]) {
      let mejor = Infinity;
      for (let y = 0; y < h; y += 4) for (let x = 0; x < w; x += 4) {
        if (!mascara[y * w + x]) continue;
        const d = (x - sx / area) ** 2 + (y - sy / area) ** 2;
        if (d < mejor) { mejor = d; cx = x; cy = y; }
      }
    }
    prendas.push({ categoria: cat, etiqueta: nombre, color, mascara, area, centro: { x: cx, y: cy } });
  }
  return prendas.sort((a, b) => a.centro.y - b.centro.y);
}
