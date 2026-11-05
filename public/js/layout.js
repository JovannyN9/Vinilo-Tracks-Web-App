/* =========================================================
   Vinilo Tracks — header, footer y panel de wishlist
   Se insertan en todas las páginas para no repetir código.
   ========================================================= */
(function () {
  const { esc, wishlist, icoSave } = window.VT;
  const ruta = location.pathname;
  const activo = p => (p === "/" ? ruta === "/" || ruta.endsWith("index.html") : ruta.startsWith(p)) ? ' aria-current="page"' : "";

  const logo = `
    <svg viewBox="0 0 100 100" aria-hidden="true" fill="none" stroke="currentColor">
      <circle cx="50" cy="50" r="46" stroke-width="6"/><circle cx="50" cy="50" r="38" stroke-width="2"/>
      <path d="M26 38a28 28 0 0 1 12-12M22 42a32 32 0 0 1 20-20M74 62a28 28 0 0 1-12 12M78 58a32 32 0 0 1-20 20" stroke-width="2.4"/>
      <circle cx="50" cy="50" r="10" stroke-width="3"/><circle cx="50" cy="50" r="2" fill="currentColor"/>
    </svg>`;

  /* ---------- HEADER ---------- */
  const header = document.getElementById("site-header");
  if (header) {
    header.outerHTML = `
    <header class="site-header">
      <div class="wrap bar">
        <a class="logo" href="/" aria-label="Vinilo Tracks, inicio">${logo}<span translate="no">VINILO TRACKS</span></a>
        <nav id="menu" aria-label="Principal"><ul>
          <li><a href="/"${activo("/")}>Home</a></li>
          <li><a href="/resenas"${activo("/resenas")}>Reseñas</a></li>
          <li><a href="/noticias"${activo("/noticias")}>Blog &amp; Noticias</a></li>
          <li><a href="/identificar"${activo("/identificar")} class="nav-tool">Identificador<span class="nav-new">Nuevo</span></a></li>
          <li><a href="/about"${activo("/about")}>About Tracks</a></li>
        </ul></nav>
        <div class="bar-actions">
          <a class="btn-search" href="/#buscador">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></svg>
            <span>Buscar vinilos</span>
          </a>
          <button class="wl-btn" id="wl-open" type="button" aria-label="Abrir tu wishlist" aria-controls="wl-drawer" aria-expanded="false">
            ${icoSave}<span class="badge" id="wl-count" hidden>0</span>
          </button>
          <div class="acct" id="acct"></div>
          <button class="menu-btn" id="menu-btn" type="button" aria-label="Abrir menú" aria-expanded="false" aria-controls="menu">
            <span></span><span></span>
          </button>
        </div>
      </div>
    </header>`;
  }

  /* menú en celular */
  const menuBtn = document.getElementById("menu-btn");
  menuBtn?.addEventListener("click", () => {
    const abierto = document.body.classList.toggle("menu-open");
    menuBtn.setAttribute("aria-expanded", abierto);
  });
  document.querySelectorAll("#menu a").forEach(a => a.addEventListener("click", () => document.body.classList.remove("menu-open")));

  /* ---------- PANEL DE WISHLIST ---------- */
  document.body.insertAdjacentHTML("beforeend", `
    <div class="wl-backdrop" id="wl-backdrop" hidden></div>
    <aside class="drawer" id="wl-drawer" aria-label="Tu wishlist" aria-hidden="true" tabindex="-1">
      <div class="drawer-head">
        <div><span class="eyebrow">Guardados</span><h2>Tu wishlist</h2></div>
        <button class="x" id="wl-close" type="button" aria-label="Cerrar wishlist">✕</button>
      </div>
      <div class="drawer-list" id="wl-list"></div>
      <div class="drawer-foot"><p class="drawer-note" id="wl-note" hidden>Esta lista solo vive en este navegador: si borras el caché, se pierde. Con una cuenta gratis te sigue al celular y a la compu. <button type="button" class="link-btn" data-auth="registro">Crear cuenta</button></p><a class="pill pill-solid" href="/wishlist">Ver wishlist completa</a></div>
    </aside>`);

  const drawer = document.getElementById("wl-drawer");
  const backdrop = document.getElementById("wl-backdrop");
  const openBtn = document.getElementById("wl-open");
  drawer.inert = true; // cerrado: ni el teclado ni el lector de pantalla entran ahí
  function abrir() {
    drawer.inert = false;
    backdrop.hidden = false;
    requestAnimationFrame(() => document.body.classList.add("wl-open"));
    drawer.setAttribute("aria-hidden", "false");
    openBtn.setAttribute("aria-expanded", "true");
    drawer.focus();
  }
  function cerrar() {
    if (drawer.inert) return;
    const estabaAdentro = drawer.contains(document.activeElement);
    drawer.inert = true;
    if (estabaAdentro) openBtn?.focus(); // regresamos el foco al botón que lo abrió
    document.body.classList.remove("wl-open");
    drawer.setAttribute("aria-hidden", "true");
    openBtn.setAttribute("aria-expanded", "false");
    setTimeout(() => (backdrop.hidden = true), 300);
  }
  VT.cerrarWishlist = cerrar;
  openBtn?.addEventListener("click", abrir);
  document.getElementById("wl-close").addEventListener("click", cerrar);
  backdrop.addEventListener("click", cerrar);
  document.addEventListener("keydown", e => { if (e.key === "Escape") { cerrar(); document.body.classList.remove("menu-open"); } });

  function pintarWishlist(lista = wishlist.todos()) {
    const n = lista.length;
    const badge = document.getElementById("wl-count");
    if (badge) { badge.textContent = n; badge.hidden = n === 0; }
    const cont = document.getElementById("wl-list");
    cont.innerHTML = n
      ? lista.slice(0, 8).map(d => `
        <div class="wl-item">
          <a href="/vinilo/${d.id}" class="wl-thumb">${d.portada ? `<img src="${esc(d.portada)}" alt="">` : ""}</a>
          <a href="/vinilo/${d.id}" class="wl-info"><strong>${esc(d.titulo)}</strong><span>${esc(d.artista)} · ${d.anio || "—"}</span></a>
          <button type="button" class="x" data-quitar="${d.id}" aria-label="Quitar ${esc(d.titulo)}">✕</button>
        </div>`).join("") + (n > 8 ? `<p class="mono wl-more">+ ${n - 8} más en tu wishlist</p>` : "")
      : `<div class="wl-empty">${icoSave}<p><strong>Todavía no guardas nada.</strong><br>Busca un vinilo y toca el ícono de guardar para tenerlo aquí.</p><a class="pill" href="/#buscador">Ir al buscador</a></div>`;
  }
  document.getElementById("wl-list").addEventListener("click", e => {
    const b = e.target.closest("[data-quitar]");
    if (b) wishlist.quitar(b.dataset.quitar);
  });
  wishlist.cambio(pintarWishlist);
  pintarWishlist();

  /* ---------- FOOTER ---------- */
  const footer = document.getElementById("site-footer");
  if (footer) {
    footer.outerHTML = `
    <footer class="site-footer" id="footer">
      <div class="wrap">
        <p class="big" aria-hidden="true" translate="no">Vinilo Tracks</p>
        <div class="fcols">
          <div><h2 class="ftit">About Tracks</h2><p class="fabout">Revista digital de vinilo y música en español, curada desde Los Angeles para coleccionistas y escuchas pacientes.</p></div>
          <div><h2 class="ftit">Secciones</h2><ul><li><a href="/resenas">Reseñas</a></li><li><a href="/noticias">Blog &amp; Noticias</a></li><li><a href="/#buscador">Buscador</a></li><li><a href="/identificar">Identificador de discos</a></li><li><a href="/wishlist">Wishlist</a></li></ul></div>
          <div><h2 class="ftit">Escenas</h2><ul><li><a href="/resenas#Rock">Rock en español</a></li><li><a href="/resenas#Pop">Pop</a></li><li><a href="/resenas#Alternativo">Alternativo</a></li></ul></div>
          <div><h2 class="ftit">Sitio</h2><ul><li><a href="/about">About Tracks</a></li><li><a href="/about#privacidad">Privacy Policy</a></li></ul></div>
        </div>
        <div class="legal mono"><span>© ${new Date().getFullYear()} Vinilo Tracks · vinilotracks.com</span><span>Datos de discos vía Discogs</span></div>
      </div>
    </footer>`;
  }

  /* el título gigante del footer se ajusta para caber completo en cualquier pantalla */
  function ajustarFooter() {
    const big = document.querySelector(".site-footer .big");
    if (!big) return;
    big.style.fontSize = "";
    const disponible = big.clientWidth;
    const actual = big.scrollWidth;
    if (actual > disponible) {
      const tam = parseFloat(getComputedStyle(big).fontSize);
      big.style.fontSize = Math.floor(tam * (disponible / actual) * 0.98) + "px";
    }
  }
  ajustarFooter();
  document.fonts?.ready.then(ajustarFooter);
  window.addEventListener("resize", ajustarFooter);

  /* =======================================================
     ANIMACIONES AL HACER SCROLL
     - títulos grandes: suben desde una "máscara"
     - tarjetas, imágenes y bloques: fade in up, en cascada
     Se activan solas en todo lo que coincida con estos selectores,
     incluso en lo que se carga después (reseñas, resultados, etc).
     ======================================================= */
  const sinMovimiento = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!sinMovimiento && "IntersectionObserver" in window) {
    const TITULOS = ".head h2, .page-head h1, .review-head h1, .vinyl-info h1, .article-hero-txt h1, .notfound h1, .block h2";
    const BLOQUES = [
      ".head p", ".head .eyebrow", ".page-head p", ".page-head .eyebrow", ".list-bar",
      ".card", ".post", ".wl-card", ".rel",
      ".review-cover", ".review-score", ".review-lede", ".review-actions", ".pull", ".ficha",
      ".gallery", ".tags", ".stats", ".vinyl-actions", ".tracklist li",
      ".loop h2", ".loop-foot", ".prose > *", ".article-lede",
      ".fcols > div", ".more", "#caps .cap",
      ".where-card", ".id-box", ".tile", ".ed", ".rec", ".check li", ".rep-cover", ".rep-info", ".id-cta-in"
    ].join(",");

    document.documentElement.classList.add("anim");
    const io = new IntersectionObserver(entradas => {
      entradas.forEach(e => {
        if (!e.isIntersecting) return;
        e.target.classList.add("in");
        io.unobserve(e.target);
      });
    }, { threshold: 0, rootMargin: "0px 0px -8% 0px" });
    // threshold 0: basta con que asome 1px. Con un porcentaje, los bloques muy altos
    // (como la lista de resultados en el celular) nunca llegaban a "verse" y se quedaban invisibles.

    function preparar(raiz) {
      const nuevos = [];
      raiz.querySelectorAll?.(TITULOS).forEach(el => { if (!el.dataset.anim) { el.dataset.anim = "titulo"; nuevos.push(el); } });
      raiz.querySelectorAll?.(BLOQUES).forEach(el => { if (!el.dataset.anim) { el.dataset.anim = "sube"; nuevos.push(el); } });
      // cascada: cada hermano espera un poquito más (máximo 6)
      nuevos.forEach(el => {
        const hermanos = [...el.parentElement.children].filter(x => x.dataset.anim);
        el.style.setProperty("--i", Math.min(hermanos.indexOf(el), 6));
        io.observe(el);
      });
    }
    preparar(document);
    new MutationObserver(cambios => cambios.forEach(c => c.addedNodes.forEach(n => n.nodeType === 1 && preparar(n.parentElement || n))))
      .observe(document.body, { childList: true, subtree: true });
  }

  VT.pintarBotones();
})();
