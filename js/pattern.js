// Estampados de las prendas: modelo de datos, dibujo, editor reutilizable y detección automática.
//
// prenda.color      → color de base (el de siempre)
// prenda.estampado  → { tipo, color2, orientacion?, tamano? }
//   tipo: 'liso' | 'rayas' | 'cuadros' | 'topos' | 'otro'
//   color2: color del estampado (opcional, HEX)
//   orientacion: 'horizontal' | 'vertical'                (solo rayas)
//   tamano: rayas 'fino'|'medio'|'grueso' · cuadros 'pequeno'|'mediano'|'grande' · topos 'pequenos'|'grandes'

import { h, chip } from './ui.js';
import { crearPaleta } from './palette.js';
import { abrirCapa, cerrarCapa, capaAbierta } from './nav.js';
import { hexToLab, rgbToLab, labToRgb, rgbToHex, deltaE2000, describirColor, corregirRGB, kmeans } from './color.js';

export const TIPOS_ESTAMPADO = [
  { id: 'liso', nombre: 'Liso' },
  { id: 'rayas', nombre: 'Rayas' },
  { id: 'cuadros', nombre: 'Cuadros' },
  { id: 'topos', nombre: 'Topos' },
  { id: 'otro', nombre: 'Otro estampado' },
];
export const ORIENTACIONES = [['horizontal', 'Horizontal'], ['vertical', 'Vertical']];
export const TAMANOS = {
  rayas: [['fino', 'Fino'], ['medio', 'Medio'], ['grueso', 'Grueso']],
  cuadros: [['pequeno', 'Pequeño'], ['mediano', 'Mediano'], ['grande', 'Grande']],
  topos: [['pequenos', 'Pequeños'], ['grandes', 'Grandes']],
};
const TAMANO_POR_DEFECTO = { rayas: 'medio', cuadros: 'mediano', topos: 'pequenos' };

/* ---------- Modelo ---------- */

