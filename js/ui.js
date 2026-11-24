// Utilidades de interfaz compartidas por todas las pantallas.

import { abrirDialogo } from './nav.js';

export const $ = (sel, root = document) => root.querySelector(sel);

// Crea un elemento: h('div', { class: 'x', onclick: fn }, hijo1, 'texto', …)
export function h(tag, attrs = {}, ...hijos) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'html') el.innerHTML = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of hijos.flat()) if (c != null && c !== false) el.append(c instanceof Node ? c : document.createTextNode(c));
  return el;
}

export const ICONOS = {
  corazon: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10Z"/></svg>',
  otro: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12a8 8 0 0 1 14-5.3L20 9M20 4v5h-5M20 12a8 8 0 0 1-14 5.3L4 15M4 20v-5h5"/></svg>',
  papelera: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/></svg>',
  cerrar: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>',
  mas: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',
  foto: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="m21 16-5-5-9 9"/></svg>',
  diana: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/><path d="M12 1v4M12 19v4M1 12h4M19 12h4"/></svg>',
  editar: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16v4ZM14 6l4 4"/></svg>',
};

let toastTimer;
export function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2600);
}

export function chip(texto, activo, onclick, colorDot) {
  return h('button', { class: 'chip', type: 'button', 'aria-pressed': String(!!activo), onclick },
    colorDot ? h('span', { class: 'dot', style: { background: colorDot } }) : null, texto);
}

// Botón con icono SVG + texto
export function botonIcono(clase, icono, texto, onclick) {
  const b = h('button', { class: clase, type: 'button', html: ICONOS[icono] || '', onclick });
  if (texto) b.append(texto);
  return b;
}

