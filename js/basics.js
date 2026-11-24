// Catálogo de básicos para añadir prendas sin foto.
// Cada básico trae categoría, nombre, estilos, silueta (icono de illustration.js) y un color inicial.
// Para añadir uno nuevo, copia una línea y cámbiala.

export const BASICOS = [
  // Parte de arriba
  { id: 'camiseta-basica',  nombre: 'Camiseta básica',                 categoria: 'camiseta',   icono: 'camiseta',         estilos: ['casual', 'deporte'], color: '#f5f5f3' },
  { id: 'camiseta-ml',      nombre: 'Camiseta de manga larga',         categoria: 'camiseta',   icono: 'camiseta_ml',      estilos: ['casual'],            color: '#f5f5f3' },
  { id: 'polo',             nombre: 'Polo',                            categoria: 'camiseta',   icono: 'polo',             estilos: ['casual', 'formal'],  color: '#1d2741' },
  { id: 'camisa-oxford',    nombre: 'Camisa oxford',                   categoria: 'camisa',     icono: 'camisa',           estilos: ['casual', 'formal'],  color: '#a9cfee' },
  { id: 'camisa-vestir',    nombre: 'Camisa de vestir',                categoria: 'camisa',     icono: 'camisa',           estilos: ['formal'],            color: '#ffffff' },
  { id: 'jersey-redondo',   nombre: 'Jersey de punto cuello redondo',  categoria: 'jersey',     icono: 'jersey',           estilos: ['casual', 'formal'],  color: '#8a8d91' },
  { id: 'jersey-pico',      nombre: 'Jersey de punto cuello de pico',  categoria: 'jersey',     icono: 'jersey_pico',      estilos: ['casual', 'formal'],  color: '#1d2741' },
  { id: 'jersey-alto',      nombre: 'Jersey de cuello alto',           categoria: 'jersey',     icono: 'cuello_alto',      estilos: ['casual', 'formal'],  color: '#161616' },
  { id: 'cardigan',         nombre: 'Cárdigan',                        categoria: 'jersey',     icono: 'cardigan',         estilos: ['casual', 'formal'],  color: '#d4bf9f' },
  { id: 'sudadera',         nombre: 'Sudadera',                        categoria: 'sudadera',   icono: 'sudadera',         estilos: ['casual', 'deporte'], color: '#8a8d91' },
  { id: 'sudadera-capucha', nombre: 'Sudadera con capucha',            categoria: 'sudadera',   icono: 'sudadera_capucha', estilos: ['casual', 'deporte'], color: '#161616' },
  // Chaquetas y abrigos
  { id: 'americana',        nombre: 'Americana',                       categoria: 'chaqueta',   icono: 'chaqueta',         estilos: ['formal', 'casual'],  color: '#1d2741' },
  { id: 'chaqueta-vaquera', nombre: 'Chaqueta vaquera',                categoria: 'chaqueta',   icono: 'chaqueta_vaquera', estilos: ['casual'],            color: '#4d6b8e' },
  { id: 'abrigo-largo',     nombre: 'Abrigo largo',                    categoria: 'abrigo',     icono: 'abrigo',           estilos: ['formal', 'casual'],  color: '#b88658' },
  // Parte de abajo
  { id: 'chino',            nombre: 'Pantalón chino',                  categoria: 'pantalon',   icono: 'pantalon',         estilos: ['casual', 'formal'],  color: '#d4bf9f' },
  { id: 'pantalon-traje',   nombre: 'Pantalón de traje',               categoria: 'pantalon',   icono: 'pantalon_traje',   estilos: ['formal'],            color: '#43464b' },
  { id: 'vaqueros-rectos',  nombre: 'Vaqueros rectos',                 categoria: 'vaqueros',   icono: 'vaqueros',         estilos: ['casual'],            color: '#4d6b8e' },
  { id: 'vaqueros-pitillo', nombre: 'Vaqueros pitillo',                categoria: 'vaqueros',   icono: 'pitillo',          estilos: ['casual'],            color: '#2f3e55' },
  { id: 'chandal',          nombre: 'Pantalón de chándal',             categoria: 'chandal',    icono: 'chandal',          estilos: ['deporte'],           color: '#161616' },
  { id: 'shorts',           nombre: 'Shorts',                          categoria: 'shorts',     icono: 'shorts',           estilos: ['casual', 'deporte'], color: '#d4bf9f' },
  { id: 'falda',            nombre: 'Falda',                           categoria: 'falda',      icono: 'falda',            estilos: ['casual', 'formal'],  color: '#161616' },
  // Vestidos
  { id: 'vestido',          nombre: 'Vestido',                         categoria: 'vestido',    icono: 'vestido',          estilos: ['casual', 'formal'],  color: '#1d2741' },
  // Calzado
  { id: 'sneakers',         nombre: 'Zapatillas blancas tipo sneaker', categoria: 'zapatillas', icono: 'zapatillas',       estilos: ['casual', 'deporte'], color: '#f5f5f3' },
  { id: 'mocasines',        nombre: 'Mocasines',                       categoria: 'zapatos',    icono: 'mocasines',        estilos: ['casual', 'formal'],  color: '#5e3f2a' },
  { id: 'zapatos-vestir',   nombre: 'Zapatos de vestir',               categoria: 'zapatos',    icono: 'zapatos',          estilos: ['formal'],            color: '#161616' },
  { id: 'botas',            nombre: 'Botas',                           categoria: 'botas',      icono: 'botas',            estilos: ['casual', 'formal'],  color: '#5e3f2a' },
  { id: 'botines',          nombre: 'Botines',                         categoria: 'botas',      icono: 'botines',          estilos: ['casual', 'formal'],  color: '#161616' },
  { id: 'sandalias',        nombre: 'Sandalias',                       categoria: 'sandalias',  icono: 'sandalias',        estilos: ['casual'],            color: '#b88658' },
];

// Grupos para mostrar el catálogo (por la parte del outfit que ocupa cada categoría)
export const GRUPOS_BASICOS = [
  { nombre: 'Parte de arriba', categorias: ['camiseta', 'camisa', 'jersey', 'sudadera'] },
  { nombre: 'Chaquetas y abrigos', categorias: ['chaqueta', 'abrigo'] },
  { nombre: 'Parte de abajo', categorias: ['pantalon', 'vaqueros', 'chandal', 'shorts', 'falda'] },
  { nombre: 'Vestidos', categorias: ['vestido'] },
  { nombre: 'Calzado', categorias: ['zapatillas', 'zapatos', 'botas', 'sandalias'] },
].map((g) => ({ ...g, basicos: BASICOS.filter((b) => g.categorias.includes(b.categoria)) }));
