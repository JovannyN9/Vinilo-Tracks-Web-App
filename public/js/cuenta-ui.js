/* =========================================================
   Vinilo Tracks — botón de cuenta en el header
   y ventana para entrar / crear cuenta / recuperar contraseña.
   Se carga en todas las páginas después de layout.js.
   ========================================================= */
(function () {
  const { esc } = window.VT;

  /* ---------- botón del header ---------- */
  const acct = document.getElementById("acct");
  function pintarCuenta(u) {
    const note = document.getElementById("wl-note");
    if (note) note.hidden = !!u || !VT.cuenta.login;
    if (!acct) return;
    if (!VT.cuenta.login) { acct.innerHTML = ""; return; }
    acct.innerHTML = u
      ? `<button class="avatar" id="acct-btn" type="button" aria-haspopup="menu" aria-expanded="false" aria-label="Tu cuenta">
           ${u.avatar ? `<img src="${esc(u.avatar)}" alt="">` : esc((u.nombre || u.email || "?").charAt(0).toUpperCase())}
         </button>
         <div class="acct-menu" id="acct-menu" role="menu" hidden>
           <div class="acct-who"><strong>${esc(u.nombre)}</strong><span>${esc(u.email)}</span></div>
           <a role="menuitem" href="/wishlist">Mi wishlist</a>
           <a role="menuitem" href="/identificar">Identificar un disco</a>
           <button role="menuitem" type="button" id="acct-salir">Cerrar sesión</button>
         </div>`
      : `<button class="btn-login" type="button" data-auth="entrar" aria-label="Entrar a tu cuenta">
           <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/></svg>
           <span>Entrar</span>
         </button>`;
    const btn = document.getElementById("acct-btn");
    const menu = document.getElementById("acct-menu");
    btn?.addEventListener("click", e => {
      e.stopPropagation();
      menu.hidden = !menu.hidden;
      btn.setAttribute("aria-expanded", !menu.hidden);
    });
    document.getElementById("acct-salir")?.addEventListener("click", () => VT.cuenta.salir());
  }
  document.addEventListener("click", e => {
    const menu = document.getElementById("acct-menu");
    if (menu && !menu.hidden && !e.target.closest(".acct")) menu.hidden = true;
  });
  VT.cuenta.cambio(pintarCuenta);

  /* ---------- ventana ---------- */
  document.body.insertAdjacentHTML("beforeend", `
    <div class="modal-bg" id="auth-bg" hidden></div>
    <div class="modal" id="auth" role="dialog" aria-modal="true" aria-labelledby="auth-title" hidden>
      <button class="x modal-x" type="button" id="auth-close" aria-label="Cerrar">✕</button>
      <div class="auth-disc" aria-hidden="true"></div>
      <span class="eyebrow">Tu cuenta</span>
      <h2 id="auth-title">Entra a Vinilo Tracks</h2>
      <p class="auth-sub" id="auth-sub"></p>
      <div class="auth-tabs" role="tablist">
        <button type="button" role="tab" data-modo="entrar" aria-selected="true">Entrar</button>
        <button type="button" role="tab" data-modo="registro" aria-selected="false">Crear cuenta</button>
      </div>
      <a class="btn-google" id="auth-google" href="/api/auth/google">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.4h6.5a5.6 5.6 0 0 1-2.4 3.6v3h3.9c2.3-2.1 3.5-5.2 3.5-8.7z"/><path fill="#34A853" d="M12 24c3.2 0 6-1.1 7.9-2.9l-3.9-3c-1.1.7-2.4 1.2-4 1.2-3.1 0-5.7-2.1-6.6-4.9h-4v3.1A12 12 0 0 0 12 24z"/><path fill="#FBBC05" d="M5.4 14.4a7.2 7.2 0 0 1 0-4.7V6.6h-4a12 12 0 0 0 0 10.8l4-3z"/><path fill="#EA4335" d="M12 4.8c1.7 0 3.3.6 4.5 1.8l3.4-3.4A12 12 0 0 0 1.4 6.6l4 3.1C6.3 6.9 8.9 4.8 12 4.8z"/></svg>
        Continuar con Google
      </a>
      <div class="auth-or"><span>o con tu correo</span></div>
      <form id="auth-form" novalidate>
        <label class="fld" id="fld-nombre" hidden><span>Nombre</span><input id="auth-nombre" name="nombre" autocomplete="name" maxlength="60" placeholder="Cómo te llamamos"></label>
        <label class="fld"><span>Correo</span><input id="auth-email" name="email" type="email" autocomplete="email" required placeholder="tu@correo.com"></label>
        <label class="fld" id="fld-pass"><span>Contraseña</span>
          <span class="pass-wrap"><input id="auth-pass" name="password" type="password" autocomplete="current-password" required minlength="6" placeholder="Mínimo 6 caracteres"><button type="button" class="pass-eye" id="auth-eye" aria-label="Mostrar contraseña">Ver</button></span>
        </label>
        <p class="auth-msg" id="auth-msg" role="alert" hidden></p>
        <button class="btn-primary auth-submit" type="submit" id="auth-submit">Entrar</button>
        <button type="button" class="link-btn auth-forgot" id="auth-forgot">¿Olvidaste tu contraseña?</button>
      </form>
      <div class="auth-why" id="auth-why">
        <strong>¿Para qué es la cuenta?</strong>
        <p>Solo para guardar tu wishlist en la nube. Así te sigue al celular y a la compu, y no se pierde si borras el caché o cambias de navegador. Todo lo demás de Vinilo Tracks lo puedes usar sin cuenta. No te mandamos spam.</p>
      </div>
    </div>`);

  const $ = id => document.getElementById(id);
  const auth = $("auth"), authBg = $("auth-bg"), form = $("auth-form"), msg = $("auth-msg");
  let modo = "entrar";
  let ultimoFoco = null;

  const TEXTOS = {
    entrar: ["Entra a Vinilo Tracks", "Tu wishlist, en todos tus dispositivos.", "Entrar"],
    registro: ["Crea tu cuenta", "Gratis. Tu wishlist te sigue a todos lados y no se pierde al borrar el caché.", "Crear cuenta"],
    recuperar: ["Recupera tu cuenta", "Te mandamos un correo con un enlace para crear una contraseña nueva.", "Mandar correo"]
  };

  function ponerModo(m) {
    modo = m;
    const [titulo, sub, boton] = TEXTOS[m];
    $("auth-title").textContent = titulo;
    $("auth-sub").textContent = sub;
    $("auth-submit").textContent = boton;
    $("fld-nombre").hidden = m !== "registro";
    $("fld-pass").hidden = m === "recuperar";
    $("auth-forgot").hidden = m !== "entrar";
    $("auth-why").hidden = m === "recuperar";
    $("auth-google").hidden = m === "recuperar" || !VT.cuenta.google;
    auth.querySelector(".auth-or").hidden = m === "recuperar" || !VT.cuenta.google;
    auth.querySelector(".auth-tabs").hidden = m === "recuperar";
    $("auth-pass").autocomplete = m === "registro" ? "new-password" : "current-password";
    auth.querySelectorAll("[data-modo]").forEach(b => b.setAttribute("aria-selected", b.dataset.modo === m));
    msg.hidden = true;
  }

  function abrirAuth(m = "entrar") {
    if (!VT.cuenta.login) return VT.toast("El login todavía no está activado en este sitio.");
    ultimoFoco = document.activeElement;
    VT.cerrarWishlist ? VT.cerrarWishlist() : document.body.classList.remove("wl-open"); // si el panel de wishlist estaba abierto
    ponerModo(m);
    authBg.hidden = auth.hidden = false;
    requestAnimationFrame(() => document.body.classList.add("auth-open"));
    setTimeout(() => $(m === "registro" ? "auth-nombre" : "auth-email").focus(), 80);
  }
  function cerrarAuth() {
    document.body.classList.remove("auth-open");
    setTimeout(() => { authBg.hidden = auth.hidden = true; }, 250);
    ultimoFoco?.focus?.();
  }
  VT.abrirAuth = abrirAuth;

  document.addEventListener("click", e => {
    const b = e.target.closest("[data-auth]");
    if (!b) return;
    e.preventDefault();
    abrirAuth(b.dataset.auth);
  });
  $("auth-close").addEventListener("click", cerrarAuth);
  authBg.addEventListener("click", cerrarAuth);
  document.addEventListener("keydown", e => {
    if (auth.hidden) return;
    if (e.key === "Escape") return cerrarAuth();
    /* con Tab el foco se queda dentro de la ventana (accesibilidad) */
    if (e.key === "Tab") {
      const f = [...auth.querySelectorAll("a[href], button, input, select, textarea")].filter(el => !el.disabled && el.offsetParent !== null);
      if (!f.length) return;
      const [primero, ultimo] = [f[0], f[f.length - 1]];
      if (e.shiftKey && document.activeElement === primero) { e.preventDefault(); ultimo.focus(); }
      else if (!e.shiftKey && document.activeElement === ultimo) { e.preventDefault(); primero.focus(); }
    }
  });
  auth.querySelectorAll("[data-modo]").forEach(b => b.addEventListener("click", () => ponerModo(b.dataset.modo)));
  $("auth-forgot").addEventListener("click", () => ponerModo("recuperar"));
  $("auth-eye").addEventListener("click", e => {
    const i = $("auth-pass");
    i.type = i.type === "password" ? "text" : "password";
    e.currentTarget.textContent = i.type === "password" ? "Ver" : "Ocultar";
  });
  // al volver de Google, regresamos a la página donde estaba
  $("auth-google").addEventListener("click", () => {
    try { sessionStorage.setItem("vt-volver", location.pathname + location.search + location.hash); } catch {}
  });

  form.addEventListener("submit", async e => {
    e.preventDefault();
    const email = $("auth-email").value.trim();
    const pass = $("auth-pass").value;
    const nombre = $("auth-nombre").value.trim();
    const aviso = (t, ok = false) => { msg.textContent = t; msg.hidden = false; msg.classList.toggle("ok", ok); };

    if (!/^\S+@\S+\.\S+$/.test(email)) return aviso("Escribe un correo válido.");
    if (modo !== "recuperar" && pass.length < 6) return aviso("La contraseña debe tener al menos 6 caracteres.");

    const boton = $("auth-submit");
    const texto = boton.textContent;
    boton.disabled = true;
    boton.textContent = "Un momento…";
    try {
      if (modo === "entrar") {
        const u = await VT.cuenta.entrar(email, pass);
        cerrarAuth();
        VT.toast(`Hola, ${u.nombre}`);
      } else if (modo === "registro") {
        const d = await VT.cuenta.registro(nombre, email, pass);
        if (d.confirmar) aviso("¡Listo! Te mandamos un correo. Confírmalo y luego entra con tu contraseña.", true);
        else { cerrarAuth(); VT.toast(`Bienvenido, ${d.usuario.nombre}`); }
      } else {
        await VT.api("POST", "/api/auth/recuperar", { email });
        aviso("Si ese correo tiene cuenta, te llegará un enlace en unos minutos.", true);
      }
    } catch (err) {
      aviso(err.message);
    } finally {
      boton.disabled = false;
      boton.textContent = texto;
    }
  });
})();
