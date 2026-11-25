// Outfit montado sobre un maniquí con las imágenes realistas teñidas (catalogo.js), y giro al deslizar.
// La colocación de cada prenda se configura en maniqui.js.

import { h, ICONOS, leerPref } from './ui.js';
import { abrirDialogo } from './nav.js';
import { realistaDePrenda, renderRealista, cajaRealista, existeVariante, realistasActivadas } from './catalogo.js';
import { MANIQUIES, ANCLAS_CATEGORIA, ANCLAS_PRENDA, CAPAS, POR_DENTRO, GIRO, PRENDAS_DE_MUJER, ABERTURAS } from './maniqui.js';

const ANCHO = 200, ALTO = 500;

/* ---------- Silueta del maniquí (SVG) ---------- */

// Medias anchuras del cuerpo (desde el eje x = 100)
const FORMA = {
  hombre: { cuello: 9, hombro: 48, axila: 37, pecho: 36, cintura: 28, cadera: 32, muslo: 30, cabeza: [18, 24] },
  mujer:  { cuello: 8, hombro: 41, axila: 32, pecho: 35, cintura: 23, cadera: 34, muslo: 31, cabeza: [16, 22] },
};

// Curva cerrada suave (Catmull-Rom) que pasa por los puntos
function suave(p) {
  const n = p.length;
  let d = `M${p[0][0].toFixed(1)} ${p[0][1].toFixed(1)}`;
  for (let i = 0; i < n; i++) {
    const p0 = p[(i - 1 + n) % n], p1 = p[i], p2 = p[(i + 1) % n], p3 = p[(i + 2) % n];
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += `C${c1[0].toFixed(1)} ${c1[1].toFixed(1)} ${c2[0].toFixed(1)} ${c2[1].toFixed(1)} ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`;
  }
  return d + 'Z';
}
const espejo = (pts) => pts.map(([x, y]) => [ANCHO - x, y]);

function svgManiqui(genero) {
  const M = MANIQUIES[genero], F = FORMA[genero];
  const c = 100;
  const izq = [
    [c - F.cuello, M.menton - 4], [c - F.cuello - 0.5, M.hombros - 6], [c - 26, M.hombros - 1],
    [c - F.hombro + 5, M.hombros + 3], [c - F.hombro + 1, M.hombros + 13], [c - F.axila, M.axilas],
    [c - F.pecho, (M.axilas + M.cintura) / 2 - 12], [c - F.cintura, M.cintura], [c - F.cadera, M.cadera],
    [c - F.muslo, M.entrepierna + 40], [c - 24, M.rodilla], [c - 22, M.rodilla + 45], [c - 15, M.tobillo],
    [c - 17, M.suelo - 4], [c - 13, M.suelo], [c - 5, M.suelo - 1], [c - 6, M.tobillo], [c - 5, M.rodilla + 45],
    [c - 4, M.rodilla], [c - 3, M.entrepierna + 30],
  ];
  const cuerpo = suave([...izq, [c, M.entrepierna], ...espejo(izq).reverse()]);
  const a = c - F.hombro;
  const brazo = [
    [a + 7, M.hombros + 5], [a - 2, M.hombros + 15], [a - 5, M.axilas + 40], [a - 7, M.cintura - 5],
    [a - 7, M.entrepierna], [a - 6, M.entrepierna + 24], [a + 1, M.entrepierna + 30], [a + 5, M.entrepierna + 2],
    [a + 5, M.cintura - 5], [c - F.axila + 2, M.axilas + 8],
  ];
  const [rx, ry] = F.cabeza;
  const cy = (M.cabeza + M.menton) / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${ANCHO} ${ALTO}">`
    + '<defs><linearGradient id="p" x1="0" x2="1"><stop offset="0" stop-color="#d6cdbf"/><stop offset=".5" stop-color="#ede7dd"/><stop offset="1" stop-color="#d3c9ba"/></linearGradient></defs>'
    + '<g fill="url(#p)" stroke="#c4b9a7" stroke-width=".8" stroke-linejoin="round">'
    + `<path d="${suave(brazo)}"/><path d="${suave(espejo(brazo))}"/><path d="${cuerpo}"/>`
    + `<ellipse cx="${c}" cy="${cy}" rx="${rx}" ry="${ry}"/></g></svg>`;
}
const urlsManiqui = {};
const urlManiqui = (g) => (urlsManiqui[g] ||= `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgManiqui(g))}`);

/* ---------- Prendas → piezas ---------- */

