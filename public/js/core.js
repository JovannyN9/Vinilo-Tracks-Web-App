/* =========================================================
   Vinilo Tracks — utilidades compartidas por todas las páginas
   window.VT = { esc, fecha, json, wishlist, toast, tarjetas... }
   ========================================================= */
(function () {
  const VT = (window.VT = {});

  /* ---- texto seguro para meter en HTML ---- */
  VT.esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  /* ---- fechas en español: "28 oct 2026" ---- */
  VT.fecha = iso => {
    try { return new Date(iso + "T12:00:00").toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" }).replace(".", ""); }
    catch { return iso; }
  };

  /* ---- fetch que entiende nuestros errores ---- */
  VT.json = async url => {
    const r = await fetch(url);
    let data = {};
    try { data = await r.json(); } catch {}
    if (!r.ok) throw new Error(data.error || `Error ${r.status}`);
    return data;
  };

  /* ---- contenido editorial (reseñas y noticias) ---- */
  let _res, _not;
  VT.resenas = () => (_res ||= VT.json("/contenido/resenas.json").then(l => l.sort((a, b) => b.fecha.localeCompare(a.fecha))));
  VT.noticias = () => (_not ||= VT.json("/contenido/noticias.json").then(l => l.sort((a, b) => b.fecha.localeCompare(a.fecha))));

  /* ---- POST / DELETE a nuestro servidor ---- */
  VT.api = async (method, url, body) => {
    const r = await fetch(url, {
      method,
      headers: body ? { "Content-Type": "application/json" } : {},
      body: body ? JSON.stringify(body) : undefined,
      credentials: "same-origin"
    });
    let data = {};
    try { data = await r.json(); } catch {}
    if (!r.ok) { const e = new Error(data.error || `Error ${r.status}`); e.status = r.status; throw e; }
    return data;
  };

  /* =======================================================
     CUENTA
     VT.cuenta.usuario → null o { id, email, nombre, avatar }
     ======================================================= */
  const oyentesCuenta = new Set();
  VT.cuenta = {
    usuario: null,
    login: false,          // ¿el servidor tiene Supabase configurado?
    google: false,         // ¿Google está activado en Supabase?
    listo: null,           // promesa: se resuelve cuando ya sabemos si hay sesión
    cambio(fn) { oyentesCuenta.add(fn); },
    _avisar() { oyentesCuenta.forEach(fn => fn(this.usuario)); },
    async entrar(email, password) {
      const d = await VT.api("POST", "/api/auth/entrar", { email, password });
      await this._conSesion(d.usuario, true);
      return d.usuario;
    },
    async registro(nombre, email, password) {
      const d = await VT.api("POST", "/api/auth/registro", { nombre, email, password });
      if (d.usuario) await this._conSesion(d.usuario, true);
      return d;
    },
    async salir() {
      await VT.api("POST", "/api/auth/salir").catch(() => {});
      this.usuario = null;
      guardarLocal([]);           // en una compu compartida, no dejamos la lista de otra persona
      this._avisar();
      VT.toast("Cerraste sesión");
    },
    async _conSesion(usuario, recienEntro) {
      this.usuario = usuario;
      await sincronizar(recienEntro);
      this._avisar();
    }
  };

  /* =======================================================
     WISHLIST
     - Sin cuenta: se guarda en este navegador (localStorage).
     - Con cuenta: se guarda en Supabase y localStorage es solo una copia rápida.
     ======================================================= */
  const KEY = "vt-wishlist";
  const oyentes = new Set();
  function leer() {
    try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch { return []; }
  }
  function guardarLocal(lista) {
    try { localStorage.setItem(KEY, JSON.stringify(lista)); } catch {}
    oyentes.forEach(fn => fn(lista));
  }
  const enNube = () => !!VT.cuenta.usuario;
  const errorNube = () => VT.toast("No se pudo guardar en tu cuenta. Revisa tu conexión.");

  /* al entrar: sube lo que había en el navegador y baja lo que hay en la nube */
  async function sincronizar(recienEntro) {
    try {
      const locales = leer();
      if (recienEntro && locales.length) await VT.api("POST", "/api/wishlist", { discos: locales });
      const { discos } = await VT.json("/api/wishlist");
      guardarLocal(discos);
      if (recienEntro && locales.length) VT.toast(`Pasamos ${locales.length} ${locales.length === 1 ? "disco" : "discos"} a tu cuenta`);
    } catch (e) {
      console.warn("No se pudo sincronizar la wishlist:", e.message);
    }
  }

  VT.wishlist = {
    todos: leer,
    tiene: id => leer().some(d => String(d.id) === String(id)),
    agregar(disco) {
      if (this.tiene(disco.id)) return;
      const nuevo = { ...disco, guardado: Date.now() };
      guardarLocal([nuevo, ...leer()]);
      VT.toast(`Guardado en tu wishlist: ${disco.titulo}`, { accion: "Ver", href: "/wishlist" });
      if (enNube()) VT.api("POST", "/api/wishlist", nuevo).catch(errorNube);
    },
    quitar(id) {
      const d = leer().find(x => String(x.id) === String(id));
      guardarLocal(leer().filter(x => String(x.id) !== String(id)));
      if (d) VT.toast(`Quitado de tu wishlist`, { accion: "Deshacer", fn: () => VT.wishlist.agregar(d) });
      if (enNube()) VT.api("DELETE", `/api/wishlist/${encodeURIComponent(id)}`).catch(errorNube);
    },
    alternar(disco) { this.tiene(disco.id) ? this.quitar(disco.id) : this.agregar(disco); },
    vaciar() {
      guardarLocal([]);
      if (enNube()) VT.api("DELETE", "/api/wishlist").catch(errorNube);
    },
    cambio(fn) { oyentes.add(fn); }
  };
  // si abren otra pestaña y guardan algo, esta se actualiza
  window.addEventListener("storage", e => { if (e.key === KEY) oyentes.forEach(fn => fn(leer())); });

  /* ¿hay sesión? (se revisa una vez al cargar cada página) */
  VT.cuenta.listo = VT.json("/api/auth/yo")
    .then(async d => {
      VT.cuenta.login = !!d.login;
      VT.cuenta.google = !!d.google;
      if (d.usuario) await VT.cuenta._conSesion(d.usuario, false);
      else VT.cuenta._avisar();
    })
    .catch(() => VT.cuenta._avisar());

  /* botones "guardar": cualquier elemento con data-save='{"id":...}' */
  document.addEventListener("click", e => {
    const b = e.target.closest("[data-save]");
    if (!b) return;
    e.preventDefault();
    e.stopPropagation();
    try { VT.wishlist.alternar(JSON.parse(b.dataset.save)); } catch {}
  });
  function pintarBotones() {
    document.querySelectorAll("[data-save]").forEach(b => {
      let id; try { id = JSON.parse(b.dataset.save).id; } catch { return; }
      const on = VT.wishlist.tiene(id);
      b.setAttribute("aria-pressed", on);
      const label = b.querySelector(".save-label");
      if (label) label.textContent = on ? (b.dataset.on || "En tu wishlist") : (b.dataset.off || "Guardar en wishlist");
      b.setAttribute("aria-label", on ? "Quitar de tu wishlist" : "Guardar en tu wishlist");
    });
  }
  VT.pintarBotones = pintarBotones;
  VT.wishlist.cambio(pintarBotones);

  /* ---- toast (aviso pequeño abajo) ---- */
  let toastTimer;
  VT.toast = (msg, opts = {}) => {
    let t = document.getElementById("toast");
    if (!t) { t = document.createElement("div"); t.id = "toast"; t.className = "toast"; t.setAttribute("role", "status"); document.body.appendChild(t); }
    t.innerHTML = `<span>${VT.esc(msg)}</span>` + (opts.accion ? (opts.href ? `<a href="${opts.href}">${opts.accion}</a>` : `<button type="button">${opts.accion}</button>`) : "");
    if (opts.fn) t.querySelector("button").onclick = () => { opts.fn(); t.classList.remove("show"); };
    requestAnimationFrame(() => t.classList.add("show"));
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove("show"), 3800);
  };

  /* =======================================================
     TARJETAS reutilizables
     ======================================================= */
  const icoSave = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3h12v18l-6-4.5L6 21z"/></svg>`;
  VT.icoSave = icoSave;

  /* imagen con versiones ligeras (las arma scripts/imagenes.py; el servidor manda la lista en window.VT_IMG) */
  VT.img = (src, alt = "", o = {}) => {
    const m = (window.VT_IMG || {})[src];
    const base = String(src).replace(/^\/img\//, "").replace(/\.[a-z]+$/i, "");
    const ss = m && m.v && m.v.length ? ` srcset="${m.v.map(w => `/img/r/${base}-${w}.webp ${w}w`).join(", ")}, ${src} ${m.w}w" sizes="${o.sizes || "100vw"}"` : "";
    const wh = m ? ` width="${m.w}" height="${m.h}"` : "";
    return `<img src="${VT.esc(src)}"${ss}${wh} alt="${VT.esc(alt)}"${o.prioridad ? ' fetchpriority="high"' : ' loading="lazy"'} decoding="async">`;
  };
  const SIZES_TARJETA = "(max-width: 700px) 92vw, (max-width: 1100px) 46vw, 30vw";

  VT.tarjetaResena = r => `
    <article class="card">
      <a class="card-link" href="/resenas/${r.slug}">
        <div class="cover">${VT.img(r.portada, `Portada del disco ${r.titulo} de ${r.artista}`, { sizes: SIZES_TARJETA })}<span class="score"><span class="sr-only">Calificación: </span>${r.calificacion.toFixed(1)}<span class="sr-only"> de 10</span></span></div>
        <span class="meta">${r.anio} · ${VT.esc(r.pais)} · ${VT.esc(r.estilo)}</span>
        <h3>${VT.esc(r.artista)} — ${VT.esc(r.titulo)}</h3>
        <p>${VT.esc(r.extracto)}</p>
        <span class="read" aria-hidden="true">Leer reseña →</span>
      </a>
    </article>`;

  VT.tarjetaNoticia = (n, grande = false) => `
    <article class="post${grande ? " post-big" : ""}">
      <a class="card-link" href="/noticias/${n.slug}">
        <div class="post-img">${VT.img(n.imagen, "", { sizes: grande ? "(max-width: 700px) 92vw, 60vw" : SIZES_TARJETA })}</div>
        <div class="post-txt">
          <span class="meta">${VT.esc(n.categoria)} · <time datetime="${VT.esc(n.fecha)}">${VT.fecha(n.fecha)}</time></span>
          <h3>${VT.esc(n.titulo)}</h3>
          <p>${VT.esc(n.extracto)}</p>
          <span class="read" aria-hidden="true">Leer nota →</span>
        </div>
      </a>
    </article>`;

  const paleta = [["#d9f86a","#060706"],["#ff5d8f","#ffe066"],["#4cc9f0","#ff5d8f"],["#ffb238","#4cc9f0"],["#b6ff3b","#ff5d8f"],["#eef0e6","#b6ff3b"],["#9b7bff","#d9f86a"]];
  VT.arteVacio = artista => {
    const h = [...(artista || "?")].reduce((s, ch) => s + ch.charCodeAt(0), 0);
    const [c1, c2] = paleta[h % paleta.length];
    const ini = (artista || "?").replace(/^(El|Los|La|Las)\s/, "").split(/\s+/).slice(0, 2).map(w => w[0]).join("");
    return { estilo: `--c1:${c1};--c2:${c2}`, ini };
  };

  /* disco de Discogs → tarjeta con botón de guardar */
  VT.tarjetaVinilo = d => {
    const a = VT.arteVacio(d.artista);
    const guardar = { id: d.id, titulo: d.titulo, artista: d.artista, anio: d.anio, pais: d.pais, portada: d.portada };
    const etiquetas = [...new Set([...(d.generos || []), ...(d.estilos || [])])].slice(0, 2).join(" / ");
    return `<div class="rel">
      <a href="/vinilo/${d.id}">
        <div class="art" style="${a.estilo}"><b>${VT.esc(a.ini)}</b>${d.portada ? `<img src="${VT.esc(d.portada)}" alt="Portada de ${VT.esc(d.titulo)}" loading="lazy">` : ""}</div>
        <strong>${VT.esc(d.titulo)}</strong>
        <span>${VT.esc(d.artista)}<br>${d.anio || "—"}${d.pais ? " · " + VT.esc(d.pais) : ""}${etiquetas ? " · " + VT.esc(etiquetas) : ""}</span>
      </a>
      <button class="save" type="button" data-save='${VT.esc(JSON.stringify(guardar))}' aria-pressed="false" aria-label="Guardar en tu wishlist">${icoSave}</button>
    </div>`;
  };

  /* bloques de texto de reseñas/noticias */
  VT.cuerpo = bloques => bloques.map(b =>
    b.h2 ? `<h2>${VT.esc(b.h2)}</h2>` :
    b.lista ? `<ol>${b.lista.map(i => `<li>${VT.esc(i)}</li>`).join("")}</ol>` :
    b.items ? `<ol class="picks">${b.items.map(i => `<li><strong>${VT.esc(i.t)}</strong><span>${VT.esc(i.d)}</span></li>`).join("")}</ol>` :
    b.cita ? `<blockquote>${VT.esc(b.cita)}</blockquote>` :
    `<p>${VT.esc(b.p)}</p>`
  ).join("");

  VT.slug = () => decodeURIComponent(location.pathname.split("/").filter(Boolean).pop() || "");
})();
