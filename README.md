# Armario 👕

Armario digital para el móvil. Haz una foto a cada prenda: la app reconoce qué tipo de prenda es, guarda su color exacto y te genera outfits con un botón.

- Funciona **sin servidor**: todo se procesa y se guarda en tu móvil (IndexedDB).
- Funciona **sin conexión** una vez instalada (PWA con service worker).
- Sin APIs de pago ni claves.

## Funciones

| Pestaña | Qué hace |
|---|---|
| **Armario** | Todas tus prendas (con foto y básicos, calzado incluido). Filtros combinables por categoría (con el número de prendas y el grupo «Calzado»), color y estampado, y un botón para quitarlos. Toca una prenda para editarla o borrarla. |
| **Añadir** | Haz una foto o elige una de la galería, o pulsa «Añadir básico» para crear una prenda sin foto a partir de un catálogo (camiseta, camisa oxford, vaqueros, mocasines…) eligiendo color y estampado; se muestra con una ilustración y puedes añadirle una foto más tarde. La app detecta el color dominante (HEX + nombre) y sugiere la categoría con MobileNet. Puedes tocar la foto para coger el color de un punto, ajustarlo a mano y cambiar la categoría y los estilos. Con «Escanear etiqueta» lee la etiqueta interior (OCR) y rellena marca, talla, composición, país de fabricación y cuidados. **Estampado** (liso, rayas, cuadros, topos u otro): la app lo sugiere a partir de la foto (dos colores grandes y distintos; rayas o cuadros si se repiten con un periodo claro) y tú lo confirmas o cambias, con orientación, grosor o tamaño y color del estampado. |
| **Outfits** | Elige estilo (Formal, Arreglado, Informal, Deportivo), activa o no el abrigo y pulsa «Generar outfit». «Otro» da una alternativa y puedes guardar tus favoritos. Como máximo lleva una prenda con estampado llamativo (las rayas finas y los cuadros pequeños cuentan como discretos) y suma puntos si otra prenda repite el color del estampado. |
| **Inspiración** | 60 looks de referencia (y los tuyos) ordenados por parecido con tu armario, con filtros por estilo y temporada. Cada look muestra la referencia junto a «tu versión», el % de parecido, prenda a prenda, y la lista «Te falta». Con «Añadir look desde foto» subes una captura de un outfit: la app detecta las prendas y sus colores y lo guarda como «Mío». |

El botón ⚙ de la esquina superior derecha abre **Ajustes**: «Mostrar contenido de» (Mujer / Hombre / Ambos, que se pregunta la primera vez y filtra Inspiración y el catálogo de básicos) y la **copia de seguridad**: exporta todo (con fotos y tus looks) a un archivo `.json` o impórtalo después.

## Inspiración: cómo funciona el parecido

Un look es una «receta»: una lista de huecos, cada uno con **categoría**, **color** (HEX) y **rol** (`base`, `acento` o `neutro`), más un estilo y una temporada. Para cada hueco la app busca tu prenda más parecida y le da una puntuación de 0 a 100:

- **Categoría:** la misma categoría vale 100 %. Si no la tienes, se acepta una de la misma familia con penalización: chaqueta ↔ abrigo, zapatos ↔ botas ↔ zapatillas, camiseta ↔ camisa ↔ jersey ↔ sudadera, pantalón ↔ vaqueros ↔ chándal. La penalización depende del estilo: en deportivo el chándal sustituye bien al pantalón, en formal unos vaqueros no.
- **Color:** distancia CIEDE2000 en Lab. Negro / gris marengo / azul marino, beige / camel / crudo y blanco / crudo cuentan casi como el mismo color. En los huecos `acento` el color pesa más y en los `neutro`, menos.
- Cada prenda se usa una sola vez por look. A partir de 55 puntos la prenda cuenta como «parecida»; si no, el hueco va a la lista **Te falta**. Si hay varias prendas buenas para un hueco, el botón ↻ muestra la siguiente.

