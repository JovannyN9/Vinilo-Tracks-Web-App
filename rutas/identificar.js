/* =========================================================
   Vinilo Tracks — IDENTIFICADOR DE EDICIONES
   Para el coleccionista que tiene un vinilo en la mano:
     GET /api/identificar/buscar?codigo=...&tipo=auto|barcode|catno|matriz
         → lista de ediciones que coinciden con el código
     GET /api/identificar/reporte/:id
         → rareza, precios por condición, primera edición o reedición,
           cómo verificar la copia física y otras ediciones del mismo disco
   El identificador funciona con cualquier vinilo (no solo rock en español),
   porque en una tienda o un tianguis vas a encontrar de todo.
   ========================================================= */
const express = require("express");

module.exports = function ({ discogs, discogsGet, obtenerFicha, desdeCache, cache, sinNumero, tokenListo }) {
  const router = express.Router();

  router.use((req, res, next) => {
    if (!tokenListo()) return res.status(500).json({ error: "Falta configurar el token de Discogs en el servidor." });
    next();
  });

  /* ---------- 1) BUSCAR POR CÓDIGO ---------- */
  const resumen = r => {
    const [artista, ...resto] = (r.title || "").split(" - ");
    return {
      id: r.id,
      master: r.master_id || null,
      artista: sinNumero(artista),
      titulo: resto.join(" - ") || r.title,
      anio: Number(r.year) || null,
      pais: r.country || null,
      sello: sinNumero((r.label || [])[0] || ""),
      catno: r.catno || "",
      formato: (r.format || []).filter(f => f !== "Vinyl"),
      portada: r.cover_image && !r.cover_image.includes("spacer.gif") ? r.cover_image : (r.thumb || null),
      tienen: r.community?.have ?? null,
      quieren: r.community?.want ?? null
    };
  };

  async function buscarPor(params) {
    const data = await discogs({ type: "release", per_page: 50, ...params });
    return data.results || [];
  }

  router.get("/buscar", async (req, res) => {
    const codigo = String(req.query.codigo || "").trim().slice(0, 60);
    let tipo = String(req.query.tipo || "auto");
    if (codigo.length < 2) return res.status(400).json({ error: "Escribe un código de al menos 2 caracteres." });

    const soloDigitos = codigo.replace(/[\s.-]/g, "");
    if (tipo === "auto") tipo = /^\d{8,14}$/.test(soloDigitos) ? "barcode" : "mixto";

    const clave = `ident:${tipo}:${codigo.toLowerCase()}`;
    const hit = desdeCache(clave);
    if (hit) return res.json(hit);

    try {
      let crudos = [];
      let soloVinilo = true;

      if (tipo === "barcode") {
        crudos = await buscarPor({ barcode: soloDigitos, format: "Vinyl" });
        if (!crudos.length) { crudos = await buscarPor({ barcode: soloDigitos }); soloVinilo = false; }
      } else if (tipo === "catno") {
        crudos = await buscarPor({ catno: codigo, format: "Vinyl" });
      } else {
        // matriz o "no sé qué es": probamos como número de catálogo y como texto libre
        const [porCat, porTexto] = await Promise.all([
          tipo === "matriz" ? Promise.resolve([]) : buscarPor({ catno: codigo, format: "Vinyl" }),
          buscarPor({ q: codigo, format: "Vinyl" })
        ]);
        const vistos = new Set();
        crudos = [...porCat, ...porTexto].filter(r => !vistos.has(r.id) && vistos.add(r.id));
      }

      const resultados = crudos.map(resumen).sort((a, b) => (a.anio || 9999) - (b.anio || 9999));
      const out = { tipo, codigo, soloVinilo, total: resultados.length, resultados: resultados.slice(0, 40) };
      cache.set(clave, { t: Date.now(), v: out });
      res.json(out);
    } catch (err) {
      console.error(err.message);
      res.status(502).json({ error: err.message || "No pudimos hablar con Discogs." });
    }
  });

  /* ---------- 2) REPORTE DE UNA EDICIÓN ---------- */
  const CONDICIONES = [
    { llave: "Mint (M)", codigo: "M", nombre: "Mint", desc: "Nuevo o sellado. Nunca se ha tocado." },
    { llave: "Near Mint (NM or M-)", codigo: "NM", nombre: "Near Mint", desc: "Casi perfecto. Sin marcas visibles." },
    { llave: "Very Good Plus (VG+)", codigo: "VG+", nombre: "Very Good +", desc: "Marcas muy leves. Suena muy bien." },
    { llave: "Very Good (VG)", codigo: "VG", nombre: "Very Good", desc: "Marcas visibles y algo de ruido." },
    { llave: "Good Plus (G+)", codigo: "G+", nombre: "Good +", desc: "Muy usado. Ruido constante, pero se escucha." },
    { llave: "Good (G)", codigo: "G", nombre: "Good", desc: "Muy desgastado. Solo para completar colección." }
  ];

  const DONDE = {
    "Matrix / Runout": "Grabado a mano o a máquina en la parte lisa del vinilo, entre la última canción y la etiqueta. Compáralo letra por letra.",
    "Barcode": "En la contraportada o en un sticker del plástico.",
    "Label Code": "En la etiqueta del disco o en la contraportada.",
    "Rights Society": "En la etiqueta del disco (por ejemplo SACM, BIEM, SADAIC).",
    "Mould SID Code": "Grabado cerca del centro del vinilo.",
    "Mastering SID Code": "Grabado en la parte lisa cerca de la etiqueta.",
    "Pressing Plant ID": "Grabado en la parte lisa del vinilo.",
    "Other": "Revisa la etiqueta, la contraportada y la parte lisa del vinilo."
  };

  function calcularRareza({ ficha, enVenta, esPrimera, anioOriginal, banderas }) {
    let puntos = 0;
    const razones = [];
    const tienen = ficha.comunidad.tienen ?? 0;
    const quieren = ficha.comunidad.quieren ?? 0;
    const fmt = n => Number(n).toLocaleString("es-MX");

    if (tienen < 50) { puntos += 3; razones.push({ peso: "+", texto: `Solo ${fmt(tienen)} coleccionistas en Discogs dicen tenerlo.` }); }
    else if (tienen < 250) { puntos += 2; razones.push({ peso: "+", texto: `Pocos coleccionistas lo tienen (${fmt(tienen)}).` }); }
    else if (tienen < 1000) { puntos += 1; razones.push({ peso: "+", texto: `${fmt(tienen)} coleccionistas lo tienen.` }); }
    else razones.push({ peso: "-", texto: `Más de ${fmt(Math.floor(tienen / 1000) * 1000)} coleccionistas lo tienen. Circulan muchas copias.` });

    const ratio = quieren / Math.max(tienen, 1);
    if (ratio > 2) { puntos += 2; razones.push({ peso: "+", texto: `Lo buscan ${ratio.toFixed(1)} veces más personas de las que lo tienen.` }); }
    else if (ratio > 1) { puntos += 1; razones.push({ peso: "+", texto: "Más gente lo busca de la que lo tiene." }); }

    if (enVenta === 0) { puntos += 2; razones.push({ peso: "+", texto: "Ahora mismo no hay ninguna copia a la venta en Discogs." }); }
    else if (enVenta <= 3) { puntos += 1; razones.push({ peso: "+", texto: `Solo ${enVenta} ${enVenta === 1 ? "copia" : "copias"} a la venta en Discogs.` }); }
    else if (enVenta >= 25) { puntos -= 1; razones.push({ peso: "-", texto: `Hay ${enVenta} copias a la venta: no es difícil de conseguir.` }); }

    if (banderas.includes("Test Pressing")) { puntos += 3; razones.push({ peso: "+", texto: "Es una prueba de prensado (test pressing). Se hacen muy pocas." }); }
    if (banderas.some(b => b === "Promo" || b === "White Label")) { puntos += 2; razones.push({ peso: "+", texto: "Es una copia promocional, no se vendía en tiendas." }); }
    if (banderas.includes("Numbered")) { puntos += 2; razones.push({ peso: "+", texto: "Es una edición numerada." }); }
    if (banderas.includes("Limited Edition")) { puntos += 1; razones.push({ peso: "+", texto: "Es edición limitada." }); }
    if (esPrimera && anioOriginal && anioOriginal < 2005) { puntos += 1; razones.push({ peso: "+", texto: `Es de la primera tanda, de ${anioOriginal}.` }); }
    if (banderas.some(b => b === "Reissue" || b === "Repress")) razones.push({ peso: "-", texto: "Es una reedición, no la edición original." });

    puntos = Math.max(0, puntos);
    const niveles = ["Común", "Poco común", "Raro", "Muy raro"];
    const nivel = puntos >= 6 ? 3 : puntos >= 4 ? 2 : puntos >= 2 ? 1 : 0;
    return { nivel, etiqueta: niveles[nivel], puntos, razones };
  }

  router.get("/reporte/:id", async (req, res) => {
    const id = String(req.params.id).replace(/\D/g, "");
    if (!id) return res.status(400).json({ error: "ID de disco inválido." });

    const clave = "reporte:" + id;
    const hit = desdeCache(clave);
    if (hit) return res.json(hit);

    try {
      const ficha = await obtenerFicha(id);
      const [stats, sugerencias, master, versiones] = await Promise.all([
        discogsGet(`/marketplace/stats/${id}?curr_abbr=USD`, { opcional: true }),
        discogsGet(`/marketplace/price_suggestions/${id}`, { opcional: true }),
        ficha.master ? discogsGet(`/masters/${ficha.master}`, { opcional: true }) : null,
        ficha.master ? discogsGet(`/masters/${ficha.master}/versions?per_page=100&sort=released&sort_order=asc`, { opcional: true }) : null
      ]);

      /* ediciones del mismo disco */
      const todas = (versiones?.versions || []);
      const deVinilo = todas.filter(v => (v.major_formats || []).includes("Vinyl") || /vinyl|LP|12"|7"/i.test(v.format || ""));
      const anioDe = v => Number(String(v.released || "").slice(0, 4)) || null;
      const anios = deVinilo.map(anioDe).filter(Boolean);
      const anioOriginal = master?.year || (anios.length ? Math.min(...anios) : null);

      /* qué tipo de edición es */
      const detalles = ficha.formatos.flatMap(f => f.detalles);
      const textos = ficha.formatos.map(f => f.texto).filter(Boolean);
      const BANDERAS = ["Test Pressing", "Promo", "White Label", "Numbered", "Limited Edition", "Reissue", "Repress", "Remastered", "Unofficial Release", "Club Edition", "Special Edition", "Deluxe Edition", "Stereo", "Mono", "Gatefold", "180 Gram", "Picture Disc"];
      const banderas = BANDERAS.filter(b => detalles.includes(b) || textos.some(t => t.includes(b)));
      const esReedicion = banderas.some(b => b === "Reissue" || b === "Repress");
      const esPrimera = !esReedicion && !!ficha.anio && !!anioOriginal && ficha.anio <= anioOriginal;
      const mismoAnio = anioOriginal ? deVinilo.filter(v => anioDe(v) === anioOriginal).length : 0;

      const enVenta = stats?.num_for_sale ?? ficha.venta.enVenta ?? 0;
      const rareza = calcularRareza({ ficha, enVenta, esPrimera, anioOriginal, banderas });

      /* precios */
      const precios = sugerencias && Object.keys(sugerencias).length
        ? CONDICIONES.filter(c => sugerencias[c.llave]).map(c => ({ ...c, llave: undefined, valor: Math.round(sugerencias[c.llave].value * 100) / 100, moneda: sugerencias[c.llave].currency }))
        : [];

      const reporte = {
        id: ficha.id,
        artista: ficha.artistas.join(", "),
        titulo: ficha.titulo,
        portada: ficha.imagenes[0]?.url || null,
        anio: ficha.anio,
        lanzamiento: ficha.lanzamiento,
        pais: ficha.pais,
        sellos: ficha.sellos,
        formato: ficha.formatos.map(f => [f.cantidad > 1 ? `${f.cantidad} × ${f.nombre}` : f.nombre, ...f.detalles, f.texto].filter(Boolean).join(", ")).join(" + "),
        banderas,
        noOficial: banderas.includes("Unofficial Release"),
        edicion: {
          anioOriginal,
          esPrimera,
          esReedicion,
          totalVersiones: todas.length,
          totalVinilo: deVinilo.length,
          mismoAnio
        },
        rareza,
        comunidad: ficha.comunidad,
        mercado: {
          enVenta,
          desde: stats?.lowest_price?.value ?? ficha.venta.desde ?? null,
          moneda: stats?.lowest_price?.currency || "USD",
          precios,
          historialUrl: `https://www.discogs.com/sell/history/${ficha.id}`,
          ventaUrl: ficha.urlVenta
        },
        verificar: [
          ...ficha.sellos.filter(s => s.catalogo && s.catalogo !== "none").map(s => ({ tipo: "Número de catálogo", valor: s.catalogo, nota: s.nombre, donde: "En el lomo, la contraportada y la etiqueta del disco." })),
          ...ficha.identificadores.map(i => ({ tipo: i.tipo, valor: i.valor, nota: i.nota, donde: DONDE[i.tipo] || DONDE.Other }))
        ],
        otras: deVinilo.slice(0, 40).map(v => ({
          id: v.id,
          anio: anioDe(v),
          pais: v.country || "",
          sello: sinNumero(v.label || ""),
          catno: v.catno || "",
          formato: v.format || "",
          tienen: v.stats?.community?.in_collection ?? null,
          actual: String(v.id) === String(ficha.id)
        })),
        discogsUrl: ficha.url
      };

      cache.set(clave, { t: Date.now(), v: reporte });
      res.json(reporte);
    } catch (err) {
      console.error(err.message);
      res.status(err.status === 404 ? 404 : 502).json({ error: err.message || "No pudimos hablar con Discogs." });
    }
  });

  return router;
};
