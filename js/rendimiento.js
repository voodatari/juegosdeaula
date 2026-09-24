/* =========================================================
   Rendimiento · dos modos opcionales para equipos modestos
   Ninguno cambia lo que ya había: con los dos apagados, la web
   se dibuja exactamente igual que siempre.

   1) MEDIA RESOLUCIÓN  (<html class="mediaRes">)
      Lo que de verdad cuesta en una pantalla 4K no son los textos
      ni los botones, sino las capas enormes que se mueven: el fondo
      que gira, los nueve focos desenfocados y el confeti. En este
      modo esas tres cosas se dibujan en lienzos a la MITAD de la
      resolución de la pantalla (una cuarta parte de los píxeles) y
      el navegador los estira. Como son degradados y luces difusas,
      no se nota; los textos y botones siguen nítidos (una web no
      puede bajar la resolución de su propio texto).
      Se activa solo si el equipo parece modesto.

   2) EFECTOS OPTIMIZADOS  (<html class="ligero">)
      A resolución completa, pero con técnicas más baratas para
      conseguir casi el mismo aspecto: el cuadrado que gira pasa de
      240 a 142 vmax (lo justo para tapar la pantalla en cualquier
      ángulo, con los degradados recolocados para que se vea igual),
      las manchas de color y los focos llevan el desenfoque «pintado»
      en su degradado en lugar de un filtro que se recalcula en cada
      fotograma, se quita el cristal esmerilado (backdrop-filter) de
      los botones y de las ventanas, y el fondo entero (giro y manchas)
      se renueva 20 veces por segundo en vez de 60: entre medias no
      cambia y el navegador solo repinta lo que se mueve.
      También se activa solo si el equipo parece modesto: en automático
      los dos modos van juntos.

   Además, un contador de FPS opcional para comparar.
   ========================================================= */
