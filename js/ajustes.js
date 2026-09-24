/* =========================================================
   Panel de ajustes · aspecto, movimiento, pantalla y sonido
   Se inyecta desde aquí para que todas las vistas compartan
   el mismo panel. Basta con un botón de clase .js-aj y llamar
   una vez a Ajustes.conectar().

   La ventana es un menú de cuatro entradas y cada una abre su
   propia página dentro de la misma caja. Así el tamaño es
   siempre el mismo, nunca hace falta desplazarse y cada grupo
   de ajustes respira.
   ========================================================= */
(function (global) {

  var CSS = [
    /* la caja tiene SIEMPRE el mismo tamaño: cabecera, página y pie */
    '.aj-capa .caja{width:min(640px,94vw);text-align:left;display:flex;flex-direction:column;' +
      'height:min(560px,92vh);max-height:92vh;padding:0;overflow:hidden}',
    '.aj-capa h2{text-align:center;flex:0 0 auto;padding:18px 24px 6px;font-size:23px}',
    '.aj-scroll{flex:1 1 auto;min-height:0;overflow:auto;padding:4px 22px 10px;display:flex;' +
      'overscroll-behavior:contain;-webkit-overflow-scrolling:touch}',

    /* --- páginas: ocupan todo el alto disponible --- */
    '.aj-pag{display:flex;flex-direction:column;gap:9px;flex:1 1 auto;min-height:0;width:100%}',
    '.aj-pag.centrada{justify-content:center;gap:4px}',
    '.aj-pag.entra{animation:ajPag .24s cubic-bezier(.2,1,.3,1)}',
    '@keyframes ajPag{from{opacity:0;transform:translateX(14px)}to{opacity:1;transform:none}}',
    '.aj-pag.atras{animation:ajPagAtras .24s cubic-bezier(.2,1,.3,1)}',
    '@keyframes ajPagAtras{from{opacity:0;transform:translateX(-14px)}to{opacity:1;transform:none}}',

    /* --- menú principal: cuatro tarjetas que llenan la ventana --- */
    '#aj-pag-inicio{display:grid;grid-template-columns:1fr 1fr;grid-auto-rows:1fr;gap:12px}',
    '.aj-menu{position:relative;overflow:hidden;display:flex;flex-direction:column;' +
      'align-items:flex-start;justify-content:center;gap:5px;text-align:left;cursor:pointer;' +
      'border:2px solid var(--line);border-radius:var(--r-l);padding:16px 17px;' +
      'font-family:inherit;color:var(--ink);' +
      'background:linear-gradient(150deg,color-mix(in srgb,var(--tono) 22%,var(--panel)),var(--panel) 72%);' +
      'transition:transform var(--rapido),border-color var(--rapido),box-shadow var(--rapido)}',
    '.aj-menu::after{content:"";position:absolute;right:-28%;bottom:-46%;width:74%;height:104%;' +
      'border-radius:50%;background:var(--tono);opacity:.14;transition:transform .25s ease;' +
      'pointer-events:none}',
    '.aj-menu:hover{transform:translateY(-3px);border-color:var(--tono);' +
      'box-shadow:0 14px 30px rgba(10,6,45,.22)}',
    '.aj-menu:hover::after{transform:translate(-6%,-8%) scale(1.07)}',
    '.aj-menu .ic{font-size:30px;line-height:1;position:relative}',
    '.aj-menu b{font-size:16.5px;font-weight:800;position:relative}',
    '.aj-menu .txt{font-size:11.5px;color:var(--muted);line-height:1.35;position:relative;' +
      'max-width:22ch}',
    '.aj-menu .val{position:relative;margin-top:4px;font-size:12px;font-weight:800;color:#fff;' +
      'background:var(--tono);padding:3px 11px;border-radius:999px;white-space:nowrap;' +
      'box-shadow:0 6px 14px color-mix(in srgb,var(--tono) 45%,transparent)}',

    /* --- rejillas de tarjetas --- */
    '.aj-temas,.aj-movs{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:9px}',
    '.aj-op{position:relative;border:2px solid var(--line);background:var(--panel);border-radius:var(--r-m);' +
      'padding:9px;cursor:pointer;font-family:inherit;text-align:left;' +
      'transition:transform var(--rapido),border-color var(--rapido),box-shadow var(--rapido)}',
    '.aj-op:hover{transform:translateY(-3px);box-shadow:0 10px 22px rgba(20,15,60,.16)}',
    '.aj-op.sel{border-color:var(--violeta);box-shadow:0 0 0 3px color-mix(in srgb,var(--violeta) 28%,transparent)}',
    '.aj-op .tira{height:30px;border-radius:9px;margin-bottom:7px;position:relative;overflow:hidden;display:block}',
    '.aj-op .tira i{position:absolute;inset:0;width:33.34%}',
    '.aj-op .tira i:nth-child(2){left:33.33%}',
    '.aj-op .tira i:nth-child(3){left:66.66%}',
    '.aj-op .ico{font-size:21px;line-height:1;display:block;margin-bottom:5px}',
    '.aj-op b{display:block;font-size:13.5px;color:var(--ink)}',
    '.aj-op span.txt{display:block;font-size:11px;color:var(--muted);line-height:1.35;margin-top:1px}',
    '.aj-op .marca{position:absolute;top:7px;right:9px;font-size:14px;opacity:0;transition:opacity .15s}',
    '.aj-op.sel .marca{opacity:1}',

    /* --- entrada de rendimiento: una franja a lo ancho bajo las cuatro --- */
    '#aj-pag-inicio{grid-template-rows:1fr 1fr auto}',
    '.aj-menu.ancha{grid-column:1 / -1;flex-direction:row;align-items:center;gap:13px;' +
      'padding:12px 17px}',
    '.aj-menu.ancha .ic{font-size:26px}',
    '.aj-menu.ancha .val{margin:0 0 0 auto}',
    '.aj-menu.ancha .txt{max-width:none}',
    '#aj-pag-rend .aj-rej{grid-template-columns:repeat(3,1fr)}',
    '.aj-deteccion{margin:2px 2px 0;flex:0 0 auto}',
    '.aj-deteccion button{border:0;background:none;padding:0;font:inherit;font-weight:800;' +
      'color:var(--violeta);cursor:pointer;text-decoration:underline}',

    /* --- tarjetas de pantalla y sonido ---
       Cada ajuste es una tarjeta que llena su hueco: icono grande,
       nombre, explicación y una pastilla abajo que dice cómo está.
       La tarjeta entera es el interruptor. */
    '.aj-rej{display:grid;gap:11px;flex:1 1 auto;min-height:0}',
    '#aj-pag-pantalla .aj-rej{grid-template-columns:repeat(3,1fr);grid-template-rows:1fr auto}',
    /* tarjeta horizontal a lo ancho (bajo las tres verticales) */
    '.aj-card.horiz{grid-column:1 / -1}',
    '.aj-card.horiz .cab{flex-direction:row;align-items:center;justify-content:flex-start;' +
      'text-align:left;gap:14px;padding:12px 16px}',
    '.aj-card.horiz .ic{font-size:30px}',
    '.aj-card.horiz .tx{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}',
    '.aj-card.horiz .txt{max-width:none}',
    '.aj-card.horiz .val{position:static;flex:0 0 auto;padding:5px 14px;white-space:nowrap}',
    '#aj-pag-sonido .aj-rej{grid-template-columns:1fr 1fr;grid-template-rows:1.35fr 1fr}',
    '#aj-card-subir{grid-column:1 / -1}',
    '#aj-card-subir .txt{max-width:52ch}',
    '#aj-card-subir .ic{font-size:32px}',
    '.aj-card{position:relative;overflow:hidden;display:flex;flex-direction:column;min-height:0;' +
      'border:2px solid var(--line);border-radius:var(--r-l);' +
      'background:linear-gradient(150deg,color-mix(in srgb,var(--tono) 20%,var(--panel)),var(--panel) 74%);' +
      'transition:border-color var(--rapido),box-shadow var(--rapido),transform var(--rapido)}',
    '.aj-card::after{content:"";position:absolute;right:-30%;bottom:-52%;width:80%;height:108%;' +
      'border-radius:50%;background:var(--tono);opacity:.13;transition:transform .25s ease;' +
      'pointer-events:none;z-index:0}',
    '.aj-card:hover{transform:translateY(-3px);border-color:var(--tono);' +
      'box-shadow:0 14px 30px rgba(10,6,45,.2)}',
    '.aj-card:hover::after{transform:translate(-6%,-8%) scale(1.07)}',
    '.aj-card.apagada{background:var(--panel)}',
    '.aj-card.apagada::after{opacity:.05}',
    '.aj-card .cab{position:relative;z-index:1;flex:1 1 auto;min-height:0;display:flex;' +
      'flex-direction:column;flex-wrap:nowrap;' +
      'align-items:center;gap:7px;justify-content:center;text-align:center;cursor:pointer;' +
      'border:0;background:none;font-family:inherit;color:var(--ink);width:100%;' +
      'padding:16px 14px 50px}',
    '.aj-card .ic{font-size:40px;line-height:1;filter:drop-shadow(0 6px 14px rgba(0,0,0,.28));' +
      'transition:transform .22s cubic-bezier(.2,1.4,.4,1)}',
    '.aj-card:hover .ic{transform:scale(1.12) rotate(-5deg)}',
    '.aj-card b{font-size:15.5px;font-weight:800;line-height:1.2}',
    '.aj-card .txt{font-size:11.5px;color:var(--muted);line-height:1.4;max-width:23ch}',
    '.aj-card .val{position:absolute;left:13px;right:13px;bottom:12px;text-align:center;font-size:12px;' +
      'font-weight:800;color:#fff;background:var(--tono);border-radius:999px;padding:5px 10px;' +
      'box-shadow:0 6px 14px color-mix(in srgb,var(--tono) 42%,transparent)}',
    '.aj-card.apagada .val{background:var(--soft);color:var(--muted);box-shadow:none}',
    '.aj-card .mando{position:relative;z-index:2;display:flex;align-items:center;gap:9px;flex:0 0 auto;' +
      'padding:9px 14px;border-top:2px solid var(--line);background:var(--panel)}',
    '.aj-card .mando input[type=range]{flex:1;min-width:0;accent-color:var(--tono);height:26px;' +
      'cursor:pointer;margin:0}',
    '.aj-card .mando .num{flex:0 0 42px;text-align:right;font-weight:800;font-size:12.5px;' +
      'color:var(--muted);font-variant-numeric:tabular-nums}',
    '.aj-card .mando.off{opacity:.45}',

    /* --- botón «Restaurar Opciones»: solo el icono; el texto se despliega
           al pasar el ratón por encima --- */
    '.aj-rest{display:inline-flex;align-items:center;gap:0;height:40px;min-width:40px;' +
      'border:2px solid var(--line);border-radius:999px;background:var(--panel);color:var(--muted);' +
      'font-family:inherit;font-weight:800;font-size:13px;cursor:pointer;padding:0 10px;overflow:hidden;' +
      'transition:color var(--rapido),border-color var(--rapido),background var(--rapido)}',
    '.aj-rest .ic{font-size:18px;line-height:1;flex:0 0 auto;display:inline-block;' +
      'transition:transform .35s cubic-bezier(.2,.9,.3,1)}',
    '.aj-rest .tx{max-width:0;opacity:0;white-space:nowrap;' +
      'transition:max-width .28s cubic-bezier(.2,.9,.3,1),opacity .2s,margin .28s}',
    '.aj-rest:hover,.aj-rest:focus-visible{color:var(--ink);border-color:var(--violeta);background:var(--soft)}',
    '.aj-rest:hover .tx,.aj-rest:focus-visible .tx{max-width:190px;opacity:1;margin-left:7px}',
    '.aj-rest:hover .ic{transform:rotate(-200deg)}',
    '.aj-rest.oculto{display:none}',

    /* --- interruptor «Limitar animaciones» --- */
    '.aj-extra{position:relative;overflow:hidden;display:flex;align-items:center;gap:13px;width:100%;' +
      'border:2px dashed var(--line);border-radius:var(--r-l);padding:11px 14px;cursor:pointer;' +
      'font-family:inherit;color:var(--ink);text-align:left;background:var(--panel);' +
      'transition:border-color var(--rapido),transform var(--rapido),background var(--rapido)}',
    '.aj-extra:hover{transform:translateY(-2px);border-color:var(--violeta)}',
    '.aj-extra.on{border-style:solid;border-color:var(--violeta);' +
      'background:color-mix(in srgb,var(--violeta) 13%,var(--panel))}',
    '.aj-extra .ic{font-size:25px;line-height:1;flex:0 0 auto}',
    '.aj-extra .tx{flex:1;min-width:0}',
    '.aj-extra .tx b{display:block;font-size:14px;font-weight:800}',
    '.aj-extra .tx span{display:block;font-size:11.5px;color:var(--muted);line-height:1.35;' +
      'margin-top:2px}',
    '.aj-extra .val{flex:0 0 auto;font-size:12px;font-weight:800;color:var(--muted);' +
      'background:var(--soft);border-radius:999px;padding:5px 13px;white-space:nowrap}',
    '.aj-extra.on .val{background:var(--violeta);color:#fff;' +
      'box-shadow:0 6px 14px color-mix(in srgb,var(--violeta) 45%,transparent)}',

    /* --- filas de interruptores (se conservan para otros paneles) --- */
    '.aj-fila{display:flex;align-items:center;gap:12px;padding:7px 0;flex-wrap:wrap}',
    '.aj-fila .et{flex:0 0 132px;font-weight:800;font-size:14px;color:var(--ink)}',
    '.aj-fila input[type=range]{flex:1;accent-color:var(--violeta);height:22px;cursor:pointer;min-width:120px}',
    '.aj-fila .val{flex:0 0 46px;text-align:right;font-weight:800;font-size:13px;color:var(--muted);' +
      'font-variant-numeric:tabular-nums}',
    '.aj-int{border:2px solid var(--line);background:var(--panel);color:var(--ink);border-radius:999px;' +
      'padding:6px 13px;font-family:inherit;font-weight:800;font-size:12.5px;cursor:pointer;flex:0 0 auto;' +
      'display:inline-flex;align-items:center;justify-content:center;text-align:center;' +
      'transition:background var(--rapido),color var(--rapido),transform var(--rapido)}',
    '.aj-int:hover{transform:translateY(-2px)}',
    '.aj-int.on{background:var(--verde);border-color:var(--verde);color:#fff}',
    '.aj-int.off{background:var(--soft);color:var(--muted)}',
    '.aj-nota{font-size:12.5px;color:var(--muted);line-height:1.45;margin-top:6px}',
    '.aj-nota.pista{margin:0;flex:1;min-width:140px;font-size:12px;line-height:1.35}',

    '.aj-pie{display:flex;align-items:center;gap:9px;flex:0 0 auto;' +
      'padding:12px 24px 15px;border-top:2px solid var(--line);background:var(--panel)}',
    '.aj-pie .hueco{flex:1}',

    '@media (max-width:520px){.aj-temas,.aj-movs{grid-template-columns:repeat(2,1fr);gap:7px}' +
      '.aj-op span.txt{display:none}.aj-op .tira{height:22px}' +
      '#aj-pag-inicio{grid-template-columns:1fr;grid-auto-rows:auto}' +
      '.aj-menu{flex-direction:row;align-items:center;gap:12px;padding:12px 14px}' +
      '.aj-menu .txt{display:none}.aj-menu .val{margin:0 0 0 auto}' +
      '#aj-pag-pantalla .aj-rej,#aj-pag-sonido .aj-rej{grid-template-columns:1fr;' +
        'grid-template-rows:none}' +
      '.aj-card .txt{display:none}' +
      '.aj-fila .et{flex:0 0 100%}}',
    '@media (max-height:620px){.aj-capa h2{font-size:20px;padding-top:14px}' +
      '.aj-menu{padding:10px 13px}.aj-op{padding:7px}.aj-op .tira{height:22px}' +
      '.aj-card .cab{padding:10px 12px 9px}.aj-card .ic{font-size:22px}' +
      '.aj-card .txt{font-size:11px}' +
      '.aj-fila{padding:4px 0}.aj-pie{padding:9px 24px 11px}}'
  ].join('');

  function estilo() {
    if (document.getElementById('aj-estilo')) return;
    var s = document.createElement('style');
    s.id = 'aj-estilo';
    /* en pantallas grandes (proyector, 1080p) el menú de opciones es un 30 %
       más grande: las mismas reglas con las medidas multiplicadas por 1,4.
       Son medidas fijas, sin zoom ni escalado, así que no cuestan rendimiento. */
    var grande = CSS.replace(/(-?\d*\.?\d+)px/g, function (m, n) {
      n = +n;
      return Math.abs(n) > 3 ? (Math.round(n * 13) / 10) + 'px' : m;
    });
    s.textContent = CSS + '@media (min-width:1600px) and (min-height:900px){' + grande + '}';
    document.head.appendChild(s);
  }

  function tarjetaTema(t) {
    return '<button class="aj-op" data-tema="' + t.id + '">' +
      '<span class="marca">✔</span>' +
      '<span class="tira">' + t.muestra.map(function (c) {
        return '<i style="background:' + c + '"></i>';
      }).join('') + '</span>' +
      '<b>' + t.nombre + '</b><span class="txt">' + t.nota + '</span></button>';
  }
  function tarjetaMov(m) {
    return '<button class="aj-op" data-anim="' + m.id + '">' +
      '<span class="marca">✔</span>' +
      '<span class="ico">' + m.icono + '</span>' +
      '<b>' + m.nombre + '</b><span class="txt">' + m.nota + '</span></button>';
  }

  var TITULOS = {
    inicio: '🎨 Aspecto y sonido',
    tema: '🎨 Tema visual',
    mov: '🎬 Movimiento',
    pantalla: '🖥 Pantalla',
    sonido: '🔊 Sonido',
    rend: '⚡ Rendimiento'
  };

  function construir() {
    var ya = document.getElementById('aj-capa');
    if (ya) return ya;
    estilo();

    var capa = document.createElement('div');
    capa.className = 'capa aj-capa';
    capa.id = 'aj-capa';
    capa.innerHTML =
      '<div class="caja">' +
        '<h2 id="aj-titulo">' + TITULOS.inicio + '</h2>' +
        '<div class="aj-scroll">' +

          /* ---------- menú ---------- */
          '<div class="aj-pag" id="aj-pag-inicio">' +
            '<button class="aj-menu" data-ir="tema" style="--tono:#8B7CF6"><span class="ic">🎨</span>' +
              '<b>Tema visual</b><span class="txt">los colores de toda la web</span>' +
              '<span class="val" id="aj-valTema"></span></button>' +
            '<button class="aj-menu" data-ir="mov" style="--tono:#FF8A3D"><span class="ic">🎬</span>' +
              '<b>Movimiento</b><span class="txt">cómo entran pantallas y respuestas</span>' +
              '<span class="val" id="aj-valMov"></span></button>' +
            '<button class="aj-menu" data-ir="pantalla" style="--tono:#2BC4B4"><span class="ic">🖥</span>' +
              '<b>Pantalla</b><span class="txt">focos, fondo y confeti</span>' +
              '<span class="val" id="aj-valPant"></span></button>' +
            '<button class="aj-menu" data-ir="sonido" style="--tono:#F5C518"><span class="ic">🔊</span>' +
              '<b>Sonido</b><span class="txt">música, efectos y volúmenes</span>' +
              '<span class="val" id="aj-valSon"></span></button>' +
            '<button class="aj-menu ancha" data-ir="rend" style="--tono:#4C8DFF"><span class="ic">⚡</span>' +
              '<b>Rendimiento</b><span class="txt">para equipos modestos o pantallas 4K</span>' +
              '<span class="val" id="aj-valRend"></span></button>' +
          '</div>' +

          /* ---------- temas ---------- */
          '<div class="aj-pag centrada oculto" id="aj-pag-tema">' +
            '<div class="aj-temas" id="aj-temas"></div>' +
          '</div>' +

          /* ---------- movimiento ---------- */
          '<div class="aj-pag centrada oculto" id="aj-pag-mov">' +
            '<div class="aj-movs" id="aj-movs"></div>' +
            '<button class="aj-extra" id="aj-extra"><span class="ic">🐢</span>' +
              '<span class="tx"><b>Limitar animaciones</b>' +
              '<span>Quita los movimientos añadidos de cada estilo (la pregunta y la opción ' +
              'pulsada del trivial; la letra grande, la definición, la solución y el cambio de ' +
              'equipo del rosco) y deja solo los básicos.</span></span>' +
              '<span class="val" id="aj-extra-val"></span></button>' +
          '</div>' +

          /* ---------- pantalla ---------- */
          '<div class="aj-pag oculto" id="aj-pag-pantalla">' +
            '<div class="aj-rej">' +
              '<div class="aj-card" id="aj-card-focos" style="--tono:#8B7CF6">' +
                '<button class="cab" id="aj-focos"><span class="ic" id="aj-focos-ic">📊</span>' +
                  '<b>Focos del título</b>' +
                  '<span class="txt" id="aj-focos-txt"></span>' +
                  '<span class="val" id="aj-focos-val"></span></button></div>' +
              '<div class="aj-card" id="aj-card-fondo" style="--tono:#2BC4B4">' +
                '<button class="cab" id="aj-fondo"><span class="ic" id="aj-fondo-ic">🌊</span>' +
                  '<b>Fondo</b>' +
                  '<span class="txt">Los colores giran despacio y se funden durante las partidas.</span>' +
                  '<span class="val" id="aj-fondo-val"></span></button></div>' +
              '<div class="aj-card" id="aj-card-conf" style="--tono:#FF8A3D">' +
                '<button class="cab" id="aj-conf"><span class="ic" id="aj-conf-ic">🎉</span>' +
                  '<b>Confeti</b>' +
                  '<span class="txt">Cae al abrirse el marcador y durante el podio final.</span>' +
                  '<span class="val" id="aj-conf-val"></span></button></div>' +
              '<div class="aj-card horiz" id="aj-card-marc" style="--tono:#FF5D73">' +
                '<button class="cab" id="aj-marc"><span class="ic" id="aj-marc-ic">🏅</span>' +
                  '<span class="tx"><b>Marcador entre preguntas</b>' +
                  '<span class="txt">En el trivial, la ventana con los aciertos de cada equipo ' +
                    'tras cada pregunta. Apagado, los puntos se suman igual y se sigue sin pausa.</span></span>' +
                  '<span class="val" id="aj-marc-val"></span></button></div>' +
            '</div>' +
          '</div>' +

          /* ---------- sonido ---------- */
          '<div class="aj-pag oculto" id="aj-pag-sonido">' +
            '<div class="aj-rej">' +
              '<div class="aj-card" id="aj-card-mus" style="--tono:#F5C518">' +
                '<button class="cab" id="aj-mus"><span class="ic" id="aj-mus-ic">♪</span>' +
                  '<b>Música</b>' +
                  '<span class="txt">Un tema para el título y otro, más tranquilo, para jugar.</span>' +
                  '<span class="val" id="aj-mus-val"></span></button>' +
                '<div class="mando" id="aj-mus-mando">' +
                  '<input type="range" id="aj-volmus" min="0" max="100" step="5" ' +
                    'aria-label="Volumen de la música">' +
                  '<span class="num" id="aj-volmus-v"></span></div></div>' +
              '<div class="aj-card" id="aj-card-sfx" style="--tono:#4C8DFF">' +
                '<button class="cab" id="aj-sfx"><span class="ic" id="aj-sfx-ic">🔊</span>' +
                  '<b>Efectos</b>' +
                  '<span class="txt">Aciertos, fallos, pasapalabra y los clics de los botones.</span>' +
                  '<span class="val" id="aj-sfx-val"></span></button>' +
                '<div class="mando" id="aj-sfx-mando">' +
                  '<input type="range" id="aj-volsfx" min="0" max="100" step="5" ' +
                    'aria-label="Volumen de los efectos">' +
                  '<span class="num" id="aj-volsfx-v"></span></div></div>' +
              '<div class="aj-card" id="aj-card-subir" style="--tono:#FF5D73">' +
                '<button class="cab" id="aj-agacha"><span class="ic" id="aj-agacha-ic">🔺</span>' +
                  '<b>Subir la música en el marcador</b>' +
                  '<span class="txt">Mientras se comenta la pregunta con la clase, el tema sube ' +
                    'bastante (sin llegar al volumen del menú) y vuelve solo al cerrar el marcador.</span>' +
                  '<span class="val" id="aj-agacha-val"></span></button></div>' +
            '</div>' +
          '</div>' +

          /* ---------- rendimiento ---------- */
          '<div class="aj-pag oculto" id="aj-pag-rend">' +
            '<div class="aj-rej">' +
              '<div class="aj-card" id="aj-card-media" style="--tono:#4C8DFF">' +
                '<button class="cab" id="aj-media"><span class="ic">🔍</span>' +
                  '<b>Media resolución</b>' +
                  '<span class="txt">El fondo, los focos y el confeti se dibujan a la mitad de ' +
                    'resolución. Textos y botones siguen nítidos.</span>' +
                  '<span class="val" id="aj-media-val"></span></button></div>' +
              '<div class="aj-card" id="aj-card-ligero" style="--tono:#F5C518">' +
                '<button class="cab" id="aj-ligero"><span class="ic">⚡</span>' +
                  '<b>Efectos optimizados</b>' +
                  '<span class="txt">A resolución completa, sin desenfoques recalculados en cada ' +
                    'fotograma y con un fondo más pequeño. Casi el mismo aspecto.</span>' +
                  '<span class="val" id="aj-ligero-val"></span></button></div>' +
              '<div class="aj-card" id="aj-card-fps" style="--tono:#FF5D73">' +
                '<button class="cab" id="aj-fps"><span class="ic">📈</span>' +
                  '<b>Contador de FPS</b>' +
                  '<span class="txt">Arriba a la izquierda, para comparar los dos modos.</span>' +
                  '<span class="val" id="aj-fps-val"></span></button></div>' +
            '</div>' +
            '<p class="aj-nota aj-deteccion" id="aj-deteccion"></p>' +
          '</div>' +

        '</div>' +
        '<div class="aj-pie">' +
          '<button class="aj-rest" id="aj-restaurar" aria-label="Restaurar Opciones">' +
            '<span class="ic">↺</span><span class="tx">Restaurar Opciones</span></button>' +
          '<button class="btn oculto" id="aj-atras">← Volver</button>' +
          '<span class="hueco"></span>' +
          '<button class="btn principal" id="aj-cerrar">Hecho</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(capa);

    /* ---------- navegación entre páginas ---------- */
    var pagina = 'inicio';
    function ir(cual, volviendo) {
      var antes = capa.querySelector('#aj-pag-' + pagina);
      var ahora = capa.querySelector('#aj-pag-' + cual);
      if (!ahora) return;
      if (antes) antes.classList.add('oculto');
      ahora.classList.remove('oculto', 'entra', 'atras');
      void ahora.offsetWidth;
      ahora.classList.add(volviendo ? 'atras' : 'entra');
      capa.querySelector('#aj-titulo').textContent = TITULOS[cual];
      capa.querySelector('#aj-atras').classList.toggle('oculto', cual === 'inicio');
      capa.querySelector('#aj-restaurar').classList.toggle('oculto', cual !== 'inicio');
      capa.querySelector('.aj-scroll').scrollTop = 0;
      pagina = cual;
      /* al entrar se vuelve a marcar lo que está en uso: si por lo que
         fuera se quedó sin marca, aquí se recupera */
      if (cual === 'tema') marcarTema();
      if (cual === 'mov') marcarMov();
    }
    [].slice.call(capa.querySelectorAll('[data-ir]')).forEach(function (b) {
      b.onclick = function () { Sonido.click(); ir(b.dataset.ir); };
    });
    capa.querySelector('#aj-atras').onclick = function () { Sonido.click(); ir('inicio', true); };

    /* ---------- restaurar todas las opciones de fábrica ---------- */
    capa.querySelector('#aj-restaurar').onclick = function () {
      Sonido.click();
      Dialogo.confirmar('↺ Restaurar opciones',
        'Todo vuelve a como viene de fábrica: tema Pizarra, movimiento Cartas sin limitar, ' +
        'música al 60 % y efectos al 100 % (los dos encendidos), la música sube en el marcador, ' +
        'focos en analizador, fondo en movimiento, confeti y marcador entre preguntas ' +
        'encendidos, rendimiento automático, sin pantalla completa y sin aprovechar todo el ancho.',
        'Sí, restaurar').then(function (si) {
        if (!si) return;
        restaurarTodo();
        pintar();
        pintarChipRend();
        /* la ventana vuelve a entrar para que se note el cambio */
        var caja = capa.querySelector('.caja');
        caja.style.animation = 'none';
        void caja.offsetWidth;
        caja.style.animation = '';
      });
    };

    /* ---------- temas ---------- */
    var contT = capa.querySelector('#aj-temas');
    contT.innerHTML = Tema.lista.map(tarjetaTema).join('');
    function marcarTema() {
      var hoy = Tema.actual();
      [].slice.call(contT.children).forEach(function (b) {
        b.classList.toggle('sel', b.dataset.tema === hoy);
      });
      capa.querySelector('#aj-valTema').textContent = Tema.info(hoy).nombre;
    }
    [].slice.call(contT.children).forEach(function (b) {
      b.onclick = function () { Tema.aplicar(b.dataset.tema); Sonido.click(); marcarTema(); };
    });

    /* ---------- movimiento ---------- */
    var contM = capa.querySelector('#aj-movs');
    contM.innerHTML = Anim.lista.map(tarjetaMov).join('');
    var bExtra = capa.querySelector('#aj-extra');
    function marcarMov() {
      var hoy = Anim.actual();
      [].slice.call(contM.children).forEach(function (b) {
        b.classList.toggle('sel', b.dataset.anim === hoy);
      });
      var limitadas = Anim.limitar();
      bExtra.classList.toggle('on', limitadas);
      capa.querySelector('#aj-extra-val').textContent = limitadas ? 'Activado' : 'Desactivado';
      capa.querySelector('#aj-valMov').textContent =
        Anim.info(hoy).nombre + (limitadas ? ' · limitadas' : '');
    }
    /* al encenderlas o apagarlas, la ventana vuelve a entrar para que se
       vea el cambio sin salir de aquí */
    bExtra.onclick = function () {
      Anim.limitar(!Anim.limitar());
      Sonido.click();
      marcarMov();
      var caja = capa.querySelector('.caja');
      caja.style.animation = 'none';
      void caja.offsetWidth;
      caja.style.animation = '';
    };
    [].slice.call(contM.children).forEach(function (b) {
      b.onclick = function () {
        Anim.aplicar(b.dataset.anim);
        Sonido.click();
        marcarMov();
        /* demostración: la ventana vuelve a entrar con el estilo nuevo */
        var caja = capa.querySelector('.caja');
        caja.style.animation = 'none';
        void caja.offsetWidth;
        caja.style.animation = '';
        FX.desde(b, 12);
      };
    });

    /* ---------- interruptores ---------- */
    var bMus = capa.querySelector('#aj-mus');
    var bSfx = capa.querySelector('#aj-sfx');
    var bAga = capa.querySelector('#aj-agacha');
    var bConf = capa.querySelector('#aj-conf');
    var bFocos = capa.querySelector('#aj-focos');
    var bFondo = capa.querySelector('#aj-fondo');
    var rMus = capa.querySelector('#aj-volmus');
    var rSfx = capa.querySelector('#aj-volsfx');

    /* deja una tarjeta con su icono, su pastilla y el aire de apagada */
    function tarjeta(id, encendida, icono, pastilla, texto) {
      var card = capa.querySelector('#aj-card-' + id);
      if (card) card.classList.toggle('apagada', !encendida);
      var ic = capa.querySelector('#aj-' + id + '-ic');
      if (ic) ic.textContent = icono;
      var val = capa.querySelector('#aj-' + id + '-val');
      if (val) val.textContent = pastilla;
      var txt = capa.querySelector('#aj-' + id + '-txt');
      if (txt && texto !== undefined) txt.textContent = texto;
    }

    function pintar() {
      var espectro = Fondo.focos() === 'espectro';
      tarjeta('focos', true, espectro ? '📊' : '💡',
        espectro ? 'Analizador de espectro' : 'Latido clásico',
        espectro ? 'Cada foco es una banda de la música: los graves en los extremos y los agudos ' +
                   'hacia el centro.'
                 : 'Las nueve luces laten a la vez, al compás del tema del título.');
      tarjeta('fondo', Fondo.movimiento(), Fondo.movimiento() ? '🌊' : '⬛',
        Fondo.movimiento() ? 'En movimiento' : 'Quieto');
      tarjeta('conf', FX.marcadores(), FX.marcadores() ? '🎉' : '🚫',
        FX.marcadores() ? 'Encendido' : 'Apagado');
      var marc = !global.JuegoTrivial || JuegoTrivial.marcadores();
      tarjeta('marc', marc, marc ? '🏅' : '⏭', marc ? 'Se muestra' : 'No se muestra');
      tarjeta('mus', Sonido.musicaEncendida, '♪',
        Sonido.musicaEncendida ? 'Encendida' : 'Apagada');
      tarjeta('sfx', Sonido.sfxEncendido, Sonido.sfxEncendido ? '🔊' : '🔇',
        Sonido.sfxEncendido ? 'Encendidos' : 'Apagados');
      tarjeta('agacha', Sonido.subirEncendido, Sonido.subirEncendido ? '🔺' : '▬',
        Sonido.subirEncendido ? 'Sí, subirla' : 'No, volumen estable');

      rMus.value = Math.round(Sonido.volumenMusica * 100);
      rSfx.value = Math.round(Sonido.volumenEfectos * 100);
      capa.querySelector('#aj-volmus-v').textContent = rMus.value + '%';
      capa.querySelector('#aj-volsfx-v').textContent = rSfx.value + '%';
      rMus.disabled = !Sonido.musicaEncendida;
      rSfx.disabled = !Sonido.sfxEncendido;
      capa.querySelector('#aj-mus-mando').classList.toggle('off', !Sonido.musicaEncendida);
      capa.querySelector('#aj-sfx-mando').classList.toggle('off', !Sonido.sfxEncendido);
      Sonido.pintarBotones();
      marcarTema();
      marcarMov();
      /* resumen de cada submenú, en la entrada del menú principal */
      capa.querySelector('#aj-valPant').textContent = espectro ? 'Analizador' : 'Clásico';
      pintarRend();
      capa.querySelector('#aj-valSon').textContent =
        Sonido.musicaEncendida ? Math.round(Sonido.volumenMusica * 100) + '%' : 'sin música';
    }

    /* la tarjeta entera es el interruptor: cualquier hueco que no sea el
       mando del volumen lleva el clic a su botón */
    [].slice.call(capa.querySelectorAll('.aj-card')).forEach(function (card) {
      card.addEventListener('click', function (e) {
        if (e.target !== card) return;              // los hijos ya se apañan
        var b = card.querySelector('.cab');
        if (b) b.click();
      });
    });

    /* ---------- rendimiento ---------- */
    function pintarRend() {
      if (!global.Rendimiento) return;
      var R = global.Rendimiento, med = R.mediaRes(), lig = R.ligero(), fps = R.fps();
      tarjeta('media', med, '🔍',
        med ? (R.automatico() ? 'Activada · automática' : 'Activada') : 'Desactivada');
      tarjeta('ligero', lig, '⚡',
        lig ? (R.automaticoLigero() ? 'Activados · automáticos' : 'Activados') : 'Desactivados');
      tarjeta('fps', fps, '📈', fps ? 'Visible' : 'Oculto');
      var d = R.deteccion, nota;
      if (d.modesto) {
        nota = 'Este equipo parece modesto (' + d.motivos.join(', ') + '), así que los dos ' +
          'ahorros vienen activados de fábrica.';
      } else {
        nota = 'Este equipo no parece modesto' + (d.hilos ? ' (' + d.hilos + ' hilos de CPU)' : '') +
          ', así que los dos ahorros vienen apagados de fábrica.';
      }
      if (!R.automatico() || !R.automaticoLigero())
        nota += ' Ahora manda tu elección: <button id="aj-auto">volver a la automática</button>.';
      var p = capa.querySelector('#aj-deteccion');
      p.innerHTML = nota;
      var bAuto = p.querySelector('#aj-auto');
      if (bAuto) bAuto.onclick = function () { Sonido.click(); R.volverAutomatico(); pintar(); };
      var modos = [];
      if (med) modos.push('½ res');
      if (lig) modos.push('optimizado');
      capa.querySelector('#aj-valRend').textContent = modos.length ? modos.join(' + ') : 'normal';
    }
    capa.querySelector('#aj-media').onclick = function () {
      Sonido.click(); Rendimiento.mediaRes(!Rendimiento.mediaRes()); pintar(); pintarChipRend();
    };
    capa.querySelector('#aj-ligero').onclick = function () {
      Sonido.click(); Rendimiento.ligero(!Rendimiento.ligero()); pintar(); pintarChipRend();
    };
    capa.querySelector('#aj-fps').onclick = function () {
      Sonido.click(); Rendimiento.fps(!Rendimiento.fps()); pintar();
    };

    capa.querySelector('#aj-marc').onclick = function () {
      Sonido.click();
      JuegoTrivial.marcadores(!JuegoTrivial.marcadores());
      pintar();
    };
    bMus.onclick = function () { Sonido.alternarMusica(); pintar(); };
    bSfx.onclick = function () { Sonido.alternarSfx(); pintar(); };
    bAga.onclick = function () { Sonido.alternarSubir(); pintar(); };
    bFocos.onclick = function () {
      Sonido.click();
      Fondo.focos(Fondo.focos() === 'espectro' ? 'clasico' : 'espectro');
      pintar();
    };
    bFondo.onclick = function () {
      Sonido.click();
      Fondo.movimiento(!Fondo.movimiento());
      pintar();
    };
    bConf.onclick = function () {
      Sonido.click();
      FX.marcadores(!FX.marcadores());
      pintar();
      if (FX.marcadores()) FX.lluvia(22);     // una muestra pequeña
    };
    rMus.oninput = function () {
      Sonido.ponerVolumenMusica(rMus.value / 100);
      capa.querySelector('#aj-volmus-v').textContent = rMus.value + '%';
      capa.querySelector('#aj-valSon').textContent = rMus.value + '%';
    };
    /* mientras se arrastra suena un clic de muestra (como mucho cada 180 ms)
       y al soltar, un acierto: así se oye de verdad a qué volumen queda */
    var ultimaMuestra = 0;
    rSfx.oninput = function () {
      Sonido.ponerVolumenEfectos(rSfx.value / 100);
      capa.querySelector('#aj-volsfx-v').textContent = rSfx.value + '%';
      var ahora = performance.now();
      if (ahora - ultimaMuestra > 180) { ultimaMuestra = ahora; Sonido.click(); }
    };
    rSfx.onchange = function () { Sonido.probarEfecto(); };

    capa.querySelector('#aj-cerrar').onclick = function () { Sonido.click(); cerrar(); };
    capa.onclick = function (e) { if (e.target === capa) cerrar(); };
    document.addEventListener('keydown', function (e) {
      if (!capa.classList.contains('ver')) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        if (pagina !== 'inicio') ir('inicio', true); else cerrar();
      }
    });

    capa._pintar = pintar;
    capa._inicio = function () { ir('inicio', true); };
    capa._ir = function (p) { ir(p); };
    return capa;
  }

  /* Opciones de fábrica. Cada módulo guarda lo suyo; aquí solo se le pide
     que vuelva a su valor por defecto. */
  function restaurarTodo() {
    Tema.aplicar('pizarra');
    Anim.aplicar('cartas');
    Anim.limitar(false);
    Sonido.restaurar();
    Fondo.focos('espectro');
    Fondo.movimiento(true);
    FX.marcadores(true);
    if (global.JuegoTrivial) JuegoTrivial.marcadores(true);
    if (global.Rendimiento) {
      Rendimiento.volverAutomatico();
      Rendimiento.fps(false);
    }
    if (global.App && App.ancho) App.ancho(false, document.documentElement.classList.contains('ancho'));
    var d = document;
    if (d.fullscreenElement || d.webkitFullscreenElement) {
      try { (d.exitFullscreen || d.webkitExitFullscreen).call(d); } catch (e) {}
    }
  }

  /* abrir(): el menú · abrir('rend'), abrir('sonido')…: directamente esa página */
  function abrir(pagina) {
    var capa = construir();
    capa._pintar();
    capa._inicio();
    if (typeof pagina === 'string' && pagina !== 'inicio') capa._ir(pagina);
    capa.classList.add('ver');
  }

  /* el botón ⚡ del menú se ilumina cuando hay algún modo de rendimiento */
  function pintarChipRend() {
    if (!global.Rendimiento) return;
    var on = Rendimiento.mediaRes() || Rendimiento.ligero();
    [].slice.call(document.querySelectorAll('.js-rend')).forEach(function (b) {
      b.classList.toggle('on', on);
    });
  }
  function cerrar() {
    var capa = document.getElementById('aj-capa');
    if (capa) capa.classList.remove('ver');
  }

  global.Ajustes = {
    abrir: abrir,
    cerrar: cerrar,
    conectar: function () {
      [].slice.call(document.querySelectorAll('.js-aj')).forEach(function (b) {
        b.onclick = function () { Sonido.click(); abrir(); };
      });
      [].slice.call(document.querySelectorAll('.js-rend')).forEach(function (b) {
        b.onclick = function () { Sonido.click(); abrir('rend'); };
      });
      pintarChipRend();
    }
  };

})(window);
