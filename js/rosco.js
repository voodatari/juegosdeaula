/* =========================================================
   Rosco tipo pasapalabra · un rosco por equipo
     acierto → la letra toma el color del equipo y SIGUE el
               mismo equipo (es lo que crea las rachas)
     fallo   → letra tachada para siempre y pasa el turno
     pasapalabra → la letra queda pendiente y pasa el turno
   Dos relojes independientes (bote por equipo y límite por
   letra) con una única bandera de pausa, para que «ver
   solución» los congele sin duplicar el descuento.

   Los ids de esta vista van prefijados con «r» porque el
   trivial y el rosco viven en la misma página; el buscador $
   lo añade solo.
   ========================================================= */
window.JuegoRosco = (function () {

  var $ = function (id) { return document.getElementById('r' + id); };
  var COLORES = ['#4C8DFF', '#FF8A3D', '#2BC4B4', '#FF5D73'];

  var DATOS = null, TITULO = '', ROSCOS = [], NEQ = 4;
  var estado, turno = 0, actual, puntos, banco, racha;
  var reloj = null, relojP = null, quedaP = 0;
  var boteOn = false, boteSeg = 150, limOn = false, limSeg = 20, limAcc = 'pp';
  var pausado = false, visto = false, acabado = false, activo = false;
  var roscoDe = -1;

  function escapar(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }
  function mmss(s) { s = Math.max(0, Math.round(s)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); }

  /* ---------------- carga ---------------- */
  function iniciar(idBanco) {
    activo = true;
    $('cargando').classList.remove('oculto');
    $('cargando').innerHTML = '<div class="spinner"></div><div>Cargando los roscos…</div>';

    return Store.bancoJuego(idBanco).then(function (b) {
      var v = Store.validar('rosco', b);
      if (!v.ok) throw new Error('El banco tiene errores: ' + v.errores[0]);
      DATOS = b; TITULO = b.titulo;
      /* de 1 a 4 equipos: las definiciones del banco ya vienen repartidas
         al azar entre todos sus roscos (Store.sembrarRosco), así que aquí
         basta con tomar tantos roscos como equipos haya */
      NEQ = Math.max(1, Math.min(Store.equipos('rosco'), b.roscos.length));
      ROSCOS = b.roscos.slice(0, NEQ);
      $('titulo').textContent = TITULO;
      $('subtitulo').textContent = (NEQ === 1 ? 'un rosco' : NEQ + ' roscos') + ' de ' +
        ROSCOS[0].letras.length + ' letras';
      $('marcador').style.setProperty('--neq', NEQ);
      $('marcador').innerHTML = '';
      $('cargando').classList.add('oculto');
      empezar();
      pintarChip();
    }).catch(function (err) {
      $('cargando').innerHTML =
        '<div style="text-align:center;max-width:520px;line-height:1.5">' +
        '<div style="font-size:42px">😕</div>' +
        '<h2 style="margin:10px 0">No he podido cargar los roscos</h2>' +
        '<p style="opacity:.85;font-size:14px">' + escapar(err.message) + '</p>' +
        '<p style="margin-top:16px"><button class="chip js-menu-err">← Volver al menú</button></p></div>';
      var b = $('cargando').querySelector('.js-menu-err');
      if (b) b.onclick = function () { App.ir('menu'); };
    });
  }

  function salir() {
    activo = false;
    pararRelojes();
    pararFiesta();
    $('capa').classList.remove('ver', 'podio');
    $('capaCfg').classList.remove('ver');
  }

  function empezar() {
    boteSeg = +DATOS.segundos || 150;
    estado = ROSCOS.map(function (r) { return r.letras.map(function () { return { st: 'pend', pasada: false }; }); });
    actual = ROSCOS.map(function () { return 0; });
    banco = ROSCOS.map(function () { return boteSeg; });
    puntos = ROSCOS.map(function () { return 0; });
    racha = ROSCOS.map(function () { return 0; });
    turno = 0; visto = false; acabado = false; roscoDe = -1;
    $('marcador').innerHTML = '';
    pararFiesta();
    $('capa').classList.remove('ver', 'podio');
    pintarMarcador();
    mostrar();
  }

  var letras = function (t) { return ROSCOS[t].letras; };
  var equipo = function (t) { return ROSCOS[t].equipo || ('Equipo ' + (t + 1)); };
  var vivo = function (t) {
    return (!boteOn || banco[t] > 0) && estado[t].some(function (e) { return e.st === 'pend'; });
  };

  /* ---------------- marcador (se actualiza, no se recrea) ---------------- */
  function construirMarcador() {
    $('marcador').style.setProperty('--neq', NEQ);
    $('marcador').innerHTML = ROSCOS.map(function (r, k) {
      return '<div class="eq" id="req' + k + '" style="--c:' + COLORES[k] + '">' +
        '<input class="nm" id="rnm' + k + '" value="' + escapar(equipo(k)) + '" ' +
          'maxlength="20" spellcheck="false" autocomplete="off" ' +
          'title="Pulsa para cambiar el nombre del equipo">' +
        '<span class="der"><span class="pt" id="rpt' + k + '">0</span>' +
        '<span class="tm" id="rtm' + k + '"></span></span>' +
        '<span class="racha" id="rra' + k + '"></span>' +
        '<span class="prog"><i id="rpr' + k + '"></i></span></div>';
    }).join('');
    ROSCOS.forEach(function (r, k) { conectarNombre(k); });
  }

  /* Cambiar el nombre de un equipo desde el marcador. Al escribir en el
     campo, las teclas del juego no actuan: el manejador de teclado
     ignora lo que se teclea dentro de un INPUT. */
  function conectarNombre(k) {
    var campo = $('nm' + k);
    if (!campo) return;
    campo.addEventListener('focus', function () { this.select(); });
    campo.addEventListener('input', function () {
      ROSCOS[k].equipo = this.value;
      if (k === turno) $('turnoEt').textContent = 'Turno: ' + equipo(turno);
      pintarMarcador();
    });
    campo.addEventListener('keydown', function (e) {
      e.stopPropagation();                      // que no llegue al juego
      if (e.key === 'Enter' || e.key === 'Escape') { e.preventDefault(); this.blur(); }
    });
    campo.addEventListener('blur', function () {
      var v = this.value.trim();
      if (!v) v = 'Equipo ' + (k + 1);
      ROSCOS[k].equipo = v;
      this.value = v;
      if (k === turno) $('turnoEt').textContent = 'Turno: ' + equipo(turno);
    });
  }

  function pintarMarcador() {
    if (!$('eq0')) construirMarcador();
    ROSCOS.forEach(function (r, k) {
      var total = r.letras.length;
      var hechas = estado[k].filter(function (e) { return e.st !== 'pend'; }).length;
      var pt = $('pt' + k);
      if (pt && pt.textContent !== String(puntos[k])) pt.textContent = puntos[k];
      var tm = $('tm' + k);
      if (tm) {
        var txt = boteOn ? '⏱ ' + mmss(banco[k]) : hechas + '/' + total;
        if (tm.textContent !== txt) tm.textContent = txt;
        tm.classList.toggle('bajo', boteOn && banco[k] <= 20);
      }
      var ra = $('ra' + k);
      if (ra) ra.textContent = (k === turno && racha[k] >= 2) ? '🔥 ' + racha[k] + ' seguidas' : '';
      var pr = $('pr' + k);
      if (pr) pr.style.width = (hechas / total * 100) + '%';
      var e = $('eq' + k);
      if (e) {
        e.classList.toggle('turno', k === turno);
        e.classList.toggle('fuera', !vivo(k));
      }
    });
  }

  /* ---------------- rosco ---------------- */
  function construirRosco() {
    var cont = $('rosco');
    [].slice.call(cont.querySelectorAll('.letra')).forEach(function (e) { e.remove(); });
    var L = letras(turno), n = L.length, R = 43;
    var frag = document.createDocumentFragment();
    L.forEach(function (x, k) {
      var a = (-90 + k * 360 / n) * Math.PI / 180;
      var d = document.createElement('div');
      d.className = 'letra entra';
      d.style.animationDelay = (k * 18) + 'ms';
      d.style.left = (50 + R * Math.cos(a)) + '%';
      d.style.top = (50 + R * Math.sin(a)) + '%';
      d.textContent = x.l;
      d.id = 'rlt' + k;
      d.addEventListener('animationend', function () { this.classList.remove('entra'); }, { once: true });
      frag.appendChild(d);
    });
    cont.appendChild(frag);
    /* el estilo de movimiento decide si el rosco entero entra con algo
       al cambiar de equipo (en «Nuevo (prueba)» rueda) */
    FX.repetir($('roscocaja'), 'giraTurno', 760);
  }

  function pintarRosco(nuevaLetra) {
    if (roscoDe !== turno) { construirRosco(); roscoDe = turno; }
    var est = estado[turno];
    est.forEach(function (e, k) {
      var d = $('lt' + k);
      if (!d) return;
      d.classList.toggle('gana', e.st === 'win');
      d.classList.toggle('falla', e.st === 'fail');
      d.classList.toggle('pasa', e.st === 'pend' && e.pasada);
      d.classList.toggle('ahora', k === actual[turno]);
      if (e.st === 'win') d.style.setProperty('--w', COLORES[turno]);
    });
    $('roscocaja').style.setProperty('--eqc', COLORES[turno]);
    document.documentElement.style.setProperty('--eqc', COLORES[turno]);
    $('pieCentro').innerHTML = 'rosco de <b>' + escapar(equipo(turno)) + '</b><br>' +
      est.filter(function (e) { return e.st === 'pend'; }).length + ' letras pendientes';
    $('rachaG').textContent = racha[turno] >= 2 ? '🔥 racha de ' + racha[turno] : '';
    if (nuevaLetra) FX.repetir($('letraGrande'), 'cambia', 400);
  }

  /* ---------------- mostrar letra ---------------- */
  function mostrar() {
    if (!ROSCOS.some(function (_, k) { return vivo(k); })) return final();
    if (!vivo(turno)) return pasarTurno(true);
    var x = letras(turno)[actual[turno]];
    $('letraGrande').textContent = x.l;
    $('modo').textContent = x.modo === 'contiene' ? 'CONTIENE LA ' + x.l : 'EMPIEZA POR ' + x.l;
    $('definicion').textContent = x.d;
    FX.repetir($('modo'), 'reanim');
    FX.repetir($('definicion'), 'reanim');
    visto = false;
    ponerSolucion(x.a);
    $('solHint').textContent = '👁 PULSA PARA VER LA SOLUCIÓN · PARA EL TIEMPO';
    $('turnoEt').textContent = 'Turno: ' + equipo(turno);
    $('turnoEt').style.setProperty('--eqc', COLORES[turno]);
    pintarMarcador();
    pintarRosco(true);
    arrancarReloj();
  }

  /* Cambia la solución sin que se llegue a leer (igual que en el trivial):
     1) se desvanece la anterior, 2) con el hueco vacío se pone el texto
     nuevo y se activa el desenfoque de golpe, 3) reaparece ya borroso. */
  function ponerSolucion(texto) {
    var sol = $('sol'), val = $('solVal');
    sol.classList.add('cambiando');
    clearTimeout(sol._cambio);
    sol._cambio = setTimeout(function () {
      val.textContent = texto;
      sol.classList.toggle('tapada', !visto);
      void val.offsetWidth;                 // el desenfoque se aplica ya
      requestAnimationFrame(function () { sol.classList.remove('cambiando'); });
    }, 140);
  }

  function siguienteLetra() {
    var est = estado[turno], n = est.length;
    for (var k = 1; k <= n; k++) {
      var j = (actual[turno] + k) % n;
      if (est[j].st === 'pend') { actual[turno] = j; return true; }
    }
    return false;
  }

  function pasarTurno(seguir) {
    pararRelojes();
    var N = NEQ;
    for (var k = 1; k <= N; k++) {
      var j = (turno + k) % N;
      if (vivo(j)) { racha[turno] = 0; turno = j; if (seguir) mostrar(); return; }
    }
    final();
  }

  /* ---------------- resolver ---------------- */
  function resolver(tipo) {
    if (!activo || acabado || !DATOS) return;
    pararRelojes();
    var k = actual[turno];
    var nodo = $('lt' + k);

    if (tipo === 'ok') {
      estado[turno][k] = { st: 'win', pasada: false };
      puntos[turno]++; racha[turno]++;
      Sonido.ok(1300);
      if (nodo) { FX.desde(nodo, 16); FX.repetir(nodo, 'nace', 400); }
      var e = $('eq' + turno);
      FX.repetir(e, 'sube', 500);
      FX.flotante(e, '+1');
      if (racha[turno] === 5) FX.fiesta(18);
      siguienteLetra();
      return mostrar();                      // RACHA: sigue el mismo equipo
    }

    if (tipo === 'no') {
      estado[turno][k] = { st: 'fail', pasada: false };
      Sonido.no(1200);
      if (nodo) FX.repetir(nodo, 'sacudeL', 340);
      FX.repetir($('roscocaja'), 'sacude', 340);
    } else {
      estado[turno][k].pasada = true;        // pasapalabra: sigue pendiente
      Sonido.pasa();
    }
    siguienteLetra();
    pasarTurno(true);
  }

  /* ---------------- relojes ---------------- */
  function pararRelojes() { clearInterval(reloj); clearInterval(relojP); }

  function pintarRelojes() {
    $('relojes').classList.toggle('oculto', !(boteOn || limOn));
    $('relBote').classList.toggle('oculto', !boteOn);
    $('relLim').classList.toggle('oculto', !limOn);
    if (boteOn) {
      $('boteVal').textContent = mmss(banco[turno]);
      $('relBote').classList.toggle('baja', !pausado && banco[turno] <= 15);
      $('relBote').classList.toggle('pausa', pausado);
    }
    if (limOn) {
      $('limVal').textContent = Math.max(0, quedaP);
      $('relLim').classList.toggle('baja', !pausado && quedaP <= 5);
      $('relLim').classList.toggle('pausa', pausado);
    }
  }

  function arrancarReloj() {
    pararRelojes();
    quedaP = limSeg;
    /* mostrar() pone visto=false antes de llamar aquí, así que en letra
       nueva esto suelta la pausa; si se reconfiguran los tiempos con la
       solución a la vista, la pausa se mantiene. */
    pausado = visto;
    pintarRelojes();
    if (boteOn) {
      reloj = setInterval(function () {
        if (pausado) return;
        banco[turno]--;
        pintarRelojes();
        if (banco[turno] % 3 === 0) pintarMarcador();
        if (banco[turno] <= 0) {
          banco[turno] = 0; pararRelojes();
          Sonido.no(1200); pintarMarcador(); pasarTurno(true);
        }
      }, 1000);
    }
    if (limOn) {
      relojP = setInterval(function () {
        if (pausado) return;
        quedaP--;
        pintarRelojes();
        if (quedaP <= 0) { pararRelojes(); resolver(limAcc); }
      }, 1000);
    }
  }

  /* Mientras el podio está abierto cae confeti a ráfagas suaves. */
  var fiesta = null;
  function arrancarFiesta() {
    clearInterval(fiesta);
    fiesta = setInterval(function () {
      if (!$('capa').classList.contains('podio')) { clearInterval(fiesta); return; }
      FX.fiesta(14 + Math.round(Math.random() * 10));
    }, 1500);
  }
  function pararFiesta() { clearInterval(fiesta); fiesta = null; }

  /* ---------------- final ---------------- */
  function final() {
    if (acabado) return;
    acabado = true;
    pararRelojes();
    Sonido.final();
    $('capa').classList.add('podio');      // enciende los focos del escenario
    FX.fiesta(55);
    arrancarFiesta();
    var orden = ROSCOS.map(function (r, k) { return { n: equipo(k), p: puntos[k] }; })
      .sort(function (a, b) { return b.p - a.p; });
    var max = orden[0].p;
    $('cajaTexto').innerHTML = '<h2>🔵 ¡Rosco completado!</h2>' +
      '<div class="sub">' + escapar(TITULO) + '</div><div class="filas">' +
      orden.map(function (t, k) {
        return '<div class="fila-r ' + (t.p === max ? 'si' : 'no') + '" style="animation-delay:' +
          (k * 0.13) + 's"><span>' + ['🥇', '🥈', '🥉', '　'][k] + ' ' + escapar(t.n) +
          '</span><span class="r">' + t.p + ' letras</span></div>';
      }).join('') + '</div>' +
      '<div class="capa-pie">' +
      '<button class="btn" id="rfinMenu">← Menú principal</button>' +
      '<button class="btn principal" id="rfinOtro">Elegir otro banco de roscos</button></div>';
    $('capa').classList.add('ver');
    $('finMenu').onclick = function () {
      pararFiesta(); FX.apagar(); $('capa').classList.remove('ver', 'podio'); App.ir('menu');
    };
    $('finOtro').onclick = function () {
      pararFiesta(); FX.apagar(); $('capa').classList.remove('ver', 'podio'); App.ir('menu', 'rosco');
    };
  }

  /* ---------------- panel de tiempos ---------------- */
  function pintarChip() {
    var t = [];
    if (boteOn) t.push('bote ' + mmss(boteSeg));
    if (limOn) t.push(limSeg + 's/letra');
    $('cfgBtn').textContent = t.length ? '⏱ ' + t.join(' · ') : '⏱ Tiempos';
    $('cfgBtn').classList.toggle('on', boteOn || limOn);
  }
  function refrescarSubs() {
    $('subBote').classList.toggle('off', !$('cBote').checked);
    $('subLim').classList.toggle('off', !$('cLim').checked);
  }

  /* ---------------- teclado y botones ---------------- */
  function tecla(e) {
    if (!activo || !DATOS || acabado) return;
    if ($('capaCfg').classList.contains('ver')) return;
    if (document.querySelector('.aj-capa.ver')) return;
    if (/^(INPUT|SELECT|TEXTAREA)$/.test(document.activeElement.tagName)) return;
    var k = e.key.toLowerCase();
    if (e.key === 'ArrowRight' || k === 'a') { e.preventDefault(); resolver('ok'); }
    if (e.key === 'ArrowDown' || k === 'f') { e.preventDefault(); resolver('no'); }
    if (e.key === ' ' || k === 'p') { e.preventDefault(); resolver('pp'); }
    if (k === 'v') alternarSolucion();
  }

  function alternarSolucion() {
    visto = !visto;
    $('sol').classList.toggle('tapada', !visto);
    pausado = visto;                   // ver la solución congela los dos relojes
    $('solHint').textContent = visto ? '🙈 PULSA PARA OCULTARLA Y SEGUIR EL TIEMPO'
                                     : '👁 PULSA PARA VER LA SOLUCIÓN · PARA EL TIEMPO';
    if (visto) { Sonido.revelar(); FX.desde($('sol'), 10); FX.repetir($('sol'), 'revela', 680); }
    pintarRelojes();
  }

  function conectar() {
    $('okBtn').onclick = function () { resolver('ok'); };
    $('noBtn').onclick = function () { resolver('no'); };
    $('ppBtn').onclick = function () { resolver('pp'); };
    /* la caja de la solución ES el botón: se pulsa y se destapa */
    $('sol').onclick = alternarSolucion;
    $('cBote').onchange = refrescarSubs;
    $('cLim').onchange = refrescarSubs;
    $('cfgBtn').onclick = function () {
      $('cBote').checked = boteOn; $('cBoteSeg').value = boteSeg;
      $('cLim').checked = limOn; $('cLimSeg').value = limSeg; $('cLimAcc').value = limAcc;
      refrescarSubs();
      $('capaCfg').classList.add('ver');
    };
    $('cfgCancel').onclick = function () { $('capaCfg').classList.remove('ver'); };
    $('cfgOk').onclick = function () {
      var nuevo = Math.min(900, Math.max(30, parseInt($('cBoteSeg').value, 10) || 150));
      var cambia = nuevo !== boteSeg;
      boteOn = $('cBote').checked; boteSeg = nuevo;
      limOn = $('cLim').checked;
      limSeg = Math.min(180, Math.max(5, parseInt($('cLimSeg').value, 10) || 20));
      limAcc = $('cLimAcc').value;
      if (cambia) banco = ROSCOS.map(function () { return boteSeg; });
      $('capaCfg').classList.remove('ver');
      pintarChip(); pintarMarcador(); arrancarReloj();
    };
    $('capaCfg').onclick = function (e) { if (e.target.id === 'rcapaCfg') $('capaCfg').classList.remove('ver'); };
    /* la ventana final solo se cierra con sus botones */
    $('resetBtn').onclick = function () {
      Sonido.click();
      Dialogo.confirmar('↺ Reiniciar el rosco',
        'Se vacían los roscos, los marcadores y los relojes.',
        'Sí, reiniciar').then(function (si) {
        if (si) { empezar(); pintarChip(); }
      });
    };
    document.addEventListener('keydown', tecla);
  }

  return { iniciar: iniciar, salir: salir, conectar: conectar };

})();