const grupoDe = (cat) => Object.keys(CAPAS).find((g) => CAPAS[g].includes(cat)) || null;
const ORDEN_GRUPOS = ['abajo', 'arriba', 'capa', 'calzado'];

// Prendas del armario → piezas con imagen realista (las que no tienen se quedan fuera)
export function piezasDePrendas(prendas) {
  return prendas.map((p) => ({
    id: realistaDePrenda(p),
    categoria: p.categoria,
    opciones: { base: p.color?.hex || '#cccccc', estampado: p.estampado || null, botones: p.botones || null },
  })).filter((x) => x.id && grupoDe(x.categoria));
}

function generoManiqui(piezas) {
  const g = leerPref('genero', '');
  if (g === 'mujer' || g === 'hombre') return g;
  return piezas.some((x) => PRENDAS_DE_MUJER(x.id)) ? 'mujer' : 'hombre';
}

// De atrás hacia delante: abajo (o vestido) → arriba → chaqueta/abrigo → calzado
function ordenar(piezas) {
  const pos = (x) => { const g = grupoDe(x.categoria); return ORDEN_GRUPOS.indexOf(g) * 10 + CAPAS[g].indexOf(x.categoria); };
  return [...piezas].sort((a, b) => pos(a) - pos(b));
}

function ancla(pieza) {
  return { escalaX: 1, dx: 0, ...ANCLAS_CATEGORIA[pieza.categoria], ...(ANCLAS_PRENDA[pieza.id] || {}) };
}

/* ---------- Montaje ---------- */

// Una capa: imagen colocada en su caja + sombreado con la forma de la prenda
// Máscara (SVG) que deja transparente la abertura del escote
const mascarasAbertura = new Map();
function mascaraAbertura(id) {
  const pol = ABERTURAS[id];
  if (!pol) return null;
  if (!mascarasAbertura.has(id)) {
    const d = 'M0 0H1V1H0Z M' + pol.map(([x, y]) => `${x} ${y}`).join(' L') + 'Z';
    mascarasAbertura.set(id, `url("data:image/svg+xml;charset=utf-8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1" preserveAspectRatio="none"><path fill="#fff" fill-rule="evenodd" d="${d}"/></svg>`)}")`);
  }
  return mascarasAbertura.get(id);
}

function capa(url, caja, M, a, { z, recorteY = null, dx = 0, abertura = null }) {
  const y = ([linea, d]) => M[linea] + d;
  const arriba = y(a.arriba), abajo = y(a.abajo);
  const altoImg = (abajo - arriba) / (caja.y1 - caja.y0);
  const anchoImg = altoImg * caja.aspecto * a.escalaX;
  const izq = 100 + dx - ((caja.x0 + caja.x1) / 2) * anchoImg;
  const sup = arriba - caja.y0 * altoImg;
  const el = h('div', { class: 'mq-capa', style: `left:${(izq / ANCHO) * 100}%;top:${(sup / ALTO) * 100}%;width:${(anchoImg / ANCHO) * 100}%;height:${(altoImg / ALTO) * 100}%;transform:translateZ(${z}px)` },
    h('img', { src: url, alt: '', draggable: 'false' }),
    h('div', { class: 'mq-sombra', style: `-webkit-mask-image:url("${url}");mask-image:url("${url}")` }));
  if (abertura) { el.style.webkitMaskImage = abertura; el.style.maskImage = abertura; el.classList.add('con-abertura'); }
  if (recorteY != null) {
    const fuera = Math.max(0, ((sup + altoImg - recorteY) / altoImg) * 100);
    el.style.clipPath = `inset(0 0 ${fuera.toFixed(2)}% 0)`;
  }
  return el;
}

async function montarCara(cara, piezas, genero, vista, estilo) {
  const M = MANIQUIES[genero];
  const capas = await Promise.all(ordenar(piezas).map(async (p, i) => {
    let id = p.id;
    if (vista === 'espalda') id = `${p.id}-espalda`;
    else if (grupoDe(p.categoria) === 'calzado' && await existeVariante(p.id, 'frente')) id = `${p.id}-frente`;
    const [caja, url] = await Promise.all([cajaRealista(id), renderRealista(id, p.opciones)]);
    const a = ancla(p);
    const dentro = p.categoria === 'camisa' && (POR_DENTRO.ids.includes(p.id) || POR_DENTRO.estilos.includes(estilo))
      && piezas.some((x) => grupoDe(x.categoria) === 'abajo' && x.categoria !== 'vestido');
    return capa(url, caja, M, a, { z: 2 + i * 2, recorteY: dentro ? M.cintura + POR_DENTRO.margen : null, dx: vista === 'espalda' ? -a.dx : a.dx,
      abertura: vista === 'frente' && id === p.id ? mascaraAbertura(p.id) : null });
  }));
  cara.append(...capas);
}

