/* =========================================================
   Vinilo Tracks — servidor
   - Sirve la página (carpeta /public)
   - /api/search   → busca vinilos de rock en español en Discogs (curado)
   - /api/release  → ficha completa de un vinilo
   - /api/artistas → lista curada (para los filtros)
   - /api/identificar → identificador de ediciones (rutas/identificar.js)
   - /api/auth, /api/wishlist → login y wishlist en la nube (rutas/cuenta.js)
   El token de Discogs vive aquí, nunca en el navegador.

   CÓMO SE CURA (en orden):
   1. data/lista-negra.json  → esos artistas NUNCA salen.
   2. data/artistas.json     → esos artistas SIEMPRE salen (rock, pop rock, alternativo en español).
   3. Cualquier otro artista → solo pasa si el disco es Rock (o Pop Rock / alternativo)
                               Y fue editado en un país hispanohablante.
   Sin límite de año (cámbialo con ANIO_MINIMO en .env si quieres).
   ========================================================= */
require("dotenv").config();
const express = require("express");
const path = require("path");
const fs = require("fs");

const app = express();
app.set("trust proxy", 1);       // necesario detrás de Render / Hostinger para saber si es https
app.use(express.json({ limit: "200kb" }));
const PORT = process.env.PORT || 3000;
const TOKEN = process.env.DISCOGS_TOKEN;
const AÑO_MIN = Number(process.env.ANIO_MINIMO || 0);
const UA = "ViniloTracks/1.0 +https://vinilotracks.com"; // Discogs exige un User-Agent propio

if (!TOKEN) console.warn("⚠️  Falta DISCOGS_TOKEN en el archivo .env — el buscador no va a funcionar.");

/* ---------- normalizar nombres: "Héroes Del Silencio (2)" → "heroes del silencio" ---------- */
const norm = s => (s || "")
  .normalize("NFD").replace(/[̀-ͯ]/g, "")
  .toLowerCase()
  .replace(/\s+\(\d+\)$/, "")
  .replace(/&/g, " y ")
  .replace(/[^a-z0-9ñ]+/g, " ")
  .trim();

/* ---------- países (como los escribe Discogs) ---------- */
const PAISES_ES = {
  "Mexico": "México", "Argentina": "Argentina", "Chile": "Chile", "Spain": "España", "Colombia": "Colombia",
  "Uruguay": "Uruguay", "Peru": "Perú", "Venezuela": "Venezuela", "Ecuador": "Ecuador", "Bolivia": "Bolivia",
  "Paraguay": "Paraguay", "Cuba": "Cuba", "Puerto Rico": "Puerto Rico", "Guatemala": "Guatemala",
  "Costa Rica": "Costa Rica", "Dominican Republic": "República Dominicana", "El Salvador": "El Salvador",
  "Honduras": "Honduras", "Nicaragua": "Nicaragua", "Panama": "Panamá"
};

/* ---------- listas curadas (se recargan solas si las editas) ---------- */
const archivoArtistas = path.join(__dirname, "data", "artistas.json");
const archivoNegra = path.join(__dirname, "data", "lista-negra.json");
let ARTISTAS = [];          // [{ nombre, pais, alias, clave, claves:Set }]
let MAPA = new Map();       // clave normalizada → artista curado
let NEGRA = new Set();      // claves normalizadas bloqueadas

function cargarListas() {
  try {
    ARTISTAS = JSON.parse(fs.readFileSync(archivoArtistas, "utf8")).map(a => ({ ...a, clave: norm(a.nombre) }));
    MAPA = new Map();
    ARTISTAS.forEach(a => [a.nombre, ...(a.alias || [])].forEach(n => MAPA.set(norm(n), a)));
    NEGRA = new Set(JSON.parse(fs.readFileSync(archivoNegra, "utf8")).map(norm));
    console.log(`🎛  ${ARTISTAS.length} artistas curados · ${NEGRA.size} en lista negra`);
  } catch (e) {
    console.error("❌ Error leyendo las listas de data/ (revisa comas y comillas del JSON):", e.message);
  }
}
cargarListas();
fs.watchFile(archivoArtistas, { interval: 2000 }, cargarListas);
fs.watchFile(archivoNegra, { interval: 2000 }, cargarListas);

/* ---------- caché simple en memoria ---------- */
const cache = new Map();
const HORAS = 6;
function desdeCache(clave) {
  const c = cache.get(clave);
  if (c && Date.now() - c.t < HORAS * 3600e3) return c.v;
  return null;
}

/* ---------- llamada a Discogs ---------- */
async function discogs(params) {
  const url = "https://api.discogs.com/database/search?" + new URLSearchParams(params);
  const r = await fetch(url, { headers: { "User-Agent": UA, Authorization: `Discogs token=${TOKEN}` } });
  if (r.status === 429) throw new Error("Discogs pidió esperar un momento (límite de peticiones).");
  if (!r.ok) throw new Error(`Discogs respondió ${r.status}`);
  return r.json();
}

