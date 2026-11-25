// Armario · lógica de la interfaz
import * as db from './db.js';
import { processPhoto, blobToCanvas } from './image.js';
import { extraerColorDominante, colorEnPunto, describirColor, NOMBRES_COLOR, colorDeNombre } from './color.js';
import { CATEGORIAS, ESTILOS, nombreCategoria, estilosPorDefecto, categoria } from './categories.js';
import { iniciarNavegacion, irATab, tabActual, abrirCapa, cerrarCapa, capaAbierta, atras, volverAlInicio, abrirDialogo, confirmarDescartar, cerrarConPregunta } from './nav.js';
import { ESTILOS_OUTFIT, generarOutfit, claveOutfit } from './outfits.js';
import { exportar, importar } from './backup.js';
import { $, h, ICONOS, toast, chip, leerPref, guardarPref, mostrarColorGrande, mostrarFotoGrande } from './ui.js';
import { svgPrenda, svgADataURL } from './illustration.js';
import { crearManiqui, piezasDePrendas } from './maniqui-vista.js';
import { gruposBasicos } from './basics.js';
import { realistaDePrenda, realistaDeBasico, realistaEnCache, renderRealista, cargarIndice, tieneCierre, tieneCremallera,
  botonesPorDefecto, catalogoDeCategoria, detectarBotonesEnFoto } from './catalogo.js';

// Preferencia «Mostrar contenido de»: 'mujer' | 'hombre' | 'ambos' ('' si aún no se ha elegido)
const NOMBRE_GENERO = { mujer: 'Mujer', hombre: 'Hombre', ambos: 'Ambos' };
const generoElegido = () => leerPref('genero', '');
const generoPreferido = () => generoElegido() || 'ambos';
import { crearPaleta } from './palette.js';
import { crearEditorEstampado, detectarEstampado, estampadoDe, normalizarEstampado, fondoEstampado, textoSugerencia, TIPOS_ESTAMPADO } from './pattern.js';
import { iniciarInspiracion, renderInspiracion } from './inspiration.js';

/* ---------- Estado ---------- */
const estado = {
  prendas: [],
  favoritos: [],
  filtroCat: null,      // id de categoría o GRUPO_CALZADO
  filtroColor: null,
  filtroEst: null,      // tipo de estampado
  estiloOutfit: leerPref('estiloOutfit', 'informal'),
  incluirAbrigo: leerPref('incluirAbrigo', 'false') === 'true',
  outfitActual: null,
};
const GRUPO_CALZADO = 'grupo:calzado';
const urls = new Map(); // id de prenda → { firma, url } de su foto o de su ilustración

// Opciones de la imagen realista de una prenda (color de base, estampado y botones)
const opcionesRealista = (p) => ({ base: p.color?.hex || '#cccccc', estampado: p.estampado, botones: p.botones || null });

// URL de la imagen realista si ya está hecha (si no, la encarga y devuelve null)
function urlRealista(p, encargar = true) {
  const id = realistaDePrenda(p);
  if (!id) return null;
  const opciones = opcionesRealista(p);
  const hecha = realistaEnCache(id, opciones);
  if (hecha || !encargar) return hecha;
  renderRealista(id, opciones).then(() => refrescarImagenes(p.id)).catch((e) => console.warn('Imagen realista', e));
  return null;
}

// Cuando termina una imagen realista, se cambia en todas las <img> de esa prenda que haya a la vista
function refrescarImagenes(idPrenda) {
  const p = estado.prendas.find((x) => x.id === idPrenda);
  const url = p && urlRealista(p, false);
  if (!url) return;
  document.querySelectorAll('img[data-prenda]').forEach((img) => {
    if (img.dataset.prenda === idPrenda) { img.src = url; img.classList.add('ilus'); }
  });
}

// ¿La imagen de la prenda es una ilustración o imagen realista (no su foto)? Se muestra entera
const esIlustracion = (p) => !p.foto || !!realistaDePrenda(p);

// <img> de una prenda (foto, ilustración o imagen realista), marcada para poder actualizarla
function imgPrenda(p, attrs = {}) {
  return h('img', { ...attrs, src: urlFoto(p), 'data-prenda': p.id, class: [attrs.class, esIlustracion(p) ? 'ilus' : ''].filter(Boolean).join(' ') });
}

// Encargar de antemano las imágenes realistas de todo el armario (se hacen de una en una)
function precargarRealistas() {
  estado.prendas.forEach((p) => urlRealista(p));
}

// URL de la imagen de una prenda: la imagen realista (prueba) si está activada y lista; si no, su
// foto o, si no tiene (básico), su ilustración SVG con el color de base y el estampado.
function urlFoto(p) {
  const realista = urlRealista(p);
  if (realista) return realista;
  const firma = p.foto ? 'foto' : JSON.stringify([p.basico?.icono || p.categoria, p.color?.hex, p.estampado]);
  const actual = urls.get(p.id);
  if (actual && actual.firma === firma) return actual.url;
  if (actual) liberarFoto(p.id);
  const url = p.foto
    ? URL.createObjectURL(p.foto)
    : svgADataURL(svgPrenda(p.basico?.icono || p.categoria, p.color?.hex || '#cccccc', p.estampado));
  urls.set(p.id, { firma, url });
  return url;
}
function liberarFoto(id) {
  const actual = urls.get(id);
  if (!actual) return;
  if (actual.url.startsWith('blob:')) URL.revokeObjectURL(actual.url);
  urls.delete(id);
}
const nombrePrenda = (p) => p.nombre || nombreCategoria(p.categoria);

async function recargarDatos() {
  const [prendas, favoritos] = await Promise.all([db.getAll('prendas'), db.getAll('outfits')]);
  // Las prendas antiguas, sin estampado, pasan a ser «liso» con su color como color de base
  // Las sandalias creadas como básico cuando aún no existía su categoría pasan a «sandalias»
  estado.prendas = prendas
    .map((p) => ({
      ...p,
      estampado: estampadoDe(p),
      ...(p.basico?.id === 'sandalias' && p.categoria === 'zapatos' ? { categoria: 'sandalias' } : {}),
    }))
    .sort((a, b) => (b.creada || 0) - (a.creada || 0));
  setTimeout(precargarRealistas, 0); // imágenes realistas del armario, en segundo plano
  estado.favoritos = favoritos.sort((a, b) => (b.fecha || 0) - (a.fecha || 0));
  const ids = new Set(prendas.map((p) => p.id));
  [...urls.keys()].forEach((id) => { if (!ids.has(id)) liberarFoto(id); });
}

/* ---------- Navegación ---------- */
// etiqueta: texto pequeño en mayúsculas encima del título; titulo: el título de la pantalla
const VISTAS = {
  armario: { etiqueta: 'Mi armario', titulo: () => { const n = estado.prendas.length; return `${n} ${n === 1 ? 'prenda' : 'prendas'}`; }, render: renderArmario },
  anadir: { etiqueta: 'Añadir', titulo: () => 'Nueva prenda', render: () => {} },
  outfits: { etiqueta: 'Outfits', titulo: () => 'Tu outfit de hoy', render: renderOutfits },
  inspiracion: { etiqueta: 'Looks', titulo: () => 'Inspiración', render: () => renderInspiracion() },
};
function ponerTitulo(vista) {
  $('#page-eyebrow').textContent = VISTAS[vista].etiqueta;
  $('#page-title').textContent = VISTAS[vista].titulo();
}

// Muestra una pestaña (la llama nav.js: al cambiar de pestaña y al volver atrás).
// Si ya había otra a la vista, el cambio es una transición deslizante.
function ruta(nombre = tabActual()) {
  const vista = VISTAS[nombre] ? nombre : 'armario';
  document.querySelectorAll('.tabbar a').forEach((a) => {
    if (a.dataset.tab === vista) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });
  ponerTitulo(vista);
  moverIndicador(ORDEN_TABS.indexOf(vista));

  const anterior = vistaVisible;
  const pendiente = deslizePendiente; // viene de un deslizamiento con el dedo ya empezado
  deslizePendiente = null;
  if (!(pendiente && pendiente.nuevo === vista)) VISTAS[vista].render();
  vistaVisible = vista;

  if (!anterior || anterior === vista || $(`#view-${anterior}`).hidden) {
    terminarTransicion();
    for (const k of Object.keys(VISTAS)) { const el = $(`#view-${k}`); el.hidden = k !== vista; limpiar(el); }
    window.scrollTo(0, 0);
    return;
  }
  const dir = ORDEN_TABS.indexOf(vista) > ORDEN_TABS.indexOf(anterior) ? 1 : -1;
  animarCambio(anterior, vista, dir, pendiente ? pendiente.progreso : 0);
}

/* ---------- Transiciones entre las pantallas principales ---------- */
const ORDEN_TABS = ['armario', 'outfits', 'anadir', 'inspiracion']; // el mismo orden que la barra inferior
let vistaVisible = null;
let deslizePendiente = null;   // { nuevo, progreso } al soltar el dedo a mitad de un deslizamiento
let transicion = null;         // { fin() } de la animación en curso
const sinMovimiento = () => !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
const CURVA = 'cubic-bezier(.22,.8,.24,1)';

// Distancia entre una pantalla y la siguiente (el ancho de la zona central, con sus márgenes)
const anchoPaso = () => $('main').getBoundingClientRect().width;

