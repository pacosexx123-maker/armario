// Paleta de muestras para elegir el color de una prenda a mano.
// Cada familia tiene sus tonos ordenados de claro a oscuro.

import { h, mostrarColorGrande } from './ui.js';
import { abrirDialogo } from './nav.js';
import { describirColor, hexToLab } from './color.js';

export const PALETA_FAMILIAS = [
  { nombre: 'Blanco / crudo',    tonos: ['#ffffff', '#f8f6f0', '#f2ede1', '#ebe3d2', '#e0d5bd', '#d3c5a8'] },
  { nombre: 'Gris',              tonos: ['#e3e4e6', '#c8cacc', '#a8abaf', '#8a8d91', '#63666b', '#43464b'] },
  { nombre: 'Negro',             tonos: ['#3b3b3d', '#2b2b2d', '#1f1f21', '#161616', '#0a0a0a'] },
  { nombre: 'Beige / camel',     tonos: ['#efe3cf', '#e2cfae', '#d4bf9f', '#c9a77c', '#b88658', '#a06e42'] },
  { nombre: 'Marrón',            tonos: ['#a47551', '#8b5e3c', '#74492c', '#5e3f2a', '#4a2f1f', '#3b2a1e'] },
  { nombre: 'Azul',              tonos: ['#8fa9dc', '#5f86d0', '#2c5db4', '#234a91', '#1d3a72', '#1d2741'] },
  { nombre: 'Celeste',           tonos: ['#e0eef9', '#c4dff4', '#a9cfee', '#94c3e8', '#74acd9', '#5b93c4'] },
  { nombre: 'Verde',             tonos: ['#b9e3c6', '#86cc9c', '#4fae6d', '#2e8b4e', '#236b3c', '#1e4631'] },
  { nombre: 'Oliva / caqui',     tonos: ['#c9c59a', '#b0aa76', '#8c8660', '#6b6b3a', '#556b2f', '#3f4a24'] },
  { nombre: 'Rojo / granate',    tonos: ['#f08a80', '#e04b45', '#c3282b', '#a11d24', '#861b27', '#6c1d2a'] },
  { nombre: 'Rosa',              tonos: ['#f9dde3', '#f2c0cb', '#e2bcbb', '#f0a2b7', '#e0779a', '#d02c84'] },
  { nombre: 'Morado',            tonos: ['#ddd0ee', '#b6a0d8', '#9479c4', '#7552a8', '#5c3889', '#3f2463'] },
  { nombre: 'Amarillo / mostaza', tonos: ['#fbf0b0', '#f6e27a', '#f2d23a', '#e3b72a', '#c8991c', '#a67c12'] },
  { nombre: 'Naranja',           tonos: ['#fbd2b0', '#f6a868', '#ec7622', '#d45f15', '#b5562f', '#8c3f1c'] },
];

/* ---------- Tonos ampliados (32 por familia) ---------- */

// LCh (L, croma, tono en grados) → HEX, bajando el croma hasta que el color se pueda mostrar en pantalla
function lchAHex(L, C, hGrados) {
  const conv = (c) => {
    const hr = (hGrados * Math.PI) / 180;
    const a = c * Math.cos(hr), b = c * Math.sin(hr);
    const fy = (L + 16) / 116, fx = fy + a / 500, fz = fy - b / 200;
    const inv = (t) => (t ** 3 > 0.008856 ? t ** 3 : (t - 16 / 116) / 7.787);
    const x = inv(fx) * 0.95047, y = inv(fy), z = inv(fz) * 1.08883;
    return [
      3.2404542 * x - 1.5371385 * y - 0.4985314 * z,
      -0.9692660 * x + 1.8760108 * y + 0.0415560 * z,
      0.0556434 * x - 0.2040259 * y + 1.0572252 * z,
    ];
  };
  let c = C, rgb = conv(c);
  while (c > 0 && rgb.some((v) => v < -0.001 || v > 1.001)) { c = Math.max(0, c - 1.5); rgb = conv(c); }
  const s = (v) => { v = Math.min(1, Math.max(0, v)); v = v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055; return Math.round(v * 255).toString(16).padStart(2, '0'); };
  return '#' + rgb.map(s).join('');
}

// Familias neutras: variantes a mano [tono, croma] (frío, neutro, cálido, greige…)
const VARIANTES_NEUTRAS = {
  'Blanco / crudo': { L: [99, 80], columnas: [[0, 0], [90, 4], [85, 9], [78, 15]] },
  'Gris': { L: [93, 26], columnas: [[250, 6], [0, 0], [75, 4], [80, 9]] },
  'Negro': { L: [34, 4], columnas: [[0, 0], [265, 6], [65, 5], [300, 5]] },
};

