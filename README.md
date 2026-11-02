# Vinilo Tracks

Revista digital de vinilo y música en español, con un buscador curado que usa el API de Discogs.

## Qué hay en la carpeta

```
vinilo-tracks/
├── server.js            ← servidor Node: sirve la página, buscador y fichas de Discogs
├── rutas/
│   ├── identificar.js   ← identificador de ediciones (rareza, precios, verificación)
│   └── cuenta.js        ← login con Supabase y wishlist en la nube
├── supabase.sql         ← crea la tabla de wishlist en Supabase
├── package.json
├── .env.example         ← copia como .env y pon tus llaves
├── data/
│   ├── artistas.json    ← lista blanca (rock en español)
│   └── lista-negra.json ← artistas que nunca salen
└── public/
    ├── index.html             ← home
    ├── resenas.html           ← /resenas  (todas las reseñas)
    ├── resena.html            ← /resenas/:slug  (template de una reseña)
    ├── noticias.html          ← /noticias (blog)
    ├── noticia.html           ← /noticias/:slug (template de una nota)
    ├── vinilo.html            ← /vinilo/:id  (ficha completa desde Discogs)
    ├── wishlist.html          ← /wishlist
    ├── identificar.html       ← /identificar (herramienta para coleccionistas)
    ├── auth-callback.html     ← a donde regresa el login con Google
    ├── about.html, 404.html
    ├── contenido/
    │   ├── resenas.json       ← AQUÍ escribes tus reseñas
    │   └── noticias.json      ← AQUÍ escribes tus noticias / posts
    ├── css/styles.css         ← todo el diseño
    ├── js/core.js             ← utilidades + wishlist
    ├── js/layout.js           ← header, footer y panel de wishlist (compartidos)
    ├── js/capsulas.js         ← cápsulas con video en loop
    ├── js/search.js           ← buscador
    ├── js/cuenta-ui.js        ← botón de cuenta y ventana de login
    ├── js/identificar.js      ← identificador + escáner de código de barras
    ├── js/(una por página)    ← home, resenas, resena, noticias, noticia, vinilo, wishlist-page
    └── img/
```

## Cómo correrlo en tu computadora

Necesitas Node.js 18 o más nuevo (`node -v` para revisar).

1. Abre la carpeta en VS Code y abre la terminal (`Ctrl + ñ` o `View → Terminal`).
2. Instala lo necesario:
   ```
   npm install
   ```
3. Saca tu token de Discogs en https://www.discogs.com/settings/developers → **Generate new token**.
4. Copia `.env.example`, renómbralo a `.env` y pega el token:
   ```
   DISCOGS_TOKEN=tu_token
   ```
5. Arranca el servidor:
   ```
   npm run dev
   ```
6. Abre http://localhost:3000

> Importante: abre la página desde `localhost:3000`, no con doble clic en `index.html`. Si la abres directo, el buscador no encuentra el servidor.

## Cómo funciona la curaduría

Discogs no tiene filtro de idioma, así que el servidor cura en tres pasos:

1. **Lista negra** (`data/lista-negra.json`): esos artistas nunca salen. Sirve para sacar bandas en inglés que se cuelen.
2. **Lista blanca** (`data/artistas.json`): unos 290 artistas de rock, pop rock y alternativo en español de 17 países. Siempre salen.
3. **Modo por país**: cualquier otro artista sale solo si el disco es de **Rock** y fue editado en un país hispanohablante.

Además: solo vinilo, sin límite de año (`ANIO_MINIMO=0` en `.env`), sin compilados de varios artistas, y las ediciones repetidas se juntan en una sola tarjeta. Los resultados se guardan 6 horas en caché.

Si ves algo que no debería salir, agrega el artista a `data/lista-negra.json`. Si falta alguien, agrégalo a `data/artistas.json`:

```json
{ "nombre": "Siddhartha", "pais": "México" }
```

Si en Discogs tiene otro nombre, usa `alias`:

```json
{ "nombre": "Patricio Rey Y Sus Redonditos De Ricota", "pais": "Argentina", "alias": ["Los Redondos"] }
```

Las dos listas se recargan solas al guardar, sin reiniciar el servidor.

## Agregar una reseña o noticia

Abre `public/contenido/resenas.json` (o `noticias.json`), copia un bloque completo y cambia los datos. El `slug` es lo que sale en la URL (`/resenas/mi-slug`), sin acentos ni espacios. El texto va en `cuerpo` como bloques:

```json
{ "p": "Un párrafo." }, { "h2": "Un subtítulo" }, { "lista": ["uno", "dos"] }
```

Cada reseña busca sola su vinilo en Discogs (por artista y título) para mostrar la ficha, el tracklist y el botón de guardar.

## Videos en las cápsulas

En `public/index.html`, cada cápsula tiene `data-youtube`, `data-start` y `data-end`. Puedes pegar el link completo de YouTube o solo el ID:

