// Ilustración simple de un look: iconos de prenda coloreados con el color de cada hueco,
// colocados como un «flat lay». Devuelve un SVG en texto (sin fotos de tiendas).

import { hexToLab } from './color.js';
import { categoria as infoCategoria } from './categories.js';

// Iconos dibujados en una caja de 100×100: d = silueta rellena, det = detalles (líneas),
// atras = piezas que van detrás (capucha), frente = piezas rellenas encima (pompón)
const ICONOS = {
  camiseta: { d: 'M30 10L42 6Q50 14 58 6L70 10L92 26L82 40L72 34L72 94L28 94L28 34L18 40L8 26Z', det: 'M42 6Q50 18 58 6' },
  camisa: { d: 'M30 8L44 4L50 12L56 4L70 8L84 18L96 70L84 74L72 38L72 96L28 96L28 38L16 74L4 70L16 18Z', det: 'M50 12L50 96M44 4L40 16L50 12L60 16L56 4M50 30L50 30M50 50L50 50' },
  jersey: { d: 'M32 8Q50 18 68 8L84 18L96 72L84 76L72 38L72 96L28 96L28 38L16 76L4 72L16 18Z', det: 'M28 88L72 88M36 9Q50 22 64 9M4 66L16 70M96 66L84 70' },
  sudadera: { atras: 'M33 11Q35 -3 50 -3Q65 -3 67 11Q50 21 33 11Z', d: 'M32 8Q50 18 68 8L84 18L96 72L84 76L72 38L72 96L28 96L28 38L16 76L4 72L16 18Z', det: 'M38 60L62 60L66 78L34 78ZM28 88L72 88M46 14L45 30M54 14L55 30' },
  chaqueta: { d: 'M32 6L68 6L84 16L96 74L84 78L72 38L72 96L28 96L28 38L16 78L4 74L16 16Z', det: 'M50 42L50 96M36 6L50 42L64 6M30 70L40 70M60 70L70 70' },
  abrigo: { d: 'M30 3L70 3L86 13L97 70L86 74L75 34L78 99L22 99L25 34L14 74L3 70L14 13Z', det: 'M50 34L50 99M36 3L50 34L64 3M44 52L44 52M44 70L44 70M28 80L40 80M60 80L72 80' },
  pantalon: { d: 'M26 4L74 4L80 96L58 96L50 30L42 96L20 96Z', det: 'M26 12L74 12M50 12L50 30' },
  vaqueros: { d: 'M26 4L74 4L80 96L58 96L50 30L42 96L20 96Z', det: 'M26 12L74 12M30 12Q34 26 45 23M70 12Q66 26 55 23M50 12L50 30M21 88L42 88M58 88L79 88' },
  chandal: { d: 'M28 4L72 4L76 92L58 92L50 30L42 92L24 92Z', det: 'M28 12L72 12M24 84L42 84M58 84L76 84M30 16L26 80M70 16L74 80M46 12L46 20M54 12L54 20' },
  falda: { d: 'M32 8L68 8L88 92L12 92Z', det: 'M32 16L68 16M42 16L36 92M58 16L64 92M50 16L50 92' },
  shorts: { d: 'M24 12L76 12L82 64L56 64L50 36L44 64L18 64Z', det: 'M24 20L76 20M50 20L50 36' },
  vestido: { d: 'M38 4L44 4Q50 12 56 4L62 4L66 30L60 40L84 96L16 96L40 40L34 30Z', det: 'M40 40L60 40M44 4Q50 16 56 4' },
  zapatillas: { d: 'M6 72Q6 52 22 50L38 48Q50 32 62 42L88 58Q97 62 94 77L6 78Z', det: 'M6 70L94 70M42 50L48 58M50 45L56 53M58 42L64 50' },
  zapatos: { d: 'M4 72Q8 57 24 57L48 55Q60 47 72 51L92 61Q99 69 92 74L4 74Z', det: 'M4 70L95 70M48 55Q56 62 66 58' },
  botas: { d: 'M26 6L52 6L54 56L84 64Q96 68 94 80L22 80Z', det: 'M22 74L94 74M26 14L52 14M52 30L58 34' },
  bolso: { d: 'M14 40L86 40L92 92L8 92Z', det: 'M34 40Q34 12 50 12Q66 12 66 40M14 52L86 52M46 52L54 52L54 60L46 60Z' },
  bufanda: { d: 'M18 8L82 8L82 26L64 26L66 88L48 88L46 26L18 26Z', det: 'M50 88L50 96M55 88L55 96M60 88L60 96M18 17L82 17' },
  cinturon: { d: 'M2 40L98 40L98 58L2 58Z', det: 'M60 35L76 35L76 63L60 63ZM68 49L86 49' },
  gorro: { d: 'M18 72Q18 24 50 24Q82 24 82 72Z', det: 'M16 62L84 62L84 76L16 76Z', frente: 'M44 22a6 6 0 1 0 12 0a6 6 0 1 0 -12 0' },
};

