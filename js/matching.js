// Parecido entre un look de referencia ("receta") y las prendas de mi armario.
//
// Un look es { id, nombre, estilo, temporada, huecos: [{ categoria, color, rol }] }
// y el resultado dice, para cada hueco, qué prenda mía se parece más (0–100).

import { categoria as infoCategoria } from './categories.js';
import { hexToLab, deltaE2000, nombreColor, infoColor } from './color.js';
import { ESTILOS_OUTFIT } from './outfits.js';
import { esLlamativo } from './pattern.js';

export const UMBRAL_OK = 55; // a partir de aquí la prenda se considera «razonablemente parecida»
const PESO_SIN_PRENDA = 0.15; // parte de sus puntos que cuenta un hueco sin prenda parecida

/* ---------- Categorías: familias intercambiables ---------- */

const clave = (a, b) => (a < b ? `${a}|${b}` : `${b}|${a}`);
const tabla = (obj) => Object.fromEntries(Object.entries(obj).map(([k, v]) => { const [a, b] = k.split('|'); return [clave(a, b), v]; }));

// Parecido base entre categorías de la misma familia (1 = la misma)
const PARES = tabla({
  'camiseta|camisa': 0.7, 'camiseta|jersey': 0.6, 'camisa|jersey': 0.65,
  'jersey|sudadera': 0.75, 'camiseta|sudadera': 0.7, 'camisa|sudadera': 0.45,
  'chaqueta|abrigo': 0.7,
  'pantalon|vaqueros': 0.75, 'pantalon|chandal': 0.45, 'vaqueros|chandal': 0.35,
  'falda|shorts': 0.4,
  'zapatos|botas': 0.75, 'zapatos|zapatillas': 0.5, 'botas|zapatillas': 0.45,
  'zapatos|sandalias': 0.5, 'zapatillas|sandalias': 0.4, 'botas|sandalias': 0.2,
});

// Ajustes según el estilo del look (p. ej. en deporte el chándal sustituye bien al pantalón)
const AJUSTES = {
  formal: tabla({ 'zapatos|sandalias': 0.3, 'pantalon|vaqueros': 0.45, 'zapatos|zapatillas': 0.25, 'pantalon|chandal': 0.1, 'vaqueros|chandal': 0.1, 'camiseta|camisa': 0.5, 'camisa|sudadera': 0.2 }),
  arreglado: tabla({ 'pantalon|chandal': 0.2, 'vaqueros|chandal': 0.2 }),
  informal: {},
  deportivo: tabla({ 'pantalon|chandal': 0.75, 'vaqueros|chandal': 0.55, 'zapatos|zapatillas': 0.3, 'botas|zapatillas': 0.3, 'camiseta|sudadera': 0.8, 'jersey|sudadera': 0.6 }),
};

export function parecidoCategoria(a, b, estilo) {
  if (a === b) return 1;
  const k = clave(a, b);
  const aj = AJUSTES[estilo] || {};
  return k in aj ? aj[k] : (PARES[k] || 0);
}

/* ---------- Color ---------- */

// Grupos de colores casi intercambiables
const GRUPOS_COLOR = [
  ['negro', 'gris oscuro', 'azul marino'],   // negro / gris marengo / azul marino
  ['beige', 'camel', 'crudo'],               // beige / camel / crema / arena
  ['blanco', 'crudo'],                       // blanco / blanco roto / crudo
];
const mismoGrupo = (a, b) => GRUPOS_COLOR.some((g) => g.includes(a) && g.includes(b));

const cacheColor = new Map();
function datosColor(hex) {
  if (!cacheColor.has(hex)) {
    const lab = hexToLab(hex);
    cacheColor.set(hex, { lab, nombre: nombreColor(lab), neutro: infoColor(hex).neutro });
  }
  return cacheColor.get(hex);
}

export function parecidoColor(hexA, hexB, rol) {
  const a = datosColor(hexA), b = datosColor(hexB);
  let s = Math.max(0, 1 - deltaE2000(a.lab, b.lab) / 35);
  if (mismoGrupo(a.nombre, b.nombre)) s = Math.max(s, 0.82);
  // Un neutro puede sustituir a otro neutro si la luminosidad es parecida (negro ≈ marengo, pero no blanco)
  if (rol === 'neutro' && a.neutro && b.neutro && Math.abs(a.lab[0] - b.lab[0]) < 30) s = Math.max(s, 0.6);
  return s;
}

/* ---------- Puntuación de un hueco ---------- */

const EXP_COLOR = { base: 1, acento: 1.3, neutro: 0.7 };

