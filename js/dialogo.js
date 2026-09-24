/* =========================================================
   Ventanas propias (preguntar, confirmar, avisar)
   Las del navegador (prompt/confirm/alert) se pueden bloquear
   desde la barra de direcciones, paran la música y no siguen
   el aspecto de la web. Esta las sustituye en todas las vistas.
   ========================================================= */
window.Dialogo = (function (global) {

  function caja() {
    var capa = document.getElementById('capaDialogo');
    if (capa) return capa;
    capa = document.createElement('div');
    capa.className = 'capa';
    capa.id = 'capaDialogo';
    capa.innerHTML = '<div class="caja caja-izq dlg">' +
      '<h2 id="dlgTit"></h2><p class="sub" id="dlgSub"></p>' +
      '<input type="text" class="campo" id="dlgCampo" autocomplete="off">' +
      '<p class="aviso mal oculto" id="dlgMal"></p>' +
      '<div class="botones reparto" style="margin-top:14px">' +
        '<div class="grupo"><button class="btn" id="dlgNo">Cancelar</button></div>' +
        '<div class="grupo"><button class="btn principal" id="dlgSi">Aceptar</button></div>' +
      '</div></div>';
    document.body.appendChild(capa);
    return capa;
  }

  /* op: {titulo, texto, campo, clave, valor, pista, aceptar, cancelar,
          peligro, soloAviso, comprobar}
     Devuelve una promesa: el texto escrito, true, o null si se cancela. */
  function pedir(op) {
    op = op || {};
    return new Promise(function (resolver) {
      var capa = caja();
      var campo = capa.querySelector('#dlgCampo');
      var mal = capa.querySelector('#dlgMal');
      var si = capa.querySelector('#dlgSi');
      var no = capa.querySelector('#dlgNo');

      capa.querySelector('#dlgTit').textContent = op.titulo || '';
      capa.querySelector('#dlgSub').textContent = op.texto || '';
      si.textContent = op.aceptar || 'Aceptar';
      si.className = 'btn ' + (op.peligro ? 'peligro' : 'principal');
      no.textContent = op.cancelar || 'Cancelar';
      no.classList.toggle('oculto', !!op.soloAviso);
      mal.classList.add('oculto');
      campo.classList.toggle('oculto', !op.campo);
      campo.type = op.clave ? 'password' : 'text';
      campo.value = op.valor || '';
      campo.placeholder = op.pista || '';

      function cerrar(v) {
        capa.classList.remove('ver');
        document.removeEventListener('keydown', tecla, true);
        setTimeout(function () { resolver(v); }, 80);
      }
      function aceptar() {
        if (op.campo && op.comprobar) {
          var err = op.comprobar(campo.value);
          if (err) { mal.textContent = err; mal.classList.remove('oculto'); campo.focus(); return; }
        }
        if (global.Sonido) Sonido.click();
        cerrar(op.campo ? campo.value : true);
      }
      function tecla(e) {
        if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); cerrar(null); }
        if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); aceptar(); }
      }
      si.onclick = aceptar;
      no.onclick = function () { if (global.Sonido) Sonido.click(); cerrar(null); };
      capa.onclick = function (e) { if (e.target === capa) cerrar(null); };
      document.addEventListener('keydown', tecla, true);
      capa.classList.add('ver');
      if (op.campo) setTimeout(function () { campo.focus(); campo.select(); }, 60);
      else setTimeout(function () { si.focus(); }, 60);
    });
  }

  function confirmar(titulo, texto, aceptar, peligro) {
    return pedir({
      titulo: titulo, texto: texto,
      aceptar: aceptar || 'Sí, adelante', peligro: !!peligro
    }).then(function (v) { return v === true; });
  }
  function avisar(titulo, texto) {
    return pedir({ titulo: titulo, texto: texto, aceptar: 'Entendido', soloAviso: true });
  }

  /* copiar al portapapeles: API moderna y, si no deja, el método clásico */
  function copiarClasico(texto) {
    var t = document.createElement('textarea');
    t.value = texto;
    t.setAttribute('readonly', '');
    t.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0';
    document.body.appendChild(t);
    t.select();
    var ok = false;
    try { ok = document.execCommand('copy'); } catch (e) {}
    t.remove();
    return ok;
  }
  function copiar(texto) {
    if (navigator.clipboard && global.isSecureContext) {
      return navigator.clipboard.writeText(texto).then(function () { return true; },
        function () { return copiarClasico(texto); });
    }
    return Promise.resolve(copiarClasico(texto));
  }

  return { pedir: pedir, confirmar: confirmar, avisar: avisar, copiar: copiar };

})(window);