```html
<div class="cap" data-youtube="https://www.youtube.com/watch?v=AbC123xyz12" data-start="30" data-end="40">
  <img src="/img/capsula-0.webp" alt="">
</div>
```

O un video tuyo (guárdalo en `public/video/`):

```html
<div class="cap" data-video="/video/clip1.mp4" data-start="30" data-end="40">…</div>
```

El video corre del segundo 30 al 40, sin sonido, y se repite. Arranca cuando las cápsulas entran a la pantalla y se pausa cuando sales.

Si no se ve:
- Abre la página con `npm run dev` en `http://localhost:3000`. Con doble clic (file://) o con Live Server las páginas internas no funcionan.
- Algunos videos (sobre todo videoclips oficiales) no permiten insertarse en otros sitios. Abre la consola del navegador (F12): si sale "error 101" o "150", ese video está bloqueado y hay que usar otro.

## Identificador de vinilos (/identificar)

Para cuando tienes un disco en la mano (en una tienda, un tianguis o tu colección):

1. Escribes el **código de barras**, el **número de catálogo** o la **matriz**, o tocas **Escanear** para leer el código de barras con la cámara del celular.
2. Si hay varias ediciones con ese código, eliges la que coincide con tu disco (país, sello, formato).
3. Sale el reporte:
   - **Rareza** (Común, Poco común, Raro, Muy raro) con las razones: cuántos lo tienen, cuántos lo buscan, cuántas copias hay a la venta y si es promo, numerada, limitada o primera edición.
   - **Precio por condición** (Mint, NM, VG+, VG, G+), sugerido por Discogs según ventas pasadas.
   - **Primera edición o reedición**, comparando con el año original del disco.
   - **Verifica tu copia**: la matriz, el catálogo y los demás códigos que debe tener tu disco, y dónde buscarlos.
   - **Otras ediciones** del mismo disco, por si la tuya es otra.

Notas:
- El identificador funciona con **cualquier vinilo**, no solo rock en español.
- Los precios por condición solo salen si en tu cuenta de Discogs llenaste los datos de vendedor (discogs.com/settings/seller). Si no, sale el precio más bajo a la venta y el link al historial de ventas.
- La cámara funciona en `localhost` y en sitios con `https`. En iPhone usa una librería que se descarga sola la primera vez.
- La rareza es un cálculo propio con datos de la comunidad. Es una guía, no un avalúo.

## Login y wishlist en la nube (Supabase)

Sin configurar nada, la página funciona igual: la wishlist se guarda en el navegador y el botón de "Entrar" no aparece. Para activar las cuentas:

1. Crea una cuenta gratis en https://supabase.com y un proyecto nuevo.
2. Ve a **SQL Editor → New query**, pega todo el archivo `supabase.sql` y dale **Run**. Esto crea la tabla `wishlist` con seguridad por usuario (cada quien solo ve la suya).
3. Ve a **Project Settings → API** y copia:
   - **Project URL** → `SUPABASE_URL` en tu `.env`
   - **anon public** key → `SUPABASE_ANON_KEY` en tu `.env`
4. En **Authentication → URL Configuration**:
   - **Site URL**: `http://localhost:3000` (cuando lo subas, tu dominio real).
   - **Redirect URLs**: agrega `http://localhost:3000/auth/callback` (y luego `https://tudominio.com/auth/callback`).
5. Reinicia el servidor (`npm run dev`). Ya sale el botón de **Entrar**.

Por defecto Supabase pide **confirmar el correo** antes de entrar. Para pruebas lo puedes apagar en **Authentication → Providers → Email → Confirm email**.

**Entrar con Google (opcional):** en **Authentication → Providers → Google** actívalo y pega el Client ID y Secret que sacas en Google Cloud Console (Supabase te explica los pasos ahí mismo). Si no lo activas, el botón de Google da error, así que actívalo o quita el botón en `js/cuenta-ui.js`.

Cómo funciona por dentro:
- El navegador nunca habla con Supabase: habla con tu servidor (`rutas/cuenta.js`), que guarda la sesión en **cookies httpOnly**. JavaScript no las puede leer, así que un script malicioso no puede robar la sesión.
- Cuando alguien entra, lo que tenía guardado en el navegador se sube a su cuenta.
- Al cerrar sesión, la lista se borra del navegador (por si es una compu compartida). Sigue guardada en la cuenta.

## Subirlo a internet

Como tiene servidor Node, necesitas un hosting que corra Node.js: Render o Railway (tienen opción gratis o barata), o Hostinger Business / Cloud. El plan compartido de Hostinger (Single, Premium) no corre Node.

En el hosting agrega como variables de entorno `DISCOGS_TOKEN`, `SUPABASE_URL`, `SUPABASE_ANON_KEY` y `ANIO_MINIMO`. Nunca subas el archivo `.env`. Y en Supabase agrega tu dominio real en Site URL y Redirect URLs.