// Coloca una pantalla «flotando» encima, alineada con la que se ve, para moverla junto a ella
function superponer(el) {
  const m = $('main');
  const r = m.getBoundingClientRect();
  const cs = getComputedStyle(m);
  const arriba = $('.topbar').getBoundingClientRect().bottom;
  Object.assign(el.style, {
    position: 'fixed', top: `${arriba}px`, bottom: '0', zIndex: '5', overflow: 'hidden',
    left: `${r.left + parseFloat(cs.paddingLeft)}px`,
    width: `${m.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight)}px`,
    pointerEvents: 'none',
  });
  el.hidden = false;
}
function limpiar(el) {
  ['position', 'top', 'bottom', 'zIndex', 'overflow', 'left', 'width', 'pointerEvents', 'transform', 'transition', 'willChange']
    .forEach((k) => { el.style[k] = ''; });
}

function terminarTransicion() { if (transicion) transicion.fin(); }

// Anima de una pantalla a otra. dir = 1 si la nueva entra por la derecha.
// progreso (0–1): lo ya recorrido con el dedo, para seguir desde ahí sin saltos.
function animarCambio(viejo, nuevo, dir, progreso = 0) {
  terminarTransicion();
  const elV = $(`#view-${viejo}`), elN = $(`#view-${nuevo}`);
  for (const k of Object.keys(VISTAS)) if (k !== viejo && k !== nuevo) { const el = $(`#view-${k}`); el.hidden = true; limpiar(el); }
  const ancho = anchoPaso();
  if (elN.style.position !== 'fixed') superponer(elN);
  elV.hidden = false;
  [elV, elN].forEach((e) => { e.style.transition = 'none'; e.style.willChange = 'transform'; });
  elV.style.transform = `translateX(${-dir * progreso * ancho}px)`;
  elN.style.transform = `translateX(${dir * (1 - progreso) * ancho}px)`;
  void elN.offsetWidth;
  const dur = sinMovimiento() ? 0 : Math.round(320 * (1 - progreso)) + 60;
  [elV, elN].forEach((e) => { e.style.transition = `transform ${dur}ms ${CURVA}`; });
  elV.style.transform = `translateX(${-dir * ancho}px)`;
  elN.style.transform = 'translateX(0)';
  let hecho = false;
  const fin = () => {
    if (hecho) return;
    hecho = true;
    clearTimeout(temporizador);
    transicion = null;
    elV.hidden = true;
    limpiar(elV);
    window.scrollTo(0, 0);
    limpiar(elN);
    elN.hidden = false;
  };
  const temporizador = setTimeout(fin, dur + 30);
  transicion = { fin };
}

// Marcador de la barra inferior (la posición puede ser fraccionaria mientras se desliza)
function moverIndicador(posicion, conAnimacion = true) {
  const ind = $('.tab-indicador');
  if (!ind || posicion < 0) return;
  ind.style.transition = conAnimacion && !sinMovimiento() ? `transform 340ms ${CURVA}` : 'none';
  ind.style.transform = `translateX(${posicion * 100}%)`;
}

/* ---------- Deslizar con el dedo (progresivo) ---------- */
// De derecha a izquierda → pestaña siguiente; de izquierda a derecha → anterior.
// La pantalla sigue al dedo y la de al lado entra a la vez; al soltar se completa o vuelve.
// Solo se excluye lo que ya usa el gesto lateral: filas de chips que se desplazan de lado y campos
// de texto. Sobre fotos, paletas o botones sí se puede deslizar (tocarlos sigue funcionando).
const NO_DESLIZAR = '.scroll-x, input:not([type="checkbox"]):not([type="radio"]):not([type="file"]), select, textarea, [contenteditable], .tabbar, .maniqui';
function activarDeslizarPestanas() {
  // Se escucha en toda la pantalla (no solo en el contenido): así también funciona en la zona
  // vacía de abajo en las pantallas cortas (Añadir, Outfits…)
  const zona = document;
  let g = null; // gesto en curso

  const vecina = (dx) => {
    const i = ORDEN_TABS.indexOf(vistaVisible);
    const j = i + (dx < 0 ? 1 : -1);
    return j >= 0 && j < ORDEN_TABS.length ? ORDEN_TABS[j] : null;
  };
  const quitarVecina = () => {
    if (g && g.nueva) { const el = $(`#view-${g.nueva}`); el.hidden = true; limpiar(el); g.nueva = null; }
  };

  zona.addEventListener('touchstart', (e) => {
    g = null;
    if (e.touches.length !== 1 || document.querySelector('dialog[open]')) return;
    if (e.target.closest(NO_DESLIZAR)) return;
    const t = e.touches[0];
    // Los bordes de la pantalla son del gesto «atrás» de Android: ahí no se cambia de pestaña
    if (t.clientX < 24 || t.clientX > window.innerWidth - 24) return;
    terminarTransicion();
    g = { x: t.clientX, y: t.clientY, modo: null, nueva: null, dx: 0, ancho: anchoPaso(), muestras: [] };
  }, { passive: true });

  zona.addEventListener('touchmove', (e) => {
    if (!g) return;
    const t = e.touches[0];
    const dx = t.clientX - g.x, dy = t.clientY - g.y;
    if (!g.modo) {
      if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return;
      g.modo = Math.abs(dx) > Math.abs(dy) * 1.2 ? 'horizontal' : 'vertical';
      if (g.modo === 'vertical') { g = null; return; } // es un desplazamiento normal de la página
    }
    if (e.cancelable) e.preventDefault(); // que la página no se mueva mientras se arrastra de lado
    g.muestras.push({ x: t.clientX, t: performance.now() });
    if (g.muestras.length > 5) g.muestras.shift();
    const elV = $(`#view-${vistaVisible}`);
    const destino = vecina(dx);
    if (destino !== g.nueva) {
      quitarVecina();
      if (destino) { VISTAS[destino].render(); superponer($(`#view-${destino}`)); g.nueva = destino; }
    }
    const i = ORDEN_TABS.indexOf(vistaVisible);
    if (!g.nueva) {
      // Primera o última pestaña: se nota resistencia
      g.dx = dx * 0.25;
      elV.style.transition = 'none';
      elV.style.transform = `translateX(${g.dx}px)`;
      moverIndicador(i - g.dx / g.ancho, false);
      return;
    }
    g.dx = dx;
    const dir = dx < 0 ? 1 : -1;
    const elN = $(`#view-${g.nueva}`);
    elV.style.transition = 'none';
    elN.style.transition = 'none';
    elV.style.transform = `translateX(${dx}px)`;
    elN.style.transform = `translateX(${dir * g.ancho + dx}px)`;
    moverIndicador(i - dx / g.ancho, false);
  }, { passive: false });

  const soltar = () => {
    if (!g || g.modo !== 'horizontal') { g = null; return; }
    const gesto = g;
    g = null;
    const elV = $(`#view-${vistaVisible}`);
    const m = gesto.muestras;
    const vel = m.length > 1 ? (m[m.length - 1].x - m[0].x) / Math.max(1, m[m.length - 1].t - m[0].t) : 0; // px/ms
    const lejos = Math.abs(gesto.dx) > gesto.ancho * 0.3;
    const rapido = Math.abs(vel) > 0.45 && Math.sign(vel) === Math.sign(gesto.dx) && Math.abs(gesto.dx) > 30;
    if (gesto.nueva && (lejos || rapido)) {
      // Completar desde donde lo dejó el dedo
      deslizePendiente = { nuevo: gesto.nueva, progreso: Math.min(1, Math.abs(gesto.dx) / gesto.ancho) };
      irATab(gesto.nueva); // como tocar la pestaña: añade un paso al historial
      return;
    }
    // Volver a su sitio
    const dur = sinMovimiento() ? 0 : 260;
    elV.style.transition = `transform ${dur}ms ${CURVA}`;
    elV.style.transform = 'translateX(0)';
    let elN = null;
    if (gesto.nueva) {
      elN = $(`#view-${gesto.nueva}`);
      elN.style.transition = `transform ${dur}ms ${CURVA}`;
      elN.style.transform = `translateX(${(gesto.dx < 0 ? 1 : -1) * gesto.ancho}px)`;
    }
    moverIndicador(ORDEN_TABS.indexOf(vistaVisible));
    setTimeout(() => {
      limpiar(elV);
      if (elN && vistaVisible !== gesto.nueva) { elN.hidden = true; limpiar(elN); }
    }, dur + 30);
  };
  zona.addEventListener('touchend', soltar, { passive: true });
  zona.addEventListener('touchcancel', soltar, { passive: true });
}

