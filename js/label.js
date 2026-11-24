// Lectura de la etiqueta de la prenda (OCR) con Tesseract.js, en el propio móvil.
// Se carga desde CDN solo cuando se usa; los idiomas quedan guardados en IndexedDB.

const TESS_URL = 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js';
const TESS_OPCIONES = {
  workerPath: 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/worker.min.js',
  corePath: 'https://cdn.jsdelivr.net/npm/tesseract.js-core@5.1.1',
  langPath: 'https://tessdata.projectnaptha.com/4.0.0',
};

let workerPromise = null;
let avisarProgreso = () => {};

function cargarScript(src) {
  return new Promise((resolve, reject) => {
    if (window.Tesseract) return resolve();
    const s = document.createElement('script');
    s.src = src;
    s.async = true;
    s.crossOrigin = 'anonymous';
    s.onload = () => resolve();
    s.onerror = () => { s.remove(); reject(new Error('No se pudo descargar el lector de etiquetas')); };
    document.head.appendChild(s);
  });
}

function obtenerWorker(onEstado) {
  if (!workerPromise) {
    workerPromise = (async () => {
      onEstado('Preparando el lector de etiquetas (la primera vez descarga ~10 MB)…');
      await cargarScript(TESS_URL);
      return window.Tesseract.createWorker(['spa', 'eng'], 1, {
        ...TESS_OPCIONES,
        logger: (m) => avisarProgreso(m),
      });
    })().catch((e) => { workerPromise = null; throw e; });
  }
  return workerPromise;
}

/* ---------- Preparar la imagen ---------- */

// Escala de grises + estiramiento de contraste, lado mayor ~1600 px, con giro opcional.
function prepararImagen(canvas, grados = 0) {
  const MAX = 1600;
  const esc = Math.min(2.5, MAX / Math.max(canvas.width, canvas.height));
  const w = Math.round(canvas.width * esc), h = Math.round(canvas.height * esc);
  const girado = grados % 180 !== 0;
  const out = document.createElement('canvas');
  out.width = girado ? h : w;
  out.height = girado ? w : h;
  const ctx = out.getContext('2d', { willReadFrequently: true });
  ctx.translate(out.width / 2, out.height / 2);
  ctx.rotate((grados * Math.PI) / 180);
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(canvas, -w / 2, -h / 2, w, h);
  ctx.setTransform(1, 0, 0, 1, 0, 0);

  const img = ctx.getImageData(0, 0, out.width, out.height);
  const d = img.data;
  const hist = new Uint32Array(256);
  for (let i = 0; i < d.length; i += 4) {
    const g = Math.round(0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]);
    d[i] = g; hist[g]++;
  }
  // Percentiles 2 % y 98 % para estirar el contraste
  const total = d.length / 4;
  let acc = 0, lo = 0, hi = 255;
  for (let v = 0; v < 256; v++) { acc += hist[v]; if (acc >= total * 0.02) { lo = v; break; } }
  acc = 0;
  for (let v = 255; v >= 0; v--) { acc += hist[v]; if (acc >= total * 0.02) { hi = v; break; } }
  const rango = Math.max(1, hi - lo);
  for (let i = 0; i < d.length; i += 4) {
    const g = Math.max(0, Math.min(255, ((d[i] - lo) * 255) / rango));
    d[i] = d[i + 1] = d[i + 2] = g;
  }
  ctx.putImageData(img, 0, 0);
  return out;
}

/* ---------- Interpretar el texto ---------- */

const MATERIALES = [
  ['algodón', /^(algod[oó]n|cotton|coton|baumwolle|cotone|algod[aã]o|katoen)/],
  ['poliéster', /^(poli[eé]ster|polyester|polyesters?|poliestere)/],
  ['elastano', /^(elastan[oe]?|elasthan|spandex|lycra)/],
  ['viscosa', /^(viscos[ae]|viskose|rayon)/],
  ['lana', /^(lana|wool|laine|wolle|l[ãa])$/],
  ['lino', /^(lino|linen|lin|leinen|linho)$/],
  ['poliamida', /^(poliamida|polyamide?|polyamid|nylon|nailon)/],
  ['acrílico', /^(acr[ií]lic[oa]?|acrylic|acrylique|acryl)/],
  ['seda', /^(seda|silk|soie|seide)/],
  ['cachemira', /^(cachemira|cashmere|cachemire|kaschmir)/],
  ['modal', /^modal/],
  ['lyocell', /^(lyocell|tencel)/],
  ['piel', /^(piel|leather|cuir|leder)/],
  ['mohair', /^mohair/],
  ['alpaca', /^alpaca/],
];

