/* =========================================================
   Despertador de Supabase
   El plan gratuito de Supabase pausa el proyecto si pasa una
   semana sin actividad. Vercel llama a esta función una vez al
   día (ver "crons" en vercel.json): hace una consulta mínima a
   cada proyecto y con eso cuentan como «en uso».
   Solo usa las claves públicas (las mismas que las webs): no
   puede leer nada que no sea ya público.
   ========================================================= */
const PROYECTOS = [
  {
    nombre: 'juegos-de-aula',
    url: 'https://itvbhfkgosntelxirvoe.supabase.co',
    clave: 'sb_publishable_xmb-rzMeZO9vQEe5ezxq2w_07vCL5mu',
    consulta: '/rest/v1/bancos?select=id&publico=eq.true&limit=1'
  },
  {
    // Multiplicador (voodatari.github.io/multiplierquiz). Sus tablas están
    // protegidas por RLS: sin sesión la consulta devuelve una lista vacía,
    // pero cuenta igualmente como actividad.
    nombre: 'multiplicador',
    url: 'https://kibkldtotocefvtzlgza.supabase.co',
    clave: 'sb_publishable_LoT60n6ml9hmUrRyiT652Q_vErXXJbY',
    consulta: '/rest/v1/classes?select=id&limit=1'
  }
];

async function despierta(p) {
  let estado = 0, error = null;
  try {
    const r = await fetch(p.url + p.consulta, { headers: { apikey: p.clave } });
    estado = r.status;
  } catch (e) {
    error = String(e && e.message || e);
  }
  return { proyecto: p.nombre, ok: estado >= 200 && estado < 300, estado: estado, error: error };
}

module.exports = async function (req, res) {
  const resultados = await Promise.all(PROYECTOS.map(despierta));
  const ok = resultados.every(r => r.ok);
  res.setHeader('Cache-Control', 'no-store');
  res.status(ok ? 200 : 502)
     .json({ ok: ok, proyectos: resultados, hora: new Date().toISOString() });
};
