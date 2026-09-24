/* =========================================================
   Capa de datos (versión multiusuario, con Supabase)
   ---------------------------------------------------------
   · Sin sesión: se ve el BANCO GENERAL (bancos públicos).
   · Con sesión: cada usuario ve y gestiona SUS bancos, y además
     puede jugar con los del banco general.
   · El administrador gestiona el banco general y los usuarios.
   · Enlace de juego: «?jugar=<enlace>» abre un banco concreto de
     cualquier usuario sin iniciar sesión (solo ese banco).

   Quién puede leer o tocar qué no lo decide este archivo: lo
   deciden las reglas de la base (supabase/esquema.sql). Aunque
   alguien cambie este código en su navegador, la base no le
   dejará ver ni tocar lo que no es suyo.

   Si Supabase no está configurado o no responde, la web sigue
   funcionando con los bancos de ejemplo del proyecto y con la
   última copia guardada del banco general.
   ========================================================= */
(function (global) {

  var K_CACHE = 'juegosdeaula.cache.';
  var K_ELEGIDO = 'trivialaula.elegido.';
  var K_EQUIPOS = 'trivialaula.equipos.';
  var ID_ALEATORIO = 'aleatorio-trivial';
  var COLUMNAS = 'id, tipo, titulo, publico, propietario, enlace, n1, n2, actualizado';

  function ls(k, v) {
    try {
      if (v === undefined) return localStorage.getItem(k);
      if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v);
    } catch (e) { return null; }
  }

  var Store = {
    get configurado() { return Nube.configurada; }
  };

  /* ---------- sesión ---------- */
  Store.listo = function () { return Nube.iniciar(); };
  Store.usuario = function () { return Nube.usuario(); };
  Store.esAdmin = function () { return Nube.esAdmin(); };
  Store.conSesion = function () { return !!Nube.usuario(); };

  function db() {
    if (!Nube.configurada || !Nube.db) throw new Error('La web aún no está conectada a Supabase (falta rellenar js/config.js).');
    return Nube.db;
  }
  function exigirSesion() {
    if (!Nube.usuario()) return Promise.reject(new Error('Tienes que entrar con tu usuario.'));
    return null;
  }
  function exigirAdmin() {
    if (!Nube.esAdmin()) return Promise.reject(new Error('Solo el administrador puede hacer eso.'));
    return null;
  }
  /* convierte {data, error} de Supabase en promesa normal */
  function r(p) {
    return Promise.resolve(p).then(function (x) {
      if (x && x.error) throw Nube.fallo(x.error);
      return x ? x.data : null;
    }, function (e) { throw Nube.fallo(e); });
  }

  /* ---------- utilidades ---------- */
  function sinTildes(s) {
    return (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '');
  }
  function esUuid(s) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(s || ''));
  }

  /* ---------- bancos de ejemplo que vienen con el proyecto ---------- */
  var EJEMPLOS = [
    { id: 'ejemplo-trivial', tipo: 'trivial', titulo: 'Trivial 5º Primaria',
      archivo: 'data/trivial-ejemplo.json', resumen: '28 test · 12 escritas' },
    { id: 'ejemplo-rosco', tipo: 'rosco', titulo: 'El Rosco de 5º Primaria',
      archivo: 'data/rosco-ejemplo.json', resumen: '4 roscos · 25 letras' }
  ];

  function ejemplo(id) {
    var e = EJEMPLOS.filter(function (x) { return x.id === id; })[0];
    if (!e) return Promise.reject(new Error('No existe ese banco'));
    return fetch(e.archivo).then(function (r) { return r.json(); })
      .then(function (b) { b.id = e.id; b.tipo = e.tipo; b.origen = 'ejemplo'; return b; });
  }
  function ejemplosDe(tipos) {
    return EJEMPLOS.filter(function (e) { return tipos.indexOf(e.tipo) >= 0; }).map(function (e) {
      return { id: e.id, tipo: e.tipo, titulo: e.titulo, origen: 'ejemplo', resumen: e.resumen };
    });
  }

  /* ---------- índice ---------- */
  function resumen(tipo, b) {
    return tipo === 'trivial'
      ? (b.test || []).length + ' test · ' + (b.escritas || []).length + ' escritas'
      : (b.roscos || []).length + ' roscos · ' +
        ((b.roscos && b.roscos[0] && b.roscos[0].letras.length) || 0) + ' letras';
  }
  function resumenFila(f) {
    return f.tipo === 'trivial' ? f.n1 + ' test · ' + f.n2 + ' escritas'
                                : f.n1 + ' roscos · ' + f.n2 + ' letras';
  }
  function fila(f, yo) {
    return {
      id: f.id, tipo: f.tipo, titulo: f.titulo, enlace: f.enlace, publico: !!f.publico,
      origen: f.publico ? 'general' : (yo && f.propietario === yo.id ? 'propio' : 'otro'),
      resumen: resumenFila(f), n1: f.n1, n2: f.n2
    };
  }

  /* Los ejemplos del proyecto solo aparecen si el banco general no tiene
     nada de ese juego: así nunca se queda el menú vacío. */
  function conEjemplos(lista) {
    var faltan = ['trivial', 'rosco'].filter(function (t) {
      return !lista.some(function (b) { return b.tipo === t && b.origen !== 'propio'; });
    });
    return lista.concat(ejemplosDe(faltan));
  }

  var ultimoIndice = [];

  Store.indice = function () {
    if (!Nube.configurada) {
      ultimoIndice = ejemplosDe(['trivial', 'rosco']);
      return Promise.resolve({ fuente: 'local', bancos: ultimoIndice });
    }
    return Store.listo().then(function () {
      var yo = Nube.usuario();
      var q = db().from('bancos').select(COLUMNAS);
      /* el administrador ve TODO por las reglas; en el menú solo quiere el
         banco general. Un usuario ve el suyo y el general. */
      if (!yo || yo.admin) q = q.eq('publico', true);
      else q = q.or('publico.eq.true,propietario.eq.' + yo.id);
      return r(q.order('titulo', { ascending: true })).then(function (filas) {
        var lista = (filas || []).map(function (f) { return fila(f, yo); });
        /* primero los propios, luego el general */
        lista.sort(function (a, b) {
          return (a.origen === 'propio' ? 0 : 1) - (b.origen === 'propio' ? 0 : 1) ||
            a.titulo.localeCompare(b.titulo, 'es');
        });
        ls(K_CACHE + 'indice', JSON.stringify(lista.filter(function (b) { return b.publico; })));
        ultimoIndice = conEjemplos(lista);
        return { fuente: 'nube', bancos: ultimoIndice };
      });
    }).catch(function (err) {
      var cache = [];
      try { cache = JSON.parse(ls(K_CACHE + 'indice') || '[]'); } catch (e) {}
      cache.forEach(function (b) { b.origen = 'caché'; });
      ultimoIndice = conEjemplos(cache);
      return { fuente: 'error', error: err.message, bancos: ultimoIndice };
    });
  };

  Store.info = function (id) {
    return ultimoIndice.filter(function (b) { return b.id === id; })[0] || null;
  };

  /* ---------- un banco ---------- */
  var enMemoria = {};          // aleatorio y bancos abiertos por enlace

  /* la prueba del editor: un banco que solo vive en memoria */
  Store.temporal = function (banco) {
    var id = 'temporal-' + (banco.tipo === 'rosco' ? 'rosco' : 'trivial');
    var b = JSON.parse(JSON.stringify(banco));
    b.id = id; b.origen = 'temporal';
    enMemoria[id] = b;
    return id;
  };

  /* ---------- roscos barajados ----------
     Un banco de rosco trae varios roscos (uno por equipo) y siempre
     salían en el mismo orden. Al elegir el banco en el menú se
     reparten las definiciones entre los roscos: para cada letra, las
     definiciones de esa letra se mezclan y se da una a cada rosco. Así
     dos equipos nunca comparten pregunta y cada partida es distinta.
     El reparto se guarda aquí para que el PDF de soluciones y el juego
     usen exactamente el mismo. */
  var barajados = {};

  function revolver(a) {
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1)), t = a[i];
      a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  Store.barajarRoscos = function (banco) {
    var b = JSON.parse(JSON.stringify(banco));
    if (!b.roscos || b.roscos.length < 2) return b;
    /* todas las definiciones agrupadas por letra */
    var porLetra = {};
    b.roscos.forEach(function (r) {
      (r.letras || []).forEach(function (x) {
        (porLetra[x.l] = porLetra[x.l] || []).push(x);
      });
    });
    Object.keys(porLetra).forEach(function (L) { revolver(porLetra[L]); });
    /* cada rosco toma una de las de su letra, sin repetir */
    var tomadas = {};
    b.roscos.forEach(function (r) {
      r.letras = (r.letras || []).map(function (x) {
        var i = tomadas[x.l] || 0;
        tomadas[x.l] = i + 1;
        return JSON.parse(JSON.stringify(porLetra[x.l][i]));
      });
    });
    return b;
  };

  /* prepara (y guarda) el reparto de un banco de rosco */
  Store.sembrarRosco = function (id) {
    if (!id) return Promise.reject(new Error('Falta el identificador del banco'));
    var p = Store.banco(id).then(function (b) {
      return (b && b.roscos && b.roscos.length > 1) ? Store.barajarRoscos(b) : b;
    });
    barajados[id] = p;
    p.catch(function () { if (barajados[id] === p) delete barajados[id]; });
    return p;
  };

  /* el banco tal como se va a jugar y a imprimir */
  Store.bancoJuego = function (id) {
    var p = barajados[id] || Store.sembrarRosco(id);
    return p.then(function (b) { return JSON.parse(JSON.stringify(b)); });
  };

  Store.olvidarBarajado = function (id) {
    if (id) delete barajados[id]; else barajados = {};
  };

  Store.banco = function (id) {
    if (!id) return Promise.reject(new Error('Falta el identificador del banco'));
    if (id.indexOf('temporal-') === 0 && !enMemoria[id]) return Promise.reject(new Error('La prueba del editor ya no está disponible.'));
    if (id.indexOf('ejemplo-') === 0) return ejemplo(id);
    if (enMemoria[id]) return Promise.resolve(JSON.parse(JSON.stringify(enMemoria[id])));
    if (id === ID_ALEATORIO) return Promise.reject(new Error('Elige antes cuántas preguntas aleatorias quieres.'));

    if (id.indexOf('enlace:') === 0) {
      var enlace = id.slice(7);
      if (!esUuid(enlace)) return Promise.reject(new Error('El enlace no es válido.'));
      if (!Nube.configurada) return Promise.reject(new Error('La web no está conectada a la base de datos.'));
      return r(db().rpc('banco_compartido', { p_enlace: enlace })).then(function (d) {
        var f = Array.isArray(d) ? d[0] : d;
        if (!f) throw new Error('Ese enlace ya no funciona: puede que el banco se haya borrado o que su dueño haya cambiado el enlace.');
        var b = Object.assign({}, f.datos, { id: id, tipo: f.tipo, titulo: f.titulo, origen: 'enlace' });
        enMemoria[id] = b;
        return JSON.parse(JSON.stringify(b));
      });
    }

    if (!esUuid(id)) return Promise.reject(new Error('Ese banco ya no existe. Elige otro en el menú.'));
    if (!Nube.configurada) return Promise.reject(new Error('La web no está conectada a la base de datos.'));
    return Store.listo().then(function () {
      return r(db().from('bancos').select('id, tipo, titulo, publico, datos').eq('id', id).maybeSingle());
    }).then(function (f) {
      if (!f) throw new Error('Ese banco no existe o no tienes acceso a él.');
      var b = Object.assign({}, f.datos, { id: f.id, tipo: f.tipo, titulo: f.titulo,
                                          origen: f.publico ? 'general' : 'propio' });
      if (f.publico) ls(K_CACHE + id, JSON.stringify(b));
      return b;
    }).catch(function (err) {
      var c = ls(K_CACHE + id);
      if (c) { var b = JSON.parse(c); b.origen = 'caché'; return b; }
      throw err;
    });
  };

  /* ---------- guardar, renombrar, borrar ---------- */
  function limpiarDatos(banco) {
    var d = JSON.parse(JSON.stringify(banco));
    delete d.id; delete d.origen;
    return d;
  }

  Store.guardar = function (banco) {
    var s = exigirSesion(); if (s) return s;
    var fila = {
      tipo: banco.tipo === 'rosco' ? 'rosco' : 'trivial',
      titulo: String(banco.titulo || '').trim() || 'Sin título',
      datos: limpiarDatos(banco),
      publico: Nube.esAdmin()          // lo que guarda el administrador va al banco general
    };
    return r(db().from('bancos').insert(fila).select('id').single())
      .then(function (f) { return { ok: true, id: f.id, destino: fila.publico ? 'general' : 'propio' }; });
  };

  /* ¿se puede sobrescribir este banco desde el editor? */
  Store.editable = function (id) { return esUuid(id) && Store.conSesion(); };
  /* Sustituye un banco guardado por su versión editada. Las reglas de la
     base deciden si es tuyo (o si eres el administrador). */
  Store.actualizar = function (id, banco) {
    var s = exigirSesion(); if (s) return s;
    if (!esUuid(id)) return Promise.reject(new Error('Este banco no se puede sobrescribir; guárdalo como uno nuevo.'));
    var cambios = { titulo: String(banco.titulo || '').trim() || 'Sin título', datos: limpiarDatos(banco) };
    return r(db().from('bancos').update(cambios).eq('id', id).select('id'))
      .then(function (f) {
        if (!f || !f.length) throw new Error('No tienes permiso para cambiar ese banco.');
        ls(K_CACHE + id, null);
        return { ok: true, id: id };
      });
  };

  Store.renombrar = function (id, titulo) {
    var s = exigirSesion(); if (s) return s;
    titulo = String(titulo || '').trim();
    if (!titulo) return Promise.reject(new Error('El nombre no puede quedar vacío'));
    if (!esUuid(id)) return Promise.reject(new Error('Ese banco no se puede renombrar'));
    return r(db().from('bancos').update({ titulo: titulo }).eq('id', id).select('id'))
      .then(function (f) {
        if (!f || !f.length) throw new Error('No tienes permiso para renombrar ese banco.');
        return { ok: true };
      });
  };

  /* uno o varios a la vez */
  Store.borrar = function (ids) {
    var s = exigirSesion(); if (s) return s;
    ids = [].concat(ids).filter(esUuid);
    if (!ids.length) return Promise.reject(new Error('No hay nada que borrar'));
    return r(db().from('bancos').delete().in('id', ids).select('id'))
      .then(function (f) {
        if (!f || !f.length) throw new Error('No tienes permiso para borrar eso.');
        return { ok: true, borrados: f.length };
      });
  };

  /* el enlace anterior deja de funcionar */
  Store.nuevoEnlace = function (id) {
    var s = exigirSesion(); if (s) return s;
    return r(db().rpc('nuevo_enlace', { p_id: id }));
  };

  /* ---------- enlaces de juego ---------- */
  Store.urlEnlace = function (enlace) {
    var base = location.origin + location.pathname.replace(/index\.html$/, '');
    return base + '?jugar=' + enlace;
  };
  Store.esEnlace = function (id) { return String(id || '').indexOf('enlace:') === 0; };

  /* =========================================================
     Preguntas aleatorias
     Se juntan todas las preguntas de los bancos de trivial del
     usuario (o del banco general si no hay sesión o si el usuario
     aún no tiene bancos), sin repetir enunciados.
     ========================================================= */
  Store.ID_ALEATORIO = ID_ALEATORIO;

  Store.poolAleatorio = function () {
    function juntar(bancos, origen) {
      var vistos = {}, test = [], escritas = [];
      bancos.forEach(function (b) {
        (b.test || []).forEach(function (p) {
          var k = sinTildes(String(p.q || '')).toLowerCase().trim();
          if (!k || vistos[k] || !Array.isArray(p.o) || p.o.length !== 4) return;
          vistos[k] = 1; test.push({ q: p.q, o: p.o.slice(), c: p.c });
        });
        (b.escritas || []).forEach(function (p) {
          var k = sinTildes(String(p.q || '')).toLowerCase().trim();
          if (!k || vistos[k] || !p.a) return;
          vistos[k] = 1; escritas.push({ q: p.q, a: p.a });
        });
      });
      return { test: test, escritas: escritas, origen: origen, bancos: bancos.length };
    }
    function deEjemplo() {
      return ejemplo('ejemplo-trivial').then(function (b) { return juntar([b], 'ejemplo'); });
    }
    if (!Nube.configurada) return deEjemplo();

    return Store.listo().then(function () {
      var yo = Nube.usuario();
      /* con sesión: solo sus bancos; si aún no tiene ninguno, el general */
      if (!yo || yo.admin) return null;
      return r(db().from('bancos').select('datos').eq('tipo', 'trivial').eq('propietario', yo.id))
        .then(function (m) {
          return (m && m.length) ? juntar(m.map(function (x) { return x.datos; }), 'propio') : null;
        });
    }).then(function (res) {
      if (res) return res;
      return r(db().from('bancos').select('datos').eq('tipo', 'trivial').eq('publico', true))
        .then(function (g) {
          if (g && g.length) return juntar(g.map(function (x) { return x.datos; }), 'general');
          return deEjemplo();
        });
    });
  };

  function mezclar(a) {
    for (var j = a.length - 1; j > 0; j--) {
      var k = Math.floor(Math.random() * (j + 1));
      var t = a[j]; a[j] = a[k]; a[k] = t;
    }
    return a;
  }

  Store.crearAleatorio = function (pool, nTest, nEsc) {
    var b = {
      id: ID_ALEATORIO, tipo: 'trivial', origen: 'aleatorio',
      titulo: 'Preguntas aleatorias',
      test: mezclar(pool.test.slice()).slice(0, nTest).map(function (p) {
        return { q: p.q, o: p.o.slice(), c: p.c };
      }),
      escritas: mezclar(pool.escritas.slice()).slice(0, nEsc)
    };
    Store.barajar(b);             // las letras correctas quedan repartidas
    enMemoria[ID_ALEATORIO] = b;
    return b;
  };
  Store.aleatorio = function () { return enMemoria[ID_ALEATORIO] || null; };
  /* al entrar o salir cambian los bancos de los que salen: se olvida la tirada */
  document.addEventListener('cuenta', function () { delete enMemoria[ID_ALEATORIO]; });

  /* =========================================================
     Administración (la base comprueba que de verdad eres admin)
     ========================================================= */
  Store.admin = {
    usuarios: function () {
      var a = exigirAdmin(); if (a) return a;
      return r(db().rpc('admin_usuarios'));
    },
    borrarUsuario: function (id) {
      var a = exigirAdmin(); if (a) return a;
      return r(db().rpc('admin_borrar_usuario', { p_id: id }));
    },
    cambiarClave: function (id, clave) {
      var a = exigirAdmin(); if (a) return a;
      var e = Nube.validarClave(clave); if (e) return Promise.reject(new Error(e));
      return r(db().rpc('admin_cambiar_clave', { p_id: id, p_clave: clave }));
    },
    bancosDe: function (uid) {
      var a = exigirAdmin(); if (a) return a;
      return r(db().from('bancos').select(COLUMNAS).eq('propietario', uid)
        .order('tipo').order('titulo')).then(function (f) {
          return (f || []).map(function (x) { var b = fila(x, null); b.origen = 'usuario'; return b; });
        });
    },
    copiarAlGeneral: function (ids) {
      var a = exigirAdmin(); if (a) return a;
      return r(db().rpc('admin_copiar_al_general', { p_ids: [].concat(ids) }));
    },
    /* Trae al banco general los bancos de la hoja de Google de la versión
       anterior. Solo lee la hoja; no la cambia. Los que ya están (mismo
       juego y mismo nombre) se saltan. */
    migrarHoja: function (progreso) {
      var a = exigirAdmin(); if (a) return a;
      var url = (global.CONFIG || {}).HOJA_ANTIGUA;
      if (!url) return Promise.reject(new Error('No hay hoja antigua configurada.'));
      var hecho = { traidos: 0, saltados: 0, malos: [] };
      return Promise.all([
        leerHoja(url, { accion: 'indice' }),
        r(db().from('bancos').select('tipo, titulo').eq('publico', true))
      ]).then(function (res) {
        var lista = res[0].bancos || [];
        var ya = {};
        (res[1] || []).forEach(function (b) { ya[b.tipo + '|' + b.titulo.trim().toLowerCase()] = 1; });
        var cadena = Promise.resolve();
        lista.forEach(function (x, i) {
          cadena = cadena.then(function () {
            if (progreso) progreso(i + 1, lista.length, x.titulo);
            var clave = x.tipo + '|' + String(x.titulo || '').trim().toLowerCase();
            if (ya[clave]) { hecho.saltados++; return; }
            return leerHoja(url, { accion: 'banco', id: x.id }).then(function (j) {
              var b = j.banco;
              var tipo = b.tipo || x.tipo;
              var v = Store.validar(tipo, b);
              if (!v.ok) { hecho.malos.push(x.titulo + ': ' + v.errores[0]); return; }
              b.tipo = tipo;
              return r(db().from('bancos').insert({
                tipo: tipo, titulo: String(b.titulo || x.titulo).trim(), datos: limpiarDatos(b), publico: true
              })).then(function () { hecho.traidos++; ya[clave] = 1; });
            }).catch(function (e) { hecho.malos.push(x.titulo + ': ' + e.message); });
          });
        });
        return cadena.then(function () { return hecho; });
      });
    }
  };

  /* lectura de la hoja antigua: fetch y, si Google lo corta por CORS, JSONP */
  function leerHoja(api, params) {
    function url(p) { return api + (api.indexOf('?') < 0 ? '?' : '&') + new URLSearchParams(p).toString(); }
    function ok(j) { if (!j || j.ok === false) throw new Error((j && j.error) || 'Respuesta no válida'); return j; }
    return fetch(url(params), { redirect: 'follow' }).then(function (x) { return x.json(); }).then(ok)
      .catch(function () {
        return new Promise(function (bien, mal) {
          var fn = 'jda' + Date.now().toString(36) + Math.floor(Math.random() * 1e4);
          var s = document.createElement('script');
          var t = setTimeout(function () { fin(); mal(new Error('la hoja de Google no respondió')); }, 20000);
          function fin() { clearTimeout(t); try { delete global[fn]; } catch (e) { global[fn] = undefined; } s.remove(); }
          global[fn] = function (j) { fin(); try { bien(ok(j)); } catch (e) { mal(e); } };
          s.onerror = function () { fin(); mal(new Error('la hoja de Google no devolvió datos')); };
          var p = Object.assign({}, params, { callback: fn });
          s.src = url(p);
          document.head.appendChild(s);
        });
      });
  }

  /* ---------- banco elegido para cada juego ---------- */
  Store.elegido = function (tipo, id) {
    if (id === undefined) return ls(K_ELEGIDO + tipo) || 'ejemplo-' + tipo;
    if (Store.esEnlace(id)) return;          // un enlace no cambia la elección guardada
    ls(K_ELEGIDO + tipo, id);
  };

  /* ---------- cuántos equipos juegan ---------- */
  Store.equipos = function (tipo, n) {
    if (n === undefined) {
      var v = parseInt(ls(K_EQUIPOS + tipo), 10);
      return (v >= 1 && v <= 4) ? v : 4;
    }
    ls(K_EQUIPOS + tipo, String(Math.min(4, Math.max(1, n | 0))));
  };

  /* =========================================================
     Validación — las mismas reglas que el generador original
     ========================================================= */
  function base(obj) {
    var e = [];
    if (!obj || typeof obj !== 'object') e.push('El archivo no contiene un objeto JSON.');
    else if (!obj.titulo || typeof obj.titulo !== 'string') e.push('Falta el campo "titulo".');
    return e;
  }

  function validarTrivial(o) {
    var err = base(o), avi = [];
    if (err.length) return { ok: false, errores: err, avisos: avi };
    if (!Array.isArray(o.test)) err.push('Falta la lista "test".');
    if (!Array.isArray(o.escritas)) err.push('Falta la lista "escritas".');
    if (err.length) return { ok: false, errores: err, avisos: avi };

    /* El reparto entre test y escritas es libre: solo se cuenta y se enseña. */
    if (!o.test.length && !o.escritas.length) err.push('No hay ninguna pregunta.');

    var vistos = {};
    o.test.forEach(function (p, i) {
      var n = 'Test ' + (i + 1) + ': ';
      if (!p.q) err.push(n + 'falta el enunciado ("q").');
      if (!Array.isArray(p.o) || p.o.length !== 4) err.push(n + 'debe tener exactamente 4 opciones en "o".');
      else {
        var limpias = p.o.map(function (x) { return String(x).trim().toLowerCase(); });
        if (new Set(limpias).size !== 4) err.push(n + 'hay opciones repetidas.');
        if (limpias.some(function (x) { return !x; })) err.push(n + 'hay alguna opción vacía.');
      }
      if (['A', 'B', 'C', 'D'].indexOf(p.c) < 0) err.push(n + '"c" debe ser A, B, C o D.');
      var k = sinTildes(String(p.q || '')).toLowerCase().trim();
      if (vistos[k]) err.push(n + 'enunciado repetido.'); else vistos[k] = 1;
    });

    o.escritas.forEach(function (p, i) {
      var n = 'Escrita ' + (i + 1) + ': ';
      if (!p.q) err.push(n + 'falta el enunciado ("q").');
      if (!p.a) err.push(n + 'falta la solución ("a").');
      var k = sinTildes(String(p.q || '')).toLowerCase().trim();
      if (vistos[k]) err.push(n + 'enunciado repetido.'); else vistos[k] = 1;
    });

    /* Reparto de la letra correcta: se avisa si se concentra o si hay
       muchas seguidas iguales. Se puede arreglar barajando. */
    var d = reparto(o.test);
    if (d.aviso) avi.push(d.aviso);
    return { ok: !err.length, errores: err, avisos: avi, reparto: d };
  }

  /* Cómo se reparte la letra correcta en un banco de trivial. */
  function reparto(test) {
    var cuenta = { A: 0, B: 0, C: 0, D: 0 }, racha = 1, mayorRacha = 1, anterior = null;
    (test || []).forEach(function (p) {
      if (cuenta[p.c] !== undefined) cuenta[p.c]++;
      if (p.c === anterior) { racha++; if (racha > mayorRacha) mayorRacha = racha; }
      else racha = 1;
      anterior = p.c;
    });
    var n = (test || []).length;
    var max = Math.max(cuenta.A, cuenta.B, cuenta.C, cuenta.D);
    var texto = 'A:' + cuenta.A + ' B:' + cuenta.B + ' C:' + cuenta.C + ' D:' + cuenta.D;
    var aviso = '';
    if (n >= 8 && max > n * 0.45) {
      aviso = 'La respuesta correcta se concentra en una misma letra (' + texto + ').';
    } else if (n >= 8 && mayorRacha >= 4) {
      aviso = 'Hay ' + mayorRacha + ' preguntas seguidas con la misma letra correcta (' + texto + ').';
    }
    return { cuenta: cuenta, texto: texto, max: max, racha: mayorRacha, aviso: aviso, desigual: !!aviso };
  }

  /* Baraja las opciones de cada pregunta para repartir las letras.
     Cambia el orden de "o" y recalcula "c": la pregunta es la misma. */
  function barajar(banco) {
    var LETRAS = ['A', 'B', 'C', 'D'];
    var objetivo = 0;
    (banco.test || []).forEach(function (p, i) {
      if (!Array.isArray(p.o) || p.o.length !== 4) return;
      var correcta = p.o[LETRAS.indexOf(p.c)];
      if (correcta === undefined) return;
      var resto = p.o.filter(function (x, k) { return k !== LETRAS.indexOf(p.c); });
      for (var j = resto.length - 1; j > 0; j--) {          // mezcla los distractores
        var r = Math.floor(Math.random() * (j + 1));
        var t = resto[j]; resto[j] = resto[r]; resto[r] = t;
      }
      var pos = (objetivo + Math.floor(Math.random() * 2)) % 4;   // reparte A,B,C,D por turnos
      objetivo = (objetivo + 1) % 4;
      var nuevas = [];
      for (var k = 0, m = 0; k < 4; k++) nuevas.push(k === pos ? correcta : resto[m++]);
      p.o = nuevas;
      p.c = LETRAS[pos];
    });
    return banco;
  }

  function validarRosco(o) {
    var err = base(o), avi = [];
    if (err.length) return { ok: false, errores: err, avisos: avi };
    if (!Array.isArray(o.roscos) || !o.roscos.length) {
      err.push('Falta la lista "roscos".');
      return { ok: false, errores: err, avisos: avi };
    }
    if (o.roscos.length !== 4) avi.push('Hay ' + o.roscos.length + ' roscos; lo normal son 4, uno por equipo.');

    var refLetras = null, soluciones = {};
    o.roscos.forEach(function (r, i) {
      var n = 'Rosco ' + (i + 1) + (r.equipo ? ' (' + r.equipo + ')' : '') + ': ';
      if (!r.equipo) err.push(n + 'falta el campo "equipo".');
      if (!Array.isArray(r.letras) || !r.letras.length) { err.push(n + 'falta la lista "letras".'); return; }
      if (r.letras.length < 15) err.push(n + 'tiene ' + r.letras.length + ' letras; el mínimo razonable es 15.');
      else if (r.letras.length < 20) avi.push(n + 'tiene ' + r.letras.length + ' letras; el rosco clásico lleva 25.');

      var letras = r.letras.map(function (x) { return String(x.l || '').toUpperCase(); }).join('|');
      if (refLetras === null) refLetras = letras;
      else if (letras !== refLetras) err.push(n + 'no usa las mismas letras, en el mismo orden, que el primer rosco.');

      r.letras.forEach(function (x, k) {
        var m = n + 'letra ' + (x.l || '?') + ': ';
        if (!x.l) err.push(m + 'falta "l".');
        if (!x.d) err.push(m + 'falta la definición ("d").');
        if (!x.a) { err.push(m + 'falta la solución ("a").'); return; }
        var L = sinTildes(String(x.l)).toUpperCase();
        var A = sinTildes(String(x.a)).toUpperCase();
        var modo = x.modo === 'contiene' ? 'contiene' : 'empieza';
        if (modo === 'empieza' && A.charAt(0) !== L)
          err.push(m + '"' + x.a + '" no empieza por ' + x.l + '. Usa modo "contiene" o cambia la palabra.');
        if (modo === 'contiene' && A.indexOf(L) < 0)
          err.push(m + '"' + x.a + '" no contiene la letra ' + x.l + '.');
        var clave = A.replace(/[^A-ZÑ0-9]/g, '');
        if (soluciones[clave]) err.push(m + 'la solución "' + x.a + '" ya se usa en ' + soluciones[clave] + '.');
        else soluciones[clave] = (r.equipo || 'rosco ' + (i + 1));
      });
    });
    if (o.segundos !== undefined && (isNaN(+o.segundos) || +o.segundos < 30))
      err.push('"segundos" debe ser un número de 30 o más.');
    return { ok: !err.length, errores: err, avisos: avi };
  }

  Store.validar = function (tipo, obj) {
    return tipo === 'rosco' ? validarRosco(obj) : validarTrivial(obj);
  };
  Store.resumen = resumen;
  Store.reparto = reparto;
  Store.barajar = barajar;
  Store.sinTildes = sinTildes;

  global.Store = Store;

})(window);
