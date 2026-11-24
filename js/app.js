// Armario · lógica de la interfaz
import * as db from './db.js';
import { processPhoto, blobToCanvas } from './image.js';
import { extraerColorDominante, colorEnPunto, describirColor, NOMBRES_COLOR, colorDeNombre } from './color.js';
import { CATEGORIAS, ESTILOS, nombreCategoria, estilosPorDefecto } from './categories.js';
import { ESTILOS_OUTFIT, generarOutfit, claveOutfit } from './outfits.js';
import { exportar, importar } from './backup.js';
import { $, h, ICONOS, toast, chip, leerPref, guardarPref, mostrarColorGrande } from './ui.js';
import { PALETA_FAMILIAS } from './palette.js';
import { iniciarInspiracion, renderInspiracion } from './inspiration.js';

/* ---------- Estado ---------- */
const estado = {
  prendas: [],
  favoritos: [],
  filtroCat: null,
  filtroColor: null,
  estiloOutfit: leerPref('estiloOutfit', 'informal'),
  incluirAbrigo: leerPref('incluirAbrigo', 'false') === 'true',
  outfitActual: null,
};
const urls = new Map(); // id de prenda → URL de su foto

function urlFoto(p) {
  if (!urls.has(p.id)) urls.set(p.id, URL.createObjectURL(p.foto));
  return urls.get(p.id);
}
function liberarFoto(id) {
  if (urls.has(id)) { URL.revokeObjectURL(urls.get(id)); urls.delete(id); }
}

async function recargarDatos() {
  const [prendas, favoritos] = await Promise.all([db.getAll('prendas'), db.getAll('outfits')]);
  estado.prendas = prendas.sort((a, b) => (b.creada || 0) - (a.creada || 0));
  estado.favoritos = favoritos.sort((a, b) => (b.fecha || 0) - (a.fecha || 0));
  const ids = new Set(prendas.map((p) => p.id));
  [...urls.keys()].forEach((id) => { if (!ids.has(id)) liberarFoto(id); });
}

/* ---------- Navegación ---------- */
const VISTAS = {
  armario: { titulo: 'Mi armario', render: renderArmario },
  anadir: { titulo: 'Añadir prenda', render: () => {} },
  outfits: { titulo: 'Outfits', render: renderOutfits },
  inspiracion: { titulo: 'Inspiración', render: () => renderInspiracion() },
};

function ruta() {
  const nombre = (location.hash || '#armario').slice(1);
  const vista = VISTAS[nombre] ? nombre : 'armario';
  for (const k of Object.keys(VISTAS)) $(`#view-${k}`).hidden = k !== vista;
  document.querySelectorAll('.tabbar a').forEach((a) => {
    if (a.dataset.tab === vista) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });
  $('#page-title').textContent = VISTAS[vista].titulo;
  VISTAS[vista].render();
  window.scrollTo(0, 0);
}

/* ================= ARMARIO ================= */
function renderArmario() {
  const grid = $('#grid');
  const vacio = $('#armario-vacio');
  const { prendas } = estado;
  vacio.hidden = prendas.length > 0;
  $('.filters').hidden = prendas.length === 0;
  $('#contador').hidden = prendas.length === 0;

  // Filtros de categoría (solo las que existen)
  const cats = CATEGORIAS.filter((c) => prendas.some((p) => p.categoria === c.id));
  if (estado.filtroCat && !cats.some((c) => c.id === estado.filtroCat)) estado.filtroCat = null;
  $('#filtro-categorias').replaceChildren(
    chip('Todas', !estado.filtroCat, () => { estado.filtroCat = null; renderArmario(); }),
    ...cats.map((c) => chip(c.nombre, estado.filtroCat === c.id, () => { estado.filtroCat = estado.filtroCat === c.id ? null : c.id; renderArmario(); }))
  );

  // Filtros de color (por nombre de color)
  const colores = NOMBRES_COLOR.filter((n) => prendas.some((p) => p.color && p.color.nombre === n));
  if (estado.filtroColor && !colores.includes(estado.filtroColor)) estado.filtroColor = null;
  $('#filtro-colores').replaceChildren(
    chip('Todos los colores', !estado.filtroColor, () => { estado.filtroColor = null; renderArmario(); }),
    ...colores.map((n) => chip(n, estado.filtroColor === n, () => { estado.filtroColor = estado.filtroColor === n ? null : n; renderArmario(); }, colorDeNombre(n).hex))
  );

  const visibles = prendas.filter((p) =>
    (!estado.filtroCat || p.categoria === estado.filtroCat) &&
    (!estado.filtroColor || (p.color && p.color.nombre === estado.filtroColor)));
  $('#contador').textContent = visibles.length === prendas.length
    ? `${prendas.length} ${prendas.length === 1 ? 'prenda' : 'prendas'}`
    : `${visibles.length} de ${prendas.length} prendas`;

  grid.replaceChildren(...visibles.map((p) =>
    h('button', { class: 'item', type: 'button', onclick: () => abrirEdicion(p), 'aria-label': `Editar ${nombreCategoria(p.categoria)} ${p.color?.nombre || ''}` },
      h('img', { src: urlFoto(p), alt: '', loading: 'lazy', decoding: 'async' }),
      h('div', { class: 'meta' },
        h('span', { class: 'dot', style: { background: p.color?.hex || '#ccc' } }),
        h('span', { class: 'name' }, nombreCategoria(p.categoria)),
        h('span', { class: 'sub' }, p.color?.nombre || '')),
      (p.etiqueta?.marca || p.etiqueta?.talla)
        ? h('div', { class: 'meta2' }, [p.etiqueta.marca, p.etiqueta.talla && `Talla ${p.etiqueta.talla}`].filter(Boolean).join(' · '))
        : null
    )));
}