/* ---------- reglas de género ---------- */
const ESTILOS_ROCK = /rock|alternative|indie|post-punk|punk|new wave|shoegaze|psychedelic|garage|grunge|britpop|ska|surf|beat|prog|krautrock|noise|dream pop|power pop|mod/i;
const esRock = r => (r.genre || []).includes("Rock") || (r.style || []).some(s => /pop rock|indie pop|alternative/i.test(s));
// los artistas de la lista también pueden venir como Pop o Latin en Discogs (ej. Café Tacvba), pero no electrónica pura, etc.
const esRockOPop = r => esRock(r) || (r.genre || []).some(g => g === "Pop" || g === "Latin");

/* Convierte un resultado de Discogs a nuestro formato y decide si pasa la curaduría */
function limpiar(res) {
  const [artistaRaw, ...resto] = (res.title || "").split(" - ");
  const artista = artistaRaw.replace(/\s+\(\d+\)$/, "").replace(/\*$/, "").trim();
  const clave = norm(artista);
  const anio = Number(res.year) || 0;
  if (!clave || NEGRA.has(clave)) return null;
  if (AÑO_MIN && anio && anio < AÑO_MIN) return null;
  if (/various/i.test(artista)) return null; // compilados de varios artistas

  const curado = MAPA.get(clave);
  let pais;
  if (curado) {
    if (!esRockOPop(res)) return null;
    pais = curado.pais;
  } else {
    // artista fuera de la lista: solo rock editado en un país hispanohablante
    const paisDisco = PAISES_ES[res.country];
    if (!paisDisco || !esRock(res)) return null;
    pais = paisDisco;
  }

  return {
    id: res.id,
    master: res.master_id || null,
    artista: curado ? curado.nombre : artista,
    titulo: resto.join(" - ") || res.title,
    anio,
    pais,
    generos: res.genre || [],
    estilos: res.style || [],
    portada: res.cover_image && !res.cover_image.includes("spacer.gif") ? res.cover_image : null,
    url: "https://www.discogs.com" + (res.uri || `/release/${res.id}`),
    fuente: curado ? "lista" : "pais"   // para que sepas de dónde salió (no se muestra)
  };
}

/* Quita repetidos: muchas ediciones del mismo disco → una sola tarjeta (se queda la que tenga portada) */
function sinRepetidos(lista) {
  const mapa = new Map();
  for (const r of lista) {
    const k = r.master || norm(r.artista + " " + r.titulo);
    const ya = mapa.get(k);
    if (!ya || (!ya.portada && r.portada)) mapa.set(k, ya ? { ...r, anio: Math.min(ya.anio || r.anio, r.anio || ya.anio) } : r);
  }
  return [...mapa.values()];
}

/* Todos los vinilos de un artista curado (con caché) */
async function vinilosDe(artista) {
  const clave = "artista:" + artista.clave;
  const hit = desdeCache(clave);
  if (hit) return hit;
  const data = await discogs({ artist: artista.nombre, format: "Vinyl", type: "release", per_page: 100 });
  const lista = sinRepetidos((data.results || []).map(limpiar).filter(Boolean));
  cache.set(clave, { t: Date.now(), v: lista });
  return lista;
}

/* Búsqueda libre (artista o disco que no está en la lista) */
async function busquedaLibre(q) {
  const clave = "q:" + norm(q);
  const hit = desdeCache(clave);
  if (hit) return hit;
  const data = await discogs({ q, format: "Vinyl", type: "release", per_page: 100 });
  const lista = sinRepetidos((data.results || []).map(limpiar).filter(Boolean));
  cache.set(clave, { t: Date.now(), v: lista });
  return lista;
}

/* Corre tareas de 3 en 3 para no saturar a Discogs */
async function enGrupos(items, fn, n = 3) {
  const out = [];
  for (let i = 0; i < items.length; i += n) {
    out.push(...(await Promise.allSettled(items.slice(i, i + n).map(fn))));
  }
  return out.flatMap(r => (r.status === "fulfilled" ? r.value : []));
}

/* filtros del buscador: Rock / Alternativo / Pop Rock */
const pasaGenero = (r, g) =>
  !g ||
  (g === "Rock" && r.generos.includes("Rock")) ||
  (g === "Alternativo" && r.estilos.some(s => /alternative|indie|post-rock|post-punk|shoegaze|psychedelic|garage|grunge|dream pop/i.test(s))) ||
  (g === "Pop Rock" && (r.estilos.some(s => /pop rock|power pop|new wave|indie pop|britpop/i.test(s)) || r.generos.includes("Pop")));

/* ---------- rutas ---------- */
app.get("/api/artistas", (req, res) => {
  res.json(ARTISTAS.map(({ nombre, pais }) => ({ nombre, pais })));
});

