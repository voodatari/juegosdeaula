/* =========================================================
   Cuenta · botones «Entrar» y «Registrarse» de la pantalla de
   título, ventana de acceso y menú del usuario.
   ========================================================= */
window.Cuenta = (function (global) {

  var $ = function (id) { return document.getElementById(id); };
  var modo = 'entrar';          // entrar | registro

  function escapar(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  /* ---------------- barra de la esquina ---------------- */
  function pintarBarra() {
    var bar = $('cuentaBar');
    if (!bar) return;
    var yo = Nube.usuario();
    if (!yo) {
      bar.innerHTML =
        '<button class="chip" id="cbEntrar">🔑 Entrar</button>' +
        '<button class="chip on" id="cbRegistro">✨ Registrarse</button>';
      $('cbEntrar').onclick = function () { Sonido.click(); abrir('entrar'); };
      $('cbRegistro').onclick = function () { Sonido.click(); abrir('registro'); };
      return;
    }
    bar.innerHTML =
      '<div class="cbMenu">' +
        '<button class="chip cbYo" id="cbYo" aria-haspopup="true" aria-expanded="false">👤 ' +
          escapar(yo.usuario) + (yo.admin ? ' <span class="cbAdmin">ADMIN</span>' : '') + ' ▾</button>' +
        '<div class="cbLista oculto" id="cbLista" role="menu">' +
          '<button class="cbOp" id="cbGestion">⬆ ' + (yo.admin ? 'Banco general y usuarios' : 'Mis bancos de preguntas') + '</button>' +
          '<button class="cbOp" id="cbClave">🔑 Cambiar mi contraseña</button>' +
          '<button class="cbOp" id="cbSalir">🚪 Salir</button>' +
        '</div>' +
      '</div>';
    $('cbYo').onclick = function (e) {
      e.stopPropagation();
      Sonido.click();
      var l = $('cbLista'), abrirla = l.classList.contains('oculto');
      l.classList.toggle('oculto', !abrirla);
      this.setAttribute('aria-expanded', abrirla ? 'true' : 'false');
    };
    $('cbGestion').onclick = function () { cerrarMenu(); Sonido.click(); App.ir('importar'); };
    $('cbClave').onclick = function () { cerrarMenu(); cambiarClave(); };
    $('cbSalir').onclick = function () {
      cerrarMenu();
      Sonido.click();
      Nube.salir();
    };
  }
  function cerrarMenu() {
    var l = $('cbLista');
    if (l) l.classList.add('oculto');
    var b = $('cbYo');
    if (b) b.setAttribute('aria-expanded', 'false');
  }

  /* ---------------- ventana de acceso ---------------- */
  function capa() {
    var c = $('capaCuenta');
    if (c) return c;
    c = document.createElement('div');
    c.className = 'capa';
    c.id = 'capaCuenta';
    c.innerHTML =
      '<form class="caja caja-izq dlg cuentaCaja" id="cuForm" autocomplete="on" novalidate>' +
        '<h2 id="cuTit"></h2>' +
        '<p class="sub" id="cuSub"></p>' +
        '<label for="cuUsuario">Usuario</label>' +
        '<input class="campo cuCampo" id="cuUsuario" name="username" autocomplete="username" ' +
          'autocapitalize="none" spellcheck="false" maxlength="20">' +
        '<label for="cuClave">Contraseña</label>' +
        '<div class="cuClaveFila">' +
          '<input class="campo cuCampo" id="cuClave" name="password" type="password" maxlength="72">' +
          '<button type="button" class="mini" id="cuVer" title="Ver la contraseña" aria-label="Ver la contraseña">👁</button>' +
        '</div>' +
        '<p class="tenue cuPista" id="cuPista"></p>' +
        '<label class="cuMantener"><input type="checkbox" id="cuMantener"> ' +
          'Mantener la sesión abierta en este ordenador</label>' +
        '<p class="aviso mal oculto" id="cuMal"></p>' +
        '<div class="botones reparto" style="margin-top:4px">' +
          '<div class="grupo"><button type="button" class="btn" id="cuNo">Cancelar</button></div>' +
          '<div class="grupo"><button type="submit" class="btn principal" id="cuSi"></button></div>' +
        '</div>' +
        '<p class="cuCambio"><span id="cuOtroTxt"></span> <a href="#" id="cuOtro"></a></p>' +
      '</form>';
    document.body.appendChild(c);

    $('cuForm').onsubmit = function (e) { e.preventDefault(); enviar(); };
    $('cuNo').onclick = function () { Sonido.click(); cerrar(); };
    $('cuOtro').onclick = function (e) {
      e.preventDefault();
      Sonido.click();
      ponerModo(modo === 'entrar' ? 'registro' : 'entrar');
    };
    $('cuVer').onclick = function () {
      var campo = $('cuClave'), ver = campo.type === 'password';
      campo.type = ver ? 'text' : 'password';
      this.textContent = ver ? '🙈' : '👁';
      campo.focus();
    };
    $('cuUsuario').addEventListener('input', function () {
      /* el usuario va siempre en minúsculas y sin espacios */
      var v = this.value, limpio = v.toLowerCase().replace(/\s+/g, '');
      if (v !== limpio) this.value = limpio;
    });
    c.addEventListener('mousedown', function (e) { if (e.target === c) cerrar(); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && c.classList.contains('ver')) { e.stopPropagation(); cerrar(); }
    }, true);
    return c;
  }

  function ponerModo(m) {
    modo = m;
    var reg = m === 'registro';
    $('cuTit').textContent = reg ? '✨ Crear una cuenta' : '🔑 Entrar';
    $('cuSub').textContent = reg
      ? 'Solo hace falta un nombre de usuario y una contraseña. Con tu cuenta tendrás tus propios bancos de preguntas.'
      : 'Entra con tu usuario para usar y gestionar tus bancos de preguntas.';
    $('cuSi').textContent = reg ? 'Crear la cuenta' : 'Entrar';
    $('cuPista').textContent = reg
      ? 'Usuario: de 3 a 20 letras (sin tildes ni ñ), números, punto o guion. Contraseña: 8 caracteres como mínimo. ' +
        'Apúntala: no hay correo para recuperarla (el administrador puede ponerte una nueva).'
      : '';
    $('cuPista').classList.toggle('oculto', !reg);
    $('cuClave').setAttribute('autocomplete', reg ? 'new-password' : 'current-password');
    $('cuOtroTxt').textContent = reg ? '¿Ya tienes cuenta?' : '¿Aún no tienes cuenta?';
    $('cuOtro').textContent = reg ? 'Entra' : 'Regístrate';
    $('cuMal').classList.add('oculto');
  }

  function abrir(m) {
    var c = capa();
    if (!Nube.configurada) {
      Dialogo.avisar('Falta conectar la base de datos',
        'Esta web todavía no está enlazada con Supabase: hay que rellenar js/config.js ' +
        '(mira la guía GUIA-SUPABASE). Mientras tanto se juega con los bancos de ejemplo.');
      return;
    }
    ponerModo(m || 'entrar');
    $('cuUsuario').value = '';
    $('cuClave').value = '';
    $('cuClave').type = 'password';
    $('cuVer').textContent = '👁';
    $('cuMantener').checked = Nube.recordar();
    ocupado(false);
    c.classList.add('ver');
    setTimeout(function () { $('cuUsuario').focus(); }, 60);
  }
  function cerrar() { var c = $('capaCuenta'); if (c) c.classList.remove('ver'); }

  function ocupado(si) {
    $('cuSi').disabled = si;
    $('cuNo').disabled = si;
    $('cuForm').classList.toggle('ocupada', si);
    if (si) $('cuSi').textContent = modo === 'registro' ? 'Creando…' : 'Entrando…';
    else $('cuSi').textContent = modo === 'registro' ? 'Crear la cuenta' : 'Entrar';
  }
  function error(txt) {
    var m = $('cuMal');
    m.textContent = txt;
    m.classList.remove('oculto');
    FX.repetir($('cuForm'), 'tiembla', 400);
  }

  function enviar() {
    var u = Nube.limpiarUsuario($('cuUsuario').value);
    var c = $('cuClave').value;
    var err = Nube.validarUsuario(u) || (modo === 'registro' ? Nube.validarClave(c) : (c ? '' : 'Escribe la contraseña.'));
    if (err) { error(err); return; }
    $('cuMal').classList.add('oculto');
    ocupado(true);
    var accion = modo === 'registro' ? Nube.registrar : Nube.entrar;
    accion(u, c, $('cuMantener').checked).then(function (yo) {
      ocupado(false);
      cerrar();
      Sonido.ok(600);
      FX.lluvia(50);
      if (modo === 'registro') {
        Dialogo.avisar('✨ ¡Bienvenido, ' + yo.usuario + '!',
          'Tu cuenta está lista. Ahora en el menú aparece «⬆ Gestionar Preguntas»: ahí puedes ' +
          'añadir tus propios bancos. Hasta entonces se juega con el banco general.');
      }
    }).catch(function (e) {
      ocupado(false);
      error(e.message);
    });
  }

  /* ---------------- cambiar la contraseña propia ---------------- */
  function cambiarClave() {
    Sonido.click();
    Dialogo.pedir({
      titulo: '🔑 Cambiar mi contraseña',
      texto: 'Escribe la contraseña nueva (8 caracteres como mínimo).',
      campo: true, clave: true, pista: 'contraseña nueva', aceptar: 'Cambiarla',
      comprobar: function (v) { return Nube.validarClave(v); }
    }).then(function (v) {
      if (v === null) return;
      return Nube.cambiarClave(v).then(function () {
        Sonido.ok(600);
        return Dialogo.avisar('Contraseña cambiada', 'A partir de ahora entra con la contraseña nueva.');
      });
    }).catch(function (e) {
      Dialogo.avisar('No se ha podido cambiar', e.message);
    });
  }

  function conectar() {
    pintarBarra();
    document.addEventListener('cuenta', pintarBarra);
    document.addEventListener('click', function (e) {
      if (!e.target.closest || !e.target.closest('.cbMenu')) cerrarMenu();
    });
  }

  return { conectar: conectar, abrir: abrir };

})(window);
