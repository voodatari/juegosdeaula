/* =========================================================
   Editor visual de bancos
   ---------------------------------------------------------
   Crear un banco desde cero o corregir uno guardado, sin tocar
   ningún formato. Trivial: tarjetas de preguntas (test y
   escritas). Rosco: equipos en pestañas, un rosco en miniatura
   y una fila por letra.

   · Todo se comprueba mientras se escribe: cada tarjeta o letra
     con algún problema se marca, y arriba se ve el total.
   · Se guarda solo un borrador en este navegador a cada cambio:
     si se cierra la pestaña sin querer, se recupera al volver.
   · «Probar» abre el juego con lo que haya en el editor, sin
     guardarlo; al salir del juego se vuelve aquí.
   · Atajos: Intro pasa al campo siguiente · Ctrl+Intro añade
     otra pregunta · Ctrl+S guarda.

   El editor no sabe dónde se guardan los bancos: usa Store
   (hoja de Google o Supabase, según la versión).
   ========================================================= */
window.Editor = (function (global) {

  var $ = function (id) { return document.getElementById(id); };
  var K_BORRADOR = 'trivialaula.editor.borrador';

  var LETRAS_CLASICAS = 'A B C D E F G H I J L M N Ñ O P Q R S T U V X Y Z'.split(' ');
  var LETRAS_TODAS = 'A B C D E F G H I J K L M N Ñ O P Q R S T U V W X Y Z'.split(' ');
  var CONTIENE_POR_DEFECTO = { 'Ñ': 1, 'X': 1, 'K': 1, 'W': 1 };
  var COLOR_OP = ['#FF5D73', '#2BC4B4', '#F5C518', '#8B7CF6'];

  var B = null;            // banco en edición
  var ID = null;           // a qué banco guardado corresponde (null = nuevo)
  var sucio = false;       // hay cambios sin guardar
  var equipoAct = 0;       // pestaña del rosco
  var montado = false;
  var tBorrador = null, tResumen = null;
  var deshacer = null;

  /* ---------------- utilidades ---------------- */
  function h(tag, attrs, hijos) {
    var e = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      var v = attrs[k];
      if (v === null || v === undefined || v === false) return;
      if (k === 'class') e.className = v;
      else if (k === 'text') e.textContent = v;
      else if (k === 'value') e.value = v;
      else if (k.slice(0, 2) === 'on') e.addEventListener(k.slice(2), v);
      else e.setAttribute(k, v === true ? '' : v);
    });
    [].concat(hijos || []).forEach(function (c) {
      if (c === null || c === undefined || c === false) return;
      e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    });
    return e;
  }
  function sinTildes(s) { return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, ''); }
  function norm(s) { return sinTildes(s).toLowerCase().replace(/\s+/g, ' ').trim(); }
  function copia(o) { return JSON.parse(JSON.stringify(o)); }
  function crecer(t) { t.style.height = 'auto'; t.style.height = (t.scrollHeight + 2) + 'px'; }
  function click() { if (global.Sonido) Sonido.click(); }

  /* Desplaza SOLO la página del editor hasta el elemento. El desplazamiento
     automático del navegador también mueve los contenedores de fuera (que
     no tienen barra), y la cabecera con «Guardar» y «Volver» quedaba fuera
     de la pantalla sin forma de recuperarla. */
  function verA(el, centrar) {
    var v = $('vistaEditor');
    if (!v || !el) return;
    var cab = document.querySelector('.edCab');
    var alto = cab ? cab.offsetHeight + 16 : 90;
    var rv = v.getBoundingClientRect(), re = el.getBoundingClientRect();
    var arriba = re.top - rv.top, abajo = re.bottom - rv.top;
    var destino = null;
    if (centrar) destino = v.scrollTop + arriba - (v.clientHeight - re.height) / 2;
    else if (arriba < alto) destino = v.scrollTop + arriba - alto;
    else if (abajo > v.clientHeight - 20) destino = v.scrollTop + abajo - v.clientHeight + 40;
    if (destino !== null) v.scrollTo({ top: Math.max(0, destino), behavior: 'smooth' });
    arreglarFuera();
  }
  /* por si algo desplazó los contenedores exteriores: se devuelven a su sitio */
  function arreglarFuera() {
    var e = document.querySelector('.escenario');
    if (e && e.scrollTop) e.scrollTop = 0;
    if (document.scrollingElement && document.scrollingElement.scrollTop) document.scrollingElement.scrollTop = 0;
  }

  function aviso(texto, accion, alPulsar) {
    var t = $('edAviso');
    clearTimeout(t._t);
    t.innerHTML = '';
    t.appendChild(document.createTextNode(texto));
    if (accion) t.appendChild(h('button', { class: 'mini', text: accion, onclick: function () { t.classList.remove('ver'); alPulsar(); } }));
    t.classList.add('ver');
    t._t = setTimeout(function () { t.classList.remove('ver'); }, accion ? 6000 : 2600);
  }

  /* ---------------- bancos vacíos ---------------- */
  function vacioTest() { return { q: '', o: ['', '', '', ''], c: '' }; }
  function vacioEscrita() { return { q: '', a: '' }; }
  function vacioLetra(l) { return { l: l, modo: CONTIENE_POR_DEFECTO[l] ? 'contiene' : 'empieza', d: '', a: '' }; }
  function nuevoBanco(tipo) {
    if (tipo === 'rosco') {
      return { tipo: 'rosco', titulo: '', roscos: [1, 2, 3, 4].map(function (n) {
        return { equipo: 'Equipo ' + n, letras: LETRAS_CLASICAS.map(vacioLetra) };
      }) };
    }
    return { tipo: 'trivial', titulo: '', test: [vacioTest()], escritas: [vacioEscrita()] };
  }

  /* un banco importado se deja en la forma que entiende el editor */
  function preparar(b) {
    b = copia(b);
    /* el tipo se deduce del contenido si no viene dicho */
    if (b.tipo !== 'rosco' && b.tipo !== 'trivial') b.tipo = b.roscos ? 'rosco' : 'trivial';
    if (b.tipo === 'rosco' && !b.roscos && (b.test || b.escritas)) b.tipo = 'trivial';
    delete b.origen;
    var id = b.id; delete b.id;
    if (b.tipo === 'rosco') {
      b.roscos = (b.roscos || []).filter(Boolean);
      if (!b.roscos.length) b.roscos = nuevoBanco('rosco').roscos;
      /* todas las letras que aparezcan, en el orden del primer rosco */
      var letras = [];
      b.roscos.forEach(function (r) {
        (r.letras || []).forEach(function (x) {
          var l = String(x.l || '').toUpperCase();
          if (l && letras.indexOf(l) < 0) letras.push(l);
        });
      });
      if (!letras.length) letras = LETRAS_CLASICAS.slice();
      b.roscos.forEach(function (r, i) {
        r.equipo = r.equipo || 'Equipo ' + (i + 1);
        r.letras = ponerLetras(r.letras || [], letras);
      });
    } else {
      b.tipo = 'trivial';
      b.test = (b.test || []).map(function (p) {
        var o = (p.o || []).slice(0, 4);
        while (o.length < 4) o.push('');
        return { q: p.q || '', o: o.map(function (x) { return String(x == null ? '' : x); }),
                 c: /^[ABCD]$/.test(p.c) ? p.c : '' };
      });
      b.escritas = (b.escritas || []).map(function (p) { return { q: p.q || '', a: p.a || '' }; });
    }
    b.titulo = b.titulo || '';
    return { banco: b, id: id };
  }
  function ponerLetras(lista, letras) {
    var por = {};
    lista.forEach(function (x) {
      var l = String(x.l || '').toUpperCase();
      if (!por[l]) por[l] = { l: l, modo: x.modo === 'contiene' ? 'contiene' : 'empieza', d: x.d || '', a: x.a || '' };
    });
    return letras.map(function (l) { return por[l] || vacioLetra(l); });
  }
  function letrasActuales() { return (B.roscos[0] ? B.roscos[0].letras : []).map(function (x) { return x.l; }); }

  /* lo que se guarda o se juega: sin huecos de relleno */
  function limpio() {
    var b = copia(B);
    b.titulo = String(b.titulo || '').trim();
    if (b.tipo === 'rosco') {
      if (!b.segundos) delete b.segundos;
      b.roscos.forEach(function (r) {
        r.equipo = String(r.equipo || '').trim();
        r.letras.forEach(function (x) { x.d = String(x.d).trim(); x.a = String(x.a).trim(); });
      });
    } else {
      b.test = b.test.filter(function (p) { return p.q.trim() || p.o.some(function (x) { return x.trim(); }); })
        .map(function (p) { return { q: p.q.trim(), o: p.o.map(function (x) { return x.trim(); }), c: p.c }; });
      b.escritas = b.escritas.filter(function (p) { return p.q.trim() || p.a.trim(); })
        .map(function (p) { return { q: p.q.trim(), a: p.a.trim() }; });
    }
    return b;
  }

  /* ---------------- borrador automático ---------------- */
  function guardarBorrador() {
    clearTimeout(tBorrador);
    tBorrador = setTimeout(function () {
      try { localStorage.setItem(K_BORRADOR, JSON.stringify({ banco: B, id: ID, fecha: Date.now() })); } catch (e) {}
    }, 500);
  }
  function leerBorrador() {
    try { return JSON.parse(localStorage.getItem(K_BORRADOR) || 'null'); } catch (e) { return null; }
  }
  function borrarBorrador() { clearTimeout(tBorrador); try { localStorage.removeItem(K_BORRADOR); } catch (e) {} }

  function cambiado() {
    sucio = true;
    pintarEstado();
    guardarBorrador();
    clearTimeout(tResumen);
    tResumen = setTimeout(function () { revisar(); }, 250);
  }

  /* =========================================================
     Comprobaciones
     ========================================================= */
  function problemasTest(p, i, repetidos) {
    var m = [];
    if (!p.q.trim()) m.push('falta la pregunta');
    var vacias = p.o.filter(function (x) { return !x.trim(); }).length;
    if (vacias) m.push(vacias === 1 ? 'falta una opción' : 'faltan ' + vacias + ' opciones');
    var ops = p.o.map(norm).filter(Boolean);
    if (ops.length !== new Set(ops).size) m.push('hay opciones repetidas');
    if (!p.c) m.push('marca la respuesta correcta');
    if (p.q.trim() && repetidos[norm(p.q)] > 1) m.push('pregunta repetida');
    return m;
  }
  function problemasEscrita(p, repetidos) {
    var m = [];
    if (!p.q.trim()) m.push('falta la pregunta');
    if (!p.a.trim()) m.push('falta la respuesta');
    if (p.q.trim() && repetidos[norm(p.q)] > 1) m.push('pregunta repetida');
    return m;
  }
  function contarEnunciados() {
    var c = {};
    B.test.concat(B.escritas).forEach(function (p) { var k = norm(p.q); if (k) c[k] = (c[k] || 0) + 1; });
    return c;
  }
  function claveSol(a) { return sinTildes(a).toUpperCase().replace(/[^A-ZÑ0-9]/g, ''); }
  function problemasLetra(x, soluciones) {
    var m = [];
    if (!x.d.trim()) m.push('falta la definición');
    if (!x.a.trim()) m.push('falta la solución');
    else {
      var L = sinTildes(x.l).toUpperCase(), A = sinTildes(x.a).toUpperCase().trim();
      if (x.l === 'Ñ') { L = 'Ñ'; A = x.a.toUpperCase().trim(); }
      if (x.modo === 'empieza' && A.charAt(0) !== L) m.push('no empieza por ' + x.l);
      if (x.modo === 'contiene' && A.indexOf(L) < 0) m.push('no contiene la ' + x.l);
      if (soluciones[claveSol(x.a)] > 1) m.push('solución repetida en el banco');
    }
    return m;
  }
  function contarSoluciones() {
    var c = {};
    B.roscos.forEach(function (r) { r.letras.forEach(function (x) { var k = claveSol(x.a); if (k) c[k] = (c[k] || 0) + 1; }); });
    return c;
  }

  /* repinta las marcas de todas las tarjetas/filas y el resumen de arriba */
  function revisar() {
    if (!B) return;
    if (B.tipo === 'rosco') {
      var sol = contarSoluciones();
      [].slice.call(document.querySelectorAll('#edCuerpo .edFila')).forEach(function (f) {
        var x = B.roscos[equipoAct].letras[+f.dataset.i];
        if (!x) return;
        var m = problemasLetra(x, sol);
        var vacia = !x.d.trim() && !x.a.trim();
        f.classList.toggle('mal', !!m.length && !vacia);
        f.classList.toggle('bien', !m.length);
        f.querySelector('.edEstadoFila').textContent = vacia ? '' : (m.length ? '⚠' : '✓');
        f.querySelector('.edEstadoFila').title = m.join(' · ');
      });
      pintarMiniRosco(sol);
      pintarPestanas(sol);
    } else {
      var rep = contarEnunciados();
      [].slice.call(document.querySelectorAll('#edCuerpo .edCarta')).forEach(function (c) {
        var lista = c.dataset.lista, i = +c.dataset.i, p = B[lista][i];
        if (!p) return;
        var vacia = lista === 'test' ? !p.q.trim() && !p.o.some(function (x) { return x.trim(); })
                                     : !p.q.trim() && !p.a.trim();
        var m = vacia ? [] : lista === 'test' ? problemasTest(p, i, rep) : problemasEscrita(p, rep);
        c.classList.toggle('mal', !!m.length);
        c.classList.toggle('vaciaCarta', vacia);
        var al = c.querySelector('.edAlerta');
        al.textContent = vacia ? 'vacía · no se guarda hasta que la rellenes' : m.length ? '⚠ ' + m.join(' · ') : '';
      });
    }
    pintarResumen();
  }

  function validacion() {
    var b = limpio();
    var v = Store.validar(b.tipo, b);
    if (!b.titulo) v.errores.unshift('Ponle un título al banco.');
    v.ok = !v.errores.length;
    return v;
  }

  function pintarResumen() {
    var r = $('edResumen');
    r.innerHTML = '';
    var v = validacion();
    if (B.tipo === 'rosco') {
      var total = 0, hechas = 0;
      B.roscos.forEach(function (x) { x.letras.forEach(function (y) { total++; if (y.d.trim() && y.a.trim()) hechas++; }); });
      r.appendChild(h('span', { class: 'edDato' }, [h('b', { text: String(B.roscos.length) }), B.roscos.length === 1 ? ' equipo' : ' equipos']));
      r.appendChild(h('span', { class: 'edDato' }, [h('b', { text: String(letrasActuales().length) }), ' letras']));
      r.appendChild(h('span', { class: 'edDato' }, [h('b', { text: hechas + '/' + total }), ' definiciones completas']));
    } else {
      var l = limpio();
      r.appendChild(h('span', { class: 'edDato' }, [h('b', { text: String(l.test.length) }), ' test']));
      r.appendChild(h('span', { class: 'edDato' }, [h('b', { text: String(l.escritas.length) }), l.escritas.length === 1 ? ' escrita' : ' escritas']));
      var d = Store.reparto(l.test);
      var max = Math.max(1, d.max);
      if (l.test.length) r.appendChild(h('span', { class: 'edReparto', title: 'Cuántas veces es correcta cada letra' },
        ['A', 'B', 'C', 'D'].map(function (k, i) {
          return h('span', { class: 'edBarra', style: '--c:' + COLOR_OP[i] + ';--h:' + Math.round(d.cuenta[k] / max * 100) + '%' },
            [h('i'), h('small', { text: k + ' ' + d.cuenta[k] })]);
        })));
      if (l.test.length >= 2) {
        r.appendChild(h('button', { class: 'mini', text: '🔀 Repartir letras', title: 'Cambia el orden de las opciones para que la correcta caiga repartida entre A, B, C y D',
          onclick: function () {
            click();
            var b = limpio();
            Store.barajar(b);
            /* se vuelca en el editor conservando las tarjetas vacías */
            var k = 0;
            B.test.forEach(function (p, j) {
              if (p.q.trim() || p.o.some(function (x) { return x.trim(); })) {
                B.test[j] = { q: p.q, o: b.test[k].o, c: b.test[k].c };
                k++;
              }
            });
            pintarCuerpo(); cambiado();
            aviso('Respuestas repartidas: ' + Store.reparto(limpio().test).texto);
          } }));
      }
    }
    var n = v.errores.length;
    r.appendChild(h('span', { class: 'edHueco' }));
    var b = h('button', { class: 'edProblemas ' + (n ? 'mal' : 'bien'), text: n ? '⚠ ' + n + (n === 1 ? ' cosa por revisar' : ' cosas por revisar') : '✓ Todo correcto' });
    if (n) b.onclick = function () { click(); mostrarProblemas(v); };
    r.appendChild(b);
    $('edGuardar').classList.toggle('apagado', !!n);
  }

  function mostrarProblemas(v) {
    var lista = v.errores.slice(0, 12).join('\n• ');
    Dialogo.avisar('Cosas por revisar', '• ' + lista + (v.errores.length > 12 ? '\n… y ' + (v.errores.length - 12) + ' más.' : ''));
    irAlPrimero();
  }
  function irAlPrimero() {
    var m = document.querySelector('#edCuerpo .edCarta.mal, #edCuerpo .edFila.mal');
    if (!m && B.tipo === 'rosco') {
      /* el problema puede estar en otro equipo */
      var sol = contarSoluciones();
      for (var e = 0; e < B.roscos.length; e++) {
        var i = B.roscos[e].letras.findIndex(function (x) { return problemasLetra(x, sol).length; });
        if (i >= 0) { if (e !== equipoAct) { equipoAct = e; pintarCuerpo(); } m = document.querySelector('#edCuerpo .edFila[data-i="' + i + '"]'); break; }
      }
    }
    if (!m) { if (!$('edTitulo').value.trim()) $('edTitulo').focus({ preventScroll: true }); return; }
    verA(m, true);
    m.classList.remove('destella'); void m.offsetWidth; m.classList.add('destella');
  }

  function pintarEstado() {
    var e = $('edEstado');
    e.textContent = sucio ? '● Sin guardar' : (ID ? '✓ Guardado' : 'Nuevo');
    e.className = 'edEstado' + (sucio ? ' sucio' : '');
    $('edGuardar').textContent = ID ? '💾 Guardar cambios' : '💾 Guardar';
    $('edCopia').classList.toggle('oculto', !ID);
  }

  /* =========================================================
     TRIVIAL
     ========================================================= */
  function cartaTest(p, i) {
    var q = h('textarea', { class: 'edQ', rows: 1, placeholder: 'Escribe la pregunta…', value: p.q, 'aria-label': 'Pregunta ' + (i + 1) });
    q.addEventListener('input', function () { p.q = q.value; crecer(q); cambiado(); });
    var ops = p.o.map(function (txt, k) {
      var L = 'ABCD'[k];
      var inp = h('input', { class: 'edOpTxt', value: txt, placeholder: 'Opción ' + L, 'aria-label': 'Opción ' + L });
      inp.addEventListener('input', function () { p.o[k] = inp.value; cambiado(); });
      var letra = h('button', { class: 'edLetra', type: 'button', text: L, style: '--c:' + COLOR_OP[k],
        title: 'Marcar ' + L + ' como la respuesta correcta', 'aria-pressed': p.c === L ? 'true' : 'false' });
      letra.onclick = function () {
        click();
        p.c = L;
        [].slice.call(letra.closest('.edOps').children).forEach(function (o, j) {
          o.classList.toggle('ok', j === k);
          o.querySelector('.edLetra').setAttribute('aria-pressed', j === k ? 'true' : 'false');
        });
        cambiado();
      };
      return h('div', { class: 'edOp' + (p.c === L ? ' ok' : '') }, [letra, inp,
        h('span', { class: 'edTick', text: '✓', 'aria-hidden': 'true' })]);
    });
    return carta('test', i, 'Test', [q, h('div', { class: 'edOps' }, ops)], q);
  }

  function cartaEscrita(p, i) {
    var q = h('textarea', { class: 'edQ', rows: 1, placeholder: 'Escribe la pregunta…', value: p.q, 'aria-label': 'Pregunta escrita ' + (i + 1) });
    q.addEventListener('input', function () { p.q = q.value; crecer(q); cambiado(); });
    var a = h('input', { class: 'edResp', placeholder: 'Respuesta', value: p.a, 'aria-label': 'Respuesta' });
    a.addEventListener('input', function () { p.a = a.value; cambiado(); });
    return carta('escritas', i, 'Escrita', [q, h('label', { class: 'edRespFila' }, [h('span', { text: 'Respuesta' }), a])], q);
  }

  function carta(lista, i, etiqueta, contenido) {
    var total = B[lista].length;
    var otro = lista === 'test' ? 'escritas' : 'test';
    var c = h('div', { class: 'edCarta ' + (lista === 'test' ? 'esTest' : 'esEscrita'), 'data-lista': lista, 'data-i': i }, [
      h('div', { class: 'edCartaCab' }, [
        h('span', { class: 'edAsa', title: 'Arrastra para cambiar el orden', text: '⠿' }),
        h('span', { class: 'edNum', text: etiqueta + ' ' + (i + 1) }),
        h('span', { class: 'edAlerta' }),
        h('span', { class: 'edBtns' }, [
          h('button', { class: 'edB', type: 'button', text: '↑', title: 'Subir', disabled: i === 0, onclick: function () { mover(lista, i, i - 1); } }),
          h('button', { class: 'edB', type: 'button', text: '↓', title: 'Bajar', disabled: i === total - 1, onclick: function () { mover(lista, i, i + 1); } }),
          h('button', { class: 'edB', type: 'button', text: '⧉', title: 'Duplicar', onclick: function () { duplicar(lista, i); } }),
          h('button', { class: 'edB', type: 'button', text: lista === 'test' ? '✍' : '🔤',
            title: lista === 'test' ? 'Convertir en pregunta escrita' : 'Convertir en pregunta tipo test', onclick: function () { convertir(lista, i, otro); } }),
          h('button', { class: 'edB rojo', type: 'button', text: '🗑', title: 'Borrar', onclick: function () { borrar(lista, i); } })
        ])
      ])
    ].concat(contenido));
    arrastrable(c, lista, i);
    return c;
  }

  function mover(lista, de, a) {
    if (a < 0 || a >= B[lista].length) return;
    click();
    var x = B[lista].splice(de, 1)[0];
    B[lista].splice(a, 0, x);
    pintarCuerpo(); cambiado();
    enfocar(lista, a);
  }
  function duplicar(lista, i) {
    click();
    B[lista].splice(i + 1, 0, copia(B[lista][i]));
    pintarCuerpo(); cambiado();
    enfocar(lista, i + 1);
  }
  function borrar(lista, i) {
    click();
    var x = B[lista].splice(i, 1)[0];
    deshacer = { lista: lista, i: i, x: x };
    if (!B[lista].length && lista === 'test' && !B.escritas.length) B.test.push(vacioTest());
    pintarCuerpo(); cambiado();
    aviso('Pregunta borrada.', '↶ Deshacer', function () {
      if (!deshacer) return;
      B[deshacer.lista].splice(deshacer.i, 0, deshacer.x);
      deshacer = null;
      pintarCuerpo(); cambiado();
    });
  }
  function convertir(lista, i, otro) {
    click();
    var p = B[lista].splice(i, 1)[0];
    var n;
    if (otro === 'escritas') {
      n = { q: p.q, a: p.c ? p.o['ABCD'.indexOf(p.c)] : '' };
    } else {
      n = { q: p.q, o: [p.a || '', '', '', ''], c: p.a ? 'A' : '' };
    }
    B[otro].push(n);
    pintarCuerpo(); cambiado();
    enfocar(otro, B[otro].length - 1);
    aviso(otro === 'escritas' ? 'Convertida en pregunta escrita (al final de la lista).' : 'Convertida en tipo test: completa las otras opciones.');
  }
  function anadir(lista, tras) {
    var i = tras === undefined ? B[lista].length : tras + 1;
    B[lista].splice(i, 0, lista === 'test' ? vacioTest() : vacioEscrita());
    pintarCuerpo(); cambiado();
    enfocar(lista, i);
  }
  function enfocar(lista, i) {
    requestAnimationFrame(function () {
      var c = document.querySelector('#edCuerpo .edCarta[data-lista="' + lista + '"][data-i="' + i + '"]');
      if (!c) return;
      verA(c, true);
      var q = c.querySelector('.edQ');
      if (q) q.focus({ preventScroll: true });
      c.classList.remove('destella'); void c.offsetWidth; c.classList.add('destella');
    });
  }

  /* arrastrar tarjetas por el asa */
  var arrastre = null;
  function arrastrable(c, lista, i) {
    var asa = c.querySelector('.edAsa');
    asa.addEventListener('pointerdown', function () { c.setAttribute('draggable', 'true'); });
    c.addEventListener('dragstart', function (e) {
      arrastre = { lista: lista, i: i };
      c.classList.add('arrastrando');
      try { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', ''); } catch (x) {}
    });
    c.addEventListener('dragend', function () {
      c.removeAttribute('draggable'); c.classList.remove('arrastrando');
      [].slice.call(document.querySelectorAll('.edCarta.sobre')).forEach(function (x) { x.classList.remove('sobre', 'antes', 'despues'); });
      arrastre = null;
    });
    c.addEventListener('dragover', function (e) {
      if (!arrastre || arrastre.lista !== lista) return;
      e.preventDefault();
      var r = c.getBoundingClientRect(), antes = e.clientY < r.top + r.height / 2;
      c.classList.add('sobre'); c.classList.toggle('antes', antes); c.classList.toggle('despues', !antes);
    });
    c.addEventListener('dragleave', function () { c.classList.remove('sobre', 'antes', 'despues'); });
    c.addEventListener('drop', function (e) {
      if (!arrastre || arrastre.lista !== lista) return;
      e.preventDefault();
      var r = c.getBoundingClientRect(), antes = e.clientY < r.top + r.height / 2;
      var de = arrastre.i, a = i + (antes ? 0 : 1);
      if (de < a) a--;
      if (a !== de) {
        var x = B[lista].splice(de, 1)[0];
        B[lista].splice(a, 0, x);
        pintarCuerpo(); cambiado();
        enfocar(lista, a);
      }
    });
  }

  function pintarTrivial(cuerpo) {
    var secT = h('section', { class: 'edSeccion' }, [
      h('div', { class: 'edSecCab' }, [h('h2', { text: '🅰 Tipo test' }),
        h('span', { class: 'tenue', text: 'Pulsa la letra de la opción correcta.' })]),
      h('div', { class: 'edLista', id: 'edListaTest' }, B.test.map(cartaTest)),
      h('button', { class: 'edAnadir', type: 'button', text: '+ Añadir pregunta tipo test', onclick: function () { click(); anadir('test'); } })
    ]);
    var secE = h('section', { class: 'edSeccion' }, [
      h('div', { class: 'edSecCab' }, [h('h2', { text: '✍ Respuesta escrita' }),
        h('span', { class: 'tenue', text: 'Las puntúa el maestro al ver la solución.' })]),
      h('div', { class: 'edLista', id: 'edListaEsc' }, B.escritas.map(cartaEscrita)),
      h('button', { class: 'edAnadir', type: 'button', text: '+ Añadir pregunta escrita', onclick: function () { click(); anadir('escritas'); } })
    ]);
    cuerpo.appendChild(secT);
    cuerpo.appendChild(secE);
  }

  /* =========================================================
     ROSCO
     ========================================================= */
  function pintarRosco(cuerpo) {
    if (equipoAct >= B.roscos.length) equipoAct = B.roscos.length - 1;
    var r = B.roscos[equipoAct];

    /* letras y tiempo, comunes a todos los equipos */
    var letrasTxt = h('input', { class: 'edLetrasTxt', value: letrasActuales().join(' '), spellcheck: 'false',
      'aria-label': 'Letras del rosco, separadas por espacios', title: 'Las letras de todos los roscos, en orden' });
    letrasTxt.addEventListener('change', function () { cambiarLetras(letrasTxt.value); });
    var segs = h('input', { class: 'edSegs', type: 'number', min: 30, max: 900, step: 15, value: B.segundos || '', placeholder: '150' });
    segs.addEventListener('input', function () { var v = parseInt(segs.value, 10); B.segundos = isNaN(v) ? undefined : v; cambiado(); });
    cuerpo.appendChild(h('section', { class: 'edSeccion edAjRosco' }, [
      h('label', { class: 'edCampoFila' }, [h('span', { text: 'Letras' }), letrasTxt]),
      h('div', { class: 'edPresets' }, [
        h('button', { class: 'mini', type: 'button', text: 'Clásicas (25)', onclick: function () { cambiarLetras(LETRAS_CLASICAS.join(' ')); } }),
        h('button', { class: 'mini', type: 'button', text: 'Con K y W (27)', onclick: function () { cambiarLetras(LETRAS_TODAS.join(' ')); } })
      ]),
      h('label', { class: 'edCampoFila corto' }, [h('span', { text: 'Bote por equipo (s)' }), segs])
    ]));

    /* pestañas de equipos */
    var pest = h('div', { class: 'edEquipos', id: 'edEquipos' });
    B.roscos.forEach(function (x, k) {
      pest.appendChild(h('button', { class: 'edEquipo' + (k === equipoAct ? ' act' : ''), type: 'button', 'data-k': k,
        onclick: function () { click(); equipoAct = k; pintarCuerpo(); } }, [h('span', { class: 'edEqNom', text: x.equipo || 'Equipo ' + (k + 1) }), h('small', { class: 'edEqCuenta' })]));
    });
    if (B.roscos.length < 4) pest.appendChild(h('button', { class: 'edEquipo mas', type: 'button', text: '+ Equipo', onclick: function () {
      click();
      B.roscos.push({ equipo: 'Equipo ' + (B.roscos.length + 1), letras: letrasActuales().map(vacioLetra) });
      equipoAct = B.roscos.length - 1;
      pintarCuerpo(); cambiado();
    } }));
    cuerpo.appendChild(pest);

    /* nombre del equipo y acciones */
    var nombre = h('input', { class: 'edEqInput', value: r.equipo, placeholder: 'Nombre del equipo', 'aria-label': 'Nombre del equipo' });
    nombre.addEventListener('input', function () {
      r.equipo = nombre.value;
      var p = document.querySelector('.edEquipo.act .edEqNom');
      if (p) p.textContent = nombre.value || 'Equipo ' + (equipoAct + 1);
      cambiado();
    });
    var panel = h('section', { class: 'edSeccion edPanelRosco' }, [
      h('div', { class: 'edEqCab' }, [nombre,
        h('span', { class: 'edBtns' }, [
          h('button', { class: 'mini', type: 'button', text: '⧉ Duplicar equipo', disabled: B.roscos.length >= 4, onclick: function () {
            click();
            var n = copia(r); n.equipo = (r.equipo || 'Equipo') + ' (copia)';
            B.roscos.splice(equipoAct + 1, 0, n); equipoAct++;
            pintarCuerpo(); cambiado();
            aviso('Equipo duplicado: recuerda cambiar las soluciones, no pueden repetirse.');
          } }),
          h('button', { class: 'mini rojo', type: 'button', text: '🗑 Quitar equipo', disabled: B.roscos.length <= 1, onclick: function () {
            click();
            var quitado = B.roscos.splice(equipoAct, 1)[0], donde = equipoAct;
            equipoAct = Math.max(0, equipoAct - 1);
            pintarCuerpo(); cambiado();
            aviso('Equipo quitado.', '↶ Deshacer', function () { B.roscos.splice(donde, 0, quitado); equipoAct = donde; pintarCuerpo(); cambiado(); });
          } })
        ])]),
      h('div', { class: 'edRoscoZona' }, [
        h('div', { class: 'edMini', id: 'edMini', 'aria-hidden': 'true' }),
        h('div', { class: 'edFilas', id: 'edFilas' }, r.letras.map(function (x, i) { return filaLetra(x, i); }))
      ])
    ]);
    cuerpo.appendChild(panel);
  }

  function filaLetra(x, i) {
    var modo = h('button', { class: 'edModo ' + x.modo, type: 'button', text: x.modo === 'contiene' ? 'CONTIENE' : 'EMPIEZA',
      title: 'Pulsa para cambiar entre «empieza por» y «contiene»' });
    modo.onclick = function () {
      click();
      x.modo = x.modo === 'contiene' ? 'empieza' : 'contiene';
      modo.textContent = x.modo === 'contiene' ? 'CONTIENE' : 'EMPIEZA';
      modo.className = 'edModo ' + x.modo;
      cambiado();
    };
    var d = h('textarea', { class: 'edDef', rows: 1, placeholder: 'Definición', value: x.d, 'aria-label': 'Definición de la ' + x.l });
    d.addEventListener('input', function () { x.d = d.value; crecer(d); cambiado(); });
    var a = h('input', { class: 'edSol', placeholder: 'Solución', value: x.a, 'aria-label': 'Solución de la ' + x.l });
    a.addEventListener('input', function () { x.a = a.value; cambiado(); });
    return h('div', { class: 'edFila', 'data-i': i }, [
      h('span', { class: 'edL', text: x.l }), modo, d, a, h('span', { class: 'edEstadoFila' })
    ]);
  }

  function cambiarLetras(txt) {
    var nuevas = [];
    String(txt || '').toUpperCase().split(/[\s,;·]+/).forEach(function (t) {
      t.split('').forEach(function (l) { if (/[A-ZÑ]/.test(l) && nuevas.indexOf(l) < 0) nuevas.push(l); });
    });
    if (!nuevas.length) { pintarCuerpo(); return; }
    var perdidas = 0, antes = letrasActuales();
    B.roscos.forEach(function (r) {
      r.letras.forEach(function (x) { if (nuevas.indexOf(x.l) < 0 && (x.d.trim() || x.a.trim())) perdidas++; });
    });
    var aplicar = function () {
      B.roscos.forEach(function (r) { r.letras = ponerLetras(r.letras, nuevas); });
      pintarCuerpo(); cambiado();
    };
    if (perdidas) {
      Dialogo.confirmar('Quitar letras', 'Al quitar ' + antes.filter(function (l) { return nuevas.indexOf(l) < 0; }).join(', ') +
        ' se borran ' + perdidas + ' definiciones ya escritas.', 'Quitarlas', true)
        .then(function (si) { if (si) aplicar(); else pintarCuerpo(); });
    } else aplicar();
  }

  function pintarMiniRosco(sol) {
    var m = $('edMini');
    if (!m) return;
    var r = B.roscos[equipoAct], n = r.letras.length;
    m.innerHTML = '';
    r.letras.forEach(function (x, i) {
      var a = (-90 + i * 360 / n) * Math.PI / 180;
      var pr = problemasLetra(x, sol), vacia = !x.d.trim() && !x.a.trim();
      m.appendChild(h('button', { class: 'edMiniL ' + (vacia ? 'vacia' : pr.length ? 'mal' : 'bien'), type: 'button', text: x.l,
        style: 'left:' + (50 + 43 * Math.cos(a)).toFixed(2) + '%;top:' + (50 + 43 * Math.sin(a)).toFixed(2) + '%',
        title: x.l + (vacia ? ' · vacía' : pr.length ? ' · ' + pr.join(' · ') : ' · lista'),
        onclick: function () {
          var f = document.querySelector('#edFilas .edFila[data-i="' + i + '"]');
          if (!f) return;
          verA(f, true);
          f.querySelector('.edDef').focus({ preventScroll: true });
          f.classList.remove('destella'); void f.offsetWidth; f.classList.add('destella');
        } }));
    });
    var hechas = r.letras.filter(function (x) { return !problemasLetra(x, sol).length; }).length;
    m.appendChild(h('div', { class: 'edMiniCentro' }, [h('b', { text: hechas + '/' + n }), h('small', { text: 'listas' })]));
  }
  function pintarPestanas(sol) {
    [].slice.call(document.querySelectorAll('.edEquipo[data-k]')).forEach(function (p) {
      var r = B.roscos[+p.dataset.k];
      var bien = r.letras.filter(function (x) { return !problemasLetra(x, sol).length; }).length;
      p.querySelector('.edEqCuenta').textContent = bien + '/' + r.letras.length;
      p.classList.toggle('completo', bien === r.letras.length);
    });
  }

  /* =========================================================
     Pintar, teclado
     ========================================================= */
  function pintarCuerpo() {
    var cuerpo = $('edCuerpo');
    var y = $('vistaEditor').scrollTop;
    cuerpo.innerHTML = '';
    if (B.tipo === 'rosco') pintarRosco(cuerpo); else pintarTrivial(cuerpo);
    [].slice.call(cuerpo.querySelectorAll('textarea')).forEach(crecer);
    $('vistaEditor').scrollTop = y;
    revisar();
  }

  function pintarTodo() {
    $('edTipo').textContent = B.tipo === 'rosco' ? '🔵 ROSCO' : '🏆 TRIVIAL';
    $('edTipo').className = 'edTipo t-' + B.tipo;
    $('edTitulo').value = B.titulo;
    pintarEstado();
    pintarCuerpo();
  }

  /* Intro pasa al campo siguiente (en las preguntas, Mayús+Intro hace
     salto de línea); Ctrl+Intro añade otra pregunta detrás */
  function tecla(e) {
    if (!B || App.vista() !== 'editor' || document.querySelector('.capa.ver')) return;
    if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S')) { e.preventDefault(); guardar(); return; }
    var t = e.target;
    if (!t.closest || !t.closest('#edCuerpo')) return;
    if (e.key !== 'Enter' || e.shiftKey || e.altKey) return;
    e.preventDefault();
    var c = t.closest('.edCarta');
    if ((e.ctrlKey || e.metaKey) && c) { anadir(c.dataset.lista, +c.dataset.i); return; }
    var zona = t.closest('.edCarta, .edFila, .edEqCab') || $('edCuerpo');
    var campos = [].slice.call(zona.querySelectorAll('textarea, input'));
    var k = campos.indexOf(t);
    if (k >= 0 && k < campos.length - 1) { campos[k + 1].focus({ preventScroll: true }); verA(campos[k + 1]); return; }
    /* último campo: a la siguiente tarjeta o fila (y si no hay, se crea) */
    var sig = zona.nextElementSibling;
    if (sig && sig.querySelector('textarea, input')) { sig.querySelector('textarea, input').focus({ preventScroll: true }); verA(sig); return; }
    if (c) anadir(c.dataset.lista);
  }

  /* =========================================================
     Guardar, probar, salir
     ========================================================= */
  function comprobarAntes(accion) {
    B.titulo = $('edTitulo').value;
    var v = validacion();
    if (v.ok) return true;
    Dialogo.avisar('Antes de ' + accion + ' hay que revisar',
      '• ' + v.errores.slice(0, 10).join('\n• ') + (v.errores.length > 10 ? '\n… y ' + (v.errores.length - 10) + ' más.' : ''))
      .then(irAlPrimero);
    return false;
  }

  /* en la versión de un solo usuario, sobrescribir pide el código de gestión */
  function permiso() {
    if (!Store.entrarAdmin || Store.esAdmin()) return Promise.resolve(true);
    return Dialogo.pedir({
      titulo: '🔐 Código de gestión', texto: 'Para cambiar un banco ya guardado hace falta el código.',
      campo: true, clave: true, pista: 'código', aceptar: 'Continuar',
      comprobar: function (v) { return Store.entrarAdmin(v) ? '' : 'Ese código no es correcto.'; }
    }).then(function (v) { return v !== null; });
  }

  var guardando = false;
  function guardar(comoCopia) {
    if (guardando || !comprobarAntes('guardar')) return;
    var b = limpio();
    var sobrescribir = ID && !comoCopia && Store.editable(ID);
    (sobrescribir ? permiso() : Promise.resolve(true)).then(function (ok) {
      if (!ok) return;
      guardando = true;
      var boton = $('edGuardar');
      boton.disabled = true;
      boton.textContent = 'Guardando…';
      var p = sobrescribir ? Store.actualizar(ID, b) : Store.guardar(b);
      return p.then(function (res) {
        ID = (res && res.id) || ID;
        sucio = false;
        borrarBorrador();
        if (global.Sonido) Sonido.ok();
        FX.lluvia(40);
        aviso(comoCopia ? '✔ Guardado como banco nuevo.' : '✔ Guardado.');
        if (global.Importar && Importar.cargarLista) Importar.cargarLista();
        if (global.Menu && Menu.cargar) Menu.cargar();
      }).catch(function (err) {
        Dialogo.avisar('No se ha podido guardar', err.message + '\n\nNo se pierde nada: el borrador sigue guardado en este navegador.');
      }).then(function () {
        guardando = false;
        boton.disabled = false;
        pintarEstado();
      });
    });
  }

  function probar() {
    if (!comprobarAntes('probarlo')) return;
    click();
    var id = Store.temporal(limpio());
    App.volverA('editor');
    App.ir(B.tipo, id);
  }

  function salir() {
    click();
    var fuera = function () { B = null; ID = null; sucio = false; App.ir(volverA || 'importar'); };
    if (!sucio) { borrarBorrador(); fuera(); return; }
    Dialogo.confirmar('Salir del editor', 'Hay cambios sin guardar. Se quedan como borrador en este navegador y ' +
      'podrás recuperarlos la próxima vez que abras el editor.', 'Salir sin guardar')
      .then(function (si) { if (si) fuera(); });
  }

  /* =========================================================
     Montaje y entrada
     ========================================================= */
  function montar() {
    if (montado) return;
    montado = true;
    var v = $('vistaEditor');
    v.innerHTML = '';
    v.appendChild(h('div', { class: 'edPagina' }, [
      h('header', { class: 'edCab' }, [
        h('button', { class: 'btn', id: 'edVolver', type: 'button', text: '← Volver', onclick: salir }),
        h('span', { class: 'edTipo', id: 'edTipo' }),
        h('input', { class: 'edTitulo', id: 'edTitulo', placeholder: 'Título del banco', maxlength: 120, 'aria-label': 'Título del banco' }),
        h('span', { class: 'edEstado', id: 'edEstado' }),
        h('span', { class: 'edAcc' }, [
          h('button', { class: 'btn', id: 'edProbar', type: 'button', text: '▶ Probar', title: 'Jugar con lo que hay ahora, sin guardar', onclick: probar }),
          h('button', { class: 'btn', id: 'edCsv', type: 'button', text: '⬇ CSV', title: 'Descargar el banco como archivo .csv',
            onclick: function () { click(); B.titulo = $('edTitulo').value; CSVBancos.descargar(limpio()); } }),
          h('button', { class: 'btn oculto', id: 'edCopia', type: 'button', text: '⧉ Guardar copia', title: 'Guardar como un banco nuevo, sin tocar el original',
            onclick: function () { guardar(true); } }),
          h('button', { class: 'btn principal', id: 'edGuardar', type: 'button', text: '💾 Guardar', title: 'Ctrl+S', onclick: function () { guardar(); } })
        ])
      ]),
      h('div', { class: 'edResumen', id: 'edResumen' }),
      h('div', { class: 'edCuerpo', id: 'edCuerpo' }),
      h('p', { class: 'edAtajos' }, ['Intro: campo siguiente · Mayús+Intro: salto de línea · Ctrl+Intro: otra pregunta · Ctrl+S: guardar']),
      h('div', { class: 'edAviso', id: 'edAviso', role: 'status' })
    ]));
    $('edTitulo').addEventListener('input', function () { B.titulo = this.value; cambiado(); });
    /* el escenario y la página no deben desplazarse nunca (solo cada vista) */
    var esc = document.querySelector('.escenario');
    if (esc) esc.addEventListener('scroll', function () { if (esc.scrollTop) esc.scrollTop = 0; });
    global.addEventListener('scroll', function () { if (App.vista() === 'editor') arreglarFuera(); });
    document.addEventListener('keydown', tecla);
    global.addEventListener('beforeunload', function (e) {
      if (B && sucio) { e.preventDefault(); e.returnValue = ''; }
    });
  }

  var volverA = null;
  var peticion = 0;

  /* op: {tipo:'trivial'|'rosco'} para uno nuevo · {banco, id} para editar
     · {id} para cargarlo · volver: vista a la que regresar */
  function cargar(op) {
    op = op || {};
    if (op.banco) return Promise.resolve(op);
    if (op.id) return Store.banco(op.id).then(function (b) { return { banco: b, id: op.id }; });
    return Promise.resolve({ banco: nuevoBanco(op.tipo), id: null, nuevo: true });
  }

  function empezar(banco, id) {
    var p = preparar(banco);
    B = p.banco;
    ID = id !== undefined ? id : null;
    if (ID && !Store.editable(ID)) ID = null;          // los de ejemplo se guardan como nuevos
    sucio = false;
    equipoAct = 0;
    deshacer = null;
    pintarTodo();
    $('vistaEditor').scrollTop = 0;
    arreglarFuera();
  }

  /* entrada desde App.ir('editor', op). Sin op (vuelta de «Probar»)
     se sigue exactamente donde estaba. */
  function entrar(op) {
    montar();
    if (!op && B) { pintarTodo(); return; }
    if (!op) op = {};
    volverA = op.volver || null;
    $('edCuerpo').innerHTML = '<div class="edCargando">Cargando…</div>';
    var turno = ++peticion;           // si entretanto se abre otro banco, esta carga se descarta
    cargar(op).then(function (r) {
      if (turno !== peticion) return;
      var id = r.id || null;
      var bor = leerBorrador();
      var mismo = bor && bor.banco && (bor.id || null) === id && (id || bor.banco.tipo === (r.banco.tipo || op.tipo));
      /* un banco que llega de la importación también es «nuevo»: el
         borrador solo se ofrece al crear desde cero o al editar el mismo */
      if (mismo && (id || r.nuevo)) {
        var hace = Math.round((Date.now() - (bor.fecha || 0)) / 60000);
        return Dialogo.confirmar('📝 Borrador sin guardar',
          'Hay un borrador de «' + (bor.banco.titulo || 'sin título') + '» de hace ' +
          (hace < 1 ? 'menos de un minuto' : hace < 60 ? hace + ' min' : Math.round(hace / 60) + ' h') +
          '. ¿Lo recupero?', 'Recuperarlo').then(function (si) {
            if (si) { empezar(bor.banco, bor.id); sucio = true; pintarEstado(); }
            else { borrarBorrador(); empezar(r.banco, id); }
          });
      }
      empezar(r.banco, id);
      if (op.banco && !id) { sucio = true; pintarEstado(); guardarBorrador(); }
      setTimeout(function () { if (B && !B.titulo) $('edTitulo').focus({ preventScroll: true }); }, 80);
    }).catch(function (err) {
      if (turno !== peticion) return;
      Dialogo.avisar('No se puede abrir el banco', err.message);
      App.ir(volverA || 'importar');
    });
  }

  /* API pública: abre el editor (desde cualquier vista) */
  function abrir(op) { App.ir('editor', op || {}); }

  return { abrir: abrir, entrar: entrar, abierto: function () { return !!B; } };

})(window);