app.get("/api/search", async (req, res) => {
  if (!TOKEN) return res.status(500).json({ error: "Falta configurar el token de Discogs en el servidor." });
  const q = (req.query.q || "").trim().slice(0, 80);
  const { genre = "", country = "", sort = "new" } = req.query;

  try {
    let resultados;

    if (q) {
      const nq = norm(q);
      // 1) artistas de la lista que coinciden con lo que escribieron
      const porNombre = nq.length >= 3
        ? ARTISTAS.filter(a => [a.nombre, ...(a.alias || [])].some(n => { const k = norm(n); return k.includes(nq) || nq.includes(k); }))
        : [];
      // 2) búsqueda libre en Discogs (discos por título y artistas fuera de la lista)
      const [deLista, libres] = await Promise.all([
        enGrupos(porNombre.slice(0, 4), vinilosDe),
        busquedaLibre(q).catch(() => [])
      ]);
      resultados = [...deLista, ...libres];
    } else {
      // sin texto: selección del día con 6 artistas de la lista (rota cada día)
      const candidatos = ARTISTAS.filter(a => !country || a.pais === country);
      const dia = Math.floor(Date.now() / 864e5);
      const rotados = candidatos.map((a, i) => ({ a, k: (i * 7919 + dia * 104729) % (candidatos.length * 31 + 7) }))
        .sort((x, y) => x.k - y.k).slice(0, 6).map(x => x.a);
      resultados = await enGrupos(rotados, vinilosDe);
    }

    resultados = sinRepetidos(resultados)
      .filter(r => !country || r.pais === country)
      .filter(r => pasaGenero(r, genre));

    // los artistas que coinciden con la búsqueda van primero
    const nq = norm(q);
    const relevancia = r => (q && norm(r.artista).includes(nq) ? 0 : 1);
    resultados.sort((a, b) =>
      relevancia(a) - relevancia(b) ||
      (sort === "old" ? (a.anio || 9999) - (b.anio || 9999) :
       sort === "az"  ? a.artista.localeCompare(b.artista) || a.anio - b.anio :
                        (b.anio || 0) - (a.anio || 0))
    );
    res.json({ total: resultados.length, results: resultados.slice(0, 60) });
  } catch (err) {
    console.error(err);
    res.status(502).json({ error: err.message || "No pudimos hablar con Discogs." });
  }
});

/* ---------- GET genérico a Discogs (releases, masters, marketplace) ---------- */
async function discogsGet(ruta, { opcional = false } = {}) {
  const r = await fetch("https://api.discogs.com" + ruta, {
    headers: { "User-Agent": UA, Authorization: `Discogs token=${TOKEN}` }
  });
  if (r.status === 429) throw new Error("Discogs pidió esperar un momento (límite de peticiones).");
  if (!r.ok) {
    if (opcional) return null;
    const e = new Error(r.status === 404 ? "Ese disco no existe en Discogs." : `Discogs respondió ${r.status}`);
    e.status = r.status;
    throw e;
  }
  return r.json();
}

/* ---------- ficha completa de un vinilo ---------- */
const limpiarTexto = s => (s || "")
  .replace(/\[url=[^\]]*\]([^\[]*)\[\/url\]/gi, "$1")
  .replace(/\[(a|l|m|r)=([^\]]+)\]/gi, "$2")
  .replace(/\[(a|l|m|r)\d+\]/gi, "")
  .replace(/\[\/?[a-z]+\]/gi, "")
  .trim();
const sinNumero = s => (s || "").replace(/\s+\(\d+\)$/, "").replace(/\*$/, "");

async function obtenerFicha(id) {
  const clave = "release:" + id;
  const hit = desdeCache(clave);
  if (hit) return hit;
  const d = await discogsGet(`/releases/${id}?curr_abbr=USD`);
  const ficha = {
    id: d.id,
    master: d.master_id || null,
    titulo: d.title,
    artistas: (d.artists || []).map(a => sinNumero(a.name)),
    anio: d.year || null,
    lanzamiento: d.released_formatted || d.released || null,
    pais: d.country || null,
    generos: d.genres || [],
    estilos: d.styles || [],
    sellos: (d.labels || []).map(l => ({ nombre: sinNumero(l.name), catalogo: l.catno })),
    formatos: (d.formats || []).map(f => ({ nombre: f.name, cantidad: f.qty, detalles: f.descriptions || [], texto: f.text || "" })),
    tracklist: (d.tracklist || []).map(t => ({ tipo: t.type_, posicion: t.position, titulo: t.title, duracion: t.duration })),
    creditos: (d.extraartists || []).map(c => ({ nombre: sinNumero(c.name), rol: c.role })),
    companias: (d.companies || []).map(c => ({ nombre: sinNumero(c.name), rol: c.entity_type_name })),
    identificadores: (d.identifiers || []).map(i => ({ tipo: i.type, valor: i.value, nota: i.description || "" })),
    notas: limpiarTexto(d.notes),
    imagenes: (d.images || []).map(i => ({ url: i.uri, chica: i.uri150, ancho: i.width, alto: i.height })),
    videos: (d.videos || []).map(v => ({ url: v.uri, titulo: v.title, duracion: v.duration })),
    comunidad: {
      tienen: d.community?.have ?? null,
      quieren: d.community?.want ?? null,
      rating: d.community?.rating?.average ?? null,
      votos: d.community?.rating?.count ?? null
    },
    venta: { desde: d.lowest_price ?? null, enVenta: d.num_for_sale ?? 0 },
    url: d.uri,
    urlVenta: `https://www.discogs.com/sell/release/${d.id}`
  };
  cache.set(clave, { t: Date.now(), v: ficha });
  return ficha;
}