// Posición en el lienzo (120 × 150) según la familia/categoría: [x, y, ancho, alto]
const CAJAS = {
  capa: [0, 8, 62, 78],
  arriba: [30, 4, 58, 52],
  vestido: [27, 4, 66, 104],
  pantalon: [36, 50, 48, 64], vaqueros: [36, 50, 48, 64], chandal: [36, 50, 48, 64],
  falda: [34, 52, 52, 50], shorts: [34, 52, 52, 40],
  calzado: [38, 112, 48, 36],
  complemento: [88, 8, 30, 30],
};

function cajaDe(cat) {
  const c = infoCategoria(cat);
  if (!c) return CAJAS.arriba;
  if (c.slot === 'abajo') return CAJAS[cat] || CAJAS.pantalon;
  if (c.familia === 'capa') return cat === 'abrigo' ? [0, 6, 62, 92] : CAJAS.capa;
  return CAJAS[c.slot === 'complemento' ? 'complemento' : c.familia] || CAJAS.arriba;
}

// Orden de dibujo: lo de atrás primero
const ORDEN = { capa: 0, abajo: 1, vestido: 2, arriba: 3, calzado: 4, complemento: 5 };

function trazo(hex) {
  const L = hexToLab(hex)[0];
  return L > 38 ? 'rgba(0,0,0,.38)' : 'rgba(255,255,255,.45)';
}

export function ilustrarLook(huecos, { titulo = '' } = {}) {
  const lista = huecos
    .map((h, i) => ({ h, i, c: infoCategoria(h.categoria) }))
    .filter((x) => x.c && ICONOS[x.h.categoria])
    .sort((a, b) => (ORDEN[a.c.familia] ?? ORDEN[a.c.slot] ?? 3) - (ORDEN[b.c.familia] ?? ORDEN[b.c.slot] ?? 3));

  const tieneAbajo = lista.some((x) => x.c.slot === 'abajo');
  const repetidos = {};
  let compl = 0;
  const partes = lista.map(({ h, c }) => {
    let [x, y, w, hh] = cajaDe(h.categoria);
    const fam = c.slot === 'complemento' ? 'complemento' : c.familia;
    if (fam === 'complemento') { y += compl * 34; compl++; }
    else {
      const k = repetidos[fam] || 0; // segunda capa del mismo tipo: desplazada
      repetidos[fam] = k + 1;
      x -= k * 12; y += k * 5;
    }
    if (c.slot === 'calzado' && !tieneAbajo && !lista.some((v) => v.c.slot === 'vestido')) y = 64;
    const ic = ICONOS[h.categoria];
    const st = trazo(h.color);
    const t = `translate(${x} ${y}) scale(${w / 100} ${hh / 100})`;
    const ve = 'vector-effect="non-scaling-stroke"';
    return `<g transform="${t}" stroke="${st}" stroke-width="1.1" stroke-linejoin="round" stroke-linecap="round">`
      + (ic.atras ? `<path d="${ic.atras}" fill="${h.color}" ${ve}/>` : '')
      + `<path d="${ic.d}" fill="${h.color}" ${ve}/>`
      + (ic.det ? `<path d="${ic.det}" fill="none" ${ve}/>` : '')
      + (ic.frente ? `<path d="${ic.frente}" fill="${h.color}" ${ve}/>` : '')
      + '</g>';
  });
  const etiqueta = titulo ? ` role="img" aria-label="${titulo.replace(/"/g, '&quot;')}"` : ' aria-hidden="true"';
  return `<svg class="ilustracion" viewBox="0 0 120 150" xmlns="http://www.w3.org/2000/svg"${etiqueta}>${partes.join('')}</svg>`;
}

// Icono suelto de una categoría (para listas)
export function iconoPrenda(cat, hex) {
  const ic = ICONOS[cat];
  if (!ic) return '';
  const st = trazo(hex);
  const ve = 'vector-effect="non-scaling-stroke"';
  return `<svg class="mini-icono" viewBox="-4 -6 108 108" aria-hidden="true"><g stroke="${st}" stroke-width="1.2" stroke-linejoin="round">`
    + (ic.atras ? `<path d="${ic.atras}" fill="${hex}" ${ve}/>` : '')
    + `<path d="${ic.d}" fill="${hex}" ${ve}/>`
    + (ic.det ? `<path d="${ic.det}" fill="none" ${ve}/>` : '')
    + (ic.frente ? `<path d="${ic.frente}" fill="${hex}" ${ve}/>` : '')
    + '</g></svg>';
}
