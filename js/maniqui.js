// Maniquí por capas (canvas). En assets/maniqui/ están base.png y una capa PNG por prenda, todas del
// mismo tamaño y fotografiadas sobre el mismo maniquí: solo hay que apilarlas (sin mover ni escalar).
// Cada capa se tiñe con el color, el estampado y los botones de la prenda (mismo método que catalogo.js).

import { h, ICONOS } from './ui.js';
import { abrirDialogo } from './nav.js';
import { realistaDePrenda, tablaSombreado, capaEstampado, botonesPorDefecto } from './catalogo.js';
import { normalizarEstampado, colorEstampado } from './pattern.js';

/* ---------- Ajustes ---------- */

const DIR = 'assets/maniqui/';
const ORDEN = ['calzado', 'abajo', 'interior', 'intermedia', 'exterior']; // de atrás hacia delante (tras la base)
const QUITABLES = new Set(['intermedia', 'exterior']);
const SOMBREADO = { brillos: 0.6, sombraMinima: 0.5 };         // sobre la luminosidad media de la capa
const BOTON = { oscuro: 80, minPx: 12, maxPx: 500, proporcion: 2.2 };
const BAJO = { alfa: 128, ventana: 7, ventanaHueco: 61, margen: 4 };
const GIRO = { limite: 25, gradosPorPx: 0.35, vuelta: 480, sombra: 0.34 };
const MAX_MONTAJES = 16;

/* ---------- capas.json ---------- */

let config = null;
const promesaConfig = fetch(DIR + 'capas.json')
  .then((r) => r.json())
  .catch(() => ({ capas: {} }))
  .then((c) => { config = c; return c; });
export const cargarCapas = () => promesaConfig;
const tipoDe = (id) => (config && id && config.capas[id]) || null;

/* ---------- Fuentes: carga y análisis de cada PNG (una vez) ---------- */

const fuentes = new Map();
function cargarImagen(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('No se pudo cargar ' + src));
    img.src = src;
  });
}

function fuente(nombre) {
  if (!fuentes.has(nombre)) {
    fuentes.set(nombre, (async () => {
      const img = await cargarImagen(`${DIR}${nombre}.png`);
      const w = img.naturalWidth, alto = img.naturalHeight;
      const c = document.createElement('canvas'); c.width = w; c.height = alto;
      const ctx = c.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(img, 0, 0);
      const d = ctx.getImageData(0, 0, w, alto).data;
      const n = w * alto;
      const gris = new Uint8Array(n), alfa = new Uint8Array(n);
      let x0 = w, y0 = alto, x1 = -1, y1 = -1;
      for (let i = 0; i < n; i++) {
        const k = i * 4;
        alfa[i] = d[k + 3];
        if (!alfa[i]) continue;
        gris[i] = Math.round(0.299 * d[k] + 0.587 * d[k + 1] + 0.114 * d[k + 2]);
        const x = i % w, y = (i / w) | 0;
        if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
      }
      if (x1 < 0) { x0 = y0 = 0; x1 = y1 = 0; }
      return { img, w, h: alto, gris, alfa, caja: { x0, y0, x1, y1, ancho: x1 - x0 + 1, alto: y1 - y0 + 1 }, analisis: null };
    })().catch((e) => { fuentes.delete(nombre); throw e; }));
  }
  return fuentes.get(nombre);
}

const percentil = (hist, total, p) => { let acc = 0; for (let v = 0; v < 256; v++) { acc += hist[v]; if (acc >= total * p) return v; } return 255; };