// Muestra un color a pantalla completa para compararlo con la prenda real.
// Es un <dialog> modal para quedar por encima de otros diálogos abiertos.
// Con onElegir aparecen los botones «Volver» y «Elegir este color».
// Con lista (y nombreDe), se puede deslizar: de derecha a izquierda pasa al color siguiente
// de la lista y de izquierda a derecha al anterior.
export function mostrarColorGrande(hex, nombre = '', { onElegir = null, lista = null, nombreDe = null } = {}) {
  let indice = lista ? Math.max(0, lista.indexOf(hex)) : 0;
  let actual = hex;
  const conLista = !!(lista && lista.length > 1);
  const elNombre = h('strong', {}, nombre);
  const elHex = h('span', {}, hex.toUpperCase());
  const elPosicion = conLista ? h('small', { class: 'cg-posicion' }) : null;
  const acciones = onElegir
    ? h('div', { class: 'cg-acciones' },
      h('button', { class: 'btn', type: 'button', onclick: (e) => { e.stopPropagation(); dlg.close(); } }, 'Volver'),
      h('button', { class: 'btn primary', type: 'button', onclick: (e) => { e.stopPropagation(); dlg.close(); onElegir(actual); } }, 'Elegir este color'))
    : null;
  const dlg = h('dialog', { class: 'color-grande' + (conLista ? ' deslizable' : ''), 'aria-label': `Color ${nombre} ${hex.toUpperCase()} a pantalla completa` },
    h('div', { class: 'cg-info' + (onElegir ? ' con-acciones' : '') },
      elNombre, elHex, elPosicion,
      onElegir ? acciones : h('small', {}, 'Toca para cerrar')));

  const pintar = () => {
    actual = conLista ? lista[indice] : hex;
    dlg.style.background = actual;
    elHex.textContent = actual.toUpperCase();
    if (conLista) {
      elNombre.textContent = nombreDe ? nombreDe(actual) : '';
      elPosicion.textContent = `${indice + 1} de ${lista.length} · desliza para ver otros tonos`;
    }
    dlg.setAttribute('aria-label', `Color ${elNombre.textContent} ${actual.toUpperCase()} a pantalla completa`);
  };
  pintar();

  // Deslizar para cambiar de tono (sin salir de la pantalla completa)
  let inicio = null, deslizado = false;
  if (conLista) {
    dlg.addEventListener('pointerdown', (e) => { inicio = { x: e.clientX, y: e.clientY }; });
    dlg.addEventListener('pointerup', (e) => {
      if (!inicio) return;
      const dx = e.clientX - inicio.x, dy = e.clientY - inicio.y;
      inicio = null;
      if (Math.abs(dx) < 50 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
      deslizado = true; // el «click» que llega después no debe cerrar
      const nuevo = Math.min(lista.length - 1, Math.max(0, indice + (dx < 0 ? 1 : -1)));
      if (nuevo === indice) { dlg.classList.remove('tope'); void dlg.offsetWidth; dlg.classList.add('tope'); return; }
      dlg.classList.remove('pasa-izq', 'pasa-der'); void dlg.offsetWidth;
      dlg.classList.add(dx < 0 ? 'pasa-izq' : 'pasa-der');
      indice = nuevo;
      pintar();
    });
    dlg.addEventListener('pointercancel', () => { inicio = null; });
  }
  dlg.addEventListener('click', (e) => {
    if (deslizado) { deslizado = false; return; }
    if (!onElegir || !e.target.closest('.cg-info')) dlg.close();
  });
  dlg.addEventListener('close', () => dlg.remove());
  document.body.append(dlg);
  abrirDialogo(dlg); // «atrás» lo cierra
}

// Foto a pantalla completa con zoom de dos dedos (solo la foto; la app no se puede ampliar).
// Gestos: pellizcar para ampliar, arrastrar para moverse, doble toque para acercar/alejar.
export function mostrarFotoGrande(src, alt = 'Foto') {
  const img = h('img', { src, alt, draggable: 'false', class: 'visor-img' });
  const zona = h('div', { class: 'visor-zona' }, img);
  const cerrar = h('button', { class: 'icon-btn visor-cerrar', type: 'button', 'aria-label': 'Cerrar', html: ICONOS.cerrar });
  const dlg = h('dialog', { class: 'visor', 'aria-label': alt }, zona, cerrar,
    h('p', { class: 'visor-ayuda' }, 'Pellizca con dos dedos para ampliar · doble toque para acercar'));

  let s = 1, tx = 0, ty = 0;               // escala y desplazamiento (respecto a la caja de la foto)
  let caja = null;                          // posición y tamaño de la foto sin zoom
  const punteros = new Map();
  let gesto = null, ultimoToque = 0, movido = false;

  const medir = () => { const t = img.style.transform; img.style.transform = 'none'; caja = img.getBoundingClientRect(); img.style.transform = t; };
  const limitar = () => {
    s = Math.min(6, Math.max(1, s));
    tx = Math.min(0, Math.max(caja.width * (1 - s), tx));
    ty = Math.min(0, Math.max(caja.height * (1 - s), ty));
  };
  const aplicar = () => { img.style.transform = `translate(${tx}px, ${ty}px) scale(${s})`; };
  // Ampliar manteniendo fijo el punto (px, py) de la pantalla
  const zoomEn = (px, py, nuevaS, base = { s, tx, ty }) => {
    const lx = (px - caja.left - base.tx) / base.s, ly = (py - caja.top - base.ty) / base.s;
    s = nuevaS; tx = px - caja.left - s * lx; ty = py - caja.top - s * ly;
    limitar(); aplicar();
  };
  const empezar = () => {
    const ps = [...punteros.values()];
    gesto = { s, tx, ty, ps: ps.map((p) => ({ ...p })) };
    if (ps.length === 2) {
      gesto.d = Math.hypot(ps[0].x - ps[1].x, ps[0].y - ps[1].y) || 1;
      gesto.c = { x: (ps[0].x + ps[1].x) / 2, y: (ps[0].y + ps[1].y) / 2 };
    }
  };

  zona.addEventListener('pointerdown', (e) => {
    if (!caja) medir();
    try { zona.setPointerCapture(e.pointerId); } catch { /* puntero ya liberado */ }
    punteros.set(e.pointerId, { x: e.clientX, y: e.clientY });
    movido = false;
    empezar();
  });
  zona.addEventListener('pointermove', (e) => {
    if (!punteros.has(e.pointerId)) return;
    punteros.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const ps = [...punteros.values()];
    if (ps.length === 2 && gesto.d) {
      const d = Math.hypot(ps[0].x - ps[1].x, ps[0].y - ps[1].y);
      const c = { x: (ps[0].x + ps[1].x) / 2, y: (ps[0].y + ps[1].y) / 2 };
      // escala alrededor del centro inicial + desplazamiento del centro
      zoomEn(gesto.c.x, gesto.c.y, gesto.s * (d / gesto.d), gesto);
      tx += c.x - gesto.c.x; ty += c.y - gesto.c.y; limitar(); aplicar();
      movido = true;
    } else if (ps.length === 1 && gesto.ps.length === 1) {
      const dx = ps[0].x - gesto.ps[0].x, dy = ps[0].y - gesto.ps[0].y;
      if (Math.abs(dx) + Math.abs(dy) > 6) movido = true;
      if (s > 1) { tx = gesto.tx + dx; ty = gesto.ty + dy; limitar(); aplicar(); }
    }
  });
  const soltar = (e) => {
    if (!punteros.has(e.pointerId)) return;
    const eraUno = punteros.size === 1;
    punteros.delete(e.pointerId);
    if (eraUno && !movido) {
      const ahora = Date.now();
      if (ahora - ultimoToque < 320) { zoomEn(e.clientX, e.clientY, s > 1.05 ? 1 : 2.5); ultimoToque = 0; }
      else ultimoToque = ahora;
    }
    empezar();
  };
  zona.addEventListener('pointerup', soltar);
  zona.addEventListener('pointercancel', soltar);
  img.addEventListener('load', medir);
  window.addEventListener('resize', medir);

  cerrar.addEventListener('click', () => dlg.close());
  dlg.addEventListener('close', () => { window.removeEventListener('resize', medir); dlg.remove(); });
  document.body.append(dlg);
  abrirDialogo(dlg); // «atrás» lo cierra
  if (img.complete) medir();
  return dlg;
}

export function leerPref(k, def) { try { return localStorage.getItem(k) ?? def; } catch { return def; } }
export function guardarPref(k, v) { try { localStorage.setItem(k, v); } catch { /* sin almacenamiento */ } }
