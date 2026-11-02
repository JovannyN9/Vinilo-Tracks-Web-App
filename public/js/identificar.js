/* =========================================================
   Vinilo Tracks — IDENTIFICADOR
   1. Escribes o escaneas un código → /api/identificar/buscar
   2. Eliges tu edición (si hay varias)  → /api/identificar/reporte/:id
   La URL cambia en cada paso (?codigo=... o ?id=...), así se puede
   compartir o regresar con el botón de atrás.
   ========================================================= */
(function () {
  const { esc, json, icoSave, pintarBotones, arteVacio, toast } = window.VT;
  const $ = id => document.getElementById(id);
  const out = $("id-out");
  const input = $("id-codigo");
  let tipo = "auto";

  const num = n => (n == null ? "—" : Number(n).toLocaleString("es-MX"));
  const dinero = (v, m = "USD") => v == null ? "—" : Number(v).toLocaleString("es-MX", { style: "currency", currency: m, currencyDisplay: "narrowSymbol", maximumFractionDigits: v < 100 ? 2 : 0 });

  const TRADUCE = {
    "Reissue": "Reedición", "Repress": "Re-prensado", "Remastered": "Remasterizado", "Limited Edition": "Edición limitada",
    "Numbered": "Numerada", "Promo": "Promocional", "Test Pressing": "Prueba de prensado", "White Label": "Etiqueta blanca",
    "Unofficial Release": "No oficial", "Club Edition": "Edición de club", "Special Edition": "Edición especial",
    "Deluxe Edition": "Deluxe", "Stereo": "Estéreo", "Mono": "Mono", "Gatefold": "Gatefold", "180 Gram": "180 g", "Picture Disc": "Picture disc"
  };
  const ESPECIALES = ["Test Pressing", "Promo", "White Label", "Numbered", "Limited Edition", "Picture Disc"];

  /* ---------- tipo de código ---------- */
  const placeholders = {
    auto: "Código de barras o catálogo",
    barcode: "Los números debajo de las barras",
    catno: "Ej. LPR-16043, CBS 20.123",
    matriz: "Lo grabado junto a la etiqueta"
  };
  document.querySelectorAll("[data-tipo]").forEach(b => b.addEventListener("click", () => {
    tipo = b.dataset.tipo;
    document.querySelectorAll("[data-tipo]").forEach(x => x.setAttribute("aria-checked", x === b));
    input.placeholder = placeholders[tipo];
    input.inputMode = tipo === "barcode" ? "numeric" : "text";
    input.focus();
  }));

  /* ---------- historial reciente (en este navegador) ---------- */
  const RKEY = "vt-identificados";
  const recientes = () => { try { return JSON.parse(localStorage.getItem(RKEY)) || []; } catch { return []; } };
  function recordar(r) {
    const item = { id: r.id, artista: r.artista, titulo: r.titulo, portada: r.portada, anio: r.anio, pais: r.pais, rareza: r.rareza.etiqueta, nivel: r.rareza.nivel };
    const lista = [item, ...recientes().filter(x => x.id !== r.id)].slice(0, 8);
    try { localStorage.setItem(RKEY, JSON.stringify(lista)); } catch {}
  }

  function vistaInicial() {
    conResultado(false);
    const lista = recientes();
    out.innerHTML = lista.length ? `
      <section class="id-section">
        <div class="id-sec-head"><h2>Identificados recientemente</h2><button class="link-btn" type="button" id="borrar-rec">Borrar historial</button></div>
        <div class="rec-grid">${lista.map(x => {
          const a = arteVacio(x.artista);
          return `<a class="rec" href="?id=${x.id}" data-ir="${x.id}">
            <span class="art" style="${a.estilo}"><b>${esc(a.ini)}</b>${x.portada ? `<img src="${esc(x.portada)}" alt="" loading="lazy">` : ""}</span>
            <span class="rec-txt"><strong>${esc(x.titulo)}</strong><span>${esc(x.artista)} · ${x.anio || "—"} · ${esc(x.pais || "")}</span><em class="lvl lvl-${x.nivel}">${esc(x.rareza)}</em></span>
          </a>`;
        }).join("")}</div>
      </section>` : "";
    $("borrar-rec")?.addEventListener("click", () => { try { localStorage.removeItem(RKEY); } catch {} vistaInicial(); });
  }

  /* ---------- navegación con la URL ---------- */
  function ir(params, reemplazar = false) {
    const url = location.pathname + (params ? "?" + new URLSearchParams(params) : "");
    history[reemplazar ? "replaceState" : "pushState"](null, "", url);
    leerURL();
  }
  function leerURL() {
    const p = new URLSearchParams(location.search);
    if (p.get("id")) return reporte(p.get("id"));
    if (p.get("codigo")) {
      input.value = p.get("codigo");
      const t = p.get("tipo") || "auto";
      document.querySelector(`[data-tipo="${t}"]`)?.click();
      return buscar(p.get("codigo"), t);
    }
    vistaInicial();
  }
  window.addEventListener("popstate", leerURL);
  out.addEventListener("click", e => {
    const a = e.target.closest("[data-ir]");
    if (!a || e.metaKey || e.ctrlKey) return;
    e.preventDefault();
    ir({ id: a.dataset.ir });
  });

  $("id-form").addEventListener("submit", e => {
    e.preventDefault();
    const codigo = input.value.trim();
    if (codigo.length < 2) { input.focus(); return toast("Escribe el código del disco."); }
    input.blur();
    ir({ codigo, tipo });
  });

  /* en celular, el hero se compacta cuando ya hay resultados */
  const conResultado = si => document.body.classList.toggle("id-con-resultado", si);

  function cargando(texto) {
    conResultado(true);
    out.innerHTML = `<div class="id-loading"><div class="loader" aria-hidden="true"></div><p class="mono muted">${esc(texto)}</p></div>`;
    out.scrollIntoView({ behavior: "smooth", block: "start" });
  }
  function error(texto) {
    out.innerHTML = `<div class="id-empty"><h2>Algo falló</h2><p>${esc(texto)}</p></div>`;
  }

  /* =======================================================
     PASO 1: buscar por código
     ======================================================= */
  async function buscar(codigo, t) {
    cargando("Buscando ediciones con ese código…");
    try {
      const d = await json(`/api/identificar/buscar?${new URLSearchParams({ codigo, tipo: t })}`);
      if (!d.total) {
        out.innerHTML = `<div class="id-empty">
          <h2>No encontramos ese código</h2>
          <p>Revisa que esté bien escrito. Si probaste el código de barras, intenta con el número de catálogo del lomo, o al revés. Los discos anteriores a los 80 casi nunca tienen código de barras.</p>
        </div>`;
        return;
      }
      if (d.total === 1) return ir({ id: d.resultados[0].id }, true);

      out.innerHTML = `
        <section class="id-section">
          <div class="id-sec-head">
            <div><span class="eyebrow">${d.total} ${d.total === 1 ? "edición" : "ediciones"}</span><h2>¿Cuál es la tuya?</h2></div>
            <p class="muted">Compara el país, el sello y el formato con lo que dice tu disco.${d.soloVinilo ? "" : " Ojo: no encontramos vinilos con ese código, estas son otras versiones (CD, casete)."}</p>
          </div>
          <div class="ed-list">${d.resultados.map(r => {
            const a = arteVacio(r.artista);
            const especial = r.formato.filter(f => ESPECIALES.includes(f) || f === "Unofficial Release");
            return `<a class="ed" href="?id=${r.id}" data-ir="${r.id}">
              <span class="art" style="${a.estilo}"><b>${esc(a.ini)}</b>${r.portada ? `<img src="${esc(r.portada)}" alt="" loading="lazy">` : ""}</span>
              <span class="ed-main">
                <strong>${esc(r.artista)} — ${esc(r.titulo)}</strong>
                <span class="ed-meta"><b>${r.anio || "s/f"}</b> · ${esc(r.pais || "País desconocido")} · ${esc(r.sello)} ${r.catno ? `· <code>${esc(r.catno)}</code>` : ""}</span>
                <span class="ed-tags">${r.formato.slice(0, 5).map(f => `<i class="${especial.includes(f) ? "hot" : ""}">${esc(TRADUCE[f] || f)}</i>`).join("")}</span>
              </span>
              <span class="ed-have mono">${r.tienen != null ? `${num(r.tienen)}<br><small>lo tienen</small>` : ""}</span>
            </a>`;
          }).join("")}</div>
        </section>`;
    } catch (e) {
      error(e.message);
    }
  }

  /* =======================================================
     PASO 2: reporte de una edición
     ======================================================= */
  async function reporte(id) {
    cargando("Revisando la edición, el mercado y la comunidad…");
    try {
      const r = await json(`/api/identificar/reporte/${encodeURIComponent(id)}`);
      document.title = `${r.artista} — ${r.titulo} · Identificador · Vinilo Tracks`;
      recordar(r);
      pintarReporte(r);
    } catch (e) {
      error(e.message);
    }
  }

  function pintarReporte(r) {
    const a = arteVacio(r.artista);
    const guardar = { id: r.id, titulo: r.titulo, artista: r.artista, anio: r.anio, pais: r.pais, portada: r.portada };
    const ed = r.edicion;
    const m = r.mercado;
    const sello = r.sellos[0];

    /* --- edición: primera o reedición --- */
    let edTitulo, edTexto;
    if (ed.esPrimera) {
      edTitulo = "Primera edición";
      edTexto = `Es del año en que salió el disco (${ed.anioOriginal}).` +
        (ed.mismoAnio > 1 ? ` Ese año salieron ${ed.mismoAnio} ediciones en vinilo en distintos países: confirma la tuya con la matriz.` : "");
    } else if (ed.esReedicion || (ed.anioOriginal && r.anio && r.anio > ed.anioOriginal)) {
      edTitulo = "Reedición";
      edTexto = ed.anioOriginal
        ? `El disco salió originalmente en ${ed.anioOriginal}. Esta edición es de ${r.anio || "un año posterior"}.`
        : "Esta edición salió después de la original.";
    } else {
      edTitulo = "Edición sin confirmar";
      edTexto = "Discogs no tiene suficiente información para saber si es la primera edición.";
    }

    /* --- precios por condición --- */
    const maxPrecio = Math.max(...m.precios.map(p => p.valor), 1);
    const precios = m.precios.length
      ? `<ul class="cond">${m.precios.map(p => `
          <li>
            <span class="cond-code">${esc(p.codigo)}</span>
            <span class="cond-info"><strong>${esc(p.nombre)}</strong><small>${esc(p.desc)}</small></span>
            <span class="cond-bar"><span style="width:${Math.max(6, (p.valor / maxPrecio) * 100)}%"></span></span>
            <span class="cond-val">${dinero(p.valor, p.moneda)}</span>
          </li>`).join("")}</ul>
        <p class="mono muted small">Precio sugerido por Discogs según ventas pasadas en cada condición.</p>`
      : `<div class="price-solo">
          <span class="mono muted">Copia más barata a la venta</span>
          <b>${m.desde != null ? dinero(m.desde, m.moneda) : "Sin copias"}</b>
        </div>
        <p class="mono muted small">Discogs no dio precios por condición para este disco. Para ver cuánto se ha pagado, revisa el historial de ventas.</p>`;

    out.innerHTML = `
    <article class="rep">
      <header class="rep-head">
        <div class="rep-cover">
          <div class="rep-art" style="${a.estilo}">${r.portada ? `<img src="${esc(r.portada)}" alt="Portada de ${esc(r.titulo)}">` : `<span class="art" style="${a.estilo}"><b>${esc(a.ini)}</b></span>`}</div>
          <div class="spin-disc" aria-hidden="true"></div>
        </div>
        <div class="rep-info">
          <a class="crumb mono" href="/identificar" data-volver>← Identificar otro</a>
          <span class="rep-artist">${esc(r.artista)}</span>
          <h2 class="rep-title">${esc(r.titulo)}</h2>
          <p class="rep-line">${[r.anio, r.pais, sello?.nombre].filter(Boolean).map(esc).join(" · ")}${sello?.catalogo ? ` · <code>${esc(sello.catalogo)}</code>` : ""}</p>
          <p class="rep-format mono">${esc(r.formato)}</p>
          ${r.banderas.length ? `<div class="ed-tags">${r.banderas.map(b => `<i class="${ESPECIALES.includes(b) ? "hot" : ""}">${esc(TRADUCE[b] || b)}</i>`).join("")}</div>` : ""}
          ${r.noOficial ? `<p class="rep-alert"><strong>Ojo:</strong> Discogs marca esta edición como <strong>no oficial</strong> (pirata o bootleg). Suele valer menos que una edición oficial.</p>` : ""}
          <div class="rep-actions">
            <button class="btn-primary" type="button" data-save='${esc(JSON.stringify(guardar))}' aria-pressed="false">${icoSave}<span class="save-label">Guardar en wishlist</span></button>
            <a class="pill" href="/vinilo/${r.id}">Ficha completa →</a>
          </div>
        </div>
      </header>

      <div class="bento">
        <section class="tile tile-rare lvl-${r.rareza.nivel}">
          <span class="eyebrow">Rareza</span>
          <div class="rare-big">${esc(r.rareza.etiqueta)}</div>
          <div class="meter" role="img" aria-label="Rareza: ${esc(r.rareza.etiqueta)}, ${r.rareza.nivel + 1} de 4">
            ${[0, 1, 2, 3].map(i => `<span class="${i <= r.rareza.nivel ? "on" : ""}"></span>`).join("")}
          </div>
          <div class="meter-labels mono"><span>Común</span><span>Muy raro</span></div>
          <ul class="why">${r.rareza.razones.map(x => `<li class="${x.peso === "+" ? "up" : "down"}"><span aria-hidden="true">${x.peso === "+" ? "▲" : "▼"}</span>${esc(x.texto)}</li>`).join("")}</ul>
          <p class="rare-note mono">▲ suma rareza · ▼ la baja. Calculado con cuántos lo tienen, cuántos lo buscan, cuántas copias hay a la venta y el tipo de edición.</p>
        </section>

        <section class="tile tile-price">
          <span class="eyebrow">¿Cuánto vale?</span>
          ${precios}
          <div class="price-foot">
            <span class="mono"><b>${num(m.enVenta)}</b> a la venta ahora${m.desde != null && m.precios.length ? ` · desde ${dinero(m.desde, m.moneda)}` : ""}</span>
            <span class="price-links">
              <a href="${esc(m.historialUrl)}" target="_blank" rel="noopener">Historial de ventas ↗</a>
              <a href="${esc(m.ventaUrl)}" target="_blank" rel="noopener">Comprar ↗</a>
            </span>
          </div>
        </section>

        <section class="tile tile-ed">
          <span class="eyebrow">Edición</span>
          <div class="ed-big ${ed.esPrimera ? "first" : ""}">${edTitulo}</div>
          <p>${esc(edTexto)}</p>
          ${ed.totalVinilo ? `<p class="mono muted">Hay ${num(ed.totalVinilo)} ediciones en vinilo de este disco${ed.totalVersiones > ed.totalVinilo ? ` (${num(ed.totalVersiones)} contando CD y casete)` : ""}.</p>` : ""}
        </section>

        <section class="tile tile-comm">
          <span class="eyebrow">Comunidad Discogs</span>
          <div class="comm">
            <div><b>${num(r.comunidad.tienen)}</b><span>lo tienen</span></div>
            <div><b>${num(r.comunidad.quieren)}</b><span>lo buscan</span></div>
          </div>
          ${r.comunidad.rating ? `<p class="mono muted">Calificación ${r.comunidad.rating.toFixed(2)} / 5 · ${num(r.comunidad.votos)} votos</p>` : ""}
        </section>
      </div>

      ${r.verificar.length ? `
      <section class="id-section">
        <div class="id-sec-head">
          <div><span class="eyebrow">Paso final</span><h2>Verifica tu copia</h2></div>
          <p class="muted">Marca cada dato que coincida con tu disco. Si todo coincide, tienes esta edición.</p>
        </div>
        <ol class="check" id="check">${r.verificar.map((v, i) => `
          <li>
            <label class="check-row">
              <input type="checkbox" id="chk-${i}">
              <span class="check-box" aria-hidden="true"></span>
              <span class="check-txt">
                <span class="check-type">${esc(v.tipo)}${v.nota ? ` <em>${esc(v.nota)}</em>` : ""}</span>
                <code class="check-val">${esc(v.valor)}</code>
                <span class="check-where">${esc(v.donde)}</span>
              </span>
            </label>
          </li>`).join("")}</ol>
        <p class="check-done" id="check-done" hidden>✓ Todo coincide. Esta es tu edición.</p>
      </section>` : ""}

      ${r.otras.length > 1 ? `
      <section class="id-section">
        <div class="id-sec-head">
          <div><span class="eyebrow">${r.otras.length} en vinilo</span><h2>Otras ediciones</h2></div>
          <p class="muted">¿No coincide? Puede que tengas otra edición. Tócala para ver su reporte.</p>
        </div>
        <div class="tbl-wrap">
          <table class="tbl">
            <thead><tr><th>Año</th><th>País</th><th>Sello</th><th>Catálogo</th><th>Formato</th><th class="r">Lo tienen</th></tr></thead>
            <tbody>${r.otras.map(o => `
              <tr class="${o.actual ? "cur" : ""}" ${o.actual ? "" : `data-ir="${o.id}" tabindex="0"`}>
                <td>${o.anio || "—"}</td><td>${esc(o.pais)}</td><td>${esc(o.sello)}</td><td><code>${esc(o.catno)}</code></td>
                <td>${esc(o.formato)}</td><td class="r">${o.actual ? "<b>Esta</b>" : num(o.tienen)}</td>
              </tr>`).join("")}</tbody>
          </table>
        </div>
      </section>` : ""}

      <p class="mono muted credit">Datos de <a href="${esc(r.discogsUrl)}" target="_blank" rel="noopener">Discogs</a>. La rareza es un cálculo de Vinilo Tracks con datos de la comunidad; tómalo como guía, no como avalúo.</p>
    </article>`;

    pintarBotones();
    out.scrollIntoView({ behavior: "smooth", block: "start" });

    out.querySelector("[data-volver]")?.addEventListener("click", e => {
      e.preventDefault();
      input.value = "";
      ir(null);
      window.scrollTo({ top: 0, behavior: "smooth" });
      setTimeout(() => input.focus(), 400);
    });
    out.querySelectorAll("tr[data-ir]").forEach(tr => tr.addEventListener("keydown", e => { if (e.key === "Enter") ir({ id: tr.dataset.ir }); }));
    const check = $("check");
    check?.addEventListener("change", () => {
      const cajas = [...check.querySelectorAll("input")];
      $("check-done").hidden = !cajas.every(c => c.checked);
    });
  }

  /* =======================================================
     ESCÁNER (cámara)
     1) BarcodeDetector nativo (Chrome / Android)
     2) Si no existe (iPhone), carga la librería html5-qrcode
     ======================================================= */
  const scan = $("scan"), scanBg = $("scan-bg"), video = $("scan-video"), scanMsg = $("scan-msg");
  let stream = null, buscando = false, lib = null;

  function cerrarScan() {
    buscando = false;
    stream?.getTracks().forEach(t => t.stop());
    stream = null;
    lib?.stop().catch(() => {}).finally(() => { lib?.clear?.(); lib = null; });
    document.body.classList.remove("scan-open");
    scan.hidden = scanBg.hidden = true;
    video.hidden = false;
  }
  function encontrado(codigo) {
    cerrarScan();
    if (navigator.vibrate) navigator.vibrate(60);
    input.value = codigo;
    document.querySelector('[data-tipo="barcode"]').click();
    ir({ codigo, tipo: "barcode" });
  }

  async function escanearNativo() {
    const formatos = ["ean_13", "ean_8", "upc_a", "upc_e"];
    const detector = new window.BarcodeDetector({ formats: formatos });
    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment", width: { ideal: 1280 } }, audio: false });
    video.srcObject = stream;
    await video.play();
    buscando = true;
    const ciclo = async () => {
      if (!buscando) return;
      try {
        const codigos = await detector.detect(video);
        if (codigos[0]?.rawValue) return encontrado(codigos[0].rawValue);
      } catch {}
      setTimeout(ciclo, 180);
    };
    ciclo();
  }

  function cargarLibreria() {
    if (window.Html5Qrcode) return Promise.resolve();
    return new Promise((ok, mal) => {
      const s = document.createElement("script");
      s.src = "https://cdn.jsdelivr.net/npm/html5-qrcode@2.3.8/html5-qrcode.min.js";
      s.onload = ok;
      s.onerror = () => mal(new Error("No se pudo cargar el escáner."));
      document.head.appendChild(s);
    });
  }
  async function escanearLibreria() {
    await cargarLibreria();
    video.hidden = true;
    let caja = $("scan-lib");
    if (!caja) { caja = document.createElement("div"); caja.id = "scan-lib"; $("scan-view").prepend(caja); }
    const F = window.Html5QrcodeSupportedFormats;
    lib = new window.Html5Qrcode("scan-lib", { formatsToSupport: [F.EAN_13, F.EAN_8, F.UPC_A, F.UPC_E], verbose: false });
    await lib.start({ facingMode: "environment" }, { fps: 10, qrbox: { width: 260, height: 130 } }, texto => encontrado(texto), () => {});
  }

  $("id-scan").addEventListener("click", async () => {
    if (!navigator.mediaDevices?.getUserMedia) return toast("Tu navegador no permite usar la cámara. Escribe el código.");
    scan.hidden = scanBg.hidden = false;
    requestAnimationFrame(() => document.body.classList.add("scan-open"));
    scanMsg.textContent = "Apunta al código de barras de la contraportada.";
    try {
      if ("BarcodeDetector" in window) await escanearNativo();
      else await escanearLibreria();
    } catch (e) {
      const negado = /NotAllowed|Permission/i.test(e.name + e.message);
      scanMsg.textContent = negado
        ? "No diste permiso para usar la cámara. Actívalo en los ajustes del navegador o escribe el código."
        : "No pudimos abrir la cámara. Escribe el código a mano.";
    }
  });
  $("scan-close").addEventListener("click", cerrarScan);
  scanBg.addEventListener("click", cerrarScan);
  document.addEventListener("keydown", e => { if (e.key === "Escape" && !scan.hidden) cerrarScan(); });

  leerURL();
})();