// Botones por su forma: manchas oscuras pequeñas y redondeadas. El resto de píxeles oscuros
// (pliegues, entrepierna…) son tela. Se calcula una vez por capa.
function analizar(f) {
  if (f.analisis) return f.analisis;
  const { w, gris, alfa, caja } = f;
  const boton = new Uint8Array(gris.length);
  const visto = new Uint8Array(gris.length);
  const oscuro = (i) => alfa[i] > 128 && gris[i] < BOTON.oscuro;
  const pila = [];
  for (let y = caja.y0; y <= caja.y1; y++) {
    for (let x = caja.x0; x <= caja.x1; x++) {
      const i0 = y * w + x;
      if (visto[i0] || !oscuro(i0)) continue;
      // Mancha conectada (4 vecinos)
      const pixeles = [];
      let mx = x, Mx = x, my = y, My = y;
      visto[i0] = 1; pila.push(i0);
      while (pila.length) {
        const i = pila.pop();
        pixeles.push(i);
        const px = i % w, py = (i / w) | 0;
        if (px < mx) mx = px; if (px > Mx) Mx = px; if (py < my) my = py; if (py > My) My = py;
        if (px > 0 && !visto[i - 1] && oscuro(i - 1)) { visto[i - 1] = 1; pila.push(i - 1); }
        if (px < w - 1 && !visto[i + 1] && oscuro(i + 1)) { visto[i + 1] = 1; pila.push(i + 1); }
        if (i - w >= 0 && !visto[i - w] && oscuro(i - w)) { visto[i - w] = 1; pila.push(i - w); }
        if (i + w < gris.length && !visto[i + w] && oscuro(i + w)) { visto[i + w] = 1; pila.push(i + w); }
      }
      const an = Mx - mx + 1, al = My - my + 1;
      if (pixeles.length >= BOTON.minPx && pixeles.length <= BOTON.maxPx && Math.max(al / an, an / al) < BOTON.proporcion) {
        for (const i of pixeles) boton[i] = 1;
      }
    }
  }
  // Luminosidad de la tela y de los botones (percentiles)
  const hTela = new Uint32Array(256), hBoton = new Uint32Array(256);
  let nTela = 0, nBoton = 0;
  for (let y = caja.y0; y <= caja.y1; y++) for (let x = caja.x0; x <= caja.x1; x++) {
    const i = y * w + x;
    if (alfa[i] <= 128) continue;
    if (boton[i]) { hBoton[gris[i]]++; nBoton++; } else { hTela[gris[i]]++; nTela++; }
  }
  const tela = { ref: percentil(hTela, nTela, 0.5), bajo: percentil(hTela, nTela, 0.05), alto: percentil(hTela, nTela, 0.95) };
  const botones = nBoton ? { ref: percentil(hBoton, nBoton, 0.35), bajo: percentil(hBoton, nBoton, 0.05), alto: percentil(hBoton, nBoton, 0.95) } : null;
  // Brillos suavizados y sombra mínima: gris de la foto → gris con el que se sombrea
  const ajuste = new Uint8Array(256);
  for (let v = 0; v < 256; v++) {
    let g = v > tela.ref ? tela.ref + (v - tela.ref) * SOMBREADO.brillos : v;
    g = Math.max(g, tela.ref * SOMBREADO.sombraMinima);
    ajuste[v] = Math.round(g);
  }
  f.analisis = { boton, tela, botones, ajuste, nBotones: nBoton };
  return f.analisis;
}

/* ---------- Teñido de una capa (caché por prenda y colores) ---------- */

const tenidas = new Map();
const claveOpciones = ({ base, estampado, botones }) => {
  const e = normalizarEstampado(estampado);
  return [(base || '').toLowerCase(), e.tipo, e.color2 || '', e.orientacion || '', e.tamano || '', (botones || '').toLowerCase()].join('|');
};

function tenir(nombre, opciones) {
  const clave = nombre + '|' + claveOpciones(opciones);
  if (!tenidas.has(clave)) {
    tenidas.set(clave, (async () => {
      const f = await fuente(nombre);
      const A = analizar(f);
      const { w, gris, alfa, caja } = f;
      const base = opciones.base || '#cccccc';
      const est = normalizarEstampado(opciones.estampado);
      const tBase = tablaSombreado(base, A.tela);
      const tEst = est.tipo !== 'liso' ? tablaSombreado(colorEstampado(base, est), A.tela) : null;
      const cob = tEst ? capaEstampado(f, est) : null;
      const tBoton = tablaSombreado(opciones.botones || botonesPorDefecto(base), A.botones || A.tela);
      const c = document.createElement('canvas'); c.width = caja.ancho; c.height = caja.alto;
      const ctx = c.getContext('2d');
      const img = ctx.createImageData(caja.ancho, caja.alto);
      const o = img.data;
      for (let y = caja.y0, k = 0; y <= caja.y1; y++) {
        for (let x = caja.x0; x <= caja.x1; x++, k += 4) {
          const i = y * w + x;
          const a = alfa[i];
          if (!a) continue;
          let r, g, b;
          if (A.boton[i]) {
            const t = gris[i] * 3; r = tBoton[t]; g = tBoton[t + 1]; b = tBoton[t + 2];
          } else {
            const t = A.ajuste[gris[i]] * 3;
            r = tBase[t]; g = tBase[t + 1]; b = tBase[t + 2];
            if (cob && cob[i]) {
              const m = cob[i] / 255;
              r += (tEst[t] - r) * m; g += (tEst[t + 1] - g) * m; b += (tEst[t + 2] - b) * m;
            }
          }
          o[k] = r; o[k + 1] = g; o[k + 2] = b; o[k + 3] = a;
        }
      }
      ctx.putImageData(img, 0, 0);
      return { canvas: c, x: caja.x0, y: caja.y0 };
    })().catch((e) => { tenidas.delete(clave); throw e; }));
  }
  return tenidas.get(clave);
}

