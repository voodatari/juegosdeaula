/* =========================================================
   Fondo vivo y modo de los focos
   · Los colores del fondo giran despacio alrededor del centro
     en dos capas que rotan en sentidos contrarios, así que se
     cruzan y se funden. En el menú la velocidad baja hasta
     cero (y al salir vuelve a subir) poco a poco: nunca se
     corta de golpe, y el giro se queda donde estaba.
   · Aquí vive también la preferencia de los focos del título:
     analizador de espectro o luces fijas.
   ========================================================= */
window.Fondo = (function (global) {

  var K_MOV = 'trivialaula.fondomov';
  var K_FOCOS = 'trivialaula.focos';

  function leer(k, pordefecto) {
    try {
      var v = localStorage.getItem(k);
      return v === null ? pordefecto : v;
    } catch (e) { return pordefecto; }
  }
  function escribir(k, v) {
    try { localStorage.setItem(k, v); } catch (e) {}
  }

  var movOn = leer(K_MOV, '1') === '1';                    // encendido de fábrica
  var modoFocos = leer(K_FOCOS, 'espectro') === 'clasico' ? 'clasico' : 'espectro';

  var amp = 0, ang = 0, ang2 = 0, anterior = 0, bucleVivo = false, ultimoLigero = 0;
  var VUELTA = 2.6;        // grados por segundo de la capa de abajo
  var VUELTA2 = -1.7;      // la de arriba gira al revés y más despacio

  function capa() { return document.querySelector('.fondo'); }

  function paso(t) {
    var dt = anterior ? Math.min(0.05, (t - anterior) / 1000) : 0;
    anterior = t;
    var el = capa();
    if (el) {
      var enMenu = !global.App || App.vista() === 'menu';
      var destino = (movOn && !enMenu) ? 1 : 0;
      amp += (destino - amp) * Math.min(1, dt * 1.1);      // ~1,5 s de subida o bajada
      if (amp < 0.001 && destino === 0) amp = 0;
      var ligero = document.documentElement.classList.contains('ligero') && global.Rendimiento;
      if (amp > 0) {
        ang = (ang + VUELTA * dt * amp) % 360;
        ang2 = (ang2 + VUELTA2 * dt * amp) % 360;
        if (!ligero) {
          el.style.setProperty('--fg', ang.toFixed(3) + 'deg');
          el.style.setProperty('--fg2', ang2.toFixed(3) + 'deg');
        }
      }
      /* «Efectos optimizados»: el giro y la deriva de las manchas se
         aplican JUNTOS 20 veces por segundo. Entre medias el fondo no
         cambia y el navegador solo repinta lo que de verdad se mueve. */
      if (ligero && t - ultimoLigero >= Rendimiento.pasoLigero) {
        ultimoLigero = t;
        el.style.setProperty('--fg', ang.toFixed(3) + 'deg');
        el.style.setProperty('--fg2', ang2.toFixed(3) + 'deg');
        var e = Rendimiento.deriva(t), orbes = el.children;
        for (var i = 0; i < orbes.length && i < 3; i++) orbes[i].style.setProperty('--e', e[i].toFixed(4));
      }
    }
    requestAnimationFrame(paso);
  }

  function arrancar() {
    if (bucleVivo) return;
    bucleVivo = true;
    requestAnimationFrame(paso);
  }

  return {
    arrancar: arrancar,
    /* ángulo actual de las dos capas (grados): lo usa el modo de media
       resolución para dibujar el mismo giro en su lienzo */
    angulos: function () { return { a: ang, b: ang2 }; },
    /* movimiento(): consulta · movimiento(v): cambia y guarda */
    movimiento: function (v) {
      if (v === undefined) return movOn;
      movOn = !!v;
      escribir(K_MOV, movOn ? '1' : '0');
      return movOn;
    },
    /* focos(): 'espectro' (analizador) o 'clasico' (latido por compás) */
    focos: function (v) {
      if (v === undefined) return modoFocos;
      modoFocos = v === 'clasico' ? 'clasico' : 'espectro';
      escribir(K_FOCOS, modoFocos);
      return modoFocos;
    }
  };

})(window);
