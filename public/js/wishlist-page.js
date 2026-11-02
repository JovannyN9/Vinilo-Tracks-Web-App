/* Vinilo Tracks — página /wishlist */
(function () {
  const { wishlist, esc, arteVacio, toast } = window.VT;
  const grid = document.getElementById("wl-grid");
  const $orden = document.getElementById("wl-orden");
  const $total = document.getElementById("wl-total");
  const $acciones = document.getElementById("wl-acciones");
  let confirmar = false;

  function ordenar(l) {
    const o = $orden.value;
    return [...l].sort(
      o === "artista" ? (a, b) => a.artista.localeCompare(b.artista) :
      o === "anio" ? (a, b) => (b.anio || 0) - (a.anio || 0) :
      (a, b) => (b.guardado || 0) - (a.guardado || 0)
    );
  }

  function pintar(lista = wishlist.todos()) {
    $total.textContent = `${lista.length} ${lista.length === 1 ? "vinilo guardado" : "vinilos guardados"}`;
    $acciones.hidden = lista.length === 0;
    grid.innerHTML = lista.length
      ? ordenar(lista).map(d => {
          const a = arteVacio(d.artista);
          const fecha = d.guardado ? new Date(d.guardado).toLocaleDateString("es-MX", { day: "numeric", month: "short" }).replace(".", "") : "";
          return `<article class="wl-card">
            <a href="/vinilo/${d.id}" class="art" style="${a.estilo}"><b>${esc(a.ini)}</b>${d.portada ? `<img src="${esc(d.portada)}" alt="Portada de ${esc(d.titulo)}" loading="lazy">` : ""}</a>
            <div class="wl-card-txt">
              <a href="/vinilo/${d.id}"><strong>${esc(d.titulo)}</strong></a>
              <span>${esc(d.artista)} · ${d.anio || "—"}${d.pais ? " · " + esc(d.pais) : ""}</span>
              ${fecha ? `<span class="mono muted">Guardado el ${fecha}</span>` : ""}
            </div>
            <div class="wl-card-actions">
              <a class="pill pill-sm" href="https://www.discogs.com/sell/release/${d.id}" target="_blank" rel="noopener">Buscar precio</a>
              <button class="x" type="button" data-quitar="${d.id}" aria-label="Quitar ${esc(d.titulo)}">✕</button>
            </div>
          </article>`;
        }).join("")
      : `<div class="wl-empty wl-empty-big">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3h12v18l-6-4.5L6 21z"/></svg>
          <h2>Tu wishlist está vacía</h2>
          <p>Busca un vinilo y toca el ícono de guardar. Aquí vas a ver todo lo que quieres conseguir.</p>
          <a class="btn-primary" href="/#buscador">Buscar vinilos</a>
        </div>`;
  }

  grid.addEventListener("click", e => {
    const b = e.target.closest("[data-quitar]");
    if (b) wishlist.quitar(b.dataset.quitar);
  });
  $orden.addEventListener("change", () => pintar());

  /* copiar la lista como texto (para mandarla por WhatsApp, por ejemplo) */
  document.getElementById("wl-copiar").addEventListener("click", async () => {
    const texto = "Mi wishlist de vinilos (Vinilo Tracks):\n" + ordenar(wishlist.todos()).map(d => `• ${d.artista} — ${d.titulo} (${d.anio || "s/f"})`).join("\n");
    try { await navigator.clipboard.writeText(texto); toast("Lista copiada"); }
    catch { toast("No se pudo copiar. Intenta de nuevo."); }
  });

  /* vaciar con confirmación en dos toques */
  const $vaciar = document.getElementById("wl-vaciar");
  $vaciar.addEventListener("click", () => {
    if (!confirmar) {
      confirmar = true;
      $vaciar.textContent = "Toca otra vez para vaciar";
      $vaciar.classList.add("danger");
      setTimeout(() => { confirmar = false; $vaciar.textContent = "Vaciar lista"; $vaciar.classList.remove("danger"); }, 3000);
      return;
    }
    wishlist.vaciar();
    confirmar = false;
  });

  /* invitación a crear cuenta (solo si el login está activo y no hay sesión) */
  const cabeza = document.querySelector(".page-head p");
  cabeza?.insertAdjacentHTML("afterend", `<div class="wl-login" id="wl-login" hidden>
      <span>Tu lista solo vive en este navegador. <strong>Crea una cuenta gratis</strong> para verla en tu celular y en tu compu.</span>
      <button class="btn-primary" type="button" data-auth="registro">Crear cuenta</button>
    </div>`);
  VT.cuenta.cambio(u => {
    document.getElementById("wl-login").hidden = !!u || !VT.cuenta.login;
    cabeza.textContent = u ? `Los vinilos que quieres conseguir. Guardados en tu cuenta (${u.email}).` : "Los vinilos que quieres conseguir. Se guardan en este navegador.";
  });

  wishlist.cambio(pintar);
  pintar();
})();