/* ================= ARMARIO ================= */
function renderArmario() {
  const grid = $('#grid');
  const vacio = $('#armario-vacio');
  const { prendas } = estado;
  vacio.hidden = prendas.length > 0;
  $('.filters').hidden = prendas.length === 0;
  $('#contador').hidden = prendas.length === 0;
  if (vistaVisible === 'armario') ponerTitulo('armario');

  // Los tres filtros se combinan (p. ej. Camisas + azul + rayas)
  const esCalzado = (p) => categoria(p.categoria)?.slot === 'calzado';
  const pasaCat = (p, f) => !f || (f === GRUPO_CALZADO ? esCalzado(p) : p.categoria === f);
  const pasaColor = (p, f) => !f || (p.color && p.color.nombre === f);
  const pasaEst = (p, f) => !f || estampadoDe(p).tipo === f;
  const alternar = (clave, valor) => { estado[clave] = estado[clave] === valor ? null : valor; renderArmario(); };
  const conCuenta = (texto, n) => h('span', {}, texto, h('span', { class: 'chip-n' }, String(n)));

  // Categorías: solo las que tengo, con su número; «Calzado» agrupa todo el calzado
  const cuenta = (fn) => prendas.filter(fn).length;
  const cats = CATEGORIAS.filter((c) => prendas.some((p) => p.categoria === c.id));
  const nCalzado = cuenta(esCalzado);
  if (estado.filtroCat && estado.filtroCat !== GRUPO_CALZADO && !cats.some((c) => c.id === estado.filtroCat)) estado.filtroCat = null;
  if (estado.filtroCat === GRUPO_CALZADO && !nCalzado) estado.filtroCat = null;
  const chipsCat = [chip(conCuenta('Todo', prendas.length), !estado.filtroCat, () => { estado.filtroCat = null; renderArmario(); })];
  cats.forEach((c) => {
    if (c.slot === 'calzado' && !chipsCat.grupo) {
      chipsCat.grupo = true;
      chipsCat.push(chip(conCuenta('Calzado', nCalzado), estado.filtroCat === GRUPO_CALZADO, () => alternar('filtroCat', GRUPO_CALZADO)));
    }
    chipsCat.push(chip(conCuenta(c.plural || c.nombre, cuenta((p) => p.categoria === c.id)), estado.filtroCat === c.id, () => alternar('filtroCat', c.id)));
  });
  $('#filtro-categorias').replaceChildren(...chipsCat);

  // Colores (por nombre de color)
  const colores = NOMBRES_COLOR.filter((n) => prendas.some((p) => p.color && p.color.nombre === n));
  if (estado.filtroColor && !colores.includes(estado.filtroColor)) estado.filtroColor = null;
  $('#filtro-colores').replaceChildren(
    chip('Todos los colores', !estado.filtroColor, () => { estado.filtroColor = null; renderArmario(); }),
    ...colores.map((n) => chip(n, estado.filtroColor === n, () => alternar('filtroColor', n), colorDeNombre(n).hex)));

  // Estampados (solo los que tengo)
  const tipos = TIPOS_ESTAMPADO.filter((t) => prendas.some((p) => estampadoDe(p).tipo === t.id));
  if (estado.filtroEst && !tipos.some((t) => t.id === estado.filtroEst)) estado.filtroEst = null;
  const filaEst = $('#filtro-estampados');
  filaEst.hidden = tipos.length < 2 && !estado.filtroEst; // si todo es liso, no hace falta
  filaEst.replaceChildren(
    chip('Todos los estampados', !estado.filtroEst, () => { estado.filtroEst = null; renderArmario(); }),
    ...tipos.map((t) => chip(conCuenta(t.id === 'otro' ? 'Otros' : t.nombre, cuenta((p) => estampadoDe(p).tipo === t.id)),
      estado.filtroEst === t.id, () => alternar('filtroEst', t.id),
      t.id === 'liso' ? null : fondoEstampado('#8a8d91', { tipo: t.id, color2: '#f5f5f3', tamano: t.id === 'topos' ? 'grandes' : undefined }, { dividido: false }))));

  const visibles = prendas.filter((p) => pasaCat(p, estado.filtroCat) && pasaColor(p, estado.filtroColor) && pasaEst(p, estado.filtroEst));
  const hayFiltros = !!(estado.filtroCat || estado.filtroColor || estado.filtroEst);
  $('#btn-quitar-filtros').hidden = !hayFiltros;
  $('#armario-sin-resultados').hidden = !(prendas.length && !visibles.length);
  $('#contador').textContent = visibles.length === prendas.length
    ? `${prendas.length} ${prendas.length === 1 ? 'prenda' : 'prendas'}`
    : `${visibles.length} de ${prendas.length} prendas`;

  grid.replaceChildren(...visibles.map((p) =>
    h('button', { class: 'item', type: 'button', onclick: () => abrirEdicion(p), 'aria-label': `Editar ${nombrePrenda(p)} ${p.color?.nombre || ''}` },
      imgPrenda(p, { alt: '', loading: 'lazy', decoding: 'async' }),
      h('div', { class: 'meta' },
        h('span', { class: 'name' }, nombrePrenda(p)),
        h('span', { class: 'sub' },
          h('span', { class: 'dot', style: { background: fondoEstampado(p.color?.hex || '#cccccc', p.estampado, { dividido: true }) } }),
          p.color?.nombre || '')),
      (p.etiqueta?.marca || p.etiqueta?.talla)
        ? h('div', { class: 'meta2' }, [p.etiqueta.marca, p.etiqueta.talla && `Talla ${p.etiqueta.talla}`].filter(Boolean).join(' · '))
        : null
    )));
}