function material(palabra) {
  const p = palabra.toLowerCase();
  const m = MATERIALES.find(([, re]) => re.test(p));
  return m ? m[0] : null;
}

function extraerComposicion(texto) {
  const encontrados = [];
  // "100% algodón" o "algodón 100%" (las etiquetas repiten lo mismo en varios idiomas)
  const re1 = /(\d{1,3})\s*%\s*([A-Za-zÀ-ÿ]+)/g;
  const re2 = /([A-Za-zÀ-ÿ]+)\s*(\d{1,3})\s*%/g;
  for (const [re, iP, iM] of [[re1, 1, 2], [re2, 2, 1]]) {
    let m;
    while ((m = re.exec(texto))) {
      const pct = parseInt(m[iP], 10);
      const mat = material(m[iM]);
      if (mat && pct > 0 && pct <= 100) encontrados.push({ pos: m.index, pct, mat });
    }
  }
  encontrados.sort((a, b) => a.pos - b.pos);
  const res = [];
  let suma = 0;
  for (const e of encontrados) {
    if (res.some((r) => r.mat === e.mat)) continue;
    if (suma + e.pct > 100) continue;
    res.push(e); suma += e.pct;
    if (suma === 100) break;
  }
  return res.sort((a, b) => b.pct - a.pct).map((r) => `${r.pct}% ${r.mat}`).join(', ');
}

function extraerTalla(texto) {
  const t = texto.toUpperCase();
  const wl = t.match(/\bW\s?(\d{2})\s*[\/ ]?\s*L\s?(\d{2})\b/);
  if (wl) return `W${wl[1]} L${wl[2]}`;
  const letras = '(XXXS|XXS|XS|S|M|L|XL|XXL|XXXL|[2-5]XL)';
  const claves = '(?:TALLA|TALLE|SIZE|TAILLE|TAGLIA|GR(?:Ö|O)SSE|T\\.)\\s*(?:\\/\\s*[A-Z]+\\s*)?[:.]?\\s*';
  let letra = '', numero = '';
  // Talla en letras: tras una palabra clave ("TALLA / SIZE: XL"), sola en una línea o tipo "XL"
  const ml = t.match(new RegExp(`\\b${claves}${letras}\\b`));
  if (ml) letra = ml[1];
  if (!letra) {
    for (const linea of t.split('\n')) {
      const m = linea.trim().match(new RegExp(`^${letras}(?:\\s*[\\/(].*)?$`));
      if (m) { letra = m[1]; break; }
    }
  }
  if (!letra) { const m = t.match(/\b(XXXS|XXS|XS|XL|XXL|XXXL|[2-5]XL)\b/); if (m) letra = m[1]; }
  // Talla numérica europea: "EUR 40", "EU 42", "TALLA 38"
  const mn = t.match(/\bEUR?\s*[:.]?\s*(\d{2}(?:[.,]5)?)\b/) || t.match(new RegExp(`\\b${claves}(\\d{2}(?:[.,]5)?)\\b`));
  if (mn) numero = mn[1];
  if (letra && numero) return `${letra} (EUR ${numero})`;
  return letra || numero;
}

const PAISES = {
  china: 'China', 'p.r.c': 'China', prc: 'China', india: 'India', bangladesh: 'Bangladés', vietnam: 'Vietnam',
  'viet nam': 'Vietnam', turkey: 'Turquía', turquia: 'Turquía', 'türkiye': 'Turquía', turkiye: 'Turquía',
  morocco: 'Marruecos', marruecos: 'Marruecos', maroc: 'Marruecos', portugal: 'Portugal', spain: 'España',
  'españa': 'España', espana: 'España', italy: 'Italia', italia: 'Italia', pakistan: 'Pakistán',
  cambodia: 'Camboya', camboya: 'Camboya', indonesia: 'Indonesia', myanmar: 'Myanmar', 'sri lanka': 'Sri Lanka',
  tunisia: 'Túnez', tunez: 'Túnez', 'túnez': 'Túnez', romania: 'Rumanía', rumania: 'Rumanía', bulgaria: 'Bulgaria',
  mexico: 'México', 'méxico': 'México', egypt: 'Egipto', egipto: 'Egipto', thailand: 'Tailandia', france: 'Francia',
  francia: 'Francia', germany: 'Alemania', alemania: 'Alemania', usa: 'EE. UU.', 'u.s.a': 'EE. UU.',
};

function extraerOrigen(texto) {
  const m = texto.toLowerCase().match(/(?:made in|hecho en|fabricado en|fabriqu[ée] en|prodotto in|hergestellt in)\s+([a-zà-ÿ. ]{3,20})/);
  if (!m) return '';
  const resto = m[1].trim();
  const clave = Object.keys(PAISES).find((k) => resto.startsWith(k));
  return clave ? PAISES[clave] : resto.split(/\s{2,}|\.|,/)[0].replace(/^\w/, (c) => c.toUpperCase());
}

