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

  /* cuántos discos se ven: 21 en compu (3 filas de 7), 6 en celular */
  const movil = window.matchMedia("(max-width: 600px)");
  const porPagina = () => (movil.matches ? 6 : 21);
  let todos = [];
  let visibles = 0;

  // botón "Ver más" debajo de los resultados
  $results.insertAdjacentHTML("afterend", `<div class="more-results" id="more-results" hidden><button class="pill" type="button" id="ver-mas"></button></div>`);
  const $mas = document.getElementById("more-results");
  const $verMas = document.getElementById("ver-mas");

  function pintar() {
    $results.innerHTML = todos.length
      ? todos.slice(0, visibles).map(tarjetaVinilo).join("")
      : `<p class="empty">No encontramos ese disco en el archivo curado. Prueba con otro artista o quita filtros.</p>`;
    const faltan = todos.length - visibles;
    $mas.hidden = faltan <= 0;
    $verMas.textContent = `Ver ${Math.min(faltan, porPagina())} más · quedan ${faltan}`;
    pintarBotones();
  }
  $verMas.addEventListener("click", () => {
    const antes = visibles;
    visibles = Math.min(todos.length, visibles + porPagina());
    pintar();
    // en celular, llevar la vista al primer disco nuevo
    if (movil.matches) $results.children[antes]?.scrollIntoView({ behavior: "smooth", block: "start" });
  });
  movil.addEventListener?.("change", () => { visibles = Math.min(todos.length, Math.max(porPagina(), 0)); pintar(); });

  async function buscar() {
    const id = ++ultima;
    const params = new URLSearchParams({ q: $q.value.trim(), genre: genero, country: $country.value, sort: $sort.value });
    $results.classList.add("loading");
    $count.textContent = "Buscando en el archivo…";
    try {
      const data = await json("/api/search?" + params);
      if (id !== ultima) return; // ya hay una búsqueda más nueva
      todos = data.results;
      visibles = Math.min(todos.length, porPagina());
      $count.textContent = `${todos.length} ${todos.length === 1 ? "disco" : "discos"} en vinilo`;
      pintar();
    } catch (err) {
      if (id !== ultima) return;
      $count.textContent = "";
      $mas.hidden = true;
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
