/* =========================================================
   CONFIGURACIÓN · lo único que hay que tocar al instalar
   ---------------------------------------------------------
   Los dos primeros valores salen de Supabase:
     Project Settings ▸ API Keys (o «Data API»)
       · Project URL            → SUPABASE_URL
       · Publishable key / anon → SUPABASE_CLAVE

   Esa clave es PÚBLICA a propósito: va en todas las webs hechas
   con Supabase. Lo que protege los datos son las reglas (RLS) de
   supabase/esquema.sql, no el secreto de esta clave.

   ⚠ NUNCA pongas aquí la «secret key» ni la «service_role»:
     esas sí saltan todas las reglas.
   ========================================================= */
window.CONFIG = {
  SUPABASE_URL: 'https://itvbhfkgosntelxirvoe.supabase.co',
  SUPABASE_CLAVE: 'sb_publishable_xmb-rzMeZO9vQEe5ezxq2w_07vCL5mu',

  /* Dominio ficticio de los «correos» internos (usuario@dominio).
     Tiene que ser el mismo que en supabase/esquema.sql. */
  DOMINIO_USUARIOS: 'usuarios.juegosdeaula.invalid',

  /* La hoja de Google de la versión anterior: solo se usa para que el
     administrador pueda traer sus bancos al banco general. */
  HOJA_ANTIGUA: 'https://script.google.com/macros/s/AKfycby5eyiCjalLLprcdSX5Cfc5eFdZwTN14nxc6yATKpTRTf3mehvP-2_V8k1V3ofSQ5NPdw/exec'
};
