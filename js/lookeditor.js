// Crear o editar un look propio a partir de una foto.
// Modo manual: tocar la foto añade una prenda con el color de esa zona.
// Modo automático: detección de prendas con SegFormer (segment.js), encima del manual.

import * as db from './db.js';
import { $, h, toast, botonIcono, ICONOS } from './ui.js';
import { blobToCanvas, canvasToJpeg } from './image.js';
import { colorEnPunto, describirColor, infoColor } from './color.js';
import { CATEGORIAS, categoria as infoCategoria } from './categories.js';
import { ESTILOS_OUTFIT } from './outfits.js';

const COLORES_MARCA = ['#ff5a5f', '#2f9df4', '#ffbe0b', '#22c55e', '#a855f7', '#fb7c2b', '#14b8a6', '#ec4899', '#84cc16', '#6366f1'];
const TEMPORADAS = [['todo el año', 'Todo el año'], ['verano', 'Verano'], ['invierno', 'Invierno']];
const ROLES = [['base', 'Base'], ['acento', 'Acento'], ['neutro', 'Neutro']];

let siguienteId = 1;

export async function abrirEditorLook({ look = null, onGuardado }) {
  const dlg = $('#dlg-nuevo-look');
  const st = {
    foto: look?.foto || null,   // Blob JPEG guardado
    canvas: null,               // foto en canvas (≤1024 px) para colores y máscaras
    huecos: (look?.huecos || []).map((x) => ({ ...x, id: siguienteId++, rolManual: true })),
    nombre: look?.nombre || '',
    estilo: look?.estilo || 'informal',
    temporada: look?.temporada || 'todo el año',
    modoColor: null,            // id del hueco que espera un toque en la foto
    detectando: false,
    cerrado: false,
    fotoURL: null,
  };

  /* ---------- Elementos ---------- */
  const titulo = h('h2', {}, look ? 'Editar look' : 'Nuevo look');
  const cuerpo = h('div', { class: 'look-editor' });
  dlg.replaceChildren(
    h('div', { class: 'sheet-head' }, titulo,
      h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Cerrar', html: ICONOS.cerrar, onclick: () => dlg.close() })),
    cuerpo);
  dlg.onclose = () => { st.cerrado = true; if (st.fotoURL) URL.revokeObjectURL(st.fotoURL); };

  const inputGaleria = h('input', { type: 'file', accept: 'image/*', hidden: true });
  const inputCamara = h('input', { type: 'file', accept: 'image/*', capture: 'environment', hidden: true });
  inputGaleria.addEventListener('change', alElegirFoto);
  inputCamara.addEventListener('change', alElegirFoto);

  const estado = h('div', { class: 'ai-status' });
  const ponerEstado = (tipo, texto) => {
    if (st.cerrado) return;
    estado.className = 'ai-status' + (tipo === 'warn' ? ' warn' : '');
    estado.replaceChildren(...(tipo === 'cargando' ? [h('span', { class: 'spinner' })] : []), texto || '');
  };

  const img = h('img', { alt: 'Foto del look', draggable: 'false' });
  const overlay = h('canvas', { class: 'look-overlay', 'aria-hidden': 'true' });
  const wrapFoto = h('div', { class: 'look-foto' }, img, overlay);
  const pista = h('p', { class: 'look-pista' });
  const lista = h('div', { class: 'huecos-edit' });
  const btnDetectar = botonIcono('btn mini', 'diana', 'Detectar prendas', () => detectar());

  wrapFoto.addEventListener('click', alTocarFoto);

  /* ---------- Pintado ---------- */
  function pintar() {
    if (!st.foto) {
      cuerpo.replaceChildren(
        h('p', { class: 'muted' }, 'Sube una captura o una foto de un outfit que te guste (por ejemplo, de la web de una tienda). La imagen solo se guarda en tu móvil.'),
        h('div', { class: 'add-start' },
          h('label', { class: 'big-btn' }, inputGaleria, h('span', { html: ICONOS.foto }), h('span', {}, 'Elegir imagen')),
          h('label', { class: 'big-btn secondary' }, inputCamara, h('span', { html: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1Z"/><circle cx="12" cy="13.5" r="3.5"/></svg>' }), h('span', {}, 'Hacer foto'))));
      return;
    }
    const campoNombre = h('input', { type: 'text', value: st.nombre, placeholder: 'Ej. Look de oficina azul', autocomplete: 'off' });
    campoNombre.addEventListener('input', () => { st.nombre = campoNombre.value; });
    const selEstilo = h('select', { 'aria-label': 'Estilo del look' },
      ...Object.entries(ESTILOS_OUTFIT).map(([id, e]) => h('option', { value: id }, e.nombre)));
    selEstilo.value = st.estilo;
    selEstilo.addEventListener('change', () => { st.estilo = selEstilo.value; });
    const selTemp = h('select', { 'aria-label': 'Temporada' }, ...TEMPORADAS.map(([v, t]) => h('option', { value: v }, t)));
    selTemp.value = st.temporada;
    selTemp.addEventListener('change', () => { st.temporada = selTemp.value; });

    cuerpo.replaceChildren(
      wrapFoto,
      h('div', { class: 'look-foto-acciones' },
        estado,
        h('div', { class: 'fila-botones' },
          btnDetectar,
          h('label', { class: 'btn mini' }, inputGaleria, 'Cambiar foto'))),
      pista,
      h('h3', { class: 'sub-title' }, 'Prendas del look'),
      lista,
      botonIcono('btn block', 'mas', 'Añadir otra prenda', () => {
        const hu = nuevoHueco({ categoria: 'chaqueta', color: '#8a8d91' });
        st.modoColor = hu.id;
        pintarLista(); pintarPista();
      }),
      h('div', { class: 'card look-campos' },
        h('label', { class: 'field wide' }, h('span', {}, 'Nombre'), campoNombre),
        h('div', { class: 'fields' },
          h('label', { class: 'field' }, h('span', {}, 'Estilo'), selEstilo),
          h('label', { class: 'field' }, h('span', {}, 'Temporada'), selTemp))),
      h('div', { class: 'editor-actions' },
        h('button', { class: 'btn primary', type: 'button', onclick: guardar }, 'Guardar look'),
        h('button', { class: 'btn', type: 'button', onclick: () => dlg.close() }, 'Cancelar')));
    pintarLista();
    pintarPista();
    pintarOverlay();
  }

  function pintarPista() {
    const hu = st.huecos.find((x) => x.id === st.modoColor);
    if (hu) {
      pista.className = 'look-pista activa';
      pista.replaceChildren(`Toca la foto para coger el color de la prenda ${numero(hu)}. `,
        h('button', { class: 'link-btn', type: 'button', onclick: () => { st.modoColor = null; pintarPista(); pintarLista(); } }, 'Cancelar'));
    } else {
      pista.className = 'look-pista';
      pista.textContent = 'Toca la foto para añadir una prenda que no se haya detectado.';
    }
  }

  const numero = (hu) => st.huecos.indexOf(hu) + 1;
  const colorMarca = (hu) => COLORES_MARCA[(numero(hu) - 1) % COLORES_MARCA.length];

  function pintarLista() {
    if (!st.huecos.length) {
      lista.replaceChildren(h('p', { class: 'muted small' }, st.detectando
        ? 'Buscando prendas…'
        : 'Todavía no hay prendas. Toca la foto sobre cada prenda para añadirla.'));
      return;
    }
    lista.replaceChildren(...st.huecos.map(filaHueco));
  }

  function filaHueco(hu) {
    const swatch = h('span', { class: 'hueco-swatch', style: { background: hu.color } });
    const inputColor = h('input', { type: 'color', value: hu.color, 'aria-label': 'Elegir color' });
    const hex = h('input', { type: 'text', class: 'hex-input', value: hu.color.toUpperCase(), maxlength: '7', spellcheck: 'false', autocomplete: 'off', 'aria-label': 'Código de color HEX' });
    const nombre = h('span', { class: 'hueco-color-nombre' }, describirColor(hu.color).nombre);
    const ponerColor = (valor, desdeTexto = false) => {
      hu.color = describirColor(valor).hex;
      swatch.style.background = hu.color;
      nombre.textContent = describirColor(hu.color).nombre;
      inputColor.value = hu.color;
      if (!desdeTexto) hex.value = hu.color.toUpperCase();
      autoRol(hu);
      selRol.value = hu.rol;
      pintarOverlay();
    };
    inputColor.addEventListener('input', () => ponerColor(inputColor.value));
    hex.addEventListener('input', () => {
      const v = hex.value.trim().replace(/^#/, '');
      const ok = /^([0-9a-f]{3}|[0-9a-f]{6})$/i.test(v);
      hex.classList.toggle('invalid', !ok && v !== '');
      if (ok) ponerColor('#' + v, true);
    });
    hex.addEventListener('blur', () => { hex.classList.remove('invalid'); hex.value = hu.color.toUpperCase(); });

    const selCat = h('select', { 'aria-label': 'Categoría' }, ...CATEGORIAS.map((c) => h('option', { value: c.id }, c.nombre)));
    selCat.value = hu.categoria;
    selCat.addEventListener('change', () => { hu.categoria = selCat.value; hu.confirmada = true; aviso.hidden = true; });
    const selRol = h('select', { 'aria-label': 'Rol en el look' }, ...ROLES.map(([v, t]) => h('option', { value: v }, t)));
    selRol.value = hu.rol;
    selRol.addEventListener('change', () => { hu.rol = selRol.value; hu.rolManual = true; });

    // El modelo no distingue camiseta / camisa / jersey / chaqueta: hay que confirmarlo
    const aviso = h('p', { class: 'hueco-aviso', hidden: hu.etiqueta !== 'Parte de arriba' || hu.confirmada },
      'Detectado como «parte de arriba»: confirma si es camiseta, camisa, jersey, sudadera o chaqueta.');

    const btnColor = botonIcono('icon-btn' + (st.modoColor === hu.id ? ' activo' : ''), 'diana', '', () => {
      st.modoColor = st.modoColor === hu.id ? null : hu.id;
      pintarPista(); pintarLista();
      if (st.modoColor) wrapFoto.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
    btnColor.setAttribute('aria-label', 'Coger el color de la foto');
    btnColor.title = 'Coger el color de la foto';
    const btnBorrar = botonIcono('icon-btn', 'papelera', '', () => {
      st.huecos = st.huecos.filter((x) => x !== hu);
      if (st.modoColor === hu.id) st.modoColor = null;
      pintarLista(); pintarPista(); pintarOverlay();
    });
    btnBorrar.setAttribute('aria-label', 'Quitar esta prenda');

    return h('div', { class: 'hueco-edit' + (st.modoColor === hu.id ? ' activo' : '') },
      h('div', { class: 'hueco-fila' },
        h('span', { class: 'hueco-n', style: { background: colorMarca(hu) } }, String(numero(hu))),
        h('label', { class: 'hueco-color' }, swatch, inputColor),
        h('div', { class: 'hueco-hex' }, hex, nombre),
        btnColor, btnBorrar),
      h('div', { class: 'hueco-fila2' }, selCat, selRol),
      aviso);
  }

  function pintarOverlay() {
    if (!st.canvas) return;
    const w = st.canvas.width, hh = st.canvas.height;
    overlay.width = w; overlay.height = hh;
    const c = overlay.getContext('2d');
    c.clearRect(0, 0, w, hh);
    const conMascara = st.huecos.filter((x) => x.mascara);
    if (conMascara.length) {
      const imgData = c.createImageData(w, hh);
      const d = imgData.data;
      for (const hu of conMascara) {
        const [r, g, b] = hexRGB(colorMarca(hu));
        const m = hu.mascara;
        for (let i = 0; i < m.length; i++) {
          if (!m[i]) continue;
          const k = i * 4;
          d[k] = r; d[k + 1] = g; d[k + 2] = b; d[k + 3] = 110;
        }
      }
      c.putImageData(imgData, 0, 0);
    }
    // Números sobre cada prenda
    const radio = Math.max(12, Math.round(w / 26));
    for (const hu of st.huecos) {
      const p = hu.centro || hu.punto;
      if (!p) continue;
      c.beginPath();
      c.arc(p.x, p.y, radio, 0, Math.PI * 2);
      c.fillStyle = colorMarca(hu);
      c.fill();
      c.lineWidth = Math.max(2, radio / 5);
      c.strokeStyle = '#fff';
      c.stroke();
      c.fillStyle = '#fff';
      c.font = `700 ${Math.round(radio * 1.1)}px system-ui, sans-serif`;
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillText(String(numero(hu)), p.x, p.y + 1);
    }
  }

  /* ---------- Huecos ---------- */
  function nuevoHueco(datos) {
    const hu = { id: siguienteId++, rol: 'acento', ...datos };
    autoRol(hu);
    st.huecos.push(hu);
    return hu;
  }

  function autoRol(hu) {
    if (hu.rolManual) return;
    hu.rol = infoColor(hu.color, hu.categoria).neutro ? 'neutro' : 'acento';
  }

  // Tras detectar: la prenda más grande (sin contar calzado ni complementos) es la base;
  // el resto, neutro si su color es neutro y acento si no
  function repartirRoles() {
    st.huecos.forEach(autoRol);
    const principales = st.huecos
      .filter((x) => !x.rolManual && x.area && ['arriba', 'abajo', 'vestido', 'abrigo'].includes(infoCategoria(x.categoria)?.slot))
      .sort((a, b) => b.area - a.area);
    if (principales[0]) principales[0].rol = 'base';
  }

  function categoriaPorPosicion(x, y) {
    // ¿Dentro de una prenda detectada? Entonces probablemente sea otra capa
    const i = Math.round(y) * st.canvas.width + Math.round(x);
    const dentro = st.huecos.find((hu) => hu.mascara && hu.mascara[i]);
    if (dentro) {
      const fam = infoCategoria(dentro.categoria)?.familia;
      return fam === 'arriba' ? 'chaqueta' : dentro.categoria;
    }
    const fy = y / st.canvas.height;
    return fy < 0.5 ? 'camiseta' : fy < 0.86 ? 'pantalon' : 'zapatos';
  }

  function alTocarFoto(e) {
    if (!st.canvas) return;
    const r = overlay.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * st.canvas.width;
    const y = ((e.clientY - r.top) / r.height) * st.canvas.height;
    if (x < 0 || y < 0 || x >= st.canvas.width || y >= st.canvas.height) return;
    const color = colorEnPunto(st.canvas, x, y, Math.max(3, Math.round(st.canvas.width / 100))).hex;
    const hu = st.huecos.find((v) => v.id === st.modoColor);
    if (hu) {
      hu.color = color;
      if (!hu.mascara) hu.punto = { x, y };
      autoRol(hu);
      st.modoColor = null;
    } else {
      nuevoHueco({ categoria: categoriaPorPosicion(x, y), color, punto: { x, y } });
    }
    pintarLista(); pintarPista(); pintarOverlay();
  }

  /* ---------- Foto ---------- */
  async function alElegirFoto(e) {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!file) return;
    try {
      st.canvas = await blobToCanvas(file, 1024);
      st.foto = await canvasToJpeg(st.canvas, 0.85);
    } catch (err) {
      console.error(err);
      toast('No se pudo abrir la imagen');
      return;
    }
    st.huecos = st.huecos.filter((x) => !x.mascara && !x.punto); // las marcas de la foto anterior ya no sirven
    st.modoColor = null;
    await mostrarFoto();
    pintar();
    detectar();
  }

  async function mostrarFoto() {
    if (st.fotoURL) URL.revokeObjectURL(st.fotoURL);
    st.fotoURL = URL.createObjectURL(st.foto);
    img.src = st.fotoURL;
    if (!st.canvas) st.canvas = await blobToCanvas(st.foto, 1024);
    // Que la foto entera quepa en pantalla (máx. ~58 % del alto)
    const ratio = st.canvas.width / st.canvas.height;
    wrapFoto.style.width = `min(100%, calc(58vh * ${ratio.toFixed(4)}))`;
  }

  /* ---------- Detección automática ---------- */
  async function detectar() {
    if (st.detectando || !st.canvas) return;
    st.detectando = true;
    btnDetectar.setAttribute('disabled', '');
    ponerEstado('cargando', 'Preparando el detector de prendas…');
    pintarLista();
    try {
      const { detectarPrendas } = await import('./segment.js');
      const prendas = await detectarPrendas(st.canvas, (msg) => ponerEstado('cargando', msg));
      if (st.cerrado) return;
      // Sustituye las detecciones anteriores y conserva lo añadido a mano
      st.huecos = st.huecos.filter((x) => !x.mascara);
      for (const p of prendas) {
        nuevoHueco({ categoria: p.categoria, color: p.color.hex, mascara: p.mascara, area: p.area, centro: p.centro, etiqueta: p.etiqueta });
      }
      repartirRoles();
      ponerEstado(prendas.length ? 'ok' : 'warn', prendas.length
        ? `He detectado ${prendas.length} ${prendas.length === 1 ? 'prenda' : 'prendas'}. Revisa categorías y colores.`
        : 'No he detectado prendas. Tócalas en la foto para añadirlas a mano.');
    } catch (err) {
      console.warn(err);
      ponerEstado('warn', 'No se pudo usar el detector automático (la primera vez necesita conexión). Añade las prendas tocando la foto.');
    } finally {
      st.detectando = false;
      btnDetectar.removeAttribute('disabled');
      if (!st.cerrado) { pintarLista(); pintarOverlay(); }
    }
  }

  /* ---------- Guardar ---------- */
  async function guardar() {
    if (!st.huecos.length) { toast('Añade al menos una prenda al look'); return; }
    const sinConfirmar = st.huecos.filter((x) => x.etiqueta === 'Parte de arriba' && !x.confirmada);
    if (sinConfirmar.length && !confirm('Hay prendas de arriba sin confirmar (camiseta, camisa, jersey…). ¿Guardar de todos modos?')) return;
    const n = (await db.getAll('looks')).length + 1;
    const registro = {
      id: look?.id || `mio-${db.uid()}`,
      nombre: st.nombre.trim() || `Mi look ${n}`,
      estilo: st.estilo,
      temporada: st.temporada,
      huecos: st.huecos.map(({ categoria, color, rol }) => ({ categoria, color, rol })),
      foto: st.foto,
      mio: true,
      creada: look?.creada || Date.now(),
    };
    try {
      await db.put('looks', registro);
    } catch (err) {
      console.error(err);
      toast('No se pudo guardar el look');
      return;
    }
    dlg.close();
    toast('Look guardado');
    onGuardado && onGuardado(registro);
  }

  /* ---------- Inicio ---------- */
  if (st.foto) await mostrarFoto();
  pintar();
  if (!dlg.open) dlg.showModal();
  dlg.scrollTop = 0;
}

function hexRGB(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