window.Rendimiento = (function (global) {

  var K_MEDIA = 'trivialaula.mediares';     // '1' / '0' · sin guardar = automático
  var K_LIGERO = 'trivialaula.ligero';
  var K_FPS = 'trivialaula.fps';
  var RAD = Math.PI / 180;
  var ESCALA = 0.5;                          // la mitad de la resolución
  var PASO_LIGERO = 50;                      // ms entre cambios del fondo en el modo optimizado

  function leer(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function escribir(k, v) {
    try { if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) {}
  }

  /* =========================================================
     ¿Equipo modesto?
     Se mira la CPU (hilos), la memoria si el navegador la dice y la
     gráfica: una integrada moviendo una pantalla grande es justo el
     caso del Ryzen 3 4300U en 4K.
     ========================================================= */
  function nombreGrafica() {
    try {
      var c = document.createElement('canvas');
      var gl = c.getContext('webgl') || c.getContext('experimental-webgl');
      if (!gl) return '';
      var ext = gl.getExtension('WEBGL_debug_renderer_info');
      var n = ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
      var perder = gl.getExtension('WEBGL_lose_context');
      if (perder) perder.loseContext();
      return String(n || '');
    } catch (e) { return ''; }
  }

  function detectar() {
    var motivos = [];
    var hilos = navigator.hardwareConcurrency || 0;
    if (hilos && hilos <= 4) motivos.push('CPU de ' + hilos + ' hilos');
    var mem = navigator.deviceMemory;
    if (mem && mem <= 4) motivos.push(mem + ' GB de memoria');
    var gpu = nombreGrafica();
    var discreta = /nvidia|geforce|quadro|rtx|gtx|radeon rx|radeon pro|radeon r9|arc a\d/i.test(gpu);
    var integrada = !discreta &&
      /intel|uhd|iris|radeon\(tm\) graphics|radeon graphics|radeon vega|vega \d|mali|adreno|powervr|llvmpipe|swiftshader|basic render/i.test(gpu);
    var dpr = global.devicePixelRatio || 1;
    var pixeles = (screen.width * dpr) * (screen.height * dpr);
    if (integrada && pixeles >= 3.6e6) motivos.push('gráfica integrada con pantalla grande');
    return {
      modesto: motivos.length > 0,
      motivos: motivos,
      hilos: hilos,
      gpu: gpu,
      pantalla: Math.round(screen.width * dpr) + '×' + Math.round(screen.height * dpr)
    };
  }

  var deteccion = detectar();

  /* ---------- estado de los tres interruptores ---------- */
  function mediaGuardada() { return leer(K_MEDIA); }
  var media = mediaGuardada() === null ? deteccion.modesto : mediaGuardada() === '1';
  function ligeroGuardado() { return leer(K_LIGERO); }
  /* los dos ahorros van juntos en automático: si el equipo parece
     modesto, se encienden los dos */
  var ligero = ligeroGuardado() === null ? deteccion.modesto : ligeroGuardado() === '1';
  var verFps = leer(K_FPS) === '1';

  /* las clases van en <html> desde el <head>: así el fondo pesado ni
     llega a pintarse si el modo está activo */
  function aplicarClases() {
    var r = document.documentElement;
    r.classList.toggle('mediaRes', media);
    r.classList.toggle('ligero', ligero);
  }
  aplicarClases();

  function avisar() {
    aplicarClases();
    sucio = true;
    try { global.dispatchEvent(new Event('rendimiento')); } catch (e) {}
  }

  /* =========================================================
     Colores del tema (resueltos por el navegador, sean hex o
     color-mix) para poder pintarlos en el lienzo
     ========================================================= */
  var sonda = null;
  function colorDe(variable) {
    if (!sonda) {
      sonda = document.createElement('span');
      sonda.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden;visibility:hidden';
      document.body.appendChild(sonda);
    }
    sonda.style.color = 'var(' + variable + ')';
    var c = getComputedStyle(sonda).color || 'rgb(0,0,0)';
    var n = (c.match(/-?[\d.]+/g) || [0, 0, 0]).map(Number);
    if (/^color\(/.test(c)) return [n[0] * 255, n[1] * 255, n[2] * 255].map(Math.round);
    return [n[0], n[1], n[2]].map(Math.round);
  }
  function rgba(c, a) { return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + Math.max(0, Math.min(1, a)) + ')'; }

  /* curva «ease-in-out» de CSS: cubic-bezier(.42,0,.58,1) */
  function suave(x) {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    var t = x;
    for (var i = 0; i < 6; i++) {           // Newton sobre x(t)
      var ct = 3 * t * (1 - t);
      var xt = ct * (1 - t) * 0.42 + ct * t * 0.58 + t * t * t;
      var dx = 3 * (1 - t) * (1 - t) * 0.42 + 6 * (1 - t) * t * (0.58 - 0.42) + 3 * t * t * (1 - 0.58);
      if (Math.abs(dx) < 1e-6) break;
      t -= (xt - x) / dx;
      t = Math.max(0, Math.min(1, t));
    }
    return 3 * (1 - t) * t * t + t * t * t;   // y(t) con y1=0, y2=1
  }

  /* =========================================================
     FONDO A MEDIA RESOLUCIÓN
     Las dos capas que giran se pintan UNA vez en dos texturas
     (solo el círculo que puede llegar a verse) y en cada fotograma
     se colocan giradas; las tres manchas de color, que además se
     desplazan, se pintan directamente con su desenfoque de 60 px
     convertido en degradado.
     ========================================================= */
  var lienzoF = null, cf = null, texA = null, texB = null, sucio = true;
  var W = 0, H = 0, K = 1, D = 0, S = 0, V = 0, col = null;

  function elipse(c, x, y, rx, ry, color, fin) {
    c.save();
    c.translate(x, y);
    c.scale(1, ry / rx);
    var g = c.createRadialGradient(0, 0, 0, 0, 0, rx);
    g.addColorStop(0, rgba(color, 1));
    g.addColorStop(fin, rgba(color, 0));
    g.addColorStop(1, rgba(color, 0));
    c.fillStyle = g;
    c.fillRect(-rx, -rx, 2 * rx, 2 * rx);
    c.restore();
  }

  function textura(pintar) {
    var t = document.createElement('canvas');
    t.width = t.height = Math.max(1, Math.round(D * K));
    var c = t.getContext('2d');
    c.setTransform(K, 0, 0, K, D * K / 2, D * K / 2);    // origen = centro del cuadrado
    pintar(c);
    return t;
  }

  function reconstruirFondo() {
    W = global.innerWidth; H = global.innerHeight;
    K = Math.min(global.devicePixelRatio || 1, 3) * ESCALA;
    V = Math.max(W, H) / 100;                 // 1 vmax
    S = 240 * V;                              // el cuadrado que gira
    D = Math.ceil(Math.sqrt(W * W + H * H)) + 4;
    lienzoF.width = Math.max(1, Math.round(W * K));
    lienzoF.height = Math.max(1, Math.round(H * K));
    col = {
      A: colorDe('--bgA'), B: colorDe('--bgB'), C: colorDe('--bgC'), D: colorDe('--bgD'),
      o1: colorDe('--orb1'), o2: colorDe('--orb2'), o3: colorDe('--orb3'),
      oro: colorDe('--oro')
    };
    var h = S / 2;
    /* capa de abajo: degradado de 160° y los dos halos (el primero de la
       lista de CSS va encima, así que se pinta el último) */
    texA = textura(function (c) {
      var th = 160 * RAD, dx = Math.sin(th), dy = -Math.cos(th);
      var L = S * (Math.abs(dx) + Math.abs(dy));
      var g = c.createLinearGradient(-dx * L / 2, -dy * L / 2, dx * L / 2, dy * L / 2);
      g.addColorStop(0, rgba(col.C, 1));
      g.addColorStop(1, rgba(col.D, 1));
      c.fillStyle = g;
      c.fillRect(-D / 2, -D / 2, D, D);
      elipse(c, -h + 0.64 * S, -h + 0.62 * S, 64 * V, 48 * V, col.B, 0.58);
      elipse(c, -h + 0.34 * S, -h + 0.36 * S, 70 * V, 52 * V, col.A, 0.62);
    });
    /* capa de arriba (la que gira al revés); su opacidad de 0,6 se aplica
       al colocarla */
    texB = textura(function (c) {
      elipse(c, -h + 0.40 * S, -h + 0.60 * S, 42 * V, 36 * V, col.o2, 0.60);
      elipse(c, -h + 0.58 * S, -h + 0.38 * S, 46 * V, 40 * V, col.o1, 0.62);
    });
    medidasFocos = null;
    sucio = false;
  }

  /* mancha de color desenfocada (blur de 60 px ≈ gaussiana de σ = 60) */
  function disco(c, x, y, R, sig, color, a) {
    var Rt = R + 3 * sig;
    var g = c.createRadialGradient(x, y, 0, x, y, Rt);
    var perfil = [[R - 2 * sig, 0.977], [R - sig, 0.84], [R, 0.5], [R + sig, 0.16], [R + 2 * sig, 0.023]];
    g.addColorStop(0, rgba(color, a * (R - 2 * sig > 0 ? 1 : 0.84)));
    for (var i = 0; i < perfil.length; i++) {
      if (perfil[i][0] > 0) g.addColorStop(perfil[i][0] / Rt, rgba(color, a * perfil[i][1]));
    }
    g.addColorStop(1, rgba(color, 0));
    c.fillStyle = g;
    c.fillRect(x - Rt, y - Rt, 2 * Rt, 2 * Rt);
  }

  /* progreso (0..1) de la deriva de cada mancha: 22, 28 y 34 s, ida y
     vuelta con ease-in-out, igual que la animación «deriva» de base.css */
  var DERIVA = [{ dur: 22, ret: 0 }, { dur: 28, ret: 6 }, { dur: 34, ret: 12 }];
  function deriva(t) {
    if (document.documentElement.getAttribute('data-anim') === 'calma') return [0, 0, 0];
    return DERIVA.map(function (d) {
      var ciclo = (t / 1000 + d.ret) / d.dur, n = Math.floor(ciclo), f = ciclo - n;
      return suave(n % 2 ? 1 - f : f);
    });
  }

  /* las tres manchas: mismas posiciones, tamaños, opacidades y deriva
     (22, 28 y 34 s, ida y vuelta) que en base.css */
  function orbes(c, t) {
    var h = S / 2, e3 = deriva(t);
    var lista = [
      { x: -h + 0.34 * S + 17 * V, y: -h + 0.33 * S + 17 * V, R: 17 * V, c: col.o1, a: 0.34, dur: 22, ret: 0 },
      { x: -h + 0.67 * S - 15 * V, y: -h + 0.67 * S - 15 * V, R: 15 * V, c: col.o2, a: 0.34, dur: 28, ret: 6 },
      { x: -h + 0.55 * S + 10 * V, y: -h + 0.40 * S + 10 * V, R: 10 * V, c: col.o3, a: 0.16, dur: 34, ret: 12 }
    ];
    for (var i = 0; i < lista.length; i++) {
      var o = lista[i], e = e3[i];
      var s = 1 + 0.14 * e;
      disco(c, o.x + 4 * V * e, o.y + 3 * V * e, o.R * s, 60 * s, o.c, o.a);
    }
  }

  var ultimoFondo = 0;
  function pintarFondo(t) {
    if (!lienzoF) return;
    var rehacer = sucio || global.innerWidth !== W || global.innerHeight !== H;
    if (rehacer) reconstruirFondo();
    /* con «efectos optimizados» el fondo se renueva 20 veces por segundo */
    if (ligero && !rehacer && t - ultimoFondo < PASO_LIGERO) return;
    ultimoFondo = t;
    var ang = global.Fondo && Fondo.angulos ? Fondo.angulos() : { a: 0, b: 0 };
    cf.setTransform(K, 0, 0, K, 0, 0);
    cf.save();
    cf.translate(W / 2, H / 2);
    cf.rotate(ang.a * RAD);
    cf.drawImage(texA, -D / 2, -D / 2, D, D);
    orbes(cf, t);
    cf.rotate(ang.b * RAD);
    cf.globalAlpha = 0.6;
    cf.drawImage(texB, -D / 2, -D / 2, D, D);
    cf.globalAlpha = 1;
    cf.restore();
  }

  /* =========================================================
     FOCOS A MEDIA RESOLUCIÓN
     Los nueve haces siguen calculándose en menu.js (su --n, su
     color, su ángulo); aquí solo se leen y se dibujan en un lienzo
     que vive DENTRO del contenedor de los focos, así que se muda
     con él al podio igual que antes. Cada haz se pinta una vez,
     ya desenfocado, y luego solo se coloca.
     ========================================================= */
  var lienzoL = null, cl = null, medidasFocos = null, focosLimpios = true;
  var SIG_FOCO = 22;

  function spriteHaz(color, w, h) {
    var m = 3 * SIG_FOCO, ancho = w + 2 * m;
    var t = document.createElement('canvas');
    t.width = Math.max(1, Math.round(ancho * K));
    t.height = Math.max(1, Math.round(h * K));
    var c = t.getContext('2d');
    c.setTransform(K, 0, 0, K, (w / 2 + m) * K, h * K);   // origen: pie del haz
    var g = c.createLinearGradient(0, 0, 0, -h);
    g.addColorStop(0, rgba(color, 1));
    g.addColorStop(0.42, rgba(color, 0.45));
    g.addColorStop(0.82, rgba(color, 0));
    g.addColorStop(1, rgba(color, 0));
    c.fillStyle = g;
    c.fillRect(-w / 2 - m, -h, ancho, h);
    /* bordes laterales suavizados como los deja un blur(22px) */
    c.globalCompositeOperation = 'destination-in';
    var x0 = -w / 2 - m, hz = c.createLinearGradient(x0, 0, x0 + ancho, 0);
    var s = SIG_FOCO, bordes = [[0, 0], [s, 0.023], [2 * s, 0.16], [3 * s, 0.5], [4 * s, 0.84], [5 * s, 0.977], [6 * s, 1]];
    bordes.forEach(function (b) {
      var p = Math.min(0.5, b[0] / ancho);
      hz.addColorStop(p, 'rgba(0,0,0,' + b[1] + ')');
      hz.addColorStop(1 - p, 'rgba(0,0,0,' + b[1] + ')');
    });
    c.fillStyle = hz;
    c.fillRect(x0, -h, ancho, h);
    return t;
  }

  function prepararFocos(cont, luces) {
    var Wc = cont.clientWidth, Hc = cont.clientHeight;
    if (!Wc || !Hc) return null;
    lienzoL.width = Math.max(1, Math.round(Wc * K));
    lienzoL.height = Math.max(1, Math.round(Hc * K));
    var w = 0.16 * Wc, h = 1.04 * Hc;
    var datos = [].map.call(luces, function (li) {
      var c = li.style.getPropertyValue('--c').trim();
      sonda.style.color = c;
      var rgb = (getComputedStyle(sonda).color.match(/[\d.]+/g) || [255, 255, 255]).map(Number);
      return {
        el: li,
        x: parseFloat(li.style.getPropertyValue('--x')) / 100 * Wc,
        r: parseFloat(li.style.getPropertyValue('--r')) || 0,
        sprite: spriteHaz(rgb.slice(0, 3).map(Math.round), w, h)
      };
    });
    return { Wc: Wc, Hc: Hc, w: w, h: h, m: 3 * SIG_FOCO, luces: datos };
  }

  /* latido del modo «vivo» (brillo 1 → 1,45 → 1 por compás, con los
     mismos desfases que las reglas nth-child de juegos.css) */
  function brillo(i, t) {
    var compas = parseFloat(document.documentElement.style.getPropertyValue('--compas')) || 0.54;
    var j = i + 1, ret = j % 3 === 0 ? compas / 4 : (j % 2 === 0 ? compas / 2 : 0);
    var f = ((t / 1000 - ret) % compas + compas) % compas / compas;
    return f < 0.45 ? 1 + 0.45 * suave(f / 0.45) : 1.45 - 0.45 * suave((f - 0.45) / 0.55);
  }

  function pintarFocos(t) {
    var cont = document.getElementById('focos');
    if (!cont) return;
    var luces = cont.querySelectorAll('i');
    if (!luces.length) return;                    // menu.js aún no los ha montado
    if (!lienzoL) {
      lienzoL = document.createElement('canvas');
      lienzoL.className = 'focosLienzo';
      cl = lienzoL.getContext('2d');
    }
    if (lienzoL.parentNode !== cont) cont.appendChild(lienzoL);

    var niveles = [], hay = false;
    for (var i = 0; i < luces.length; i++) {
      var n = parseFloat(luces[i].style.getPropertyValue('--n')) || 0;
      niveles.push(n);
      if (n > 0.002) hay = true;
    }
    var encendidos = cont.classList.contains('encendidos');
    if (!hay && !encendidos) {
      if (!focosLimpios) { cl.setTransform(1, 0, 0, 1, 0, 0); cl.clearRect(0, 0, lienzoL.width, lienzoL.height); focosLimpios = true; }
      return;
    }
    focosLimpios = false;
    if (!medidasFocos) medidasFocos = prepararFocos(cont, luces);
    var M = medidasFocos;
    if (!M) return;

    cl.setTransform(K, 0, 0, K, 0, 0);
    cl.clearRect(0, 0, M.Wc, M.Hc);
    var vivo = cont.classList.contains('vivo');
    for (var k = 0; k < M.luces.length; k++) {
      var L = M.luces[k], nk = niveles[k] || 0;
      var alfa = (0.10 + nk * 0.62) * (vivo ? brillo(k, t) : 1);
      cl.save();
      cl.translate(L.x, M.Hc * 1.08);
      cl.rotate(L.r * RAD);
      cl.scale(1, 0.22 + nk * 0.78);
      cl.globalAlpha = Math.min(1, alfa);
      cl.drawImage(L.sprite, -(M.w / 2 + M.m), -M.h, M.w + 2 * M.m, M.h);
      cl.restore();
    }
    /* el resplandor dorado de abajo (el ::after de .focos) */
    var nMedia = parseFloat(cont.style.getPropertyValue('--n')) || 0;
    var hs = Math.min(0.22 * M.Hc, 110);
    var g = cl.createLinearGradient(0, M.Hc, 0, M.Hc - hs);
    g.addColorStop(0, rgba(col.oro, 0.22));
    g.addColorStop(1, rgba(col.oro, 0));
    cl.globalAlpha = Math.min(1, 0.15 + nMedia * 0.5);
    cl.fillStyle = g;
    cl.fillRect(0, M.Hc - hs, M.Wc, hs);
    cl.globalAlpha = 1;
  }

  /* =========================================================
     CONTADOR DE FPS
     ========================================================= */
  var medidor = null, cuadros = 0, t0 = 0, anterior = 0, peor = 0;
  function contar(t) {
    if (!verFps) { if (medidor) medidor.hidden = true; anterior = 0; return; }
    if (!medidor) {
      medidor = document.createElement('div');
      medidor.className = 'medidorFps';
      document.body.appendChild(medidor);
    }
    medidor.hidden = false;
    if (anterior) { var d = t - anterior; if (d > peor) peor = d; }
    anterior = t;
    cuadros++;
    if (!t0) t0 = t;
    if (t - t0 >= 500) {
      var fps = cuadros * 1000 / (t - t0);
      var modos = [];
      if (media) modos.push('½ res');
      if (ligero) modos.push('optimizado');
      medidor.textContent = Math.round(fps) + ' fps · peor ' + Math.round(peor) + ' ms' +
        (modos.length ? ' · ' + modos.join(' + ') : ' · normal');
      medidor.classList.toggle('bajo', fps < 50);
      cuadros = 0; t0 = t; peor = 0;
    }
  }

  /* =========================================================
     Bucle único
     ========================================================= */
  function bucle(t) {
    if (media) {
      pintarFondo(t);
      pintarFocos(t);
    }
    contar(t);
    requestAnimationFrame(bucle);
  }

  function arrancar() {
    lienzoF = document.createElement('canvas');
    lienzoF.className = 'fondoLienzo';
    lienzoF.setAttribute('aria-hidden', 'true');
    cf = lienzoF.getContext('2d', { alpha: false });
    document.body.insertBefore(lienzoF, document.body.firstChild);
    colorDe('--bgA');                            // crea la sonda
    /* si cambia el tema, los colores del lienzo se vuelven a leer */
    try {
      new MutationObserver(function () { sucio = true; })
        .observe(document.documentElement, { attributes: true, attributeFilter: ['data-tema'] });
    } catch (e) {}
    global.addEventListener('resize', function () { sucio = true; }, { passive: true });
    requestAnimationFrame(bucle);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', arrancar);
  else arrancar();

  /* ---------- API ---------- */
  return {
    deteccion: deteccion,
    /* mediaRes(): consulta · mediaRes(v): cambia y lo guarda como elección manual */
    mediaRes: function (v) {
      if (v === undefined) return media;
      media = !!v;
      escribir(K_MEDIA, media ? '1' : '0');
      avisar();
      return media;
    },
    /* true mientras la media resolución la decida la detección automática */
    automatico: function () { return mediaGuardada() === null; },
    /* true mientras los efectos optimizados los decida la detección */
    automaticoLigero: function () { return ligeroGuardado() === null; },
    volverAutomatico: function () {
      escribir(K_MEDIA, null);
      escribir(K_LIGERO, null);
      media = deteccion.modesto;
      ligero = deteccion.modesto;
      avisar();
      return media;
    },
    ligero: function (v) {
      if (v === undefined) return ligero;
      ligero = !!v;
      escribir(K_LIGERO, ligero ? '1' : '0');
      avisar();
      return ligero;
    },
    /* para fondo.js: deriva de las manchas y cada cuánto se renueva el fondo */
    deriva: deriva,
    pasoLigero: PASO_LIGERO,
    fps: function (v) {
      if (v === undefined) return verFps;
      verFps = !!v;
      escribir(K_FPS, verFps ? '1' : '0');
      return verFps;
    }
  };

})(window);
