/* Vinilo Tracks — template de UNA reseña: /resenas/:slug */
(function () {
  const { resenas, esc, fecha, cuerpo, slug, json, tarjetaResena, icoSave, pintarBotones } = window.VT;
  const main = document.getElementById("contenido");

  resenas().then(async lista => {
    const r = lista.find(x => x.slug === slug());
    if (!r) {
      main.innerHTML = `<div class="wrap notfound"><h1>Reseña no encontrada</h1><p>Puede que la hayamos movido.</p><a class="pill" href="/resenas">Ver todas las reseñas</a></div>`;
      return;
    }
    /* si el servidor ya mandó la reseña escrita (lo normal), no la volvemos a dibujar */
    if (!main.querySelector("[data-ssr]")) {
    const palabras = r.cuerpo.map(b => b.p || b.h2 || b.cita || (b.lista || []).join(" ") || (b.items || []).map(i => `${i.t} ${i.d}`).join(" ")).join(" ").split(/\s+/).filter(Boolean).length;
    const minutos = Math.max(1, Math.round(palabras / 200));

    main.innerHTML = `
    <article class="review">
      <div class="wrap review-hero">
        <div class="review-cover">
          ${VT.img(r.portada, `Portada del disco ${r.titulo} de ${r.artista}`, { sizes: "(max-width: 900px) 92vw, 42vw", prioridad: true })}
        </div>
        <div class="review-head">
          <a class="crumb mono" href="/resenas">← Reseñas</a>
          <span class="eyebrow">${esc(r.estilo)} · ${r.anio} · ${esc(r.pais)}</span>
          <h1>${esc(r.titulo)}</h1>
          <p class="review-artist">${esc(r.artista)}</p>
          <div class="review-score"><b>${r.calificacion.toFixed(1)}</b><span class="mono">/ 10</span></div>
          <p class="review-lede">${esc(r.extracto)}</p>
          <div class="review-meta mono">${esc(r.autor)} · ${fecha(r.fecha)} · ${minutos} min de lectura</div>
          <div class="review-actions" id="acciones"><span class="mono muted">Buscando el vinilo en Discogs…</span></div>
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

    <section class="wrap more-section">
      <div class="head head-sm"><h2>Más reseñas</h2><a class="pill" href="/resenas">Ver todas</a></div>
      <div class="grid">${lista.filter(x => x.slug !== r.slug).slice(0, 3).map(tarjetaResena).join("")}</div>
    </section>`;
    }

    /* busca el vinilo en Discogs para mostrar tracklist y botón de guardar */
    const acciones = document.getElementById("acciones");
    try {
      const m = await json(`/api/match?artista=${encodeURIComponent(r.artista)}&titulo=${encodeURIComponent(r.titulo)}`);
      if (!m.id) throw new Error("sin resultado");
      const guardar = { id: m.id, titulo: r.titulo, artista: r.artista, anio: r.anio, pais: r.pais, portada: m.portada || r.portada };
      acciones.innerHTML = `
        <button class="btn-primary" type="button" data-save='${esc(JSON.stringify(guardar))}' aria-pressed="false">${icoSave}<span class="save-label">Guardar en wishlist</span></button>
        <a class="pill" href="/vinilo/${m.id}">Ver ficha del vinilo →</a>`;
      pintarBotones();
      const d = await json(`/api/release/${m.id}`);
      const pistas = d.tracklist.filter(t => t.tipo !== "heading");
      document.getElementById("ficha").innerHTML = `
        <h3 class="eyebrow">Ficha del vinilo</h3>
        <dl class="dl">
          ${d.sellos[0] ? `<dt>Sello</dt><dd>${esc(d.sellos[0].nombre)} · ${esc(d.sellos[0].catalogo)}</dd>` : ""}
          ${d.formatos[0] ? `<dt>Formato</dt><dd>${esc([d.formatos[0].nombre, ...d.formatos[0].detalles].join(", "))}</dd>` : ""}
          ${d.lanzamiento ? `<dt>Lanzamiento</dt><dd>${esc(d.lanzamiento)}</dd>` : ""}
        </dl>
        <ol class="mini-tracks">${pistas.map(t => `<li><span>${esc(t.posicion)}</span>${esc(t.titulo)}<em>${esc(t.duracion)}</em></li>`).join("")}</ol>`;
    } catch {
      acciones.innerHTML = `<a class="pill" href="/?q=${encodeURIComponent(r.artista)}#buscador">Buscar ${esc(r.artista)} en vinilo →</a>`;
    }
  });
})();
