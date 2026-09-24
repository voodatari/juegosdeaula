/* =========================================================
   Vista del menú
   Paso 1: elegir juego. Paso 2: elegir banco y jugar.
   ========================================================= */
window.Menu = (function () {

  var $ = function (id) { return document.getElementById(id); };
  var BANCOS = [];
  var elegido = null;
  var animVis = null;
  var cargado = false;

  var JUEGOS = {
    trivial: {
      titulo: '🏆 Trivial por equipos',
      tinte: '#6E5BE8', tinte2: '#8B7CF6',
      pitch: 'Todos los equipos responden cada pregunta a la vez. Primero tipo test, con revelado ' +
             'simultáneo y puntos automáticos; luego preguntas de respuesta escrita que puntúa el maestro.',
      pista: function (n) {
        return n === 1 ? 'un único marcador: toda la clase juega junta'
             : 'el marcador y las casillas de turno se reparten entre ' + n;
      }
    },
    rosco: {
      titulo: '🔵 Rosco pasapalabra',
      tinte: '#2BC4B4', tinte2: '#189B90',
      pitch: 'Cada equipo tiene su propio rosco. El acierto encadena y el equipo sigue; el fallo o el ' +
             'pasapalabra ceden el turno. Con bote de tiempo por equipo y límite por letra, opcionales.',
      pista: function (n) {
        return n === 1 ? 'un rosco, sin turnos, con definiciones de todo el banco'
             : n + ' roscos con las definiciones del banco repartidas al azar';
      }
    }
  };

  /* ---------- decorados ---------- */
  function vizTrivial() {
    var textos = [['Lisboa', 'A'], ['Duero', 'B'], ['Anfibio', 'C'], ['Hexágono', 'D']];
    var cols = ['#FF5D73', '#2BC4B4', '#F5C518', '#8B7CF6'];
    $('dViz').innerHTML = '<div class="miniopts">' + textos.map(function (t, i) {
      return '<div class="miniopt" style="--oc:' + cols[i] + '"><b>' + t[1] + '</b>' + t[0] + '</div>';
    }).join('') + '</div>';
    var celdas = [].slice.call($('dViz').querySelectorAll('.miniopt')), k = 0;
    animVis = setInterval(function () {
      celdas.forEach(function (c) { c.classList.remove('hit'); });
      celdas[k % 4].classList.add('hit');
      k++;
    }, 1500);
  }
  function vizRosco() {
    var L = 'ABCDEFGHIJLMNOPQRSTUVZ'.split(''), n = L.length;
    $('dViz').innerHTML = '<div class="minirosco"><div class="minicirc">' +
      L.map(function (l, i) {
        var a = (-90 + i * 360 / n) * Math.PI / 180;
        return '<span class="minil" style="left:' + (50 + 42 * Math.cos(a)) + '%;top:' +
          (50 + 42 * Math.sin(a)) + '%">' + l + '</span>';
      }).join('') + '<span class="minicentro" id="minicentro">A</span></div></div>';
    var nodos = [].slice.call($('dViz').querySelectorAll('.minil')), k = 0;
    animVis = setInterval(function () {
      nodos[k % n].classList.add('on');
      $('minicentro').textContent = L[(k + 1) % n];
      if (k >= n) nodos[(k - n) % n].classList.remove('on');
      k++;
    }, 420);
  }

  /* ---------- pasos ---------- */
  function abrir(tipo) {
    elegido = tipo;
    var j = JUEGOS[tipo];
    clearInterval(animVis);
    Sonido.click();
    $('paso1').classList.add('oculto');
    $('paso2').classList.remove('oculto');
    $('paso2').style.setProperty('--tinte', j.tinte);
    $('paso2').style.setProperty('--tinte2', j.tinte2);
    $('dTitulo').textContent = j.titulo;
    $('dPitch').textContent = j.pitch;
    pintarEquipos();
    $('lema').textContent = 'Elige el banco de preguntas y a jugar';
    tipo === 'rosco' ? vizRosco() : vizTrivial();
    $('dHoja').classList.toggle('oculto', tipo !== 'trivial');
    $('dGuia').classList.toggle('oculto', tipo !== 'rosco');
    rellenar(tipo);
    FX.repetir($('paso2'), 'reentra', 400);
  }

  function volver() {
    clearInterval(animVis);
    Sonido.click();
    elegido = null;
    $('paso2').classList.add('oculto');
    $('paso1').classList.remove('oculto');
    $('lema').textContent = 'Elige el concurso que vas a jugar hoy';
    FX.repetir($('paso1'), 'reentra', 400);
  }

  /* ---------- cuántos equipos ----------
     De 1 a 4. Se recuerda por juego y cambia de sitio las pastillas de
     información, para que se vea de antemano cómo quedará la partida. */
  function pintarEquipos() {
    if (!elegido) return;
    var j = JUEGOS[elegido];
    var n = Store.equipos(elegido);
    [].slice.call($('dEquipos').children).forEach(function (b) {
      b.classList.toggle('sel', +b.dataset.n === n);
    });
    $('dEqPista').textContent = j.pista(n);
  }

  /* ---------- bancos ---------- */
  function escapar(t) {
    return String(t).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function opcion(b, guardado, marca) {
    return '<option value="' + escapar(b.id) + '"' + (b.id === guardado ? ' selected' : '') + '>' +
      escapar(b.titulo) + (marca || '') + '</option>';
  }
  function textoAleatorio() {
    var a = Store.aleatorio();
    return a ? '🎲 Preguntas aleatorias · ' + a.test.length + ' test + ' + a.escritas.length + ' escritas'
             : '🎲 Preguntas aleatorias…';
  }

  var valorPrevio = null;

  /* En el rosco, las definiciones se reparten de nuevo entre los roscos
     cada vez que se elige el banco. Se prepara aquí, al elegirlo, para
     que el PDF de soluciones y la partida usen el mismo reparto. */
  function sembrar(tipo, id) {
    if (tipo !== 'rosco' || !id || id === Store.ID_ALEATORIO) return;
    Store.sembrarRosco(id).catch(function () { /* ya se avisa al jugar */ });
  }

  function rellenar(tipo) {
    var sel = $('dBanco');
    var guardado = Store.elegido(tipo);
    var propios = BANCOS.filter(function (b) { return b.tipo === tipo; });
    var yo = Store.usuario();
    if (!propios.length && tipo !== 'trivial') {
      sel.innerHTML = '<option>No hay bancos de este juego</option>';
      $('dJugar').disabled = true;
      pintarBotones();
      return;
    }
    $('dJugar').disabled = false;
    var marca = function (b) {
      return b.origen === 'ejemplo' ? ' · ejemplo' : b.origen === 'caché' ? ' · sin conexión' : '';
    };
    var html = '';
    if (tipo === 'trivial') {
      html += '<option value="' + Store.ID_ALEATORIO + '"' + (guardado === Store.ID_ALEATORIO ? ' selected' : '') +
        '>' + textoAleatorio() + '</option>';
    }
    var mios = propios.filter(function (b) { return b.origen === 'propio'; });
    var resto = propios.filter(function (b) { return b.origen !== 'propio'; });
    if (yo && !yo.admin && mios.length) {
      html += '<optgroup label="📁 Mis bancos">' +
        mios.map(function (b) { return opcion(b, guardado); }).join('') + '</optgroup>';
      if (resto.length) html += '<optgroup label="🌍 Banco general">' +
        resto.map(function (b) { return opcion(b, guardado, marca(b)); }).join('') + '</optgroup>';
    } else {
      html += resto.concat(mios).map(function (b) { return opcion(b, guardado, marca(b)); }).join('');
    }
    sel.innerHTML = html;
    var existe = [].some.call(sel.options, function (o) { return o.value === guardado; });
    if (!existe) sel.value = (propios[0] && propios[0].id) || sel.options[0].value;
    valorPrevio = sel.value;
    sembrar(tipo, sel.value);
    sel.onchange = function () {
      Sonido.click();
      if (sel.value === Store.ID_ALEATORIO) { abrirAleatorio(); return; }
      valorPrevio = sel.value;
      Store.elegido(tipo, sel.value);
      sembrar(tipo, sel.value);
      pintarBotones();
    };
    pintarBotones();
  }

  /* botones de debajo del selector según el banco elegido */
  function pintarBotones() {
    var id = $('dBanco').value;
    var alea = id === Store.ID_ALEATORIO;
    var info = Store.info(id);
    var b = $('dEnlace');
    if (b) {
      var ok = !!(info && info.enlace);
      b.disabled = !ok;
      b.title = ok ? 'Copia una dirección que abre este banco directamente, sin iniciar sesión'
               : alea ? 'Las preguntas aleatorias cambian cada vez: no tienen enlace'
               : 'Los bancos de ejemplo no tienen enlace';
    }
    var t = $('dTirada');
    if (t) t.classList.toggle('oculto', !(alea && Store.aleatorio()));
  }

  function cargar() {
    return Store.indice().then(function (r) {
      BANCOS = r.bancos;
      cargado = true;
      if (elegido) rellenar(elegido);
      var p = $('punto'), t = $('estadoTxt');
      var yo = Store.usuario();
      var gen = r.bancos.filter(function (b) { return b.origen === 'general'; }).length;
      var mios = r.bancos.filter(function (b) { return b.origen === 'propio'; }).length;
      if (r.fuente === 'nube') {
        p.className = 'punto ok';
        t.textContent = (yo && !yo.admin)
          ? mios + (mios === 1 ? ' banco tuyo' : ' bancos tuyos') + ' · ' + gen + ' en el banco general'
          : gen ? gen + (gen === 1 ? ' banco' : ' bancos') + ' en el banco general'
                : 'Banco general vacío · bancos de ejemplo';
      } else if (r.fuente === 'error') {
        p.className = 'punto mal';
        t.textContent = 'La base no responde · jugando con las copias guardadas';
      } else {
        p.className = 'punto local';
        t.textContent = 'Sin base de datos · bancos de ejemplo';
      }
      return BANCOS;
    });
  }

  /* =========================================================
     Preguntas aleatorias
     Ventana con dos contadores (test y escritas) que se suben y
     bajan con los botones. Si se pide más de lo que hay, se avisa
     y se queda en el máximo disponible.
     ========================================================= */
  var pool = null;
  var cuenta = { t: 0, e: 0 };

  function maximo(k) { return pool ? (k === 't' ? pool.test.length : pool.escritas.length) : 0; }

  function ponerCuenta(k, v, avisarSiPasa) {
    var max = maximo(k);
    v = parseInt(v, 10);
    if (isNaN(v) || v < 0) v = 0;
    var mal = $('aleMal');
    if (v > max) {
      v = max;
      if (avisarSiPasa) {
        mal.textContent = 'Solo hay ' + max + (k === 't' ? ' preguntas tipo test' : ' preguntas escritas') +
          ' disponibles: se queda en ' + max + '.';
        mal.classList.remove('oculto');
        FX.repetir($('ale' + k.toUpperCase()).closest('.contador'), 'tiembla', 400);
      }
    } else if (avisarSiPasa !== undefined) {
      mal.classList.add('oculto');
    }
    cuenta[k] = v;
    $('ale' + k.toUpperCase()).value = v;
    var total = cuenta.t + cuenta.e;
    $('aleTotal').textContent = total ? 'En total, ' + total + (total === 1 ? ' pregunta.' : ' preguntas.')
                                      : 'Elige al menos una pregunta.';
    $('aleSi').disabled = !total;
  }

  function abrirAleatorio() {
    var capa = $('capaAleatorio');
    var previa = Store.aleatorio();
    pool = null;
    $('aleSub').textContent = 'Contando las preguntas disponibles…';
    $('aleMal').classList.add('oculto');
    $('aleDispT').textContent = $('aleDispE').textContent = '…';
    $('aleT').value = $('aleE').value = '';
    $('aleSi').disabled = true;
    $('aleTotal').textContent = '';
    capa.classList.add('ver');
    Store.poolAleatorio().then(function (p) {
      pool = p;
      var de = p.origen === 'propio' ? (p.bancos === 1 ? 'tu banco de trivial' : 'tus ' + p.bancos + ' bancos de trivial')
             : p.origen === 'general' ? (p.bancos === 1 ? 'el banco de trivial del banco general'
                                                        : 'los ' + p.bancos + ' bancos de trivial del banco general')
             : 'el banco de ejemplo';
      var yo = Store.usuario();
      $('aleSub').textContent = 'Se mezclan al azar preguntas de ' + de + ', sin repetir ninguna.' +
        (yo && !yo.admin && p.origen !== 'propio' ? ' (Aún no tienes bancos propios de trivial.)' : '');
      $('aleDispT').textContent = 'de ' + p.test.length + ' disponibles';
      $('aleDispE').textContent = 'de ' + p.escritas.length + ' disponibles';
      ponerCuenta('t', previa ? previa.test.length : Math.min(28, p.test.length));
      ponerCuenta('e', previa ? previa.escritas.length : Math.min(12, p.escritas.length));
      setTimeout(function () { $('aleSi').focus(); }, 60);
    }).catch(function (err) {
      $('aleSub').textContent = 'No he podido reunir las preguntas: ' + err.message;
    });
  }

  function cerrarAleatorio(aceptado) {
    $('capaAleatorio').classList.remove('ver');
    var sel = $('dBanco');
    if (aceptado) {
      Store.crearAleatorio(pool, cuenta.t, cuenta.e);
      sel.options[0].textContent = textoAleatorio();
      sel.value = Store.ID_ALEATORIO;
      valorPrevio = sel.value;
      Store.elegido('trivial', Store.ID_ALEATORIO);
      Sonido.ok();
      FX.desde($('dBanco'), 10);
    } else if (sel.value === Store.ID_ALEATORIO && !Store.aleatorio()) {
      /* se canceló sin tirada previa: vuelve al banco que había */
      sel.value = (valorPrevio && valorPrevio !== Store.ID_ALEATORIO) ? valorPrevio
                : (sel.options[1] ? sel.options[1].value : sel.value);
      if (sel.value !== Store.ID_ALEATORIO) Store.elegido('trivial', sel.value);
    }
    pintarBotones();
  }

  function conectarAleatorio() {
    var repetir = null, espera = null;
    function parar() { clearTimeout(espera); clearInterval(repetir); espera = repetir = null; }
    [].slice.call(document.querySelectorAll('[data-paso]')).forEach(function (b) {
      var k = b.dataset.paso, d = +b.dataset.d;
      function paso() { if (pool) ponerCuenta(k, cuenta[k] + d, true); }
      b.addEventListener('pointerdown', function (e) {
        if (e.button !== 0) return;
        e.preventDefault();
        Sonido.click();
        paso();
        parar();
        /* manteniendo pulsado, sigue contando */
        espera = setTimeout(function () { repetir = setInterval(paso, 70); }, 420);
      });
      ['pointerup', 'pointerleave', 'pointercancel'].forEach(function (ev) { b.addEventListener(ev, parar); });
      b.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); paso(); }
      });
    });
    ['T', 'E'].forEach(function (K) {
      var campo = $('ale' + K), k = K.toLowerCase();
      campo.addEventListener('change', function () { if (pool) ponerCuenta(k, campo.value, true); });
      campo.addEventListener('keydown', function (e) {
        if (e.key === 'ArrowUp') { e.preventDefault(); if (pool) ponerCuenta(k, cuenta[k] + 1, true); }
        if (e.key === 'ArrowDown') { e.preventDefault(); if (pool) ponerCuenta(k, cuenta[k] - 1, true); }
      });
      /* la rueda del ratón también sube y baja */
      campo.closest('.contador').addEventListener('wheel', function (e) {
        if (!pool) return;
        e.preventDefault();
        ponerCuenta(k, cuenta[k] + (e.deltaY < 0 ? 1 : -1), true);
      }, { passive: false });
    });
    $('aleSi').onclick = function () {
      if (!pool) return;
      ['t', 'e'].forEach(function (k) { ponerCuenta(k, $('ale' + k.toUpperCase()).value, true); });
      if (cuenta.t + cuenta.e) cerrarAleatorio(true);
    };
    $('aleNo').onclick = function () { Sonido.click(); cerrarAleatorio(false); };
    $('capaAleatorio').addEventListener('mousedown', function (e) {
      if (e.target.id === 'capaAleatorio') cerrarAleatorio(false);
    });
    document.addEventListener('keydown', function (e) {
      if (!$('capaAleatorio').classList.contains('ver')) return;
      if (e.key === 'Escape') { e.preventDefault(); cerrarAleatorio(false); }
      if (e.key === 'Enter' && document.activeElement.tagName !== 'BUTTON') { e.preventDefault(); $('aleSi').click(); }
    });
    $('dTirada').onclick = function () { Sonido.click(); abrirAleatorio(); };
  }

  /* ---------- jugar ---------- */
  function jugar() {
    if (!elegido) return;
    var id = $('dBanco').value;
    if (!id) return;
    Sonido.click();
    if (id === Store.ID_ALEATORIO && !Store.aleatorio()) { abrirAleatorio(); return; }
    Store.elegido(elegido, id);
    App.ir(elegido, id);
  }

  function tecla(e) {
    if (App.vista() !== 'menu') return;
    if (document.querySelector('.capa.ver')) return;
    if (/^(INPUT|SELECT|TEXTAREA)$/.test(document.activeElement.tagName)) return;
    if (!elegido) {
      if (e.key === '1') abrir('trivial');
      if (e.key === '2') abrir('rosco');
    } else {
      if (e.key === 'Enter') jugar();
      if (e.key === 'Escape') volver();
    }
  }

  function conectar() {
    [].slice.call(document.querySelectorAll('[data-juego]')).forEach(function (b) {
      b.onclick = function () { abrir(b.dataset.juego); };
    });
    $('volver').onclick = volver;
    $('dJugar').onclick = jugar;

    [].slice.call($('dEquipos').children).forEach(function (b) {
      b.onclick = function () {
        if (!elegido) return;
        Sonido.click();
        Store.equipos(elegido, +b.dataset.n);
        pintarEquipos();
        FX.desde(b, 8);
      };
    });

    /* PDF con todas las definiciones y soluciones: la chuleta del maestro */
    $('dGuia').onclick = function () {
      var id = $('dBanco').value;
      if (!id) return;
      var b = this;
      Sonido.click();
      b.disabled = true;
      b.textContent = 'Preparando el PDF…';
      Hoja.soluciones(id).catch(function (err) {
        Dialogo.avisar('No he podido preparar el PDF', err.message);
      }).then(function () {
        b.disabled = false;
        b.textContent = '📄 PDF con las soluciones';
      });
    };

    /* hoja de respuestas del banco elegido, lista para imprimir */
    $('dHoja').onclick = function () {
      var id = $('dBanco').value;
      if (!id) return;
      if (id === Store.ID_ALEATORIO && !Store.aleatorio()) { abrirAleatorio(); return; }
      var b = this;
      Sonido.click();
      b.disabled = true;
      b.textContent = 'Preparando la hoja…';
      Hoja.imprimir(id).catch(function (err) {
        Dialogo.avisar('No he podido preparar la hoja', err.message);
      }).then(function () {
        b.disabled = false;
        b.textContent = '🖨 Imprimir hoja de respuestas';
      });
    };

    /* enlace directo al banco elegido: abre el juego sin iniciar sesión */
    $('dEnlace').onclick = function () {
      var info = Store.info($('dBanco').value);
      if (!info || !info.enlace) return;
      var b = this, url = Store.urlEnlace(info.enlace);
      Sonido.click();
      Dialogo.copiar(url).then(function (ok) {
        if (ok) {
          b.textContent = '✔ Enlace copiado';
          FX.desde(b, 10);
          setTimeout(function () { b.textContent = '🔗 Copiar enlace de juego'; }, 2200);
        } else {
          Dialogo.pedir({ titulo: '🔗 Enlace de juego', texto: 'Cópialo con Ctrl+C:', campo: true,
                          valor: url, aceptar: 'Hecho', soloAviso: true });
        }
      });
    };
    conectarAleatorio();

    document.addEventListener('keydown', tecla);
    montarFocos();
    cargar();
  }

  /* Vuelta desde una partida: refresca la lista y, si se pide,
     abre directamente el paso 2 de ese juego. */
  function entrar(tipo) {
    if (cargado) cargar();
    if (tipo) abrir(tipo);
    else volverSilencioso();     // al volver de una partida se ve otra vez la elección de juego
  }
  function volverSilencioso() {
    clearInterval(animVis);
    elegido = null;
    $('paso2').classList.add('oculto');
    $('paso1').classList.remove('oculto');
    $('lema').textContent = 'Elige el concurso que vas a jugar hoy';
  }

  /* =========================================================
     Focos de la pantalla de título
     Modo ANALIZADOR: cada foco es una banda del espectro de la
     música. Los graves caen en los extremos y los agudos se
     acercan al centro, como un ecualizador abierto en abanico.
     Modo CLÁSICO: el de siempre, sin analizar nada: todas las
     luces laten juntas al compás del tema del título.
     ========================================================= */
  var COMPAS = 60 / 111.155;            // 0,53979 s por pulso (el título sí late)
  var N_FOCOS = 9;
  var N_BANDAS = Math.ceil(N_FOCOS / 2);   // 5: cada banda alimenta dos focos
  var focosListos = false;
  var bucle = null;
  var luces = [], nivel = [], banda = [], lenta = [];
  var dondeFocos = null;        // null = en el cuerpo · elemento = dentro del podio

  /* Los focos viven normalmente en el cuerpo de la página, detrás de todo.
     Cuando se abre el podio se mudan dentro de esa capa para quedar por
     encima del desenfoque, y al cerrarse vuelven a su sitio (así el
     fundido de salida se sigue viendo). */
  function colocarFocos(cont, capaPodio) {
    if (capaPodio && dondeFocos !== capaPodio) {
      capaPodio.insertBefore(cont, capaPodio.firstChild);
      dondeFocos = capaPodio;
    } else if (!capaPodio && dondeFocos) {
      document.body.insertBefore(cont, document.body.firstChild.nextSibling);
      dondeFocos = null;
    }
  }

  function montarFocos() {
    var cont = $('focos');
    if (!cont || focosListos) return;
    var COL = ['#FF3CAC', '#7A5BFF', '#4C8DFF', '#00E0C6', '#F5C518',
               '#FF8A3D', '#FF5D73', '#8B7CF6', '#2BC4B4'];
    var html = '';
    for (var i = 0; i < N_FOCOS; i++) {
      var x = (i / (N_FOCOS - 1)) * 116 - 8;   // de -8 % a 108 %: se salen por los lados
      /* a qué banda mira este foco: 0 (graves) en los bordes,
         la más aguda justo en el centro */
      var centro = (N_FOCOS - 1) / 2;
      var d = Math.abs(i - centro) / centro;          // 1 en los extremos, 0 en el centro
      banda.push(Math.round((1 - d) * (N_BANDAS - 1)));
      nivel.push(0);
      html += '<i style="--x:' + x.toFixed(1) + '%;--c:' + COL[i % COL.length] +
              ';--r:' + ((i - centro) * 7).toFixed(1) + 'deg;--i:' + i + '"></i>';
    }
    cont.innerHTML = html;
    luces = [].slice.call(cont.children);
    cont.style.setProperty('--compas', COMPAS + 's');
    document.documentElement.style.setProperty('--compas', COMPAS + 's');
    focosListos = true;
    arrancarBucle();
  }

  function arrancarBucle() {
    if (bucle) return;
    bucle = function () {
      var cont = $('focos');
      if (cont && luces.length) {
        /* los focos se encienden en el menú y también en la pantalla final
           del trivial y del rosco; al salir de ahí se apagan poco a poco
           (la capa entera lleva su propia transición de opacidad) */
        var enMenu = App.vista() === 'menu';
        var podio = document.querySelector('.capa.ver.podio');
        var enPodio = !!podio;
        colocarFocos(cont, podio);
        var activo = (enMenu || enPodio) && Sonido.sonando();
        var espectro = Fondo.focos() === 'espectro';
        cont.classList.toggle('encendidos', activo);
        cont.classList.toggle('vivo', activo);
        cont.classList.toggle('espectro', activo && espectro);
        document.documentElement.classList.toggle('conMusica', activo && enMenu);

        var datos = (activo && espectro) ? Sonido.espectro(N_BANDAS) : null;
        /* modo clásico (o sin análisis posible): un solo latido por compás
           para todas las luces, exactamente como en las primeras versiones */
        var latido = 0;
        if (activo && !datos) {
          var f = (performance.now() / 1000) % COMPAS / COMPAS;
          latido = Math.pow(1 - f, 2.2);
        }
        /* cada banda se normaliza con su propio máximo reciente: los agudos
           llegan mucho más flojos que los graves y, sin esto, o no se mueven
           o se quedan clavados arriba */
        /* cada banda se dibuja con dos ingredientes: su altura propia (los
           graves llenan más que los agudos, de ahí la forma de abanico) y
           cuánto se aparta ahora mismo de su media reciente, que es el
           golpe de la música */
        if (datos) {
          for (var b = 0; b < datos.length; b++) {
            var v = datos[b];
            lenta[b] = lenta[b] === undefined ? v : lenta[b] + (v - lenta[b]) * 0.02;
            /* altura de reposo en abanico (más en los graves) + el golpe de
               ahora mismo respecto a su media: así los extremos no se quedan
               clavados arriba y siguen moviéndose con la música */
            var forma = 0.30 + 0.32 * (1 - b / Math.max(1, datos.length - 1));
            datos[b] = Math.max(0.04, Math.min(1, forma + (v - lenta[b]) * 6));
          }
        }
        var media = 0;
        for (var i = 0; i < luces.length; i++) {
          var objetivo;
          if (!activo) objetivo = 0;
          else if (datos) objetivo = datos[banda[i]];
          else objetivo = latido;                // modo clásico: todas a una
          /* con espectro sube rápido y baja despacio; en el clásico, el
             mismo suavizado de siempre */
          var k = datos ? (objetivo > nivel[i] ? 0.62 : 0.10) : 0.35;
          nivel[i] += (objetivo - nivel[i]) * k;
          luces[i].style.setProperty('--n', nivel[i].toFixed(3));
          media += nivel[i];
        }
        cont.style.setProperty('--n', (media / luces.length).toFixed(3));
      }
      requestAnimationFrame(bucle);
    };
    requestAnimationFrame(bucle);
  }

  return { conectar: conectar, entrar: entrar, cargar: cargar };

})();
