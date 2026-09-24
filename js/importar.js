/* =========================================================
   Vista de bancos de preguntas
   Importar un banco nuevo, ver los que hay y —con el código de
   gestión— renombrarlos o borrarlos. La hoja de cálculo va fija
   en el código: aquí no se configura nada.
   ========================================================= */
window.Importar = (function (global) {

  var $ = function (id) { return document.getElementById(id); };
  var listaTipo = 'trivial';     // pestaña de la lista de bancos
  var seccionActual = 'bancos';  // bancos | anadir | ia
  var promptAbierto = null;      // qué prompt está desplegado
  var BANCOS = [];
  var cargadoAlguna = false;

  /* =========================================================
     Abrir y cerrar sin saltos
     Los paneles se despliegan animando su altura, y la página
     se desplaza sola con un movimiento propio: el navegador
     ignora el desplazamiento suave nativo cuando el sistema
     tiene las animaciones desactivadas, como en el portátil.
     ========================================================= */
  function desplegar(el, abrir) {
    if (!el) return;
    var visible = !el.classList.contains('oculto');
    if (abrir === visible) return;
    clearTimeout(el._temp);
    el.classList.add('plegable');
    if (abrir) {
      el.classList.remove('oculto');
      el.style.height = 'auto';
      var alto = el.scrollHeight;
      el.style.height = '0px'; el.style.opacity = '0';
      void el.offsetWidth;
      el.style.height = alto + 'px'; el.style.opacity = '1';
      el._temp = setTimeout(function () {
        el.style.height = ''; el.style.opacity = ''; el.classList.remove('plegable');
      }, 300);
    } else {
      el.style.height = el.scrollHeight + 'px'; el.style.opacity = '1';
      void el.offsetWidth;
      el.style.height = '0px'; el.style.opacity = '0';
      el._temp = setTimeout(function () {
        el.classList.add('oculto');
        el.style.height = ''; el.style.opacity = ''; el.classList.remove('plegable');
      }, 280);
    }
  }

  function irSuave(el, margen) {
    var c = document.getElementById('vistaImportar');
    if (!c || !el) return;
    var destino = c.scrollTop + el.getBoundingClientRect().top -
                  c.getBoundingClientRect().top - (margen || 24);
    destino = Math.max(0, Math.min(destino, c.scrollHeight - c.clientHeight));
    var ini = c.scrollTop, d = destino - ini, t0 = 0, dur = 420;
    if (Math.abs(d) < 3) return;
    requestAnimationFrame(function paso(t) {
      if (!t0) t0 = t;
      var k = Math.min(1, (t - t0) / dur);
      var e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
      c.scrollTop = ini + d * e;
      if (k < 1) requestAnimationFrame(paso);
    });
  }

  function escapar(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  /* las ventanas propias viven en dialogo.js */
  var dialogo = Dialogo.pedir;
  var avisar = Dialogo.avisar;

  /* ---------------- prompts para la IA ---------------- */
  var PROMPTS = {
    trivial:
'Eres maestro de Educación Primaria y preparas un concurso tipo trivial para repasar en clase.\n' +
'\n' +
'Contexto:\n' +
'- Curso: [5º DE PRIMARIA]\n' +
'- Contenidos a repasar: [MATEMÁTICAS, CIENCIAS NATURALES, CIENCIAS SOCIALES, LENGUA DEL CURSO ANTERIOR\n' +
'  Y CULTURA POPULAR INFANTIL (videojuegos, animación, deporte, música, plataformas actuales)]\n' +
'- Entorno del alumnado (para anclar algunas preguntas): [MARBELLA, MÁLAGA, ANDALUCÍA]\n' +
'- Número de preguntas: [28] tipo test y [12] de respuesta escrita\n' +
'\n' +
'Devuélvemelo en formato CSV separado por punto y coma (;), dentro de un único bloque de código,\n' +
'sin texto antes ni después. Una línea por elemento, y la primera palabra de cada línea dice qué es:\n' +
'\n' +
'TRIVIAL;Título del banco\n' +
'TEST;Pregunta;opción A;opción B;opción C;opción D;letra correcta\n' +
'ESCRITA;Pregunta;respuesta\n' +
'\n' +
'Ejemplo:\n' +
'TRIVIAL;TRIVIAL [CURSO] · VOLUMEN [N]\n' +
'TEST;¿Cuál es la capital de Portugal?;Oporto;Lisboa;Madrid;Braga;B\n' +
'TEST;¿Cuántos lados tiene un hexágono?;5;6;7;8;B\n' +
'ESCRITA;¿Cómo se llama el erizo azul de los videojuegos?;Sonic\n' +
'\n' +
'Reglas que debes cumplir sin excepción:\n' +
'1. La primera línea es TRIVIAL;título. Después, todas las TEST y luego todas las ESCRITA, en el número pedido.\n' +
'2. Cada línea TEST tiene exactamente 7 campos: TEST, la pregunta, 4 opciones distintas y la letra\n' +
'   correcta (A, B, C o D). Cada línea ESCRITA tiene 3 campos: ESCRITA, la pregunta y la respuesta.\n' +
'3. No uses nunca el punto y coma dentro de un texto. Si un texto lo necesita, ponlo entre comillas dobles.\n' +
'4. Reparte la letra correcta de forma equilibrada: más o menos una cuarta parte de las preguntas test\n' +
'   para cada letra, y nunca la misma letra más de dos veces seguidas.\n' +
'5. Los tres distractores deben ser plausibles: nada de opciones absurdas.\n' +
'6. Ningún enunciado repetido y ninguna pregunta con dos lecturas posibles o con trampa.\n' +
'7. Reparto temático equitativo entre todos los tipos de contenidos.\n' +
'8. Las escritas: respuesta única, de una o dos palabras.\n' +
'9. Lenguaje claro y corto, adecuado a la edad. Enunciados de menos de 120 caracteres.\n' +
'10. Antes de responder, comprueba línea a línea el número de campos y que cada letra señala de verdad\n' +
'    a la opción correcta.',

    rosco:
'Eres maestro de Educación Primaria y preparas un rosco tipo pasapalabra por equipos.\n' +
'\n' +
'Contexto:\n' +
'- Curso: [5º DE PRIMARIA]\n' +
'- Contenidos a repasar: [MATEMÁTICAS, CIENCIAS NATURALES, CIENCIAS SOCIALES, LENGUA DEL CURSO ANTERIOR\n' +
'  Y CULTURA POPULAR INFANTIL (videojuegos, animación, deporte, música, plataformas actuales)]\n' +
'- Entorno del alumnado: [MARBELLA, MÁLAGA, ANDALUCÍA]\n' +
'- Número de equipos (un rosco por equipo): [4]\n' +
'- Letras de cada rosco, en este orden: [A B C D E F G H I J L M N Ñ O P Q R S T U V X Y Z]\n' +
'\n' +
'Devuélvemelo en formato CSV separado por punto y coma (;), dentro de un único bloque de código,\n' +
'sin texto antes ni después. Una línea por elemento, y la primera palabra de cada línea dice qué es:\n' +
'\n' +
'ROSCO;Título del banco\n' +
'EQUIPO;Nombre del equipo           (empieza el rosco de ese equipo)\n' +
'LETRA;letra;EMPIEZA o CONTIENE;definición;solución\n' +
'\n' +
'Ejemplo:\n' +
'ROSCO;EL ROSCO DE [CURSO] · VOLUMEN [N]\n' +
'EQUIPO;Equipo 1\n' +
'LETRA;A;EMPIEZA;Grupo de animales al que pertenecen la rana y el tritón.;Anfibio\n' +
'LETRA;B;EMPIEZA;Instrumento para medir la presión del aire.;Barómetro\n' +
'LETRA;Ñ;CONTIENE;Estación del año en la que se caen las hojas.;Otoño\n' +
'EQUIPO;Equipo 2\n' +
'LETRA;A;EMPIEZA;…;…\n' +
'\n' +
'Reglas que debes cumplir sin excepción:\n' +
'1. La primera línea es ROSCO;título. Luego, para cada equipo, una línea EQUIPO seguida de una línea\n' +
'   LETRA por cada letra de la lista, todas en el mismo orden en todos los equipos.\n' +
'2. Cada línea LETRA tiene exactamente 5 campos: LETRA, la letra, EMPIEZA o CONTIENE, la definición y la solución.\n' +
'3. No uses nunca el punto y coma dentro de un texto. Si un texto lo necesita, ponlo entre comillas dobles.\n' +
'4. Ninguna solución puede repetirse en todo el banco, tampoco entre equipos: los equipos se oyen unos a otros.\n' +
'5. EMPIEZA cuando la palabra empieza por esa letra; CONTIENE cuando solo la lleva dentro.\n' +
'   Para Ñ, X, K y W usa casi siempre CONTIENE (Otoño, Montaña, Oxígeno, Hexágono…).\n' +
'6. La solución debe encajar de verdad con su letra y su modo. Compruébalo palabra por palabra.\n' +
'7. Cada definición lleva a UNA sola palabra. Si admite dos respuestas razonables, reescríbela.\n' +
'8. Soluciones de una sola palabra, sin artículos, en singular salvo que el concepto lo pida.\n' +
'9. Piensa por letras y no por equipos (primero las palabras de la A para todos los equipos, luego las de\n' +
'   la B…) y después escríbelo agrupado por equipos como en el ejemplo.\n' +
'10. Lenguaje claro y corto, adecuado a la edad. Definiciones de menos de 130 caracteres.\n' +
'11. Antes de responder, comprueba el número de campos de cada línea, que todos los equipos tienen las\n' +
'    mismas letras en el mismo orden y que no hay ninguna solución repetida.'
  };

  /* ---------------- prompts editados por el maestro ----------------
     El texto del prompt se puede cambiar en la propia caja; lo que se
     escriba se guarda en este navegador y se puede devolver al original
     con el botón de restaurar. */
  var K_PROMPT = 'trivialaula.promptcsv.';   // los antiguos (JSON) ya no sirven
  function promptDe(tipo) {
    try {
      var v = localStorage.getItem(K_PROMPT + tipo);
      if (v !== null && v.trim()) return v;
    } catch (e) {}
    return PROMPTS[tipo];
  }
  function guardarPrompt(tipo, texto) {
    try {
      if (texto.trim() === PROMPTS[tipo].trim()) localStorage.removeItem(K_PROMPT + tipo);
      else localStorage.setItem(K_PROMPT + tipo, texto);
    } catch (e) {}
    pintarRestaurar(tipo);
  }
  function pintarRestaurar(tipo) {
    var b = $('btnRestaurar'), n = $('promptNota');
    if (!b) return;
    var tocado = $('promptTexto').value.trim() !== PROMPTS[tipo].trim();
    b.disabled = !tocado;
    if (n) n.textContent = tocado
      ? 'Prompt modificado por ti · se guarda solo en este navegador'
      : 'Puedes editarlo: los cambios se guardan solos.';
  }

  /* Copia al portapapeles por dos caminos: primero el clásico (seleccionar
     y copiar, que funciona aunque el permiso del portapapeles esté cerrado)
     y, si no, la API moderna. Devuelve una promesa con true o false. */
  function copiarClasico(texto) {
    var tmp = document.createElement('textarea');
    tmp.value = texto;
    tmp.setAttribute('readonly', '');
    tmp.style.cssText = 'position:fixed;top:0;left:0;width:2px;height:2px;opacity:0;';
    document.body.appendChild(tmp);
    var antes = document.activeElement;
    var ok = false;
    try {
      tmp.focus();
      tmp.select();
      tmp.setSelectionRange(0, tmp.value.length);
      ok = document.execCommand('copy');
    } catch (e) { ok = false; }
    tmp.remove();
    try { if (antes && antes.focus) antes.focus(); } catch (e) {}
    return ok;
  }
  function copiar(texto) {
    if (copiarClasico(texto)) return Promise.resolve(true);
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(texto).then(function () { return true; })
        .catch(function () { return false; });
    }
    return Promise.resolve(false);
  }

  /* =========================================================
     Importar en CSV
     Un solo cuadro para los dos juegos: la primera línea del CSV
     (TRIVIAL o ROSCO) dice a qué juego va cada banco. Puede haber
     varios bancos seguidos en el mismo texto.
     ========================================================= */
  var LEIDOS = [];          // [{banco, v}] de la última comprobación
  var fallosCsv = [];

  function limpiarResultado() {
    cerrarAviso();
    $('resultado').innerHTML = '';
    $('previa').innerHTML = '';
    LEIDOS = []; fallosCsv = [];
    $('btnGuardar').disabled = true;
    $('btnEditarImp').disabled = true;
    $('filaNombre').classList.remove('oculto');
  }

  /* La ventana con el resultado: lo que dice «Comprobar» se queda hasta
     que se cierre, para poder tomar nota de los fallos; el aviso de
     guardado se va solo a los pocos segundos. */
  var avisoFuera = null;
  function abrirAviso(titulo, seVaSolo) {
    $('avisoTit').textContent = titulo;
    $('capaAviso').classList.add('ver');
    clearTimeout(avisoFuera);
    if (seVaSolo) avisoFuera = setTimeout(cerrarAviso, 4000);
  }
  function cerrarAviso() {
    clearTimeout(avisoFuera);
    $('capaAviso').classList.remove('ver');
  }

  function pinta(clase, titulo, lista, dondeAnadir) {
    var html = '<div class="aviso ' + clase + '">' + titulo +
      (lista && lista.length ? '<ul>' + lista.map(function (x) { return '<li>' + escapar(x) + '</li>'; }).join('') + '</ul>' : '') +
      '</div>';
    if (dondeAnadir) $('resultado').insertAdjacentHTML('beforeend', html);
    else $('resultado').innerHTML = html;
  }

  function reescribirCsv() {
    $('entrada').value = LEIDOS.map(function (x) { return CSVBancos.escribir(x.banco); }).join('\r\n');
  }

  function validar() {
    limpiarResultado();
    var txt = $('entrada').value.trim();
    if (!txt) {
      pinta('mal', 'Pega primero el CSV del banco (o arrastra el archivo).', []);
      abrirAviso('📋 Comprobación');
      return;
    }
    if (/^\s*[{[]/.test(txt)) {
      pinta('mal', 'Esto parece JSON. Ahora los bancos se importan en CSV: pídeselo a la IA con los prompts nuevos de ' +
        '«🤖 Crear con IA», o crea el banco en el editor.', []);
      abrirAviso('📋 Comprobación');
      return;
    }
    var r = CSVBancos.leer(txt);
    fallosCsv = r.errores;
    var puesto = $('nombreBanco').value.trim();
    if (r.bancos.length === 1 && puesto) r.bancos[0].titulo = puesto;
    LEIDOS = r.bancos.map(function (b) {
      var limpio = CSVBancos.limpiar(b);
      return { banco: limpio, v: Store.validar(limpio.tipo, limpio) };
    });
    var buenos = LEIDOS.filter(function (x) { return x.v.ok; }).length;
    var n = LEIDOS.length;

    if (fallosCsv.length) {
      pinta('mal', 'Hay ' + fallosCsv.length + (fallosCsv.length === 1 ? ' línea que no he podido leer' : ' líneas que no he podido leer') +
        (n ? ' (se quedan fuera del banco)' : '') + ':',
        fallosCsv.slice(0, 25).map(function (e) { return e.texto; }));
      pinta('ojo', 'Pégale estos mensajes a la IA tal cual para que lo corrija' +
        (n ? ', o pulsa <b>✏️ Abrir en el editor</b> y complétalo allí.' : '.'), [], true);
    }
    if (r.avisos.length) pinta('ojo', 'Detalles que he arreglado solo:', r.avisos.slice(0, 10).map(function (e) { return e.texto; }), true);

    if (n) {
      LEIDOS.forEach(function (x, i) {
        var b = x.banco, v = x.v;
        var nombre = '<b>' + (b.tipo === 'rosco' ? '🔵 Rosco' : '🏆 Trivial') + ' · ' + escapar(b.titulo) + '</b> · ' + Store.resumen(b.tipo, b);
        if (!v.ok) {
          pinta('mal', nombre + '<br>Tiene ' + v.errores.length + (v.errores.length === 1 ? ' problema' : ' problemas') +
            ' que impiden guardarlo (se arreglan fácil en el editor):', v.errores.slice(0, 20), true);
        } else if (v.avisos.length) {
          pinta('ojo', nombre + '<br>Se puede guardar, pero revisa:', v.avisos, true);
        } else {
          pinta('bien', nombre + (b.tipo === 'trivial' && b.test.length ? ' · letras correctas ' + v.reparto.texto : '') + ' · listo para guardar.', [], true);
        }
        /* si la letra correcta se amontona, se ofrece repartirla */
        if (b.tipo === 'trivial' && v.reparto && v.reparto.desigual) {
          var caja = document.createElement('div');
          caja.className = 'botones';
          caja.style.margin = '-4px 0 10px';
          var bt = document.createElement('button');
          bt.className = 'btn';
          bt.textContent = '🔀 Repartir las respuestas' + (n > 1 ? ' de «' + b.titulo + '»' : '');
          bt.onclick = function () {
            Sonido.click();
            Store.barajar(LEIDOS[i].banco);
            reescribirCsv();
            validar();
          };
          caja.appendChild(bt);
          $('resultado').appendChild(caja);
        }
      });
    }
    $('filaNombre').classList.toggle('oculto', n > 1);
    if (n === 1 && !puesto) $('nombreBanco').value = LEIDOS[0].banco.titulo;
    $('btnGuardar').disabled = !(n && buenos === n && !fallosCsv.length);
    $('btnGuardar').textContent = n > 1 ? 'Guardar los ' + n : 'Guardar';
    $('btnEditarImp').disabled = n !== 1;
    LEIDOS.forEach(function (x, i) { previa(x.banco, i); });
    abrirAviso('📋 Resultado de la comprobación');
    FX.desde($('btnValidar'), 14);
  }

  function previa(o, i) {
    var html;
    if (o.tipo === 'rosco') {
      var filas = [];
      o.roscos.forEach(function (r) {
        r.letras.forEach(function (x) {
          filas.push('<tr><td><b>' + escapar(r.equipo) + '</b></td><td>' + escapar(x.l) + '</td>' +
            '<td>' + (x.modo === 'contiene' ? 'contiene' : 'empieza') + '</td>' +
            '<td>' + escapar(x.d) + '</td><td class="ok">' + escapar(x.a) + '</td></tr>');
        });
      });
      html = '<table><thead><tr><th>Equipo</th><th>Letra</th><th>Modo</th><th>Definición</th><th>Solución</th></tr></thead>' +
        '<tbody>' + filas.join('') + '</tbody></table>';
    } else {
      var t = o.test.map(function (p, k) {
        return '<tr><td>' + (k + 1) + '</td><td>test</td><td>' + escapar(p.q) + '</td>' +
          '<td class="ok">' + escapar(p.c) + ' · ' + escapar(p.o['ABCD'.indexOf(p.c)]) + '</td></tr>';
      }).join('');
      var w = o.escritas.map(function (p, k) {
        return '<tr><td>' + (o.test.length + k + 1) + '</td><td>escrita</td><td>' + escapar(p.q) + '</td>' +
          '<td class="ok">' + escapar(p.a) + '</td></tr>';
      }).join('');
      html = '<table><thead><tr><th>#</th><th>Clase</th><th>Pregunta</th><th>Solución</th></tr></thead>' +
        '<tbody>' + t + w + '</tbody></table>';
    }
    $('previa').insertAdjacentHTML('beforeend', '<div class="previa"><div class="cabp"><span>' +
      (o.tipo === 'rosco' ? '🔵 ' : '🏆 ') + escapar(o.titulo) +
      '</span><span class="tenue">' + Store.resumen(o.tipo, o) + '</span>' +
      '<button class="mini" data-editarimp="' + i + '">✏️ Editar</button></div>' +
      '<div class="cuerpo">' + html + '</div></div>');
    var b = $('previa').querySelector('[data-editarimp="' + i + '"]');
    if (b) b.onclick = function () { abrirImportado(i); };
  }

  function abrirImportado(i) {
    var x = LEIDOS[i];
    if (!x) return;
    Sonido.click();
    Editor.abrir({ banco: x.banco, volver: 'importar' });
  }

  function destinoTexto() {
    if (Store.conSesion) return Store.esAdmin() ? 'en el banco general' : 'en tus bancos';
    return 'en la base de preguntas';
  }

  function guardarLeidos(boton) {
    if (!LEIDOS.length) return;
    boton.disabled = true;
    boton.textContent = 'Guardando…';
    var hechos = 0, cadena = Promise.resolve();
    LEIDOS.forEach(function (x) {
      cadena = cadena.then(function () { return Store.guardar(x.banco).then(function () { hechos++; }); });
    });
    cadena.then(function () {
      pinta('bien', (hechos === 1 ? 'Guardado ' : 'Guardados los ' + hechos + ' bancos ') + destinoTexto() +
        '. Ya aparece' + (hechos === 1 ? '' : 'n') + ' en el menú de juego.', []);
      abrirAviso('✅ Guardado', true);
      $('previa').innerHTML = '';
      FX.lluvia(70);
      listaTipo = LEIDOS[0].banco.tipo || listaTipo;     // se ve la lista donde acaba de caer
      LEIDOS = [];
      $('btnEditarImp').disabled = true;
      cargarLista();
      if (window.Menu && Menu.cargar) Menu.cargar();
    }).catch(function (err) {
      boton.disabled = false;
      pinta('mal', (hechos ? 'Se guardaron ' + hechos + ', pero el siguiente falló: ' : 'No se ha podido guardar: ') +
        escapar(err.message), []);
      abrirAviso('⚠ No se ha podido guardar');
    }).then(function () {
      boton.textContent = 'Guardar';
    });
  }

  /* abre el editor con un banco guardado (o lo carga por su id) */
  function editarBanco(id) {
    Sonido.click();
    Editor.abrir({ id: id, volver: 'importar' });
  }
  function crearBanco(tipo) {
    Sonido.click();
    Editor.abrir({ tipo: tipo, volver: 'importar' });
  }

  /* ---------------- lista de bancos ---------------- */
  function cargarLista() {
    pintarCabecera();
    return Store.indice().then(function (r) {
      var e = $('estadoConex');
      var yo = Store.usuario();
      if (r.fuente === 'nube') {
        e.className = 'aviso bien';
        e.innerHTML = yo && yo.admin
          ? 'Estás gestionando el <b>banco general</b>: lo que guardes aquí lo verá todo el mundo, también sin iniciar sesión.'
          : 'Estos son <b>tus</b> bancos: solo los ves tú (y el administrador). Para jugarlos en otro ordenador sin ' +
            'entrar, usa «🔗 Enlace».';
      } else if (r.fuente === 'error') {
        e.className = 'aviso mal';
        e.innerHTML = 'La base de preguntas no responde ahora mismo (' + escapar(r.error) + '). ' +
          'Se juega con las copias guardadas; vuelve a intentarlo en un momento.';
      } else {
        e.className = 'aviso ojo';
        e.innerHTML = 'La web aún no está conectada a Supabase: solo están los bancos de ejemplo.';
      }

      BANCOS = r.bancos;
      pintarLista();
    });
  }

  function etiqueta(b) {
    return b.origen === 'general' ? 'banco general' : b.origen === 'propio' ? 'tuyo' :
           b.origen === 'ejemplo' ? 'incluido en el proyecto' : 'copia sin conexión';
  }
  /* aquí solo se ven los bancos que gestiona quien ha entrado:
     los suyos, o el banco general si es el administrador */
  function mios() {
    var admin = Store.esAdmin();
    return BANCOS.filter(function (b) { return b.origen === (admin ? 'general' : 'propio'); });
  }
  function deTipo(t) {
    return mios().filter(function (b) { return b.tipo === t; });
  }
  function pintarCabecera() {
    var admin = Store.esAdmin();
    var yo = Store.usuario();
    $('impTitulo').textContent = admin ? '⬆ Banco general' : '⬆ Mis bancos de preguntas';
    $('impSub').textContent = admin
      ? 'Eres el administrador: gestionas el banco general y los usuarios.'
      : 'Hola, ' + (yo ? yo.usuario : '') + '. Aquí añades tus preguntas y repasas las que ya tienes.';
    $('tituloLista').textContent = admin ? '🗒 Banco general' : '🗒 Mis bancos';
    var p = document.querySelector('[data-sec="bancos"]');
    if (p) p.textContent = admin ? '🗒 Banco general' : '🗒 Mis bancos';
  }
  function copiarEnlace(boton, enlace) {
    var url = Store.urlEnlace(enlace);
    Dialogo.copiar(url).then(function (ok) {
      if (ok) {
        var antes = boton.textContent;
        boton.textContent = '✔ Copiado';
        setTimeout(function () { boton.textContent = antes; }, 1800);
      } else {
        Dialogo.pedir({ titulo: '🔗 Enlace de juego', texto: 'Cópialo con Ctrl+C:', campo: true,
                        valor: url, aceptar: 'Hecho', soloAviso: true });
      }
    });
  }
  function meta(b) {
    return '<span class="meta">' + escapar(b.resumen || '') +
      ' · <span class="eti">' + etiqueta(b) + '</span></span>';
  }

  /* ---- lista de la página, separada por juego y con desplazamiento ---- */
  function pintarLista() {
    var propios = deTipo(listaTipo);
    var cont = $('listaBancos');
    if (!propios.length) {
      cont.innerHTML = '<div class="vacia">' + (Store.esAdmin() ? 'El banco general no tiene' : 'Todavía no tienes') +
        ' bancos de ' + (listaTipo === 'rosco' ? 'rosco' : 'trivial') +
        '. Añádelo en «📥 Añadir o crear».</div>';
    } else {
      cont.innerHTML = propios.map(function (b) {
        var suyo = Store.editable(b.id);
        return '<div class="bancoFila"><div><b>' + escapar(b.titulo) + '</b><br>' + meta(b) + '</div>' +
          '<div class="acc">' +
          (b.enlace ? '<button class="mini" data-enlace="' + escapar(b.enlace) +
            '" title="Copia una dirección que abre este banco sin iniciar sesión">' +
            '<span class="ic">🔗</span> Enlace</button>' : '') +
          '<button class="mini" data-editar="' + escapar(b.id) + '" title="' +
            (b.origen === 'ejemplo' ? 'Abrir una copia en el editor' : 'Abrir en el editor') +
            '"><span class="ic">✏️</span> Editar</button>' +
          (suyo ? '<button class="mini" data-renombrar="' + escapar(b.id) +
            '" title="Cambiar el nombre con el que sale en el menú">' +
            '<span class="ic">🏷️</span> Renombrar</button>' : '') +
          (suyo ? '<button class="mini rojo" data-borrar="' + escapar(b.id) +
            '" title="Borrarlo para siempre"><span class="ic">🗑️</span> Borrar</button>' : '') +
          '<button class="mini" data-jugar="' + escapar(b.id) +
          '" data-tipo="' + b.tipo + '" title="Jugarlo ahora"><span class="ic">▶️</span> Probar</button>' +
          '</div></div>';
      }).join('');
    }
    [].slice.call(cont.querySelectorAll('[data-editar]')).forEach(function (b) {
      b.onclick = function () { editarBanco(b.dataset.editar); };
    });
    [].slice.call(cont.querySelectorAll('[data-jugar]')).forEach(function (b) {
      b.onclick = function () {
        Store.elegido(b.dataset.tipo, b.dataset.jugar);
        App.ir(b.dataset.tipo, b.dataset.jugar);
      };
    });
    [].slice.call(cont.querySelectorAll('[data-enlace]')).forEach(function (b) {
      b.onclick = function () { Sonido.click(); copiarEnlace(b, b.dataset.enlace); };
    });
    conectarRenombrar(cont);
    conectarBorrar(cont);
    $('pieLista').textContent = propios.length + (propios.length === 1 ? ' banco' : ' bancos') +
      ' de ' + (listaTipo === 'rosco' ? 'rosco' : 'trivial') + ' · ' +
      deTipo(listaTipo === 'rosco' ? 'trivial' : 'rosco').length + ' de ' +
      (listaTipo === 'rosco' ? 'trivial' : 'rosco');
    [].slice.call(document.querySelectorAll('[data-lista]')).forEach(function (p) {
      p.classList.toggle('act', p.dataset.lista === listaTipo);
    });
  }

  /* ---- renombrar y borrar, desde la propia fila del banco ---- */
  function conectarBorrar(cont) {
    [].slice.call(cont.querySelectorAll('[data-borrar]')).forEach(function (b) {
      b.onclick = function () {
        var fila = b.closest('.bancoFila');
        var nombre = fila ? fila.querySelector('b').textContent : 'ese banco';
        Sonido.click();
        dialogo({
          titulo: '🗑 Borrar el banco',
          texto: '«' + nombre + '» se borrará' + (Store.esAdmin() ? ' del banco general' : '') +
            '. Su enlace de juego dejará de funcionar. No se puede deshacer.',
          aceptar: 'Sí, borrarlo', peligro: true
        }).then(function (si) {
          if (!si) return;
          cont.classList.add('ocupada');
          Store.borrar(b.dataset.borrar)
            .catch(function (err) { avisar('No se ha podido borrar', err.message); })
            .then(function () { cont.classList.remove('ocupada'); cargarLista(); });
        });
      };
    });
  }

  function conectarRenombrar(cont) {
    [].slice.call(cont.querySelectorAll('[data-renombrar]')).forEach(function (b) {
      b.onclick = function () {
        var fila = b.closest('.bancoFila');
        var actual = fila ? fila.querySelector('b').textContent : '';
        Sonido.click();
        dialogo({
          titulo: '✏️ Renombrar el banco',
          texto: 'Así es como aparecerá en el menú de juego.',
          campo: true, valor: actual, aceptar: 'Guardar el nombre',
          comprobar: function (v) { return v.trim() ? '' : 'Escribe un nombre.'; }
        }).then(function (nuevo) {
          if (nuevo === null) return;
          /* nada de cambiar el texto del botón: se atenúa la lista entera
             mientras se guarda y al terminar se vuelve a pintar */
          cont.classList.add('ocupada');
          Store.renombrar(b.dataset.renombrar, nuevo.trim())
            .catch(function (err) { avisar('No se ha podido renombrar', err.message); })
            .then(function () { cont.classList.remove('ocupada'); cargarLista(); });
        });
      };
    });
  }

  /* ---------------- entrada y salida ---------------- */
  function entrar() {
    if (!Store.conSesion()) { App.ir('menu'); return; }
    if (!cargadoAlguna) {
      cargadoAlguna = true;
      $('entrada').value = '';        // el navegador a veces restaura lo de antes
      $('nombreBanco').value = '';
    }
    seccion('bancos');  // al entrar se ven solo los bancos disponibles
    cargarLista();
  }

  function conectar() {
    $('btnValidar').onclick = function () { Sonido.click(); validar(); };
    $('btnLimpiar').onclick = function () {
      $('entrada').value = '';
      $('nombreBanco').value = '';
      limpiarResultado();
    };
    [].slice.call(document.querySelectorAll('[data-crear]')).forEach(function (b) {
      b.onclick = function () { crearBanco(b.dataset.crear); };
    });
    $('btnEditarImp').onclick = function () { abrirImportado(0); };

    /* ventana con el resultado de comprobar o de guardar */
    $('avisoCerrar').onclick = function () { Sonido.click(); cerrarAviso(); };
    $('capaAviso').onclick = function (e) { if (e.target.id === 'capaAviso') cerrarAviso(); };
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && $('capaAviso').classList.contains('ver')) {
        e.stopPropagation();
        cerrarAviso();
      }
    }, true);

    /* ventana con el formato del CSV */
    $('btnFormato').onclick = function () { Sonido.click(); $('capaFormato').classList.add('ver'); };
    $('fmtCerrar').onclick = function () { Sonido.click(); $('capaFormato').classList.remove('ver'); };
    $('capaFormato').onclick = function (e) {
      if (e.target.id === 'capaFormato') $('capaFormato').classList.remove('ver');
    };
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && $('capaFormato').classList.contains('ver')) {
        e.stopPropagation();
        $('capaFormato').classList.remove('ver');
      }
    }, true);
    $('btnGuardar').onclick = function () { guardarLeidos(this); };

    $('btnProbar').onclick = function () {
      var b = this;
      b.disabled = true;
      $('estadoConex').className = 'aviso ojo';
      $('estadoConex').textContent = 'Consultando la base de preguntas…';
      cargarLista().then(function () { b.disabled = false; })
        .catch(function () { b.disabled = false; });
    };

    /* --- pestañas de la lista --- */
    [].slice.call(document.querySelectorAll('[data-lista]')).forEach(function (p) {
      p.onclick = function () { Sonido.click(); listaTipo = p.dataset.lista; pintarLista(); };
    });


    /* administrador: traer los bancos de la hoja de Google de la versión anterior */
    $('btnMigrar').onclick = function () {
      var b = this;
      Sonido.click();
      Dialogo.confirmar('⇪ Traer de la hoja antigua',
        'Se copiarán al banco general los bancos de la hoja de Google que usaba la versión anterior. ' +
        'La hoja no se toca. Los que ya estén (mismo juego y mismo nombre) se saltan.', 'Traerlos')
        .then(function (si) {
          if (!si) return;
          b.disabled = true;
          Store.admin.migrarHoja(function (i, n, t) {
            b.textContent = '⇪ ' + i + ' de ' + n + '…';
          }).then(function (h) {
            Dialogo.avisar('Listo', 'Traídos: ' + h.traidos + ' · ya estaban: ' + h.saltados +
              (h.malos.length ? ' · con problemas: ' + h.malos.length + ' (' + h.malos.join(' | ') + ')' : ''));
          }).catch(function (err) {
            avisar('No se ha podido leer la hoja', err.message);
          }).then(function () {
            b.disabled = false;
            b.textContent = '⇪ Traer de la hoja antigua';
            cargarLista();
            if (window.Menu) Menu.cargar();
          });
        });
    };

    /* --- arrastrar archivo --- */
    var z = $('soltar');
    ['dragenter', 'dragover'].forEach(function (ev) {
      z.addEventListener(ev, function (e) { e.preventDefault(); z.classList.add('encima'); });
    });
    ['dragleave', 'drop'].forEach(function (ev) {
      z.addEventListener(ev, function (e) { e.preventDefault(); z.classList.remove('encima'); });
    });
    z.addEventListener('drop', function (e) {
      var f = e.dataTransfer.files[0];
      if (!f) return;
      var lector = new FileReader();
      lector.onload = function () { $('entrada').value = lector.result; validar(); };
      lector.readAsText(f);
    });
    z.addEventListener('click', function () {
      var inp = document.createElement('input');
      inp.type = 'file';
      inp.accept = '.csv,.txt,text/csv,text/plain';
      inp.onchange = function () {
        var lector = new FileReader();
        lector.onload = function () { $('entrada').value = lector.result; validar(); };
        lector.readAsText(inp.files[0]);
      };
      inp.click();
    });

    /* --- prompts para la IA --- */
    [].slice.call(document.querySelectorAll('[data-prompt]')).forEach(function (b) {
      b.onclick = function () {
        Sonido.click();
        var mismo = promptAbierto === b.dataset.prompt &&
                    !$('zonaPrompt').classList.contains('oculto');
        if (mismo) {                       // el mismo botón lo cierra
          promptAbierto = null;
          desplegar($('zonaPrompt'), false);
          irSuave($('panelIA'), 70);
        } else {
          promptAbierto = b.dataset.prompt;
          desplegar($('zonaComo'), false);
          $('promptTexto').value = promptDe(b.dataset.prompt);
          if ($('promptAviso')) $('promptAviso').classList.add('oculto');
          pintarRestaurar(b.dataset.prompt);
          desplegar($('zonaPrompt'), true);
          irSuave($('zonaPrompt'), 70);
        }
        [].slice.call(document.querySelectorAll('[data-prompt]')).forEach(function (o) {
          o.classList.toggle('activo', o.dataset.prompt === promptAbierto);
        });
      };
    });
    /* --- abrir el prompt directamente en una IA ---
       ChatGPT y Claude admiten el texto en la propia dirección; Gemini y
       DeepSeek no tienen parámetro, así que ahí se copia al portapapeles
       y solo queda pegar. En todos hay que tener la sesión iniciada. */
    var IAS = {
      chatgpt:  { url: 'https://chatgpt.com/?q=', nombre: 'ChatGPT' },
      claude:   { url: 'https://claude.ai/new?q=', nombre: 'Claude' },
      gemini:   { url: 'https://gemini.google.com/app', nombre: 'Gemini', pegar: true },
      deepseek: { url: 'https://chat.deepseek.com/', nombre: 'DeepSeek', pegar: true }
    };
    [].slice.call(document.querySelectorAll('[data-ia]')).forEach(function (b) {
      b.onclick = function () {
        var ia = IAS[b.dataset.ia];
        if (!ia) return;
        Sonido.click();
        var texto = $('promptTexto').value;
        if (!ia.pegar) {                       // ChatGPT y Claude lo reciben en la dirección
          global.open(ia.url + encodeURIComponent(texto), '_blank', 'noopener');
          return;
        }
        /* Gemini y DeepSeek no admiten el prompt en la dirección. Se intenta
           copiar (si el navegador deja) y, pase lo que pase, se deja el texto
           seleccionado en el cuadro: con Ctrl+C basta. Nada de avisos, que
           quedan detrás de la pestaña nueva. */
        var copiado = copiarClasico(texto);
        var caja = $('promptTexto');
        try { caja.focus(); caja.setSelectionRange(0, caja.value.length); } catch (e) {}
        var nota = $('promptAviso');
        if (nota) {
          nota.classList.remove('oculto');
          nota.textContent = copiado
            ? '✔ Prompt copiado · pégalo en ' + ia.nombre + ' con Ctrl+V'
            : '⚠ Copia el prompt con Ctrl+C (ya está seleccionado) y pégalo en ' + ia.nombre;
          nota.className = 'aviso ' + (copiado ? 'bien' : 'ojo');
        }
        global.open(ia.url, '_blank', 'noopener');
      };
    });

    $('btnCopiarPrompt').onclick = function () {
      var b = this;
      copiar($('promptTexto').value).then(function (ok) {
        b.textContent = ok ? '✔ Copiado' : '⚠ Selecciónalo y copia con Ctrl+C';
        Sonido.click();
        setTimeout(function () { b.textContent = '📋 Copiar el prompt'; }, 2200);
      });
    };

    /* el prompt se guarda según se escribe, y se puede restaurar */
    $('promptTexto').oninput = function () {
      if (promptAbierto) guardarPrompt(promptAbierto, this.value);
    };
    $('btnRestaurar').onclick = function () {
      if (!promptAbierto) return;
      Sonido.click();
      $('promptTexto').value = PROMPTS[promptAbierto];
      guardarPrompt(promptAbierto, PROMPTS[promptAbierto]);
    };
    $('btnComoVa').onclick = function () {
      Sonido.click();
      promptAbierto = null;
      [].slice.call(document.querySelectorAll('[data-prompt]')).forEach(function (o) {
        o.classList.remove('activo');
      });
      desplegar($('zonaPrompt'), false);
      var abrir = $('zonaComo').classList.contains('oculto');
      desplegar($('zonaComo'), abrir);
      irSuave(abrir ? $('zonaComo') : $('panelIA'), 70);
    };

    /* --- cambiar de sección --- */
    [].slice.call(document.querySelectorAll('[data-sec]')).forEach(function (p) {
      p.onclick = function () { Sonido.click(); seccion(p.dataset.sec); };
    });
    [].slice.call(document.querySelectorAll('[data-ir]')).forEach(function (p) {
      p.onclick = function () { Sonido.click(); seccion(p.dataset.ir); };
    });
  }

  /* Solo se ve una sección: así no hay que bajar por la página. */
  var SECCIONES = { bancos: 'secBancos', anadir: 'secAnadir', ia: 'secIA', usuarios: 'secUsuarios' };
  function seccion(cual) {
    if (!SECCIONES[cual]) cual = 'bancos';
    if (cual === 'usuarios' && !Store.esAdmin()) cual = 'bancos';
    if (cual === 'usuarios' && window.Admin) Admin.entrar();
    seccionActual = cual;
    /* la lista de bancos (y la de usuarios) ocupan todo el alto que quede libre */
    var pag = document.querySelector('#vistaImportar .pagina');
    if (pag) pag.classList.toggle('llena', cual === 'bancos' || cual === 'usuarios');
    Object.keys(SECCIONES).forEach(function (k) {
      $(SECCIONES[k]).classList.toggle('oculto', k !== cual);
    });
    [].slice.call(document.querySelectorAll('[data-sec]')).forEach(function (p) {
      p.classList.toggle('act', p.dataset.sec === cual);
    });
    var v = document.getElementById('vistaImportar');
    if (v) v.scrollTop = 0;
    FX.repetir($(SECCIONES[cual]), 'reentra', 450);
  }

  return { conectar: conectar, entrar: entrar, cargarLista: cargarLista };

})(window);