app.get("/api/release/:id", async (req, res) => {
  if (!TOKEN) return res.status(500).json({ error: "Falta configurar el token de Discogs en el servidor." });
  const id = String(req.params.id).replace(/\D/g, "");
  if (!id) return res.status(400).json({ error: "ID de disco inválido." });
  try {
    res.json(await obtenerFicha(id));
  } catch (err) {
    console.error(err.message);
    res.status(err.status === 404 ? 404 : 502).json({ error: err.message || "No pudimos hablar con Discogs." });
  }
});

/* ---------- encontrar el vinilo de una reseña (artista + título) ---------- */
app.get("/api/match", async (req, res) => {
  if (!TOKEN) return res.status(500).json({ error: "Falta el token de Discogs." });
  const artista = (req.query.artista || "").slice(0, 80);
  const titulo = (req.query.titulo || "").slice(0, 120);
  if (!artista || !titulo) return res.status(400).json({ error: "Faltan artista o título." });
  const clave = "match:" + norm(artista + "|" + titulo);
  const hit = desdeCache(clave);
  if (hit) return res.json(hit);
  try {
    const data = await discogs({ artist: artista, release_title: titulo, format: "Vinyl", type: "release", per_page: 10 });
    const primero = (data.results || [])[0];
    const out = primero ? { id: primero.id, portada: primero.cover_image } : { id: null };
    cache.set(clave, { t: Date.now(), v: out });
    res.json(out);
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

/* ---------- identificador de vinilos y login (en la carpeta rutas/) ---------- */
app.use("/api/identificar", require("./rutas/identificar")({ discogs, discogsGet, obtenerFicha, desdeCache, cache, sinNumero, tokenListo: () => !!TOKEN }));
app.use("/api", require("./rutas/cuenta")());

/* ---------- páginas con URL limpia ---------- */
/* SELLO DE VERSIÓN: a cada /js/... y /css/... de las páginas le agregamos ?v=<versión>.
   En cada deploy la versión cambia (Render da el commit en RENDER_GIT_COMMIT), así el
   navegador de cada visitante baja el código nuevo en vez de usar el que tenía guardado. */
const VERSION = (process.env.RENDER_GIT_COMMIT || Date.now().toString(36)).slice(0, 8);
const EN_PRODUCCION = !!process.env.RENDER || process.env.NODE_ENV === "production";
const paginasListas = new Map();
function enviarPagina(res, archivo, status = 200) {
  let html = paginasListas.get(archivo);
  if (!html) {
    html = fs.readFileSync(path.join(__dirname, "public", archivo), "utf8")
      .replace(/((?:src|href)="\/(?:js|css)\/[^"?]+\.(?:js|css))"/g, `$1?v=${VERSION}"`);
    if (EN_PRODUCCION) paginasListas.set(archivo, html); // en tu compu se relee siempre, para ver tus cambios
  }
  res.set("Cache-Control", "no-cache");
  res.status(status).type("html").send(html);
}
const pagina = archivo => (req, res) => enviarPagina(res, archivo);
app.get(["/", "/index.html"], pagina("index.html"));
app.get("/resenas", pagina("resenas.html"));
app.get("/resenas/:slug", pagina("resena.html"));
app.get("/noticias", pagina("noticias.html"));
app.get("/noticias/:slug", pagina("noticia.html"));
app.get("/vinilo/:id", pagina("vinilo.html"));
app.get("/wishlist", pagina("wishlist.html"));
app.get("/identificar", pagina("identificar.html"));
app.get("/about", pagina("about.html"));
app.get("/auth/callback", pagina("auth-callback.html"));

app.use(express.static(path.join(__dirname, "public")));
app.use((req, res) => enviarPagina(res, "404.html", 404));

app.listen(PORT, () => console.log(`🟢 Vinilo Tracks corriendo en http://localhost:${PORT} · versión ${VERSION}`));
