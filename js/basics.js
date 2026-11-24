// Catálogo de básicos para añadir prendas sin foto.
// Cada básico trae categoría, nombre, estilos, silueta (icono de illustration.js), un color inicial
// y género: 'mujer', 'hombre' o 'unisex'. Algunas prendas tienen versión de corte de hombre y de
// mujer (camisa, americana, pantalón): son dos básicos con la misma prenda y distinta silueta.
// Para añadir uno nuevo, copia una línea y cámbiala.

export const BASICOS = [
  // Parte de arriba
  { id: 'camiseta-basica',  nombre: 'Camiseta básica',                 categoria: 'camiseta',   icono: 'camiseta',         genero: 'unisex', estilos: ['casual', 'deporte'], color: '#f5f5f3' },
  { id: 'camiseta-ml',      nombre: 'Camiseta de manga larga',         categoria: 'camiseta',   icono: 'camiseta_ml',      genero: 'unisex', estilos: ['casual'],            color: '#f5f5f3' },
  { id: 'polo',             nombre: 'Polo',                            categoria: 'camiseta',   icono: 'polo',             genero: 'unisex', estilos: ['casual', 'formal'],  color: '#1d2741' },
  { id: 'camisa-oxford',    nombre: 'Camisa oxford',                   categoria: 'camisa',     icono: 'camisa',           genero: 'hombre', estilos: ['casual', 'formal'],  color: '#a9cfee' },
  { id: 'camisa-oxford-m',  nombre: 'Camisa oxford',                   categoria: 'camisa',     icono: 'camisa_mujer',     genero: 'mujer',  estilos: ['casual', 'formal'],  color: '#a9cfee' },
  { id: 'camisa-vestir',    nombre: 'Camisa de vestir',                categoria: 'camisa',     icono: 'camisa',           genero: 'hombre', estilos: ['formal'],            color: '#ffffff' },
  { id: 'camisa-vestir-m',  nombre: 'Camisa de vestir',                categoria: 'camisa',     icono: 'camisa_mujer',     genero: 'mujer',  estilos: ['formal'],            color: '#ffffff' },
  { id: 'jersey-redondo',   nombre: 'Jersey de punto cuello redondo',  categoria: 'jersey',     icono: 'jersey',           genero: 'unisex', estilos: ['casual', 'formal'],  color: '#8a8d91' },
  { id: 'jersey-pico',      nombre: 'Jersey de punto cuello de pico',  categoria: 'jersey',     icono: 'jersey_pico',      genero: 'unisex', estilos: ['casual', 'formal'],  color: '#1d2741' },
  { id: 'jersey-alto',      nombre: 'Jersey de cuello alto',           categoria: 'jersey',     icono: 'cuello_alto',      genero: 'unisex', estilos: ['casual', 'formal'],  color: '#161616' },
  { id: 'jersey-half-zip',  nombre: 'Jersey de lana con media cremallera', categoria: 'jersey', icono: 'jersey_half_zip', genero: 'unisex', estilos: ['casual', 'formal'], color: '#8a8d91' },
  { id: 'cardigan',         nombre: 'Cárdigan',                        categoria: 'jersey',     icono: 'cardigan',         genero: 'unisex', estilos: ['casual', 'formal'],  color: '#d4bf9f' },
  { id: 'sudadera',         nombre: 'Sudadera',                        categoria: 'sudadera',   icono: 'sudadera',         genero: 'unisex', estilos: ['casual', 'deporte'], color: '#8a8d91' },
  { id: 'sudadera-capucha', nombre: 'Sudadera con capucha',            categoria: 'sudadera',   icono: 'sudadera_capucha', genero: 'unisex', estilos: ['casual', 'deporte'], color: '#161616' },
  // Chaquetas y abrigos
  { id: 'americana',        nombre: 'Americana',                       categoria: 'chaqueta',   icono: 'chaqueta',         genero: 'hombre', estilos: ['formal', 'casual'],  color: '#1d2741' },
  { id: 'americana-m',      nombre: 'Americana',                       categoria: 'chaqueta',   icono: 'chaqueta_mujer',   genero: 'mujer',  estilos: ['formal', 'casual'],  color: '#1d2741' },
  { id: 'chaqueta-vaquera', nombre: 'Chaqueta vaquera',                categoria: 'chaqueta',   icono: 'chaqueta_vaquera', genero: 'unisex', estilos: ['casual'],            color: '#4d6b8e' },
  { id: 'abrigo-largo',     nombre: 'Abrigo largo',                    categoria: 'abrigo',     icono: 'abrigo',           genero: 'unisex', estilos: ['formal', 'casual'],  color: '#b88658' },
  // Parte de abajo
  { id: 'chino',            nombre: 'Pantalón chino',                  categoria: 'pantalon',   icono: 'pantalon',         genero: 'hombre', estilos: ['casual', 'formal'],  color: '#d4bf9f' },
  { id: 'chino-m',          nombre: 'Pantalón chino',                  categoria: 'pantalon',   icono: 'pantalon_mujer',   genero: 'mujer',  estilos: ['casual', 'formal'],  color: '#d4bf9f' },
  { id: 'pantalon-traje',   nombre: 'Pantalón de traje',               categoria: 'pantalon',   icono: 'pantalon_traje',   genero: 'hombre', estilos: ['formal'],            color: '#43464b' },
  { id: 'pantalon-traje-m', nombre: 'Pantalón de traje',               categoria: 'pantalon',   icono: 'pantalon_traje_mujer', genero: 'mujer', estilos: ['formal'],         color: '#43464b' },
  { id: 'vaqueros-rectos',  nombre: 'Vaqueros rectos',                 categoria: 'vaqueros',   icono: 'vaqueros',         genero: 'unisex', estilos: ['casual'],            color: '#4d6b8e' },
  { id: 'vaqueros-pitillo', nombre: 'Vaqueros pitillo',                categoria: 'vaqueros',   icono: 'pitillo',          genero: 'unisex', estilos: ['casual'],            color: '#2f3e55' },
  { id: 'chandal',          nombre: 'Pantalón de chándal',             categoria: 'chandal',    icono: 'chandal',          genero: 'unisex', estilos: ['deporte'],           color: '#161616' },
  { id: 'shorts',           nombre: 'Shorts',                          categoria: 'shorts',     icono: 'shorts',           genero: 'unisex', estilos: ['casual', 'deporte'], color: '#d4bf9f' },
  { id: 'falda',            nombre: 'Falda',                           categoria: 'falda',      icono: 'falda',            genero: 'mujer',  estilos: ['casual', 'formal'],  color: '#161616' },
  // Vestidos
  { id: 'vestido',          nombre: 'Vestido',                         categoria: 'vestido',    icono: 'vestido',          genero: 'mujer',  estilos: ['casual', 'formal'],  color: '#1d2741' },
  // Calzado
  { id: 'sneakers',         nombre: 'Zapatillas blancas tipo sneaker', categoria: 'zapatillas', icono: 'zapatillas',       genero: 'unisex', estilos: ['casual', 'deporte'], color: '#f5f5f3' },
  { id: 'mocasines',        nombre: 'Mocasines',                       categoria: 'zapatos',    icono: 'mocasines',        genero: 'unisex', estilos: ['casual', 'formal'],  color: '#5e3f2a' },
  { id: 'zapatos-vestir',   nombre: 'Zapatos de vestir',               categoria: 'zapatos',    icono: 'zapatos',          genero: 'hombre', estilos: ['formal'],            color: '#161616' },
  { id: 'bailarinas',       nombre: 'Bailarinas',                      categoria: 'zapatos',    icono: 'bailarinas',       genero: 'mujer',  estilos: ['casual', 'formal'],  color: '#161616' },
  { id: 'salones',          nombre: 'Zapatos de tacón',                categoria: 'zapatos',    icono: 'salones',          genero: 'mujer',  estilos: ['formal'],            color: '#161616' },
  { id: 'botas',            nombre: 'Botas',                           categoria: 'botas',      icono: 'botas',            genero: 'unisex', estilos: ['casual', 'formal'],  color: '#5e3f2a' },
  { id: 'botines',          nombre: 'Botines',                         categoria: 'botas',      icono: 'botines',          genero: 'unisex', estilos: ['casual', 'formal'],  color: '#161616' },
  { id: 'sandalias',        nombre: 'Sandalias',                       categoria: 'sandalias',  icono: 'sandalias',        genero: 'unisex', estilos: ['casual'],            color: '#b88658' },
];