// Cualquier valor (incluido undefined en prendas antiguas) → estampado válido. Sin dato = liso.
export function normalizarEstampado(e) {
  const tipo = e && TIPOS_ESTAMPADO.some((t) => t.id === e.tipo) ? e.tipo : 'liso';
  if (tipo === 'liso') return { tipo: 'liso', color2: null };
  const res = { tipo, color2: e.color2 && /^#[0-9a-f]{6}$/i.test(e.color2) ? e.color2.toLowerCase() : null };
  if (tipo === 'rayas') res.orientacion = e.orientacion === 'vertical' ? 'vertical' : 'horizontal';
  if (TAMANOS[tipo]) res.tamano = TAMANOS[tipo].some(([v]) => v === e.tamano) ? e.tamano : TAMANO_POR_DEFECTO[tipo];
  return res;
}

export const estampadoDe = (prenda) => normalizarEstampado(prenda && prenda.estampado);
export const esLiso = (e) => normalizarEstampado(e).tipo === 'liso';

// Las rayas finas y los cuadros pequeños cuentan como discretos
export function esLlamativo(e) {
  const est = normalizarEstampado(e);
  if (est.tipo === 'liso') return false;
  if (est.tipo === 'rayas' && est.tamano === 'fino') return false;
  if (est.tipo === 'cuadros' && est.tamano === 'pequeno') return false;
  return true;
}

export function describirEstampado(e) {
  const est = normalizarEstampado(e);
  switch (est.tipo) {
    case 'rayas': return `Rayas ${est.orientacion === 'vertical' ? 'verticales' : 'horizontales'} ${{ fino: 'finas', medio: 'medianas', grueso: 'gruesas' }[est.tamano]}`;
    case 'cuadros': return `Cuadros ${{ pequeno: 'pequeños', mediano: 'medianos', grande: 'grandes' }[est.tamano]}`;
    case 'topos': return `Topos ${est.tamano === 'grandes' ? 'grandes' : 'pequeños'}`;
    case 'otro': return 'Estampado';
    default: return 'Liso';
  }
}

// Color del estampado; si no se ha elegido, uno que contraste con la base (solo para dibujarlo)
export function colorEstampado(base, e) {
  const est = normalizarEstampado(e);
  if (est.color2) return est.color2;
  return hexToLab(base)[0] > 60 ? '#1c1a18' : '#f5f5f3';
}

/* ---------- Dibujo ---------- */

// Dibujo de una tesela del estampado (sin el fondo), de lado P. `escala` permite usarla
// tanto en muestras CSS (en píxeles) como dentro de una ilustración SVG (en sus unidades).
export function cuerpoTesela(base, e, escala = 1) {
  const est = normalizarEstampado(e);
  const c2 = colorEstampado(base, est);
  let P, cuerpo;
  if (est.tipo === 'rayas') {
    P = { fino: 6, medio: 12, grueso: 22 }[est.tamano] * escala;
    const g = P * (est.tamano === 'fino' ? 0.4 : 0.45);
    cuerpo = est.orientacion === 'vertical'
      ? `<rect width="${g}" height="${P}" fill="${c2}"/>`
      : `<rect width="${P}" height="${g}" fill="${c2}"/>`;
  } else if (est.tipo === 'cuadros') {
    P = { pequeno: 10, mediano: 18, grande: 30 }[est.tamano] * escala;
    const b = P / 2;
    cuerpo = `<g fill="${c2}" fill-opacity=".55"><rect width="${b}" height="${P}"/><rect width="${P}" height="${b}"/></g>`;
  } else if (est.tipo === 'topos') {
    P = (est.tamano === 'grandes' ? 22 : 10) * escala;
    const r = P * (est.tamano === 'grandes' ? 0.22 : 0.18);
    cuerpo = `<g fill="${c2}"><circle cx="${P / 4}" cy="${P / 4}" r="${r}"/><circle cx="${(3 * P) / 4}" cy="${(3 * P) / 4}" r="${r}"/></g>`;
  } else {
    P = 28 * escala;
    cuerpo = `<g fill="${c2}" transform="scale(${escala})"><circle cx="6" cy="7" r="4"/><circle cx="20" cy="18" r="5.5"/><circle cx="21" cy="5" r="2"/><circle cx="8" cy="22" r="2.5"/><path d="M13 10q3-3 6 0" stroke="${c2}" stroke-width="1.6" fill="none"/></g>`;
  }
  return { P, cuerpo };
}

function tesela(base, e) {
  const { P, cuerpo } = cuerpoTesela(base, e, 1);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${P}" height="${P}"><rect width="${P}" height="${P}" fill="${base}"/>${cuerpo}</svg>`;
  return { svg, P };
}

// Valor para la propiedad CSS `background` de una muestra.
// dividido: para muestras muy pequeñas, mitad color de base y mitad color del estampado.
export function fondoEstampado(base, e, { dividido = false } = {}) {
  const est = normalizarEstampado(e);
  if (est.tipo === 'liso') return base;
  const c2 = colorEstampado(base, est);
  if (dividido) return `linear-gradient(135deg, ${base} 50%, ${c2} 50%)`;
  const { svg, P } = tesela(base, est);
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}") 0 0 / ${P}px ${P}px repeat, ${base}`;
}

/* ---------- Editor reutilizable ---------- */

