// Imágenes realistas tipo tienda (PRUEBA).
//
// En assets/catalogo/<id>.png hay una foto de producto por básico, en gris claro y con fondo
// transparente, y en assets/catalogo/mascaras/<id>.png la máscara de sus botones o cremallera
// (generada una sola vez con tools/mascaras.py). Aquí se recolorean en el navegador con canvas:
//   - la luminosidad de la foto se usa como sombreado sobre el color de base (se mantienen
//     arrugas y textura), con el contraste ajustado para colores claros y oscuros;
//   - los botones y la cremallera se tiñen aparte con su color, conservando su brillo;
//   - el estampado (rayas, cuadros, topos…) se dibuja encima, recortado por la silueta y fundido
//     con el sombreado para que siga los pliegues; su tamaño se escala al ancho de la prenda;
//   - las suelas blancas del calzado no se tiñen.
// El resultado se guarda en caché (memoria y Cache Storage) para que el armario cargue rápido.

import { hexToLab, labToRgb, rgbToHex, rgbToLab, nombreColor, kmeans } from './color.js';
import { normalizarEstampado, colorEstampado } from './pattern.js';
import { leerPref } from './ui.js';

/* ---------- Qué básicos usan imagen realista ---------- */

// Todas las fotos de producto que hay en assets/catalogo/
export const DISPONIBLES = [
  'abrigo-largo', 'americana', 'americana-m', 'bailarinas', 'botas', 'botines', 'camisa-oxford', 'camisa-oxford-m',
  'camisa-vestir', 'camisa-vestir-m', 'camiseta-basica', 'camiseta-ml', 'cardigan', 'chandal', 'chaqueta-vaquera',
  'chino', 'chino-m', 'falda', 'jersey-alto', 'jersey-half-zip', 'jersey-pico', 'jersey-redondo', 'mocasines',
  'pantalon-traje', 'pantalon-traje-m', 'polo', 'salones', 'sandalias', 'shorts', 'sneakers', 'sudadera',
  'sudadera-capucha', 'vaqueros-pitillo', 'vaqueros-rectos', 'vestido', 'zapatos-vestir',
];

// PRUEBA: básicos que ya usan la imagen realista. Para activarla en todos, cambia esta lista por
// `DISPONIBLES` (o añade ids). El resto sigue con su ilustración SVG.
export const REALISTAS_ACTIVOS = DISPONIBLES; // activadas para todos los básicos con foto

// Prendas con foto: si su tipo confirmado es uno de estos, se muestra con la imagen realista
const REALISTA_POR_CATEGORIA = {
  camisa: { hombre: 'camisa-oxford', mujer: 'camisa-oxford-m' },
  pantalon: { hombre: 'chino', mujer: 'chino-m' },
  jersey: { hombre: 'jersey-redondo', mujer: 'jersey-redondo' },
  camiseta: { hombre: 'camiseta-basica', mujer: 'camiseta-basica' },
  sudadera: { hombre: 'sudadera', mujer: 'sudadera' },
  chaqueta: { hombre: 'americana', mujer: 'americana-m' },
  abrigo: { hombre: 'abrigo-largo', mujer: 'abrigo-largo' },
  vaqueros: { hombre: 'vaqueros-rectos', mujer: 'vaqueros-rectos' },
  chandal: { hombre: 'chandal', mujer: 'chandal' },
  falda: { hombre: 'falda', mujer: 'falda' },
  shorts: { hombre: 'shorts', mujer: 'shorts' },
  vestido: { hombre: 'vestido', mujer: 'vestido' },
  zapatillas: { hombre: 'sneakers', mujer: 'sneakers' },
  zapatos: { hombre: 'zapatos-vestir', mujer: 'mocasines' },
  botas: { hombre: 'botas', mujer: 'botas' },
  sandalias: { hombre: 'sandalias', mujer: 'sandalias' },
};

const CALZADO = new Set(['sneakers', 'mocasines', 'zapatos-vestir', 'botas', 'botines', 'bailarinas', 'salones', 'sandalias']);

export const realistasActivadas = () => leerPref('realistas', 'true') === 'true';
export const realistaDisponible = (id) => !!id && REALISTAS_ACTIVOS.includes(id) && DISPONIBLES.includes(id);

