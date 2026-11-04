/* =========================================================
   Vinilo Tracks — IDENTIFICADOR (español / English)
   1. Escribes o escaneas un código → /api/identificar/buscar
   2. Eliges tu edición (si hay varias)  → /api/identificar/reporte/:id
   La URL cambia en cada paso (?codigo=... o ?id=...), así se puede
   compartir o regresar con el botón de atrás.

   IDIOMA: todos los textos de esta herramienta están en el objeto T.
   - La primera vez se usa el idioma del celular (español → ES, otro → EN).
   - El switch ES / EN lo cambia y se recuerda en este navegador.
   - Para agregar o corregir un texto, cámbialo en T.es y en T.en.
   ========================================================= */
(function () {
  const { esc, json, icoSave, pintarBotones, arteVacio, toast } = window.VT;
  const $ = id => document.getElementById(id);
  const out = $("id-out");
  const input = $("id-codigo");
  let tipo = "auto";
  let ultimoReporte = null;   // para volver a pintarlo si cambian de idioma
  let ultimaBusqueda = null;

  /* =======================================================
     TEXTOS
     ======================================================= */
  const T = {
    es: {
      eyebrow: "Herramienta para coleccionistas",
      titulo: "¿Qué disco tienes en la mano?",
      intro: "Escribe o escanea el código y te decimos qué edición es, si es primera edición o reedición, qué tan raro es y cuánto vale según su estado.",
      formatosTitulo: "Funciona con",
      formatos: ["Vinilos", "CDs", "Casetes", "Box sets", "y más"],
      tipoAuto: "No sé / Auto", tipoBarcode: "Código de barras", tipoCatno: "Catálogo", tipoMatriz: "Matriz",
      phAuto: "Código de barras o catálogo", phBarcode: "Los números debajo de las barras", phCatno: "Ej. LPR-16043, CBS 20.123", phMatriz: "Lo grabado junto a la etiqueta",
      escanear: "Escanear", identificar: "Identificar",
      tip: "Tip: el código de barras es el más exacto. Si no tiene, usa el número de catálogo.",
      dondeBarcodeT: "Código de barras", dondeBarcode: "Contraportada o sticker del plástico. Discos y CDs de los 80 en adelante.",
      dondeCatnoT: "Número de catálogo", dondeCatno: "En el lomo, la contraportada y la etiqueta. Ej.",
      dondeMatrizT: "Matriz", dondeMatriz: "Grabada en la parte lisa del vinilo junto a la etiqueta, o en el anillo transparente del CD. Separa una primera edición de una reedición.",
      scanMsg: "Apunta al código de barras de la contraportada.",
      scanCancelar: "Cancelar",
      scanSinCamara: "Tu navegador no permite usar la cámara. Escribe el código.",
      scanNegado: "No diste permiso para usar la cámara. Actívalo en los ajustes del navegador o escribe el código.",
      scanFallo: "No pudimos abrir la cámara. Escribe el código a mano.",
      escribeCodigo: "Escribe el código del disco.",
      recientes: "Identificados recientemente", borrarHistorial: "Borrar historial",
      cargandoBuscar: "Buscando ediciones con ese código…",
      cargandoReporte: "Revisando la edición, el mercado y la comunidad…",
      algoFallo: "Algo falló",
      errores: { corto: "Escribe un código de al menos 2 caracteres.", noExiste: "Ese disco no existe en Discogs.", token: "El servidor no está conectado con Discogs.", discogs: "Discogs no respondió. Intenta otra vez en un momento.", def: "No pudimos completar la búsqueda. Intenta otra vez." },
      noEncontrado: "No encontramos ese código",
      noEncontradoTxt: "Revisa que esté bien escrito. Si probaste el código de barras, intenta con el número de catálogo del lomo, o al revés. Los discos anteriores a los 80 casi nunca tienen código de barras.",
      ediciones: n => `${n} ${n === 1 ? "edición" : "ediciones"}`,
      cualTuya: "¿Cuál es la tuya?",
      comparaTxt: "Compara el formato, el país y el sello con lo que dice tu disco.",
      sinFecha: "s/f", paisDesc: "País desconocido", loTienen: "lo tienen",
      identificarOtro: "← Identificar otro",
      noOficial: "<strong>Ojo:</strong> Discogs marca esta edición como <strong>no oficial</strong> (pirata o bootleg). Suele valer menos que una edición oficial.",
      guardar: "Guardar en wishlist", enWishlist: "En tu wishlist", fichaCompleta: "Ficha completa →",
      rareza: "Rareza", niveles: ["Común", "Poco común", "Raro", "Muy raro"],
      nivelDe: (et, n) => `Rareza: ${et}, ${n} de 4`,
      razones: {
        muyPocos: d => `Solo ${num(d.n)} coleccionistas en Discogs dicen tenerlo.`,
        pocos: d => `Pocos coleccionistas lo tienen (${num(d.n)}).`,
        algunos: d => `${num(d.n)} coleccionistas lo tienen.`,
        muchos: d => `Más de ${num(d.n)} coleccionistas lo tienen. Circulan muchas copias.`,
        demandaAlta: d => `Lo buscan ${d.n} veces más personas de las que lo tienen.`,
        demanda: () => "Más gente lo busca de la que lo tiene.",
        sinVenta: () => "Ahora mismo no hay ninguna copia a la venta en Discogs.",
        pocaVenta: d => `Solo ${d.n} ${d.n === 1 ? "copia" : "copias"} a la venta en Discogs.`,
        muchaVenta: d => `Hay ${d.n} copias a la venta: no es difícil de conseguir.`,
        test: () => "Es una prueba de prensado (test pressing). Se hacen muy pocas.",
        promo: () => "Es una copia promocional, no se vendía en tiendas.",
        numerada: () => "Es una edición numerada.",
        limitada: () => "Es edición limitada.",
        primera: d => `Es de la primera tanda, de ${d.n}.`,
        reedicion: () => "Es una reedición, no la edición original."
      },
      rareNote: "▲ suma rareza · ▼ la baja. Calculado con cuántos lo tienen, cuántos lo buscan, cuántas copias hay a la venta y el tipo de edición.",
      cuantoVale: "¿Cuánto vale?",
      condiciones: {
        "M": ["Mint", "Nuevo o sellado. Nunca se ha tocado."],
        "NM": ["Near Mint", "Casi perfecto. Sin marcas visibles."],
        "VG+": ["Very Good +", "Marcas muy leves. Suena muy bien."],
        "VG": ["Very Good", "Marcas visibles y algo de ruido."],
        "G+": ["Good +", "Muy usado. Ruido constante, pero se escucha."],
        "G": ["Good", "Muy desgastado. Solo para completar colección."]
      },
      precioSugerido: "Precio sugerido por Discogs según ventas pasadas en cada condición.",
      masBarata: "Copia más barata a la venta", sinCopias: "Sin copias",
      sinPrecios: "Discogs no dio precios por condición para este disco. Para ver cuánto se ha pagado, revisa el historial de ventas.",
      aLaVenta: n => `<b>${num(n)}</b> a la venta ahora`, desde: v => ` · desde ${v}`,
      historial: "Historial de ventas ↗", comprar: "Comprar ↗",
      edicion: "Edición",
      primeraT: "Primera edición", reedicionT: "Reedición", sinConfirmarT: "Edición sin confirmar",
      primeraTxt: (a, n, f) => `Es del año en que salió el disco (${a}).` + (n > 1 ? ` Ese año salieron ${n} ediciones en ${f} en distintos países: confirma la tuya con la matriz.` : ""),
      reedicionTxt: (a, b) => a ? `El disco salió originalmente en ${a}. Esta edición es de ${b || "un año posterior"}.` : "Esta edición salió después de la original.",
      sinConfirmarTxt: "Discogs no tiene suficiente información para saber si es la primera edición.",
      totalEd: (n, partes) => `Este disco tiene ${num(n)} ediciones: ${partes}.`,
      comunidad: "Comunidad Discogs", loBuscan: "lo buscan",
      calificacion: (r, v) => `Calificación ${r} / 5 · ${num(v)} votos`,
      pasoFinal: "Paso final", verifica: "Verifica tu copia",
      verificaTxt: "Compara estos datos con tu disco. Si coinciden, tienes esta edición.",
      verificaUno: "Compara este dato con tu disco. Si coincide, tienes esta edición.",
      checkDone: "✓ Coincide. Esta es tu edición.",
      masCodigos: n => `Ver ${n} ${n === 1 ? "código más" : "códigos más"}`,
      masCodigosTxt: "Detalles extra para coleccionistas. No necesitas revisarlos todos.",
      catnoT: "Número de catálogo",
      tiposCodigo: { "Barcode": "Código de barras", "Matrix / Runout": "Matriz", "Label Code": "Código de sello", "Rights Society": "Sociedad de derechos", "Mould SID Code": "Código SID (molde)", "Mastering SID Code": "Código SID (mastering)", "Pressing Plant ID": "Planta de prensado", "Price Code": "Código de precio", "ASIN": "ASIN", "ISRC": "ISRC", "Other": "Otro" },
      donde: {
        catno: { def: "En el lomo, la contraportada y la etiqueta del disco.", CD: "En el lomo y la contraportada del estuche, y en el disco.", Cassette: "En el lomo del estuche y en el casete." },
        "Matrix / Runout": { def: "Grabado en la parte lisa del vinilo, entre la última canción y la etiqueta. Compáralo letra por letra.", CD: "Grabado en el anillo transparente del centro del CD. Compáralo letra por letra.", Cassette: "Grabado o impreso en el plástico del casete." },
        "Barcode": { def: "En la contraportada o en un sticker del plástico." }
      },
      otrasEd: "Otras ediciones", otrasN: n => `${n} ediciones`,
      otrasTxt: "¿No coincide? Puede que tengas otra edición. Tócala para ver su reporte.",
      cols: ["Año", "Formato", "País", "Sello", "Catálogo", "Lo tienen"], esta: "Esta",
      credito: url => `Datos de <a href="${url}" target="_blank" rel="noopener">Discogs</a>. La rareza es un cálculo de Vinilo Tracks con datos de la comunidad; tómalo como guía, no como avalúo.`,
      portadaDe: t => `Portada de ${t}`,
      tipos: { "Vinyl": "Vinilo", "CD": "CD", "Cassette": "Casete", "Box Set": "Box set", "File": "Digital", "DVD": "DVD", "Shellac": "Shellac (78 RPM)", "Lathe Cut": "Lathe cut", "Flexi-disc": "Flexi-disc", "8-Track Cartridge": "8-track", "Reel-To-Reel": "Cinta de carrete", "Minidisc": "MiniDisc", "CDr": "CD-R", "Other": "Otro" },
      banderas: { "Reissue": "Reedición", "Repress": "Re-prensado", "Remastered": "Remasterizado", "Limited Edition": "Edición limitada", "Numbered": "Numerada", "Promo": "Promocional", "Test Pressing": "Prueba de prensado", "White Label": "Etiqueta blanca", "Unofficial Release": "No oficial", "Club Edition": "Edición de club", "Special Edition": "Edición especial", "Deluxe Edition": "Deluxe", "Stereo": "Estéreo", "Mono": "Mono", "Gatefold": "Gatefold", "180 Gram": "180 g", "Picture Disc": "Picture disc", "Album": "Álbum", "Compilation": "Compilación", "Single": "Sencillo", "EP": "EP", "LP": "LP" },
      docTitulo: "Identifica tu disco · Vinilo Tracks"
    },

    en: {
      eyebrow: "A tool for collectors",
      titulo: "What record are you holding?",
      intro: "Type or scan the code and we'll tell you which edition it is, whether it's a first press or a reissue, how rare it is, and what it's worth by condition.",
      formatosTitulo: "Works with",
      formatos: ["Vinyl", "CDs", "Cassettes", "Box sets", "and more"],
      tipoAuto: "Not sure / Auto", tipoBarcode: "Barcode", tipoCatno: "Catalog #", tipoMatriz: "Matrix",
      phAuto: "Barcode or catalog number", phBarcode: "The numbers under the bars", phCatno: "e.g. LPR-16043, CBS 20.123", phMatriz: "The text etched near the label",
      escanear: "Scan", identificar: "Identify",
      tip: "Tip: the barcode is the most accurate. If there isn't one, use the catalog number.",
      dondeBarcodeT: "Barcode", dondeBarcode: "On the back cover or a sticker on the shrink wrap. Records and CDs from the '80s on.",
      dondeCatnoT: "Catalog number",
      dondeCatno: "On the spine, the back cover and the label. e.g.",
      dondeMatrizT: "Matrix", dondeMatriz: "Etched in the run-out groove near the label, or on the clear inner ring of a CD. It tells a first press from a reissue.",
      scanMsg: "Point the camera at the barcode on the back cover.",
      scanCancelar: "Cancel",
      scanSinCamara: "Your browser can't use the camera. Type the code instead.",
      scanNegado: "Camera access was blocked. Allow it in your browser settings or type the code.",
      scanFallo: "We couldn't open the camera. Type the code instead.",
      escribeCodigo: "Type the code from your record.",
      recientes: "Recently identified", borrarHistorial: "Clear history",
      cargandoBuscar: "Looking for editions with that code…",
      cargandoReporte: "Checking the edition, the market and the community…",
      algoFallo: "Something went wrong",
      errores: { corto: "Type a code with at least 2 characters.", noExiste: "That release doesn't exist on Discogs.", token: "The server isn't connected to Discogs.", discogs: "Discogs didn't respond. Try again in a moment.", def: "We couldn't finish the search. Try again." },
      noEncontrado: "We couldn't find that code",
      noEncontradoTxt: "Check that it's typed correctly. If you tried the barcode, try the catalog number on the spine, or the other way around. Records from before the '80s rarely have a barcode.",
      ediciones: n => `${n} ${n === 1 ? "edition" : "editions"}`,
      cualTuya: "Which one is yours?",
      comparaTxt: "Compare the format, country and label with what your copy says.",
      sinFecha: "n.d.", paisDesc: "Unknown country", loTienen: "have it",
      identificarOtro: "← Identify another",
      noOficial: "<strong>Heads up:</strong> Discogs marks this edition as <strong>unofficial</strong> (a bootleg). It's usually worth less than an official release.",
      guardar: "Save to wishlist", enWishlist: "In your wishlist", fichaCompleta: "Full details →",
      rareza: "Rarity", niveles: ["Common", "Uncommon", "Rare", "Very rare"],
      nivelDe: (et, n) => `Rarity: ${et}, ${n} of 4`,
      razones: {
        muyPocos: d => `Only ${num(d.n)} collectors on Discogs say they own it.`,
        pocos: d => `Few collectors own it (${num(d.n)}).`,
        algunos: d => `${num(d.n)} collectors own it.`,
        muchos: d => `Over ${num(d.n)} collectors own it. Plenty of copies around.`,
        demandaAlta: d => `${d.n}× more people want it than own it.`,
        demanda: () => "More people want it than own it.",
        sinVenta: () => "There are no copies for sale on Discogs right now.",
        pocaVenta: d => `Only ${d.n} ${d.n === 1 ? "copy" : "copies"} for sale on Discogs.`,
        muchaVenta: d => `${d.n} copies for sale: not hard to find.`,
        test: () => "It's a test pressing. Very few are made.",
        promo: () => "It's a promo copy, never sold in stores.",
        numerada: () => "It's a numbered edition.",
        limitada: () => "It's a limited edition.",
        primera: d => `It's from the first run, ${d.n}.`,
        reedicion: () => "It's a reissue, not the original edition."
      },
      rareNote: "▲ adds rarity · ▼ lowers it. Based on how many own it, how many want it, how many copies are for sale and the type of edition.",
      cuantoVale: "What's it worth?",
      condiciones: {
        "M": ["Mint", "New or sealed. Never played."],
        "NM": ["Near Mint", "Nearly perfect. No visible marks."],
        "VG+": ["Very Good Plus", "Very light marks. Plays great."],
        "VG": ["Very Good", "Visible marks and some noise."],
        "G+": ["Good Plus", "Heavily played. Constant noise, still listenable."],
        "G": ["Good", "Very worn. Only to fill a gap."]
      },
      precioSugerido: "Discogs suggested price, based on past sales in each condition.",
      masBarata: "Cheapest copy for sale", sinCopias: "No copies",
      sinPrecios: "Discogs didn't return prices by condition for this release. Check the sales history to see what people have paid.",
      aLaVenta: n => `<b>${num(n)}</b> for sale now`, desde: v => ` · from ${v}`,
      historial: "Sales history ↗", comprar: "Buy ↗",
      edicion: "Edition",
      primeraT: "First press", reedicionT: "Reissue", sinConfirmarT: "Not confirmed",
      primeraTxt: (a, n, f) => `It's from the year the album came out (${a}).` + (n > 1 ? ` That year ${n} ${f} editions came out in different countries: confirm yours with the matrix.` : ""),
      reedicionTxt: (a, b) => a ? `The album first came out in ${a}. This edition is from ${b || "a later year"}.` : "This edition came out after the original.",
      sinConfirmarTxt: "Discogs doesn't have enough data to tell if this is the first press.",
      totalEd: (n, partes) => `This album has ${num(n)} editions: ${partes}.`,
      comunidad: "Discogs community", loBuscan: "want it",
      calificacion: (r, v) => `Rated ${r} / 5 · ${num(v)} votes`,
      pasoFinal: "Last step", verifica: "Check your copy",
      verificaTxt: "Compare these with your copy. If they match, you have this edition.",
      verificaUno: "Compare this with your copy. If it matches, you have this edition.",
      checkDone: "✓ It matches. This is your edition.",
      masCodigos: n => `Show ${n} more ${n === 1 ? "code" : "codes"}`,
      masCodigosTxt: "Extra details for collectors. You don't need to check them all.",
      catnoT: "Catalog number",
      tiposCodigo: { "Barcode": "Barcode", "Matrix / Runout": "Matrix / Runout", "Label Code": "Label code", "Rights Society": "Rights society", "Mould SID Code": "Mould SID code", "Mastering SID Code": "Mastering SID code", "Pressing Plant ID": "Pressing plant", "Price Code": "Price code", "ASIN": "ASIN", "ISRC": "ISRC", "Other": "Other" },
      donde: {
        catno: { def: "On the spine, the back cover and the record label.", CD: "On the spine and back of the case, and on the disc.", Cassette: "On the case spine and on the cassette." },
        "Matrix / Runout": { def: "Etched in the smooth run-out area between the last track and the label. Compare it character by character.", CD: "Etched on the clear ring at the center of the CD. Compare it character by character.", Cassette: "Etched or printed on the cassette shell." },
        "Barcode": { def: "On the back cover or a sticker on the shrink wrap." }
      },
      otrasEd: "Other editions", otrasN: n => `${n} editions`,
      otrasTxt: "Doesn't match? You may have a different edition. Tap one to see its report.",
      cols: ["Year", "Format", "Country", "Label", "Catalog #", "Have it"], esta: "This one",
      credito: url => `Data from <a href="${url}" target="_blank" rel="noopener">Discogs</a>. Rarity is a Vinilo Tracks estimate based on community data; treat it as a guide, not an appraisal.`,
      portadaDe: t => `Cover of ${t}`,
      tipos: { "Vinyl": "Vinyl", "CD": "CD", "Cassette": "Cassette", "Box Set": "Box set", "File": "Digital", "DVD": "DVD", "Shellac": "Shellac (78 RPM)", "Lathe Cut": "Lathe cut", "Flexi-disc": "Flexi-disc", "8-Track Cartridge": "8-track", "Reel-To-Reel": "Reel-to-reel", "Minidisc": "MiniDisc", "CDr": "CD-R", "Other": "Other" },
      banderas: {},
      docTitulo: "Identify your record · Vinilo Tracks"
    }
  };

  /* ---------- idioma activo ---------- */
  const LKEY = "vt-lang-identificador";
  const idiomaInicial = () => {
    try { const g = localStorage.getItem(LKEY); if (g === "es" || g === "en") return g; } catch {}
    return /^es\b/i.test(navigator.language || "es") ? "es" : "en";
  };
  let lang = idiomaInicial();
  const L = () => T[lang];
  const locale = () => (lang === "es" ? "es-MX" : "en-US");
  function num(n) { return n == null ? "—" : Number(n).toLocaleString(locale()); }
  const dinero = (v, m = "USD") => v == null ? "—" : Number(v).toLocaleString(locale(), { style: "currency", currency: m, currencyDisplay: "narrowSymbol", maximumFractionDigits: v < 100 ? 2 : 0 });
  const tipoTxt = t => L().tipos[t] || t || "";
  const banderaTxt = b => L().banderas[b] || b;
  const ESPECIALES = ["Test Pressing", "Promo", "White Label", "Numbered", "Limited Edition", "Picture Disc", "Unofficial Release"];

  /* textos fijos del HTML (data-i18n="clave") */
  function traducirPagina() {
    document.documentElement.lang = lang;
    document.title = L().docTitulo;
    document.querySelectorAll("[data-i18n]").forEach(el => {
      const v = L()[el.dataset.i18n];
      if (typeof v === "string") el.textContent = v;
    });
    $("id-formatos").innerHTML = `<span>${esc(L().formatosTitulo)}</span>` + L().formatos.map(f => `<i>${esc(f)}</i>`).join("");
    document.querySelectorAll("[data-lang]").forEach(b => b.setAttribute("aria-pressed", b.dataset.lang === lang));
    ponerPlaceholder();
  }

  document.querySelectorAll("[data-lang]").forEach(b => b.addEventListener("click", () => {
    if (b.dataset.lang === lang) return;
    lang = b.dataset.lang;
    try { localStorage.setItem(LKEY, lang); } catch {}
    traducirPagina();
    // vuelve a pintar lo que esté en pantalla, ya en el otro idioma
    if (ultimoReporte) pintarReporte(ultimoReporte, false);
    else if (ultimaBusqueda) pintarBusqueda(ultimaBusqueda);
    else if (!new URLSearchParams(location.search).toString()) vistaInicial();
  }));

  /* ---------- tipo de código ---------- */
  const PH = { auto: "phAuto", barcode: "phBarcode", catno: "phCatno", matriz: "phMatriz" };
  function ponerPlaceholder() { input.placeholder = L()[PH[tipo]]; }
  document.querySelectorAll("[data-tipo]").forEach(b => b.addEventListener("click", () => {
    tipo = b.dataset.tipo;
    document.querySelectorAll("[data-tipo]").forEach(x => x.setAttribute("aria-checked", x === b));
    ponerPlaceholder();
    input.inputMode = tipo === "barcode" ? "numeric" : "text";
    input.focus();
  }));

  /* ---------- historial reciente (en este navegador) ---------- */
  const RKEY = "vt-identificados";
  const recientes = () => { try { return JSON.parse(localStorage.getItem(RKEY)) || []; } catch { return []; } };
  function recordar(r) {
    const item = { id: r.id, artista: r.artista, titulo: r.titulo, portada: r.portada, anio: r.anio, pais: r.pais, tipo: r.tipoFormato, nivel: r.rareza.nivel };
    const lista = [item, ...recientes().filter(x => x.id !== r.id)].slice(0, 8);
    try { localStorage.setItem(RKEY, JSON.stringify(lista)); } catch {}
  }

  function vistaInicial() {
    conResultado(false);
    ultimoReporte = ultimaBusqueda = null;
    const lista = recientes();
    out.innerHTML = lista.length ? `
      <section class="id-section">
        <div class="id-sec-head"><h2>${esc(L().recientes)}</h2><button class="link-btn" type="button" id="borrar-rec">${esc(L().borrarHistorial)}</button></div>
        <div class="rec-grid">${lista.map(x => {
          const a = arteVacio(x.artista);
          const nivel = x.nivel ?? 0;
          return `<a class="rec" href="?id=${x.id}" data-ir="${x.id}">
            <span class="art" style="${a.estilo}"><b>${esc(a.ini)}</b>${x.portada ? `<img src="${esc(x.portada)}" alt="" loading="lazy">` : ""}</span>
            <span class="rec-txt"><strong translate="no">${esc(x.titulo)}</strong><span translate="no">${esc(x.artista)} · ${x.anio || "—"}${x.tipo ? " · " + esc(tipoTxt(x.tipo)) : ""}</span><em class="lvl lvl-${nivel}">${esc(L().niveles[nivel])}</em></span>
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
      input.blur();
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
    if (codigo.length < 2) { input.focus(); return toast(L().escribeCodigo); }
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
  function error(e) {
    const txt = L().errores[e.message] || L().errores.def;
    out.innerHTML = `<div class="id-empty"><h2>${esc(L().algoFallo)}</h2><p>${esc(txt)}</p></div>`;
  }

  /* =======================================================
     PASO 1: buscar por código
     ======================================================= */
  async function buscar(codigo, t) {
    ultimoReporte = null;
    cargando(L().cargandoBuscar);
    try {
      const d = await json(`/api/identificar/buscar?${new URLSearchParams({ codigo, tipo: t })}`);
      if (d.total === 1) return ir({ id: d.resultados[0].id }, true);
      ultimaBusqueda = d;
      pintarBusqueda(d);
    } catch (e) {
      error(e);
    }
  }

  function pintarBusqueda(d) {
    if (!d.total) {
      out.innerHTML = `<div class="id-empty"><h2>${esc(L().noEncontrado)}</h2><p>${esc(L().noEncontradoTxt)}</p></div>`;
      return;
    }
    out.innerHTML = `
      <section class="id-section">
        <div class="id-sec-head">
          <div><span class="eyebrow">${esc(L().ediciones(d.total))}</span><h2>${esc(L().cualTuya)}</h2></div>
          <p class="muted">${esc(L().comparaTxt)}</p>
        </div>
        <div class="ed-list">${d.resultados.map(r => {
          const a = arteVacio(r.artista);
          return `<a class="ed" href="?id=${r.id}" data-ir="${r.id}">
            <span class="art" style="${a.estilo}"><b>${esc(a.ini)}</b>${r.portada ? `<img src="${esc(r.portada)}" alt="" loading="lazy">` : ""}</span>
            <span class="ed-main">
              <strong translate="no">${esc(r.artista)} — ${esc(r.titulo)}</strong>
              <span class="ed-meta">${r.tipoFormato ? `<span class="fmt">${esc(tipoTxt(r.tipoFormato))}</span> ` : ""}<b>${r.anio || esc(L().sinFecha)}</b> · ${esc(r.pais || L().paisDesc)} · <span translate="no">${esc(r.sello)}</span> ${r.catno ? `· <code>${esc(r.catno)}</code>` : ""}</span>
              <span class="ed-tags">${r.formato.slice(0, 4).map(f => `<i class="${ESPECIALES.includes(f) ? "hot" : ""}">${esc(banderaTxt(f))}</i>`).join("")}</span>
            </span>
            <span class="ed-have mono">${r.tienen != null ? `${num(r.tienen)}<br><small>${esc(L().loTienen)}</small>` : ""}</span>
          </a>`;
        }).join("")}</div>
      </section>`;
  }

  /* =======================================================
     PASO 2: reporte de una edición
     ======================================================= */
  async function reporte(id) {
    ultimaBusqueda = null;
    cargando(L().cargandoReporte);
    try {
      const r = await json(`/api/identificar/reporte/${encodeURIComponent(id)}`);
      recordar(r);
      ultimoReporte = r;
      pintarReporte(r, true);
    } catch (e) {
      error(e);
    }
  }

  /* "Verifica tu copia": máximo 3 pruebas clave; lo demás va en un desplegable.
     Clave = matriz (la primera, normalmente el lado A) + catálogo + código de barras. */
  function separarCodigos(codigos) {
    const usados = new Set();
    const tomar = pred => {
      const i = codigos.findIndex((c, k) => !usados.has(k) && pred(c));
      if (i < 0) return null;
      usados.add(i);
      return codigos[i];
    };
    const matriz = tomar(c => c.tipo === "Matrix / Runout" && /\b(a|1|side a|lado a)\b/i.test(c.nota || "")) || tomar(c => c.tipo === "Matrix / Runout");
    const claves = [matriz, tomar(c => c.tipo === "catno"), tomar(c => c.tipo === "Barcode")].filter(Boolean);
    const resto = codigos.filter((_, k) => !usados.has(k));
    return { claves, resto };
  }
  function donde(c, formato) {
    const tabla = L().donde[c.tipo];
    if (!tabla) return "";
    return tabla[formato] || tabla.def;
  }
  const nombreCodigo = c => (c.tipo === "catno" ? L().catnoT : L().tiposCodigo[c.tipo] || c.tipo);

  function pintarReporte(r, desplazar) {
    const X = L();
    const a = arteVacio(r.artista);
    const guardar = { id: r.id, titulo: r.titulo, artista: r.artista, anio: r.anio, pais: r.pais, portada: r.portada };
    const ed = r.edicion;
    const m = r.mercado;
    const sello = r.sellos[0];
    const nivel = r.rareza.nivel;
    const etiqueta = X.niveles[nivel];
    document.title = `${r.artista} — ${r.titulo} · Vinilo Tracks`;

    /* --- primera edición o reedición --- */
    let edTitulo, edTexto;
    if (ed.esPrimera) {
      edTitulo = X.primeraT;
      edTexto = X.primeraTxt(ed.anioOriginal, ed.mismoAnio, tipoTxt(r.tipoFormato).toLowerCase());
    } else if (ed.esReedicion || (ed.anioOriginal && r.anio && r.anio > ed.anioOriginal)) {
      edTitulo = X.reedicionT;
      edTexto = X.reedicionTxt(ed.anioOriginal, r.anio);
    } else {
      edTitulo = X.sinConfirmarT;
      edTexto = X.sinConfirmarTxt;
    }
    const partes = Object.entries(ed.porFormato || {}).sort((x, y) => y[1] - x[1]).map(([t, n]) => `${num(n)} ${tipoTxt(t).toLowerCase()}`).join(", ");

    /* --- precios por condición --- */
    const maxPrecio = Math.max(...m.precios.map(p => p.valor), 1);
    const precios = m.precios.length
      ? `<ul class="cond">${m.precios.map(p => {
          const [nombre, desc] = X.condiciones[p.codigo] || [p.codigo, ""];
          return `<li>
            <span class="cond-code">${esc(p.codigo)}</span>
            <span class="cond-info"><strong>${esc(nombre)}</strong><small>${esc(desc)}</small></span>
            <span class="cond-bar"><span style="width:${Math.max(6, (p.valor / maxPrecio) * 100)}%"></span></span>
            <span class="cond-val">${dinero(p.valor, p.moneda)}</span>
          </li>`;
        }).join("")}</ul>
        <p class="mono muted small">${esc(X.precioSugerido)}</p>`
      : `<div class="price-solo">
          <span class="mono muted">${esc(X.masBarata)}</span>
          <b>${m.desde != null ? dinero(m.desde, m.moneda) : esc(X.sinCopias)}</b>
        </div>
        <p class="mono muted small">${esc(X.sinPrecios)}</p>`;

    /* --- verifica tu copia --- */
    const { claves, resto } = separarCodigos(r.codigos || []);
    const filaCodigo = (c, i, conCasilla) => `
      <li>
        ${conCasilla ? `<label class="check-row"><input type="checkbox" id="chk-${i}"><span class="check-box" aria-hidden="true"></span>` : `<div class="check-row check-row-plain">`}
          <span class="check-txt">
            <span class="check-type">${esc(nombreCodigo(c))}${c.nota ? ` <em translate="no">${esc(c.nota)}</em>` : ""}</span>
            <code class="check-val" translate="no">${esc(c.valor)}</code>
            ${donde(c, r.tipoFormato) ? `<span class="check-where">${esc(donde(c, r.tipoFormato))}</span>` : ""}
          </span>
        ${conCasilla ? `</label>` : `</div>`}
      </li>`;

    out.innerHTML = `
    <article class="rep">
      <header class="rep-head">
        <div class="rep-cover">
          <div class="rep-art" style="${a.estilo}">${r.portada ? `<img src="${esc(r.portada)}" alt="${esc(X.portadaDe(r.titulo))}">` : `<span class="art" style="${a.estilo}"><b>${esc(a.ini)}</b></span>`}</div>
          <div class="spin-disc" aria-hidden="true"></div>
        </div>
        <div class="rep-info">
          <a class="crumb mono" href="/identificar" data-volver>${esc(X.identificarOtro)}</a>
          <span class="rep-artist" translate="no">${esc(r.artista)}</span>
          <h2 class="rep-title" translate="no">${esc(r.titulo)}</h2>
          <p class="rep-line">${r.tipoFormato ? `<span class="fmt">${esc(tipoTxt(r.tipoFormato))}</span> ` : ""}${[r.anio, r.pais].filter(Boolean).map(esc).join(" · ")}${sello?.nombre ? ` · <span translate="no">${esc(sello.nombre)}</span>` : ""}${sello?.catalogo ? ` · <code>${esc(sello.catalogo)}</code>` : ""}</p>
          <p class="rep-format mono">${esc(r.formato)}</p>
          ${r.banderas.length ? `<div class="ed-tags">${r.banderas.map(b => `<i class="${ESPECIALES.includes(b) ? "hot" : ""}">${esc(banderaTxt(b))}</i>`).join("")}</div>` : ""}
          ${r.noOficial ? `<p class="rep-alert">${X.noOficial}</p>` : ""}
          <div class="rep-actions">
            <button class="btn-primary" type="button" data-save='${esc(JSON.stringify(guardar))}' data-off="${esc(X.guardar)}" data-on="${esc(X.enWishlist)}" aria-pressed="false">${icoSave}<span class="save-label">${esc(X.guardar)}</span></button>
            <a class="pill" href="/vinilo/${r.id}">${esc(X.fichaCompleta)}</a>
          </div>
        </div>
      </header>

      <div class="bento">
        <section class="tile tile-rare lvl-${nivel}">
          <span class="eyebrow">${esc(X.rareza)}</span>
          <div class="rare-big">${esc(etiqueta)}</div>
          <div class="meter" role="img" aria-label="${esc(X.nivelDe(etiqueta, nivel + 1))}">
            ${[0, 1, 2, 3].map(i => `<span class="${i <= nivel ? "on" : ""}"></span>`).join("")}
          </div>
          <div class="meter-labels mono"><span>${esc(X.niveles[0])}</span><span>${esc(X.niveles[3])}</span></div>
          <ul class="why">${r.rareza.razones.map(x => {
            const f = X.razones[x.k];
            return f ? `<li class="${x.peso === "+" ? "up" : "down"}"><span aria-hidden="true">${x.peso === "+" ? "▲" : "▼"}</span>${esc(f(x))}</li>` : "";
          }).join("")}</ul>
          <p class="rare-note mono">${esc(X.rareNote)}</p>
        </section>

        <section class="tile tile-price">
          <span class="eyebrow">${esc(X.cuantoVale)}</span>
          ${precios}
          <div class="price-foot">
            <span class="mono">${X.aLaVenta(m.enVenta)}${m.desde != null && m.precios.length ? esc(X.desde(dinero(m.desde, m.moneda))) : ""}</span>
            <span class="price-links">
              <a href="${esc(m.historialUrl)}" target="_blank" rel="noopener">${esc(X.historial)}</a>
              <a href="${esc(m.ventaUrl)}" target="_blank" rel="noopener">${esc(X.comprar)}</a>
            </span>
          </div>
        </section>

        <section class="tile tile-ed">
          <span class="eyebrow">${esc(X.edicion)}</span>
          <div class="ed-big ${ed.esPrimera ? "first" : ""}">${esc(edTitulo)}</div>
          <p>${esc(edTexto)}</p>
          ${ed.total > 1 && partes ? `<p class="mono muted">${esc(X.totalEd(ed.total, partes))}</p>` : ""}
        </section>

        <section class="tile tile-comm">
          <span class="eyebrow">${esc(X.comunidad)}</span>
          <div class="comm">
            <div><b>${num(r.comunidad.tienen)}</b><span>${esc(X.loTienen)}</span></div>
            <div><b>${num(r.comunidad.quieren)}</b><span>${esc(X.loBuscan)}</span></div>
          </div>
          ${r.comunidad.rating ? `<p class="mono muted">${esc(X.calificacion(r.comunidad.rating.toFixed(2), r.comunidad.votos))}</p>` : ""}
        </section>
      </div>

      ${claves.length ? `
      <section class="id-section">
        <div class="id-sec-head">
          <div><span class="eyebrow">${esc(X.pasoFinal)}</span><h2>${esc(X.verifica)}</h2></div>
          <p class="muted">${esc(claves.length === 1 ? X.verificaUno : X.verificaTxt)}</p>
        </div>
        <ol class="check check-${claves.length}" id="check">${claves.map((c, i) => filaCodigo(c, i, true)).join("")}</ol>
        <p class="check-done" id="check-done" hidden>${esc(X.checkDone)}</p>
        ${resto.length ? `
        <details class="more-codes">
          <summary>${esc(X.masCodigos(resto.length))}</summary>
          <p class="muted small-note">${esc(X.masCodigosTxt)}</p>
          <ul class="codes-list">${resto.map(c => `
            <li><span class="check-type">${esc(nombreCodigo(c))}${c.nota ? ` <em translate="no">${esc(c.nota)}</em>` : ""}</span><code translate="no">${esc(c.valor)}</code></li>`).join("")}</ul>
        </details>` : ""}
      </section>` : ""}

      ${r.otras.length > 1 ? `
      <section class="id-section">
        <div class="id-sec-head">
          <div><span class="eyebrow">${esc(X.otrasN(r.otras.length))}</span><h2>${esc(X.otrasEd)}</h2></div>
          <p class="muted">${esc(X.otrasTxt)}</p>
        </div>
        <div class="tbl-wrap">
          <table class="tbl">
            <thead><tr>${X.cols.map((c, i) => `<th${i === 5 ? ' class="r"' : ""}>${esc(c)}</th>`).join("")}</tr></thead>
            <tbody>${r.otras.map(o => `
              <tr class="${o.actual ? "cur" : ""}" ${o.actual ? "" : `data-ir="${o.id}" tabindex="0"`}>
                <td>${o.anio || "—"}</td><td><span class="fmt">${esc(tipoTxt(o.tipo))}</span></td><td>${esc(o.pais)}</td><td translate="no">${esc(o.sello)}</td><td><code>${esc(o.catno)}</code></td>
                <td class="r">${o.actual ? `<b>${esc(X.esta)}</b>` : num(o.tienen)}</td>
              </tr>`).join("")}</tbody>
          </table>
        </div>
      </section>` : ""}

      <p class="mono muted credit">${X.credito(esc(r.discogsUrl))}</p>
    </article>`;

    pintarBotones();
    if (desplazar) out.scrollIntoView({ behavior: "smooth", block: "start" });

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
     1) BarcodeDetector nativo (Chrome / Android): muy rápido
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
    input.blur();
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
      s.onerror = () => mal(new Error("libreria"));
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
    if (!navigator.mediaDevices?.getUserMedia) return toast(L().scanSinCamara);
    scan.hidden = scanBg.hidden = false;
    requestAnimationFrame(() => document.body.classList.add("scan-open"));
    scanMsg.textContent = L().scanMsg;
    try {
      if ("BarcodeDetector" in window) await escanearNativo();
      else await escanearLibreria();
    } catch (e) {
      const negado = /NotAllowed|Permission/i.test(e.name + e.message);
      scanMsg.textContent = negado ? L().scanNegado : L().scanFallo;
    }
  });
  $("scan-close").addEventListener("click", cerrarScan);
  scanBg.addEventListener("click", cerrarScan);
  document.addEventListener("keydown", e => { if (e.key === "Escape" && !scan.hidden) cerrarScan(); });

  traducirPagina();
  leerURL();
})();