function extraerCuidados(texto) {
  const t = texto.toLowerCase();
  const c = [];
  const temp = t.match(/(?:lavar|lavado|wash|laver|lavare|waschen)[^\n]{0,25}?(\d{2})\s*[°ºo]\s*c?/) || t.match(/\b(30|40|60|90)\s*[°º]\s*c?\b/);
  if (temp) c.push(`Lavar a ${temp[1]} °C`);
  if (/(a mano|hand wash|lavage [àa] la main|handw[äa]sche)/.test(t)) c.push('Lavar a mano');
  if (/(no (usar )?secadora|do not tumble|no tumble|ne pas s[ée]cher en tambour|nicht im trockner)/.test(t)) c.push('No usar secadora');
  if (/(no (usar )?lej[ií]a|do not bleach|no blanquear|ne pas blanchir|nicht bleichen)/.test(t)) c.push('No usar lejía');
  if (/(no planchar|do not iron|ne pas repasser|nicht b[üu]geln)/.test(t)) c.push('No planchar');
  else if (/(planchar|iron) [^\n]{0,15}(baja|low|tibia|cool)/.test(t)) c.push('Planchar a temperatura baja');
  if (/(no (limpiar|lavar) en seco|do not dry ?clean|ne pas nettoyer [àa] sec)/.test(t)) c.push('No limpiar en seco');
  else if (/(limpiar en seco|limpieza en seco|dry ?clean)/.test(t)) c.push('Limpieza en seco');
  if (/(del rev[ée]s|inside out|[àa] l'envers)/.test(t)) c.push('Lavar del revés');
  return c;
}

// Palabras que nunca son la marca
const NO_MARCA = /(made|hecho|fabricad|size|talla|taille|compos|cotton|algod|polyest|poli[eé]st|wash|lavar|lavado|care|cuidado|iron|planch|bleach|dry|seco|secad|china|india|turkey|portugal|spain|españa|eur|usa|mex|ref|rn\b|ca\b|www|\.com|%)/i;

function extraerMarca(lineas) {
  for (const l of lineas.slice(0, 6)) {
    const s = l.trim();
    if (s.length < 2 || s.length > 22) continue;
    if (/\d/.test(s) || NO_MARCA.test(s)) continue;
    const letras = s.replace(/[^A-Za-zÀ-ÿ&' .-]/g, '');
    if (letras.length < s.length * 0.85 || letras.replace(/[^A-Za-zÀ-ÿ]/g, '').length < 2) continue;
    // Preferimos líneas en mayúsculas (típico de logos)
    if (s === s.toUpperCase()) return s.replace(/\s+/g, ' ');
  }
  return '';
}

export function interpretarEtiqueta(texto) {
  const limpio = texto.replace(/[|]/g, 'I').replace(/\r/g, '');
  const lineas = limpio.split('\n').map((l) => l.trim()).filter(Boolean);
  return {
    marca: extraerMarca(lineas),
    talla: extraerTalla(limpio),
    composicion: extraerComposicion(limpio),
    origen: extraerOrigen(limpio),
    cuidados: extraerCuidados(limpio),
    texto: lineas.join('\n'),
  };
}

/* ---------- Leer la etiqueta ---------- */

// Prueba la foto derecha y, si sale poco texto, girada 90° a cada lado.
export async function leerEtiqueta(canvas, onEstado = () => {}) {
  const worker = await obtenerWorker(onEstado);
  const intentos = [0, 90, 270];
  let mejor = null;
  for (let i = 0; i < intentos.length; i++) {
    const g = intentos[i];
    avisarProgreso = (m) => {
      if (m.status === 'recognizing text') {
        const parte = i ? ` (probando girada, ${i + 1}/3)` : '';
        onEstado(`Leyendo la etiqueta… ${Math.round(m.progress * 100)} %${parte}`);
      } else if (/load|initiali/.test(m.status || '')) {
        onEstado('Preparando el lector de etiquetas…');
      }
    };
    const { data } = await worker.recognize(prepararImagen(canvas, g));
    const util = (data.text.match(/[A-Za-zÀ-ÿ0-9%]/g) || []).length;
    const puntos = data.confidence * Math.min(1, util / 40);
    if (!mejor || puntos > mejor.puntos) mejor = { puntos, data };
    if (data.confidence >= 65 && util >= 25) break; // ya se lee bien: no probar giros
  }
  avisarProgreso = () => {};
  return { ...interpretarEtiqueta(mejor.data.text), confianza: Math.round(mejor.data.confidence) };
}