// crearEditorEstampado({ base, valor, onCambio }) → { el, valor, setBase(hex), setValor(e, nota) }
export function crearEditorEstampado({ base = '#cccccc', valor = null, onCambio = () => {} } = {}) {
  let est = normalizarEstampado(valor);
  let colorBase = base;

  const tipos = h('div', { class: 'chips est-tipos', role: 'group', 'aria-label': 'Tipo de estampado' });
  const opciones = h('div', { class: 'est-opciones' });
  const vista = h('div', { class: 'est-preview', role: 'img' });
  const nota = h('p', { class: 'est-nota', hidden: true });
  const paleta = crearPaleta({ onElegir: (hex) => { est.color2 = hex; cambio(); } });
  const panelPaleta = h('div', { class: 'est-paleta', hidden: true }, paleta.el);
  // Abrir la paleta del estampado es un paso: «atrás» la cierra sin salir del editor
  let capaPaleta = null;
  const ocultarPaleta = () => {
    panelPaleta.hidden = true;
    const c = capaPaleta; capaPaleta = null;
    if (c && capaAbierta(c)) cerrarCapa(c);
  };
  const mostrarPaleta = () => {
    panelPaleta.hidden = false;
    capaPaleta = abrirCapa({ cerrar: () => { capaPaleta = null; panelPaleta.hidden = true; pintar(); } });
  };

  function filaChips(etiqueta, lista, actual, alElegir) {
    return h('div', { class: 'est-fila' },
      h('span', { class: 'est-etiqueta' }, etiqueta),
      h('div', { class: 'chips' }, ...lista.map(([v, t]) => chip(t, actual === v, () => alElegir(v)))));
  }

  function pintarVista() {
    vista.style.background = fondoEstampado(colorBase, est);
    vista.setAttribute('aria-label', `Vista previa: ${describirEstampado(est)}`);
  }

  function pintar() {
    tipos.replaceChildren(...TIPOS_ESTAMPADO.map((t) => chip(t.nombre, est.tipo === t.id, () => {
      if (est.tipo === t.id) return;
      est = normalizarEstampado({ ...est, tipo: t.id });
      cambio();
    })));
    const filas = [];
    if (est.tipo === 'rayas') {
      filas.push(filaChips('Orientación', ORIENTACIONES, est.orientacion, (v) => { est.orientacion = v; cambio(); }));
    }
    if (TAMANOS[est.tipo]) {
      filas.push(filaChips(est.tipo === 'rayas' ? 'Grosor' : 'Tamaño', TAMANOS[est.tipo], est.tamano, (v) => { est.tamano = v; cambio(); }));
    }
    if (est.tipo !== 'liso') {
      const muestra = h('span', { class: 'est-c2', style: { background: est.color2 || 'transparent' } });
      const btnElegir = h('button', { class: 'btn mini', type: 'button', 'aria-expanded': String(!panelPaleta.hidden) },
        panelPaleta.hidden ? 'Elegir de la paleta' : 'Ocultar paleta');
      btnElegir.addEventListener('click', () => { if (panelPaleta.hidden) mostrarPaleta(); else ocultarPaleta(); pintar(); });
      filas.push(h('div', { class: 'est-fila' },
        h('span', { class: 'est-etiqueta' }, 'Color del estampado'),
        h('div', { class: 'est-color' },
          muestra,
          h('span', { class: 'est-c2-nombre' }, est.color2 ? describirColor(est.color2).nombre : 'Sin elegir (opcional)'),
          btnElegir,
          est.color2 ? h('button', { class: 'link-btn', type: 'button', onclick: () => { est.color2 = null; cambio(); } }, 'Quitar') : null)));
    } else {
      ocultarPaleta();
    }
    opciones.replaceChildren(...filas);
    paleta.marcar(est.color2);
    vista.hidden = est.tipo === 'liso';
    pintarVista();
  }

  function cambio() {
    est = normalizarEstampado(est);
    nota.hidden = true; // al tocar algo, la sugerencia queda confirmada o cambiada
    pintar();
    onCambio(normalizarEstampado(est));
  }

  pintar();
  return {
    el: h('div', { class: 'est-editor' }, tipos, opciones, panelPaleta, vista, nota),
    get valor() { return normalizarEstampado(est); },
    setBase(hex) { colorBase = hex; pintarVista(); },
    setValor(v, textoNota = '') {
      est = normalizarEstampado(v);
      ocultarPaleta();
      nota.textContent = textoNota;
      nota.hidden = !textoNota;
      pintar();
    },
  };
}

/* ---------- Detección automática ---------- */

