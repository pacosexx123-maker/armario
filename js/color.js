// Color: conversión sRGB ⇄ Lab, extracción del color dominante con k-means,
// nombres de color en español y utilidades de armonía.

/* ---------- Conversión de espacios de color ---------- */

const toLin = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
const fromLin = (c) => {
  c = c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055;
  return Math.round(Math.min(1, Math.max(0, c)) * 255);
};

export function rgbToLab(r, g, b) {
  const R = toLin(r), G = toLin(g), B = toLin(b);
  const x = (R * 0.4124564 + G * 0.3575761 + B * 0.1804375) / 0.95047;
  const y = (R * 0.2126729 + G * 0.7151522 + B * 0.0721750);
  const z = (R * 0.0193339 + G * 0.1191920 + B * 0.9503041) / 1.08883;
  const f = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const fx = f(x), fy = f(y), fz = f(z);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

export function labToRgb([L, a, b]) {
  const fy = (L + 16) / 116, fx = fy + a / 500, fz = fy - b / 200;
  const inv = (t) => (t ** 3 > 0.008856 ? t ** 3 : (t - 16 / 116) / 7.787);
  const x = inv(fx) * 0.95047, y = inv(fy), z = inv(fz) * 1.08883;
  return [
    fromLin(3.2404542 * x - 1.5371385 * y - 0.4985314 * z),
    fromLin(-0.9692660 * x + 1.8760108 * y + 0.0415560 * z),
    fromLin(0.0556434 * x - 0.2040259 * y + 1.0572252 * z),
  ];
}

export const rgbToHex = ([r, g, b]) => '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('');
export function hexToRgb(hex) {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
export const hexToLab = (hex) => rgbToLab(...hexToRgb(hex));

export function rgbToHsl([r, g, b]) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h;
  if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return [h * 60, s, l];
}

const dist2 = (p, q) => (p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2 + (p[2] - q[2]) ** 2;

// Diferencia de color perceptual CIEDE2000.
export function deltaE2000([L1, a1, b1], [L2, a2, b2]) {
  const rad = Math.PI / 180, deg = 180 / Math.PI, p7 = 25 ** 7;
  const C1 = Math.hypot(a1, b1), C2 = Math.hypot(a2, b2);
  const Cm = (C1 + C2) / 2;
  const G = 0.5 * (1 - Math.sqrt(Cm ** 7 / (Cm ** 7 + p7)));
  const a1p = (1 + G) * a1, a2p = (1 + G) * a2;
  const C1p = Math.hypot(a1p, b1), C2p = Math.hypot(a2p, b2);
  const hue = (b, a) => { if (a === 0 && b === 0) return 0; const t = Math.atan2(b, a) * deg; return t < 0 ? t + 360 : t; };
  const h1p = hue(b1, a1p), h2p = hue(b2, a2p);
  const dLp = L2 - L1, dCp = C2p - C1p;
  let dhp = 0;
  if (C1p * C2p !== 0) { dhp = h2p - h1p; if (dhp > 180) dhp -= 360; else if (dhp < -180) dhp += 360; }
  const dHp = 2 * Math.sqrt(C1p * C2p) * Math.sin((dhp * rad) / 2);
  const Lpm = (L1 + L2) / 2, Cpm = (C1p + C2p) / 2;
  let hpm;
  if (C1p * C2p === 0) hpm = h1p + h2p;
  else if (Math.abs(h1p - h2p) <= 180) hpm = (h1p + h2p) / 2;
  else hpm = h1p + h2p < 360 ? (h1p + h2p + 360) / 2 : (h1p + h2p - 360) / 2;
  const T = 1 - 0.17 * Math.cos((hpm - 30) * rad) + 0.24 * Math.cos(2 * hpm * rad)
    + 0.32 * Math.cos((3 * hpm + 6) * rad) - 0.20 * Math.cos((4 * hpm - 63) * rad);
  const dTheta = 30 * Math.exp(-(((hpm - 275) / 25) ** 2));
  const Rc = 2 * Math.sqrt(Cpm ** 7 / (Cpm ** 7 + p7));
  const Sl = 1 + (0.015 * (Lpm - 50) ** 2) / Math.sqrt(20 + (Lpm - 50) ** 2);
  const Sc = 1 + 0.045 * Cpm, Sh = 1 + 0.015 * Cpm * T;
  const Rt = -Math.sin(2 * dTheta * rad) * Rc;
  return Math.sqrt((dLp / Sl) ** 2 + (dCp / Sc) ** 2 + (dHp / Sh) ** 2 + Rt * (dCp / Sc) * (dHp / Sh));
}

/* ---------- Nombres de color en español ---------- */
// [nombre, hex de referencia, ¿neutro?]
const PALETA = [
  ['negro', '#161616', true],
  ['gris oscuro', '#43464b', true],
  ['gris', '#8a8d91', true],
  ['gris claro', '#c8cacc', true],
  ['blanco', '#f5f5f3', true],
  ['crudo', '#ebe3d2', true],
  ['beige', '#d4bf9f', true],
  ['camel', '#b88658', true],
  ['marrón', '#5e3f2a', true],
  ['caqui', '#8c8660', true],
  ['azul marino', '#1d2741', true],
  ['vaquero', '#4d6b8e', true],
  ['azul', '#2c5db4', false],
  ['celeste', '#94c3e8', false],
  ['turquesa', '#24aeb0', false],
  ['verde menta', '#a6dbc2', false],
  ['verde', '#2e8b4e', false],
  ['verde botella', '#1e4631', false],
  ['oliva', '#6a6a2c', false],
  ['amarillo', '#f2d23a', false],
  ['mostaza', '#c8991c', false],
  ['naranja', '#ec7622', false],
  ['coral', '#f07b67', false],
  ['rojo', '#c3282b', false],
  ['granate', '#6c1d2a', false],
  ['rosa palo', '#e2bcbb', false],
  ['rosa', '#f0a2b7', false],
  ['fucsia', '#d02c84', false],
  ['lila', '#b6a0d8', false],
  ['morado', '#5c3889', false],
].map(([nombre, hex, neutro]) => ({ nombre, hex, neutro, lab: hexToLab(hex) }));

export const NOMBRES_COLOR = PALETA.map((p) => p.nombre);
export const colorDeNombre = (nombre) => PALETA.find((p) => p.nombre === nombre);

export function nombreColor(lab) {
  let best = PALETA[0], bestD = Infinity;
  for (const p of PALETA) {
    const d = deltaE2000(lab, p.lab);
    if (d < bestD) { bestD = d; best = p; }
  }
  return best.nombre;
}

// Descripción completa de un color a partir de su HEX.
export function describirColor(hex) {
  const rgb = hexToRgb(hex);
  const lab = rgbToLab(...rgb);
  return { hex: rgbToHex(rgb), nombre: nombreColor(lab) };
}

/* ---------- k-means ponderado ---------- */

function mulberry32(seed) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function kmeans(points, weights, k, iters = 20) {
  const n = points.length;
  if (!n) return [];
  const w = weights || new Array(n).fill(1);
  k = Math.min(k, n);
  const rnd = mulberry32(1234); // semilla fija → resultado estable

  // Inicialización k-means++ ponderada
  const totalW = w.reduce((a, b) => a + b, 0);
  let r = rnd() * totalW, first = 0;
  for (let i = 0; i < n; i++) { r -= w[i]; if (r <= 0) { first = i; break; } }
  const centers = [points[first].slice()];
  const d2 = new Float64Array(n).fill(Infinity);
  while (centers.length < k) {
    const c = centers[centers.length - 1];
    let sum = 0;
    for (let i = 0; i < n; i++) {
      const d = dist2(points[i], c);
      if (d < d2[i]) d2[i] = d;
      sum += d2[i] * w[i];
    }
    if (sum === 0) break;
    let t = rnd() * sum, idx = n - 1;
    for (let i = 0; i < n; i++) { t -= d2[i] * w[i]; if (t <= 0) { idx = i; break; } }
    centers.push(points[idx].slice());
  }

  const K = centers.length;
  const assign = new Int32Array(n).fill(-1);
  for (let it = 0; it < iters; it++) {
    let changed = false;
    for (let i = 0; i < n; i++) {
      let best = 0, bd = Infinity;
      for (let j = 0; j < K; j++) { const d = dist2(points[i], centers[j]); if (d < bd) { bd = d; best = j; } }
      if (assign[i] !== best) { assign[i] = best; changed = true; }
    }
    const acc = Array.from({ length: K }, () => [0, 0, 0, 0]);
    for (let i = 0; i < n; i++) {
      const a = acc[assign[i]], p = points[i], wi = w[i];
      a[0] += p[0] * wi; a[1] += p[1] * wi; a[2] += p[2] * wi; a[3] += wi;
    }
    for (let j = 0; j < K; j++) if (acc[j][3] > 0) centers[j] = [acc[j][0] / acc[j][3], acc[j][1] / acc[j][3], acc[j][2] / acc[j][3]];
    if (!changed) break;
  }
  const weightOf = new Array(K).fill(0);
  for (let i = 0; i < n; i++) weightOf[assign[i]] += w[i];
  return centers.map((center, j) => ({ center, weight: weightOf[j] })).sort((a, b) => b.weight - a.weight);
}

/* ---------- Color dominante de la prenda ---------- */

/* ---------- Balance de blancos con el fondo ---------- */

// Aplica una corrección por canal (en RGB lineal) a un color sRGB 0–255.
export function corregirRGB(r, g, b, ganancias) {
  if (!ganancias) return [r, g, b];
  return [fromLin(toLin(r) * ganancias[0]), fromLin(toLin(g) * ganancias[1]), fromLin(toLin(b) * ganancias[2])];
}

// Usa el fondo (píxeles del borde) como referencia de blanco.
// Devuelve { aplicado, ganancias, motivo, fondoHex }.
function calcularBalance(data, indicesBorde, fondoLab) {
  const fondoHex = rgbToHex(labToRgb(fondoLab));
  const croma = Math.hypot(fondoLab[1], fondoLab[2]);
  if (croma > 22) return { aplicado: false, motivo: 'color', fondoHex };
  if (fondoLab[0] < 55) return { aplicado: false, motivo: 'oscuro', fondoHex };
  // Color medio (en RGB lineal) de los píxeles del borde que pertenecen al fondo
  let R = 0, G = 0, B = 0, n = 0;
  for (const i of indicesBorde) {
    const k = i * 4;
    if (dist2(rgbToLab(data[k], data[k + 1], data[k + 2]), fondoLab) > 15 ** 2) continue;
    R += toLin(data[k]); G += toLin(data[k + 1]); B += toLin(data[k + 2]); n++;
  }
  if (!n) return { aplicado: false, motivo: 'oscuro', fondoHex };
  R /= n; G /= n; B /= n;
  // Ganancias que convierten el fondo en blanco/gris neutro (cada canal llevado al más alto)
  const ref = Math.max(R, G, B);
  const lim = (v) => Math.min(1.7, Math.max(0.6, v));
  return { aplicado: true, ganancias: [lim(ref / R), lim(ref / G), lim(ref / B)], fondoHex };
}

export function extraerColorDominante(source, { balanceBlancos = false } = {}) {
  // 1) Reducir la imagen (máx. 96 px de lado)
  const S = 96;
  const scale = Math.min(1, S / Math.max(source.width, source.height));
  const w = Math.max(8, Math.round(source.width * scale));
  const h = Math.max(8, Math.round(source.height * scale));
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(source, 0, 0, w, h);
  const data = ctx.getImageData(0, 0, w, h).data;
  const calcularLabs = (gan) => {
    const res = new Array(w * h);
    for (let i = 0; i < w * h; i++) res[i] = rgbToLab(...corregirRGB(data[i * 4], data[i * 4 + 1], data[i * 4 + 2], gan));
    return res;
  };
  let labs = calcularLabs(null);

  // 2) Estimar el fondo con los píxeles del borde (puede haber 1–3 colores de fondo)
  const bw = Math.max(2, Math.round(Math.min(w, h) * 0.06));
  const indicesBorde = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (x < bw || y < bw || x >= w - bw || y >= h - bw) indicesBorde.push(y * w + x);
  }
  let bgGroups = kmeans(indicesBorde.map((i) => labs[i]), null, 3);

  // 2b) Balance de blancos opcional: el fondo principal se toma como blanco/gris neutro
  let balance = null;
  if (balanceBlancos) {
    balance = calcularBalance(data, indicesBorde, bgGroups[0].center);
    if (balance.aplicado) {
      labs = calcularLabs(balance.ganancias);
      bgGroups = kmeans(indicesBorde.map((i) => labs[i]), null, 3);
    }
  }
  const bgTotal = bgGroups.reduce((a, g) => a + g.weight, 0);
  const fondos = bgGroups.filter((g) => g.weight / bgTotal > 0.15).map((g) => g.center);

  // 3) Descartar píxeles parecidos al fondo; peso gaussiano mayor en el centro
  const UMBRAL2 = 16 ** 2; // ΔE76 < 16 ⇒ fondo
  const cx = (w - 1) / 2, cy = (h - 1) / 2;
  const pesoCentro = (x, y) => {
    const nx = (x - cx) / (w / 2), ny = (y - cy) / (h / 2);
    return Math.exp(-(nx * nx + ny * ny) / (2 * 0.3));
  };
  let pts = [], wts = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const lab = labs[y * w + x];
    if (fondos.some((f) => dist2(lab, f) < UMBRAL2)) continue;
    pts.push(lab); wts.push(pesoCentro(x, y));
  }
  // Si casi todo parece fondo (prenda del mismo color que el fondo), usar la zona central
  if (pts.length < w * h * 0.05) {
    pts = []; wts = [];
    for (let y = Math.floor(h * 0.25); y < h * 0.75; y++) for (let x = Math.floor(w * 0.25); x < w * 0.75; x++) {
      pts.push(labs[y * w + x]); wts.push(pesoCentro(x, y));
    }
  }

  // 4) k-means (k = 5) en Lab y quedarse con el grupo principal
  const grupos = kmeans(pts, wts, 5);
  const lab = grupos[0].center;
  const hex = rgbToHex(labToRgb(lab));
  return { hex, nombre: nombreColor(lab), balance };
}