**Detección automática (looks desde foto):** usa [transformers.js](https://huggingface.co/docs/transformers.js) con el modelo [`Xenova/segformer_b2_clothes`](https://huggingface.co/Xenova/segformer_b2_clothes), en versión cuantizada de unos 29 MB. Se descarga la primera vez y queda guardado en el móvil. Detecta la parte de arriba, el pantalón, la falda, el vestido, el calzado, el bolso, la bufanda, el cinturón y el gorro. El color de cada prenda se calcula solo con los píxeles de su máscara. El modelo no distingue camiseta, camisa, jersey ni chaqueta, así que la app te pide confirmarlo. Si falta algo, tócalo en la foto para añadirlo a mano; también puedes borrar detecciones erróneas.

### Añadir looks a la biblioteca (`looks.json`)

Cada look es un objeto dentro de la lista `looks`. Copia uno existente y cámbialo:

```json
{ "id": "mi-look-nuevo", "nombre": "Jersey verde con pantalón crudo", "estilo": "informal", "temporada": "invierno", "genero": "unisex", "huecos": [
  { "categoria": "jersey", "color": "#1e4631", "rol": "acento" },
  { "categoria": "pantalon", "color": "#ebe3d2", "rol": "base" },
  { "categoria": "botas", "color": "#5e3f2a", "rol": "neutro" }
] }
```

- `id`: único, sin espacios.
- `estilo`: `formal`, `arreglado`, `informal` o `deportivo`.
- `temporada`: `verano`, `invierno` o `todo el año`.
- `genero`: `mujer`, `hombre` o `unisex`. En Inspiración se muestran los del género elegido en Ajustes (⚙ → «Mostrar contenido de») más los unisex.
- `categoria`: `camiseta`, `camisa`, `jersey`, `sudadera`, `chaqueta`, `abrigo`, `pantalon`, `vaqueros`, `chandal`, `falda`, `shorts`, `vestido`, `zapatillas`, `zapatos`, `botas`, `sandalias`, `bolso`, `bufanda`, `cinturon` o `gorro`.
- `color`: HEX de 6 dígitos en minúsculas, por ejemplo `#1d2741`.

Los looks con algún dato incorrecto se ignoran y la consola del navegador avisa de cuál es. Después de editar el archivo, sube el número de `VERSION` en `sw.js`.

## Estructura

```
├── index.html          Página única con las cuatro pestañas
├── looks.json          Biblioteca de 60 looks de inspiración (editable a mano)
├── manifest.json       Manifiesto de la PWA (nombre, iconos, colores)
├── sw.js               Service worker (caché para modo offline)
├── .nojekyll           Indica a GitHub Pages que sirva los archivos tal cual
├── css/styles.css      Estilos
├── icons/              Iconos PNG de 192 y 512 px
└── js/
    ├── app.js          Interfaz y navegación
    ├── db.js           Base de datos local (IndexedDB)
    ├── image.js        Redimensionado (máx. 800 px) y compresión JPEG
    ├── color.js        Color dominante (Lab + k-means), nombres de color
    ├── categories.js   Categorías, estilos por defecto y mapeo de ImageNet
    ├── classifier.js   TensorFlow.js + MobileNet (carga diferida)
    ├── outfits.js      Generador de outfits y armonía de color
    ├── label.js        Lectura de etiquetas con Tesseract.js (OCR)
    ├── palette.js      Paleta de muestras de color (componente reutilizable)
    ├── pattern.js      Estampados: modelo, dibujo, editor reutilizable y detección
    ├── basics.js       Catálogo de básicos (prendas sin foto)
    ├── nav.js          Navegación con la History API (botón «atrás» de Android)
    ├── matching.js     Parecido entre un look y tu armario (familias, CIEDE2000)
    ├── illustration.js Ilustraciones de los looks (iconos de prenda en SVG)
    ├── inspiration.js  Pestaña Inspiración (lista, filtros, comparación)
    ├── lookeditor.js   Añadir / editar un look desde foto (manual + automático)
    ├── segment.js      Detección de prendas con transformers.js + SegFormer
    ├── ui.js           Utilidades de interfaz compartidas
    └── backup.js       Exportar / importar en JSON
```

No hace falta compilar nada: son archivos estáticos.

## 1. Publicar en GitHub Pages

1. Crea un repositorio nuevo en GitHub (por ejemplo `armario`). Puede ser público; con GitHub Free, Pages exige que lo sea.
2. Sube todos los archivos de esta carpeta a la raíz del repositorio:
   - **Desde la web:** en el repositorio, *Add file → Upload files*, arrastra todo el contenido de la carpeta (incluidas `css`, `js` e `icons`) y pulsa *Commit changes*.
   - **Con git:**
     ```bash
     git init
     git add .
     git commit -m "Primera versión de Armario"
     git branch -M main
     git remote add origin https://github.com/TU_USUARIO/armario.git
     git push -u origin main
     ```
3. En el repositorio ve a **Settings → Pages**.
4. En *Build and deployment → Source*, elige **Deploy from a branch**, rama **main** y carpeta **/ (root)**. Pulsa *Save*.
5. En uno o dos minutos la app estará en `https://TU_USUARIO.github.io/armario/`.

Ábrela en Chrome en el móvil para probarla. También puedes instalarla directamente con el menú ⋮ → *Añadir a pantalla de inicio*.

> **Al publicar cambios:** sube el número de `VERSION` en `sw.js` (`armario-v4` → `armario-v5`…). La app pide siempre primero los archivos a la red y se recarga sola cuando detecta una versión nueva; sin conexión usa la copia guardada.

## 2. Generar el APK con PWABuilder

1. Entra en **[pwabuilder.com](https://www.pwabuilder.com)**.
2. Pega la URL de tu app (`https://TU_USUARIO.github.io/armario/`) y pulsa *Start*.
3. PWABuilder analiza el manifiesto y el service worker. Puede sugerir mejoras opcionales, como capturas de pantalla, que no hacen falta para generar el APK.
4. Pulsa **Package for stores → Android → Generate Package**.
   - *Package ID*: algo como `io.github.tuusuario.armario`.
   - Para instalarla tú mismo, deja las opciones por defecto. PWABuilder genera una clave de firma nueva.
5. Descarga el `.zip`. Dentro encontrarás:
   - un **`.apk`**, para instalar directamente en el móvil;
   - un `.aab`, solo para subirla a Google Play;
   - el archivo de la clave de firma (`signing.keystore` + `signing-key-info.txt`). **Guárdalo**: lo necesitarás para publicar actualizaciones con la misma firma.
6. Pasa el `.apk` al móvil y ábrelo. Android pedirá permiso para *instalar apps de origen desconocido*; acéptalo para esa app (Archivos, Chrome…).

### Quitar la barra de dirección (opcional)

El APK es una *Trusted Web Activity*. Si Android no puede verificar que la web es tuya, muestra una pequeña barra con la URL arriba. Para quitarla:

1. En el zip de PWABuilder viene un archivo **`assetlinks.json`**.
2. Debe estar accesible en `https://TU_USUARIO.github.io/.well-known/assetlinks.json`, es decir, en la **raíz del dominio**, no dentro de `/armario/`. Para ello crea un repositorio llamado exactamente `TU_USUARIO.github.io`, activa Pages en él y sube el archivo a la carpeta `.well-known/`. Ese repositorio también necesita un archivo `.nojekyll` vacío para que GitHub sirva carpetas que empiezan por punto.
3. Desinstala y vuelve a instalar el APK.

Si no te importa la barra, puedes saltarte este paso: la app funciona igual.

## Notas de uso

- **Fotos:** usa un fondo liso que contraste con la prenda (suelo, cama, pared). La app estima el color del fondo a partir de los bordes de la foto y lo descarta antes de calcular el color de la prenda.
- **Clasificador:** la primera vez se descargan TensorFlow.js y el modelo MobileNet (unos 14 MB), así que necesitas conexión. Después queda guardado en el móvil y funciona offline. MobileNet está entrenado con ImageNet y no distingue bien todas las categorías (por ejemplo camisa y camiseta, o pantalón y chándal). Por eso la categoría siempre se puede cambiar, y si el modelo no está seguro te pide que la elijas tú.
- **Etiquetas:** el lector (Tesseract.js, en español e inglés) se descarga la primera vez que escaneas una etiqueta (unos 10 MB) y luego funciona sin conexión. Funciona mejor con la etiqueta estirada, bien iluminada y enfocada; si la foto sale girada, la app prueba también a 90°. Lee el texto, no los símbolos de lavado: los cuidados solo se detectan si vienen escritos. Revisa siempre los datos, porque todos los campos se pueden editar.
- **Estilos:** cada prenda tiene etiquetas formal / casual / deporte. Se rellenan según la categoría, pero conviene revisarlas: el generador solo usa prendas compatibles con el estilo elegido.
- **Copia de seguridad:** los datos viven en el almacenamiento de la app. Si la desinstalas o borras sus datos se pierden, así que exporta una copia de vez en cuando.

## Probarla en el ordenador

Los service workers y los módulos JS no funcionan abriendo el archivo con doble clic. Lanza un servidor local en la carpeta:

```bash
python -m http.server 8000
```

y abre `http://localhost:8000`.
