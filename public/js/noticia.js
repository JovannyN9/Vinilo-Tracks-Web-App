/* Vinilo Tracks — template de UNA noticia / post: /noticias/:slug */
(function () {
  const { noticias, esc, fecha, cuerpo, slug, tarjetaNoticia } = window.VT;
  const main = document.getElementById("contenido");

  noticias().then(lista => {
    const n = lista.find(x => x.slug === slug());
    if (!n) {
      main.innerHTML = `<div class="wrap notfound"><h1>Nota no encontrada</h1><a class="pill" href="/noticias">Ver todas las noticias</a></div>`;
      return;
    }
    document.title = `${n.titulo} · Vinilo Tracks`;
    main.innerHTML = `
    <article class="article">
      <div class="hero-bleed">
        <div class="article-hero">
          <img src="${n.imagen}" alt="">
          <div class="article-hero-txt">
            <a class="crumb mono" href="/noticias">← Blog &amp; Noticias</a>
            <span class="eyebrow">${esc(n.categoria)}</span>
            <h1>${esc(n.titulo)}</h1>
            <div class="mono">${esc(n.autor)} · ${fecha(n.fecha)}</div>
          </div>
        </div>
      </div>
      <div class="wrap article-body">
        <p class="article-lede">${esc(n.extracto)}</p>
        <div class="prose">${cuerpo(n.cuerpo)}</div>
      </div>
    </article>
    <section class="wrap more-section">
      <div class="head head-sm"><h2>Sigue leyendo</h2><a class="pill" href="/noticias">Todas las notas</a></div>
      <div class="news-grid">${lista.filter(x => x.slug !== n.slug).slice(0, 3).map(x => tarjetaNoticia(x)).join("")}</div>
    </section>`;
  });
})();