// id de la imagen realista que le toca a un básico (o null)
export const realistaDeBasico = (idBasico) => (realistasActivadas() && realistaDisponible(idBasico) ? idBasico : null);

// id de la imagen realista para una prenda guardada o en edición (básico o con foto)
export function realistaDePrenda(p) {
  if (!realistasActivadas() || !p) return null;
  if (p.basico && p.basico.id) return realistaDisponible(p.basico.id) ? p.basico.id : null;
  const porCat = REALISTA_POR_CATEGORIA[p.categoria];
  if (!p.foto || !porCat) return null;
  const id = porCat[leerPref('genero', '') === 'mujer' ? 'mujer' : 'hombre'];
  return realistaDisponible(id) ? id : null;
}

// id de la imagen realista para un hueco de un look de Inspiración (o null).
// Usa su campo «basico» si lo tiene; si no, lo deduce por categoría. `genero` es el del look:
// en los unisex (y en los míos) se usa la preferencia de Ajustes, con la versión de mujer (-m) si existe.
export function realistaDeHueco(hueco, genero) {
  if (!realistasActivadas() || !hueco) return null;
  const g = genero === 'mujer' || genero === 'hombre' ? genero : (leerPref('genero', '') === 'mujer' ? 'mujer' : 'hombre');
  let id = DISPONIBLES.includes(hueco.basico) ? hueco.basico : null;
  if (id && g === 'mujer' && !id.endsWith('-m') && DISPONIBLES.includes(id + '-m')) id += '-m';
  if (!id) { const porCat = REALISTA_POR_CATEGORIA[hueco.categoria]; id = porCat ? porCat[g] : null; }
  return realistaDisponible(id) ? id : null;
}

// Para las prendas con foto: el id de catálogo de su tipo (sin mirar si está activado)
export function catalogoDeCategoria(categoria) {
  const porCat = REALISTA_POR_CATEGORIA[categoria];
  return porCat ? porCat[leerPref('genero', '') === 'mujer' ? 'mujer' : 'hombre'] : null;
}

/* ---------- Botones y cremalleras (índice de máscaras) ---------- */

let indice = {};
export async function cargarIndice() {
  try { indice = await (await fetch('assets/catalogo/mascaras/indice.json')).json(); } catch { indice = {}; }
  return indice;
}
export const tieneCierre = (id) => !!(id && indice[id] && (indice[id].botones || indice[id].cremallera));
export const tieneCremallera = (id) => !!(id && indice[id] && indice[id].cremallera);

// Color de botones por defecto: un tono parecido al de base (algo más oscuro, o más claro si es muy oscuro)
export function botonesPorDefecto(baseHex) {
  const [L, a, b] = hexToLab(baseHex);
  const L2 = L > 30 ? L - 14 : L + 16;
  return rgbToHex(labToRgb([L2, a * 0.9, b * 0.9]));
}

/* ---------- Carga y análisis de las fotos de producto ---------- */

const MAX_LADO = 560;
const fuentes = new Map();

function cargarImagen(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('No se pudo cargar ' + src));
    img.src = src;
  });
}

// Luminosidad Lab de un gris sRGB 0–255
const labDeGris = (v) => rgbToLab(v, v, v)[0];
const LAB_GRIS = Array.from({ length: 256 }, (_, v) => labDeGris(v));

function percentil(hist, total, p) {
  let acc = 0;
  for (let v = 0; v < 256; v++) { acc += hist[v]; if (acc >= total * p) return v; }
  return 255;
}

