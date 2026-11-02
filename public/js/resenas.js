/* Vinilo Tracks — listado de reseñas, con filtro por género (#Rock, #Pop, #Alternativo) */
(function () {
  const { resenas, tarjetaResena } = window.VT;
  const grid = document.getElementById("lista");
  const chips = document.getElementById("filtro");
  let todas = [];

  function pintar() {
    const g = decodeURIComponent(location.hash.slice(1));
    chips.querySelectorAll(".chip").forEach(c => c.setAttribute("aria-pressed", c.dataset.g === g));
    const lista = g ? todas.filter(r => r.genero === g) : todas;
    document.getElementById("total").textContent = `${lista.length} ${lista.length === 1 ? "reseña" : "reseñas"}`;
    grid.innerHTML = lista.length ? lista.map(tarjetaResena).join("") : `<p class="empty">Todavía no hay reseñas en esta escena.</p>`;
  }
  chips.addEventListener("click", e => {
    const b = e.target.closest(".chip");
    if (!b) return;
    history.replaceState(null, "", b.dataset.g ? "#" + b.dataset.g : location.pathname);
    pintar();
  });
  window.addEventListener("hashchange", pintar);
  resenas().then(l => { todas = l; pintar(); })
    .catch(() => (grid.innerHTML = `<p class="empty">No pudimos cargar las reseñas.</p>`));
})();
