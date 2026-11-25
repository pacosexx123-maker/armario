// Configuración del maniquí (se puede ajustar a mano).
//
// Coordenadas: el maniquí mide 200 × 500 unidades (x de 0 a 200, y de 0 a 500, hacia abajo).
// Cada prenda se coloca con su caja de anclaje: el borde de arriba de la prenda (lo que se ve
// en su foto de assets/catalogo/) va a la altura `arriba` y el de abajo a la altura `abajo`.
// Ambas se dan como [línea del maniquí, desplazamiento en unidades], p. ej. ['hombros', -12]
// = 12 unidades por encima de la línea de hombros. El ancho sale solo, manteniendo las
// proporciones de la foto; `escalaX` lo estrecha o ensancha y `dx` la mueve a los lados.

// Líneas del cuerpo de cada maniquí (y en unidades)
export const MANIQUIES = {
  hombre: { cabeza: 14, menton: 62, hombros: 84, axilas: 110, cintura: 190, cadera: 238, entrepierna: 258, rodilla: 365, tobillo: 460, suelo: 486 },
  mujer:  { cabeza: 20, menton: 64, hombros: 88, axilas: 112, cintura: 184, cadera: 238, entrepierna: 258, rodilla: 365, tobillo: 460, suelo: 486 },
};

// Cajas por defecto de cada categoría
export const ANCLAS_CATEGORIA = {
  camiseta: { arriba: ['hombros', -9], abajo: ['cadera', 20] },
  camisa:   { arriba: ['hombros', -15], abajo: ['cadera', 28] },
  jersey:   { arriba: ['hombros', -9], abajo: ['cadera', 14] },
  sudadera: { arriba: ['hombros', -9], abajo: ['cadera', 16] },
  chaqueta: { arriba: ['hombros', -13], abajo: ['cadera', 30] },
  abrigo:   { arriba: ['hombros', -15], abajo: ['rodilla', 18] },
  vestido:  { arriba: ['hombros', 0], abajo: ['rodilla', 12] },
  pantalon: { arriba: ['cintura', -6], abajo: ['suelo', -10] },
  vaqueros: { arriba: ['cintura', -2], abajo: ['suelo', -10] },
  chandal:  { arriba: ['cintura', -6], abajo: ['suelo', -12] },
  shorts:   { arriba: ['cintura', -6], abajo: ['rodilla', -22] },
  falda:    { arriba: ['cintura', -6], abajo: ['rodilla', 45] },
  zapatillas: { arriba: ['tobillo', -8], abajo: ['suelo', 8] },
  zapatos:  { arriba: ['tobillo', -6], abajo: ['suelo', 8] },
  botas:    { arriba: ['rodilla', 4], abajo: ['suelo', 8] },
  sandalias: { arriba: ['tobillo', -6], abajo: ['suelo', 8] },
};

// Ajustes de cada foto de catálogo (por id) sobre los de su categoría
export const ANCLAS_PRENDA = {
  'jersey-alto': { arriba: ['hombros', -26] },
  'jersey-half-zip': { arriba: ['hombros', -20] },
  'sudadera-capucha': { arriba: ['hombros', -34] },
  'polo': { arriba: ['hombros', -12] },
  'cardigan': { abajo: ['cadera', 20] },
  'camiseta-ml': { abajo: ['cadera', 18] },
  'americana-m': { abajo: ['cadera', 16] },
  'chaqueta-vaquera': { abajo: ['cintura', 34] },
  'camisa-oxford-m': { abajo: ['cadera', 20] },
  'camisa-vestir-m': { abajo: ['cadera', 20] },
  'chino-m': { abajo: ['tobillo', 0] },
  'pantalon-traje-m': { abajo: ['suelo', -8] },
  'vaqueros-pitillo': { abajo: ['tobillo', 4] },
  'botines': { arriba: ['tobillo', -40] },
  'salones': { arriba: ['tobillo', -14] },
  'bailarinas': { arriba: ['tobillo', -2], abajo: ['suelo', 6] },
  'sneakers': { escalaX: 1 },
};

// Orden de las capas, de atrás hacia delante (dentro de cada grupo, de dentro a fuera)
export const CAPAS = {
  abajo: ['pantalon', 'vaqueros', 'chandal', 'falda', 'shorts', 'vestido'],
  arriba: ['camiseta', 'camisa', 'jersey', 'sudadera'],
  capa: ['chaqueta', 'abrigo'],
  calzado: ['zapatillas', 'zapatos', 'botas', 'sandalias'],
};

// Camisas que van por dentro del pantalón: las de vestir, y cualquier camisa en un outfit formal.
// Se recortan a la altura de la cintura más este margen (unidades).
export const POR_DENTRO = { ids: ['camisa-vestir', 'camisa-vestir-m'], estilos: ['formal'], margen: 6 };

// Giro: límite sin vistas de espaldas (grados) y grados por píxel de arrastre
export const GIRO = { limite: 35, gradosPorPx: 0.45, vuelta: 520 /* ms al volver al frente */ };

// En «Ambos», qué prendas hacen que se use el maniquí de mujer
export const PRENDAS_DE_MUJER = (id) => id.endsWith('-m') || ['falda', 'vestido', 'salones', 'bailarinas'].includes(id);

// Aberturas del escote: en las fotos «maniquí invisible» se ve el interior de la prenda por el
// escote; esa zona se vuelve transparente para que se vea lo de debajo (la camisa o el maniquí).
// Polígonos en fracciones (0–1) del ancho y del alto de la foto de assets/catalogo/<id>.png.
export const ABERTURAS = {
  'americana': [[0.42, 0.03], [0.58, 0.03], [0.58, 0.08], [0.505, 0.485], [0.495, 0.485], [0.42, 0.08]],
  'americana-m': [[0.42, 0.03], [0.58, 0.03], [0.58, 0.07], [0.505, 0.475], [0.495, 0.475], [0.42, 0.07]],
  'abrigo-largo': [[0.45, 0.035], [0.555, 0.035], [0.555, 0.075], [0.503, 0.31], [0.497, 0.31], [0.45, 0.075]],
  'jersey-pico': [[0.395, 0.035], [0.605, 0.035], [0.605, 0.05], [0.502, 0.19], [0.498, 0.19], [0.395, 0.05]],
  'cardigan': [[0.40, 0.04], [0.60, 0.04], [0.60, 0.06], [0.503, 0.36], [0.497, 0.36], [0.40, 0.06]],
};