function cargarFuente(id) {
  if (!fuentes.has(id)) {
    fuentes.set(id, (async () => {
      const [img, masc] = await Promise.all([
        cargarImagen(`assets/catalogo/${id}.png`),
        cargarImagen(`assets/catalogo/mascaras/${id}.png`).catch(() => null),
      ]);
      const esc = Math.min(1, MAX_LADO / Math.max(img.naturalWidth, img.naturalHeight));
      const w = Math.round(img.naturalWidth * esc), h = Math.round(img.naturalHeight * esc);
      const c = document.createElement('canvas'); c.width = w; c.height = h;
      const ctx = c.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(img, 0, 0, w, h);
      const d = ctx.getImageData(0, 0, w, h).data;
      const n = w * h;
      const gris = new Uint8Array(n), alfa = new Uint8Array(n), mascara = new Uint8Array(n);
      if (masc) {
        ctx.clearRect(0, 0, w, h); ctx.drawImage(masc, 0, 0, w, h);
        const m = ctx.getImageData(0, 0, w, h).data;
        for (let i = 0; i < n; i++) mascara[i] = m[i * 4] > 110 ? 1 : 0;
      }
      let x0 = w, y0 = h, x1 = 0, y1 = 0;
      const histTela = new Uint32Array(256), histBoton = new Uint32Array(256);
      let nTela = 0, nBoton = 0;
      for (let i = 0; i < n; i++) {
        const k = i * 4;
        gris[i] = Math.round(0.299 * d[k] + 0.587 * d[k + 1] + 0.114 * d[k + 2]);
        alfa[i] = d[k + 3];
        if (alfa[i] > 128) {
          const x = i % w, y = (i / w) | 0;
          if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
          if (mascara[i]) { histBoton[gris[i]]++; nBoton++; } else { histTela[gris[i]]++; nTela++; }
        }
      }
      // Suelas del calzado: franja de abajo claramente más clara que el resto → no se tiñe.
      // Se busca la fila (por debajo del 65 % de la altura) desde la que la luminosidad mediana
      // de cada fila salta y se mantiene por encima de la del empeine.
      let suela = null;
      if (CALZADO.has(id)) {
        // Percentiles 10 y 50 de la luminosidad de una fila
        const fila = (y) => {
          const v = [];
          for (let x = x0; x <= x1; x++) { const i = y * w + x; if (alfa[i] > 128) v.push(gris[i]); }
          if (v.length < 3) return { p10: 0, p50: 0 };
          v.sort((a, b) => a - b);
          return { p10: v[Math.floor(v.length * 0.1)], p50: v[v.length >> 1] };
        };
        const alto = y1 - y0;
        const medias = [];
        for (let y = Math.round(y0 + alto * 0.35); y <= Math.round(y0 + alto * 0.65); y++) medias.push(fila(y).p50);
        medias.sort((a, b) => a - b);
        const empeine = medias[medias.length >> 1] || 0;
        // Una suela es una franja uniformemente clara (hasta sus píxeles más oscuros lo son)
        const esSuela = (y) => { const f = fila(y); return f.p50 >= empeine + 14 && f.p10 >= empeine - 2; };
        let inicio = -1;
        for (let y = Math.round(y0 + alto * 0.65); y <= y1 - 3; y++) {
          if ([0, 1, 2, 3].every((k) => esSuela(y + k))) { inicio = y; break; }
        }
        // …y fina (los tacones o el interior claro de un zapato no son suela)
        if (inicio >= 0 && y1 - inicio > alto * 0.3) inicio = -1;
        if (inicio >= 0) {
          suela = new Uint8Array(n);
          for (let y = inicio; y <= y1; y++) for (let x = x0; x <= x1; x++) {
            const i = y * w + x;
            if (alfa[i] > 128 && gris[i] >= empeine - 12) suela[i] = 1;
          }
        }
      }
      return {
        w, h, gris, alfa, mascara, suela,
        caja: { x0, y0, x1, y1, ancho: x1 - x0 + 1, alto: y1 - y0 + 1 },
        tela: { ref: percentil(histTela, nTela, 0.5), bajo: percentil(histTela, nTela, 0.05), alto: percentil(histTela, nTela, 0.95) },
        boton: nBoton ? { ref: percentil(histBoton, nBoton, 0.35), bajo: percentil(histBoton, nBoton, 0.05), alto: percentil(histBoton, nBoton, 0.95) } : null,
      };
    })().catch((e) => { fuentes.delete(id); throw e; }));
  }
  return fuentes.get(id);
}

/* ---------- Sombreado: tabla gris de la foto → color ---------- */