/* ---------- Montaje (caché por combinación) ---------- */

// Fila más baja de las prendas de arriba visibles, columna a columna, suavizada con un máximo
// móvil (y uno más ancho para las columnas sin prenda de arriba, como el hueco entre brazo y cuerpo).
async function bajoDeArriba(nombres, ancho) {
  const bajo = new Int32Array(ancho).fill(-1);
  for (const n of nombres) {
    const f = await fuente(n);
    for (let x = f.caja.x0; x <= f.caja.x1; x++) {
      for (let y = f.caja.y1; y >= f.caja.y0; y--) {
        if (f.alfa[y * f.w + x] > BAJO.alfa) { if (y > bajo[x]) bajo[x] = y; break; }
      }
    }
  }
  const maxMovil = (v, ventana) => {
    const r = new Int32Array(v.length).fill(-1), m = ventana >> 1;
    for (let x = 0; x < v.length; x++) for (let k = Math.max(0, x - m); k <= Math.min(v.length - 1, x + m); k++) if (v[k] > r[x]) r[x] = v[k];
    return r;
  };
  const b7 = maxMovil(bajo, BAJO.ventana);
  const b61 = maxMovil(b7, BAJO.ventanaHueco);
  return b7.map((v, x) => (v >= 0 ? v : b61[x]));
}

// Prenda de debajo (camisa bajo un jersey o una chaqueta, jersey bajo una chaqueta): en las filas
// donde está la de encima, solo se ve por su abertura central (escote, solapas); se oculta lo que
// asomaría por fuera de los lados o en el hueco entre la manga y el cuerpo.
async function recortarBajo(t, encima, cx) {
  const fs = await Promise.all(encima.map(fuente));
  const W = fs[0].w;
  const y0 = Math.max(t.y, Math.min(...fs.map((f) => f.caja.y0)));
  const y1 = Math.min(t.y + t.canvas.height - 1, Math.max(...fs.map((f) => f.caja.y1)));
  if (y1 < y0) return t.canvas;
  const lienzo = document.createElement('canvas'); lienzo.width = t.canvas.width; lienzo.height = t.canvas.height;
  const lc = lienzo.getContext('2d');
  lc.drawImage(t.canvas, 0, 0);
  const tapa = (x) => fs.some((f) => f.alfa[yFila * W + x] > BAJO.alfa);
  let yFila = 0;
  for (yFila = y0; yFila <= y1; yFila++) {
    // Tramos ocupados por la prenda de encima en esta fila
    const tramos = [];
    let ini = -1;
    for (let x = t.x; x < t.x + t.canvas.width; x++) {
      const tp = tapa(x);
      if (tp && ini < 0) ini = x;
      if (!tp && ini >= 0) { tramos.push([ini, x - 1]); ini = -1; }
    }
    if (ini >= 0) tramos.push([ini, t.x + t.canvas.width - 1]);
    if (!tramos.length) continue;
    const fy = yFila - t.y;
    const ocultar = (a, b) => { if (b >= a) lc.clearRect(a - t.x, fy, b - a + 1, 1); };
    ocultar(t.x, tramos[0][0] - 2);                                          // fuera, a la izquierda
    ocultar(tramos[tramos.length - 1][1] + 2, t.x + t.canvas.width - 1);     // fuera, a la derecha
    for (let k = 0; k < tramos.length - 1; k++) {                            // huecos que no son la abertura central
      const a = tramos[k][1] + 1, b = tramos[k + 1][0] - 1;
      if (!(a <= cx && cx <= b)) ocultar(a, b);
    }
  }
  return lienzo;
}