/* ---------- Maniquí con giro ---------- */

// Devuelve el bloque del maniquí o null si no hay nada que montar (o las imágenes realistas están desactivadas)
export function crearManiqui(piezas, { estilo = '', titulo = 'Outfit en el maniquí', grande = false } = {}) {
  if (!realistasActivadas() || !piezas.length) return null;
  const genero = generoManiqui(piezas);
  const base = () => h('div', { class: 'mq-capa mq-cuerpo', style: 'left:0;top:0;width:100%;height:100%;transform:translateZ(0)' },
    h('img', { src: urlManiqui(genero), alt: '', draggable: 'false' }),
    h('div', { class: 'mq-sombra', style: `-webkit-mask-image:url("${urlManiqui(genero)}");mask-image:url("${urlManiqui(genero)}")` }));
  const frente = h('div', { class: 'mq-cara mq-frente' }, base());
  const espalda = h('div', { class: 'mq-cara mq-espalda', hidden: true });
  const escena = h('div', { class: 'mq-escena' }, frente, espalda);
  const suelo = h('div', { class: 'mq-suelo', 'aria-hidden': 'true' });
  const zona = h('div', { class: 'maniqui cargando' + (grande ? ' grande' : ''), role: 'img', 'aria-label': titulo }, suelo, escena);

  // --- giro ---
  let ang = 0, completo = false, anim = 0, arrastre = null;
  const poner = (a) => {
    ang = a;
    const r = (a * Math.PI) / 180, s = Math.sin(r), k = 0.42;
    escena.style.transform = `rotateY(${a.toFixed(2)}deg)`;
    // El lado que se aleja se oscurece un poco
    frente.style.setProperty('--sd', (Math.max(0, s) * k).toFixed(3));
    frente.style.setProperty('--si', (Math.max(0, -s) * k).toFixed(3));
    espalda.style.setProperty('--sd', (Math.max(0, -s) * k).toFixed(3));
    espalda.style.setProperty('--si', (Math.max(0, s) * k).toFixed(3));
    suelo.style.setProperty('--cos', (0.55 + 0.45 * Math.abs(Math.cos(r))).toFixed(3));
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
  poner(0);

  // --- montaje (las imágenes se tiñen de una en una en catalogo.js) ---
  montarCara(frente, piezas, genero, 'frente', estilo)
    .then(async () => {
      zona.classList.remove('cargando');
      // Giro completo solo si todas las prendas tienen vista de espaldas
      const hay = await Promise.all(piezas.map((p) => existeVariante(p.id, 'espalda')));
      if (!hay.every(Boolean)) return;
      espalda.append(base());
      await montarCara(espalda, piezas, genero, 'espalda', estilo);
      espalda.hidden = false;
      completo = true;
      zona.classList.add('completo');
    })
    .catch((e) => { console.warn('Maniquí', e); zona.classList.remove('cargando'); });

  const ayuda = h('p', { class: 'mq-ayuda' }, 'Desliza sobre el maniquí para girarlo');
  if (grande) return h('div', { class: 'mq-bloque grande' }, zona, ayuda);
  const ampliar = h('button', { class: 'icon-btn mq-ampliar', type: 'button', 'aria-label': 'Ver el maniquí a pantalla completa',
    html: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 4h6v6M10 20H4v-6M20 4l-7 7M4 20l7-7"/></svg>',
    onclick: () => abrirManiquiGrande(piezas, { estilo, titulo }) });
  return h('div', { class: 'mq-bloque' }, zona, ampliar, ayuda);
}

function abrirManiquiGrande(piezas, opciones) {
  const bloque = crearManiqui(piezas, { ...opciones, grande: true });
  if (!bloque) return;
  const cerrar = h('button', { class: 'icon-btn visor-cerrar', type: 'button', 'aria-label': 'Cerrar', html: ICONOS.cerrar });
  const dlg = h('dialog', { class: 'visor visor-maniqui', 'aria-label': opciones.titulo }, bloque, cerrar);
  cerrar.addEventListener('click', () => dlg.close());
  dlg.addEventListener('close', () => dlg.remove());
  document.body.append(dlg);
  abrirDialogo(dlg); // «atrás» lo cierra
}