/* ================= EDITOR DE PRENDA ================= */
// Se usa tanto para añadir como para editar.
// calcularAuto(balanceActivo): recalcula el color automático (solo al añadir una prenda nueva)
// basico: { id, icono } si la prenda se creó sin foto (se muestra con su ilustración).
// botones: color guardado de botones/cremallera; botonesDetectados: lo encontrado en la foto (null = no se encontró)
function crearEditor({ blob = null, canvas = null, color, categoria = '', estilos = [], etiqueta = null, estampado = null, notaEstampado = '', basico = null, nombrePrenda = '', botones = null, botonesDetectados, modo, calcularAuto = null, onGuardar, onCancelar, onBorrar }) {
  const st = {
    botones: botones || (botonesDetectados && botonesDetectados.hex) || null, // null = automático (parecido al de base)
    modoBoton: false,                 // el próximo toque en la foto coge el color de un botón
    vista: modo === 'editar' ? 'realista' : 'foto', // prendas con foto: «Imagen realista» o «Foto original»
    estampado: normalizarEstampado(estampado),
    estampadoTocado: modo === 'editar',
    color: { hex: color.hex, nombre: color.nombre },
    colorAuto: { hex: color.hex, nombre: color.nombre },
    colorEsAuto: modo !== 'editar' && !basico, // si sigue siendo el automático, se recalcula al cambiar «Fondo blanco»
    balance: color.balance || null,   // resultado del balance de blancos con el fondo
    categoria,
    estilos: new Set(estilos),
    estilosTocados: modo === 'editar' || !!basico,
    categoriaTocada: modo === 'editar' || !!basico,
    nombre: nombrePrenda || '',
    foto: blob,                       // foto actual (puede añadirse después a un básico)
    canvas,
    fotoNueva: false,
    cerrado: false,
  };
  let fotoURL = blob ? URL.createObjectURL(blob) : null;
  const gananciasFoto = () => (st.balance && st.balance.aplicado ? st.balance.ganancias : null);

  // Tocar una imagen (con object-fit: contain) → color medio de esa zona y posición de la marca
  function colorDeToque(e, imgEl, cv, marcaEl, ganancias) {
    const r = imgEl.getBoundingClientRect();
    const esc = Math.min(r.width / cv.width, r.height / cv.height);
    const offX = (r.width - cv.width * esc) / 2, offY = (r.height - cv.height * esc) / 2;
    const x = (e.clientX - r.left - offX) / esc, y = (e.clientY - r.top - offY) / esc;
    if (x < 0 || y < 0 || x >= cv.width || y >= cv.height) return null;
    const c = colorEnPunto(cv, x, y, Math.max(3, Math.round(cv.width / 120)), ganancias);
    const wr = marcaEl.parentElement.getBoundingClientRect();
    marcaEl.style.left = `${e.clientX - wr.left}px`;
    marcaEl.style.top = `${e.clientY - wr.top}px`;
    marcaEl.style.background = c.hex;
    marcaEl.hidden = false;
    return c;
  }

  // Foto (tocar para elegir color; se aplica la misma corrección de blancos que al color automático)
  const marca = h('div', { class: 'picker-mark', hidden: true });
  const img = h('img', { src: fotoURL || '', alt: 'Foto de la prenda', draggable: 'false' });
  const btnAmpliarFoto = h('button', {
    class: 'foto-ampliar', type: 'button', 'aria-label': 'Ver la foto a pantalla completa', title: 'Ver la foto a pantalla completa',
    html: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 4h6v6M10 20H4v-6M20 4l-7 7M4 20l7-7"/></svg>',
    onclick: (e) => { e.stopPropagation(); mostrarFotoGrande(fotoURL, 'Foto de la prenda'); },
  });
  const wrapFoto = h('div', { class: 'photo-wrap' }, img, marca, btnAmpliarFoto,
    h('div', { class: 'photo-hint' }, 'Toca la foto para tomar el color de ese punto'));
  img.addEventListener('click', (e) => {
    if (!st.canvas) return;
    const c = colorDeToque(e, img, st.canvas, marca, gananciasFoto());
    if (!c) return;
    if (st.modoBoton) { st.modoBoton = false; st.sucio = true; ponerBotones(c.hex); toast('Color de los botones: ' + c.nombre); return; }
    if (marcaOtra) marcaOtra.hidden = true;
    ponerColor(c);
  });

  // Sin foto (básico) o en «Imagen realista»: ilustración que se actualiza en directo con el color,
  // el estampado y los botones. Si el tipo tiene imagen realista (prueba), se usa esa.
  const iconoBasico = basico ? basico.icono : categoria;
  const ilustracion = h('div', { class: 'photo-wrap basico-ilus', role: 'img', 'aria-label': 'Ilustración de la prenda' });
  const idRealista = () => realistaDePrenda({ basico, foto: st.foto, categoria: st.categoria });
  const idCatalogo = () => (basico ? basico.id : catalogoDeCategoria(st.categoria)); // para saber si tiene botones
  const svgActual = () => svgPrenda(basico ? iconoBasico : (st.categoria || iconoBasico), st.color.hex, st.estampado, { fondo: false });
  let encargo = 0, temporizadorRealista = null;
  const ponerImagenRealista = (url) => {
    const actual = ilustracion.querySelector('img.realista');
    if (actual) actual.src = url;
    else ilustracion.replaceChildren(h('img', { class: 'realista', src: url, alt: 'Vista realista de la prenda', draggable: 'false' }));
  };
  const pintarIlustracion = () => {
    if (st.foto && st.vista !== 'realista') return;
    const id = idRealista();
    if (!id) { ilustracion.innerHTML = svgActual(); return; }
    const opciones = { base: st.color.hex, estampado: st.estampado, botones: st.botones };
    const hecha = realistaEnCache(id, opciones);
    if (hecha) { ponerImagenRealista(hecha); return; }
    if (!ilustracion.querySelector('img.realista')) ilustracion.innerHTML = svgActual(); // mientras se hace
    const n = ++encargo;
    clearTimeout(temporizadorRealista);
    temporizadorRealista = setTimeout(() => renderRealista(id, opciones)
      .then((url) => { if (n === encargo && !st.cerrado) ponerImagenRealista(url); })
      .catch(() => { if (n === encargo) ilustracion.innerHTML = svgActual(); }), 80);
  };
  // Añadir una foto más tarde (se conservan todos los datos de la prenda)
  const inputFotoGal = h('input', { type: 'file', accept: 'image/*', hidden: true });
  const inputFotoCam = h('input', { type: 'file', accept: 'image/*', capture: 'environment', hidden: true });
  const alAnadirFoto = async (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!file) return;
    try {
      const r = await processPhoto(file);
      if (st.cerrado) return;
      st.foto = r.blob; st.canvas = r.canvas; st.fotoNueva = true;
      if (fotoURL) URL.revokeObjectURL(fotoURL);
      fotoURL = URL.createObjectURL(r.blob);
      img.src = fotoURL;
      montarZonaFoto();
      toast('Foto añadida: se guardará al pulsar «Guardar»');
    } catch { toast('No se pudo abrir la foto'); }
  };
  inputFotoGal.addEventListener('change', alAnadirFoto);
  inputFotoCam.addEventListener('change', alAnadirFoto);
  const zonaFoto = h('div', { class: 'zona-foto' });
  function montarZonaFoto() {
    if (st.foto && idRealista()) {
      // Prenda con foto de un tipo con imagen realista: se puede ver una u otra
      const vista = (v) => h('button', { type: 'button', role: 'radio', 'aria-checked': String(st.vista === v),
        onclick: () => { st.vista = v; if (v === 'realista') st.modoBoton = false; montarZonaFoto(); } }, v === 'realista' ? 'Imagen realista' : 'Ver foto original');
      const conmutador = h('div', { class: 'segmented dos', role: 'radiogroup', 'aria-label': 'Qué imagen ver' }, vista('realista'), vista('foto'));
      if (st.vista === 'realista') { pintarIlustracion(); zonaFoto.replaceChildren(conmutador, ilustracion); }
      else zonaFoto.replaceChildren(conmutador, wrapFoto);
      return;
    }
    if (st.foto) zonaFoto.replaceChildren(wrapFoto);
    else {
      pintarIlustracion();
      zonaFoto.replaceChildren(ilustracion,
        h('div', { class: 'fila-botones anadir-foto' },
          h('label', { class: 'btn mini' }, inputFotoCam, 'Hacer foto'),
          h('label', { class: 'btn mini' }, inputFotoGal, 'Añadir foto de la galería')));
    }
  }

  // Color
  // Muestra del color: al tocarla se ve a pantalla completa para compararla con la prenda
  const swatch = h('button', {
    type: 'button', class: 'swatch ampliable', 'aria-label': 'Ver el color en grande', title: 'Ver el color en grande',
    html: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 4h6v6M10 20H4v-6M20 4l-7 7M4 20l7-7"/></svg>',
    onclick: () => mostrarColorGrande(st.color.hex, st.color.nombre),
  });
  const nombre = h('div', { class: 'color-name' });
  // Código HEX escrito a mano (con o sin #, de 3 o 6 dígitos)
  const hex = h('input', {
    type: 'text', class: 'hex-input', maxlength: '7', spellcheck: 'false', autocomplete: 'off',
    autocapitalize: 'characters', inputmode: 'text', 'aria-label': 'Código de color HEX', placeholder: '#000000',
  });
  const leerHex = (texto) => {
    const v = texto.trim().replace(/^#/, '');
    return /^([0-9a-f]{3}|[0-9a-f]{6})$/i.test(v) ? '#' + v : null;
  };
  hex.addEventListener('input', () => {
    const valor = leerHex(hex.value);
    hex.classList.toggle('invalid', !valor && hex.value.trim() !== '');
    if (valor) { quitarMarcas(); ponerColor(describirColor(valor), { desdeTeclado: true }); }
  });
  hex.addEventListener('blur', () => { hex.classList.remove('invalid'); hex.value = st.color.hex.toUpperCase(); });
  hex.addEventListener('keydown', (e) => { if (e.key === 'Enter') hex.blur(); });

  // Rueda de color fina («Ajuste avanzado»)
  const inputColor = h('input', { type: 'color', 'aria-label': 'Ajuste avanzado del color' });
  inputColor.addEventListener('input', () => { quitarMarcas(); ponerColor(describirColor(inputColor.value)); });
  // «Automático» solo tiene sentido si el color salió de la foto
  const btnAuto = blob
    ? h('button', { class: 'btn', type: 'button', onclick: () => { quitarMarcas(); ponerColor(st.colorAuto, { auto: true }); } }, 'Automático')
    : null;

  // Paleta de muestras por familias (de claro a oscuro)
  const paleta = crearPaleta({ onElegir: (t) => { quitarMarcas(); ponerColor(describirColor(t)); } });
  // Al crear un básico la paleta se abre directamente (es la forma principal de elegir el color)
  const paletaAbierta = !!basico && modo === 'nuevo';
  const panelPaleta = h('div', { class: 'paleta-panel', hidden: !paletaAbierta },
    paleta.el,
    h('label', { class: 'btn mini avanzado' }, 'Ajuste avanzado', inputColor));
  const btnPaleta = h('button', { class: 'btn', type: 'button', 'aria-expanded': String(paletaAbierta) }, 'Paleta');
  // Abrir la paleta es un paso: «atrás» la cierra sin salir del editor
  let capaPaleta = null;
  const ocultarPaleta = () => { panelPaleta.hidden = true; btnPaleta.setAttribute('aria-expanded', 'false'); capaPaleta = null; };
  btnPaleta.addEventListener('click', () => {
    if (panelPaleta.hidden) {
      panelPaleta.hidden = false;
      btnPaleta.setAttribute('aria-expanded', 'true');
      capaPaleta = abrirCapa({ cerrar: ocultarPaleta });
    } else {
      const c = capaPaleta;
      ocultarPaleta();
      if (c) cerrarCapa(c);
    }
  });

  // «Sacar color de otra imagen» (p. ej. la foto de la tienda): solo para elegir el color, no se guarda
  const inputOtra = h('input', { type: 'file', accept: 'image/*', hidden: true });
  const btnOtra = h('label', { class: 'btn' }, inputOtra, 'Otra imagen');
  const panelOtra = h('div', { class: 'otra-imagen', hidden: true });
  let otraURL = null, marcaOtra = null, capaOtra = null;
  const liberarOtra = () => {
    if (otraURL) URL.revokeObjectURL(otraURL);
    otraURL = null; marcaOtra = null;
    panelOtra.replaceChildren();
    panelOtra.hidden = true;
    const c = capaOtra;
    capaOtra = null;
    if (c && capaAbierta(c)) cerrarCapa(c); // si se cierra con su botón, se quita del historial
  };
  inputOtra.addEventListener('change', async (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!file) return;
    let cv;
    try { cv = await blobToCanvas(file, 1200); } catch { toast('No se pudo abrir la imagen'); return; }
    if (st.cerrado) return;
    liberarOtra();
    otraURL = URL.createObjectURL(file);
    marcaOtra = h('div', { class: 'picker-mark', hidden: true });
    const imgOtra = h('img', { src: otraURL, alt: 'Imagen de referencia para el color', draggable: 'false' });
    imgOtra.addEventListener('click', (ev) => {
      const c = colorDeToque(ev, imgOtra, cv, marcaOtra, null); // foto de tienda: sin corrección
      if (c) { marca.hidden = true; ponerColor(c); }
    });
    panelOtra.replaceChildren(
      h('div', { class: 'otra-cab' },
        h('span', {}, 'Imagen de referencia · no se guarda'),
        h('button', { class: 'link-btn', type: 'button', onclick: liberarOtra }, 'Cerrar')),
      h('div', { class: 'photo-wrap otra' }, imgOtra, marcaOtra,
        h('div', { class: 'photo-hint' }, 'Toca para coger el color de ese punto')));
    panelOtra.hidden = false;
    // «atrás» cierra la imagen de referencia sin salir del editor
    capaOtra = abrirCapa({ cerrar: () => { capaOtra = null; liberarOtra(); } });
  });
  const quitarMarcas = () => { marca.hidden = true; if (marcaOtra) marcaOtra.hidden = true; };

  // «Fondo blanco»: balance de blancos con el fondo (solo al añadir una prenda)
  let cajaBalance = null;
  if (calcularAuto) {
    const swBalance = h('input', { type: 'checkbox', class: 'switch', 'aria-label': 'Fondo blanco: corregir el color usando el fondo' });
    swBalance.checked = !!st.balance;
    const info = h('p', { class: 'balance-info' });
    const pintarBalance = () => {
      const b = st.balance;
      let texto = 'Sin corrección: se usa el color tal y como sale en la foto.', aviso = false;
      if (swBalance.checked && b && b.aplicado) texto = 'Color corregido usando el fondo como referencia de blanco.';
      else if (swBalance.checked && b && b.motivo === 'oscuro') { texto = 'El fondo es oscuro, así que no se ha corregido el color. Para corregirlo, haz la foto sobre un fondo blanco.'; aviso = true; }
      else if (swBalance.checked && b) { texto = 'El fondo tiene color, así que no se ha corregido. Para corregirlo, haz la foto sobre un fondo blanco.'; aviso = true; }
      info.textContent = texto;
      info.classList.toggle('warn', aviso);
    };
    swBalance.addEventListener('change', () => {
      guardarPref('fondoBlanco', String(swBalance.checked));
      const nuevo = calcularAuto(swBalance.checked);
      st.balance = nuevo.balance || null;
      st.colorAuto = { hex: nuevo.hex, nombre: nuevo.nombre };
      if (st.colorEsAuto) { quitarMarcas(); ponerColor(st.colorAuto, { auto: true }); }
      // Si no se ha tocado el estampado, se vuelve a sugerir con el color corregido
      if (!st.estampadoTocado && nuevo.estampado) {
        st.estampado = normalizarEstampado(nuevo.estampado);
        editorEst.setValor(st.estampado, textoSugerencia(nuevo.estampado));
        pintarMuestra();
      }
      pintarBalance();
    });
    pintarBalance();
    cajaBalance = h('div', { class: 'balance' },
      h('label', { class: 'switch-row' }, h('span', {}, 'Fondo blanco'), swBalance), info);
  }

  let editorEst = null; // se crea más abajo (necesita el color inicial)
  // La muestra enseña el estampado dibujado si la prenda no es lisa
  const pintarMuestra = () => { swatch.style.background = fondoEstampado(st.color.hex, st.estampado); pintarIlustracion(); };

  let colorIniciado = false;
  function ponerColor(c, { desdeTeclado = false, auto = false } = {}) {
    if (colorIniciado && !auto) st.sucio = true; // un color elegido a mano es un cambio
    st.color = { hex: c.hex, nombre: c.nombre };
    st.colorEsAuto = auto;
    pintarMuestra();
    nombre.textContent = c.nombre;
    if (!desdeTeclado) { hex.value = c.hex.toUpperCase(); hex.classList.remove('invalid'); }
    inputColor.value = c.hex;
    paleta.marcar(c.hex);
    if (editorEst) editorEst.setBase(c.hex);
    if (colorIniciado) pintarBotones();
  }
  ponerColor(st.color, { auto: st.colorEsAuto });
  colorIniciado = true;

  // Estampado (editor reutilizable; el color de arriba es el color de base)
  editorEst = crearEditorEstampado({
    base: st.color.hex,
    valor: st.estampado,
    onCambio: (v) => { st.estampado = v; st.estampadoTocado = true; st.sucio = true; pintarMuestra(); },
  });
  if (notaEstampado) editorEst.setValor(st.estampado, notaEstampado);

  // Botones / cremallera (solo en prendas que los tienen). Por defecto, un tono parecido al de base.
  const tarjetaBotones = h('div', { class: 'card botones-card', hidden: true });
  const paletaBotones = crearPaleta({ onElegir: (hex) => { st.sucio = true; ponerBotones(hex); } });
  const panelBotones = h('div', { class: 'paleta-panel', hidden: true }, paletaBotones.el);
  function ponerBotones(hex) {
    st.botones = hex;
    pintarBotones();
    pintarIlustracion();
  }
  function pintarBotones() {
    const id = idCatalogo();
    const visible = tieneCierre(id);
    tarjetaBotones.hidden = !visible;
    if (!visible) return;
    const cremallera = tieneCremallera(id);
    const efectivo = st.botones || botonesPorDefecto(st.color.hex);
    paletaBotones.marcar(st.botones);
    // En una prenda nueva con foto, si no se encontraron los botones con seguridad, se pide tocarlos
    const sinDetectar = !!st.foto && modo === 'nuevo' && botonesDetectados === null && !st.botones;
    tarjetaBotones.replaceChildren(...[
      h('p', { class: 'field-label' }, cremallera ? 'Cremallera' : 'Botones'),
      h('div', { class: 'color-row' },
        h('span', { class: 'swatch botones-muestra', style: { background: efectivo } }),
        h('div', { class: 'color-info' },
          h('div', { class: 'color-name' }, describirColor(efectivo).nombre),
          h('div', { class: 'muted small' }, st.botones
            ? (botonesDetectados && botonesDetectados.hex === st.botones ? 'Detectado en la foto' : 'Elegido a mano')
            : 'Automático: un tono parecido al de la prenda'))),
      sinDetectar ? h('p', { class: 'botones-aviso' }, 'No he encontrado los botones con seguridad. Toca «Tocar en la foto» y luego un botón para coger su color.') : null,
      h('div', { class: 'color-actions' },
        h('button', { class: 'btn', type: 'button', onclick: () => { panelBotones.hidden = !panelBotones.hidden; } }, 'Paleta'),
        st.foto ? h('button', { class: 'btn' + (st.modoBoton ? ' activo' : ''), type: 'button', onclick: () => {
          st.modoBoton = true; st.vista = 'foto'; montarZonaFoto(); pintarBotones();
          toast('Toca un botón en la foto'); zonaFoto.scrollIntoView({ behavior: 'smooth', block: 'center' });
        } }, 'Tocar en la foto') : null,
        h('button', { class: 'btn', type: 'button', onclick: () => { st.sucio = true; ponerBotones(null); } }, 'Automático')),
      panelBotones,
    ].filter(Boolean));
  }

  // Categoría
  const select = h('select', { 'aria-label': 'Categoría' },
    h('option', { value: '', disabled: true }, 'Elige una categoría…'),
    ...CATEGORIAS.map((c) => h('option', { value: c.id }, c.nombre)));
  select.value = st.categoria || '';
  const aiEstado = h('div', { class: 'ai-status' });
  select.addEventListener('change', () => {
    st.categoria = select.value;
    montarZonaFoto();
    pintarBotones();
    st.categoriaTocada = true;
    select.classList.remove('needs-choice');
    if (!st.estilosTocados) { st.estilos = new Set(estilosPorDefecto(st.categoria)); pintarEstilos(); }
  });

  // Estilos
  const chipsEstilo = h('div', { class: 'chips' });
  function pintarEstilos() {
    chipsEstilo.replaceChildren(...ESTILOS.map((e) => chip(e.nombre, st.estilos.has(e.id), () => {
      st.estilosTocados = true;
      st.estilos.has(e.id) ? st.estilos.delete(e.id) : st.estilos.add(e.id);
      pintarEstilos();
    })));
  }
  pintarEstilos();

  // Etiqueta de la prenda (OCR): marca, talla, composición, origen y cuidados
  const et = { marca: '', talla: '', composicion: '', origen: '', cuidados: [], texto: '', ...(etiqueta || {}) };
  const hayDatos = () => !!(et.marca || et.talla || et.composicion || et.origen || et.cuidados.length);
  const campos = {};
  const campo = (id, texto, ph, ancho = false) => {
    const valor = id === 'cuidados' ? et.cuidados.join(', ') : et[id];
    const input = h('input', { type: 'text', value: valor || '', placeholder: ph, autocomplete: 'off', autocapitalize: 'sentences' });
    input.addEventListener('input', () => {
      if (id === 'cuidados') et.cuidados = input.value.split(',').map((s) => s.trim()).filter(Boolean);
      else et[id] = input.value;
    });
    campos[id] = input;
    return h('label', { class: 'field' + (ancho ? ' wide' : '') }, h('span', {}, texto), input);
  };
  const cajaCampos = h('div', { class: 'fields', hidden: !hayDatos() },
    campo('marca', 'Marca', 'Ej. Zara'),
    campo('talla', 'Talla', 'Ej. M o 40'),
    campo('composicion', 'Composición', 'Ej. 100% algodón', true),
    campo('origen', 'Fabricado en', 'Ej. Portugal'),
    campo('cuidados', 'Cuidados', 'Ej. Lavar a 30 °C', true));
  const textoLeido = h('pre', { class: 'ocr-text' }, et.texto);
  const detalles = h('details', { class: 'ocr', hidden: !et.texto }, h('summary', {}, 'Ver texto leído'), textoLeido);
  const etEstado = h('div', { class: 'ai-status' });
  const btnManual = h('button', { class: 'link-btn', type: 'button', hidden: hayDatos() }, 'O escribir los datos a mano');
  btnManual.addEventListener('click', () => { cajaCampos.hidden = false; btnManual.hidden = true; campos.marca.focus(); });
  const estadoEt = (tipo, texto) => {
    etEstado.className = 'ai-status' + (tipo === 'warn' ? ' warn' : '');
    etEstado.replaceChildren(...(tipo === 'cargando' ? [h('span', { class: 'spinner' })] : []), texto || '');
  };
  const inputEtCam = h('input', { type: 'file', accept: 'image/*', capture: 'environment', hidden: true });
  const inputEtGal = h('input', { type: 'file', accept: 'image/*', hidden: true });
  const btnEtCam = h('label', { class: 'btn' }, inputEtCam, 'Escanear etiqueta');
  const btnEtGal = h('label', { class: 'btn' }, inputEtGal, 'Desde galería');
  async function escanearEtiqueta(e) {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!file) return;
    [btnEtCam, btnEtGal].forEach((b) => b.setAttribute('disabled', ''));
    estadoEt('cargando', 'Preparando la foto…');
    try {
      const cv = await blobToCanvas(file, 2000);
      const { leerEtiqueta } = await import('./label.js');
      const r = await leerEtiqueta(cv, (msg) => { if (!st.cerrado) estadoEt('cargando', msg); });
      if (st.cerrado) return;
      // Solo se rellenan los datos detectados; no se borra lo que ya hubiera
      for (const k of ['marca', 'talla', 'composicion', 'origen']) if (r[k]) { et[k] = r[k]; campos[k].value = r[k]; }
      if (r.cuidados.length) { et.cuidados = r.cuidados; campos.cuidados.value = r.cuidados.join(', '); }
      et.texto = r.texto;
      textoLeido.textContent = r.texto;
      detalles.hidden = !r.texto;
      cajaCampos.hidden = false;
      btnManual.hidden = true;
      const n = ['marca', 'talla', 'composicion', 'origen'].filter((k) => r[k]).length + (r.cuidados.length ? 1 : 0);
      if (!r.texto) estadoEt('warn', 'No he podido leer texto. Prueba con más luz, la etiqueta estirada y bien enfocada.');
      else if (!n) estadoEt('warn', 'He leído texto pero no reconozco los datos. Mira el texto leído y rellénalos a mano.');
      else estadoEt('ok', `He encontrado ${n} ${n === 1 ? 'dato' : 'datos'} en la etiqueta. Revísalos por si hay algún error.`);
    } catch (err) {
      console.warn(err);
      if (!st.cerrado) estadoEt('warn', 'No se pudo leer la etiqueta (la primera vez necesita conexión).');
    } finally {
      [btnEtCam, btnEtGal].forEach((b) => b.removeAttribute('disabled'));
    }
  }
  inputEtCam.addEventListener('change', escanearEtiqueta);
  inputEtGal.addEventListener('change', escanearEtiqueta);
  const datosEtiqueta = () => {
    const limpio = {
      marca: et.marca.trim(), talla: et.talla.trim(), composicion: et.composicion.trim(),
      origen: et.origen.trim(), cuidados: et.cuidados, texto: et.texto,
    };
    return hayDatos() || et.texto ? limpio : null;
  };

  // Acciones
  const btnGuardar = h('button', { class: 'btn primary', type: 'button' }, modo === 'editar' ? 'Guardar cambios' : 'Guardar prenda');
  btnGuardar.addEventListener('click', async () => {
    if (!st.categoria) { select.classList.add('needs-choice'); select.focus(); toast('Elige la categoría de la prenda'); return; }
    if (!st.estilos.size) { toast('Marca al menos un estilo'); return; }
    btnGuardar.disabled = true;
    try {
      await onGuardar({
        categoria: st.categoria, color: st.color, estampado: normalizarEstampado(st.estampado),
        estilos: [...st.estilos], etiqueta: datosEtiqueta(), nombre: st.nombre.trim() || null,
        botones: tieneCierre(idCatalogo()) ? (st.botones || null) : null,
        ...(st.fotoNueva ? { foto: st.foto } : {}),
      });
      destruir();
    } catch (e) {
      console.error(e);
      toast('No se pudo guardar: ' + e.message);
      btnGuardar.disabled = false;
    }
  });
  const acciones = h('div', { class: 'editor-actions' }, btnGuardar,
    h('button', { class: 'btn', type: 'button', onclick: () => { if (onCancelar) onCancelar(); else destruir(); } }, 'Cancelar'),
    onBorrar ? h('button', { class: 'btn danger', type: 'button', onclick: () => onBorrar(destruir) }, 'Borrar prenda') : null);

  // Nombre (opcional; los básicos lo traen relleno)
  const campoNombre = h('input', { type: 'text', value: st.nombre, placeholder: 'Ej. Camisa oxford', autocomplete: 'off', 'aria-label': 'Nombre de la prenda' });
  campoNombre.addEventListener('input', () => { st.nombre = campoNombre.value; });

  montarZonaFoto();
  pintarBotones();
  const el = h('div', { class: 'editor' },
    zonaFoto,
    h('div', { class: 'card' },
      h('p', { class: 'field-label' }, 'Color de base'),
      h('div', { class: 'color-row' }, swatch, h('div', { class: 'color-info' }, nombre,
        h('label', { class: 'hex-field' }, h('span', {}, 'Código'), hex))),
      cajaBalance,
      h('div', { class: 'color-actions' }, btnPaleta, btnOtra, btnAuto),
      panelPaleta,
      panelOtra),
    h('div', { class: 'card' },
      h('p', { class: 'field-label' }, 'Estampado'),
      editorEst.el),
    tarjetaBotones,
    h('div', { class: 'card' },
      h('p', { class: 'field-label' }, 'Categoría'),
      select, aiEstado,
      h('label', { class: 'field wide nombre-prenda' }, h('span', {}, 'Nombre (opcional)'), campoNombre)),
    h('div', { class: 'card' },
      h('p', { class: 'field-label' }, 'Estilo'),
      chipsEstilo),
    h('div', { class: 'card' },
      h('p', { class: 'field-label' }, 'Etiqueta ', h('span', { class: 'opt' }, '(opcional)')),
      h('p', { class: 'muted small hint' }, 'Haz una foto de la etiqueta interior para guardar la marca, la talla y la composición.'),
      h('div', { class: 'label-actions' }, btnEtCam, btnEtGal),
      etEstado, btnManual, cajaCampos, detalles),
    acciones);

  function destruir() {
    if (st.cerrado) return;
    st.cerrado = true;
    if (fotoURL) URL.revokeObjectURL(fotoURL);
    liberarOtra();
  }

  function setEstado(tipo, texto) {
    if (st.cerrado) return;
    aiEstado.className = 'ai-status' + (tipo === 'warn' ? ' warn' : '');
    aiEstado.replaceChildren(...(tipo === 'cargando' ? [h('span', { class: 'spinner' })] : []), texto || '');
  }

  function setClasificacion(res) {
    if (st.cerrado) return;
    if (st.categoriaTocada) { setEstado('ok', res.categoria ? `La app sugería: ${nombreCategoria(res.categoria)}.` : ''); return; }
    if (res.segura) {
      st.categoria = res.categoria;
      select.value = res.categoria;
      montarZonaFoto();
      pintarBotones();
      if (!st.estilosTocados) { st.estilos = new Set(estilosPorDefecto(res.categoria)); pintarEstilos(); }
      setEstado('ok', `Sugerido: ${nombreCategoria(res.categoria)} (${Math.round(res.confianza * 100)} % de confianza). Puedes cambiarlo.`);
    } else {
      select.value = '';
      select.classList.add('needs-choice');
      const pista = res.categoria ? ` ¿Quizá ${nombreCategoria(res.categoria).toLowerCase()}?` : '';
      setEstado('warn', `No estoy seguro de qué prenda es.${pista} Elige la categoría.`);
    }
  }

  // ¿Hay algo sin guardar? Al añadir con foto siempre (la foto se perdería); si no, cualquier cambio
  // (abrir la paleta o elegir una imagen de referencia no cuenta como cambio)
  el.addEventListener('input', (e) => { if (e.target.type !== 'file') st.sucio = true; });
  el.addEventListener('change', (e) => { if (e.target.type !== 'file') st.sucio = true; });
  el.addEventListener('click', (e) => {
    if (e.target.closest('.pal-tono, .chip, .est-editor .link-btn, .photo-wrap img')) st.sucio = true;
  });
  st.sucio = modo === 'nuevo' && !!blob;
  const hayCambios = () => !st.cerrado && (st.sucio || st.fotoNueva);

  return { el, setEstado, setClasificacion, destruir, hayCambios, get cerrado() { return st.cerrado; } };
}

