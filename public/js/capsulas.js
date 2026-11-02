/* =========================================================
   Vinilo Tracks — cápsulas con video
   - Se abren hacia los lados al entrar al viewport
   - Cada video corre del segundo data-start al data-end y repite
   - data-youtube acepta el ID o el link completo de YouTube
   - data-video acepta un .mp4 propio (ej. /video/clip1.mp4)
   ========================================================= */
(function () {
  const caps = document.getElementById("caps");
  if (!caps) return;

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const INICIO = 30, FIN = 40; // valores por defecto
  const players = []; // { cap, play(), pause() }

  if (location.protocol === "file:") {
    console.warn("Vinilo Tracks: abre la página con `npm run dev` en http://localhost:3000. YouTube no reproduce videos en archivos abiertos con doble clic (file://).");
  }

  /* El video de YouTube es 16:9 y la cápsula es vertical (o una píldora en celular).
     Calculamos el tamaño del iframe para que cubra toda la cápsula, como object-fit: cover,
     y un poco más grande para esconder los bordes y botones de YouTube. */
  function ajustarIframe(cap) {
    const f = cap.querySelector("iframe");
    if (!f) return;
    const w = cap.clientWidth, h = cap.clientHeight;
    let fw = h * 16 / 9, fh = h;
    if (fw < w) { fw = w; fh = w * 9 / 16; }
    const extra = 1.25; // zoom para recortar la interfaz de YouTube
    f.style.width = Math.ceil(fw * extra) + "px";
    f.style.height = Math.ceil(fh * extra) + "px";
  }
  const ajustarTodos = () => caps.querySelectorAll(".cap").forEach(ajustarIframe);
  if ("ResizeObserver" in window) new ResizeObserver(ajustarTodos).observe(caps);
  window.addEventListener("resize", ajustarTodos);

  /* saca el ID de cualquier link de YouTube */
  function idYouTube(valor) {
    if (!valor) return "";
    valor = valor.trim();
    const m = valor.match(/(?:youtu\.be\/|v=|\/embed\/|\/shorts\/|\/live\/)([\w-]{11})/);
    if (m) return m[1];
    return /^[\w-]{11}$/.test(valor) ? valor : "";
  }

  /* ---------- YouTube IFrame API (se carga una sola vez) ---------- */
  let apiLista;
  function cargarAPI() {
    if (apiLista) return apiLista;
    apiLista = new Promise(resolve => {
      if (window.YT && window.YT.Player) return resolve(window.YT);
      const anterior = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => { anterior && anterior(); resolve(window.YT); };
      const s = document.createElement("script");
      s.src = "https://www.youtube.com/iframe_api";
      document.head.appendChild(s);
    });
    return apiLista;
  }

  function crearYouTube(cap, id, inicio, fin, i) {
    const hueco = document.createElement("div");
    hueco.id = "yt-capsula-" + i;
    cap.appendChild(hueco);

    cargarAPI().then(YT => {
      let reloj;
      const p = new YT.Player(hueco.id, {
        videoId: id,
        width: "100%",
        height: "100%",
        playerVars: {
          autoplay: 1, mute: 1, controls: 0, playsinline: 1, rel: 0,
          modestbranding: 1, disablekb: 1, iv_load_policy: 3, fs: 0,
          start: inicio, end: fin, origin: location.origin,
          cc_load_policy: 0, enablejsapi: 1
        },
        events: {
          onReady: e => {
            ajustarIframe(cap);
            e.target.mute();
            e.target.seekTo(inicio, true);
            e.target.playVideo();
            // vigilante: cuando pasa del segundo final, regresa al inicio
            reloj = setInterval(() => {
              const t = e.target.getCurrentTime?.() || 0;
              if (t >= fin || t < inicio - 1) e.target.seekTo(inicio, true);
            }, 250);
          },
          onStateChange: e => {
            if (e.data === YT.PlayerState.PLAYING) {
              // espera un instante a que YouTube quite su ícono de "play/pausa" antes de mostrar el video
              setTimeout(() => cap.classList.add("playing"), 700);
            }
            if (e.data === YT.PlayerState.ENDED) { e.target.seekTo(inicio, true); e.target.playVideo(); }
          },
          onError: e => console.warn(`Cápsula ${i + 1}: YouTube no deja reproducir el video ${id} (error ${e.data}). Revisa que el video permita insertarse en otros sitios.`)
        }
      });
      players.push({ cap, tipo: "youtube", play: () => p.playVideo?.(), pause: () => p.pauseVideo?.() });
      // si en 12 segundos no arrancó, lo decimos en la consola (F12) y se queda la foto
      setTimeout(() => {
        if (!cap.classList.contains("playing"))
          console.warn(`Cápsula ${i + 1}: el video de YouTube no arrancó. Puede estar bloqueado para insertarse en otros sitios. Usa un .mp4 con data-video.`);
      }, 12000);
    });
  }

  /* Video propio (.mp4). Es lo más confiable: sin botones, sin subtítulos, sin anuncios.
     - Si el clip dura menos que data-end (ej. un clip de 10 s ya recortado), se repite completo.
     - Si es un video largo, se repite del segundo data-start al data-end. */
  function crearMP4(cap, src, inicio, fin) {
    const v = document.createElement("video");
    v.muted = true;
    v.defaultMuted = true;
    v.playsInline = true;
    v.autoplay = true;
    v.preload = "metadata";
    ["muted", "playsinline", "autoplay"].forEach(a => v.setAttribute(a, ""));
    const foto = cap.querySelector("img");
    if (foto) v.poster = foto.currentSrc || foto.src;
    let corto = false;

    v.addEventListener("loadedmetadata", () => {
      if (!isFinite(v.duration) || v.duration <= fin + 0.5) {
        corto = true;
        v.loop = true;
      } else {
        v.currentTime = inicio;
      }
      intentar();
    });
    v.addEventListener("timeupdate", () => {
      if (!corto && v.currentTime >= fin) v.currentTime = inicio;
    });
    v.addEventListener("playing", () => cap.classList.add("playing"));
    v.addEventListener("error", () => console.warn(`No se encontró el video ${src}. Revisa que esté en public/video/ y que la ruta empiece con /video/`));

    // algunos celulares bloquean el autoplay hasta que la persona toca la pantalla
    function intentar() {
      v.play().catch(() => {
        const una = () => { v.play().catch(() => {}); };
        document.addEventListener("touchstart", una, { once: true, passive: true });
        document.addEventListener("click", una, { once: true });
      });
    }

    v.src = src;
    cap.appendChild(v);
    players.push({ cap, tipo: "mp4", play: () => v.play().catch(() => {}), pause: () => v.pause() });
  }

  function arrancarVideos() {
    if (reduceMotion) return;
    caps.querySelectorAll(".cap").forEach((cap, i) => {
      const inicio = Number(cap.dataset.start ?? INICIO);
      const fin = Number(cap.dataset.end ?? FIN);
      const yt = idYouTube(cap.dataset.youtube);
      const mp4 = (cap.dataset.video || "").trim();
      // escalonado para que no carguen los 5 al mismo tiempo
      setTimeout(() => {
        if (mp4) crearMP4(cap, mp4, inicio, fin);
        else if (yt) crearYouTube(cap, yt, inicio, fin, i);
        else if (cap.dataset.youtube) console.warn(`Cápsula ${i + 1}: no reconozco "${cap.dataset.youtube}" como video de YouTube.`);
      }, i * 200);
    });
  }

  /* ---------- abrir al entrar, pausar al salir ---------- */
  let iniciado = false;
  if ("IntersectionObserver" in window) {
    new IntersectionObserver(entradas => {
      entradas.forEach(e => {
        if (e.isIntersecting) {
          caps.classList.add("open");
          if (!iniciado) { iniciado = true; arrancarVideos(); }
          else players.filter(p => p.tipo === "mp4").forEach(p => p.play());
        } else if (iniciado) {
          players.filter(p => p.tipo === "mp4").forEach(p => p.pause());
        }
        // ya no pausamos al salir: al pausar, YouTube dibuja su ícono de pausa encima del video
      });
    }, { threshold: 0.2 }).observe(caps);
  } else {
    caps.classList.add("open");
    arrancarVideos();
  }
})();
