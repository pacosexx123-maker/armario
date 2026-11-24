// Categorías de prendas, estilos por defecto y traducción de etiquetas de ImageNet.

// slot: parte del outfit que ocupa cada categoría
// familia: grupo de categorías intercambiables (para los looks de inspiración)
// sust / g / n: sustantivo, género (m/f) y número (s/p) para escribir frases
export const CATEGORIAS = [
  { id: 'camiseta',   nombre: 'Camiseta',             slot: 'arriba',      familia: 'arriba',  sust: 'camiseta', g: 'f', n: 's', estilos: ['casual', 'deporte'] },
  { id: 'camisa',     nombre: 'Camisa',               slot: 'arriba',      familia: 'arriba',  sust: 'camisa', g: 'f', n: 's', estilos: ['formal', 'casual'] },
  { id: 'jersey',     nombre: 'Jersey',               slot: 'arriba',      familia: 'arriba',  sust: 'jersey', g: 'm', n: 's', estilos: ['casual', 'formal'] },
  { id: 'sudadera',   nombre: 'Sudadera',             slot: 'arriba',      familia: 'arriba',  sust: 'sudadera', g: 'f', n: 's', estilos: ['casual', 'deporte'] },
  { id: 'chaqueta',   nombre: 'Chaqueta / americana', slot: 'abrigo',      familia: 'capa',    sust: 'chaqueta o americana', g: 'f', n: 's', estilos: ['formal', 'casual'] },
  { id: 'abrigo',     nombre: 'Abrigo',               slot: 'abrigo',      familia: 'capa',    sust: 'abrigo', g: 'm', n: 's', estilos: ['formal', 'casual'] },
  { id: 'pantalon',   nombre: 'Pantalón',             slot: 'abajo',       familia: 'abajo',   sust: 'pantalón', g: 'm', n: 's', estilos: ['formal', 'casual'] },
  { id: 'vaqueros',   nombre: 'Vaqueros',             slot: 'abajo',       familia: 'abajo',   sust: 'vaqueros', g: 'm', n: 'p', estilos: ['casual'] },
  { id: 'chandal',    nombre: 'Chándal',              slot: 'abajo',       familia: 'abajo',   sust: 'pantalón de chándal', g: 'm', n: 's', estilos: ['deporte'] },
  { id: 'falda',      nombre: 'Falda',                slot: 'abajo',       familia: 'abajo',   sust: 'falda', g: 'f', n: 's', estilos: ['casual', 'formal'] },
  { id: 'shorts',     nombre: 'Shorts',               slot: 'abajo',       familia: 'abajo',   sust: 'shorts', g: 'm', n: 'p', estilos: ['casual', 'deporte'] },
  { id: 'vestido',    nombre: 'Vestido',              slot: 'vestido',     familia: 'vestido', sust: 'vestido', g: 'm', n: 's', estilos: ['casual', 'formal'] },
  { id: 'zapatillas', nombre: 'Zapatillas',           slot: 'calzado',     familia: 'calzado', sust: 'zapatillas', g: 'f', n: 'p', estilos: ['casual', 'deporte'] },
  { id: 'zapatos',    nombre: 'Zapatos',              slot: 'calzado',     familia: 'calzado', sust: 'zapatos', g: 'm', n: 'p', estilos: ['formal', 'casual'] },
  { id: 'botas',      nombre: 'Botas',                slot: 'calzado',     familia: 'calzado', sust: 'botas', g: 'f', n: 'p', estilos: ['casual', 'formal'] },
  { id: 'bolso',      nombre: 'Bolso',                slot: 'complemento', familia: 'bolso',   sust: 'bolso', g: 'm', n: 's', estilos: ['formal', 'casual'] },
  { id: 'bufanda',    nombre: 'Bufanda',              slot: 'complemento', familia: 'bufanda', sust: 'bufanda', g: 'f', n: 's', estilos: ['formal', 'casual'] },
  { id: 'cinturon',   nombre: 'Cinturón',             slot: 'complemento', familia: 'cinturon', sust: 'cinturón', g: 'm', n: 's', estilos: ['formal', 'casual'] },
  { id: 'gorro',      nombre: 'Gorro / sombrero',     slot: 'complemento', familia: 'gorro',   sust: 'gorro o sombrero', g: 'm', n: 's', estilos: ['casual', 'deporte'] },
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
export const esComplemento = (id) => POR_ID[id] && POR_ID[id].slot === 'complemento';

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
  'purse':            ['bolso', 1],
  'mailbag':          ['bolso', 0.7],
  'backpack':         ['bolso', 0.6],
  'wallet':           ['bolso', 0.4],
  'stole':            ['bufanda', 0.7],
  'feather boa':      ['bufanda', 0.6],
  'buckle':           ['cinturon', 0.6],
  'cowboy hat':       ['gorro', 1],
  'sombrero':         ['gorro', 1],
  'bonnet':           ['gorro', 0.6],
};
