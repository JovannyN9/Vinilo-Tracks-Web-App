/* =========================================================
   Vinilo Tracks — IDENTIFICADOR DE EDICIONES
   Para quien tiene un disco en la mano: vinilo, CD, casete o cualquier
   formato que exista en Discogs.

     GET /api/identificar/buscar?codigo=...&tipo=auto|barcode|catno|matriz
         → ediciones que coinciden con el código
     GET /api/identificar/reporte/:id
         → rareza, precios por condición, primera edición o reedición,
           códigos para verificar la copia y otras ediciones del mismo disco

   El servidor manda DATOS y CLAVES, no frases: la página arma los textos
   en español o en inglés (public/js/identificar.js).
   ========================================================= */
const express = require("express");

module.exports = function ({ discogs, discogsGet, obtenerFicha, desdeCache, cache, sinNumero, tokenListo }) {
  const router = express.Router();

  router.use((req, res, next) => {
    if (!tokenListo()) return res.status(500).json({ error: "token", mensaje: "Falta configurar el token de Discogs en el servidor." });
    next();
  });

  /* formato principal de un resultado: Vinyl, CD, Cassette, File… */
  const FORMATOS_BASE = ["Vinyl", "CD", "Cassette", "Box Set", "File", "DVD", "Blu-ray", "Shellac", "Lathe Cut", "Flexi-disc", "8-Track Cartridge", "Reel-To-Reel", "Minidisc", "SACD", "CDr"];
  const formatoBase = lista => (lista || []).find(f => FORMATOS_BASE.includes(f)) || (lista || [])[0] || "";

  /* ---------- 1) BUSCAR POR CÓDIGO ---------- */
  const resumen = r => {
    const [artista, ...resto] = (r.title || "").split(" - ");
    const formatos = r.format || [];
    return {
      id: r.id,
      master: r.master_id || null,
      artista: sinNumero(artista),
      titulo: resto.join(" - ") || r.title,
      anio: Number(r.year) || null,
      pais: r.country || null,
      sello: sinNumero((r.label || [])[0] || ""),
      catno: r.catno || "",
      tipoFormato: formatoBase(formatos),
      formato: formatos.filter(f => f !== formatoBase(formatos)),
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
    if (codigo.length < 2) return res.status(400).json({ error: "corto", mensaje: "Escribe un código de al menos 2 caracteres." });

    const soloDigitos = codigo.replace(/[\s.-]/g, "");
    if (tipo === "auto") tipo = /^\d{8,14}$/.test(soloDigitos) ? "barcode" : "mixto";

    const clave = `ident2:${tipo}:${codigo.toLowerCase()}`;
    const hit = desdeCache(clave);
    if (hit) return res.json(hit);

    try {
      let crudos = [];
      if (tipo === "barcode") {
        crudos = await buscarPor({ barcode: soloDigitos });
      } else if (tipo === "catno") {
        crudos = await buscarPor({ catno: codigo });
      } else {
        // matriz o "no sé": probamos como número de catálogo y como texto libre
        const [porCat, porTexto] = await Promise.all([
          tipo === "matriz" ? Promise.resolve([]) : buscarPor({ catno: codigo }),
          buscarPor({ q: codigo })
        ]);
        const vistos = new Set();
        crudos = [...porCat, ...porTexto].filter(r => !vistos.has(r.id) && vistos.add(r.id));
      }

      const resultados = crudos.map(resumen).sort((a, b) => (a.anio || 9999) - (b.anio || 9999));
      const out = { tipo, codigo, total: resultados.length, resultados: resultados.slice(0, 40) };
      cache.set(clave, { t: Date.now(), v: out });
      res.json(out);
    } catch (err) {
      console.error(err.message);
      res.status(502).json({ error: "discogs", mensaje: err.message || "No pudimos hablar con Discogs." });
    }
  });

  /* ---------- 2) REPORTE DE UNA EDICIÓN ---------- */
  const CONDICIONES = [
    ["Mint (M)", "M"], ["Near Mint (NM or M-)", "NM"], ["Very Good Plus (VG+)", "VG+"],
    ["Very Good (VG)", "VG"], ["Good Plus (G+)", "G+"], ["Good (G)", "G"]
  ];

  /* Cada razón va como clave + números; la página la convierte en frase */
  function calcularRareza({ ficha, enVenta, esPrimera, anioOriginal, banderas }) {
    let puntos = 0;
    const razones = [];
    const tienen = ficha.comunidad.tienen ?? 0;
    const quieren = ficha.comunidad.quieren ?? 0;
    const suma = (n, peso, k, datos = {}) => { puntos += n; razones.push({ peso, k, ...datos }); };

    if (tienen < 50) suma(3, "+", "muyPocos", { n: tienen });
    else if (tienen < 250) suma(2, "+", "pocos", { n: tienen });
    else if (tienen < 1000) suma(1, "+", "algunos", { n: tienen });
    else razones.push({ peso: "-", k: "muchos", n: Math.floor(tienen / 1000) * 1000 });

    const ratio = quieren / Math.max(tienen, 1);
    if (ratio > 2) suma(2, "+", "demandaAlta", { n: Number(ratio.toFixed(1)) });
    else if (ratio > 1) suma(1, "+", "demanda");

    if (enVenta === 0) suma(2, "+", "sinVenta");
    else if (enVenta <= 3) suma(1, "+", "pocaVenta", { n: enVenta });
    else if (enVenta >= 25) suma(-1, "-", "muchaVenta", { n: enVenta });

    if (banderas.includes("Test Pressing")) suma(3, "+", "test");
    if (banderas.some(b => b === "Promo" || b === "White Label")) suma(2, "+", "promo");
    if (banderas.includes("Numbered")) suma(2, "+", "numerada");
    if (banderas.includes("Limited Edition")) suma(1, "+", "limitada");
    if (esPrimera && anioOriginal && anioOriginal < 2005) suma(1, "+", "primera", { n: anioOriginal });
    if (banderas.some(b => b === "Reissue" || b === "Repress")) razones.push({ peso: "-", k: "reedicion" });

    puntos = Math.max(0, puntos);
    const nivel = puntos >= 6 ? 3 : puntos >= 4 ? 2 : puntos >= 2 ? 1 : 0;
    return { nivel, puntos, razones };
  }

  router.get("/reporte/:id", async (req, res) => {
    const id = String(req.params.id).replace(/\D/g, "");
    if (!id) return res.status(400).json({ error: "id", mensaje: "ID de disco inválido." });

    const clave = "reporte2:" + id;
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

      /* todas las ediciones del mismo disco, en cualquier formato */
      const todas = versiones?.versions || [];
      const tipoDe = v => formatoBase(v.major_formats || []) || (v.format || "").split(",")[0].trim();
      const anioDe = v => Number(String(v.released || "").slice(0, 4)) || null;
      const anios = todas.map(anioDe).filter(Boolean);
      const anioOriginal = master?.year || (anios.length ? Math.min(...anios) : null);

      const porFormato = {};
      todas.forEach(v => { const t = tipoDe(v) || "Other"; porFormato[t] = (porFormato[t] || 0) + 1; });

      /* tipo de edición */
      const detalles = ficha.formatos.flatMap(f => f.detalles);
      const textos = ficha.formatos.map(f => f.texto).filter(Boolean);
      const BANDERAS = ["Test Pressing", "Promo", "White Label", "Numbered", "Limited Edition", "Reissue", "Repress", "Remastered", "Unofficial Release", "Club Edition", "Special Edition", "Deluxe Edition", "Stereo", "Mono", "Gatefold", "180 Gram", "Picture Disc"];
      const banderas = BANDERAS.filter(b => detalles.includes(b) || textos.some(t => t.includes(b)));
      const esReedicion = banderas.some(b => b === "Reissue" || b === "Repress");
      const esPrimera = !esReedicion && !!ficha.anio && !!anioOriginal && ficha.anio <= anioOriginal;
      const tipoFormato = formatoBase(ficha.formatos.map(f => f.nombre));
      const mismoAnio = anioOriginal ? todas.filter(v => anioDe(v) === anioOriginal && tipoDe(v) === tipoFormato).length : 0;

      const enVenta = stats?.num_for_sale ?? ficha.venta.enVenta ?? 0;
      const rareza = calcularRareza({ ficha, enVenta, esPrimera, anioOriginal, banderas });

      const precios = sugerencias && Object.keys(sugerencias).length
        ? CONDICIONES.filter(([llave]) => sugerencias[llave]).map(([llave, codigo]) => ({
            codigo,
            valor: Math.round(sugerencias[llave].value * 100) / 100,
            moneda: sugerencias[llave].currency
          }))
        : [];

      const reporte = {
        id: ficha.id,
        artista: ficha.artistas.join(", "),
        titulo: ficha.titulo,
        portada: ficha.imagenes[0]?.url || null,
        anio: ficha.anio,
        pais: ficha.pais,
        sellos: ficha.sellos,
        tipoFormato,
        formato: ficha.formatos.map(f => [f.cantidad > 1 ? `${f.cantidad} × ${f.nombre}` : f.nombre, ...f.detalles, f.texto].filter(Boolean).join(", ")).join(" + "),
        banderas,
        noOficial: banderas.includes("Unofficial Release"),
        edicion: { anioOriginal, esPrimera, esReedicion, total: todas.length, porFormato, mismoAnio },
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
        // códigos para comparar con la copia física (la página decide cuáles son "clave")
        codigos: [
          ...ficha.sellos.filter(s => s.catalogo && s.catalogo !== "none").map(s => ({ tipo: "catno", valor: s.catalogo, nota: s.nombre })),
          ...ficha.identificadores.map(i => ({ tipo: i.tipo, valor: i.valor, nota: i.nota }))
        ],
        otras: todas.slice(0, 40).map(v => ({
          id: v.id,
          anio: anioDe(v),
          pais: v.country || "",
          sello: sinNumero(v.label || ""),
          catno: v.catno || "",
          tipo: tipoDe(v),
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
      res.status(err.status === 404 ? 404 : 502).json({ error: err.status === 404 ? "noExiste" : "discogs", mensaje: err.message || "No pudimos hablar con Discogs." });
    }
  });

  return router;
};