// Para cada gris (0–255) de la foto, el color final. La desviación respecto al gris medio de la
// prenda se normaliza (−1 sombras … +1 brillos) y se aplica en Lab sobre el color:
//  - colores claros: sombras amplias, brillos moderados;
//  - colores oscuros: sombras comprimidas (si no, se empastan en negro) y brillos realzados
//    (si no, la prenda queda plana); así el azul marino o el negro siguen mostrando pliegues.
function tablaSombreado(hex, stats) {
  const [Lb, ab, bb] = hexToLab(hex);
  const Lref = LAB_GRIS[stats.ref];
  const abajo = Math.max(2, Lref - LAB_GRIS[stats.bajo]);
  const arriba = Math.max(2, LAB_GRIS[stats.alto] - Lref);
  const sombra = Math.min(Lb * 0.75, 26);
  const brillo = 9 + 17 * (1 - Lb / 100);
  const tabla = new Uint8ClampedArray(256 * 3);
  for (let v = 0; v < 256; v++) {
    const d = LAB_GRIS[v] - Lref;
    let dn = d < 0 ? d / abajo : d / arriba;
    dn = Math.sign(dn) * (Math.abs(dn) <= 1 ? Math.abs(dn) : 1 + Math.log(Math.abs(dn)) * 0.5); // suaviza extremos
    let L = Lb + (dn < 0 ? dn * sombra : dn * brillo);
    L = Math.max(0, Math.min(100, L));
    const k = Math.max(0.6, Math.min(1, 1 - Math.abs(L - Lb) / 70)); // algo menos de croma en sombras y brillos
    const [r, g, b] = labToRgb([L, ab * k, bb * k]);
    tabla[v * 3] = r; tabla[v * 3 + 1] = g; tabla[v * 3 + 2] = b;
  }
  return tabla;
}

/* ---------- Estampado: capa de cobertura (0–255) ---------- */

function capaEstampado(f, est) {
  if (est.tipo === 'liso') return null;
  const c = document.createElement('canvas'); c.width = f.w; c.height = f.h;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  const A = f.caja.ancho; // el tamaño se escala al ancho de la prenda
  ctx.fillStyle = '#fff';
  if (est.tipo === 'rayas') {
    const P = A * { fino: 0.03, medio: 0.06, grueso: 0.11 }[est.tamano];
    const g = P * (est.tamano === 'fino' ? 0.4 : 0.45);
    if (est.orientacion === 'vertical') for (let x = f.caja.x0 - P; x < f.w; x += P) ctx.fillRect(x, 0, g, f.h);
    else for (let y = f.caja.y0 - P; y < f.h; y += P) ctx.fillRect(0, y, f.w, g);
  } else if (est.tipo === 'cuadros') {
    const P = A * { pequeno: 0.05, mediano: 0.09, grande: 0.15 }[est.tamano];
    ctx.globalAlpha = 0.55;
    for (let x = f.caja.x0 - P; x < f.w; x += P) ctx.fillRect(x, 0, P / 2, f.h);
    for (let y = f.caja.y0 - P; y < f.h; y += P) ctx.fillRect(0, y, f.w, P / 2);
  } else if (est.tipo === 'topos') {
    const P = A * (est.tamano === 'grandes' ? 0.12 : 0.055);
    const r = P * (est.tamano === 'grandes' ? 0.22 : 0.18);
    let fila = 0;
    for (let y = f.caja.y0 - P; y < f.h + P; y += P / 2, fila++) {
      for (let x = f.caja.x0 - P + (fila % 2 ? P / 2 : 0); x < f.w + P; x += P) { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); }
    }
  } else {
    // «Otro estampado»: manchas irregulares repetidas
    const P = A * 0.14;
    let s = 7; const azar = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
    const motivo = Array.from({ length: 5 }, () => [azar() * P, azar() * P, P * (0.06 + azar() * 0.12)]);
    for (let y = f.caja.y0 - P; y < f.h; y += P) for (let x = f.caja.x0 - P; x < f.w; x += P) {
      for (const [mx, my, mr] of motivo) { ctx.beginPath(); ctx.ellipse(x + mx, y + my, mr, mr * 0.75, mx, 0, Math.PI * 2); ctx.fill(); }
    }
  }
  const d = ctx.getImageData(0, 0, f.w, f.h).data;
  const cob = new Uint8Array(f.w * f.h);
  for (let i = 0; i < cob.length; i++) cob[i] = d[i * 4 + 3];
  return cob;
}