// Color medio de una zona pequeña alrededor de (x, y) en el canvas.
// `ganancias` (opcional): misma corrección de balance de blancos que la foto.
export function colorEnPunto(canvas, x, y, radio = 5, ganancias = null) {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const x0 = Math.max(0, Math.round(x - radio)), y0 = Math.max(0, Math.round(y - radio));
  const x1 = Math.min(canvas.width, Math.round(x + radio + 1)), y1 = Math.min(canvas.height, Math.round(y + radio + 1));
  const d = ctx.getImageData(x0, y0, Math.max(1, x1 - x0), Math.max(1, y1 - y0)).data;
  let L = 0, A = 0, B = 0, n = 0;
  for (let i = 0; i < d.length; i += 4) {
    const lab = rgbToLab(...corregirRGB(d[i], d[i + 1], d[i + 2], ganancias));
    L += lab[0]; A += lab[1]; B += lab[2]; n++;
  }
  const lab = [L / n, A / n, B / n];
  return { hex: rgbToHex(labToRgb(lab)), nombre: nombreColor(lab) };
}

/* ---------- Información para armonía ---------- */

export function infoColor(hex, categoria) {
  const rgb = hexToRgb(hex);
  const lab = rgbToLab(...rgb);
  const [hue, sat, light] = rgbToHsl(rgb);
  const croma = Math.hypot(lab[1], lab[2]);
  const nombre = nombreColor(lab);
  const ref = colorDeNombre(nombre);
  let neutro = ref.neutro || croma < 12;
  // Los vaqueros azules cuentan como neutro ("vaquero")
  if (categoria === 'vaqueros' && croma < 45) neutro = true;
  const saturado = !neutro && croma > 42 && sat > 0.45;
  const chillon = !neutro && croma > 62 && sat > 0.6 && light > 0.3;
  return { hex, lab, hue, sat, light, croma, nombre, neutro, saturado, chillon };
}

export function difTono(h1, h2) {
  const d = Math.abs(h1 - h2) % 360;
  return d > 180 ? 360 - d : d;
}
