/* =========================================================
   Router de la página
   Las cuatro vistas (menú, trivial, rosco y preguntas) viven en
   el mismo documento: así la música no se corta ni vuelve a
   pedir permiso al navegador, y el paso de una pantalla a otra
   se puede animar.
   ========================================================= */
window.App = (function () {

  var K_ANCHO = 'trivialaula.ancho';

  var VISTAS = {
    menu:     { el: 'vistaMenu',     juego: null,           musica: 'titulo' },
    trivial:  { el: 'vistaTrivial',  juego: 'JuegoTrivial', musica: 'juego' },
    rosco:    { el: 'vistaRosco',    juego: 'JuegoRosco',   musica: 'juego' },
    importar: { el: 'vistaImportar', juego: null,           musica: 'titulo' },
    editor:   { el: 'vistaEditor',   juego: null,           musica: 'titulo' }
  };

  /* «Probar» desde el editor: al salir del juego se vuelve al editor */
  var retorno = null;
  function volverA(v) { retorno = v; }

  var actual = 'menu';
  var cambiando = false;

  function el(v) { return document.getElementById(VISTAS[v].el); }

  function ir(destino, extra) {
    if (cambiando || !VISTAS[destino]) return;
    if (destino === 'menu' && retorno && (actual === 'trivial' || actual === 'rosco')) {
      destino = retorno; extra = undefined;
    }
    if (destino !== 'trivial' && destino !== 'rosco') retorno = null;
    /* la gestión de preguntas solo existe con la sesión iniciada */
    if (destino === 'importar' && !Store.conSesion()) { Cuenta.abrir('entrar'); return; }
    if (destino === actual && destino !== 'menu' && destino !== 'importar') return;
    cambiando = true;

    var salida = el(actual), entrada = el(destino);
    var anterior = actual;

    var jSale = VISTAS[anterior].juego && window[VISTAS[anterior].juego];
    if (jSale && jSale.salir) jSale.salir();

    salida.classList.add('saliendo');

    setTimeout(function () {
      salida.classList.remove('activa', 'saliendo');
      entrada.classList.add('activa');
      entrada.scrollTop = 0;
      actual = destino;

      /* la pista cambia con un fundido; el permiso del navegador
         ya está dado, seguimos en el mismo documento */
      Sonido.tema(VISTAS[destino].musica);

      if (destino === 'menu') {
        Menu.entrar(typeof extra === 'string' ? extra : null);
      } else if (destino === 'importar') {
        Importar.entrar();
      } else if (destino === 'editor') {
        Editor.entrar(extra);
      } else {
        window[VISTAS[destino].juego].iniciar(extra || Store.elegido(destino));
      }
      historia(destino === 'editor' ? 'importar' : destino, typeof extra === 'string' ? extra : null);
      cambiando = false;
    }, Math.max(120, Anim.duracionVista() - 20));
  }

  function historia(vista, banco) {
    try {
      var u = (vista === 'menu') ? location.pathname
            : location.pathname + '?vista=' + vista + (banco ? '&banco=' + encodeURIComponent(banco) : '');
      history.replaceState({ vista: vista, banco: banco }, '', u);
    } catch (e) {}
  }

  /* ---------------- pantalla ancha (16:9) ---------------- */
  function anchoGuardado() {
    try { return localStorage.getItem(K_ANCHO) === '1'; } catch (e) { return false; }
  }
  function aplicarAncho(on, animar) {
    document.documentElement.classList.toggle('ancho', on);
    if (animar) {
      /* zoom corto: al ensanchar entra desde algo más pequeño y al
         estrechar desde algo más grande, así se nota el cambio */
      [].slice.call(document.querySelectorAll('.escena')).forEach(function (e) {
        e.style.setProperty('--zdesde', on ? '.94' : '1.06');
        FX.repetir(e, 'zoom', 520);
      });
    }
    try { localStorage.setItem(K_ANCHO, on ? '1' : '0'); } catch (e) {}
    [].slice.call(document.querySelectorAll('.js-ancho')).forEach(function (b) {
      b.classList.toggle('on', on);
      b.title = on ? 'Volver al tablero centrado' : 'Aprovechar toda la pantalla';
    });
  }

  /* ---------------- pantalla completa ---------------- */
  function pantallaCompleta() {
    var d = document;
    var pedir = d.documentElement.requestFullscreen || d.documentElement.webkitRequestFullscreen;
    var salir = d.exitFullscreen || d.webkitExitFullscreen;
    try {
      if (!d.fullscreenElement && !d.webkitFullscreenElement) pedir.call(d.documentElement);
      else salir.call(d);
    } catch (e) {}
  }
  function pintarFull() {
    var on = !!(document.fullscreenElement || document.webkitFullscreenElement);
    [].slice.call(document.querySelectorAll('.js-full')).forEach(function (b) {
      b.classList.toggle('on', on);
      /* solo los botones con texto cambian de rótulo; se marcan la
         primera vez, porque después el texto ya no dice «Pantalla» */
      if (b.dataset.rotulo === undefined) {
        b.dataset.rotulo = /pantalla/i.test(b.textContent) ? '1' : '0';
      }
      if (b.dataset.rotulo === '1') {
        b.textContent = on ? '⤢ Salir de pantalla completa' : '⤢ Pantalla completa';
      }
    });
  }

  /* ---------------- aviso de móvil ----------------
     La web se proyecta: en un teléfono no tiene sentido. Se avisa y se
     deja una salida por si alguien quiere echar un vistazo igualmente. */
  function esMovil() {
    var ua = navigator.userAgent || '';
    var tocaYEsPequena = (navigator.maxTouchPoints || 0) > 0 &&
                         Math.min(screen.width, screen.height) <= 500;
    return /Android.*Mobile|iPhone|iPod|Windows Phone|BlackBerry|Opera Mini|IEMobile/i.test(ua) ||
           tocaYEsPequena;
  }
  function avisoMovil() {
    var caja = document.getElementById('soloPizarra');
    if (!caja) return false;
    try { if (sessionStorage.getItem('trivialaula.movilok') === '1') return false; } catch (e) {}
    if (!esMovil()) return false;
    caja.hidden = false;
    var b = document.getElementById('movilSeguir');
    if (b) b.onclick = function () {
      caja.hidden = true;
      try { sessionStorage.setItem('trivialaula.movilok', '1'); } catch (e) {}
    };
    return true;
  }

  function arranque() {
    avisoMovil();
    Sonido.conectarBotones();
    Ajustes.conectar();
    Menu.conectar();
    JuegoTrivial.conectar();
    JuegoRosco.conectar();
    Importar.conectar();
    Admin.conectar();
    Cuenta.conectar();

    [].slice.call(document.querySelectorAll('.js-menu')).forEach(function (b) {
      b.onclick = function () { Sonido.click(); ir('menu'); };
    });
    [].slice.call(document.querySelectorAll('.js-importar')).forEach(function (b) {
      b.onclick = function () { Sonido.click(); ir('importar'); };
    });
    [].slice.call(document.querySelectorAll('.js-ancho')).forEach(function (b) {
      b.onclick = function () {
        Sonido.click();
        aplicarAncho(!document.documentElement.classList.contains('ancho'), true);
      };
    });
    [].slice.call(document.querySelectorAll('.js-full')).forEach(function (b) {
      b.onclick = function () { Sonido.click(); pantallaCompleta(); };
    });
    document.addEventListener('fullscreenchange', pintarFull);
    document.addEventListener('webkitfullscreenchange', pintarFull);
    Fondo.arrancar();
    aplicarAncho(anchoGuardado());
    pintarFull();

    var p = new URLSearchParams(location.search);
    var vista = p.get('vista') || p.get('juego');
    var banco = p.get('banco');
    var enlace = p.get('jugar');

    /* al entrar o salir cambia lo que se ve: bancos del menú y gestión */
    var antes = null;
    document.addEventListener('cuenta', function (e) {
      var yo = e.detail, clave = yo ? yo.id + (yo.admin ? '*' : '') : '';
      if (clave === antes) return;
      var primera = antes === null;
      antes = clave;
      if (primera) return;
      Menu.cargar();
      if (actual === 'importar') {
        if (!yo) ir('menu'); else Importar.entrar();
      }
    });
    Store.listo();

    if (enlace) {
      /* enlace de juego: abre directamente ese banco, sin iniciar sesión */
      Sonido.tema('titulo');
      document.getElementById('estadoTxt').textContent = 'Abriendo el juego compartido…';
      Store.banco('enlace:' + enlace).then(function (b) {
        ir(b.tipo === 'rosco' ? 'rosco' : 'trivial', 'enlace:' + enlace);
        Menu.cargar();
      }).catch(function (err) {
        historia('menu');
        Menu.cargar();
        Dialogo.avisar('No se puede abrir el enlace', err.message);
      });
    } else if (vista === 'trivial' || vista === 'rosco') {
      el('menu').classList.remove('activa');
      el(vista).classList.add('activa');
      actual = vista;
      Sonido.tema('juego');
      window[VISTAS[vista].juego].iniciar(banco || Store.elegido(vista));
      Menu.cargar();
    } else if (vista === 'importar') {
      Sonido.tema('titulo');
      Store.listo().then(function () { if (Store.conSesion()) ir('importar'); });
    } else {
      Sonido.tema('titulo');
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', arranque);
  else arranque();

  return { ir: ir, vista: function () { return actual; }, ancho: aplicarAncho, volverA: volverA };

})();
