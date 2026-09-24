/* =========================================================
   Nube · conexión con Supabase y cuentas de usuario
   ---------------------------------------------------------
   · El registro solo pide usuario y contraseña. Supabase necesita
     un correo, así que se usa uno interno que nadie lee:
     «usuario@usuarios.juegosdeaula.invalid» (.invalid es un dominio
     reservado: no existe ni existirá).
   · Las contraseñas no pasan nunca por nuestras tablas: las guarda
     Supabase Auth cifradas.
   · La sesión se guarda en sessionStorage (se cierra con el
     navegador) salvo que se marque «Mantener la sesión», que usa
     localStorage. En los ordenadores de clase, mejor lo primero.
   ========================================================= */
window.Nube = (function (global) {

  var cfg = global.CONFIG || {};
  var K_RECORDAR = 'juegosdeaula.recordar';
  var PATRON = /^[a-z0-9][a-z0-9._-]{2,19}$/;

  var configurada = !!(cfg.SUPABASE_URL && /^https?:\/\//.test(cfg.SUPABASE_URL) &&
    !/TU-PROYECTO/.test(cfg.SUPABASE_URL) &&
    cfg.SUPABASE_CLAVE && !/PEGA-AQUI/.test(cfg.SUPABASE_CLAVE) &&
    global.supabase && global.supabase.createClient);

  function recordar(v) {
    try {
      if (v === undefined) return localStorage.getItem(K_RECORDAR) === '1';
      if (v) localStorage.setItem(K_RECORDAR, '1'); else localStorage.removeItem(K_RECORDAR);
    } catch (e) { return false; }
  }

  /* almacén de la sesión: decide sesión corta o larga */
  var almacen = {
    getItem: function (k) {
      try { return sessionStorage.getItem(k) || localStorage.getItem(k); } catch (e) { return null; }
    },
    setItem: function (k, v) {
      try {
        if (recordar()) { localStorage.setItem(k, v); sessionStorage.removeItem(k); }
        else { sessionStorage.setItem(k, v); localStorage.removeItem(k); }
      } catch (e) {}
    },
    removeItem: function (k) {
      try { sessionStorage.removeItem(k); localStorage.removeItem(k); } catch (e) {}
    }
  };

  var db = null;
  if (configurada) {
    try {
      db = global.supabase.createClient(cfg.SUPABASE_URL.replace(/\/+$/, ''), cfg.SUPABASE_CLAVE, {
        auth: {
          storage: almacen,
          storageKey: 'juegosdeaula.sesion',
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: false
        }
      });
    } catch (e) { configurada = false; db = null; }
  }

  /* ---------------- usuario actual ---------------- */
  var yo = null;                 // {id, usuario, admin}
  var listoPromesa = null;

  function avisar() {
    document.documentElement.classList.toggle('conCuenta', !!yo);
    document.documentElement.classList.toggle('esAdmin', !!(yo && yo.admin));
    try { document.dispatchEvent(new CustomEvent('cuenta', { detail: yo })); } catch (e) {}
  }

  function cargarPerfil(user) {
    if (!user) { yo = null; return Promise.resolve(null); }
    return db.from('perfiles').select('usuario, es_admin').eq('id', user.id).maybeSingle()
      .then(function (r) {
        if (r.error) throw r.error;
        var usuario = r.data ? r.data.usuario : String(user.email || '').split('@')[0];
        yo = { id: user.id, usuario: usuario, admin: !!(r.data && r.data.es_admin) };
        return yo;
      })
      .catch(function () {
        yo = { id: user.id, usuario: String(user.email || '').split('@')[0], admin: false };
        return yo;
      });
  }

  function iniciar() {
    if (listoPromesa) return listoPromesa;
    if (!configurada) { listoPromesa = Promise.resolve(null); avisar(); return listoPromesa; }
    listoPromesa = db.auth.getSession()
      .then(function (r) { return cargarPerfil(r.data && r.data.session && r.data.session.user); })
      .catch(function () { yo = null; return null; })
      .then(function (u) { avisar(); return u; });

    db.auth.onAuthStateChange(function (evento) {
      if (evento === 'SIGNED_OUT') { yo = null; avisar(); }
    });
    return listoPromesa;
  }

  /* ---------------- mensajes de error en castellano ---------------- */
  function traducir(err) {
    var m = String((err && (err.message || err.error_description || err.msg)) || err || '');
    var code = err && (err.code || err.error_code) || '';
    if (/invalid login credentials|invalid_credentials/i.test(m + code)) return 'Usuario o contraseña incorrectos.';
    if (/already registered|user_already_exists|already been registered/i.test(m + code)) return 'Ese nombre de usuario ya está cogido. Prueba con otro.';
    if (/database error saving new user/i.test(m)) return 'No se ha podido crear el usuario: revisa que el nombre solo tenga letras sin tildes, números, punto o guion.';
    if (/password.*(at least|characters)|weak_password/i.test(m + code)) return 'La contraseña es demasiado corta o sencilla.';
    if (/email not confirmed|email_not_confirmed/i.test(m + code)) return 'Falta un paso en Supabase: desactiva «Confirm email» (mira la guía).';
    if (/signups? not allowed|signup_disabled/i.test(m + code)) return 'El registro de usuarios está desactivado en Supabase.';
    if (/rate limit|too many|over_request_rate_limit|over_email_send_rate_limit/i.test(m + code)) return 'Demasiados intentos seguidos. Espera unos minutos y vuelve a probar.';
    if (/email.*invalid|email_address_invalid/i.test(m + code)) return 'Supabase no acepta el correo interno: revisa DOMINIO_USUARIOS en la guía.';
    if (/failed to fetch|networkerror|load failed/i.test(m)) return 'No hay conexión con la base de datos. Revisa internet (o el filtro de la red del centro).';
    if (/jwt|permission denied|42501/i.test(m + code)) return 'No tienes permiso para hacer eso. Vuelve a entrar con tu usuario.';
    return m || 'Error desconocido';
  }
  function fallo(err) { var e = new Error(traducir(err)); e.original = err; return e; }

  function correo(usuario) { return usuario + '@' + (cfg.DOMINIO_USUARIOS || 'usuarios.juegosdeaula.invalid'); }

  function limpiarUsuario(u) { return String(u || '').trim().toLowerCase(); }
  function validarUsuario(u) {
    u = limpiarUsuario(u);
    if (!u) return 'Escribe un nombre de usuario.';
    if (u.length < 3) return 'El usuario necesita al menos 3 caracteres.';
    if (u.length > 20) return 'El usuario puede tener como mucho 20 caracteres.';
    if (!PATRON.test(u)) return 'Usa solo letras sin tildes ni ñ, números, punto, guion o guion bajo (y que empiece por letra o número).';
    return '';
  }
  function validarClave(c) {
    c = String(c || '');
    if (c.length < 8) return 'La contraseña necesita al menos 8 caracteres.';
    if (c.length > 72) return 'La contraseña es demasiado larga (máximo 72).';
    return '';
  }

  function necesitaNube() {
    if (!configurada) return Promise.reject(new Error('La web aún no está conectada a Supabase (falta rellenar js/config.js).'));
    return null;
  }

  function entrar(usuario, clave, mantener) {
    var n = necesitaNube(); if (n) return n;
    var err = validarUsuario(usuario); if (err) return Promise.reject(new Error(err));
    recordar(!!mantener);
    return db.auth.signInWithPassword({ email: correo(limpiarUsuario(usuario)), password: String(clave || '') })
      .then(function (r) {
        if (r.error) throw r.error;
        return cargarPerfil(r.data.user);
      })
      .then(function (u) { avisar(); return u; })
      .catch(function (e) { throw fallo(e); });
  }

  function registrar(usuario, clave, mantener) {
    var n = necesitaNube(); if (n) return n;
    var err = validarUsuario(usuario) || validarClave(clave);
    if (err) return Promise.reject(new Error(err));
    recordar(!!mantener);
    var u = limpiarUsuario(usuario);
    return db.auth.signUp({ email: correo(u), password: String(clave) })
      .then(function (r) {
        if (r.error) throw r.error;
        /* Supabase no avisa de un usuario repetido cuando la confirmación
           por correo está activa: devuelve un usuario sin identidades. */
        if (r.data && r.data.user && r.data.user.identities && !r.data.user.identities.length) {
          throw new Error('User already registered');
        }
        if (!r.data.session) {
          throw new Error('Email not confirmed');
        }
        return cargarPerfil(r.data.user);
      })
      .then(function (x) { avisar(); return x; })
      .catch(function (e) { throw fallo(e); });
  }

  function salir() {
    if (!configurada) return Promise.resolve();
    return db.auth.signOut().catch(function () {})
      .then(function () {
        yo = null;
        almacen.removeItem('juegosdeaula.sesion');
        avisar();
      });
  }

  function cambiarClave(nueva) {
    var n = necesitaNube(); if (n) return n;
    var err = validarClave(nueva); if (err) return Promise.reject(new Error(err));
    return db.auth.updateUser({ password: String(nueva) })
      .then(function (r) { if (r.error) throw r.error; return true; })
      .catch(function (e) { throw fallo(e); });
  }

  return {
    get configurada() { return configurada; },
    get db() { return db; },
    iniciar: iniciar,
    usuario: function () { return yo; },
    esAdmin: function () { return !!(yo && yo.admin); },
    entrar: entrar,
    registrar: registrar,
    salir: salir,
    cambiarClave: cambiarClave,
    recordar: recordar,
    validarUsuario: validarUsuario,
    validarClave: validarClave,
    limpiarUsuario: limpiarUsuario,
    traducir: traducir,
    fallo: fallo
  };

})(window);
