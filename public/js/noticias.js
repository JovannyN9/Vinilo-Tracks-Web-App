/* Vinilo Tracks — listado de noticias / blog, con filtro por categoría */
(function () {
  const { noticias, tarjetaNoticia, esc } = window.VT;
  const grid = document.getElementById("lista");
  const chips = document.getElementById("filtro");
  let todas = [];

  function pintar() {
    const c = decodeURIComponent(location.hash.slice(1));
    chips.querySelectorAll(".chip").forEach(b => b.setAttribute("aria-pressed", b.dataset.g === c));
    const lista = c ? todas.filter(n => n.categoria === c) : todas;
    grid.innerHTML = lista.length ? lista.map((n, i) => tarjetaNoticia(n, i === 0 && !c)).join("") : `<p class="empty">No hay notas en esta categoría.</p>`;
  }
  chips.addEventListener("click", e => {
    const b = e.target.closest(".chip");
    if (!b) return;
    history.replaceState(null, "", b.dataset.g ? "#" + b.dataset.g : location.pathname);
    pintar();
  });
  window.addEventListener("hashchange", pintar);
  noticias().then(l => {
    todas = l;
    [...new Set(l.map(n => n.categoria))].forEach(c => chips.insertAdjacentHTML("beforeend", `<button class="chip" data-g="${esc(c)}" aria-pressed="false">${esc(c)}</button>`));
    pintar();
  }).catch(() => (grid.innerHTML = `<p class="empty">No pudimos cargar las noticias.</p>`));
})();
