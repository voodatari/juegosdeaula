/* =========================================================
   Estilos de animación
   Igual que los temas cambian el color, estos cambian el
   MOVIMIENTO: duración, curva y forma de entrar de cada cosa
   (pantallas, opciones, letras del rosco, marcadores) y la
   cantidad de confeti. Todo va por variables CSS, así que el
   cambio es inmediato y no toca la lógica de los juegos.
   ========================================================= */
(function (global) {

  var CLAVE = 'trivialaula.anim';
  var POR_DEFECTO = 'cartas';

  var ESTILOS = [
    { id: 'suave', nombre: 'Suave', icono: '🍃',
      nota: 'Movimientos cortos y discretos. Lo mínimo para que se note el cambio.',
      confeti: 0.8 },
    { id: 'fiesta', nombre: 'Fiesta', icono: '🎉',
      nota: 'Rebote alegre y mucho confeti, pero sin giros ni vaivenes que mareen.',
      confeti: 2.1 },
    { id: 'cine', nombre: 'Cine', icono: '🎬',
      nota: 'Zooms lentos con desenfoque y purpurina dorada cayendo.',
      confeti: 1.1 },
    { id: 'deslizar', nombre: 'Deslizar', icono: '🎞️',
      nota: 'Las pantallas pasan de lado con suavidad y el confeti sale en serpentinas.',
      confeti: 1.2 },
    { id: 'calma', nombre: 'Calma', icono: '🌙',
      nota: 'Solo fundidos y pompas lentas. Para grupos que se alteran.',
      confeti: 0.5 },
    { id: 'cartas', nombre: 'Cartas', icono: '🃏',
      nota: 'Todo entra dándose la vuelta, como una carta sobre la mesa.',
      confeti: 1.3 }
  ];


  /* El ajuste de Windows (o del sistema) de «reducir animaciones» se
     ignora a propósito: aquí solo manda lo que elija el maestro en las
     opciones del juego («Limitar animaciones» o el estilo «Calma»). */
  function leer() {
    try { return localStorage.getItem(CLAVE) || POR_DEFECTO; } catch (e) { return POR_DEFECTO; }
  }

  function info(id) {
    return ESTILOS.filter(function (e) { return e.id === id; })[0] || ESTILOS[1];
  }

  function aplicar(id, guardar) {
    if (!ESTILOS.some(function (e) { return e.id === id; })) id = POR_DEFECTO;
    document.documentElement.setAttribute('data-anim', id);
    if (guardar !== false) { try { localStorage.setItem(CLAVE, id); } catch (e) {} }
    return id;
  }

  /* ---------- animaciones extra ----------
     Ya son parte de cada estilo: vienen ACTIVADAS. Cada estilo suma
     movimientos propios en el trivial y en el rosco (la pregunta, la
     opción pulsada, el punto del marcador, la letra grande, la
     definición, la solución y el cambio de equipo). El interruptor
     «Limitar animaciones» las quita y deja solo las básicas de cada
     estilo. Van en un atributo aparte del documento (data-extra), así
     el CSS de cada estilo sigue intacto. */
  var K_LIMITAR = 'trivialaula.animlimitar';

  function limitadoLeer() {
    try { return localStorage.getItem(K_LIMITAR) === '1'; } catch (e) { return false; }
  }
  function ponerExtra(activas) {
    if (activas) document.documentElement.setAttribute('data-extra', '1');
    else document.documentElement.removeAttribute('data-extra');
  }
  /* limitar(): consulta · limitar(v): cambia y guarda */
  function limitar(valor) {
    if (valor === undefined) return limitadoLeer();
    valor = !!valor;
    ponerExtra(!valor);
    try { localStorage.setItem(K_LIMITAR, valor ? '1' : '0'); } catch (e) {}
    return valor;
  }
  /* extra(): ¿están las animaciones extra en marcha? (lo contrario de limitar) */
  function extra(valor) {
    if (valor === undefined) return !limitadoLeer();
    return !limitar(!valor);
  }

  aplicar(leer(), false);
  ponerExtra(!limitadoLeer());

  global.Anim = {
    lista: ESTILOS,
    actual: leer,
    aplicar: aplicar,
    info: info,
    extra: extra,
    limitar: limitar,
    /* multiplicador de confeti del estilo activo */
    confeti: function () { return info(leer()).confeti; },
    /* duración de la transición de pantalla, en ms, leída del CSS */
    duracionVista: function () {
      var v = getComputedStyle(document.documentElement).getPropertyValue('--dur-vista');
      var n = parseFloat(v);
      if (!n) return 260;
      return /ms/.test(v) ? n : n * 1000;
    }
  };

})(window);
