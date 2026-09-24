/* =========================================================
   Papeles imprimibles
   Dos: la hoja de respuestas del alumnado y, para el rosco, la
   guía de soluciones del maestro.

   Hoja de respuestas
   Se arma con el banco elegido, pero SIN los enunciados: solo
   el número de cada pregunta y su casilla. Así el alumnado no
   puede ir leyendo por delante.
   Sale en un folio A4: si el banco es grande, la hoja entera
   se encoge un poco hasta caber.
   ========================================================= */
window.Hoja = (function (global) {

  var ID = 'hoja-impresion';
  var ID_MARCO = 'hoja-marco';
  var ANCHO_MM = 186;          // A4 menos 12 mm de margen a cada lado
  var ALTO_MM = 271;
  var MM = 96 / 25.4;          // un milímetro en píxeles CSS

  var CSS =
    '@page{size:A4 portrait;margin:12mm}' +
    'html,body{margin:0;padding:0;background:#fff}' +
    '#' + ID + '{width:' + ANCHO_MM + 'mm;margin:0 auto;' +
      'background:#fff;color:#1b2030;font-family:"Baloo 2","Trebuchet MS",Verdana,sans-serif;' +
      'print-color-adjust:exact;-webkit-print-color-adjust:exact}' +
    '#' + ID + ' *{box-sizing:border-box}' +
    '.hj-banner{background:#5B6ED6;color:#fff;border-radius:3mm;padding:3mm 4mm;text-align:center}' +
    '.hj-banner b{display:block;font-size:15pt;line-height:1.15;letter-spacing:.2px}' +
    '.hj-banner span{font-size:8.5pt;opacity:.92}' +
    '.hj-datos{display:flex;gap:3mm;margin-top:3mm}' +
    '.hj-campo{flex:1;border:.4mm solid #2BB3A8;border-radius:2mm;padding:1.6mm 2.5mm;min-height:10mm}' +
    '.hj-campo i{display:block;font-style:normal;font-size:7pt;font-weight:800;color:#2BB3A8;' +
      'text-transform:uppercase;letter-spacing:.4px}' +
    '.hj-tit{display:flex;align-items:center;gap:2mm;margin:3.5mm 0 1.8mm}' +
    '.hj-tit b{font-size:9.5pt;color:#fff;background:#E8792B;border-radius:1.5mm;padding:.8mm 2.5mm}' +
    '.hj-tit span{font-size:7.5pt;color:#6b7290}' +
    '.hj-tit.azul b{background:#5B6ED6}' +
    '.hj-rej{display:grid;gap:1.6mm}' +
    '.hj-cel{border:.35mm solid #C9D0E4;border-radius:1.8mm;display:flex;align-items:stretch;overflow:hidden}' +
    '.hj-cel u{flex:0 0 7mm;background:#EEF1F8;color:#5B6ED6;font-size:8.5pt;font-weight:800;' +
      'text-decoration:none;display:flex;align-items:center;justify-content:center}' +
    '.hj-cel s{flex:1;text-decoration:none;background:#FFFDF0}' +
    '.hj-cel.lin u{background:#FDF0E6;color:#E8792B}' +
    '.hj-pie{display:flex;gap:3mm;margin-top:3.5mm;align-items:stretch}' +
    '.hj-caja{flex:1;border:.4mm solid #C9D0E4;border-radius:2mm;padding:1.6mm 2.5mm;text-align:center}' +
    '.hj-caja i{display:block;font-style:normal;font-size:7pt;font-weight:800;color:#6b7290;' +
      'text-transform:uppercase;letter-spacing:.4px}' +
    '.hj-caja b{display:block;font-size:13pt;color:#C9D0E4;margin-top:1mm}' +
    '.hj-caja.tot{border-color:#F5C518;background:#FFFCEB}' +
    '.hj-caja.tot i{color:#9a7b00}' +
    '.hj-nota{margin-top:2.5mm;font-size:7.5pt;color:#6b7290;text-align:center}' +

    /* ---- guía de soluciones para el maestro ---- */
    '#' + ID + '.guia{width:' + ANCHO_MM + 'mm}' +
    /* la guía aprieta un poco: así cada rosco cabe en su folio */
    '.guia .hj-banner{padding:2mm 3.5mm}' +
    '.guia .hj-banner b{font-size:13pt}' +
    '.guia .hj-banner span{font-size:8pt}' +
    '.gu-bloque{break-before:page}' +
    '.gu-bloque.primera{break-before:auto}' +
    '.gu-eq{display:flex;align-items:center;gap:2.5mm;' +
      'border-bottom:.5mm solid #C9D0E4;padding-bottom:1.2mm;margin-top:3mm}' +
    '.gu-eq b{font-size:11pt;color:#fff;background:#5B6ED6;border-radius:1.5mm;padding:1mm 3mm}' +
    '.gu-eq span{font-size:8pt;color:#6b7290}' +
    '.gu-lista{margin-top:1.4mm}' +
    '.gu-fila{display:flex;gap:2.5mm;align-items:center;padding:.65mm 0;' +
      'border-bottom:.2mm dotted #D8DEEE;break-inside:avoid}' +
    '.gu-fila u{flex:0 0 7mm;height:7mm;border-radius:50%;background:#EEF1F8;color:#5B6ED6;' +
      'font-size:9pt;font-weight:800;text-decoration:none;display:flex;align-items:center;' +
      'justify-content:center}' +
    '.gu-txt{flex:1;min-width:0}' +
    '.gu-txt b{display:block;font-size:9pt;color:#1b2030;line-height:1.18}' +
    '.gu-txt i{font-style:normal;font-size:6.5pt;font-weight:800;color:#E8792B;' +
      'text-transform:uppercase;letter-spacing:.3px;margin-left:1.5mm}' +
    '.gu-txt span{display:block;font-size:7.6pt;color:#41485e;line-height:1.24;margin-top:.25mm}' +
    '.gu-pie{margin-top:3mm;font-size:7.5pt;color:#6b7290;text-align:center}';

  /* =========================================================
     El papel se arma en un marco aparte (un iframe oculto) y es ESE
     marco el que se manda a imprimir. Así la vista previa no depende
     de cómo esté la página en ese momento: en pantalla completa,
     Firefox imprimía la hoja diminuta en una esquina porque estaba
     heredando el tamaño del elemento a pantalla completa.
     ========================================================= */
  function marco() {
    var f = document.getElementById(ID_MARCO);
    if (!f) {
      f = document.createElement('iframe');
      f.id = ID_MARCO;
      f.setAttribute('aria-hidden', 'true');
      f.setAttribute('title', 'Hoja para imprimir');
      f.style.cssText = 'position:fixed;left:-10000px;top:0;width:210mm;height:297mm;' +
        'border:0;opacity:0;pointer-events:none';
      document.body.appendChild(f);
    }
    return f;
  }

  /* Vuelca el contenido en el marco y devuelve su documento. */
  function volcar(clase, html) {
    var f = marco();
    var d = f.contentDocument || f.contentWindow.document;
    d.open();
    d.write('<!DOCTYPE html><html lang="es"><head><meta charset="utf-8">' +
      '<title>Juegos de aula</title>' +
      '<link href="https://fonts.googleapis.com/css2?family=Baloo+2:wght@500;700;800&display=swap" ' +
        'rel="stylesheet">' +
      '<style>' + CSS + '</style></head><body>' +
      '<div id="' + ID + '" class="' + (clase || '') + '">' + html + '</div></body></html>');
    d.close();
    return d;
  }

  /* Espera a que las fuentes estén listas (si no, la medida engaña) y
     manda el marco a la impresora. */
  function mandar(d, ajustar) {
    var f = marco();
    /* si las fuentes tardan (o no llegan, sin conexión) se imprime igual:
       nunca se deja al maestro esperando con el botón bloqueado */
    var listas = (d.fonts && d.fonts.ready) ? d.fonts.ready : Promise.resolve();
    var tope = new Promise(function (ok) { setTimeout(ok, 1200); });
    return Promise.race([listas.catch(function () {}), tope]).then(function () {
      return new Promise(function (ok) { setTimeout(ok, 90); });
    }).then(function () {
      if (ajustar) {
        var cont = d.getElementById(ID);
        cont.style.zoom = '';
        var alto = cont.scrollHeight;
        var hueco = ALTO_MM * MM;
        if (alto > hueco) cont.style.zoom = Math.max(0.5, hueco / alto);
      }
      try { f.contentWindow.focus(); } catch (e) {}
      f.contentWindow.print();
      return true;
    });
  }

  function escapar(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  function celdas(desde, n, alto, cols, clase) {
    var html = '<div class="hj-rej" style="grid-template-columns:repeat(' + cols + ',1fr)">';
    for (var k = 0; k < n; k++) {
      html += '<div class="hj-cel ' + (clase || '') + '" style="height:' + alto + 'mm">' +
        '<u>' + (desde + k) + '</u><s></s></div>';
    }
    return html + '</div>';
  }

  /* =========================================================
     Guía de soluciones del rosco
     Es la chuleta del maestro: todas las definiciones con su
     respuesta, rosco por rosco. Cada equipo empieza en una
     página, así se puede llevar solo la hoja que toque.
     ========================================================= */
  function soluciones(idBanco) {
    return Store.bancoJuego(idBanco).then(function (b) {
      if (!b.roscos || !b.roscos.length) throw new Error('Ese banco no tiene roscos.');

      var hoy = new Date();
      var fecha = hoy.getDate() + '/' + (hoy.getMonth() + 1) + '/' + hoy.getFullYear();
      var total = b.roscos.reduce(function (s, r) { return s + (r.letras || []).length; }, 0);

      var html =
        '<div class="hj-banner"><b>🔑 ' + escapar(b.titulo) + '</b>' +
          '<span>Soluciones para quien dirige el juego · ' +
          b.roscos.length + (b.roscos.length === 1 ? ' rosco · ' : ' roscos · ') +
          total + ' definiciones · ' + fecha + '</span></div>' +

        b.roscos.map(function (r, i) {
          var nombre = r.equipo || ('Rosco ' + (i + 1));
          return '<div class="gu-bloque' + (i ? '' : ' primera') + '">' +
            '<div class="gu-eq"><b>' + escapar(nombre) + '</b>' +
              '<span>' + (r.letras || []).length + ' letras</span></div>' +
            '<div class="gu-lista">' + (r.letras || []).map(function (x) {
              var modo = x.modo === 'contiene' ? 'contiene la ' + x.l : 'empieza por ' + x.l;
              return '<div class="gu-fila"><u>' + escapar(x.l) + '</u>' +
                '<div class="gu-txt">' +
                '<b>' + escapar(x.a) + '<i>' + escapar(modo) + '</i></b>' +
                '<span>' + escapar(x.d) + '</span></div></div>';
            }).join('') + '</div></div>';
        }).join('') +

        '<p class="gu-pie">No dejes esta hoja a la vista: aquí están todas las respuestas.</p>';

      return mandar(volcar('guia', html), false);
    });
  }

  /* ---------- armar y mandar a imprimir ---------- */
  function imprimir(idBanco) {
    return Store.banco(idBanco).then(function (b) {
      var test = b.test || [], escr = b.escritas || [];
      var total = test.length + escr.length;
      if (!total) throw new Error('Ese banco no tiene preguntas.');

      /* las columnas se eligen según cuántas preguntas hay */
      var colT = test.length > 24 ? 7 : test.length > 12 ? 6 : 4;
      var colE = escr.length > 9 ? 4 : escr.length > 4 ? 3 : 2;
      var altoT = 14, altoE = 22;

      var hoy = new Date();
      var fecha = hoy.getDate() + '/' + (hoy.getMonth() + 1) + '/' + hoy.getFullYear();

      var html =
        '<div class="hj-banner"><b>🏆 ' + escapar(b.titulo) + '</b>' +
          '<span>Hoja de respuestas del equipo · ' + fecha + '</span></div>' +

        '<div class="hj-datos">' +
          '<div class="hj-campo" style="flex:1.4"><i>Nombre del equipo</i></div>' +
          '<div class="hj-campo"><i>Nº de equipo</i></div>' +
          '<div class="hj-campo" style="flex:1.6"><i>Jugadores</i></div>' +
        '</div>' +

        (test.length ?
          '<div class="hj-tit azul"><b>TIPO TEST · 1 – ' + test.length + '</b>' +
            '<span>escribid solo la letra: A, B, C o D</span></div>' +
          celdas(1, test.length, altoT, colT) : '') +

        (escr.length ?
          '<div class="hj-tit"><b>RESPUESTA ESCRITA · ' + (test.length + 1) + ' – ' + total + '</b>' +
            '<span>escribid la respuesta con vuestras palabras</span></div>' +
          celdas(test.length + 1, escr.length, altoE, colE, 'lin') : '') +

        '<div class="hj-pie">' +
          (test.length ? '<div class="hj-caja"><i>Aciertos tipo test</i><b>de ' + test.length + '</b></div>' : '') +
          (escr.length ? '<div class="hj-caja"><i>Aciertos escritas</i><b>de ' + escr.length + '</b></div>' : '') +
          '<div class="hj-caja tot"><i>Puntuación total</i><b>de ' + total + '</b></div>' +
        '</div>' +
        '<p class="hj-nota">Escuchar a los compañeros también es acertar.</p>';

      /* la hoja del alumnado cabe siempre en un folio: si se pasa, se encoge */
      return mandar(volcar('', html), true);
    });
  }

  return { imprimir: imprimir, soluciones: soluciones };

})(window);
