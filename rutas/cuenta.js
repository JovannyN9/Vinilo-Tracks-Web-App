/* =========================================================
   Vinilo Tracks — CUENTAS Y WISHLIST EN LA NUBE (Supabase)
   El navegador nunca habla con Supabase directo: habla con este servidor,
   y este servidor guarda la sesión en cookies httpOnly (JavaScript no las
   puede leer, así que un script malicioso no puede robar la sesión).

     GET    /api/config          → ¿está activado el login?
     POST   /api/auth/registro   → crear cuenta (correo + contraseña)
     POST   /api/auth/entrar     → iniciar sesión
     POST   /api/auth/salir      → cerrar sesión
     GET    /api/auth/yo         → usuario actual (o null)
     GET    /api/auth/google     → entrar con Google (si lo activas en Supabase)
     POST   /api/auth/sesion     → guarda la sesión que regresa de Google
     POST   /api/auth/recuperar  → manda correo para cambiar contraseña

     GET    /api/wishlist        → wishlist del usuario
     POST   /api/wishlist        → guardar uno o varios discos
     DELETE /api/wishlist/:id    → quitar un disco
     DELETE /api/wishlist        → vaciar

   Variables en .env:  SUPABASE_URL  y  SUPABASE_ANON_KEY
   La tabla se crea con el archivo supabase.sql (instrucciones en el README).
   ========================================================= */
const express = require("express");

