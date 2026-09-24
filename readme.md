# Juegos de aula · versión multiusuario (Supabase)

Fork de *Juegos de aula* (Trivial y Rosco para proyectar en clase) con cuentas de usuario.

- **Sin sesión**: se juega con el **banco general**. No aparece «Gestionar Preguntas».
- **Con sesión** (Entrar / Registrarse, arriba a la derecha; solo usuario y contraseña):
  cada usuario tiene y gestiona **sus** bancos, y puede jugar también con el general.
- **Administrador**: gestiona el banco general y los usuarios (lista, contraseña nueva,
  borrar con sus bancos, y borrar / renombrar / copiar al general sus bancos, uno o varios).
- **🎲 Preguntas aleatorias** (Trivial): mezcla preguntas de todos los bancos del usuario
  (o del general), eligiendo cuántas test y cuántas escritas.
- **🔗 Copiar enlace de juego**: `?jugar=<enlace>` abre un banco concreto sin iniciar sesión.

## Estructura nueva

```
js/config.js           URL y publishable key de Supabase (públicas por diseño)
js/vendor/supabase.js  supabase-js 2.116.0 (UMD), sin depender de CDN
js/nube.js             conexión y cuentas (Auth)
js/store.js            bancos: lectura, guardado, enlaces, aleatorias, admin
js/cuenta.js           botones Entrar/Registrarse y menú del usuario
js/admin.js            pestaña «👥 Usuarios»
supabase/esquema.sql   tablas, reglas RLS y funciones (se pega en SQL Editor)
supabase/GUIA-SUPABASE.html  pasos de instalación
vercel.json            cabeceras de seguridad (CSP, etc.) y caché
```

La seguridad la imponen las reglas de la base (RLS), no el código de la web.
Instalación: `supabase/GUIA-SUPABASE.html`.