/* ================= AÑADIR ================= */
let editorNuevo = null;

function reiniciarAnadir() {
  if (editorNuevo) editorNuevo.destruir();
  editorNuevo = null;
  $('#anadir-editor').replaceChildren();
  $('#anadir-inicio').hidden = false;
  $('#fondo-blanco').checked = leerPref('fondoBlanco', 'true') === 'true';
}

async function alElegirFoto(e) {
  const input = e.target;
  const file = input.files && input.files[0];
  input.value = '';
  if (!file) return;
  reiniciarAnadir();
  $('#anadir-inicio').hidden = true;
  const host = $('#anadir-editor');
  host.replaceChildren(h('div', { class: 'card' }, h('div', { class: 'ai-status' }, h('span', { class: 'spinner' }), 'Preparando la foto…')));

  // Color de base + sugerencia de estampado (dos colores grandes, rayas, cuadros…)
  const analizar = (balanceBlancos) => {
    const c = extraerColorDominante(canvas, { balanceBlancos });
    let estampado = { tipo: 'liso' };
    try { estampado = detectarEstampado(canvas, c); } catch (e) { console.warn('Detección de estampado', e); }
    return { ...c, estampado };
  };
  let canvas, blob, color;
  try {
    ({ canvas, blob } = await processPhoto(file));
    color = analizar(leerPref('fondoBlanco', 'true') === 'true');
    // Botones en la foto (para camisas): manchas pequeñas y redondeadas en la línea central
    try { color.botonesDetectados = detectarBotonesEnFoto(canvas, color); } catch (e) { color.botonesDetectados = null; }
  } catch (err) {
    console.error(err);
    toast('No se pudo procesar la foto');
    reiniciarAnadir();
    return;
  }

  const ed = crearEditor({
    blob, canvas, color, modo: 'nuevo',
    estampado: color.estampado,
    notaEstampado: textoSugerencia(color.estampado),
    botonesDetectados: color.botonesDetectados,
    calcularAuto: analizar,
    onGuardar: async (datos) => {
      await db.put('prendas', { id: db.uid(), foto: blob, ...datos, creada: Date.now() });
      await recargarDatos();
      toast('Prenda guardada');
      irAlArmarioTrasGuardar();
    },
    onCancelar: () => cerrarConPregunta(capaEd),
  });
  editorNuevo = ed;
  host.replaceChildren(ed.el);
  // Paso «editor de la prenda»: atrás vuelve al inicio de Añadir (preguntando si hay cambios)
  const capaEd = abrirCapa({
    cerrar: () => { ed.destruir(); if (editorNuevo === ed) editorNuevo = null; reiniciarAnadir(); },
    antesDeCerrar: () => !ed.hayCambios() || confirmarDescartar(),
  });

  // Clasificación automática (no bloquea: se puede elegir la categoría mientras tanto)
  ed.setEstado('cargando', 'Cargando el clasificador…');
  import('./classifier.js')
    .then(({ clasificar }) => clasificar(canvas, (msg) => ed.setEstado('cargando', msg)))
    .then((res) => ed.setClasificacion(res))
    .catch((err) => {
      console.warn(err);
      ed.setEstado('warn', 'No se pudo clasificar automáticamente (¿sin conexión la primera vez?). Elige la categoría.');
    });
}

