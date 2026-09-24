/* =========================================================
   Trivial por equipos
   Los equipos que haya (de 1 a 4, se elige antes de jugar)
   contestan cada pregunta tipo test por turnos; al contestar el
   último se revela y los puntos se suman solos. Las de respuesta
   escrita las puntúa el maestro.

   El banco manda: puede traer solo test, solo escritas o
   cualquier mezcla, y el juego se adapta (la cabecera cuenta
   sobre el total real y la etiqueta cambia sola).
   ========================================================= */
window.JuegoTrivial = (function () {

  var $ = function (id) { return document.getElementById(id); };
  var TODOS = [
    { n: 'Equipo 1', c: '#4C8DFF' }, { n: 'Equipo 2', c: '#FF8A3D' },
    { n: 'Equipo 3', c: '#2BC4B4' }, { n: 'Equipo 4', c: '#FF5D73' }
  ];
  var COLOP = ['#FF5D73', '#2BC4B4', '#F5C518', '#8B7CF6'];

  /* Cuántos equipos juegan (1–4). Lo elige el maestro en la pantalla
     del banco y aquí se ajusta todo: marcador, casillas de turno,
     botones de punto y teclas. */
  var EQUIPOS = TODOS.slice(0);
  var NEQ = 4;

  var Q = [], TITULO = '';
  var i = 0, turno = 0;
  var elige = [], puntos = [], rachas = [], dados = [];
  var revelado = false, resolviendo = false, acabado = false, marcadorVisto = false;

  /* Marcador entre preguntas: se puede apagar en Aspecto → Pantalla.
     Apagado, los puntos se suman igual y se pasa de pregunta sin pausa. */
  var K_MARC = 'trivialaula.marcadores';
  var marcadoresOn = (function () {
    try { return localStorage.getItem(K_MARC) !== '0'; } catch (e) { return true; }
  })();
  function marcadores(v) {
    if (v === undefined) return marcadoresOn;
    marcadoresOn = !!v;
    try { localStorage.setItem(K_MARC, marcadoresOn ? '1' : '0'); } catch (e) {}
    return marcadoresOn;
  }
  var activo = false, tableroHecho = false;

  function repetir(v) { return EQUIPOS.map(function () { return v; }); }

  function escapar(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  /* ---------------- carga ---------------- */
  function iniciar(idBanco) {
    activo = true;
    acabado = false;
    NEQ = Store.equipos('trivial');
    EQUIPOS = TODOS.slice(0, NEQ);
    tableroHecho = false;              // puede haber cambiado el nº de equipos
    $('cargando').classList.remove('oculto');
    $('cargando').innerHTML = '<div class="spinner"></div><div>Cargando las preguntas…</div>';

    return Store.banco(idBanco).then(function (b) {
      var v = Store.validar('trivial', b);
      if (!v.ok) throw new Error('El banco tiene errores: ' + v.errores[0]);
      TITULO = b.titulo;
      Q = (b.test || []).map(function (p) { return { t: 'm', q: p.q, o: p.o, c: p.c }; })
        .concat((b.escritas || []).map(function (p) { return { t: 'w', q: p.q, a: p.a }; }));
      if (!Q.length) throw new Error('El banco no tiene preguntas.');

      $('titulo').textContent = TITULO;
      $('subtitulo').textContent = (b.test || []).length + ' test + ' +
        (b.escritas || []).length + ' escritas';
      $('cargando').classList.add('oculto');

      i = 0; puntos = repetir(0); rachas = repetir(0);
      construirTablero();
      pintar();
    }).catch(function (err) {
      $('cargando').innerHTML =
        '<div style="text-align:center;max-width:520px;line-height:1.5">' +
        '<div style="font-size:42px">😕</div>' +
        '<h2 style="margin:10px 0">No he podido cargar las preguntas</h2>' +
        '<p style="opacity:.85;font-size:14px">' + escapar(err.message) + '</p>' +
        '<p style="margin-top:16px"><button class="chip js-menu-err">← Volver al menú</button></p></div>';
      var b = $('cargando').querySelector('.js-menu-err');
      if (b) b.onclick = function () { App.ir('menu'); };
    });
  }

  function salir() { activo = false; cerrarCapa(); }

  /* ---------------- tablero ---------------- */
  function construirTablero() {
    if (tableroHecho) return;
    /* las tres rejillas se reparten entre los equipos que haya */
    ['marcador', 'turnos', 'premios'].forEach(function (id) {
      var e = $(id);
      if (e) e.style.setProperty('--neq', NEQ);
    });
    $('atajosTrivial').innerHTML =
      '<kbd>A</kbd><kbd>B</kbd><kbd>C</kbd><kbd>D</kbd> responder · ' +
      '<kbd>←</kbd><kbd>→</kbd> navegar · ' +
      (NEQ === 1 ? '<kbd>1</kbd>' : '<kbd>1</kbd>–<kbd>' + NEQ + '</kbd>') +
      ' dar punto en las escritas';
    $('marcador').innerHTML = EQUIPOS.map(function (t, k) {
      return '<div class="eq" id="eq' + k + '" style="--c:' + t.c + '">' +
        '<input class="nm" id="nm' + k + '" value="' + escapar(t.n) + '" ' +
          'maxlength="20" spellcheck="false" autocomplete="off" ' +
          'title="Pulsa para cambiar el nombre del equipo">' +
        '<span class="der"><span class="pt" id="pt' + k + '">0</span></span>' +
        '<span class="racha" id="ra' + k + '"></span></div>';
    }).join('');
    $('turnos').innerHTML = EQUIPOS.map(function (t, k) {
      return '<div class="casilla" id="ca' + k + '" style="--c:' + t.c + '">' +
        '<div class="lb" id="lb' + k + '">' + escapar(t.n) + '</div>' +
        '<div class="ans" id="an' + k + '">—</div></div>';
    }).join('');
    EQUIPOS.forEach(function (_, k) { conectarNombre(k); });
    tableroHecho = true;
  }

  /* Cambiar el nombre de un equipo desde el marcador. Mientras se
     escribe, las teclas del juego no actúan: el manejador de teclado
     ignora lo que se teclea dentro de un INPUT. El nombre se guarda en
     TODOS, así que se mantiene aunque cambie el número de equipos. */
  function conectarNombre(k) {
    var campo = $('nm' + k);
    if (!campo) return;
    campo.addEventListener('focus', function () { this.select(); });
    campo.addEventListener('input', function () {
      EQUIPOS[k].n = this.value;
      var lb = $('lb' + k);
      if (lb) lb.textContent = this.value;
    });
    campo.addEventListener('keydown', function (e) {
      e.stopPropagation();                      // que no llegue al juego
      if (e.key === 'Enter' || e.key === 'Escape') { e.preventDefault(); this.blur(); }
    });
    campo.addEventListener('blur', function () {
      var v = this.value.trim();
      if (!v) v = 'Equipo ' + (k + 1);
      EQUIPOS[k].n = v;
      this.value = v;
      var lb = $('lb' + k);
      if (lb) lb.textContent = v;
    });
  }

  function refrescarMarcador() {
    EQUIPOS.forEach(function (_, k) {
      var pt = $('pt' + k);
      if (pt && pt.textContent !== String(puntos[k])) pt.textContent = puntos[k];
      var ra = $('ra' + k);
      if (ra) ra.textContent = rachas[k] >= 2 ? '🔥 ' + rachas[k] + ' seguidas' : '';
      var e = $('eq' + k);
      if (e) e.classList.toggle('turno', !!Q[i] && Q[i].t === 'm' && k === turno && elige[k] === null);
    });
  }

  function refrescarTurnos() {
    var q = Q[i];
    if (!q) return;
    EQUIPOS.forEach(function (_, k) {
      var val = q.t === 'm' ? (elige[k] === null ? '—' : elige[k]) : (dados[k] ? '+1' : '—');
      var an = $('an' + k);
      if (an && an.textContent !== val) an.textContent = val;
      var c = $('ca' + k);
      if (!c) return;
      c.classList.toggle('puesta', q.t === 'm' ? elige[k] !== null : dados[k]);
      c.classList.toggle('activa', q.t === 'm' && elige[k] === null && k === turno);
    });
  }

  /* ---------------- pintar pregunta ---------------- */
  function pintar() {
    var q = Q[i];
    resolviendo = false;
    turno = 0; elige = repetir(null); dados = repetir(false); revelado = false; marcadorVisto = false;

    $('numpreg').textContent = 'PREGUNTA ' + (i + 1) + ' / ' + Q.length;
    $('barra').style.width = ((i + 1) / Q.length * 100) + '%';
    $('pregunta').textContent = q.q;
    FX.repetir($('pregunta'), 'reanim');

    if (q.t === 'm') {
      $('etiqueta').className = 'etiqueta test';
      $('etiqueta').textContent = 'OPCIÓN MÚLTIPLE';
      $('opciones').classList.remove('oculto');
      $('zonaEscrita').classList.add('oculto');
      $('opciones').innerHTML = q.o.map(function (v, k) {
        return '<button class="op entra" style="--oc:' + COLOP[k] + ';animation-delay:' + (k * 55) + 'ms" ' +
          'data-k="' + 'ABCD'[k] + '"><span class="k">' + 'ABCD'[k] + '</span>' +
          '<span class="v">' + escapar(v) + '</span><span class="marcas"></span></button>';
      }).join('');
      [].slice.call($('opciones').children).forEach(function (b) {
        b.onclick = function () { elegir(b.dataset.k, b); };
        /* en cuanto termina la entrada se quita la clase: si se quedara,
           cualquier animación posterior la relanzaría y la opción volvería
           a aparecer desde cero */
        b.addEventListener('animationend', function () { b.classList.remove('entra'); }, { once: true });
      });
      $('siguiente').textContent = 'Siguiente →';
    } else {
      $('etiqueta').className = 'etiqueta escrita';
      $('etiqueta').textContent = 'RESPUESTA ESCRITA';
      $('opciones').classList.add('oculto');
      $('zonaEscrita').classList.remove('oculto');
      $('pista').textContent = 'PULSA «MOSTRAR RESPUESTA»';
      ponerSolucion(q.a);
      $('premios').innerHTML = EQUIPOS.map(function (t, k) {
        return '<button class="premio" id="pr' + k + '" style="--c:' + t.c + '" disabled>' +
          escapar(t.n) + '<br>+1 punto</button>';
      }).join('');
      EQUIPOS.forEach(function (_, k) { $('pr' + k).onclick = function () { premiar(k); }; });
      $('siguiente').textContent = 'Mostrar respuesta 👁';
      $('solucion').onclick = function () { if (!revelado) siguiente(); };
    }
    refrescarTurnos();
    refrescarMarcador();
  }

  /* Cambia la solución escrita sin que se llegue a leer:
     1) se desvanece la anterior, 2) con el hueco vacío se pone el texto
     nuevo y se activa el desenfoque de golpe, 3) reaparece ya borroso. */
  function ponerSolucion(texto) {
    var sol = $('solucion'), val = $('valor');
    sol.classList.add('cambiando');
    clearTimeout(sol._cambio);
    sol._cambio = setTimeout(function () {
      val.textContent = texto;
      sol.classList.add('tapada');
      void val.offsetWidth;                 // el desenfoque se aplica ya
      requestAnimationFrame(function () { sol.classList.remove('cambiando'); });
    }, 140);
  }

  /* ---------------- responder ---------------- */
  function elegir(letra, btn) {
    if (resolviendo || elige[turno] !== null) return;
    Sonido.click();
    /* La opción se queda MARCADA y da un latido corto. Nada de
       animaciones que toquen la opacidad: eso hacía que pareciera
       que la opción desaparecía y volvía a aparecer. */
    btn.classList.remove('entra');
    btn.classList.add('elegida');
    FX.repetir(btn, 'late', 600);
    var marcas = btn.querySelector('.marcas');
    if (marcas) marcas.insertAdjacentHTML('beforeend', '<i style="--m:' + EQUIPOS[turno].c + '"></i>');
    elige[turno] = letra;
    if (turno < NEQ - 1) {
      turno++;                    // primero pasa el turno...
      refrescarTurnos();          // ...y luego se pinta, para que la casilla
      refrescarMarcador();        // del equipo siguiente quede flotando
    } else {
      refrescarTurnos();
      refrescarMarcador();
      resolviendo = true;
      setTimeout(resultados, 420);
    }
  }

  function resultados() {
    var q = Q[i], aciertos = 0;
    [].slice.call($('opciones').children).forEach(function (b) {
      b.setAttribute('disabled', '');
      b.classList.add(b.dataset.k === q.c ? 'buena' : 'mala');
    });

    var filas = EQUIPOS.map(function (t, k) {
      var bien = elige[k] === q.c;
      if (bien) { puntos[k]++; aciertos++; rachas[k]++; } else { rachas[k] = 0; }
      return '<div class="fila-r ' + (bien ? 'si' : 'no') + '" style="animation-delay:' +
        (k * 0.1 + 0.18) + 's"><span>' + escapar(t.n) + (bien && rachas[k] >= 2 ? ' 🔥' + rachas[k] : '') +
        '</span><span class="r">' + (elige[k] || '—') + ' ' + (bien ? '✔' : '✘') + '</span></div>';
    }).join('');

    setTimeout(function () { aciertos ? Sonido.ok(2000) : Sonido.no(1600); }, 420);
    refrescarMarcador();
    EQUIPOS.forEach(function (_, k) {
      if (elige[k] === q.c) {
        var e = $('eq' + k);
        FX.repetir(e, 'sube', 500);
        FX.flotante(e, '+1');
      }
    });
    /* sin marcador: la pregunta se queda con la buena en verde y el
       maestro pasa a la siguiente cuando quiera */
    if (!marcadoresOn) return;

    /* El marcador NO se cierra solo: lo cierra el maestro cuando ha
       terminado de comentar la pregunta con la clase. */
    abrirCapa(
      '<h2>' + (aciertos ? '¡Muy bien! 🎉' : '¡Casi! 💪') + '</h2>' +
      '<div class="sub">La respuesta correcta era <b>' + q.c + '</b> · ' +
      escapar(q.o['ABCD'.indexOf(q.c)]) + '</div>' +
      '<div class="filas">' + filas + '</div>' +
      '<div class="capa-pie">' +
      '<button class="btn" id="capaCerrar">Cerrar</button>' +
      '<button class="btn principal" id="capaSeguir">' +
      (i < Q.length - 1 ? 'Siguiente pregunta →' : 'Ver resultados 🏆') + '</button></div>', true);

    $('capaCerrar').onclick = function () { Sonido.click(); cerrarCapa(); };
    $('capaSeguir').onclick = function () { cerrarCapa(); siguiente(); };

    /* un puñado de confeti, lo justo para celebrar sin tapar el marcador
       (se puede apagar del todo en Aspecto) */
    if (aciertos) setTimeout(function () { FX.fiesta(10 + aciertos * 6); }, 240);
  }

  /* ---------------- respuesta escrita ---------------- */
  function premiar(k) {
    if (dados[k] || $('pr' + k).disabled) return;
    dados[k] = true; puntos[k]++;
    Sonido.ok(1200);
    $('pr' + k).classList.add('dado');
    refrescarMarcador(); refrescarTurnos();
    var e = $('eq' + k);
    FX.repetir(e, 'sube', 500);
    FX.flotante(e, '+1');
    FX.desde(e, 14);
  }

  /* ---------------- navegación ---------------- */
  function siguiente() {
    var q = Q[i];
    if (!q) return;
    if (q.t === 'w' && !revelado) {
      revelado = true;
      Sonido.revelar();
      $('solucion').classList.remove('tapada');
      $('pista').textContent = 'RESPUESTA CORRECTA';
      EQUIPOS.forEach(function (_, k) { $('pr' + k).disabled = false; });
      $('siguiente').textContent = 'Siguiente →';
      FX.desde($('solucion'), 10);
      return;
    }
    /* en las escritas, al pasar de pregunta sale el mismo marcador que en
       las de test (una sola vez por pregunta) */
    if (q.t === 'w' && marcadoresOn && !marcadorVisto) {
      marcadorVisto = true;
      Sonido.click();
      resultadosEscrita();
      return;
    }
    if (i < Q.length - 1) { Sonido.click(); i++; pintar(); } else final();
  }

  function resultadosEscrita() {
    var q = Q[i], aciertos = 0;
    /* clasificación: los equipos ordenados por su puntuación TOTAL; los
       que han sumado en esta pregunta van en verde con su +1 */
    var orden = EQUIPOS.map(function (t, k) {
      if (dados[k]) aciertos++;
      return { n: t.n, p: puntos[k], k: k, suma: dados[k] };
    }).sort(function (a, b) { return b.p - a.p || a.k - b.k; });
    var filas = orden.map(function (t, pos) {
      return '<div class="fila-r ' + (t.suma ? 'si' : 'no') + '" style="animation-delay:' +
        (pos * 0.1 + 0.18) + 's"><span>' + (pos + 1) + 'º · ' + escapar(t.n) +
        (t.suma ? ' <small class="mas">+1</small>' : '') + '</span>' +
        '<span class="r">' + t.p + (t.p === 1 ? ' punto' : ' puntos') + '</span></div>';
    }).join('');
    abrirCapa(
      '<h2>' + (aciertos ? '¡Muy bien! 🎉' : '¡Casi! 💪') + '</h2>' +
      '<div class="sub">La respuesta correcta era <b>' + escapar(q.a) + '</b></div>' +
      '<div class="filas">' + filas + '</div>' +
      '<div class="capa-pie">' +
      '<button class="btn" id="capaCerrar">Cerrar</button>' +
      '<button class="btn principal" id="capaSeguir">' +
      (i < Q.length - 1 ? 'Siguiente pregunta →' : 'Ver resultados 🏆') + '</button></div>', true);
    $('capaCerrar').onclick = function () { Sonido.click(); cerrarCapa(); };
    $('capaSeguir').onclick = function () { cerrarCapa(); siguiente(); };
    if (aciertos) setTimeout(function () { FX.fiesta(10 + aciertos * 6); }, 240);
  }
  function anterior() { if (i > 0) { Sonido.click(); i--; pintar(); } }

  function final() {
    if (acabado) return;
    acabado = true;
    Sonido.final();
    $('capa').classList.add('podio');      // enciende los focos del escenario
    FX.fiesta(55);
    arrancarFiesta();
    var orden = EQUIPOS.map(function (t, k) { return { n: t.n, p: puntos[k] }; })
      .sort(function (a, b) { return b.p - a.p; });
    var max = orden[0].p;
    abrirCapa('<h2>🏆 ¡Fin del trivial!</h2>' +
      '<div class="sub">' + escapar(TITULO) + '</div>' +
      '<div class="filas">' + orden.map(function (t, k) {
        return '<div class="fila-r ' + (t.p === max ? 'si' : 'no') + '" style="animation-delay:' +
          (k * 0.13) + 's"><span>' + ['🥇', '🥈', '🥉', '　'][k] + ' ' + escapar(t.n) +
          '</span><span class="r">' + t.p + ' pts</span></div>';
      }).join('') + '</div>' +
      '<div class="capa-pie">' +
      '<button class="btn" id="finMenu">← Menú principal</button>' +
      '<button class="btn principal" id="finOtro">Elegir otro banco de preguntas</button></div>');
    $('finMenu').onclick = function () { cerrarCapa(); App.ir('menu'); };
    $('finOtro').onclick = function () { cerrarCapa(); App.ir('menu', 'trivial'); };
  }

  /* ---------------- capa ---------------- */
  function abrirCapa(html, marcador) {
    $('cajaTexto').innerHTML = html;
    $('capa').classList.add('ver');
    if (marcador) Sonido.subirMarcador(true);
  }
  function cerrarCapa() {
    Sonido.subirMarcador(false);
    $('capa').classList.remove('ver', 'podio');
    pararFiesta();
    FX.apagar();          // el confeti se va enseguida: la siguiente pregunta se lee limpia
  }

  /* Mientras el podio está abierto cae confeti a ráfagas suaves. */
  var fiesta = null;
  function arrancarFiesta() {
    pararFiesta();
    fiesta = setInterval(function () {
      if (!$('capa').classList.contains('podio')) { pararFiesta(); return; }
      FX.fiesta(14 + Math.round(Math.random() * 10));
    }, 1500);
  }
  function pararFiesta() { clearInterval(fiesta); fiesta = null; }

  /* ---------------- teclado y botones ---------------- */
  function tecla(e) {
    if (!activo || !Q.length) return;
    if (/^(INPUT|SELECT|TEXTAREA)$/.test(document.activeElement.tagName)) return;
    if (document.querySelector('.aj-capa.ver')) return;
    var k = e.key.toUpperCase();

    if ($('capa').classList.contains('ver')) {
      if (e.key === 'Escape' && !acabado) { e.preventDefault(); cerrarCapa(); }
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowRight') {
        e.preventDefault();
        if (!acabado) { cerrarCapa(); siguiente(); }
      }
      return;
    }
    if (Q[i].t === 'm' && 'ABCD'.indexOf(k) >= 0) {
      var b = [].slice.call($('opciones').children).filter(function (x) { return x.dataset.k === k; })[0];
      if (b && !b.hasAttribute('disabled')) b.click();
    }
    if (e.key === 'ArrowRight' || e.key === ' ') { e.preventDefault(); siguiente(); }
    if (e.key === 'ArrowLeft') anterior();
    if (Q[i].t === 'w' && '1234'.indexOf(k) >= 0 && +k <= NEQ && revelado) premiar(+k - 1);
  }

  function conectar() {
    $('siguiente').onclick = siguiente;
    $('anterior').onclick = anterior;
    $('resetBtn').onclick = function () {
      Sonido.click();
      Dialogo.confirmar('↺ Reiniciar el trivial',
        'Se ponen los marcadores a cero y se vuelve a la pregunta 1.',
        'Sí, reiniciar').then(function (si) {
        if (!si) return;
        i = 0; puntos = repetir(0); rachas = repetir(0); acabado = false;
        cerrarCapa(); refrescarMarcador(); pintar();
      });
    };
    /* la ventana del marcador NO se cierra al pulsar fuera: solo valen
       sus botones, para que nadie la quite sin querer al proyectar */
    document.addEventListener('keydown', tecla);
  }

  return { iniciar: iniciar, salir: salir, conectar: conectar, marcadores: marcadores };

})();