// Junta los grupos del k-means que son casi el mismo color (sombras, brillos)
function familiasDeColor(grupos) {
  const fam = [];
  for (const g of grupos) {
    const f = fam.find((x) => deltaE2000(x.lab, g.lab) < 15);
    if (f) {
      const t = f.fraccion + g.fraccion;
      f.lab = f.lab.map((v, i) => (v * f.fraccion + g.lab[i] * g.fraccion) / t);
      f.fraccion = t;
    } else fam.push({ lab: [...g.lab], fraccion: g.fraccion });
  }
  return fam.sort((a, b) => b.fraccion - a.fraccion);
}

// ¿Hay una variación periódica clara en este perfil? (autocorrelación)
function periodicidad(perfil) {
  const n = perfil.length;
  const media = perfil.reduce((a, b) => a + b, 0) / n;
  const c = perfil.map((v) => v - media);
  const varianza = c.reduce((a, v) => a + v * v, 0) / n;
  if (Math.sqrt(varianza) < 0.12) return { ok: false };
  const acf = (k) => { let s = 0; for (let i = 0; i + k < n; i++) s += c[i] * c[i + k]; return s / (n - k) / varianza; };
  let k = 1;
  while (k < n / 2 && acf(k) > 0) k++;           // hasta el primer cruce por cero
  const valores = [];
  for (let j = k; j <= n / 2; j++) valores.push([j, acf(j)]);
  const mejor = Math.max(0, ...valores.map(([, v]) => v));
  // El periodo es el primer pico fuerte (los múltiplos del periodo dan picos casi iguales)
  let periodo = 0;
  for (let i = 0; i < valores.length; i++) {
    const [j, v] = valores[i];
    const pico = (i === 0 || v >= valores[i - 1][1]) && (i === valores.length - 1 || v >= valores[i + 1][1]);
    if (pico && v >= mejor * 0.85) { periodo = j; break; }
  }
  return { ok: mejor > 0.35 && periodo >= 3, periodo, fuerza: mejor };
}

