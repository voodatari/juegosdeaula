/* =========================================================
   Efectos visuales
   Todo el confeti va en UN canvas con un único bucle de
   requestAnimationFrame que se apaga solo cuando no quedan
   partículas. Cada estilo de animación tiene su propio confeti:
   papelitos, purpurina dorada, serpentinas o pompas.
   ========================================================= */
(function (global) {

  var cv, cx, particulas = [], corriendo = false, dpr = 1;
  var apagandose = false, fundido = 1;   // desvanecido rápido al cerrar el marcador

  /* ---------- confeti de los marcadores: se puede apagar ---------- */
  var K_CONF = 'trivialaula.confeti';
  var enMarcadores = true;
  try {
    var g = localStorage.getItem(K_CONF);
    if (g !== null) enMarcadores = g === '1';
  } catch (e) { /* navegador sin almacenamiento: se queda encendido */ }

  function marcadores(v) {
    if (v === undefined) return enMarcadores;
    enMarcadores = !!v;
    try { localStorage.setItem(K_CONF, enMarcadores ? '1' : '0'); } catch (e) {}
    if (!enMarcadores) apagar();
    return enMarcadores;
  }

  /* Celebración de un marcador: obedece a ese ajuste. */
  function fiesta(n) {
    if (!enMarcadores) return;
    lluvia(n);
  }
  var COLORES = ['#FF5D73', '#2BC4B4', '#F5C518', '#8B7CF6', '#4C8DFF', '#FF8A3D', '#ffffff'];
  var DORADOS = ['#F5C518', '#FFD166', '#FFE9A8', '#FFF6DC', '#E8B04B'];
  var PASTEL  = ['#A8D8FF', '#FFC8E4', '#C9F5E1', '#FFE7A8', '#D8CCFF'];

  /* ---------- perfil de confeti según el estilo de animación ---------- */
  var PERFILES = {
    suave:    { forma: 'rect', cant: 0.8, g: 0.26, vida: 80,  colores: COLORES, tam: 1 },
    fiesta:   { forma: 'mixto', cant: 2.1, g: 0.24, vida: 105, colores: COLORES, tam: 1.25 },
    cine:     { forma: 'circ', cant: 1.1, g: 0.06, vida: 220, colores: DORADOS, tam: 0.7 },
    deslizar: { forma: 'cinta', cant: 1.2, g: 0.16, vida: 120, colores: COLORES, tam: 1.1 },
    calma:    { forma: 'circ', cant: 0.5, g: 0.04, vida: 240, colores: PASTEL,  tam: 1.1 },
    cartas:   { forma: 'rect', cant: 1.3, g: 0.2,  vida: 115, colores: COLORES, tam: 1.3 }
  };
  function perfil() {
    var id = (global.Anim && global.Anim.actual) ? global.Anim.actual() : 'fiesta';
    return PERFILES[id] || PERFILES.fiesta;
  }

  function lienzo() {
    if (cv) return;
    cv = document.createElement('canvas');
    cv.id = 'confeti';
    document.body.appendChild(cv);
    cx = cv.getContext('2d');
    medir();
    global.addEventListener('resize', medir, { passive: true });
    global.addEventListener('rendimiento', medir);
  }

  function medir() {
    if (!cv) return;
    dpr = Math.min(global.devicePixelRatio || 1, 2);
    /* en el modo de media resolución el confeti se dibuja a la mitad */
    if (global.Rendimiento && global.Rendimiento.mediaRes()) dpr *= 0.5;
    cv.width = innerWidth * dpr;
    cv.height = innerHeight * dpr;
    cv.style.width = innerWidth + 'px';
    cv.style.height = innerHeight + 'px';
    cx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function bucle() {
    cx.clearRect(0, 0, innerWidth, innerHeight);
    if (apagandose) {
      fundido *= 0.86;                       // medio segundo escaso hasta desaparecer
      if (fundido <= 0.02) {
        particulas.length = 0;
        apagandose = false; fundido = 1;
        corriendo = false;
        return;
      }
    }
    /* Si hay una ventana abierta (el marcador entre preguntas, el podio),
       se recorta un hueco: el confeti pasa por detrás y no estorba la
       lectura. Como mucho roza sus bordes. */
    cx.save();
    var ventana = document.querySelector('.capa.ver .caja');
    if (ventana) {
      var rv = ventana.getBoundingClientRect();
      cx.beginPath();
      cx.rect(0, 0, innerWidth, innerHeight);
      cx.rect(rv.left - 4, rv.top - 4, rv.width + 8, rv.height + 8);
      cx.clip('evenodd');
    }
    for (var i = particulas.length - 1; i >= 0; i--) {
      var p = particulas[i];
      p.vy += p.g;
      p.vx *= 0.995;
      p.x += p.vx;
      p.y += p.vy;
      p.rot += p.vr;
      p.vida--;
      if (p.vida < 0 || p.y > innerHeight + 50) { particulas.splice(i, 1); continue; }
      cx.save();
      cx.translate(p.x, p.y);
      cx.rotate(p.rot);
      cx.globalAlpha = (p.vida < 26 ? p.vida / 26 : 1) * fundido;
      cx.fillStyle = p.c;
      if (p.f === 'circ') {
        cx.beginPath();
        cx.arc(0, 0, p.w / 2, 0, 6.2832);
        cx.fill();
      } else if (p.f === 'cinta') {
        cx.fillRect(-p.w / 2, -p.h / 2, p.w * 2.4, p.h * 0.5);
      } else {
        cx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h * (0.4 + 0.6 * Math.abs(Math.cos(p.rot))));
      }
      cx.restore();
    }
    cx.restore();                 // cierra el recorte de la ventana
    if (particulas.length) requestAnimationFrame(bucle);
    else corriendo = false;
  }

  function empujar(n, hacer) {
    var P = perfil();
    lienzo();
    apagandose = false; fundido = 1;     // confeti nuevo: se cancela el desvanecido
    n = Math.round(n * P.cant);
    n = Math.min(n, 620 - particulas.length);
    for (var i = 0; i < n; i++) particulas.push(hacer(i, P));
    if (!corriendo && particulas.length) { corriendo = true; requestAnimationFrame(bucle); }
  }

  function forma(P) {
    if (P.forma !== 'mixto') return P.forma;
    return Math.random() < 0.4 ? 'circ' : 'rect';
  }

  /* Caída sobre un punto de la pantalla: nada explota, todo cae.
     Los papelitos aparecen un poco por encima y bajan. */
  function chorro(x, y, n, ancho) {
    var w = ancho || 150;
    empujar(n || 26, function (i, P) {
      return {
        x: x + (Math.random() - 0.5) * w,
        y: y - 70 - Math.random() * 90,
        f: forma(P),
        vx: (Math.random() - 0.5) * 1.6,
        vy: 5 + Math.random() * 4,
        g: P.g * 0.7, rot: Math.random() * 6.28, vr: (Math.random() - 0.5) * 0.35,
        w: (7 + Math.random() * 6) * P.tam, h: (10 + Math.random() * 8) * P.tam,
        c: P.colores[(Math.random() * P.colores.length) | 0],
        vida: P.vida * (0.9 + Math.random() * 0.6)
      };
    });
  }

  function desde(el, n) {
    if (!el) return;
    var r = el.getBoundingClientRect();
    chorro(r.left + r.width / 2, r.top + r.height / 2, n, Math.max(90, r.width * 0.9));
  }

  /* Lluvia desde arriba: cae con ganas, sin quedarse flotando. */
  function lluvia(n) {
    empujar(n || 120, function (i, P) {
      return {
        x: Math.random() * innerWidth, y: -20 - Math.random() * 300,
        f: forma(P),
        vx: (Math.random() - 0.5) * (P.forma === 'cinta' ? 6 : 2.6),
        vy: 7 + Math.random() * 6,
        g: P.g * 0.8, rot: Math.random() * 6.28, vr: (Math.random() - 0.5) * 0.3,
        w: (8 + Math.random() * 7) * P.tam, h: (12 + Math.random() * 9) * P.tam,
        c: P.colores[(Math.random() * P.colores.length) | 0],
        vida: P.vida * 2.1
      };
    });
  }

  /* Número flotante (+1) sobre una tarjeta de equipo. */
  function flotante(el, texto, color) {
    if (!el) return;
    var s = document.createElement('span');
    s.className = 'flota';
    s.textContent = texto;
    if (color) s.style.color = color;
    el.appendChild(s);
    setTimeout(function () { s.remove(); }, 900);
  }

  /* Reinicia una animación CSS en un elemento. */
  function repetir(el, clase, ms) {
    if (!el) return;
    el.classList.remove(clase);
    void el.offsetWidth;
    el.classList.add(clase);
    if (ms) setTimeout(function () { el.classList.remove(clase); }, ms);
  }

  /* Desvanece lo que quede en pantalla, suave pero rápido: al cerrar el
     marcador el confeti no debe estorbar la lectura de la pregunta. */
  function apagar() {
    if (particulas.length) apagandose = true;
  }

  global.FX = {
    chorro: chorro, desde: desde, lluvia: lluvia, fiesta: fiesta,
    marcadores: marcadores,
    flotante: flotante, repetir: repetir, apagar: apagar
  };

})(window);