const montajes = new Map();
function montar(vista, capas) {
  // capas: [{ nombre, tipo, opciones }] ya ordenadas, solo las visibles
  const clave = vista + '§' + capas.map((c) => c.nombre + '|' + claveOpciones(c.opciones)).join('§');
  if (montajes.has(clave)) {
    const m = montajes.get(clave); montajes.delete(clave); montajes.set(clave, m); // la más reciente al final
    return m;
  }
  const trabajo = (async () => {
    const cfg = await cargarCapas();
    const [x0, y0, x1, y1] = cfg.recorte_vista || [0, 0, cfg.ancho, cfg.alto];
    const c = document.createElement('canvas'); c.width = x1 - x0; c.height = y1 - y0;
    const ctx = c.getContext('2d');
    const base = await fuente(vista === 'espalda' ? 'base-espalda' : 'base');
    ctx.drawImage(base.img, -x0, -y0);
    const tenidasCapas = await Promise.all(capas.map((k) => tenir(k.nombre, k.opciones)));
    const arriba = capas.filter((k) => k.tipo === 'interior' || k.tipo === 'intermedia' || k.tipo === 'exterior');
    const corte = arriba.length && capas.some((k) => k.tipo === 'abajo') ? await bajoDeArriba(arriba.map((k) => k.nombre), base.w) : null;
    const cx = Math.round((base.caja.x0 + base.caja.x1) / 2); // eje del maniquí
    const recortes = await Promise.all(capas.map((k, i) => {
      const encima = capas.filter((o) => ORDEN.indexOf(o.tipo) > ORDEN.indexOf(k.tipo) && (o.tipo === 'intermedia' || o.tipo === 'exterior'));
      return (k.tipo === 'interior' || k.tipo === 'intermedia') && encima.length ? recortarBajo(tenidasCapas[i], encima.map((o) => o.nombre), cx) : null;
    }));
    capas.forEach((k, i) => {
      const t = tenidasCapas[i];
      let lienzo = recortes[i] || t.canvas;
      if (k.tipo === 'abajo' && corte) {
        // El pantalón no asoma por los lados de la prenda de arriba
        lienzo = document.createElement('canvas'); lienzo.width = t.canvas.width; lienzo.height = t.canvas.height;
        const lc = lienzo.getContext('2d');
        lc.drawImage(t.canvas, 0, 0);
        for (let x = 0; x < lienzo.width; x++) {
          const b = corte[t.x + x];
          const filas = b - BAJO.margen - t.y; // filas del pantalón que quedan ocultas
          if (b >= 0 && filas > 0) lc.clearRect(x, 0, 1, filas);
        }
      }
      ctx.drawImage(lienzo, t.x - x0, t.y - y0);
    });
    return c;
  })();
  trabajo.catch(() => montajes.delete(clave));
  montajes.set(clave, trabajo);
  while (montajes.size > MAX_MONTAJES) montajes.delete(montajes.keys().next().value);
  return trabajo;
}

// Vistas de espaldas: solo si existen base-espalda.png y <id>-espalda.png de todas las capas
const existe = new Map();
function existePng(nombre) {
  if (!existe.has(nombre)) {
    existe.set(nombre, fetch(`${DIR}${nombre}.png`, { method: 'HEAD', cache: 'no-cache' })
      .then((r) => r.ok && (r.headers.get('content-type') || 'image/png').startsWith('image/'))
      .catch(() => false));
  }
  return existe.get(nombre);
}

/* ---------- Prendas → elementos del maniquí ---------- */

// Prendas del armario → elementos del maniquí. `miniatura(prenda)` crea su miniatura (una nueva cada vez).
export function piezasDePrendas(prendas, miniatura) {
  return prendas.map((p) => ({
    id: realistaDePrenda(p),
    opciones: { base: p.color?.hex || '#cccccc', estampado: p.estampado || null, botones: p.botones || null },
    miniatura: () => miniatura(p),
  }));
}

/* ---------- Componente ---------- */

