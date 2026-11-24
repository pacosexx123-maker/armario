// Paleta de muestras para elegir el color de una prenda a mano.
// Cada familia tiene sus tonos ordenados de claro a oscuro.

import { h } from './ui.js';
import { describirColor } from './color.js';

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

// Componente reutilizable: rejilla de muestras por familias.
// onElegir(hex) al tocar una muestra; marcar(hex) resalta la muestra elegida.
export function crearPaleta({ onElegir }) {
  const el = h('div', { class: 'paleta' },
    ...PALETA_FAMILIAS.map((f) => h('div', { class: 'pal-fila' },
      h('span', { class: 'pal-nombre' }, f.nombre),
      h('div', { class: 'pal-tonos' }, ...f.tonos.map((t) => h('button', {
        type: 'button', class: 'pal-tono', style: { background: t }, 'data-hex': t,
        'aria-label': `${f.nombre}: ${describirColor(t).nombre} ${t.toUpperCase()}`, 'aria-pressed': 'false',
        onclick: () => onElegir(t),
      }))))));
  const marcar = (hex) => {
    const actual = (hex || '').toLowerCase();
    el.querySelectorAll('.pal-tono').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.hex === actual)));
  };
  return { el, marcar };
}
