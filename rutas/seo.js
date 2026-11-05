/* =========================================================
   Vinilo Tracks — SEO y accesibilidad del lado del servidor
   ---------------------------------------------------------
   Antes de mandar cada página, el servidor le pone:
   - <title> y descripción pensados para Google (uno distinto por página)
   - URL canónica, robots, Open Graph y Twitter Card (vista previa al compartir
     en WhatsApp, Facebook, X, iMessage…)
   - Datos estructurados (JSON-LD): Review, BlogPosting, MusicAlbum, migas de pan…
   - Íconos, manifest y color del tema
   - El contenido COMPLETO de cada reseña y nota ya escrito en el HTML
     (Google lo lee sin esperar al JavaScript y carga más rápido para la gente)
   - Imágenes responsivas: cada pantalla baja el tamaño que necesita (srcset)
   - Link "Saltar al contenido" para quien navega con teclado o lector de pantalla
   Además: /robots.txt, /sitemap.xml, /feed.xml y redirecciones 301.

   Tu dominio se toma de SITE_URL en el .env (si no está, usa https://vinilotracks.com).
   ========================================================= */
const fs = require("fs");
const path = require("path");

module.exports = function crearSeo({ raiz, obtenerFicha, tokenListo }) {
  const SITIO = (process.env.SITE_URL || "https://vinilotracks.com").replace(/\/+$/, "");
  const HOST = new URL(SITIO).host;
  const MARCA = "Vinilo Tracks";
  const OG_DEFAULT = "/img/og-vinilotracks.jpg";

  /* ---------- lectura de archivos (se recargan solos si cambian) ---------- */
  const cacheArchivos = new Map();
  function leerJSON(rel, defecto) {
    const ruta = path.join(raiz, rel);
    try {
      const t = fs.statSync(ruta).mtimeMs;
      const hit = cacheArchivos.get(ruta);
      if (hit && hit.t === t) return hit.v;
      const v = JSON.parse(fs.readFileSync(ruta, "utf8"));
      cacheArchivos.set(ruta, { t, v });
      return v;
    } catch { return defecto; }
  }
  const porFecha = l => [...l].sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)));
  const resenas = () => porFecha(leerJSON("public/contenido/resenas.json", []));
  const noticias = () => porFecha(leerJSON("public/contenido/noticias.json", []));
  const imagenes = () => leerJSON("data/imagenes.json", {});

  /* ---------- utilidades ---------- */
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const abs = u => !u ? "" : /^https?:\/\//.test(u) ? u : SITIO + (u.startsWith("/") ? u : "/" + u);
  const recortar = (s, n = 158) => { s = String(s || "").replace(/\s+/g, " ").trim(); return s.length <= n ? s : s.slice(0, n - 1).replace(/\s+\S*$/, "") + "…"; };
  const fecha = iso => { try { return new Date(iso + "T12:00:00").toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" }).replace(".", ""); } catch { return iso; } };
  const fechaISO = iso => /^\d{4}-\d{2}-\d{2}$/.test(iso || "") ? `${iso}T12:00:00-08:00` : iso;
  const ld = obj => `<script type="application/ld+json">${JSON.stringify(obj).replace(/</g, "\\u003c")}</script>`;
  const palabrasDe = bloques => (bloques || []).map(b => b.p || b.h2 || b.cita || (b.lista || []).join(" ") || (b.items || []).map(i => `${i.t} ${i.d}`).join(" ")).join(" ").split(/\s+/).filter(Boolean).length;

  /* ---------- imágenes responsivas ---------- */
  function srcsetDe(src) {
    const m = imagenes()[src];
    if (!m) return null;
    const base = src.replace(/^\/img\//, "").replace(/\.[a-z]+$/i, "");
    const partes = (m.v || []).map(w => `/img/r/${base}-${w}.webp ${w}w`);
    return { srcset: partes.length ? [...partes, `${src} ${m.w}w`].join(", ") : "", w: m.w, h: m.h };
  }
  function img(src, alt = "", o = {}) {
    const m = srcsetDe(src);
    return `<img src="${esc(src)}"${m && m.srcset ? ` srcset="${m.srcset}" sizes="${o.sizes || "100vw"}"` : ""}${m ? ` width="${m.w}" height="${m.h}"` : ""} alt="${esc(alt)}"${o.prioridad ? ' fetchpriority="high"' : ' loading="lazy"'} decoding="async">`;
  }
  /* agrega srcset/width/height a los <img src="/img/..."> escritos a mano en los HTML */
  function mejorarImagenes(html) {
    return html.replace(/<img\b([^>]*?)\ssrc="(\/img\/[^"?]+)"([^>]*)>/g, (todo, antes, src, despues) => {
      const attrs = antes + despues;
      if (/\ssrcset=/.test(attrs)) return todo;
      const m = srcsetDe(src);
      if (!m) return todo;
      const sizes = (attrs.match(/\sdata-sizes="([^"]+)"/) || [])[1] || "100vw";
      let extra = "";
      if (m.srcset) extra += ` srcset="${m.srcset}" sizes="${sizes}"`;
      if (!/\swidth=/.test(attrs)) extra += ` width="${m.w}" height="${m.h}"`;
      if (!/\sloading=/.test(attrs) && !/fetchpriority=/.test(attrs)) extra += ' loading="lazy"';
      if (!/\sdecoding=/.test(attrs)) extra += ' decoding="async"';
      return `<img${antes.replace(/\sdata-sizes="[^"]*"/, "")} src="${src}"${extra}${despues.replace(/\sdata-sizes="[^"]*"/, "")}>`;
    });
  }

  /* ---------- plantillas (iguales a las del navegador, en js/core.js) ---------- */
  const cuerpo = bloques => (bloques || []).map(b =>
    b.h2 ? `<h2>${esc(b.h2)}</h2>` :
    b.lista ? `<ol>${b.lista.map(i => `<li>${esc(i)}</li>`).join("")}</ol>` :
    b.items ? `<ol class="picks">${b.items.map(i => `<li><strong>${esc(i.t)}</strong><span>${esc(i.d)}</span></li>`).join("")}</ol>` :
    b.cita ? `<blockquote>${esc(b.cita)}</blockquote>` :
    `<p>${esc(b.p)}</p>`
  ).join("");

  const SIZES_TARJETA = "(max-width: 700px) 92vw, (max-width: 1100px) 46vw, 30vw";
  const tarjetaResena = r => `
    <article class="card">
      <a class="card-link" href="/resenas/${esc(r.slug)}">
        <div class="cover">${img(r.portada, `Portada del disco ${r.titulo} de ${r.artista}`, { sizes: SIZES_TARJETA })}<span class="score"><span class="sr-only">Calificación: </span>${Number(r.calificacion).toFixed(1)}<span class="sr-only"> de 10</span></span></div>
        <span class="meta">${esc(r.anio)} · ${esc(r.pais)} · ${esc(r.estilo)}</span>
        <h3>${esc(r.artista)} — ${esc(r.titulo)}</h3>
        <p>${esc(r.extracto)}</p>
        <span class="read" aria-hidden="true">Leer reseña →</span>
      </a>
    </article>`;
  const tarjetaNoticia = n => `
    <article class="post">
      <a class="card-link" href="/noticias/${esc(n.slug)}">
        <div class="post-img">${img(n.imagen, "", { sizes: SIZES_TARJETA })}</div>
        <div class="post-txt">
          <span class="meta">${esc(n.categoria)} · <time datetime="${esc(n.fecha)}">${fecha(n.fecha)}</time></span>
          <h3>${esc(n.titulo)}</h3>
          <p>${esc(n.extracto)}</p>
          <span class="read" aria-hidden="true">Leer nota →</span>
        </div>
      </a>
    </article>`;

  function htmlResena(r, lista) {
    const minutos = Math.max(1, Math.round(palabrasDe(r.cuerpo) / 200));
    return `
    <article class="review" data-ssr>
      <div class="wrap review-hero">
        <div class="review-cover">
          ${img(r.portada, `Portada del disco ${r.titulo} de ${r.artista}`, { sizes: "(max-width: 900px) 92vw, 42vw", prioridad: true })}
        </div>
        <div class="review-head">
          <a class="crumb mono" href="/resenas">← Reseñas</a>
          <span class="eyebrow">${esc(r.estilo)} · ${esc(r.anio)} · ${esc(r.pais)}</span>
          <h1>${esc(r.titulo)}</h1>
          <p class="review-artist">${esc(r.artista)}</p>
          <div class="review-score" role="img" aria-label="Calificación: ${Number(r.calificacion).toFixed(1)} de 10"><b aria-hidden="true">${Number(r.calificacion).toFixed(1)}</b><span class="mono" aria-hidden="true">/ 10</span></div>
          <p class="review-lede">${esc(r.extracto)}</p>
          <div class="review-meta mono">${esc(r.autor)} · <time datetime="${esc(r.fecha)}">${fecha(r.fecha)}</time> · ${minutos} min de lectura</div>
          <div class="review-actions" id="acciones" aria-live="polite"><span class="mono muted">Buscando el vinilo en Discogs…</span></div>
        </div>
      </div>

      <div class="wrap review-body">
        <aside class="review-side">
          <blockquote class="pull">“${esc(r.cita)}”</blockquote>
          <div class="ficha" id="ficha"></div>
        </aside>
        <div class="prose">${cuerpo(r.cuerpo)}</div>
      </div>
    </article>

    <section class="wrap more-section" aria-labelledby="mas-resenas">
      <div class="head head-sm"><h2 id="mas-resenas">Más reseñas</h2><a class="pill" href="/resenas">Ver todas</a></div>
      <div class="grid">${lista.filter(x => x.slug !== r.slug).slice(0, 3).map(tarjetaResena).join("")}</div>
    </section>`;
  }

  function htmlNoticia(n, lista) {
    return `
    <article class="article" data-ssr>
      <div class="hero-bleed">
        <div class="article-hero">
          ${img(n.imagen, "", { sizes: "100vw", prioridad: true })}
          <div class="article-hero-txt">
            <a class="crumb mono" href="/noticias">← Blog &amp; Noticias</a>
            <span class="eyebrow">${esc(n.categoria)}</span>
            <h1>${esc(n.titulo)}</h1>
            <div class="mono">${esc(n.autor)} · <time datetime="${esc(n.fecha)}">${fecha(n.fecha)}</time></div>
          </div>
        </div>
      </div>
      <div class="wrap article-body">
        <p class="article-lede">${esc(n.extracto)}</p>
        <div class="prose">${cuerpo(n.cuerpo)}</div>
      </div>
    </article>
    <section class="wrap more-section" aria-labelledby="sigue-leyendo">
      <div class="head head-sm"><h2 id="sigue-leyendo">Sigue leyendo</h2><a class="pill" href="/noticias">Todas las notas</a></div>
      <div class="news-grid">${lista.filter(x => x.slug !== n.slug).slice(0, 3).map(tarjetaNoticia).join("")}</div>
    </section>`;
  }

  /* ---------- datos estructurados base ---------- */
  const ORG = {
    "@type": "Organization", "@id": SITIO + "/#org", name: MARCA, url: SITIO + "/",
    logo: { "@type": "ImageObject", url: abs("/img/icon-512.png"), width: 512, height: 512 },
    description: "Revista digital de vinilo y música en español, curada desde Los Angeles.",
    ...(process.env.REDES ? { sameAs: process.env.REDES.split(",").map(s => s.trim()).filter(Boolean) } : {})
  };
  const WEB = { "@type": "WebSite", "@id": SITIO + "/#web", name: MARCA, url: SITIO + "/", inLanguage: "es", publisher: { "@id": SITIO + "/#org" } };
  const migas = items => ({
    "@type": "BreadcrumbList",
    itemListElement: items.map(([nombre, url], i) => ({ "@type": "ListItem", position: i + 1, name: nombre, item: abs(url) }))
  });
  const autorLD = nombre => /redacci[oó]n/i.test(nombre || "") ? { "@id": SITIO + "/#org" } : { "@type": "Person", name: nombre || MARCA, url: SITIO + "/about" };

  /* ---------- metadatos de cada página ---------- */
  const ESTATICAS = {
    "/": {
      titulo: "Vinilo Tracks · Vinilos y música en español: reseñas, noticias y buscador",
      desc: "Revista digital de vinilo en español: reseñas de discos, guías para coleccionistas y un buscador curado de vinilos de rock, pop y alternativo de México, Argentina, España y Latinoamérica.",
      ld: [{ "@type": "WebPage", "@id": SITIO + "/#home", url: SITIO + "/", name: MARCA, isPartOf: { "@id": SITIO + "/#web" }, about: "Vinilos y música en español" }]
    },
    "/resenas": {
      titulo: "Reseñas de discos y vinilos en español · Vinilo Tracks",
      desc: "Reseñas de discos de rock, pop y alternativo en español: el sonido, las canciones, la edición en vinilo y una calificación honesta. De Pescado Rabioso a Odisseo.",
      lista: () => resenas().map(r => `/resenas/${r.slug}`), migas: [["Inicio", "/"], ["Reseñas", "/resenas"]]
    },
    "/noticias": {
      titulo: "Blog de vinilos: guías, listas y noticias · Vinilo Tracks",
      desc: "Guías para coleccionistas de vinilos, listas de discos esenciales en español y noticias: cómo empezar tu colección, cómo limpiar vinilos y cómo leer una ficha de Discogs.",
      lista: () => noticias().map(n => `/noticias/${n.slug}`), migas: [["Inicio", "/"], ["Blog & Noticias", "/noticias"]]
    },
    "/identificar": {
      titulo: "Identifica tu vinilo, CD o casete: edición, rareza y precio · Vinilo Tracks",
      desc: "Escanea el código de barras o escribe el número de catálogo de tu disco y descubre qué edición es, si es rara y cuánto vale. Gratis, para vinilos, CDs y casetes.",
      ld: [{
        "@type": "WebApplication", name: "Identificador de discos de Vinilo Tracks", url: SITIO + "/identificar",
        applicationCategory: "UtilitiesApplication", operatingSystem: "Web", inLanguage: ["es", "en"],
        offers: { "@type": "Offer", price: "0", priceCurrency: "USD" }, publisher: { "@id": SITIO + "/#org" }
      }],
      migas: [["Inicio", "/"], ["Identificador", "/identificar"]]
    },
    "/about": {
      titulo: "Sobre Vinilo Tracks: revista de vinilo y música en español",
      desc: "Qué es Vinilo Tracks, quién está detrás y cómo curamos la música: rock, pop y alternativo en español, desde Los Angeles para coleccionistas y escuchas pacientes.",
      ld: [{ "@type": "AboutPage", url: SITIO + "/about", name: "Sobre Vinilo Tracks", isPartOf: { "@id": SITIO + "/#web" } }],
      migas: [["Inicio", "/"], ["About", "/about"]]
    },
    "/wishlist": { titulo: "Tu wishlist · Vinilo Tracks", desc: "Los vinilos que quieres conseguir.", noindex: true },
    "/auth/callback": { titulo: "Entrando · Vinilo Tracks", desc: "Iniciando sesión.", noindex: true }
  };

  async function metaDe(req, archivo, status) {
    const ruta = req.path.replace(/\/+$/, "") || "/";
    const base = { url: ruta, imagen: OG_DEFAULT, tipo: "website", ld: [], status, contenido: null };

    if (status === 404 || archivo === "404.html")
      return { ...base, titulo: "Página no encontrada · Vinilo Tracks", desc: "Esta página no existe o se movió.", noindex: true, url: null, status: 404 };

    if (archivo === "resena.html") {
      const lista = resenas();
      const slug = decodeURIComponent(ruta.split("/").pop());
      const r = lista.find(x => x.slug === slug);
      if (!r) return metaDe(req, "404.html", 404);
      return {
        ...base, tipo: "article", imagen: r.portada,
        titulo: `${r.artista} – ${r.titulo} (${r.anio}): reseña del disco · Vinilo Tracks`,
        desc: recortar(r.extracto),
        articulo: { publicado: r.fecha, seccion: "Reseñas", autor: r.autor, tags: [r.artista, r.titulo, r.genero, r.estilo].filter(Boolean) },
        contenido: htmlResena(r, lista),
        precarga: r.portada,
        ld: [
          {
            "@type": "Review", "@id": abs(ruta) + "#review", url: abs(ruta), inLanguage: "es",
            name: `Reseña de ${r.titulo} de ${r.artista}`, headline: `${r.artista} – ${r.titulo}`,
            description: r.extracto, reviewBody: (r.cuerpo || []).map(b => b.p).filter(Boolean).join("\n\n"),
            datePublished: fechaISO(r.fecha), author: autorLD(r.autor), publisher: { "@id": SITIO + "/#org" },
            image: abs(r.portada),
            reviewRating: { "@type": "Rating", ratingValue: r.calificacion, bestRating: 10, worstRating: 0 },
            itemReviewed: {
              "@type": "MusicAlbum", name: r.titulo, image: abs(r.portada),
              byArtist: { "@type": "MusicGroup", name: r.artista },
              ...(r.anio ? { datePublished: String(r.anio) } : {}), ...(r.genero ? { genre: r.genero } : {})
            }
          },
          migas([["Inicio", "/"], ["Reseñas", "/resenas"], [`${r.artista} – ${r.titulo}`, ruta]])
        ]
      };
    }

    if (archivo === "noticia.html") {
      const lista = noticias();
      const slug = decodeURIComponent(ruta.split("/").pop());
      const n = lista.find(x => x.slug === slug);
      if (!n) return metaDe(req, "404.html", 404);
      return {
        ...base, tipo: "article", imagen: n.imagen,
        titulo: `${n.titulo} · Vinilo Tracks`, desc: recortar(n.extracto),
        articulo: { publicado: n.fecha, seccion: n.categoria, autor: n.autor, tags: [n.categoria] },
        contenido: htmlNoticia(n, lista),
        precarga: n.imagen,
        ld: [
          {
            "@type": "BlogPosting", "@id": abs(ruta) + "#post", url: abs(ruta), mainEntityOfPage: abs(ruta), inLanguage: "es",
            headline: n.titulo.slice(0, 110), description: n.extracto, image: [abs(n.imagen)],
            datePublished: fechaISO(n.fecha), dateModified: fechaISO(n.actualizado || n.fecha),
            author: autorLD(n.autor), publisher: { "@id": SITIO + "/#org" },
            articleSection: n.categoria, wordCount: palabrasDe(n.cuerpo)
          },
          migas([["Inicio", "/"], ["Blog & Noticias", "/noticias"], [n.titulo, ruta]])
        ]
      };
    }

    if (archivo === "vinilo.html") {
      const id = ruta.split("/").pop().replace(/\D/g, "");
      let d = null;
      if (id && tokenListo()) {
        try { d = await Promise.race([obtenerFicha(id), new Promise((_, no) => setTimeout(() => no(new Error("tarde")), 2500))]); }
        catch (e) { if (e.status === 404) return metaDe(req, "404.html", 404); }
      }
      if (!d) return { ...base, titulo: "Ficha del vinilo · Vinilo Tracks", desc: "Ficha completa del vinilo: tracklist, créditos, sello, códigos y precio." };
      const artista = (d.artistas || []).join(", ");
      const sello = d.sellos?.[0];
      const formato = d.formatos?.[0] ? [d.formatos[0].nombre, ...(d.formatos[0].detalles || [])].join(", ") : "";
      const pistas = (d.tracklist || []).filter(t => t.tipo !== "heading");
      const portada = d.imagenes?.[0]?.url || OG_DEFAULT;
      return {
        ...base, imagen: portada,
        titulo: `${artista} – ${d.titulo}${d.anio ? ` (${d.anio})` : ""}: vinilo, tracklist y precio · Vinilo Tracks`,
        desc: recortar(`${d.titulo} de ${artista}${d.pais ? `, edición de ${d.pais}` : ""}${d.anio ? ` (${d.anio})` : ""}${formato ? ` en ${formato}` : ""}${sello ? `, sello ${sello.nombre}` : ""}. Tracklist completo, créditos, códigos de la matriz y precio de referencia.`),
        ld: [
          {
            "@type": "MusicAlbum", url: abs(ruta), name: d.titulo, image: portada,
            byArtist: (d.artistas || []).map(a => ({ "@type": "MusicGroup", name: a })),
            ...(d.anio ? { datePublished: String(d.anio) } : {}),
            ...(d.generos?.length ? { genre: d.generos } : {}),
            ...(pistas.length ? { numTracks: pistas.length, track: pistas.slice(0, 40).map((t, i) => ({ "@type": "MusicRecording", position: i + 1, name: t.titulo })) } : {}),
            ...(sello ? { albumRelease: { "@type": "MusicRelease", name: d.titulo, recordLabel: { "@type": "Organization", name: sello.nombre }, catalogNumber: sello.catalogo, musicReleaseFormat: /vinyl/i.test(formato) ? "https://schema.org/VinylFormat" : undefined } } : {})
          },
          migas([["Inicio", "/"], ["Buscador", "/#buscador"], [`${artista} – ${d.titulo}`, ruta]])
        ]
      };
    }

    const e = ESTATICAS[ruta];
    if (!e) return { ...base, titulo: `${MARCA}`, desc: ESTATICAS["/"].desc };
    const ldExtra = [...(e.ld || [])];
    if (e.lista) ldExtra.push({
      "@type": "CollectionPage", url: abs(ruta), name: e.titulo.split(" · ")[0], isPartOf: { "@id": SITIO + "/#web" },
      mainEntity: { "@type": "ItemList", itemListElement: e.lista().map((u, i) => ({ "@type": "ListItem", position: i + 1, url: abs(u) })) }
    });
    if (e.migas) ldExtra.push(migas(e.migas));
    return { ...base, titulo: e.titulo, desc: e.desc, noindex: !!e.noindex, url: e.noindex ? null : ruta, ld: ldExtra, precarga: ruta === "/" ? "/img/singer.png" : null };
  }

  /* ---------- armar la página final ---------- */
  async function preparar(req, archivo, html, status = 200) {
    const m = await metaDe(req, archivo, status);
    const canon = m.url ? abs(m.url === "/" ? "/" : m.url) : null;
    const imagen = abs(m.imagen);
    const dims = srcsetDe(m.imagen);

    const head = [
      `<meta name="robots" content="${m.noindex ? "noindex, follow" : "index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1"}">`,
      canon && `<link rel="canonical" href="${canon}">`,
      `<meta name="theme-color" content="#060706">`,
      `<meta name="color-scheme" content="dark">`,
      `<link rel="icon" href="/favicon.svg" type="image/svg+xml">`,
      `<link rel="icon" href="/img/icon-48.png" sizes="48x48" type="image/png">`,
      `<link rel="apple-touch-icon" href="/img/icon-180.png">`,
      `<link rel="manifest" href="/site.webmanifest">`,
      `<link rel="alternate" type="application/rss+xml" title="Vinilo Tracks: reseñas y notas" href="${SITIO}/feed.xml">`,
      /* Open Graph (Facebook, WhatsApp, iMessage, LinkedIn…) */
      `<meta property="og:site_name" content="${MARCA}">`,
      `<meta property="og:locale" content="es_MX">`,
      `<meta property="og:type" content="${m.tipo}">`,
      `<meta property="og:title" content="${esc(m.titulo.replace(/ · Vinilo Tracks$/, ""))}">`,
      `<meta property="og:description" content="${esc(m.desc)}">`,
      canon && `<meta property="og:url" content="${canon}">`,
      `<meta property="og:image" content="${esc(imagen)}">`,
      dims && `<meta property="og:image:width" content="${dims.w}"><meta property="og:image:height" content="${dims.h}">`,
      m.imagen === OG_DEFAULT && `<meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">`,
      `<meta property="og:image:alt" content="${esc(m.titulo.replace(/ · Vinilo Tracks$/, ""))}">`,
      m.articulo && `<meta property="article:published_time" content="${esc(fechaISO(m.articulo.publicado))}">`,
      m.articulo && `<meta property="article:section" content="${esc(m.articulo.seccion)}">`,
      m.articulo && m.articulo.tags.map(t => `<meta property="article:tag" content="${esc(t)}">`).join(""),
      /* X / Twitter */
      `<meta name="twitter:card" content="summary_large_image">`,
      `<meta name="twitter:title" content="${esc(m.titulo.replace(/ · Vinilo Tracks$/, ""))}">`,
      `<meta name="twitter:description" content="${esc(m.desc)}">`,
      `<meta name="twitter:image" content="${esc(imagen)}">`,
      /* la imagen principal se pide antes que todo lo demás (carga más rápida) */
      m.precarga && (() => { const p = srcsetDe(m.precarga); return `<link rel="preload" as="image" href="${esc(m.precarga)}"${p && p.srcset ? ` imagesrcset="${p.srcset}" imagesizes="${m.precarga === "/img/singer.png" ? "(max-width: 700px) 92vw, min(720px, 50vw)" : "(max-width: 900px) 92vw, 42vw"}"` : ""} fetchpriority="high">`; })(),
      /* datos estructurados */
      ld({ "@context": "https://schema.org", "@graph": [ORG, WEB, ...m.ld] }),
      /* tamaños de imagen para que el navegador también use las versiones ligeras */
      `<script>window.VT_IMG=${JSON.stringify(imagenes()).replace(/</g, "\\u003c")}</script>`
    ].filter(Boolean).join("\n");

    let out = html
      .replace(/<title>[\s\S]*?<\/title>/, `<title>${esc(m.titulo)}</title>`)
      .replace(/<meta name="description"[^>]*>/, `<meta name="description" content="${esc(m.desc)}">`)
      .replace(/<link rel="icon" href="data:[^>]*>\n?/, "")
      .replace("</head>", head + "\n</head>");

    /* "Saltar al contenido" + el <main> enfocable */
    const idMain = (out.match(/<main\b[^>]*\sid="([^"]+)"/) || [])[1];
    if (idMain) out = out.replace(/<main\b/, `<main tabindex="-1"`);
    else out = out.replace(/<main\b/, `<main id="principal" tabindex="-1"`);
    out = out.replace(/<body([^>]*)>/, `<body$1>\n<a class="skip-link" href="#${idMain || "principal"}">Saltar al contenido</a>`);

    /* contenido ya escrito para reseñas y notas */
    if (m.contenido) out = out.replace(/(<main\b[^>]*>)[\s\S]*?(<\/main>)/, `$1${m.contenido}$2`);

    out = mejorarImagenes(out);
    return { html: out, status: m.status || status };
  }

  /* ---------- redirecciones 301 y encabezados ---------- */
  const LIMPIAS = { "index": "/", "resenas": "/resenas", "resena": "/resenas", "noticias": "/noticias", "noticia": "/noticias", "identificar": "/identificar", "about": "/about", "wishlist": "/wishlist", "vinilo": "/", "404": "/" };
  function antes(req, res, next) {
    const host = (req.headers.host || "").toLowerCase();
    // www.vinilotracks.com → vinilotracks.com (una sola versión para Google)
    if (host === "www." + HOST) return res.redirect(301, SITIO + req.originalUrl);
    // /pagina.html → /pagina
    const html = req.path.match(/^\/([a-z0-9-]+)\.html$/);
    if (html && LIMPIAS[html[1]] && req.method === "GET") return res.redirect(301, LIMPIAS[html[1]] + (req.originalUrl.split("?")[1] ? "?" + req.originalUrl.split("?")[1] : ""));
    // /resenas/ → /resenas
    if (req.path.length > 1 && req.path.endsWith("/") && req.method === "GET") {
      const q = req.originalUrl.slice(req.path.length);
      return res.redirect(301, req.path.replace(/\/+$/, "") + q);
    }
    res.set({
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "strict-origin-when-cross-origin",
      "X-Frame-Options": "SAMEORIGIN",
      "Permissions-Policy": "camera=(self), microphone=(), geolocation=()"
    });
    if (req.secure && host === HOST) res.set("Strict-Transport-Security", "max-age=31536000");
    next();
  }

  /* ---------- robots.txt, sitemap.xml, feed.xml, manifest ---------- */
  function rutas(app) {
    app.get("/robots.txt", (req, res) => {
      res.type("text/plain").set("Cache-Control", "public, max-age=3600").send(
`# Vinilo Tracks
User-agent: *
Allow: /
Disallow: /api/
Disallow: /auth/
Disallow: /wishlist

Sitemap: ${SITIO}/sitemap.xml
`);
    });

    app.get("/sitemap.xml", (req, res) => {
      const rs = resenas(), ns = noticias();
      const ultima = l => l.map(x => x.actualizado || x.fecha).sort().pop();
      const hoy = new Date().toISOString().slice(0, 10);
      const urls = [
        { loc: "/", lastmod: [ultima(rs), ultima(ns)].filter(Boolean).sort().pop() || hoy, prioridad: "1.0", frec: "weekly" },
        { loc: "/resenas", lastmod: ultima(rs) || hoy, prioridad: "0.9", frec: "weekly" },
        { loc: "/noticias", lastmod: ultima(ns) || hoy, prioridad: "0.8", frec: "weekly" },
        { loc: "/identificar", prioridad: "0.8", frec: "monthly" },
        { loc: "/about", prioridad: "0.4", frec: "yearly" },
        ...rs.map(r => ({ loc: `/resenas/${r.slug}`, lastmod: r.actualizado || r.fecha, prioridad: "0.8", frec: "monthly", img: [r.portada, r.foto].filter(Boolean), titulo: `${r.artista} – ${r.titulo}` })),
        ...ns.map(n => ({ loc: `/noticias/${n.slug}`, lastmod: n.actualizado || n.fecha, prioridad: "0.7", frec: "monthly", img: [n.imagen].filter(Boolean), titulo: n.titulo }))
      ];
      res.type("application/xml").set("Cache-Control", "public, max-age=3600").send(
`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${urls.map(u => `  <url>
    <loc>${esc(abs(u.loc))}</loc>${u.lastmod ? `\n    <lastmod>${esc(u.lastmod)}</lastmod>` : ""}
    <changefreq>${u.frec}</changefreq>
    <priority>${u.prioridad}</priority>${(u.img || []).map(i => `\n    <image:image><image:loc>${esc(abs(i))}</image:loc></image:image>`).join("")}
  </url>`).join("\n")}
</urlset>
`);
    });

    app.get("/feed.xml", (req, res) => {
      const items = [
        ...resenas().map(r => ({ titulo: `Reseña: ${r.artista} – ${r.titulo}`, url: `/resenas/${r.slug}`, desc: r.extracto, fecha: r.fecha, img: r.portada, cat: "Reseñas" })),
        ...noticias().map(n => ({ titulo: n.titulo, url: `/noticias/${n.slug}`, desc: n.extracto, fecha: n.fecha, img: n.imagen, cat: n.categoria }))
      ].sort((a, b) => String(b.fecha).localeCompare(String(a.fecha))).slice(0, 30);
      const rfc = f => new Date(f + "T12:00:00-08:00").toUTCString();
      res.type("application/rss+xml").set("Cache-Control", "public, max-age=3600").send(
`<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:media="http://search.yahoo.com/mrss/">
<channel>
  <title>Vinilo Tracks</title>
  <link>${SITIO}/</link>
  <atom:link href="${SITIO}/feed.xml" rel="self" type="application/rss+xml"/>
  <description>Reseñas, guías y noticias de vinilo y música en español.</description>
  <language>es</language>
  ${items[0] ? `<lastBuildDate>${rfc(items[0].fecha)}</lastBuildDate>` : ""}
${items.map(i => `  <item>
    <title>${esc(i.titulo)}</title>
    <link>${abs(i.url)}</link>
    <guid isPermaLink="true">${abs(i.url)}</guid>
    <pubDate>${rfc(i.fecha)}</pubDate>
    <category>${esc(i.cat)}</category>
    <description>${esc(i.desc)}</description>
    ${i.img ? `<media:content url="${esc(abs(i.img))}" medium="image"/>` : ""}
  </item>`).join("\n")}
</channel>
</rss>
`);
    });

    app.get("/site.webmanifest", (req, res) => {
      res.type("application/manifest+json").set("Cache-Control", "public, max-age=86400").send(JSON.stringify({
        name: "Vinilo Tracks", short_name: "Vinilo Tracks", lang: "es",
        description: "Vinilos y música en español: reseñas, noticias, buscador e identificador de ediciones.",
        start_url: "/", scope: "/", display: "standalone", background_color: "#060706", theme_color: "#060706",
        icons: [
          { src: "/img/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "/img/icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "/img/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" }
        ]
      }));
    });

    // los navegadores viejos piden /favicon.ico por su cuenta
    app.get("/favicon.ico", (req, res) => res.redirect(301, "/img/icon-48.png"));
  }

  /* ---------- caché de archivos estáticos ---------- */
  function cabecerasEstaticas(res, archivo) {
    const f = archivo.replace(/\\/g, "/");
    if (/\/contenido\/.+\.json$/.test(f)) res.set("Cache-Control", "no-cache");                       // tus reseñas: siempre frescas
    else if (/\.(js|css)$/.test(f)) res.set("Cache-Control", "public, max-age=31536000, immutable");  // llevan ?v= de la versión
    else if (/\/img\//.test(f)) res.set("Cache-Control", "public, max-age=2592000");                  // 30 días
    else res.set("Cache-Control", "public, max-age=86400");
  }

  return { antes, rutas, preparar, cabecerasEstaticas, SITIO };
};
