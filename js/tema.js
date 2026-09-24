/* =========================================================
   Temas visuales
   Un tema no cambia estructura ni clases: solo redefine las
   variables de color de :root (ver css/base.css). Por eso se
   aplica al instante y sirve igual en las cuatro páginas.
   Se guarda en el navegador, así que el maestro lo elige una
   vez y lo encuentra puesto al día siguiente.
   ========================================================= */
(function (global) {

  var CLAVE = 'trivialaula.tema';
  var POR_DEFECTO = 'pizarra';   // el que mejor se ve en el proyector del aula

  var TEMAS = [
    { id: 'aurora', nombre: 'Aurora', nota: 'Violeta y turquesa, claro y alegre',
      muestra: ['#6E5BE8', '#2BC4B4', '#F5C518'], oscuro: false },
    { id: 'atardecer', nombre: 'Atardecer', nota: 'Naranjas y magentas, muy cálido',
      muestra: ['#FF7A3D', '#C74BD8', '#FFD166'], oscuro: false },
    { id: 'bosque', nombre: 'Bosque', nota: 'Verdes y dorado, descansa la vista',
      muestra: ['#2FA36B', '#9BD84A', '#F2C14E'], oscuro: false },
    { id: 'oceano', nombre: 'Océano', nota: 'Azules profundos y cian',
      muestra: ['#1E6FE0', '#23D6D6', '#8CE0FF'], oscuro: false },
    { id: 'caramelo', nombre: 'Caramelo', nota: 'Rosa y lila, el más infantil',
      muestra: ['#E84E9C', '#66D3F5', '#FFC93C'], oscuro: false },
    { id: 'pizarra', nombre: 'Pizarra', nota: 'Oscuro sobrio · el que viene puesto',
      muestra: ['#1B2136', '#4C8DFF', '#FFD166'], oscuro: true },
    { id: 'neon', nombre: 'Neón', nota: 'Fucsia y cian sobre negro, pura fiesta',
      muestra: ['#FF3CAC', '#00F5D4', '#FEE440'], oscuro: true },
    { id: 'arena', nombre: 'Arena', nota: 'Terracota y turquesa, cálido y tranquilo',
      muestra: ['#D0703A', '#2BB3A0', '#F5C518'], oscuro: false },
    { id: 'galaxia', nombre: 'Galaxia', nota: 'Violeta y rosa nebulosa sobre noche',
      muestra: ['#8B7CF6', '#E0529C', '#FFD166'], oscuro: true }
  ];

  function leer() {
    try { return localStorage.getItem(CLAVE) || POR_DEFECTO; } catch (e) { return POR_DEFECTO; }
  }

  function aplicar(id, guardar) {
    var existe = TEMAS.some(function (t) { return t.id === id; });
    if (!existe) id = POR_DEFECTO;
    if (id === 'aurora') document.documentElement.removeAttribute('data-tema');
    else document.documentElement.setAttribute('data-tema', id);
    if (guardar !== false) { try { localStorage.setItem(CLAVE, id); } catch (e) {} }
    return id;
  }

  /* Se aplica ya, antes de que la página pinte nada. */
  aplicar(leer(), false);

  global.Tema = {
    lista: TEMAS,
    actual: leer,
    aplicar: aplicar,
    info: function (id) {
      return TEMAS.filter(function (t) { return t.id === id; })[0] || TEMAS[0];
    }
  };

})(window);