/* ================= AÑADIR BÁSICO (SIN FOTO) ================= */
// Miniatura de un básico en el catálogo: imagen realista (prueba) si está activada; si no, su dibujo
function miniaturaBasico(b) {
  const el = h('span', { class: 'basico-mini', html: svgPrenda(b.icono, b.color, null, { fondo: false }) });
  const id = realistaDeBasico(b.id);
  if (id) {
    renderRealista(id, { base: b.color, estampado: null, botones: null })
      .then((url) => el.replaceChildren(h('img', { src: url, alt: '', class: 'realista' })))
      .catch(() => {});
  }
  return el;
}

// Paso «elegir tipo de básico». nuevo=false cuando se vuelve a él desde el editor (ya está en el historial)
function mostrarCatalogoBasicos({ nuevo = true } = {}) {
  reiniciarAnadir();
  $('#anadir-inicio').hidden = true;
  if (nuevo) abrirCapa({ cerrar: () => reiniciarAnadir() });
  $('#anadir-editor').replaceChildren(
    h('div', { class: 'catalogo-cab' },
      h('h2', { class: 'section-title' }, 'Elige un básico'),
      h('button', { class: 'link-btn', type: 'button', onclick: () => atras() }, 'Volver')),
    h('p', { class: 'muted small' }, 'Después eliges su color y, si quieres, el estampado.'),
    ...gruposBasicos(generoPreferido()).map((g) => h('section', { class: 'catalogo-grupo' },
      h('h3', { class: 'sub-title' }, g.nombre),
      h('div', { class: 'catalogo' }, ...g.basicos.map((b) =>
        h('button', { class: 'basico-card', type: 'button', onclick: () => editarBasicoNuevo(b) },
          miniaturaBasico(b),
          h('span', { class: 'basico-nombre' }, b.nombre),
          // Con «Ambos», se indica el corte de las prendas que tienen versión de mujer y de hombre
          generoPreferido() === 'ambos' && b.genero !== 'unisex' ? h('span', { class: 'basico-genero' }, NOMBRE_GENERO[b.genero]) : null))))));
  window.scrollTo(0, 0);
}