/* ================= EDITOR DE PRENDA ================= */
// Se usa tanto para añadir como para editar.
// calcularAuto(balanceActivo): recalcula el color automático (solo al añadir una prenda nueva)
function crearEditor({ blob, canvas, color, categoria = '', estilos = [], etiqueta = null, modo, calcularAuto = null, onGuardar, onCancelar, onBorrar }) {
  const st = {
    color: { hex: color.hex, nombre: color.nombre },
    colorAuto: { hex: color.hex, nombre: color.nombre },
    colorEsAuto: modo !== 'editar',   // si sigue siendo el automático, se recalcula al cambiar «Fondo blanco»
    balance: color.balance || null,   // resultado del balance de blancos con el fondo
    categoria,
    estilos: new Set(estilos),
    estilosTocados: modo === 'editar',
    categoriaTocada: modo === 'editar',
    cerrado: false,
  };
  const fotoURL = URL.createObjectURL(blob);
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
  const img = h('img', { src: fotoURL, alt: 'Foto de la prenda', draggable: 'false' });
  const wrap = h('div', { class: 'photo-wrap' }, img, marca,
    h('div', { class: 'photo-hint' }, 'Toca la foto para tomar el color de ese punto'));
  img.addEventListener('click', (e) => {
    const c = colorDeToque(e, img, canvas, marca, gananciasFoto());
    if (c) { if (marcaOtra) marcaOtra.hidden = true; ponerColor(c); }
  });

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
  const btnAuto = h('button', { class: 'btn', type: 'button', onclick: () => { quitarMarcas(); ponerColor(st.colorAuto, { auto: true }); } }, 'Automático');

  // Paleta de muestras por familias (de claro a oscuro)
  const panelPaleta = h('div', { class: 'paleta', hidden: true },
    ...PALETA_FAMILIAS.map((f) => h('div', { class: 'pal-fila' },
      h('span', { class: 'pal-nombre' }, f.nombre),
      h('div', { class: 'pal-tonos' }, ...f.tonos.map((t) => h('button', {
        type: 'button', class: 'pal-tono', style: { background: t }, 'data-hex': t,
        'aria-label': `${f.nombre}: ${describirColor(t).nombre} ${t.toUpperCase()}`, 'aria-pressed': 'false',
        onclick: () => { quitarMarcas(); ponerColor(describirColor(t)); },
      }))))),
    h('label', { class: 'btn mini avanzado' }, 'Ajuste avanzado', inputColor));
  const btnPaleta = h('button', { class: 'btn', type: 'button', 'aria-expanded': 'false' }, 'Paleta');
  btnPaleta.addEventListener('click', () => {
    panelPaleta.hidden = !panelPaleta.hidden;
    btnPaleta.setAttribute('aria-expanded', String(!panelPaleta.hidden));
  });

  // «Sacar color de otra imagen» (p. ej. la foto de la tienda): solo para elegir el color, no se guarda
  const inputOtra = h('input', { type: 'file', accept: 'image/*', hidden: true });
  const btnOtra = h('label', { class: 'btn' }, inputOtra, 'Otra imagen');
  const panelOtra = h('div', { class: 'otra-imagen', hidden: true });
  let otraURL = null, marcaOtra = null;
  const liberarOtra = () => {
    if (otraURL) URL.revokeObjectURL(otraURL);
    otraURL = null; marcaOtra = null;
    panelOtra.replaceChildren();
    panelOtra.hidden = true;
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
      pintarBalance();
    });
    pintarBalance();
    cajaBalance = h('div', { class: 'balance' },
      h('label', { class: 'switch-row' }, h('span', {}, 'Fondo blanco'), swBalance), info);
  }

  function ponerColor(c, { desdeTeclado = false, auto = false } = {}) {
    st.color = { hex: c.hex, nombre: c.nombre };
    st.colorEsAuto = auto;
    swatch.style.background = c.hex;
    nombre.textContent = c.nombre;
    if (!desdeTeclado) { hex.value = c.hex.toUpperCase(); hex.classList.remove('invalid'); }
    inputColor.value = c.hex;
    const actual = c.hex.toLowerCase();
    panelPaleta.querySelectorAll('.pal-tono').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.hex === actual)));
  }
  ponerColor(st.color, { auto: st.colorEsAuto });

  // Categoría
  const select = h('select', { 'aria-label': 'Categoría' },
    h('option', { value: '', disabled: true }, 'Elige una categoría…'),
    ...CATEGORIAS.map((c) => h('option', { value: c.id }, c.nombre)));
  select.value = st.categoria || '';
  const aiEstado = h('div', { class: 'ai-status' });
  select.addEventListener('change', () => {
    st.categoria = select.value;
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
      await onGuardar({ categoria: st.categoria, color: st.color, estilos: [...st.estilos], etiqueta: datosEtiqueta() });
      destruir();
    } catch (e) {
      console.error(e);
      toast('No se pudo guardar: ' + e.message);
      btnGuardar.disabled = false;
    }
  });
  const acciones = h('div', { class: 'editor-actions' }, btnGuardar,
    h('button', { class: 'btn', type: 'button', onclick: () => { destruir(); onCancelar && onCancelar(); } }, 'Cancelar'),
    onBorrar ? h('button', { class: 'btn danger', type: 'button', onclick: () => onBorrar(destruir) }, 'Borrar prenda') : null);

  const el = h('div', { class: 'editor' },
    wrap,
    h('div', { class: 'card' },
      h('p', { class: 'field-label' }, 'Color'),
      h('div', { class: 'color-row' }, swatch, h('div', { class: 'color-info' }, nombre,
        h('label', { class: 'hex-field' }, h('span', {}, 'Código'), hex))),
      cajaBalance,
      h('div', { class: 'color-actions' }, btnPaleta, btnOtra, btnAuto),
      panelPaleta,
      panelOtra),
    h('div', { class: 'card' },
      h('p', { class: 'field-label' }, 'Categoría'),
      select, aiEstado),
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
    URL.revokeObjectURL(fotoURL);
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
      if (!st.estilosTocados) { st.estilos = new Set(estilosPorDefecto(res.categoria)); pintarEstilos(); }
      setEstado('ok', `Sugerido: ${nombreCategoria(res.categoria)} (${Math.round(res.confianza * 100)} % de confianza). Puedes cambiarlo.`);
    } else {
      select.value = '';
      select.classList.add('needs-choice');
      const pista = res.categoria ? ` ¿Quizá ${nombreCategoria(res.categoria).toLowerCase()}?` : '';
      setEstado('warn', `No estoy seguro de qué prenda es.${pista} Elige la categoría.`);
    }
  }

  return { el, setEstado, setClasificacion, destruir, get cerrado() { return st.cerrado; } };
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

  let canvas, blob, color;
  try {
    ({ canvas, blob } = await processPhoto(file));
    color = extraerColorDominante(canvas, { balanceBlancos: leerPref('fondoBlanco', 'true') === 'true' });
  } catch (err) {
    console.error(err);
    toast('No se pudo procesar la foto');
    reiniciarAnadir();
    return;
  }

  const ed = crearEditor({
    blob, canvas, color, modo: 'nuevo',
    calcularAuto: (balanceBlancos) => extraerColorDominante(canvas, { balanceBlancos }),
    onGuardar: async (datos) => {
      await db.put('prendas', { id: db.uid(), foto: blob, ...datos, creada: Date.now() });
      await recargarDatos();
      toast('Prenda guardada');
      editorNuevo = null;
      reiniciarAnadir();
      location.hash = '#armario';
    },
    onCancelar: () => { editorNuevo = null; reiniciarAnadir(); },
  });
  editorNuevo = ed;
  host.replaceChildren(ed.el);

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

