# Armario 👕

Armario digital para el móvil. Haz una foto a cada prenda: la app reconoce qué tipo de prenda es, guarda su color exacto y te genera outfits con un botón.

- Funciona **sin servidor**: todo se procesa y se guarda en tu móvil (IndexedDB).
- Funciona **sin conexión** una vez instalada (PWA con service worker).
- Sin APIs de pago ni claves.

## Funciones

| Pestaña | Qué hace |
|---|---|
| **Armario** | Cuadrícula con tus prendas, filtros por categoría y por color. Toca una prenda para editarla o borrarla. |
| **Añadir** | Haz una foto o elige una de la galería. La app detecta el color dominante (HEX + nombre) y sugiere la categoría con MobileNet. Puedes tocar la foto para coger el color de un punto, ajustarlo a mano y cambiar la categoría y los estilos. |
| **Outfits** | Elige estilo (Formal, Arreglado, Informal, Deportivo), activa o no el abrigo y pulsa «Generar outfit». «Otro» da una alternativa y puedes guardar tus favoritos. |

El botón de la esquina superior derecha abre la **copia de seguridad**: exporta todo (con fotos) a un archivo `.json` o impórtalo después.

## Estructura

```
├── index.html          Página única con las tres pestañas
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

> **Al publicar cambios:** sube a `sw.js` el número de `VERSION` (`armario-v1` → `armario-v2`…). Así los móviles descargan la versión nueva en lugar de seguir con la que tenían en caché.

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
- **Estilos:** cada prenda tiene etiquetas formal / casual / deporte. Se rellenan según la categoría, pero conviene revisarlas: el generador solo usa prendas compatibles con el estilo elegido.
- **Copia de seguridad:** los datos viven en el almacenamiento de la app. Si la desinstalas o borras sus datos se pierden, así que exporta una copia de vez en cuando.

## Probarla en el ordenador

Los service workers y los módulos JS no funcionan abriendo el archivo con doble clic. Lanza un servidor local en la carpeta:

```bash
python -m http.server 8000
```

y abre `http://localhost:8000`.