/* ---------- Recolorear ---------- */

async function recolorear(id, { base, estampado, botones }) {
  const f = await cargarFuente(id);
  const est = normalizarEstampado(estampado);
  const tBase = tablaSombreado(base, f.tela);
  const tEst = est.tipo !== 'liso' ? tablaSombreado(colorEstampado(base, est), f.tela) : null;
  const cob = capaEstampado(f, est);
  const colorBoton = botones || botonesPorDefecto(base);
  const tBoton = f.boton ? tablaSombreado(colorBoton, f.boton) : null;
  const refTela = f.tela.ref, refBoton = f.boton ? f.boton.ref : 0;

  const c = document.createElement('canvas'); c.width = f.w; c.height = f.h;
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(f.w, f.h);
  const o = img.data;
  const { gris, alfa, mascara, suela } = f;
  for (let i = 0, n = f.w * f.h; i < n; i++) {
    const a = alfa[i];
    if (!a) continue;
    const g = gris[i], k = i * 4, t = g * 3;
    if (suela && suela[i]) {
      o[k] = o[k + 1] = o[k + 2] = Math.min(255, g + 18); // suela: blanca (su gris original, algo aclarado)
    } else {
      let r = tBase[t], gg = tBase[t + 1], b = tBase[t + 2];
      if (tEst && cob[i]) {
        const m = cob[i] / 255;
        r += (tEst[t] - r) * m; gg += (tEst[t + 1] - gg) * m; b += (tEst[t + 2] - b) * m;
      }
      if (tBoton && mascara[i]) {
        // Botón o cremallera: su propio color con su brillo; el borde suavizado se funde con la tela
        const m = Math.max(0, Math.min(1, (refTela - g) / Math.max(1, refTela - refBoton)));
        r += (tBoton[t] - r) * m; gg += (tBoton[t + 1] - gg) * m; b += (tBoton[t + 2] - b) * m;
      }
      o[k] = r; o[k + 1] = gg; o[k + 2] = b;
    }
    o[k + 3] = a;
  }
  ctx.putImageData(img, 0, 0);
  return new Promise((resolve, reject) => c.toBlob((bl) => (bl ? resolve(bl) : reject(new Error('toBlob'))), 'image/png'));
}

/* ---------- Caché y cola ---------- */

// Cambia el número si cambian las fotos del catálogo o sus máscaras: las imágenes
// ya recoloreadas con las fotos anteriores se borran.
const CACHE = 'armario-realistas-v2';
try {
  caches.keys().then((ks) => ks.filter((k) => k.startsWith('armario-realistas-') && k !== CACHE)
    .forEach((k) => caches.delete(k))).catch(() => {});
} catch { /* sin Cache Storage */ }
const enMemoria = new Map();   // clave → URL (objeto)
const enCurso = new Map();     // clave → Promise<URL>
let cola = Promise.resolve();  // de una en una, para no bloquear la interfaz

const claveDe = (id, { base, estampado, botones }) => {
  const e = normalizarEstampado(estampado);
  return [id, (base || '').toLowerCase(), e.tipo, e.color2 || '', e.orientacion || '', e.tamano || '', (botones || '').toLowerCase()].join('|');
};

export const realistaEnCache = (id, opciones) => enMemoria.get(claveDe(id, opciones)) || null;

export function renderRealista(id, opciones) {
  const clave = claveDe(id, opciones);
  if (enMemoria.has(clave)) return Promise.resolve(enMemoria.get(clave));
  if (enCurso.has(clave)) return enCurso.get(clave);
  const peticion = `${location.origin}/__realista/${encodeURIComponent(clave)}`;
  const trabajo = cola.then(async () => {
    let blob = null;
    try { const res = await (await caches.open(CACHE)).match(peticion); if (res) blob = await res.blob(); } catch { /* sin Cache Storage */ }
    if (!blob) {
      blob = await recolorear(id, opciones);
      try { await (await caches.open(CACHE)).put(peticion, new Response(blob, { headers: { 'Content-Type': 'image/png' } })); } catch { /* sin espacio */ }
    }
    const url = URL.createObjectURL(blob);
    enMemoria.set(clave, url);
    enCurso.delete(clave);
    return url;
  });
  cola = trabajo.catch(() => {});
  trabajo.catch(() => enCurso.delete(clave));
  enCurso.set(clave, trabajo);
  return trabajo;
}

