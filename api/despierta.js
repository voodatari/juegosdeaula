/* =========================================================
   Despertador de Supabase
   El plan gratuito de Supabase pausa el proyecto si pasa una
   semana sin actividad. Vercel llama a esta función una vez al
   día (ver "crons" en vercel.json): hace una consulta mínima al
   banco general y con eso el proyecto cuenta como «en uso».
   Solo usa la clave pública (la misma que la web): no puede leer
   nada que no sea ya público.
   ========================================================= */
const URL_SUPABASE = 'https://itvbhfkgosntelxirvoe.supabase.co';
const CLAVE_PUBLICA = 'sb_publishable_xmb-rzMeZO9vQEe5ezxq2w_07vCL5mu';

module.exports = async function (req, res) {
  let estado = 0, error = null;
  try {
    const r = await fetch(URL_SUPABASE + '/rest/v1/bancos?select=id&publico=eq.true&limit=1', {
      headers: { apikey: CLAVE_PUBLICA }
    });
    estado = r.status;
  } catch (e) {
    error = String(e && e.message || e);
  }
  res.setHeader('Cache-Control', 'no-store');
  res.status(estado >= 200 && estado < 300 ? 200 : 502)
     .json({ ok: estado >= 200 && estado < 300, estado: estado, error: error, hora: new Date().toISOString() });
};
