/* =========================================================
   Administración de usuarios (solo el administrador)
   · Lista de usuarios: ver sus bancos, ponerle contraseña nueva
     o borrarlo junto con todos sus bancos.
   · Bancos de un usuario: borrar, renombrar y copiar al banco
     general, de uno en uno o marcando varios.
   Todo lo comprueba también la base: aunque alguien fuerce esta
   pantalla en su navegador, sin ser admin no le devolverá nada.
   ========================================================= */
window.Admin = (function (global) {

  var $ = function (id) { return document.getElementById(id); };
  var USUARIOS = [];
  var actual = null;            // usuario abierto
  var BANCOS = [];
  var marcados = {};

  function escapar(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function fecha(f) {
    if (!f) return 'nunca';
    var d = new Date(f);
    return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
  }
  function estado(clase, html) {
    var e = $('usEstado');
    if (!clase) { e.classList.add('oculto'); return; }
    e.className = 'aviso ' + clase;
    e.innerHTML = html;
  }
  function ocupado(si) {
    $('usLista').classList.toggle('ocupada', si);
    $('usBancos').classList.toggle('ocupada', si);
  }
  function fallo(titulo) {
    return function (err) { Dialogo.avisar(titulo, err.message); };
  }

  /* ---------------- lista de usuarios ---------------- */
  function cargarUsuarios() {
    ocupado(true);
    return Store.admin.usuarios().then(function (l) {
      USUARIOS = l || [];
      estado(null);
      pintarUsuarios();
    }).catch(function (err) {
      estado('mal', 'No se ha podido leer la lista de usuarios: ' + escapar(err.message));
    }).then(function () { ocupado(false); });
  }

  function pintarUsuarios() {
    var cont = $('usLista');
    if (!USUARIOS.length) {
      cont.innerHTML = '<div class="vacia">Todavía no se ha registrado nadie.</div>';
    } else {
      cont.innerHTML = USUARIOS.map(function (u) {
        var total = (+u.n_trivial || 0) + (+u.n_rosco || 0);
        return '<div class="bancoFila usFila' + (u.es_admin ? ' esAdminFila' : '') + '" data-uid="' + escapar(u.id) + '">' +
          '<div><b>👤 ' + escapar(u.usuario) + '</b>' + (u.es_admin ? ' <span class="cbAdmin">ADMIN</span>' : '') +
          '<br><span class="meta">' + u.n_trivial + ' trivial · ' + u.n_rosco + ' rosco · ' +
          'alta: ' + fecha(u.creado) + ' · último acceso: ' + fecha(u.ultimo_acceso) + '</span></div>' +
          '<div class="acc">' +
            '<button class="mini" data-ver="' + escapar(u.id) + '"' + (total ? '' : ' disabled') + '>📂 Bancos</button>' +
            (u.es_admin ? '' :
              '<button class="mini" data-clave="' + escapar(u.id) + '" title="Ponerle una contraseña nueva">🔑 Contraseña</button>' +
              '<button class="mini rojo" data-borraru="' + escapar(u.id) + '">🗑 Borrar</button>') +
          '</div></div>';
      }).join('');
    }
    $('usPie').textContent = USUARIOS.length + (USUARIOS.length === 1 ? ' usuario' : ' usuarios') +
      ' · pulsa en uno para ver sus bancos';
    [].slice.call(cont.querySelectorAll('.usFila')).forEach(function (f) {
      f.onclick = function (e) {
        if (e.target.closest('button')) return;
        abrirUsuario(f.dataset.uid);
      };
    });
    [].slice.call(cont.querySelectorAll('[data-ver]')).forEach(function (b) {
      b.onclick = function () { abrirUsuario(b.dataset.ver); };
    });
    [].slice.call(cont.querySelectorAll('[data-clave]')).forEach(function (b) {
      b.onclick = function () { nuevaClave(b.dataset.clave); };
    });
    [].slice.call(cont.querySelectorAll('[data-borraru]')).forEach(function (b) {
      b.onclick = function () { borrarUsuario(b.dataset.borraru); };
    });
  }

  function usuario(id) { return USUARIOS.filter(function (u) { return u.id === id; })[0]; }

  function nuevaClave(id) {
    var u = usuario(id);
    if (!u) return;
    Sonido.click();
    Dialogo.pedir({
      titulo: '🔑 Contraseña nueva para ' + u.usuario,
      texto: 'Para cuando alguien olvida la suya. Escríbela y díselo tú; luego puede cambiarla desde su menú.',
      campo: true, pista: 'contraseña nueva (8 caracteres o más)', aceptar: 'Ponerla',
      comprobar: function (v) { return Nube.validarClave(v); }
    }).then(function (v) {
      if (v === null) return;
      return Store.admin.cambiarClave(id, v).then(function () {
        Sonido.ok();
        Dialogo.avisar('Hecho', u.usuario + ' ya puede entrar con la contraseña nueva.');
      });
    }).catch(fallo('No se ha podido cambiar la contraseña'));
  }

  function borrarUsuario(id) {
    var u = usuario(id);
    if (!u) return;
    Sonido.click();
    var n = (+u.n_trivial || 0) + (+u.n_rosco || 0);
    Dialogo.confirmar('🗑 Borrar a ' + u.usuario,
      'Se borrará el usuario «' + u.usuario + '» y ' + (n ? 'sus ' + n + (n === 1 ? ' banco' : ' bancos') : 'su cuenta') +
      '. Sus enlaces de juego dejarán de funcionar. No se puede deshacer.' +
      (n ? ' Si quieres conservar algún banco, cópialo antes al banco general.' : ''),
      'Sí, borrarlo todo', true).then(function (si) {
        if (!si) return;
        ocupado(true);
        return Store.admin.borrarUsuario(id).then(function () {
          Sonido.click();
          if (actual === id) volver();
          return cargarUsuarios();
        });
      }).catch(fallo('No se ha podido borrar el usuario')).then(function () { ocupado(false); });
  }

  /* ---------------- bancos de un usuario ---------------- */
  function abrirUsuario(id) {
    var u = usuario(id);
    if (!u) return;
    Sonido.click();
    actual = id;
    marcados = {};
    $('usTitulo').textContent = '📂 Bancos de ' + u.usuario;
    $('usVista').classList.add('oculto');
    $('usDetalle').classList.remove('oculto');
    $('usVolver').classList.remove('oculto');
    $('usBancos').innerHTML = '<div class="vacia">Cargando…</div>';
    cargarBancos();
    FX.repetir($('usDetalle'), 'reentra', 400);
  }

  function volver() {
    actual = null;
    $('usTitulo').textContent = '👥 Usuarios';
    $('usVista').classList.remove('oculto');
    $('usDetalle').classList.add('oculto');
    $('usVolver').classList.add('oculto');
    $('usPie').textContent = USUARIOS.length + (USUARIOS.length === 1 ? ' usuario' : ' usuarios') +
      ' · pulsa en uno para ver sus bancos';
  }

  function cargarBancos() {
    if (!actual) return Promise.resolve();
    ocupado(true);
    return Store.admin.bancosDe(actual).then(function (l) {
      BANCOS = l || [];
      Object.keys(marcados).forEach(function (k) {
        if (!BANCOS.some(function (b) { return b.id === k; })) delete marcados[k];
      });
      pintarBancos();
    }).catch(function (err) {
      $('usBancos').innerHTML = '<div class="vacia">No se han podido leer: ' + escapar(err.message) + '</div>';
    }).then(function () { ocupado(false); });
  }

  function pintarBancos() {
    var cont = $('usBancos');
    if (!BANCOS.length) {
      cont.innerHTML = '<div class="vacia">Este usuario no tiene bancos.</div>';
    } else {
      cont.innerHTML = BANCOS.map(function (b) {
        return '<div class="bancoFila selFila' + (marcados[b.id] ? ' marcada' : '') + '">' +
          '<label class="selCaja"><input type="checkbox" data-marca="' + escapar(b.id) + '"' +
            (marcados[b.id] ? ' checked' : '') + '>' +
          '<span><b>' + (b.tipo === 'rosco' ? '🔵 ' : '🏆 ') + escapar(b.titulo) + '</b><br>' +
          '<span class="meta">' + escapar(b.resumen) + '</span></span></label>' +
          '<div class="acc">' +
            '<button class="mini" data-uno="editar" data-id="' + escapar(b.id) + '" title="Abrir en el editor">✏️</button>' +
            '<button class="mini" data-uno="renombrar" data-id="' + escapar(b.id) + '" title="Renombrar">🏷</button>' +
            '<button class="mini" data-uno="copiar" data-id="' + escapar(b.id) + '" title="Copiar al banco general">⇪</button>' +
            '<button class="mini rojo" data-uno="borrar" data-id="' + escapar(b.id) + '" title="Borrar">🗑</button>' +
          '</div></div>';
      }).join('');
    }
    [].slice.call(cont.querySelectorAll('[data-marca]')).forEach(function (c) {
      c.onchange = function () {
        if (c.checked) marcados[c.dataset.marca] = 1; else delete marcados[c.dataset.marca];
        c.closest('.bancoFila').classList.toggle('marcada', c.checked);
        pintarSeleccion();
      };
    });
    [].slice.call(cont.querySelectorAll('[data-uno]')).forEach(function (b) {
      b.onclick = function () {
        var ids = [b.dataset.id];
        if (b.dataset.uno === 'editar') { Sonido.click(); Editor.abrir({ id: ids[0], volver: 'importar' }); return; }
        if (b.dataset.uno === 'renombrar') renombrar(ids);
        if (b.dataset.uno === 'copiar') copiar(ids);
        if (b.dataset.uno === 'borrar') borrar(ids);
      };
    });
    pintarSeleccion();
  }

  function seleccion() { return Object.keys(marcados); }
  function pintarSeleccion() {
    var n = seleccion().length;
    $('usCuenta').textContent = n ? n + (n === 1 ? ' seleccionado' : ' seleccionados') : 'Ninguno seleccionado';
    ['usRenombrar', 'usCopiar', 'usBorrar'].forEach(function (id) { $(id).disabled = !n; });
    var todos = $('usTodos');
    todos.checked = !!BANCOS.length && n === BANCOS.length;
    todos.indeterminate = n > 0 && n < BANCOS.length;
    $('usPie').textContent = BANCOS.length + (BANCOS.length === 1 ? ' banco' : ' bancos') +
      ' · marca varios para actuar sobre todos a la vez';
  }
  function titulo(id) {
    var b = BANCOS.filter(function (x) { return x.id === id; })[0];
    return b ? b.titulo : '';
  }
  function lista(ids) {
    return ids.length === 1 ? '«' + titulo(ids[0]) + '»'
      : ids.length + ' bancos (' + ids.map(titulo).slice(0, 4).join(', ') + (ids.length > 4 ? '…' : '') + ')';
  }

  /* renombrar de uno en uno, aunque se hayan marcado varios */
  function renombrar(ids) {
    Sonido.click();
    var i = 0;
    function siguiente() {
      if (i >= ids.length) return cargarBancos();
      var id = ids[i++];
      return Dialogo.pedir({
        titulo: '✏️ Renombrar' + (ids.length > 1 ? ' (' + i + ' de ' + ids.length + ')' : ''),
        texto: 'Nombre nuevo para «' + titulo(id) + '».',
        campo: true, valor: titulo(id), aceptar: ids.length > 1 && i < ids.length ? 'Guardar y seguir' : 'Guardar',
        comprobar: function (v) { return v.trim() ? '' : 'Escribe un nombre.'; }
      }).then(function (v) {
        if (v === null) return cargarBancos();          // cancelar corta la ronda
        return Store.renombrar(id, v.trim()).then(siguiente);
      });
    }
    siguiente().catch(fallo('No se ha podido renombrar')).then(cargarBancos);
  }

  function copiar(ids) {
    Sonido.click();
    Dialogo.confirmar('⇪ Copiar al banco general',
      'Se hará una copia de ' + lista(ids) + ' en el banco general, que ve todo el mundo. ' +
      'El usuario conserva los suyos.', 'Copiar').then(function (si) {
        if (!si) return;
        ocupado(true);
        return Store.admin.copiarAlGeneral(ids).then(function (n) {
          Sonido.ok();
          FX.lluvia(40);
          Dialogo.avisar('Copiados', (n === 1 ? 'Se ha copiado 1 banco' : 'Se han copiado ' + n + ' bancos') +
            ' al banco general.');
          if (global.Importar) Importar.cargarLista();
          if (global.Menu) Menu.cargar();
        });
      }).catch(fallo('No se ha podido copiar')).then(function () { ocupado(false); });
  }

  function borrar(ids) {
    Sonido.click();
    Dialogo.confirmar('🗑 Borrar', 'Se borrará ' + lista(ids) + '. No se puede deshacer.',
      'Sí, borrar', true).then(function (si) {
        if (!si) return;
        ocupado(true);
        return Store.borrar(ids).then(function () {
          ids.forEach(function (id) { delete marcados[id]; });
          return Promise.all([cargarBancos(), cargarUsuarios()]);
        });
      }).catch(fallo('No se ha podido borrar')).then(function () { ocupado(false); });
  }

  /* ---------------- entrada ---------------- */
  function entrar() {
    if (!Store.esAdmin()) return;
    volver();
    cargarUsuarios();
  }

  function conectar() {
    $('usVolver').onclick = function () { Sonido.click(); volver(); cargarUsuarios(); };
    $('usRecargar').onclick = function () {
      Sonido.click();
      (actual ? Promise.all([cargarUsuarios(), cargarBancos()]) : cargarUsuarios());
    };
    $('usTodos').onchange = function () {
      var on = this.checked;
      marcados = {};
      if (on) BANCOS.forEach(function (b) { marcados[b.id] = 1; });
      pintarBancos();
    };
    $('usRenombrar').onclick = function () { renombrar(seleccion()); };
    $('usCopiar').onclick = function () { copiar(seleccion()); };
    $('usBorrar').onclick = function () { borrar(seleccion()); };
  }

  return { conectar: conectar, entrar: entrar };

})(window);
