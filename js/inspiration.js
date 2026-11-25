// Pestaña «Inspiración»: looks de referencia adaptados a mi armario.

import * as db from './db.js';
import { $, h, toast, chip, botonIcono, leerPref, guardarPref, mostrarFotoGrande } from './ui.js';
import { adaptarLook, describirHueco } from './matching.js';
import { ilustrarLook, iconoPrenda } from './illustration.js';
import { nombreCategoria, categoria as infoCategoria } from './categories.js';
import { realistaDeHueco, realistaEnCache, renderRealista } from './catalogo.js';
import { ESTILOS_OUTFIT } from './outfits.js';
import { abrirDialogo } from './nav.js';

const TEMPORADAS = ['verano', 'invierno', 'todo el año'];
const ROLES = { base: 'Base', acento: 'Acento', neutro: 'Neutro' };

let ctx = null;          // { prendas(), urlFoto(prenda), imgPrenda(prenda, attrs), abrirEdicionPrenda(prenda) }
let biblioteca = null;   // looks de looks.json
let misLooks = [];
const urlsLooks = new Map();
const filtros = {
  estilo: leerPref('insp-estilo', ''),
  temporada: leerPref('insp-temporada', ''),
};

export function iniciarInspiracion(contexto) { ctx = contexto; }

const valido = (l) => l && l.id && l.nombre && ESTILOS_OUTFIT[l.estilo] && Array.isArray(l.huecos) && l.huecos.length
  && l.huecos.every((x) => x.categoria && /^#[0-9a-f]{6}$/i.test(x.color));

async function cargarBiblioteca() {
  if (biblioteca) return;
  try {
    const r = await fetch('looks.json');
    const d = await r.json();
    biblioteca = (d.looks || []).filter((l) => {
      if (!valido(l)) { console.warn('Look no válido en looks.json:', l && l.id); return false; }
      return true;
    });
  } catch (e) {
    console.error(e);
    biblioteca = [];
  }
}

async function recargarMisLooks() {
  misLooks = (await db.getAll('looks')).filter(valido).map((l) => ({ ...l, mio: true }));
  const ids = new Set(misLooks.map((l) => l.id));
  [...urlsLooks.keys()].forEach((id) => { if (!ids.has(id)) { URL.revokeObjectURL(urlsLooks.get(id)); urlsLooks.delete(id); } });
}

function urlFotoLook(l) {
  if (!l.foto) return null;
  if (!urlsLooks.has(l.id)) urlsLooks.set(l.id, URL.createObjectURL(l.foto));
  return urlsLooks.get(l.id);
}

/* ================= COMPOSICIÓN REALISTA ================= */
// Las prendas del look con su imagen realista teñida (catalogo.js): las grandes arriba
// (capa, parte de arriba, abajo o vestido) y el calzado y los complementos más pequeños abajo.
// Las imágenes se hacen solo cuando la tarjeta va a verse y se reutiliza la caché de catalogo.js.

const ORDEN_GRANDES = { abrigo: 0, chaqueta: 1, jersey: 2, sudadera: 2, camisa: 3, camiseta: 3, vestido: 4 }; // el resto (abajo): 5
let observador = null;

function ponerImagenPieza(pieza, url) {
  const img = h('img', { alt: '', draggable: 'false', decoding: 'async' });
  img.addEventListener('load', () => pieza.classList.add('lista'), { once: true });
  img.src = url;
  if (img.complete) pieza.classList.add('lista');
  pieza.replaceChildren(img);
}

function cargarComposicion(el) {
  el.querySelectorAll('.lc-pieza:not(.lista)').forEach((pieza) => {
    const r = pieza.realista;
    if (!r || pieza.pedida) return;
    pieza.pedida = true;
    renderRealista(r.id, r.opciones)
      .then((url) => ponerImagenPieza(pieza, url))
      .catch(() => { pieza.innerHTML = iconoPrenda(r.categoria, r.opciones.base); pieza.classList.add('lista'); });
  });
}

function observar(el) {
  if (!('IntersectionObserver' in window)) { cargarComposicion(el); return; }
  if (!observador) {
    observador = new IntersectionObserver((entradas) => entradas.forEach((e) => {
      if (e.isIntersecting) { observador.unobserve(e.target); cargarComposicion(e.target); }
    }), { rootMargin: '300px 0px' });
  }
  observador.observe(el);
}

// Devuelve el elemento con la composición, o null si no toca (imágenes realistas desactivadas)
function composicionRealista(look, { titulo = '', perezosa = true } = {}) {
  const piezas = look.huecos.map((hu) => ({ hu, info: infoCategoria(hu.categoria), id: realistaDeHueco(hu, look.genero) }))
    .filter((x) => x.info);
  if (!piezas.some((x) => x.id)) return null;
  const pequena = (x) => x.info.slot === 'calzado' || x.info.slot === 'complemento';
  const grandes = piezas.filter((x) => !pequena(x)).sort((a, b) => (ORDEN_GRANDES[a.hu.categoria] ?? 5) - (ORDEN_GRANDES[b.hu.categoria] ?? 5));
  const pequenas = piezas.filter(pequena).sort((a, b) => (a.info.slot === 'calzado' ? 0 : 1) - (b.info.slot === 'calzado' ? 0 : 1)).slice(0, 3);

  const pieza = ({ hu, id }) => {
    const el = h('div', { class: 'lc-pieza', style: `--tinte: ${hu.color}` });
    if (!id) { el.innerHTML = iconoPrenda(hu.categoria, hu.color); el.classList.add('lista'); return el; }
    const opciones = { base: hu.color, estampado: hu.estampado || null, botones: hu.botones || null };
    const hecha = realistaEnCache(id, opciones);
    if (hecha) ponerImagenPieza(el, hecha);
    else el.realista = { id, opciones, categoria: hu.categoria };
    return el;
  };
  const el = h('div', titulo ? { class: 'look-comp', role: 'img', 'aria-label': titulo } : { class: 'look-comp', 'aria-hidden': 'true' },
    grandes.length ? h('div', { class: `lc-grandes n${Math.min(grandes.length, 5)}` }, ...grandes.map(pieza)) : null,
    pequenas.length ? h('div', { class: 'lc-pequenas' }, ...pequenas.map(pieza)) : null);
  if (el.querySelector('.lc-pieza:not(.lista)')) {
    if (perezosa) observar(el); else cargarComposicion(el);
  }
  return el;
}

const textoTemporada = (t) => (t === 'todo el año' ? 'Todo el año' : t ? t[0].toUpperCase() + t.slice(1) : '');
const meta = (l) => `${ESTILOS_OUTFIT[l.estilo].nombre} · ${textoTemporada(l.temporada)}`;

/* ================= LISTA ================= */

export async function renderInspiracion() {
  const host = $('#view-inspiracion');
  await Promise.all([cargarBiblioteca(), recargarMisLooks()]);
  const prendas = ctx.prendas();
  if (observador) observador.disconnect(); // las tarjetas anteriores ya no están

  // Solo los looks del género elegido en Ajustes y los unisex; los míos (desde foto) siempre
  const genero = leerPref('genero', '') || 'ambos';
  const delGenero = (l) => l.mio || genero === 'ambos' || !l.genero || l.genero === 'unisex' || l.genero === genero;
  const todos = [...misLooks, ...biblioteca].filter(delGenero);
  const lista = todos
    .filter((l) => (filtros.estilo === 'mios' ? l.mio : !filtros.estilo || l.estilo === filtros.estilo))
    .filter((l) => !filtros.temporada || l.temporada === filtros.temporada || l.temporada === 'todo el año')
    .map((look) => ({ look, res: adaptarLook(look, prendas) }))
    .sort((a, b) => b.res.parecido - a.res.parecido || (b.look.mio ? 1 : 0) - (a.look.mio ? 1 : 0));

  const ponerFiltro = (k, v) => { filtros[k] = filtros[k] === v ? '' : v; guardarPref(`insp-${k}`, filtros[k]); renderInspiracion(); };

  host.replaceChildren(...[
    botonIcono('btn primary block add-look', 'foto', 'Añadir look desde foto', () => abrirNuevoLook()),
    h('div', { class: 'filters' },
      h('div', { class: 'chips scroll-x', role: 'group', 'aria-label': 'Filtrar por estilo' },
        chip('Todos', !filtros.estilo, () => ponerFiltro('estilo', '')),
        ...Object.entries(ESTILOS_OUTFIT).map(([id, e]) => chip(e.nombre, filtros.estilo === id, () => ponerFiltro('estilo', id))),
        chip('Míos', filtros.estilo === 'mios', () => ponerFiltro('estilo', 'mios'))),
      h('div', { class: 'chips scroll-x', role: 'group', 'aria-label': 'Filtrar por temporada' },
        chip('Cualquier temporada', !filtros.temporada, () => ponerFiltro('temporada', '')),
        ...TEMPORADAS.filter((t) => t !== 'todo el año').map((t) => chip(textoTemporada(t), filtros.temporada === t, () => ponerFiltro('temporada', t))))),
    !prendas.length ? h('div', { class: 'notice' }, 'Añade prendas a tu armario para ver cuánto se parece cada look a lo que tienes.') : null,
    h('p', { class: 'muted small' }, `${lista.length} looks · ordenados por parecido con tu armario`),
    h('div', { class: 'looks' }, ...lista.map(({ look, res }) => tarjeta(look, res))),
    !lista.length ? h('p', { class: 'muted' }, filtros.estilo === 'mios' ? 'Aún no has añadido looks desde foto.' : 'No hay looks con estos filtros.') : null,
  ].filter(Boolean));
}

function tarjeta(look, res) {
  const foto = look.mio ? urlFotoLook(look) : null;
  const pct = res.parecido;
  const comp = foto ? null : composicionRealista(look);
  return h('button', { class: 'look-card', type: 'button', onclick: () => abrirLook(look) },
    h('div', { class: 'look-ilus' + (foto ? ' con-foto' : comp ? ' con-comp' : ''), html: foto || comp ? '' : ilustrarLook(look.huecos) },
      foto ? h('img', { src: foto, alt: '', loading: 'lazy' }) : comp),
    h('div', { class: 'look-info' },
      h('div', { class: 'look-nombre' }, look.nombre),
      h('div', { class: 'look-meta' }, meta(look), look.mio ? h('span', { class: 'badge' }, 'Mío') : null),
      h('div', { class: 'look-bar', 'aria-hidden': 'true' }, h('span', { style: { width: `${pct}%` } })),
      h('div', { class: 'look-faltan' }, res.faltan.length
        ? `Te ${res.faltan.length === 1 ? 'falta 1 prenda' : `faltan ${res.faltan.length} prendas`}`
        : '¡Lo tienes todo!')),
    h('div', { class: 'look-pct' }, h('strong', {}, `${pct}%`), h('span', {}, 'parecido')));
}

/* ================= DETALLE ================= */

let lookAbierto = null;
let elecciones = {};

function abrirLook(look) {
  lookAbierto = look;
  elecciones = {};
  pintarDetalle();
  const dlg = $('#dlg-look');
  if (!dlg.open) abrirDialogo(dlg); // «atrás» lo cierra
  dlg.scrollTop = 0;
}

function pintarDetalle() {
  const look = lookAbierto;
  const dlg = $('#dlg-look');
  const res = adaptarLook(look, ctx.prendas(), elecciones);
  const foto = look.mio ? urlFotoLook(look) : null;
  const comp = foto ? null : composicionRealista(look, { titulo: look.nombre, perezosa: false });

  const referencia = h('figure', { class: 'cmp-col' },
    h('figcaption', {}, 'Referencia'),
    foto
      ? h('button', { class: 'cmp-ref foto', type: 'button', 'aria-label': 'Ver la foto del look a pantalla completa', onclick: () => mostrarFotoGrande(foto, look.nombre) },
        h('img', { src: foto, alt: 'Foto del look' }),
        h('span', { class: 'foto-ampliar', 'aria-hidden': 'true', html: '<svg viewBox="0 0 24 24"><path d="M14 4h6v6M10 20H4v-6M20 4l-7 7M4 20l7-7"/></svg>' }))
      : comp ? h('div', { class: 'cmp-ref con-comp' }, comp)
        : h('div', { class: 'cmp-ref', html: ilustrarLook(look.huecos, { titulo: look.nombre }) }));

  const elegidas = res.huecos.filter((r) => r.prenda);
  const miVersion = h('figure', { class: 'cmp-col' },
    h('figcaption', {}, 'Tu versión'),
    elegidas.length
      ? h('div', { class: `cmp-mia n${Math.min(elegidas.length, 4)}` }, ...elegidas.map((r) =>
        ctx.imgPrenda(r.prenda, { alt: nombreCategoria(r.prenda.categoria) })))
      : h('div', { class: 'cmp-vacia' }, 'Aún no tienes prendas parecidas'));

  const filas = res.huecos.map((r, i) => {
    const btnOtra = r.opciones > 1
      ? botonIcono('btn mini', 'otro', `${r.eleccion + 1}/${r.opciones}`, () => { elecciones[i] = (elecciones[i] || 0) + 1; pintarDetalle(); })
      : null;
    if (btnOtra) btnOtra.setAttribute('aria-label', 'Ver otra opción para este hueco');
    return h('div', { class: 'slot-row' + (r.ok ? '' : ' falta') },
      h('div', { class: 'slot-ref', html: iconoPrenda(r.hueco.categoria, r.hueco.color) }),
      h('div', { class: 'slot-txt' },
        h('strong', {}, describirHueco(r.hueco)),
        h('span', {}, `${ROLES[r.hueco.rol] || ''}${r.ok ? '' : ' · no tienes nada parecido'}`)),
      r.prenda
        ? ctx.imgPrenda(r.prenda, { class: 'slot-mia', alt: nombreCategoria(r.prenda.categoria) })
        : h('div', { class: 'slot-mia vacia', 'aria-hidden': 'true' }, '?'),
      h('div', { class: 'slot-pct' }, `${r.puntos}%`),
      btnOtra || h('span'));
  });

  const acciones = look.mio ? h('div', { class: 'look-acciones' },
    botonIcono('btn', 'editar', 'Editar look', () => { dlg.close(); abrirNuevoLook(look); }),
    botonIcono('btn danger', 'papelera', 'Borrar look', async () => {
      if (!confirm('¿Borrar este look? No se puede deshacer.')) return;
      await db.remove('looks', look.id);
      dlg.close();
      toast('Look borrado');
      renderInspiracion();
    })) : null;

  dlg.replaceChildren(...[
    h('div', { class: 'sheet-head' },
      h('h2', {}, look.nombre),
      h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Cerrar', html: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>', onclick: () => dlg.close() })),
    h('p', { class: 'look-meta' }, meta(look), look.mio ? h('span', { class: 'badge' }, 'Mío') : null),
    h('div', { class: 'cmp' }, referencia, miVersion),
    h('div', { class: 'cmp-pct' }, h('strong', {}, `${res.parecido}%`), ' de parecido con tu armario'),
    h('h3', { class: 'sub-title' }, 'Prenda a prenda'),
    h('div', { class: 'slots' }, ...filas),
    res.faltan.length ? h('div', { class: 'faltan' },
      h('h3', { class: 'sub-title' }, 'Te falta'),
      h('ul', {}, ...res.faltan.map((f) => h('li', {}, f[0].toUpperCase() + f.slice(1)))),
      h('p', { class: 'muted small' }, 'Úsalo como lista de la compra.')) : null,
    acciones,
  ].filter(Boolean));
}

/* ================= NUEVO LOOK ================= */

async function abrirNuevoLook(look = null) {
  const { abrirEditorLook } = await import('./lookeditor.js');
  abrirEditorLook({
    look,
    onGuardado: async (guardado) => {
      if (urlsLooks.has(guardado.id)) { URL.revokeObjectURL(urlsLooks.get(guardado.id)); urlsLooks.delete(guardado.id); }
      await renderInspiracion();
      abrirLook({ ...guardado, mio: true });
    },
  });
}