const GRUPOS = [
  { nombre: 'Parte de arriba', categorias: ['camiseta', 'camisa', 'jersey', 'sudadera'] },
  { nombre: 'Chaquetas y abrigos', categorias: ['chaqueta', 'abrigo'] },
  { nombre: 'Parte de abajo', categorias: ['pantalon', 'vaqueros', 'chandal', 'shorts', 'falda'] },
  { nombre: 'Vestidos', categorias: ['vestido'] },
  { nombre: 'Calzado', categorias: ['zapatillas', 'zapatos', 'botas', 'sandalias'] },
];

// ¿Se muestra este básico con la preferencia «Mostrar contenido de»? ('mujer' | 'hombre' | 'ambos')
export const basicoVisible = (b, genero = 'ambos') => genero === 'ambos' || b.genero === 'unisex' || b.genero === genero;

// Grupos del catálogo con solo los básicos que tocan (los grupos vacíos no aparecen)
export function gruposBasicos(genero = 'ambos') {
  return GRUPOS
    .map((g) => ({ ...g, basicos: BASICOS.filter((b) => g.categorias.includes(b.categoria) && basicoVisible(b, genero)) }))
    .filter((g) => g.basicos.length);
}

// Todos los grupos (compatibilidad)
export const GRUPOS_BASICOS = gruposBasicos('ambos');