module.exports = function () {
  const router = express.Router();
  // Nos quedamos solo con "https://xxxx.supabase.co" aunque peguen la URL con /rest/v1/ u otra ruta al final
  const URL_SB = (() => {
    const crudo = (process.env.SUPABASE_URL || "").trim().replace(/^["']|["']$/g, "");
    try { return crudo ? new URL(crudo).origin : ""; } catch { console.error("❌ SUPABASE_URL no es una URL válida:", crudo); return ""; }
  })()
  const KEY = process.env.SUPABASE_ANON_KEY || "";
  const activo = !!(URL_SB && KEY);
  if (activo) console.log(`🔐 Login activo con Supabase: ${URL_SB}`);

  /* ¿Google está activado en Supabase? Lo revisamos al arrancar para esconder el botón si no */
  let google = false;
  if (activo) {
    fetch(`${URL_SB}/auth/v1/settings`, { headers: { apikey: KEY } })
      .then(r => r.json().then(d => ({ ok: r.ok, status: r.status, d })))
      .then(({ ok, status, d }) => {
        if (!ok) return console.error(`❌ Supabase rechazó la conexión (${status}):`, d?.message || d?.msg || d, "→ revisa SUPABASE_URL y SUPABASE_ANON_KEY en .env");
        google = !!d?.external?.google;
        console.log(`   Correo: ${d?.external?.email ? "sí" : "no"} · Google: ${google ? "sí" : "no (actívalo en Supabase si lo quieres)"} · Confirmar correo: ${d?.mailer_autoconfirm ? "no" : "sí"}`);
      })
      .catch(e => console.error("❌ No pudimos conectar con Supabase:", e.message));
  }
  if (!activo) console.warn("ℹ️  Login desactivado: faltan SUPABASE_URL y SUPABASE_ANON_KEY en .env");

  /* ---------- cookies (sin librerías) ---------- */
  const AT = "vt_at", RT = "vt_rt";
  function leerCookies(req) {
    return Object.fromEntries((req.headers.cookie || "").split(/;\s*/).filter(Boolean).map(c => {
      const i = c.indexOf("=");
      return [c.slice(0, i), decodeURIComponent(c.slice(i + 1))];
    }));
  }
  function ponerCookie(req, res, nombre, valor, segundos) {
    const seguro = req.secure ? "; Secure" : "";
    res.append("Set-Cookie", `${nombre}=${encodeURIComponent(valor)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${segundos}${seguro}`);
  }
  function guardarSesion(req, res, s) {
    ponerCookie(req, res, AT, s.access_token, s.expires_in || 3600);
    ponerCookie(req, res, RT, s.refresh_token, 60 * 60 * 24 * 30); // 30 días
  }
  function borrarSesion(req, res) {
    ponerCookie(req, res, AT, "", 0);
    ponerCookie(req, res, RT, "", 0);
  }

  /* ---------- llamadas a Supabase ---------- */
  async function sb(ruta, { method = "GET", token, body, headers = {} } = {}) {
    const r = await fetch(URL_SB + ruta, {
      method,
      headers: {
        apikey: KEY,
        // solo mandamos Authorization cuando hay sesión; así funciona con la "anon key"
        // y también con la nueva "publishable key" (sb_publishable_...) de Supabase
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        "Content-Type": "application/json",
        ...headers
      },
      body: body ? JSON.stringify(body) : undefined
    });
    const texto = await r.text();
    let data = null;
    try { data = texto ? JSON.parse(texto) : null; } catch { data = texto; }
    return { ok: r.ok, status: r.status, data };
  }

  /* traduce los errores de Supabase a algo que la persona entienda */
  function mensaje(data, porDefecto) {
    const m = String(data?.msg || data?.error_description || data?.message || data?.error || "").toLowerCase();
    if (m.includes("invalid login")) return "Correo o contraseña incorrectos.";
    if (m.includes("email not confirmed")) return "Primero confirma tu correo. Revisa tu bandeja de entrada (y spam).";
    if (m.includes("already registered") || m.includes("already been registered")) return "Ya existe una cuenta con ese correo. Intenta entrar.";
    if (m.includes("password should be")) return "La contraseña debe tener al menos 6 caracteres.";
    if (m.includes("rate limit")) return "Demasiados intentos. Espera un minuto e intenta otra vez.";
    if (m.includes("invalid email") || m.includes("unable to validate email")) return "Ese correo no parece válido.";
    if (m.includes("api key") || m.includes("apikey")) return "El servidor no está bien conectado con Supabase (revisa la URL y la key en .env).";
    if (m.includes("signups not allowed") || m.includes("signup is disabled")) return "Crear cuentas está desactivado en Supabase (Authentication → Sign In / Providers → Allow new users to sign up).";
    if (m.includes("error sending") || m.includes("confirmation email")) return "Supabase no pudo mandar el correo de confirmación. Para pruebas, apaga 'Confirm email' en Supabase.";
    return porDefecto;
  }

  const datosUsuario = u => ({
    id: u.id,
    email: u.email,
    nombre: u.user_metadata?.nombre || u.user_metadata?.full_name || u.user_metadata?.name || (u.email || "").split("@")[0],
    avatar: u.user_metadata?.avatar_url || null
  });

  /* lee el JWT sin verificarlo, solo para saber si ya expiró (Supabase lo verifica de verdad en cada llamada) */
  function expira(token) {
    try { return JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString()).exp * 1000; }
    catch { return 0; }
  }

  /* middleware: deja req.token listo (renueva la sesión si ya caducó) */
  async function sesion(req, res, next) {
    if (!activo) return res.status(503).json({ error: "El login no está configurado en el servidor." });
    const c = leerCookies(req);
    let token = c[AT];
    if (!token || expira(token) < Date.now() + 30_000) {
      if (!c[RT]) return res.status(401).json({ error: "Inicia sesión para continuar." });
      const r = await sb("/auth/v1/token?grant_type=refresh_token", { method: "POST", body: { refresh_token: c[RT] } });
      if (!r.ok) { borrarSesion(req, res); return res.status(401).json({ error: "Tu sesión expiró. Entra otra vez." }); }
      guardarSesion(req, res, r.data);
      token = r.data.access_token;
    }
    req.token = token;
    next();
  }

  /* ---------- rutas de cuenta ---------- */
  router.get("/config", (req, res) => res.json({ login: activo, google }));

  router.post("/auth/registro", async (req, res) => {
    if (!activo) return res.status(503).json({ error: "El login no está configurado." });
    const { email = "", password = "", nombre = "" } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: "Escribe tu correo y una contraseña." });
    const origen = `${req.protocol}://${req.get("host")}`;
    const r = await sb("/auth/v1/signup", {
      method: "POST",
      body: { email: email.trim(), password, data: { nombre: String(nombre).trim().slice(0, 60) } }
    });
    if (!r.ok) {
      console.error("Supabase · crear cuenta:", r.status, r.data);
      return res.status(400).json({ error: mensaje(r.data, `No pudimos crear la cuenta (${r.status}). Revisa la terminal.`) });
    }
    // si en Supabase está activada la confirmación por correo, no regresa sesión todavía
    if (!r.data?.access_token) return res.json({ confirmar: true, redireccion: origen });
    guardarSesion(req, res, r.data);
    res.json({ usuario: datosUsuario(r.data.user) });
  });

  router.post("/auth/entrar", async (req, res) => {
    if (!activo) return res.status(503).json({ error: "El login no está configurado." });
    const { email = "", password = "" } = req.body || {};
    const r = await sb("/auth/v1/token?grant_type=password", { method: "POST", body: { email: email.trim(), password } });
    if (!r.ok) {
      console.error("Supabase · entrar:", r.status, r.data);
      return res.status(400).json({ error: mensaje(r.data, `No pudimos iniciar sesión (${r.status}). Revisa la terminal.`) });
    }
    guardarSesion(req, res, r.data);
    res.json({ usuario: datosUsuario(r.data.user) });
  });

  router.post("/auth/salir", async (req, res) => {
    const c = leerCookies(req);
    if (activo && c[AT]) await sb("/auth/v1/logout", { method: "POST", token: c[AT] }).catch(() => {});
    borrarSesion(req, res);
    res.json({ ok: true });
  });

  router.get("/auth/yo", (req, res, next) => {
    const c = leerCookies(req);
    if (!activo || (!c[AT] && !c[RT])) return res.json({ usuario: null, login: activo, google });
    next();
  }, sesion, async (req, res) => {
    const r = await sb("/auth/v1/user", { token: req.token });
    if (!r.ok) { borrarSesion(req, res); return res.json({ usuario: null, login: true, google }); }
    res.json({ usuario: datosUsuario(r.data), login: true, google });
  });

  router.post("/auth/recuperar", async (req, res) => {
    if (!activo) return res.status(503).json({ error: "El login no está configurado." });
    const email = String(req.body?.email || "").trim();
    if (!email) return res.status(400).json({ error: "Escribe tu correo." });
    await sb("/auth/v1/recover", { method: "POST", body: { email } });
    // siempre respondemos igual para no revelar qué correos existen
    res.json({ ok: true });
  });

  /* Google: Supabase hace todo el ir y venir y regresa a /auth/callback con la sesión en la URL */
  router.get("/auth/google", (req, res) => {
    if (!activo) return res.status(503).send("El login no está configurado.");
    if (!google) return res.status(400).send("El login con Google no está activado en Supabase (Authentication → Sign In / Providers → Google).");
    const volver = `${req.protocol}://${req.get("host")}/auth/callback`;
    res.redirect(`${URL_SB}/auth/v1/authorize?provider=google&redirect_to=${encodeURIComponent(volver)}`);
  });

  router.post("/auth/sesion", async (req, res) => {
    if (!activo) return res.status(503).json({ error: "El login no está configurado." });
    const { access_token, refresh_token, expires_in } = req.body || {};
    if (!access_token || !refresh_token) return res.status(400).json({ error: "Falta la sesión." });
    const r = await sb("/auth/v1/user", { token: access_token });
    if (!r.ok) return res.status(401).json({ error: "La sesión no es válida." });
    guardarSesion(req, res, { access_token, refresh_token, expires_in: Number(expires_in) || 3600 });
    res.json({ usuario: datosUsuario(r.data) });
  });

  /* ---------- wishlist en la nube ---------- */
  // La tabla tiene Row Level Security: Supabase solo deja ver y tocar
  // las filas del usuario dueño del token, aunque alguien manipule la petición.
  const aFila = d => ({
    release_id: Number(d.id),
    titulo: String(d.titulo || "").slice(0, 200),
    artista: String(d.artista || "").slice(0, 200),
    anio: Number(d.anio) || null,
    pais: String(d.pais || "").slice(0, 60) || null,
    portada: String(d.portada || "").slice(0, 500) || null
  });
  const aDisco = f => ({
    id: f.release_id, titulo: f.titulo, artista: f.artista, anio: f.anio, pais: f.pais, portada: f.portada,
    guardado: Date.parse(f.created_at) || Date.now()
  });

  router.get("/wishlist", sesion, async (req, res) => {
    const r = await sb("/rest/v1/wishlist?select=*&order=created_at.desc", { token: req.token });
    if (!r.ok) return res.status(502).json({ error: "No pudimos leer tu wishlist." });
    res.json({ discos: r.data.map(aDisco) });
  });

  router.post("/wishlist", sesion, async (req, res) => {
    const lista = Array.isArray(req.body?.discos) ? req.body.discos : [req.body];
    const filas = lista.filter(d => d && Number(d.id)).slice(0, 500).map(aFila);
    if (!filas.length) return res.status(400).json({ error: "No hay discos para guardar." });
    const r = await sb("/rest/v1/wishlist?on_conflict=user_id,release_id", {
      method: "POST", token: req.token, body: filas,
      headers: { Prefer: "resolution=ignore-duplicates,return=minimal" }
    });
    if (!r.ok) { console.error("Supabase wishlist:", r.status, r.data); return res.status(502).json({ error: "No pudimos guardar en tu wishlist." }); }
    res.json({ ok: true, guardados: filas.length });
  });

  router.delete("/wishlist/:id", sesion, async (req, res) => {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ error: "ID inválido." });
    const r = await sb(`/rest/v1/wishlist?release_id=eq.${id}`, { method: "DELETE", token: req.token });
    if (!r.ok) return res.status(502).json({ error: "No pudimos quitarlo de tu wishlist." });
    res.json({ ok: true });
  });

  router.delete("/wishlist", sesion, async (req, res) => {
    // RLS limita el borrado a las filas del usuario; el filtro "not.is.null" es obligatorio en PostgREST
    const r = await sb("/rest/v1/wishlist?release_id=not.is.null", { method: "DELETE", token: req.token });
    if (!r.ok) return res.status(502).json({ error: "No pudimos vaciar tu wishlist." });
    res.json({ ok: true });
  });

  return router;
};