// items: [{ id, opciones, miniatura() }]. Devuelve el maniquí con su fila de miniaturas, o null si
// ninguna prenda tiene capa (o las imágenes realistas están desactivadas: entonces no hay id).
export function crearManiqui(items, { titulo = 'Outfit en el maniquí', grande = false, quitadas = null } = {}) {
  if (!items.some((it) => it.id)) return null;
  if (config && !items.some((it) => tipoDe(it.id))) return null;
  const quitadasSet = new Set(quitadas || []); // índices de las prendas quitadas (solo cambia la vista)

  const lienzos = [h('canvas', { class: 'mq-lienzo visible' }), h('canvas', { class: 'mq-lienzo' })];
  let actual = 0;
  const escena = h('div', { class: 'mq-escena' }, ...lienzos);
  const zona = h('div', { class: 'maniqui cargando' + (grande ? ' grande' : ''), role: 'img', 'aria-label': titulo }, escena);
  const fila = h('div', { class: 'outfit-pieces mq-fila' });

  let montajeFrente = null, montajeEspalda = null, completo = false, ang = 0, encargo = 0;

  const capasVisibles = (vista) => items
    .map((it, i) => ({ it, i, tipo: tipoDe(it.id) }))
    .filter((x) => x.tipo && !quitadasSet.has(x.i))
    .sort((a, b) => ORDEN.indexOf(a.tipo) - ORDEN.indexOf(b.tipo))
    .map((x) => ({ nombre: vista === 'espalda' ? `${x.it.id}-espalda` : x.it.id, tipo: x.tipo, opciones: x.it.opciones }));

  // Dibuja el montaje en un lienzo a la resolución del dispositivo, con el sombreado del giro
  const dibujar = (lienzo) => {
    const norm = ((ang % 360) + 360) % 360;
    const deEspaldas = completo && norm > 90 && norm < 270;
    const m = deEspaldas ? montajeEspalda : montajeFrente;
    if (!m) return;
    const r = zona.getBoundingClientRect();
    if (!r.width) return;
    const dpr = window.devicePixelRatio || 1;
    const W = Math.round(zona.clientWidth * dpr), H = Math.round(zona.clientHeight * dpr);
    if (lienzo.width !== W || lienzo.height !== H) { lienzo.width = W; lienzo.height = H; }
    const ctx = lienzo.getContext('2d');
    ctx.clearRect(0, 0, W, H);
    // Entero y centrado en su recuadro
    const esc = Math.min(W / m.width, H / m.height);
    const dw = m.width * esc, dh = m.height * esc;
    ctx.save();
    ctx.imageSmoothingQuality = 'high';
    if (deEspaldas) { ctx.translate(W, 0); ctx.scale(-1, 1); } // el giro CSS la vuelve a dar la vuelta
    ctx.drawImage(m, (W - dw) / 2, (H - dh) / 2, dw, dh);
    ctx.restore();
    // Sombreado: el lado que se aleja se oscurece un poco (solo sobre el maniquí)
    const s = Math.sin((ang * Math.PI) / 180);
    if (Math.abs(s) > 0.01) {
      ctx.save();
      ctx.globalCompositeOperation = 'source-atop';
      const g = ctx.createLinearGradient(0, 0, W, 0);
      const fuerte = `rgba(20,20,20,${(Math.abs(s) * GIRO.sombra).toFixed(3)})`;
      if ((s > 0) !== deEspaldas) { g.addColorStop(0.45, 'rgba(20,20,20,0)'); g.addColorStop(1, fuerte); }
      else { g.addColorStop(0, fuerte); g.addColorStop(0.55, 'rgba(20,20,20,0)'); }
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      ctx.restore();
    }
  };

  // Monta la combinación actual y la muestra (con fundido si ya había otra)
  const actualizar = async (fundido) => {
    const n = ++encargo;
    try {
      await cargarCapas();
      const frente = await montar('frente', capasVisibles('frente'));
      const espalda = completo ? await montar('espalda', capasVisibles('espalda')) : null;
      if (n !== encargo) return;
      montajeFrente = frente; montajeEspalda = espalda;
      zona.classList.remove('cargando');
      if (!fundido) { dibujar(lienzos[actual]); return; }
      const sig = 1 - actual;
      dibujar(lienzos[sig]);
      lienzos[sig].classList.add('visible');
      lienzos[actual].classList.remove('visible');
      actual = sig;
    } catch (e) { console.warn('Maniquí', e); zona.classList.remove('cargando'); }
  };

  // --- fila de miniaturas: las capas intermedias y exteriores se quitan y se ponen ---
  const pintarFila = () => {
    fila.replaceChildren(...items.map((it, i) => {
      const quitable = QUITABLES.has(tipoDe(it.id));
      const quitada = quitadasSet.has(i);
      const contenido = it.miniatura();
      if (!quitable) return h('div', { class: 'piece' }, contenido);
      return h('button', {
        class: 'piece quitable' + (quitada ? ' quitada' : ''), type: 'button', 'aria-pressed': String(!quitada),
        'aria-label': quitada ? 'Volver a poner esta prenda en el maniquí' : 'Quitar esta prenda del maniquí',
        onclick: () => { if (quitada) quitadasSet.delete(i); else quitadasSet.add(i); pintarFila(); actualizar(true); },
      }, contenido, quitada ? h('span', { class: 'quitado' }, 'Quitado') : null);
    }));
  };

  // --- giro al deslizar ---
  let anim = 0, arrastre = null;
  const poner = (a) => {
    ang = a;
    escena.style.transform = `rotateY(${a.toFixed(2)}deg)`;
    dibujar(lienzos[actual]);
  };
  const volver = () => {
    const desde = ang, hasta = completo ? Math.round(ang / 360) * 360 : 0, t0 = performance.now();
    cancelAnimationFrame(anim);
    const paso = (t) => {
      const u = Math.min(1, (t - t0) / GIRO.vuelta), e = 1 - (1 - u) ** 3;
      poner(desde + (hasta - desde) * e);
      if (u < 1) anim = requestAnimationFrame(paso);
      else { poner(0); zona.classList.remove('girando'); }
    };
    anim = requestAnimationFrame(paso);
  };
  zona.addEventListener('pointerdown', (e) => {
    if (e.button > 0) return;
    cancelAnimationFrame(anim);
    arrastre = { id: e.pointerId, x: e.clientX, y: e.clientY, a0: ang, decidido: false };
  });
  zona.addEventListener('pointermove', (e) => {
    if (!arrastre || e.pointerId !== arrastre.id) return;
    const dx = e.clientX - arrastre.x, dy = e.clientY - arrastre.y;
    if (!arrastre.decidido) {
      if (Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy) * 1.2) {
        arrastre.decidido = true; arrastre.x = e.clientX; zona.classList.add('girando');
        try { zona.setPointerCapture(e.pointerId); } catch { /* ya liberado */ }
      } else if (Math.abs(dy) > 10) { arrastre = null; volver(); }
      return;
    }
    let a = arrastre.a0 + (e.clientX - arrastre.x) * GIRO.gradosPorPx * (grande ? 0.8 : 1);
    if (!completo) a = Math.max(-GIRO.limite, Math.min(GIRO.limite, a));
    poner(a);
  });
  const soltar = (e) => {
    if (!arrastre || e.pointerId !== arrastre.id) return;
    const decidido = arrastre.decidido;
    arrastre = null;
    if (decidido) volver();
  };
  zona.addEventListener('pointerup', soltar);
  zona.addEventListener('pointercancel', soltar);
  // Que el gesto no llegue al deslizar entre pestañas
  zona.addEventListener('touchstart', (e) => e.stopPropagation(), { passive: true });
  zona.addEventListener('touchmove', (e) => { if (arrastre && arrastre.decidido) e.stopPropagation(); }, { passive: true });

  // Al cambiar de tamaño (o al entrar en la página) se vuelve a dibujar a la resolución del dispositivo
  if ('ResizeObserver' in window) new ResizeObserver(() => lienzos.forEach(dibujar)).observe(zona);

  pintarFila();
  actualizar(false).then(async () => {
    // Giro completo (360°) solo si hay vista de espaldas de la base y de todas las capas
    const nombres = items.filter((it) => tipoDe(it.id)).map((it) => `${it.id}-espalda`);
    const hay = await Promise.all(['base-espalda', ...nombres].map(existePng));
    if (hay.every(Boolean)) { completo = true; zona.classList.add('completo'); actualizar(false); }
  });

  const ayuda = h('p', { class: 'mq-ayuda' }, '← Desliza para girar →');
  const panel = h('div', { class: 'mq-bloque' + (grande ? ' grande' : '') }, zona, ayuda);
  if (!grande) {
    panel.append(h('button', { class: 'icon-btn mq-ampliar', type: 'button', 'aria-label': 'Ver el maniquí a pantalla completa',
      html: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 4h6v6M10 20H4v-6M20 4l-7 7M4 20l7-7"/></svg>',
      onclick: () => abrirManiquiGrande(items, { titulo, quitadas: [...quitadasSet] }) }));
  }
  return h('div', { class: 'mq-conjunto' + (grande ? ' grande' : '') }, panel, fila);
}

function abrirManiquiGrande(items, opciones) {
  const bloque = crearManiqui(items, { ...opciones, grande: true });
  if (!bloque) return;
  const cerrar = h('button', { class: 'icon-btn visor-cerrar', type: 'button', 'aria-label': 'Cerrar', html: ICONOS.cerrar });
  const dlg = h('dialog', { class: 'visor visor-maniqui', 'aria-label': opciones.titulo }, bloque, cerrar);
  cerrar.addEventListener('click', () => dlg.close());
  dlg.addEventListener('close', () => dlg.remove());
  document.body.append(dlg);
  abrirDialogo(dlg); // «atrás» lo cierra
}