/* ================= EDITAR ================= */
async function abrirEdicion(prenda) {
  const dlg = $('#dlg-editar');
  let canvas;
  try { canvas = await blobToCanvas(prenda.foto, 800); } catch { toast('No se pudo abrir la foto'); return; }
  const cerrar = () => { ed.destruir(); dlg.close(); };
  const ed = crearEditor({
    blob: prenda.foto, canvas, modo: 'editar',
    color: prenda.color || { hex: '#cccccc', nombre: 'gris claro' },
    categoria: prenda.categoria,
    estilos: prenda.estilos || [],
    etiqueta: prenda.etiqueta,
    onGuardar: async (datos) => {
      await db.put('prendas', { ...prenda, ...datos, actualizada: Date.now() });
      await recargarDatos();
      dlg.close();
      toast('Cambios guardados');
      renderArmario();
    },
    onCancelar: () => dlg.close(),
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
  dlg.showModal();
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
}

function favoritoDe(clave) { return estado.favoritos.find((f) => claveOutfit(f.ids) === clave); }

function pintarOutfit() {
  const host = $('#outfit-resultado');
  const o = estado.outfitActual;
  if (!o) { host.replaceChildren(); return; }
  if (o.error) { host.replaceChildren(h('div', { class: 'notice' }, o.error)); return; }

  const fav = favoritoDe(o.clave);
  const btnFav = h('button', { class: 'btn fav', type: 'button', 'aria-pressed': String(!!fav), html: ICONOS.corazon });
  btnFav.append(fav ? 'Guardado' : 'Guardar');
  btnFav.addEventListener('click', () => alternarFavorito(o));
  const btnOtro = h('button', { class: 'btn primary', type: 'button', html: ICONOS.otro, onclick: () => generar(true) });
  btnOtro.append('Otro');

  host.replaceChildren(h('div', { class: 'card outfit' },
    h('div', { class: `outfit-pieces n${o.prendas.length}` },
      ...o.prendas.map((p) => h('div', { class: 'piece' },
        h('img', { src: urlFoto(p), alt: `${nombreCategoria(p.categoria)} ${p.color.nombre}` }),
        h('span', { class: 'tag' }, h('span', { class: 'dot', style: { background: p.color.hex } }), nombreCategoria(p.categoria))))),
    h('p', { class: 'outfit-why' }, o.frase),
    h('div', { class: 'palette', 'aria-hidden': 'true' }, ...o.prendas.map((p) => h('span', { style: { background: p.color.hex }, title: p.color.nombre }))),
    o.aviso ? h('p', { class: 'muted small' }, o.aviso) : null,
    h('div', { class: 'outfit-actions' }, btnFav, btnOtro)));
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
      h('div', { class: 'fav-thumbs' }, ...prendas.map((p) => h('img', { src: urlFoto(p), alt: '' }))),
      h('div', { class: 'fav-text' },
        h('strong', {}, `${ESTILOS_OUTFIT[f.estilo]?.nombre || ''} · ${fecha}`),
        h('span', {}, incompleto ? 'Alguna prenda ya no está en tu armario' : f.frase)),
      borrar);
    const ver = () => {
      if (!prendas.length) return;
      estado.outfitActual = { prendas, clave: claveOutfit(f.ids), estilo: f.estilo, frase: f.frase, aviso: incompleto ? 'Alguna prenda de este outfit se ha borrado.' : '' };
      pintarOutfit();
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
  dlg.showModal();
}

/* ================= INICIO ================= */
function cerrarAlTocarFondo(dlg) {
  dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });
}

async function iniciar() {
  window.addEventListener('hashchange', ruta);
  $('#input-camara').addEventListener('change', alElegirFoto);
  $('#input-galeria').addEventListener('change', alElegirFoto);
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
  document.querySelectorAll('dialog [data-close]').forEach((b) => b.addEventListener('click', () => b.closest('dialog').close()));
  cerrarAlTocarFondo($('#dlg-editar'));
  cerrarAlTocarFondo($('#dlg-ajustes'));
  cerrarAlTocarFondo($('#dlg-look'));

  iniciarInspiracion({ prendas: () => estado.prendas, urlFoto, abrirEdicionPrenda: abrirEdicion });

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

  try { await recargarDatos(); } catch (e) { console.error(e); toast('No se pudo abrir la base de datos'); }
  ruta();
  db.requestPersistence();

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
