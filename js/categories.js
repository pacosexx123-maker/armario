// Categorías de prendas, estilos por defecto y traducción de etiquetas de ImageNet.

// slot: parte del outfit que ocupa cada categoría
export const CATEGORIAS = [
  { id: 'camiseta',   nombre: 'Camiseta',             slot: 'arriba',  estilos: ['casual', 'deporte'] },
  { id: 'camisa',     nombre: 'Camisa',               slot: 'arriba',  estilos: ['formal', 'casual'] },
  { id: 'jersey',     nombre: 'Jersey',               slot: 'arriba',  estilos: ['casual', 'formal'] },
  { id: 'sudadera',   nombre: 'Sudadera',             slot: 'arriba',  estilos: ['casual', 'deporte'] },
  { id: 'chaqueta',   nombre: 'Chaqueta / americana', slot: 'abrigo',  estilos: ['formal', 'casual'] },
  { id: 'abrigo',     nombre: 'Abrigo',               slot: 'abrigo',  estilos: ['formal', 'casual'] },
  { id: 'pantalon',   nombre: 'Pantalón',             slot: 'abajo',   estilos: ['formal', 'casual'] },
  { id: 'vaqueros',   nombre: 'Vaqueros',             slot: 'abajo',   estilos: ['casual'] },
  { id: 'chandal',    nombre: 'Chándal',              slot: 'abajo',   estilos: ['deporte'] },
  { id: 'falda',      nombre: 'Falda',                slot: 'abajo',   estilos: ['casual', 'formal'] },
  { id: 'shorts',     nombre: 'Shorts',               slot: 'abajo',   estilos: ['casual', 'deporte'] },
  { id: 'vestido',    nombre: 'Vestido',              slot: 'vestido', estilos: ['casual', 'formal'] },
  { id: 'zapatillas', nombre: 'Zapatillas',           slot: 'calzado', estilos: ['casual', 'deporte'] },
  { id: 'zapatos',    nombre: 'Zapatos',              slot: 'calzado', estilos: ['formal', 'casual'] },
  { id: 'botas',      nombre: 'Botas',                slot: 'calzado', estilos: ['casual', 'formal'] },
];

export const ESTILOS = [
  { id: 'formal', nombre: 'Formal' },
  { id: 'casual', nombre: 'Casual' },
  { id: 'deporte', nombre: 'Deporte' },
];

const POR_ID = Object.fromEntries(CATEGORIAS.map((c) => [c.id, c]));
export const categoria = (id) => POR_ID[id];
export const nombreCategoria = (id) => (POR_ID[id] ? POR_ID[id].nombre : 'Sin categoría');
export const estilosPorDefecto = (id) => (POR_ID[id] ? [...POR_ID[id].estilos] : ['casual']);

// Etiqueta de ImageNet (primer sinónimo, en minúsculas) → [categoría, fiabilidad 0–1]
// La fiabilidad baja indica pistas indirectas (p. ej. una corbata suele ir con camisa).
export const IMAGENET_A_CATEGORIA = {
  'jersey':           ['camiseta', 1],    // "jersey, T-shirt, tee shirt"
  'maillot':          ['camiseta', 0.3],
  'sweatshirt':       ['sudadera', 1],
  'cardigan':         ['jersey', 1],
  'wool':             ['jersey', 0.5],
  'bow tie':          ['camisa', 0.6],
  'windsor tie':      ['camisa', 0.6],
  'suit':             ['chaqueta', 0.9],
  'lab coat':         ['chaqueta', 0.7],
  'military uniform': ['chaqueta', 0.5],
  'bulletproof vest': ['chaqueta', 0.4],
  'trench coat':      ['abrigo', 1],
  'fur coat':         ['abrigo', 1],
  'cloak':            ['abrigo', 0.7],
  'poncho':           ['abrigo', 0.6],
  'stole':            ['abrigo', 0.4],
  'jean':             ['vaqueros', 1],    // "jean, blue jean, denim"
  'pajama':           ['chandal', 0.5],
  'miniskirt':        ['falda', 1],
  'hoopskirt':        ['falda', 0.8],
  'overskirt':        ['falda', 0.8],
  'sarong':           ['falda', 0.6],
  'swimming trunks':  ['shorts', 0.9],
  'gown':             ['vestido', 1],
  'abaya':            ['vestido', 0.7],
  'kimono':           ['vestido', 0.6],
  'vestment':         ['vestido', 0.4],
  'apron':            ['vestido', 0.3],
  'running shoe':     ['zapatillas', 1],
  'loafer':           ['zapatos', 1],
  'clog':             ['zapatos', 0.8],
  'sandal':           ['zapatos', 0.8],
  'cowboy boot':      ['botas', 1],
};
