/* =========================================================
   Vinilo Tracks — buscador curado
   Habla con NUESTRO servidor (/api/search), nunca directo con Discogs.
   Cada resultado abre /vinilo/:id y tiene botón de guardar.
   ========================================================= */
(function () {
  const $q = document.getElementById("q");
  if (!$q) return;
  const { esc, json, tarjetaVinilo, pintarBotones } = window.VT;
  const $country = document.getElementById("country");
  const $sort = document.getElementById("sort");
  const $results = document.getElementById("results");
  const $count = document.getElementById("count");
  let genero = "";
  let ultima = 0;

  async function buscar() {
    const id = ++ultima;
    const params = new URLSearchParams({ q: $q.value.trim(), genre: genero, country: $country.value, sort: $sort.value });
    $results.classList.add("loading");
    $count.textContent = "Buscando en el archivo…";
    try {
      const data = await json("/api/search?" + params);
      if (id !== ultima) return; // ya hay una búsqueda más nueva
      $count.textContent = `${data.total} ${data.total === 1 ? "disco" : "discos"} en vinilo`;
      $results.innerHTML = data.results.length
        ? data.results.map(tarjetaVinilo).join("")
        : `<p class="empty">No encontramos ese disco en el archivo curado. Prueba con otro artista o quita filtros.</p>`;
      pintarBotones();
    } catch (err) {
      if (id !== ultima) return;
      $count.textContent = "";
      $results.innerHTML = `<p class="empty">No pudimos cargar resultados: ${esc(err.message)}. Revisa que el servidor esté corriendo con <code>npm run dev</code>.</p>`;
    } finally {
      if (id === ultima) $results.classList.remove("loading");
    }
  }

  let espera;
  const buscarLuego = () => { clearTimeout(espera); espera = setTimeout(buscar, 400); };

  json("/api/artistas").then(lista => {
    [...new Set(lista.map(a => a.pais))].sort().forEach(p => $country.insertAdjacentHTML("beforeend", `<option>${esc(p)}</option>`));
  }).catch(() => {});

  document.getElementById("chips").addEventListener("click", e => {
    const b = e.target.closest(".chip");
    if (!b) return;
    genero = b.dataset.g;
    document.querySelectorAll("#chips .chip").forEach(c => c.setAttribute("aria-pressed", c === b));
    buscar();
  });
  $q.addEventListener("input", buscarLuego);
  $country.addEventListener("change", buscar);
  $sort.addEventListener("change", buscar);

  /* /?q=Zoé#buscador → llega con la búsqueda hecha */
  const qInicial = new URLSearchParams(location.search).get("q");
  if (qInicial) $q.value = qInicial;
  buscar();
})();
