/* =========================================================
   Bancos en CSV
   ---------------------------------------------------------
   Un formato de texto plano, línea a línea, pensado para que
   las IA no se equivoquen y para poder abrirlo en Excel.
   La PRIMERA palabra de cada línea dice qué es esa línea:

     TRIVIAL;Título del banco
     TEST;Pregunta;opción A;opción B;opción C;opción D;letra correcta
     ESCRITA;Pregunta;respuesta

     ROSCO;Título del banco
     SEGUNDOS;150                       (opcional)
     EQUIPO;Equipo 1
     LETRA;A;EMPIEZA;definición;solución
     LETRA;Ñ;CONTIENE;definición;solución

   · El separador es el punto y coma. También se aceptan el
     tabulador (lo que sale al copiar de Excel) y la barra |.
   · Un texto con ; dentro va entre comillas: "Sí; claro".
   · Se ignoran las líneas vacías, las que empiezan por # y las
     marcas ``` que añaden algunas IA.
   · Puede haber varios bancos seguidos en el mismo texto.
   · Los errores dicen la línea exacta, para devolvérselos a la IA.
   ========================================================= */
window.CSVBancos = (function () {

  function sinTildes(s) {
    return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '');
  }
  function clave(s) {
    return sinTildes(s).toUpperCase().replace(/[:.]+$/, '').replace(/\s+/g, ' ').trim();
  }

  /* ---------- troceado respetando comillas ---------- */
  function elegirSeparador(lineas) {
    var cuenta = { ';': 0, '\t': 0, '|': 0 };
    lineas.slice(0, 15).forEach(function (l) {
      Object.keys(cuenta).forEach(function (s) { cuenta[s] += l.split(s).length - 1; });
    });
    var mejor = Object.keys(cuenta).sort(function (a, b) { return cuenta[b] - cuenta[a]; })[0];
    return cuenta[mejor] ? mejor : ',';
  }

  /* devuelve [{linea, campos}] (un registro puede ocupar varias líneas
     si un campo entre comillas lleva saltos de línea) */
  function registros(texto, sep) {
    var out = [], campos = [], campo = '', dentro = false, linea = 1, inicio = 1, i, c;
    function cerrarCampo() { campos.push(campo); campo = ''; }
    function cerrarRegistro() {
      cerrarCampo();
      out.push({ linea: inicio, campos: campos });
      campos = []; inicio = linea + 1;
    }
    for (i = 0; i < texto.length; i++) {
      c = texto[i];
      if (dentro) {
        if (c === '"') {
          if (texto[i + 1] === '"') { campo += '"'; i++; }
          else dentro = false;
        } else {
          if (c === '\n') linea++;
          campo += c;
        }
        continue;
      }
      if (c === '"' && campo.trim() === '') { campo = ''; dentro = true; continue; }
      if (c === sep) { cerrarCampo(); continue; }
      if (c === '\n') { cerrarRegistro(); linea++; inicio = linea; continue; }
      campo += c;
    }
    if (campo !== '' || campos.length) cerrarRegistro();
    return out;
  }

  /* ---------- lectura ---------- */
  var MODOS = { EMPIEZA: 'empieza', 'EMPIEZA POR': 'empieza', E: 'empieza', EMPIEZO: 'empieza',
                CONTIENE: 'contiene', 'CONTIENE LA': 'contiene', C: 'contiene', LLEVA: 'contiene' };

  function leer(texto) {
    texto = String(texto || '').replace(/^﻿/, '').replace(/\r\n?/g, '\n');
    var crudas = texto.split('\n');
    var utiles = crudas.filter(function (l) { return l.trim() && !/^\s*(#|\/\/|```)/.test(l); });
    var sep = elegirSeparador(utiles);
    /* las líneas de comentario y las ``` se vacían (sin moverlas, para no
       descolocar la numeración de líneas) */
    texto = crudas.map(function (l) { return /^\s*(#|\/\/|```)/.test(l) ? '' : l; }).join('\n');

    var bancos = [], errores = [], avisos = [];
    var actual = null, rosco = null;
    function err(n, t) { errores.push({ linea: n, texto: 'Línea ' + n + ': ' + t }); }
    function av(n, t) { avisos.push({ linea: n, texto: 'Línea ' + n + ': ' + t }); }

    function nuevo(tipo, titulo, n) {
      actual = tipo === 'rosco'
        ? { tipo: 'rosco', titulo: titulo, roscos: [] }
        : { tipo: 'trivial', titulo: titulo, test: [], escritas: [] };
      actual._linea = n;
      bancos.push(actual);
      rosco = null;
    }
    function exigir(tipo, n, que) {
      if (actual && actual.tipo === tipo) return true;
      if (!actual) {
        nuevo(tipo, '', n);
        av(n, 'falta la primera línea «' + tipo.toUpperCase() + ';Título»; lo tomo como un banco de ' + tipo + '.');
        return true;
      }
      err(n, 'hay una línea de ' + que + ' dentro de un banco de ' + actual.tipo + '.');
      return false;
    }
    function limpio(c) { return String(c == null ? '' : c).trim(); }

    registros(texto, sep).forEach(function (r) {
      var c = r.campos.map(limpio);
      while (c.length && c[c.length - 1] === '') c.pop();       // separadores sobrantes al final
      if (!c.length || (c.length === 1 && !c[0])) return;
      var n = r.linea, k = clave(c[0]), resto = c.slice(1);

      if (k === 'TRIVIAL' || k === 'ROSCO') {
        nuevo(k === 'ROSCO' ? 'rosco' : 'trivial', resto.join(' ').trim(), n);
        return;
      }
      if (k === 'TITULO' || k === 'NOMBRE') {
        if (!actual) { err(n, 'el título va después de la línea TRIVIAL o ROSCO.'); return; }
        actual.titulo = resto.join(' ').trim();
        return;
      }
      if (k === 'TEST' || k === 'PREGUNTA' || k === 'OPCION MULTIPLE' || k === 'TIPO TEST') {
        if (!exigir('trivial', n, 'TEST')) return;
        if (resto.length !== 6) {
          err(n, 'una pregunta TEST lleva 7 columnas (TEST;pregunta;A;B;C;D;letra) y esta tiene ' +
            (resto.length + 1) + (resto.length > 6 ? '. ¿Hay algún ; dentro del texto? Ponlo entre comillas.' : '.'));
          return;
        }
        var o = resto.slice(1, 5), corr = clave(resto[5]).replace(/[)\].]/g, '');
        var letra = /^[ABCD]$/.test(corr) ? corr : null;
        if (!letra) {
          var i = o.map(clave).indexOf(clave(resto[5]));
          if (i >= 0) letra = 'ABCD'[i];
        }
        if (!letra) { err(n, 'la última columna debe ser la letra correcta (A, B, C o D) y pone «' + resto[5] + '».'); return; }
        actual.test.push({ q: resto[0], o: o, c: letra, _linea: n });
        return;
      }
      if (k === 'ESCRITA' || k === 'RESPUESTA ESCRITA' || k === 'ABIERTA') {
        if (!exigir('trivial', n, 'ESCRITA')) return;
        if (resto.length !== 2) {
          err(n, 'una ESCRITA lleva 3 columnas (ESCRITA;pregunta;respuesta) y esta tiene ' + (resto.length + 1) +
            (resto.length > 2 ? '. ¿Hay algún ; dentro del texto? Ponlo entre comillas.' : '.'));
          return;
        }
        actual.escritas.push({ q: resto[0], a: resto[1], _linea: n });
        return;
      }
      if (k === 'SEGUNDOS' || k === 'TIEMPO') {
        if (!exigir('rosco', n, 'SEGUNDOS')) return;
        var s = parseInt(resto[0], 10);
        if (isNaN(s)) err(n, 'SEGUNDOS necesita un número.'); else actual.segundos = s;
        return;
      }
      if (k === 'EQUIPO') {
        if (!exigir('rosco', n, 'EQUIPO')) return;
        rosco = { equipo: resto.join(' ').trim() || 'Equipo ' + (actual.roscos.length + 1), letras: [] };
        actual.roscos.push(rosco);
        return;
      }
      if (k === 'LETRA') {
        if (!exigir('rosco', n, 'LETRA')) return;
        if (!rosco) {
          rosco = { equipo: 'Equipo ' + (actual.roscos.length + 1), letras: [] };
          actual.roscos.push(rosco);
          av(n, 'falta la línea EQUIPO antes de las letras; lo llamo «' + rosco.equipo + '».');
        }
        var campos = resto.slice();
        var modo = campos.length >= 2 ? MODOS[clave(campos[1])] : null;
        if (modo) campos.splice(1, 1);
        else if (campos.length === 3) modo = 'empieza';     // LETRA;A;definición;solución
        if (campos.length !== 3) {
          err(n, 'una LETRA lleva 5 columnas (LETRA;A;EMPIEZA o CONTIENE;definición;solución) y esta tiene ' +
            (resto.length + 1) + (resto.length > 4 ? '. ¿Hay algún ; dentro del texto? Ponlo entre comillas.' : '.'));
          return;
        }
        var l = campos[0].toUpperCase();
        if (!/^[A-ZÑ]$/.test(l)) { err(n, '«' + campos[0] + '» no es una letra.'); return; }
        rosco.letras.push({ l: l, modo: modo, d: campos[1], a: campos[2], _linea: n });
        return;
      }
      /* una cabecera tipo «TIPO;PREGUNTA;A;B…» que añaden algunas IA */
      if (k === 'TIPO' || k === 'CLAVE') { av(n, 'línea de cabecera ignorada.'); return; }
      /* texto suelto que añaden las IA («Aquí tienes…»): se ignora */
      if (c.length === 1) { av(n, 'texto ignorado: «' + c[0].slice(0, 40) + (c[0].length > 40 ? '…' : '') + '».'); return; }
      err(n, 'no reconozco «' + c[0] + '» al principio de la línea. Debe ser TRIVIAL, ROSCO, TEST, ESCRITA, EQUIPO, LETRA o SEGUNDOS.');
    });

    bancos.forEach(function (b) {
      if (!b.titulo) {
        b.titulo = b.tipo === 'rosco' ? 'Rosco sin título' : 'Trivial sin título';
        av(b._linea, 'el banco no tiene título; lo he llamado «' + b.titulo + '».');
      }
    });
    if (!bancos.length && !errores.length) errores.push({ linea: 0, texto: 'No hay nada que importar.' });
    return { bancos: bancos, errores: errores, avisos: avisos, separador: sep };
  }

  /* quita las marcas internas (_linea) antes de guardar */
  function limpiar(b) {
    return JSON.parse(JSON.stringify(b, function (k, v) { return k === '_linea' ? undefined : v; }));
  }

  /* ---------- escritura ---------- */
  function campo(v) {
    v = String(v == null ? '' : v);
    return /[;"\n\r]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
  }
  function fila(a) { return a.map(campo).join(';'); }

  function escribir(b) {
    var l = [];
    if (b.tipo === 'rosco') {
      l.push(fila(['ROSCO', b.titulo || '']));
      if (b.segundos) l.push(fila(['SEGUNDOS', b.segundos]));
      (b.roscos || []).forEach(function (r) {
        l.push(fila(['EQUIPO', r.equipo || '']));
        (r.letras || []).forEach(function (x) {
          l.push(fila(['LETRA', x.l, x.modo === 'contiene' ? 'CONTIENE' : 'EMPIEZA', x.d, x.a]));
        });
      });
    } else {
      l.push(fila(['TRIVIAL', b.titulo || '']));
      (b.test || []).forEach(function (p) { l.push(fila(['TEST', p.q].concat(p.o || []).concat([p.c]))); });
      (b.escritas || []).forEach(function (p) { l.push(fila(['ESCRITA', p.q, p.a])); });
    }
    return l.join('\r\n') + '\r\n';
  }

  function nombreArchivo(b) {
    return (b.tipo === 'rosco' ? 'rosco-' : 'trivial-') +
      (sinTildes(b.titulo || 'banco').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'banco') + '.csv';
  }
  /* descarga con BOM: así Excel abre bien las tildes */
  function descargar(b) {
    var a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob(['﻿' + escribir(b)], { type: 'text/csv;charset=utf-8' }));
    a.download = nombreArchivo(b);
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 3000);
  }

  return { leer: leer, escribir: escribir, limpiar: limpiar, descargar: descargar, nombreArchivo: nombreArchivo };

})();
