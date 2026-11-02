/* =========================================================
   Vinilo Tracks — interacciones de la página
   ========================================================= */

/* ---- Cinta en movimiento (izquierda → derecha) ---- */
const palabras = ["Vinilo Tracks", "Reseñas", "Noticias", "Lanzamientos", "Rock en español", "Joyas"];
const track = document.getElementById("track");
const vuelta = palabras.map(p => `<span>${p}</span><i>✦</i>`).join("");
track.innerHTML = vuelta.repeat(4);

/* ---- Colección / reseñas ----
   Para agregar una reseña nueva, copia un bloque y cambia los datos. */
const coleccion = [
  { img: "img/cover-artaud.webp",   t: "Pescado Rabioso — Artaud",          m: "1973 · Argentina · art rock / folk",              d: "Poesía intensa y libertad total; un clásico de culto.", url: "#" },
  { img: "img/cover-porter.webp",   t: "Porter — Donde los Ponys Pastan",   m: "2004 · México · indie / alternativo",             d: "Surreal, nocturno y raro del bueno; atmósfera pura.", url: "#" },
  { img: "img/cover-sgtp.webp",     t: "Sgt. Papers — SGTP",                m: "2021 · México (Hermosillo) · psych-punk / garage", d: "Fuzz, humor y energía sucia: riffs rápidos y actitud sin filtro.", url: "#" },
  { img: "img/cover-austin.webp",   t: "Austin TV — Rizoma",                m: "2023 · México · post-rock instrumental",          d: "Un viaje cinematográfico: crescendos emotivos, guitarras expansivas y calma antes del golpe.", url: "#" },
  { img: "img/cover-enjambre.webp", t: "Enjambre — Próximos Prójimos",      m: "2020 · México · rock alternativo",                d: "Drama elegante, letras filosas y una melodía que se pega y que pega.", url: "#" },
  { img: "img/cover-odisseo.webp",  t: "Odisseo — Tormentas Inesperadas",   m: "2024 · México · alt / indie pop rock",            d: "Pop alternativo con corazón: synths finos, coros grandes y drama elegante para cantar en el carro.", url: "#" }
];

document.getElementById("coll").innerHTML = coleccion.map(c => `
  <article class="card">
    <div class="cover"><img src="${c.img}" alt="Portada de ${c.t}" loading="lazy"></div>
    <span class="meta">${c.m}</span>
    <h3>${c.t}</h3>
    <p>${c.d}</p>
    <a class="read" href="${c.url}">Leer reseña →</a>
  </article>`).join("");

/* ---- Cápsulas: se abren y los videos arrancan al entrar al viewport ---- */
const caps = document.getElementById("caps");
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function arrancarVideos() {
  caps.querySelectorAll(".cap").forEach((cap, i) => {
    const yt = cap.dataset.youtube;
    const mp4 = cap.dataset.video;
    if (reduceMotion || (!yt && !mp4)) return;

    let el;
    if (mp4) {
      el = document.createElement("video");
      Object.assign(el, { src: mp4, muted: true, loop: true, playsInline: true, autoplay: true });
      el.addEventListener("playing", () => cap.classList.add("playing"), { once: true });
    } else {
      el = document.createElement("iframe");
      el.className = "yt";
      el.title = "Video";
      el.allow = "autoplay; encrypted-media";
      el.src = `https://www.youtube-nocookie.com/embed/${yt}?autoplay=1&mute=1&loop=1&playlist=${yt}&controls=0&playsinline=1&modestbranding=1&rel=0`;
      el.addEventListener("load", () => setTimeout(() => cap.classList.add("playing"), 600), { once: true });
    }
    // pequeño escalonado para que no carguen los 5 al mismo tiempo
    setTimeout(() => cap.appendChild(el), i * 250);
  });
}

if ("IntersectionObserver" in window) {
  new IntersectionObserver((entradas, obs) => {
    entradas.forEach(e => {
      if (e.isIntersecting) {
        caps.classList.add("open");
        arrancarVideos();
        obs.disconnect();
      }
    });
  }, { threshold: 0.35 }).observe(caps);
} else {
  caps.classList.add("open");
  arrancarVideos();
}