function editarBasicoNuevo(b) {
  const host = $('#anadir-editor');
  let capaEd = null;
  const volver = () => cerrarConPregunta(capaEd);
  const ed = crearEditor({
    basico: { id: b.id, icono: b.icono },
    nombrePrenda: b.nombre,
    color: describirColor(b.color),
    categoria: b.categoria,
    estilos: b.estilos,
    modo: 'nuevo',
    onGuardar: async (datos) => {
      await db.put('prendas', { id: db.uid(), foto: null, basico: { id: b.id, icono: b.icono }, ...datos, creada: Date.now() });
      await recargarDatos();
      toast('Prenda guardada');
      irAlArmarioTrasGuardar();
    },
    onCancelar: volver,
  });
  editorNuevo = ed;
  host.replaceChildren(
    h('button', { class: 'link-btn volver-catalogo', type: 'button', onclick: volver }, '← Elegir otro básico'),
    ed.el);
  window.scrollTo(0, 0);
  // Paso «editor del básico»: atrás vuelve al catálogo (preguntando si hay cambios)
  capaEd = abrirCapa({
    cerrar: () => { ed.destruir(); if (editorNuevo === ed) editorNuevo = null; mostrarCatalogoBasicos({ nuevo: false }); },
    antesDeCerrar: () => !ed.hayCambios() || confirmarDescartar(),
  });
}

// Tras guardar una prenda nueva: se cierran los pasos de Añadir y se vuelve al Armario
function irAlArmarioTrasGuardar() {
  editorNuevo = null;
  volverAlInicio();
  reiniciarAnadir();
  if (tabActual() !== 'armario') irATab('armario');
}

/* ================= EDITAR ================= */
async function abrirEdicion(prenda) {
  const dlg = $('#dlg-editar');
  let canvas = null;
  if (prenda.foto) {
    try { canvas = await blobToCanvas(prenda.foto, 800); } catch { toast('No se pudo abrir la foto'); return; }
  }
  const cerrar = () => cerrarConPregunta(dlg.capaNav); // cierra la ventana entera, preguntando si hay cambios
  const ed = crearEditor({
    blob: prenda.foto || null, canvas, modo: 'editar',
    basico: prenda.basico || null,
    nombrePrenda: prenda.nombre || '',
    color: prenda.color || { hex: '#cccccc', nombre: 'gris claro' },
    categoria: prenda.categoria,
    estilos: prenda.estilos || [],
    etiqueta: prenda.etiqueta,
    estampado: estampadoDe(prenda),
    botones: prenda.botones || null,
    onGuardar: async (datos) => {
      await db.put('prendas', { ...prenda, ...datos, actualizada: Date.now() });
      await recargarDatos();
      dlg.close();
      toast('Cambios guardados');
      renderArmario();
    },
    onCancelar: () => cerrarConPregunta(dlg.capaNav),
    onBorrar: async (destruir) => {
      if (!confirm('¿Borrar esta prenda? No se puede deshacer.')) return;
      await db.remove('prendas', prenda.id);
      liberarFoto(prenda.id);
      await recargarDatos();
      destruir();
      dlg.close();
      toast('Prenda borrada');
      if (estado.outfitActual && estado.outfitActual.prendas.some((p) => p.id === prenda.id)) estado.outfitActual = null;
      renderArmario();
    },
  });
  dlg.replaceChildren(
    h('div', { class: 'sheet-head' },
      h('h2', {}, 'Editar prenda'),
      h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Cerrar', html: ICONOS.cerrar, onclick: cerrar })),
    ed.el);
  dlg.onclose = () => ed.destruir();
  // Ventana «editar prenda»: atrás la cierra (preguntando si hay cambios sin guardar)
  abrirDialogo(dlg, { antesDeCerrar: () => !ed.hayCambios() || confirmarDescartar() });
  dlg.scrollTop = 0;
}

/* ================= OUTFITS ================= */
function renderOutfits() {
  document.querySelectorAll('#selector-estilo button').forEach((b) =>
    b.setAttribute('aria-checked', String(b.dataset.estilo === estado.estiloOutfit)));
  $('#incluir-abrigo').checked = estado.incluirAbrigo;
  pintarOutfit();
  pintarFavoritos();
}

function generar(evitarActual = false) {
  if (!estado.prendas.length) {
    estado.outfitActual = { error: 'Primero añade algunas prendas a tu armario.' };
  } else {
    estado.outfitActual = generarOutfit(estado.prendas, estado.estiloOutfit, {
      incluirAbrigo: estado.incluirAbrigo,
      evitar: evitarActual && estado.outfitActual ? estado.outfitActual.clave : null,
    });
  }
  pintarOutfit();
  verOutfitComoPaso();
}

// Ver un outfit es un paso: «atrás» lo oculta (los «Otro» siguientes no añaden más pasos)
let capaOutfit = null;
function verOutfitComoPaso() {
  if (!estado.outfitActual || estado.outfitActual.error) return;
  if (capaOutfit && capaAbierta(capaOutfit)) return;
  capaOutfit = abrirCapa({ cerrar: () => { capaOutfit = null; estado.outfitActual = null; pintarOutfit(); } });
}

function favoritoDe(clave) { return estado.favoritos.find((f) => claveOutfit(f.ids) === clave); }

function pintarOutfit() {
  const host = $('#outfit-resultado');
  const o = estado.outfitActual;
  if (!o) { host.replaceChildren(); return; }
  if (o.error) { host.replaceChildren(h('div', { class: 'notice' }, o.error)); return; }

  const fav = favoritoDe(o.clave);
  const btnFav = h('button', { class: 'btn fav', type: 'button', 'aria-pressed': String(!!fav) }, fav ? 'Guardado' : 'Guardar');
  btnFav.addEventListener('click', () => alternarFavorito(o));
  const btnOtro = h('button', { class: 'btn primary', type: 'button', onclick: () => generar(true) }, 'Otro outfit');

  // Maniquí a todo el ancho → por qué combina → prendas sueltas → botones
  host.replaceChildren(h('div', { class: 'card outfit' },
    crearManiqui(piezasDePrendas(o.prendas), { estilo: o.estilo, titulo: 'Outfit en el maniquí' }),
    h('p', { class: 'outfit-why' }, o.frase),
    h('div', { class: `outfit-pieces n${o.prendas.length}` },
      ...o.prendas.map((p) => h('div', { class: 'piece' },
        imgPrenda(p, { alt: `${nombreCategoria(p.categoria)} ${p.color.nombre}` }),
        h('span', { class: 'tag' }, h('span', { class: 'dot', style: { background: fondoEstampado(p.color.hex, p.estampado, { dividido: true }) } }), nombreCategoria(p.categoria))))),
    h('div', { class: 'palette', 'aria-hidden': 'true' }, ...o.prendas.map((p) => h('span', { style: { background: fondoEstampado(p.color.hex, p.estampado) }, title: p.color.nombre }))),
    o.aviso ? h('p', { class: 'muted small' }, o.aviso) : null,
    h('div', { class: 'outfit-actions' }, btnOtro, btnFav)));
}

async function alternarFavorito(o) {
  const fav = favoritoDe(o.clave);
  if (fav) {
    await db.remove('outfits', fav.id);
    toast('Quitado de favoritos');
  } else {
    await db.put('outfits', { id: db.uid(), ids: o.prendas.map((p) => p.id), estilo: o.estilo, frase: o.frase, fecha: Date.now() });
    toast('Guardado en favoritos');
  }
  await recargarDatos();
  pintarOutfit();
  pintarFavoritos();
}

function pintarFavoritos() {
  const host = $('#favoritos');
  if (!estado.favoritos.length) {
    host.replaceChildren(h('p', { class: 'muted' }, 'Aún no tienes outfits guardados. Genera uno y pulsa «Guardar».'));
    return;
  }
  const porId = new Map(estado.prendas.map((p) => [p.id, p]));
  host.replaceChildren(...estado.favoritos.map((f) => {
    const prendas = f.ids.map((id) => porId.get(id)).filter(Boolean);
    const incompleto = prendas.length < f.ids.length;
    const fecha = new Date(f.fecha).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
    const borrar = h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Quitar de favoritos', html: ICONOS.papelera });
    borrar.addEventListener('click', async (e) => {
      e.stopPropagation();
      await db.remove('outfits', f.id);
      await recargarDatos();
      pintarFavoritos();
      pintarOutfit();
    });
    const fila = h('div', { class: 'fav-row', role: 'button', tabindex: '0' },
      h('div', { class: 'fav-thumbs' }, ...prendas.map((p) => imgPrenda(p, { alt: '' }))),
      h('div', { class: 'fav-text' },
        h('strong', {}, `${ESTILOS_OUTFIT[f.estilo]?.nombre || ''} · ${fecha}`),
        h('span', {}, incompleto ? 'Alguna prenda ya no está en tu armario' : f.frase)),
      borrar);
    const ver = () => {
      if (!prendas.length) return;
      estado.outfitActual = { prendas, clave: claveOutfit(f.ids), estilo: f.estilo, frase: f.frase, aviso: incompleto ? 'Alguna prenda de este outfit se ha borrado.' : '' };
      pintarOutfit();
      verOutfitComoPaso();
      $('#outfit-resultado').scrollIntoView({ behavior: 'smooth', block: 'start' });
    };
    fila.addEventListener('click', ver);
    fila.addEventListener('keydown', (e) => { if (e.key === 'Enter') ver(); });
    return fila;
  }));
}

/* ================= COPIA DE SEGURIDAD ================= */
async function abrirAjustes() {
  const dlg = $('#dlg-ajustes');
  let info = `${estado.prendas.length} prendas · ${estado.favoritos.length} outfits favoritos`;
  try {
    const est = await navigator.storage.estimate();
    info += ` · ${(est.usage / 1048576).toFixed(1)} MB usados`;
  } catch { /* sin soporte */ }
  const version = await versionInstalada();
  if (version) info += ` · Versión ${version}`;
  $('#info-almacen').textContent = info;
  marcarGenero();
  $('#ajuste-realistas').checked = leerPref('realistas', 'true') === 'true';
  abrirDialogo(dlg);
}

/* ================= MOSTRAR CONTENIDO DE (MUJER / HOMBRE / AMBOS) ================= */
function marcarGenero() {
  const g = generoPreferido();
  document.querySelectorAll('#ajuste-genero button').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.genero === g)));
}

