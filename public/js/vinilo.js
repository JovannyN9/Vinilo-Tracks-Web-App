/* =========================================================
   Vinilo Tracks — template de UN vinilo: /vinilo/:id
   Toda la información viene de Discogs a través de /api/release/:id
   ========================================================= */
(function () {
  const { esc, json, slug, icoSave, pintarBotones, tarjetaVinilo, arteVacio } = window.VT;
  const main = document.getElementById("contenido");
  const id = slug().replace(/\D/g, "");
  const num = n => (n == null ? "—" : Number(n).toLocaleString("es-MX"));

  function agrupar(lista, campo) {
    return lista.reduce((acc, x) => ((acc[x[campo]] ||= []).push(x), acc), {});
  }

  /* video de YouTube embebido (el primero de la lista) */
  function idYT(url) { const m = (url || "").match(/(?:v=|youtu\.be\/)([\w-]{11})/); return m ? m[1] : ""; }

  json(`/api/release/${id}`).then(async d => {
    const artista = d.artistas.join(", ");
    document.title = `${artista} — ${d.titulo} · Vinilo Tracks`;
    const portada = d.imagenes[0]?.url || "";
    const a = arteVacio(artista);
    const guardar = { id: d.id, titulo: d.titulo, artista, anio: d.anio, pais: d.pais, portada };
    const formato = d.formatos.map(f => [f.cantidad > 1 ? `${f.cantidad} × ${f.nombre}` : f.nombre, ...f.detalles, f.texto].filter(Boolean).join(", ")).join(" + ");
    const creditos = agrupar(d.creditos, "rol");
    const companias = agrupar(d.companias, "rol");
    const video = idYT(d.videos[0]?.url);
    const dur = s => s ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}` : "";

    main.innerHTML = `
    <div class="wrap vinyl">
      <a class="crumb mono" href="/#buscador">← Buscador</a>

      <div class="vinyl-hero">
        <div class="gallery">
          <div class="gallery-main" style="${a.estilo}">
            ${portada ? `<img id="main-img" src="${esc(portada)}" alt="Portada de ${esc(d.titulo)}">` : `<div class="art big-art" style="${a.estilo}"><b>${esc(a.ini)}</b></div>`}
            <div class="spin-disc" aria-hidden="true"></div>
          </div>
          ${d.imagenes.length > 1 ? `<div class="thumbs">${d.imagenes.slice(0, 8).map((im, i) =>
            `<button type="button" data-img="${esc(im.url)}" aria-label="Ver imagen ${i + 1}"${i === 0 ? ' aria-current="true"' : ""}><img src="${esc(im.chica)}" alt=""></button>`).join("")}</div>` : ""}
        </div>

        <div class="vinyl-info">
          <a class="vinyl-artist" href="/?q=${encodeURIComponent(d.artistas[0] || "")}#buscador">${esc(artista)}</a>
          <h1>${esc(d.titulo)}</h1>
          <div class="tags">
            ${d.anio ? `<span>${d.anio}</span>` : ""}${d.pais ? `<span>${esc(d.pais)}</span>` : ""}
            ${[...d.generos, ...d.estilos].map(g => `<span>${esc(g)}</span>`).join("")}
          </div>

          <dl class="dl dl-wide">
            ${d.sellos.length ? `<dt>Sello</dt><dd>${d.sellos.map(s => `${esc(s.nombre)} <span class="muted">· ${esc(s.catalogo)}</span>`).join("<br>")}</dd>` : ""}
            ${formato ? `<dt>Formato</dt><dd>${esc(formato)}</dd>` : ""}
            ${d.lanzamiento ? `<dt>Lanzamiento</dt><dd>${esc(d.lanzamiento)}</dd>` : ""}
          </dl>

          <div class="vinyl-actions">
            <button class="btn-primary" type="button" data-save='${esc(JSON.stringify(guardar))}' aria-pressed="false">${icoSave}<span class="save-label">Guardar en wishlist</span></button>
            <a class="pill" href="${esc(d.urlVenta)}" target="_blank" rel="noopener">${d.venta.enVenta ? `Comprar · ${d.venta.enVenta} en venta` : "Ver en el marketplace"}</a>
          </div>

          <div class="stats">
            <div><b>${num(d.comunidad.tienen)}</b><span>lo tienen</span></div>
            <div><b>${num(d.comunidad.quieren)}</b><span>lo quieren</span></div>
            <div><b>${d.comunidad.rating ? d.comunidad.rating.toFixed(2) : "—"}</b><span>rating / 5${d.comunidad.votos ? ` · ${num(d.comunidad.votos)} votos` : ""}</span></div>
            <div><b>${d.venta.desde ? "$" + Number(d.venta.desde).toFixed(2) : "—"}</b><span>desde (USD)</span></div>
          </div>
        </div>
      </div>

      <div class="vinyl-cols">
        <section class="block">
          <h2>Tracklist</h2>
          <ol class="tracklist">
            ${d.tracklist.map(t => t.tipo === "heading"
              ? `<li class="side">${esc(t.titulo)}</li>`
              : `<li><span class="pos">${esc(t.posicion)}</span><span class="tt">${esc(t.titulo)}</span><span class="dur">${esc(t.duracion)}</span></li>`).join("")}
          </ol>
        </section>

        <div class="vinyl-side">
          ${video ? `<section class="block"><h2>Escúchalo</h2>
            <div class="video"><iframe src="https://www.youtube-nocookie.com/embed/${video}" title="${esc(d.videos[0].titulo)}" allow="encrypted-media; picture-in-picture" allowfullscreen loading="lazy"></iframe></div>
            ${d.videos.length > 1 ? `<ul class="vlist">${d.videos.slice(1, 6).map(v => `<li><a href="${esc(v.url)}" target="_blank" rel="noopener">${esc(v.titulo)}</a><span class="mono">${dur(v.duracion)}</span></li>`).join("")}</ul>` : ""}
          </section>` : ""}

          ${d.creditos.length ? `<section class="block"><h2>Créditos</h2><dl class="dl">
            ${Object.entries(creditos).map(([rol, gente]) => `<dt>${esc(rol)}</dt><dd>${gente.map(g => esc(g.nombre)).join(", ")}</dd>`).join("")}
          </dl></section>` : ""}
        </div>
      </div>

      <div class="vinyl-cols">
        ${d.companias.length || d.identificadores.length ? `<section class="block"><h2>Prensaje y compañías</h2><dl class="dl">
          ${Object.entries(companias).map(([rol, cs]) => `<dt>${esc(rol)}</dt><dd>${cs.map(c => esc(c.nombre)).join(", ")}</dd>`).join("")}
          ${d.identificadores.map(i => `<dt>${esc(i.tipo)}</dt><dd>${esc(i.valor)}${i.nota ? ` <span class="muted">(${esc(i.nota)})</span>` : ""}</dd>`).join("")}
        </dl></section>` : ""}
        ${d.notas ? `<section class="block"><h2>Notas</h2><p class="notes">${esc(d.notas).replace(/\n/g, "<br>")}</p></section>` : ""}
      </div>

      <section class="block more-artist" id="mas" hidden>
        <div class="head head-sm"><h2>Más de ${esc(d.artistas[0] || "")}</h2></div>
        <div class="results" id="mas-lista"></div>
      </section>

      <p class="mono muted credit">Datos e imágenes de <a href="${esc(d.url)}" target="_blank" rel="noopener">Discogs</a>.</p>
    </div>`;

    pintarBotones();

    /* galería */
    main.querySelector(".thumbs")?.addEventListener("click", e => {
      const b = e.target.closest("[data-img]");
      if (!b) return;
      document.getElementById("main-img").src = b.dataset.img;
      main.querySelectorAll(".thumbs button").forEach(x => x.removeAttribute("aria-current"));
      b.setAttribute("aria-current", "true");
    });

    /* más discos del mismo artista (solo curados) */
    try {
      const mas = await json(`/api/search?q=${encodeURIComponent(d.artistas[0] || "")}`);
      const otros = mas.results.filter(x => x.id !== d.id && x.master !== d.master).slice(0, 6);
      if (otros.length) {
        document.getElementById("mas-lista").innerHTML = otros.map(tarjetaVinilo).join("");
        document.getElementById("mas").hidden = false;
        pintarBotones();
      }
    } catch {}
  }).catch(err => {
    main.innerHTML = `<div class="wrap notfound"><h1>No pudimos cargar este vinilo</h1><p>${esc(err.message)}</p><a class="pill" href="/#buscador">Volver al buscador</a></div>`;
  });
})();