const cacheAmpliada = new Map();
// 32 tonos de una familia: 8 luminosidades (claro → oscuro) × 4 variantes
export function tonosAmpliados(familia) {
  if (cacheAmpliada.has(familia.nombre)) return cacheAmpliada.get(familia.nombre);
  let cfg = VARIANTES_NEUTRAS[familia.nombre];
  if (!cfg) {
    // A partir de los tonos de la familia: tono medio (ponderado por croma), croma máximo y rango de luz
    const lch = familia.tonos.map((t) => { const [L, a, b] = hexToLab(t); return { L, C: Math.hypot(a, b), h: Math.atan2(b, a) }; });
    const sx = lch.reduce((s, c) => s + Math.cos(c.h) * c.C, 0), sy = lch.reduce((s, c) => s + Math.sin(c.h) * c.C, 0);
    const hMedio = ((Math.atan2(sy, sx) * 180) / Math.PI + 360) % 360;
    const Cmax = Math.max(...lch.map((c) => c.C));
    const Ls = lch.map((c) => c.L);
    cfg = {
      L: [Math.min(96, Math.max(...Ls) + 6), Math.max(10, Math.min(...Ls) - 8)],
      columnas: [[hMedio - 14, Cmax * 0.85], [hMedio, Cmax * 0.45], [hMedio, Cmax * 1.1], [hMedio + 14, Cmax * 0.85]],
    };
  }
  const filas = cfg.columnas.map(([hh, C]) => Array.from({ length: 8 }, (_, i) => {
    const L = cfg.L[0] + ((cfg.L[1] - cfg.L[0]) * i) / 7;
    return lchAHex(L, C, (hh + 360) % 360);
  }));
  cacheAmpliada.set(familia.nombre, filas);
  return filas;
}

// Ventana con los 32 tonos de una familia. Es un <dialog> modal para quedar por encima del editor.
function abrirTonosAmpliados(familia, actual, onElegir) {
  const filas = tonosAmpliados(familia);
  const dlg = h('dialog', { class: 'sheet tonos-ampliados', 'aria-label': `${familia.nombre}: más tonos` });
  const cerrar = h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Cerrar',
    html: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>', onclick: () => dlg.close() });
  dlg.append(
    h('div', { class: 'sheet-head' }, h('h2', {}, familia.nombre), cerrar),
    h('p', { class: 'muted small' }, 'De claro a oscuro. Toca un tono para verlo en grande y compararlo con la prenda.'),
    h('div', { class: 'tonos-rejilla' }, ...filas.flat().map((t) => h('button', {
      type: 'button', class: 'pal-tono', style: { background: t }, 'data-hex': t,
      'aria-label': `${describirColor(t).nombre} ${t.toUpperCase()}`, 'aria-pressed': String(t === (actual || '').toLowerCase()),
      // Se ve a pantalla completa; desde ahí se elige o se vuelve a los 32 tonos
      onclick: () => mostrarColorGrande(t, describirColor(t).nombre, { onElegir: (hex) => { onElegir(hex); dlg.close(); } }),
    }))));
  dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });
  dlg.addEventListener('close', () => dlg.remove());
  document.body.append(dlg);
  abrirDialogo(dlg); // «atrás» la cierra
}

// Componente reutilizable: rejilla de muestras por familias.
// onElegir(hex) al tocar una muestra; marcar(hex) resalta la muestra elegida.
// Tocar el nombre de una familia abre 32 tonos más de esa familia.
export function crearPaleta({ onElegir }) {
  let actual = '';
  const el = h('div', { class: 'paleta' },
    ...PALETA_FAMILIAS.map((f) => h('div', { class: 'pal-fila' },
      h('button', {
        type: 'button', class: 'pal-nombre', 'aria-label': `${f.nombre}: ver más tonos`,
        onclick: () => abrirTonosAmpliados(f, actual, onElegir),
      }, f.nombre, h('span', { class: 'pal-mas', 'aria-hidden': 'true' }, '+')),
      h('div', { class: 'pal-tonos' }, ...f.tonos.map((t) => h('button', {
        type: 'button', class: 'pal-tono', style: { background: t }, 'data-hex': t,
        'aria-label': `${f.nombre}: ${describirColor(t).nombre} ${t.toUpperCase()}`, 'aria-pressed': 'false',
        onclick: () => onElegir(t),
      }))))));
  const marcar = (hex) => {
    actual = (hex || '').toLowerCase();
    el.querySelectorAll('.pal-tono').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.hex === actual)));
  };
  return { el, marcar };
}