/* ---------- Botones en fotos de prendas ---------- */

// Busca botones en la foto de una camisa: manchas pequeñas y redondeadas de color distinto al de
// base dentro de la prenda, sobre todo en la línea central. Devuelve { hex, nombre, cuantos } o null
// si no los encuentra con seguridad (entonces se pide tocar un botón en la foto).
export function detectarBotonesEnFoto(canvas, analisis) {
  if (!analisis || !analisis.caja) return null;
  const cj = analisis.caja;
  const W = canvas.width, H = canvas.height;
  const cx = ((cj.x0 + cj.x1) / 2) * W;
  const anchoPrenda = (cj.x1 - cj.x0) * W;
  // Franja central (±12 % del ancho de la prenda) a lo alto de la prenda
  const sx = cx - anchoPrenda * 0.12, sw = anchoPrenda * 0.24;
  const sy = cj.y0 * H, sh = (cj.y1 - cj.y0) * H;
  if (sw < 8 || sh < 8) return null;
  const esc = Math.min(1, 900 / sh);
  const w = Math.max(8, Math.round(sw * esc)), h = Math.max(8, Math.round(sh * esc));
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(canvas, sx, sy, sw, sh, 0, 0, w, h);
  const d = ctx.getImageData(0, 0, w, h).data;
  const base = hexToLab(analisis.hex);
  const labs = new Array(w * h);
  const distinto = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) {
    const lab = rgbToLab(d[i * 4], d[i * 4 + 1], d[i * 4 + 2]);
    labs[i] = lab;
    const dE = Math.hypot(lab[0] - base[0], lab[1] - base[1], lab[2] - base[2]);
    distinto[i] = dE > 20 ? 1 : 0;
  }
  // Manchas conexas
  const visto = new Uint8Array(w * h);
  const anchoRef = anchoPrenda * esc;
  const minLado = anchoRef * 0.012, maxLado = anchoRef * 0.07;
  const botones = [];
  for (let i = 0; i < w * h; i++) {
    if (!distinto[i] || visto[i]) continue;
    const pila = [i]; visto[i] = 1; const pts = [];
    while (pila.length) {
      const j = pila.pop(); pts.push(j);
      const x = j % w, y = (j / w) | 0;
      for (const [a, b] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]) {
        if (a < 0 || b < 0 || a >= w || b >= h) continue;
        const q = b * w + a;
        if (distinto[q] && !visto[q]) { visto[q] = 1; pila.push(q); }
      }
      if (pts.length > 4000) break;
    }
    const xs = pts.map((j) => j % w), ys = pts.map((j) => (j / w) | 0);
    const bw = Math.max(...xs) - Math.min(...xs) + 1, bh = Math.max(...ys) - Math.min(...ys) + 1;
    const relleno = pts.length / (bw * bh);
    if (bw < minLado || bh < minLado || bw > maxLado || bh > maxLado) continue;
    if (bw / bh < 0.6 || bw / bh > 1.7 || relleno < 0.5) continue; // redondeada y compacta
    botones.push({ x: xs.reduce((s, v) => s + v, 0) / xs.length, y: ys.reduce((s, v) => s + v, 0) / ys.length, pts });
  }
  if (botones.length < 3) return null;
  // Alineados en vertical (línea central) y repartidos a lo alto
  const mediaX = botones.reduce((s, b) => s + b.x, 0) / botones.length;
  const alineados = botones.filter((b) => Math.abs(b.x - mediaX) < anchoRef * 0.04);
  if (alineados.length < 3) return null;
  const ysB = alineados.map((b) => b.y);
  if (Math.max(...ysB) - Math.min(...ysB) < h * 0.25) return null;
  // Color: grupo principal de los píxeles de los botones
  const pts = alineados.flatMap((b) => b.pts.map((j) => labs[j]));
  const lab = kmeans(pts, null, 2)[0].center;
  const hex = rgbToHex(labToRgb(lab));
  return { hex, nombre: nombreColor(lab), cuantos: alineados.length };
}
