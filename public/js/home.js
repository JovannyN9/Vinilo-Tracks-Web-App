/* =========================================================
   Vinilo Tracks — home
   ========================================================= */
(function () {
  const { resenas, noticias, tarjetaResena, tarjetaNoticia } = window.VT;

  /* cinta en movimiento (izquierda → derecha) */
  const palabras = ["Vinilo Tracks", "Reseñas", "Noticias", "Lanzamientos", "Rock en español", "Joyas"];
  const track = document.getElementById("track");
  if (track) track.innerHTML = palabras.map(p => `<span>${p}</span><i>✦</i>`).join("").repeat(4);

  /* últimas 6 reseñas */
  resenas().then(l => { document.getElementById("coll").innerHTML = l.slice(0, 6).map(tarjetaResena).join(""); })
    .catch(() => { document.getElementById("coll").innerHTML = `<p class="empty">No pudimos cargar las reseñas.</p>`; });

  /* últimas 3 noticias: la primera grande */
  noticias().then(l => { document.getElementById("news").innerHTML = l.slice(0, 3).map((n, i) => tarjetaNoticia(n, i === 0)).join(""); })
    .catch(() => {});
})();

/* fecha de hoy arriba a la izquierda del hero ("Oct 31") */
(function () {
  const el = document.getElementById("hoy");
  if (!el) return;
  const d = new Date();
  const mes = d.toLocaleDateString("es-MX", { month: "short" }).replace(".", "");
  el.textContent = mes.charAt(0).toUpperCase() + mes.slice(1) + " " + d.getDate();
})();

/* ---- invitación al identificador (se inserta después del buscador) ---- */
(function () {
  const buscador = document.getElementById("buscador");
  if (!buscador) return;
  buscador.insertAdjacentHTML("afterend", `
    <section class="id-cta" aria-labelledby="id-cta-t">
      <div class="wrap">
        <a class="id-cta-in" href="/identificar">
          <div class="id-cta-txt">
            <span class="eyebrow">Herramienta para coleccionistas</span>
            <h2 id="id-cta-t">¿Encontraste un vinilo? Identifícalo.</h2>
            <p>Escanea el código de barras o escribe el número de catálogo. Te decimos qué edición es, si es rara y cuánto vale según su estado.</p>
            <span class="btn-primary">Identificar un vinilo →</span>
          </div>
          <div class="id-cta-art" aria-hidden="true">
            <div class="cta-disc"></div>
            <div class="cta-tag"><b>Raro</b><span>Primera edición · 1986</span></div>
            <div class="cta-tag cta-tag-2"><b>VG+</b><span>$48.00</span></div>
          </div>
        </a>
      </div>
    </section>`);
})();