export function puntuarHueco(hueco, prenda, estilo) {
  if (!prenda.color || !prenda.categoria) return 0;
  const cat = parecidoCategoria(hueco.categoria, prenda.categoria, estilo);
  if (cat <= 0) return 0;
  const col = parecidoColor(hueco.color, prenda.color.hex, hueco.rol);
  let s = 100 * cat * col ** (EXP_COLOR[hueco.rol] || 1);
  const def = ESTILOS_OUTFIT[estilo];
  if (def && !def.acepta(prenda)) s *= 0.85; // prenda de otro estilo
  return Math.round(s);
}

/* ---------- Adaptar un look completo ---------- */

function pesoHueco(h) {
  const base = h.rol === 'base' ? 1.2 : h.rol === 'neutro' ? 0.9 : 1;
  const c = infoCategoria(h.categoria);
  return c && c.slot === 'complemento' ? base * 0.5 : base;
}

// elecciones: { indiceHueco: n } para mostrar la n-ésima alternativa de ese hueco
export function adaptarLook(look, prendas, elecciones = {}) {
  const candidatos = look.huecos.map((h) =>
    prendas.map((p) => ({ prenda: p, puntos: puntuarHueco(h, p, look.estilo) }))
      .filter((c) => c.puntos > 0)
      .sort((a, b) => b.puntos - a.puntos));

  // Primero los huecos con mejor candidato, para que cada prenda se use una sola vez
  const orden = look.huecos.map((_, i) => i)
    .sort((a, b) => (candidatos[b][0]?.puntos || 0) - (candidatos[a][0]?.puntos || 0));
  const usadas = new Set();
  let llamativoUsado = false; // como máximo una prenda con estampado llamativo en «tu versión»
  const huecos = new Array(look.huecos.length);
  for (const i of orden) {
    const libres = candidatos[i].filter((c) => !usadas.has(c.prenda.id) && !(llamativoUsado && esLlamativo(c.prenda.estampado)));
    const buenas = libres.filter((c) => c.puntos >= UMBRAL_OK);
    const n = buenas.length ? (elecciones[i] || 0) % buenas.length : 0;
    const elegida = buenas[n] || null;
    if (elegida) {
      usadas.add(elegida.prenda.id);
      if (esLlamativo(elegida.prenda.estampado)) llamativoUsado = true;
    }
    huecos[i] = {
      hueco: look.huecos[i],
      prenda: elegida ? elegida.prenda : null,
      puntos: elegida ? elegida.puntos : (libres[0]?.puntos || 0), // lo más parecido aunque no llegue
      opciones: buenas.length,
      eleccion: n,
      ok: !!elegida,
    };
  }
  // Un hueco sin prenda razonablemente parecida cuenta como mucho un 15 % de los puntos de su
  // candidato más cercano: así, que falte una prenda principal baja claramente el parecido.
  // (En «Prenda a prenda» se sigue enseñando el % de ese candidato como información.)
  let suma = 0, pesos = 0;
  huecos.forEach((r) => {
    const w = pesoHueco(r.hueco);
    suma += (r.ok ? r.puntos : r.puntos * PESO_SIN_PRENDA) * w;
    pesos += w;
  });
  return {
    huecos,
    parecido: pesos ? Math.round(suma / pesos) : 0,
    faltan: huecos.filter((r) => !r.ok).map((r) => fraseFalta(r.hueco)),
  };
}

/* ---------- Frases ---------- */

// Colores que no cambian en femenino ni en plural (rosa, naranja, beige…)
const INVARIABLES = new Set(['beige', 'camel', 'caqui', 'naranja', 'rosa', 'fucsia', 'lila', 'mostaza', 'turquesa', 'coral', 'granate', 'oliva']);

export function concordarColor(nombre, g = 'm', n = 's') {
  if (nombre.includes(' ') || INVARIABLES.has(nombre)) return nombre; // «azul marino», «verde botella»…
  let w = nombre;
  if (g === 'f' && w.endsWith('o')) w = w.slice(0, -1) + 'a';
  if (n === 'p') {
    if (/[aeo]$/.test(w)) w += 's';
    else if (w.endsWith('ón')) w = w.slice(0, -2) + 'ones';
    else w += 'es'; // azul → azules, gris → grises
  }
  return w;
}

export function describirHueco(hueco) {
  const c = infoCategoria(hueco.categoria);
  let color = datosColor(hueco.color).nombre;
  if (!c) return color;
  if (color === 'vaquero' && hueco.categoria === 'vaqueros') color = 'azul'; // no «vaqueros vaqueros»
  return `${c.sust} ${concordarColor(color, c.g, c.n)}`;
}

export function fraseFalta(hueco) {
  const c = infoCategoria(hueco.categoria);
  const art = !c ? 'algo' : c.n === 'p' ? (c.g === 'f' ? 'unas' : 'unos') : (c.g === 'f' ? 'una' : 'un');
  return `algo parecido a ${art} ${describirHueco(hueco)}`;
}

// Nombre de color en español para un HEX (lo usa la interfaz)
export const nombreDeHex = (hex) => datosColor(hex).nombre;
