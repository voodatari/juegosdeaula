/* =========================================================
   Sonido · archivos propios del usuario
     click.wav        pulsación (37 ms)
     pasapalabra.mp3  pasapalabra del rosco
     acierto.mp3      acierto
     error.mp3        fallo
     titulo.mp3       música del menú (bucle)
     fondojugando.ogg música durante la partida (bucle)
     fin.mp3          música del podio

   La música viene ENCENDIDA de fábrica. Como los navegadores
   prohíben que un sonido arranque sin que el usuario haya
   tocado la página, si el primer intento se bloquea se deja
   armado un disparador: el primer clic o la primera tecla la
   ponen en marcha. En el aula eso ocurre en el primer segundo.

   El volumen NO se toca con desvanecimientos al arrancar: cada
   pista tiene su volumen fijo; el único cambio es la subida del
   33 % mientras se ve el marcador entre preguntas, que vuelve
   siempre a ese valor fijo y nunca al que hubiera en ese
   instante (así no se queda muda por acumular cambios).
   ========================================================= */
(function (global) {

  var RUTA = 'audio/';
  var K_MUS = 'trivialaula.musica';
  var K_SFX = 'trivialaula.efectos';
  var K_VOLM = 'trivialaula.volmusica';      // antiguo: solo movía la música de partida
  var K_VOLM2 = 'trivialaula.volgeneral';    // nuevo: volumen general de TODA la música
  var K_VOLS = 'trivialaula.volefectos';
  var K_SUBIR = 'trivialaula.subirmarcador';

  function guardado(k, pordefecto) {
    try {
      var v = localStorage.getItem(k);
      return v === null ? pordefecto : v === '1';
    } catch (e) { return pordefecto; }
  }
  function guardar(k, v) {
    try { localStorage.setItem(k, v ? '1' : '0'); } catch (e) {}
  }

  /* Si solo hay el ajuste antiguo (que valía 0,6 de fábrica y solo movía la
     música de partida), se traduce para que nada cambie de golpe:
     0,6 → 100 %, 0,3 → 50 %… */
  function volumenGeneral() {
    try {
      var nuevo = parseFloat(localStorage.getItem(K_VOLM2));
      if (!isNaN(nuevo)) return Math.min(1, Math.max(0, nuevo));
      var viejo = parseFloat(localStorage.getItem(K_VOLM));
      if (!isNaN(viejo)) return Math.min(1, Math.max(0, viejo / 0.6));
    } catch (e) {}
    return VOL_MUSICA_FABRICA;
  }

  function numero(k, pordefecto) {
    try {
      var v = parseFloat(localStorage.getItem(k));
      return isNaN(v) ? pordefecto : Math.min(1, Math.max(0, v));
    } catch (e) { return pordefecto; }
  }

  /* valores de fábrica (los que devuelve «Restaurar opciones») */
  var VOL_MUSICA_FABRICA = 0.6;
  var VOL_EFECTOS_FABRICA = 1;

  var musicaOn = guardado(K_MUS, true);      // ← encendida por defecto
  var sfxOn = guardado(K_SFX, true);
  /* Volumen general de la música (0..1). Multiplica TODAS las pistas, también
     la del título y la del podio, que antes lo ignoraban: por eso el
     deslizador no hacía nada en el menú. Al 100 % todo suena exactamente
     como sonaba hasta ahora con los valores de fábrica. */
  var volMusica = volumenGeneral();
  var volEfectos = numero(K_VOLS, VOL_EFECTOS_FABRICA);
  /* Subir la música mientras se ve el marcador entre preguntas: da
     subidón y no molesta, así que viene ENCENDIDO de fábrica. */
  var subirOn = guardado(K_SUBIR, true);
  /* Mientras dura el marcador la música de partida sube bastante: ×2,4
     (unos +7,6 dB, al oído algo más de una vez y media más fuerte). Con
     un tope: nunca llega al volumen de la música del menú (se queda como
     mucho en el 80 % de esa pista). */
  var SUBIDA = 2.4;
  var TOPE_SUBIDA = 0.8;

  /* ---------------- efectos cortos ---------------- */
  var SFX = {
    click: { archivo: 'click.wav', vol: 0.55 },
    ok:    { archivo: 'acierto.mp3', vol: 0.85 },
    no:    { archivo: 'error.mp3', vol: 0.75 },
    pasa:  { archivo: 'pasapalabra.mp3', vol: 0.8 }
  };
  Object.keys(SFX).forEach(function (n) {
    var s = SFX[n];
    s.copias = [new Audio(RUTA + s.archivo)];
    s.copias[0].preload = 'auto';
    s.copias[0].volume = s.vol * volEfectos;
    s.i = 0;
  });

  function aplicarVolEfectos() {
    Object.keys(SFX).forEach(function (n) {
      SFX[n].copias.forEach(function (c) { c.volume = SFX[n].vol * volEfectos; });
    });
  }

  /* Varias copias por efecto: dos aciertos seguidos no se cortan. */
  function suena(nombre) {
    if (!sfxOn) return;
    var s = SFX[nombre];
    if (!s) return;
    try {
      if (s.copias.length < 3) {
        var c = new Audio(RUTA + s.archivo);
        c.volume = s.vol * volEfectos;
        s.copias.push(c);
      }
      var a = s.copias[s.i++ % s.copias.length];
      a.volume = s.vol * volEfectos;
      a.currentTime = 0;
      var p = a.play();
      if (p && p.catch) p.catch(function () {});
    } catch (e) {}
  }

  /* Efecto «revelar»: no hay archivo, se sintetiza (200 ms). */
  var AC = null;
  function revelar() {
    if (!sfxOn) return;
    try {
      AC = AC || new (global.AudioContext || global.webkitAudioContext)();
      if (AC.state === 'suspended') AC.resume();
      var t = AC.currentTime;
      var o = AC.createOscillator(), g = AC.createGain();
      o.type = 'triangle';
      o.frequency.setValueAtTime(420, t);
      o.frequency.exponentialRampToValueAtTime(1180, t + 0.18);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.12, t + 0.03);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
      o.connect(g); g.connect(AC.destination);
      o.start(t); o.stop(t + 0.24);
    } catch (e) {}
  }

  /* ---------------- música ---------------- */
  /* Cada pista tiene su nivel propio y el volumen general los escala a
     todos. El título y el podio van a tope; la de partida, bastante más
     baja para que no tape a nadie (0,18 = lo que sonaba antes de fábrica). */
  var PISTAS = {
    titulo: { archivo: 'titulo.mp3', vol: 1, bucle: true },
    juego:  { archivo: 'fondojugando.ogg', vol: 0.18, bucle: true },
    fin:    { archivo: 'fin.mp3', vol: 1, bucle: false }   // el final, a tope
  };

  function volumenDe(nombre) {
    var p = PISTAS[nombre];
    return p.vol * volMusica;
  }
  var elementos = {};
  var actual = null;          // nombre de la pista elegida
  var armado = false;         // ya hay disparador esperando un gesto

  function elemento(nombre) {
    if (elementos[nombre]) return elementos[nombre];
    var p = PISTAS[nombre];
    var a = new Audio(RUTA + p.archivo);
    a.loop = p.bucle;
    a.volume = volumenDe(nombre);
    a.preload = 'none';
    elementos[nombre] = a;
    return a;
  }

  function parar(nombre) {
    var a = elementos[nombre];
    if (!a) return;
    try { a.pause(); a.currentTime = 0; } catch (e) {}
  }

  /* Intenta reproducir. Si el navegador lo bloquea, arma el
     disparador para el primer gesto del usuario. */
  function reproducir(sinVolumen) {
    if (!actual || !musicaOn) return;
    var a = elemento(actual);
    if (!sinVolumen) a.volume = volumenDe(actual);
    engancharAnalisis(a);
    /* La música pasa por el analizador de los focos (Web Audio). Chrome
       crea ese «contexto de audio» dormido si aún no ha habido ningún
       clic, y NO lo despierta solo: el <audio> se pone en marcha pero
       no se oye nada. Hay que despertarlo aquí, dentro del gesto. */
    despertarContexto();
    var pr;
    try { pr = a.play(); } catch (e) { armar(); return; }
    if (pr && pr.then) {
      pr.then(function () {
        /* sonando, pero con el contexto aún dormido = en silencio:
           se espera al siguiente clic para despertarlo */
        if (ACgraf && ACgraf.state === 'suspended') armar();
      }, function () { armar(); });
    }
  }

  function despertarContexto() {
    if (ACgraf && ACgraf.state === 'suspended') {
      try { var r = ACgraf.resume(); if (r && r.catch) r.catch(function () {}); } catch (e) {}
    }
  }

  /* Aviso flotante mientras el navegador no deja sonar la música.
     Desaparece con el primer clic o la primera tecla. */
  function aviso(mostrar) {
    var el = document.getElementById('avisoSonido');
    if (mostrar) {
      if (!el) {
        el = document.createElement('div');
        el.id = 'avisoSonido';
        el.className = 'aviso-sonido';
        el.innerHTML = '🔈 Pulsa en cualquier sitio para que empiece la música';
        document.body.appendChild(el);
      }
      requestAnimationFrame(function () { el.classList.add('ver'); });
    } else if (el) {
      el.classList.remove('ver');
      setTimeout(function () { if (el.parentNode) el.remove(); }, 400);
    }
  }

  function armar() {
    if (armado) return;
    armado = true;
    if (musicaOn) setTimeout(function () { if (armado) aviso(true); }, 600);
    var disparar = function () {
      quitar();
      aviso(false);
      despertarContexto();
      if (musicaOn) reproducir();
    };
    var quitar = function () {
      armado = false;
      ['pointerdown', 'keydown', 'touchstart', 'click'].forEach(function (ev) {
        global.removeEventListener(ev, disparar, true);
      });
    };
    ['pointerdown', 'keydown', 'touchstart', 'click'].forEach(function (ev) {
      global.addEventListener(ev, disparar, true);
    });
  }

  /* Fundido lineal de volumen sobre un elemento de audio. */
  function fundir(a, destino, ms, alAcabar) {
    if (!a) { if (alAcabar) alAcabar(); return; }
    var ini = a.volume, t0 = performance.now();
    (function paso(t) {
      var k = Math.min(1, (t - t0) / ms);
      try { a.volume = Math.max(0, Math.min(1, ini + (destino - ini) * k)); } catch (e) {}
      if (k < 1) requestAnimationFrame(paso);
      else if (alAcabar) alAcabar();
    })(t0);
  }

  /* Cambia de pista bajando la anterior y subiendo la nueva:
     del título a tope al fondo de partida sin cortes. */
  function tema(nombre) {
    if (!PISTAS[nombre]) return;
    if (actual === nombre) { reproducir(); return; }
    var antes = actual, viejo = antes && elementos[antes];
    actual = nombre;
    if (viejo && !viejo.paused) {
      fundir(viejo, 0, 650, function () { try { viejo.pause(); viejo.currentTime = 0; } catch (e) {} });
      var nuevo = elemento(nombre);
      nuevo.volume = 0;
      reproducir(true);
      fundir(nuevo, volumenDe(nombre), 900);
    } else {
      if (antes) parar(antes);
      reproducir();
    }
  }

  /* Sube la música un tercio mientras se ve el marcador entre preguntas
     y la devuelve a su volumen propio al cerrarlo. Los cambios son
     rápidos pero con fundido, nunca de golpe. */
  var subido = false;
  function volSubido() {
    return Math.min(1, volumenDe(actual) * SUBIDA, volumenDe('titulo') * TOPE_SUBIDA);
  }
  function subirMarcador(activar) {
    if (!musicaOn || !actual) { subido = !!activar && subido; return; }
    var a = elementos[actual];
    if (!a || a.paused) return;
    if (activar && !subido) {
      subido = true;
      fundir(a, volSubido(), 320);
    } else if (!activar && subido) {
      subido = false;
      fundir(a, volumenDe(actual), 320);
    }
  }

  /* ---------------- análisis de graves (focos del título) ----------------
     En iPhone/iPad no se engancha: enrutar el <audio> por Web Audio deja
     el sonido mudo en algunos iOS. Allí los focos van solo por compás. */
  var esIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
              (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  var ACgraf = null, analizador = null, datosFrec = null, enganchados = {};

  function engancharAnalisis(a) {
    if (esIOS || !a || enganchados[a.src]) return;
    try {
      ACgraf = ACgraf || new (global.AudioContext || global.webkitAudioContext)();
      if (ACgraf.state === 'suspended') ACgraf.resume();
      var fuente = ACgraf.createMediaElementSource(a);
      analizador = analizador || ACgraf.createAnalyser();
      analizador.fftSize = 512;
      analizador.smoothingTimeConstant = 0.55;
      analizador.minDecibels = -85;
      analizador.maxDecibels = -18;
      datosFrec = datosFrec || new Uint8Array(analizador.frequencyBinCount);
      fuente.connect(analizador);
      analizador.connect(ACgraf.destination);
      enganchados[a.src] = true;
    } catch (e) { /* si algo falla se sigue sin análisis */ }
  }

  var ALTAVOZ = '<path d="M4 9.5h3.2L12 5.2v13.6l-4.8-4.3H4z" fill="currentColor"/>';
  var ALTAVOZ_ON = '<svg class="ic-altavoz" viewBox="0 0 24 24" aria-hidden="true">' + ALTAVOZ +
    '<path d="M15.2 9.2a4 4 0 0 1 0 5.6M17.6 6.8a7.4 7.4 0 0 1 0 10.4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
  var ALTAVOZ_OFF = '<svg class="ic-altavoz" viewBox="0 0 24 24" aria-hidden="true">' + ALTAVOZ +
    '<path d="M15.5 9.5l5 5M20.5 9.5l-5 5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';

  var API = {
    click:   function () { suena('click'); },
    /* nivel de graves 0..1 del tema que esté sonando */
    graves: function () {
      if (!analizador || !datosFrec) return -1;          // -1 = no hay análisis
      analizador.getByteFrequencyData(datosFrec);
      var s = 0, n = 0;
      for (var i = 1; i < 10; i++) { s += datosFrec[i]; n++; }
      return Math.min(1, (s / n) / 165);
    },

    /* Espectro repartido en n bandas, de graves (0) a agudos (n-1).
       Devuelve null si el navegador no deja analizar el audio. */
    espectro: function (n) {
      if (!analizador || !datosFrec) return null;
      analizador.getByteFrequencyData(datosFrec);
      var bins = datosFrec.length;                       // 256 con fftSize 512
      var salida = [], tope = Math.floor(bins * 0.72);   // lo de más arriba casi no suena
      for (var b = 0; b < n; b++) {
        /* bandas repartidas en escala logarítmica, como un ecualizador */
        var i0 = Math.floor(Math.pow(b / n, 1.9) * tope) + 1;
        var i1 = Math.max(i0 + 1, Math.floor(Math.pow((b + 1) / n, 1.9) * tope) + 1);
        /* el máximo de la banda se mueve mucho más que la media: es lo que
           hace que un analizador parezca vivo */
        var m = 0, c = 0;
        for (var i = i0; i < i1 && i < bins; i++) { if (datosFrec[i] > m) m = datosFrec[i]; c++; }
        salida.push(c ? m / 255 : 0);
      }
      return salida;
    },
    sonando: function () {
      var a = actual && elementos[actual];
      return !!a && !a.paused;
    },
    ok:      function () { suena('ok'); },
    pasa:    function () { suena('pasa'); },
    no:      function () { suena('no'); },
    revelar: function () { revelar(); },
    /* el marcador entre preguntas sube la música mientras está abierto */
    subirMarcador: function (v) { if (subirOn) subirMarcador(v); },
    tema:    tema,

    /* Podio: corta la música de partida y pone el tema final. */
    final: function () {
      if (actual) parar(actual);
      actual = 'fin';
      reproducir();
    },

    alternarMusica: function () {
      musicaOn = !musicaOn;
      guardar(K_MUS, musicaOn);
      if (musicaOn) reproducir(); else { aviso(false); if (actual) parar(actual); }
      return musicaOn;
    },
    alternarSfx: function () {
      sfxOn = !sfxOn;
      guardar(K_SFX, sfxOn);
      if (sfxOn) suena('click');
      return sfxOn;
    },
    get musicaEncendida() { return musicaOn; },
    get sfxEncendido() { return sfxOn; },
    get volumenMusica() { return volMusica; },
    get volumenEfectos() { return volEfectos; },
    get subirEncendido() { return subirOn; },
    alternarSubir: function () {
      subirOn = !subirOn;
      guardar(K_SUBIR, subirOn);
      if (!subirOn) subirMarcador(false);
      return subirOn;
    },

    /* Volúmenes 0..1. Se guardan y se aplican al instante. */
    ponerVolumenMusica: function (v) {
      volMusica = Math.min(1, Math.max(0, +v || 0));
      try { localStorage.setItem(K_VOLM2, volMusica); } catch (e) {}
      if (actual && elementos[actual]) {
        elementos[actual].volume = subido ? volSubido() : volumenDe(actual);
      }
      return volMusica;
    },
    ponerVolumenEfectos: function (v) {
      volEfectos = Math.min(1, Math.max(0, +v || 0));
      try { localStorage.setItem(K_VOLS, volEfectos); } catch (e) {}
      aplicarVolEfectos();
      return volEfectos;
    },
    probarEfecto: function () { suena('ok'); },

    /* «Restaurar opciones»: música y efectos encendidos, música al 60 %,
       efectos al 100 % y la subida del marcador activada */
    restaurar: function () {
      subirOn = true; guardar(K_SUBIR, true);
      sfxOn = true; guardar(K_SFX, true);
      API.ponerVolumenEfectos(VOL_EFECTOS_FABRICA);
      API.ponerVolumenMusica(VOL_MUSICA_FABRICA);
      if (!musicaOn) { musicaOn = true; guardar(K_MUS, true); reproducir(); }
      API.pintarBotones();
    },

    /* Pinta y conecta TODOS los chips de música y efectos de la página
       (hay uno por vista, y los tres deben decir lo mismo). */
    pintarBotones: function () {
      [].slice.call(document.querySelectorAll('.js-mus')).forEach(function (m) {
        m.classList.toggle('on', musicaOn);
        m.textContent = '♪';
        m.title = musicaOn ? 'Música: encendida' : 'Música: apagada';
      });
      [].slice.call(document.querySelectorAll('.js-sfx')).forEach(function (s) {
        s.classList.toggle('on', sfxOn);
        /* el altavoz se dibuja (no es un emoji) para que tome el mismo
           color que la nota ♪ del botón de la música */
        s.innerHTML = sfxOn ? ALTAVOZ_ON : ALTAVOZ_OFF;
        s.title = sfxOn ? 'Efectos de sonido: encendidos' : 'Efectos de sonido: apagados';
      });
    },
    conectarBotones: function () {
      [].slice.call(document.querySelectorAll('.js-mus')).forEach(function (m) {
        m.onclick = function () { API.alternarMusica(); API.pintarBotones(); };
      });
      [].slice.call(document.querySelectorAll('.js-sfx')).forEach(function (s) {
        s.onclick = function () { API.alternarSfx(); API.pintarBotones(); };
      });
      API.pintarBotones();
    },

    /* Para diagnosticar desde la consola del navegador. */
    estado: function () {
      var a = actual && elementos[actual];
      return {
        pista: actual, musica: musicaOn, efectos: sfxOn, esperandoGesto: armado, subirMarcador: subirOn,
        volMusica: volMusica, volEfectos: volEfectos,
        sonando: !!a && !a.paused, volumen: a ? a.volume : null,
        segundo: a ? Math.round(a.currentTime) : null,
        error: a && a.error ? a.error.code : null
      };
    }
  };

  global.Sonido = API;

})(window);