function elegirGenero(g) {
  guardarPref('genero', g);
  marcarGenero();
  // Repintar lo que dependa de la preferencia: Inspiración y el catálogo de básicos si está a la vista
  if (tabActual() === 'inspiracion') renderInspiracion();
  if ($('#anadir-editor .catalogo')) mostrarCatalogoBasicos({ nuevo: false });
}

// La primera vez (o si aún no se ha elegido) se pregunta con una pantalla sencilla
function preguntarGeneroSiHaceFalta() {
  if (generoElegido()) return;
  const dlg = $('#dlg-bienvenida');
  abrirDialogo(dlg);
}

/* ================= INICIO ================= */
// Tocar fuera de una ventana equivale a «atrás» (así pregunta si hay cambios sin guardar)
function cerrarAlTocarFondo(dlg) {
  dlg.addEventListener('click', (e) => { if (e.target === dlg) cerrarConPregunta(dlg.capaNav); });
}

async function iniciar() {
  // Navegación: pestaña inicial desde la URL y enlaces internos (#armario, #anadir…) sin recargar
  const inicial = (location.hash || '#armario').slice(1);
  iniciarNavegacion(VISTAS[inicial] ? inicial : 'armario', (tab) => ruta(tab));
  activarDeslizarPestanas();
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href^="#"]');
    if (!a) return;
    const tab = a.getAttribute('href').slice(1);
    if (!VISTAS[tab]) return;
    e.preventDefault();
    irATab(tab);
  });
  $('#input-camara').addEventListener('change', alElegirFoto);
  $('#input-galeria').addEventListener('change', alElegirFoto);
  $('#btn-basico').addEventListener('click', () => mostrarCatalogoBasicos());
  $('#btn-quitar-filtros').addEventListener('click', () => {
    estado.filtroCat = null; estado.filtroColor = null; estado.filtroEst = null;
    renderArmario();
  });
  const swFondo = $('#fondo-blanco');
  swFondo.checked = leerPref('fondoBlanco', 'true') === 'true';
  swFondo.addEventListener('change', () => guardarPref('fondoBlanco', String(swFondo.checked)));

  document.querySelectorAll('#selector-estilo button').forEach((b) => b.addEventListener('click', () => {
    estado.estiloOutfit = b.dataset.estilo;
    guardarPref('estiloOutfit', estado.estiloOutfit);
    renderOutfits();
    if (estado.outfitActual) generar();
  }));
  $('#incluir-abrigo').addEventListener('change', (e) => {
    estado.incluirAbrigo = e.target.checked;
    guardarPref('incluirAbrigo', String(estado.incluirAbrigo));
    if (estado.outfitActual) generar();
  });
  $('#btn-generar').addEventListener('click', () => generar(true));

  $('#btn-ajustes').addEventListener('click', abrirAjustes);
  $('#ajuste-realistas').addEventListener('change', (e) => {
    guardarPref('realistas', String(e.target.checked));
    // Repintar lo que se ve con el nuevo modo (las pantallas se vuelven a pintar al abrirlas)
    VISTAS[tabActual()].render();
    if ($('#anadir-editor .catalogo')) mostrarCatalogoBasicos({ nuevo: false });
    if (e.target.checked) precargarRealistas();
    toast(e.target.checked ? 'Imágenes realistas activadas' : 'Imágenes realistas desactivadas: se ven los dibujos');
  });
  document.querySelectorAll('#ajuste-genero button').forEach((b) => b.addEventListener('click', () => {
    elegirGenero(b.dataset.genero);
    toast(`Mostrando contenido de: ${NOMBRE_GENERO[b.dataset.genero]}`);
  }));
  document.querySelectorAll('#dlg-bienvenida [data-genero]').forEach((b) => b.addEventListener('click', () => {
    elegirGenero(b.dataset.genero);
    $('#dlg-bienvenida').close();
    toast('Listo. Puedes cambiarlo en Ajustes (⚙)');
  }));
  document.querySelectorAll('dialog [data-close]').forEach((b) => b.addEventListener('click', () => b.closest('dialog').close()));
  cerrarAlTocarFondo($('#dlg-editar'));
  cerrarAlTocarFondo($('#dlg-ajustes'));
  cerrarAlTocarFondo($('#dlg-look'));

  iniciarInspiracion({ prendas: () => estado.prendas, urlFoto, imgPrenda, abrirEdicionPrenda: abrirEdicion });

  $('#btn-exportar').addEventListener('click', async () => {
    try {
      const r = await exportar();
      toast(`Exportadas ${r.prendas} prendas`);
    } catch (e) { console.error(e); toast('No se pudo exportar'); }
  });
  $('#input-importar').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    try {
      const r = await importar(file);
      await recargarDatos();
      $('#dlg-ajustes').close();
      toast(`Importadas ${r.prendas} prendas, ${r.outfits} outfits y ${r.looks} looks`);
      ruta();
    } catch (err) { toast(err.message || 'No se pudo importar'); }
  });

  await cargarIndice(); // qué básicos tienen botones o cremallera
  try { await recargarDatos(); } catch (e) { console.error(e); toast('No se pudo abrir la base de datos'); }
  ruta();
  db.requestPersistence();
  preguntarGeneroSiHaceFalta();

  registrarServiceWorker();
}

// Registra el service worker y recarga la app sola cuando hay una versión nueva.
function registrarServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  const habiaVersion = !!navigator.serviceWorker.controller;
  let recargando = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!habiaVersion || recargando) return; // primera instalación: no hace falta
    if (document.querySelector('dialog[open]') || editorNuevo) {
      // Hay algo a medio editar: avisar en vez de recargar y perderlo
      toast('Hay una versión nueva. Se aplicará al volver a abrir la app.');
      return;
    }
    recargando = true;
    location.reload();
  });
  navigator.serviceWorker.register('./sw.js', { updateViaCache: 'none' }).then((reg) => {
    // Al volver a la app desde segundo plano, comprobar si hay versión nueva
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') reg.update().catch(() => {});
    });
  }).catch((e) => console.warn('Service worker no registrado', e));
}

async function versionInstalada() {
  try {
    const k = (await caches.keys()).find((n) => /^armario-v\d+-app$/.test(n));
    return k ? k.replace(/^armario-(v\d+)-app$/, '$1') : '';
  } catch { return ''; }
}

iniciar();