// analisis: resultado de extraerColorDominante (hex, caja, balance). Devuelve un estampado
// sugerido ({ ..., sugerido: true }) o { tipo: 'liso' }.
// Se analiza la zona central de la prenda (sin fondo): así un estampado con partes del
// mismo color que el fondo (p. ej. rayas blancas sobre fondo blanco) no se pierde.
export function detectarEstampado(canvas, analisis) {
  const liso = { tipo: 'liso', color2: null };
  if (!analisis) return liso;

  // 1) Zona central de la prenda (la mitad central de su caja), a 160×160
  const cj = analisis.caja || { x0: 0.25, y0: 0.25, x1: 0.75, y1: 0.75 };
  const W = canvas.width, H = canvas.height;
  const sx = (cj.x0 + (cj.x1 - cj.x0) * 0.25) * W, sy = (cj.y0 + (cj.y1 - cj.y0) * 0.25) * H;
  const sw = Math.max(8, (cj.x1 - cj.x0) * 0.5 * W), sh = Math.max(8, (cj.y1 - cj.y0) * 0.5 * H);
  const N = 160;
  const c = document.createElement('canvas');
  c.width = N; c.height = N;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(canvas, sx, sy, sw, sh, 0, 0, N, N);
  const d = ctx.getImageData(0, 0, N, N).data;
  const gan = analisis.balance && analisis.balance.aplicado ? analisis.balance.ganancias : null;
  const labs = new Array(N * N);
  for (let i = 0; i < N * N; i++) labs[i] = rgbToLab(...corregirRGB(d[i * 4], d[i * 4 + 1], d[i * 4 + 2], gan));

  // 2) k-means en esa zona y juntar grupos casi iguales (sombras, brillos)
  const muestra = labs.filter((_, i) => i % 3 === 0);
  const grupos = kmeans(muestra, null, 5);
  const total = grupos.reduce((s, g) => s + g.weight, 0) || 1;
  const fam = familiasDeColor(grupos.map((g) => ({ lab: g.center, fraccion: g.weight / total })));
  // Dos grupos grandes (más del 20 % cada uno) y muy distintos entre sí. Si hay más de dos
  // (p. ej. vichy: blanco, rosa del cruce y rojo), se toma la pareja más distinta.
  // «Muy distintos»: no basta con más claro/más oscuro (eso pueden ser sombras de una prenda lisa)
  const grandes = fam.filter((f) => f.fraccion >= 0.2);
  let par = null, maxDE = 0;
  for (let i = 0; i < grandes.length; i++) for (let j = i + 1; j < grandes.length; j++) {
    const p = grandes[i], q = grandes[j];
    const dE = deltaE2000(p.lab, q.lab);
    const dL = Math.abs(p.lab[0] - q.lab[0]);
    const dab = Math.hypot(p.lab[1] - q.lab[1], p.lab[2] - q.lab[2]);
    if (dE > 25 && (dab > 18 || dL > 40) && dE > maxDE) { maxDE = dE; par = [p, q]; }
  }
  if (!par) return liso;
  const [f1, f2] = par;
  // El color del estampado es el grupo más alejado del color de base
  const baseLab = hexToLab(analisis.hex);
  const [a, b] = deltaE2000(f1.lab, baseLab) <= deltaE2000(f2.lab, baseLab) ? [f1, f2] : [f2, f1];
  const color2 = rgbToHex(labToRgb(b.lab));

  // 3) Cada píxel: 1 si se parece más al color del estampado, 0 si al de base
  const filas = new Float64Array(N), cols = new Float64Array(N);
  const d2 = (p, q) => (p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2 + (p[2] - q[2]) ** 2;
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const lab = labs[y * N + x];
    const v = d2(lab, b.lab) < d2(lab, a.lab) ? 1 : 0;
    filas[y] += v / N; cols[x] += v / N;
  }
  const pf = periodicidad([...filas]);  // varía de fila en fila → rayas horizontales
  const pc = periodicidad([...cols]);   // varía de columna en columna → rayas verticales

  const tam = (p, cortes, nombres) => { const f = p / N; return f < cortes[0] ? nombres[0] : f < cortes[1] ? nombres[1] : nombres[2]; };
  if (pf.ok && pc.ok) {
    return { tipo: 'cuadros', color2, tamano: tam((pf.periodo + pc.periodo) / 2, [0.12, 0.25], ['pequeno', 'mediano', 'grande']), sugerido: true };
  }
  if (pf.ok || pc.ok) {
    const p = pf.ok ? pf : pc;
    // En unas rayas cada fila (o columna) es de un solo color; en topos se mezclan los dos
    const perfil = pf.ok ? filas : cols;
    const mezcla = perfil.reduce((s, r) => s + r * (1 - r), 0) / N;
    const cobertura = perfil.reduce((s, r) => s + r, 0) / N;
    if (mezcla > 0.1) {
      if (cobertura < 0.4) return { tipo: 'topos', color2, tamano: p.periodo / N < 0.18 ? 'pequenos' : 'grandes', sugerido: true };
      return { tipo: 'otro', color2, sugerido: true };
    }
    return { tipo: 'rayas', color2, orientacion: pf.ok ? 'horizontal' : 'vertical', tamano: tam(p.periodo, [0.1, 0.22], ['fino', 'medio', 'grueso']), sugerido: true };
  }
  return { tipo: 'otro', color2, sugerido: true };
}

// Frase para la sugerencia automática
export function textoSugerencia(e) {
  const est = normalizarEstampado(e);
  if (est.tipo === 'liso') return '';
  const c2 = est.color2 ? ` con ${describirColor(est.color2).nombre}` : '';
  const que = est.tipo === 'otro' ? 'tener un estampado' : `ser de ${describirEstampado(est).toLowerCase()}`;
  return `Sugerencia automática: parece ${que}${c2}. Confírmalo o cámbialo.`;
}
