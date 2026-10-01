# Juegos de aula · Trivial y Rosco

Dos juegos **por equipos para proyectar en clase**: un Trivial con preguntas tipo test y de respuesta escrita, y un Rosco tipo *Pasapalabra*. Las preguntas salen de **bancos** que cada docente crea, importa o genera con ayuda de una IA.

**Web:** https://voodatari.github.io/juegosdeaula/

Funciona en el navegador, sin instalar nada. Está pensado para la pizarra digital: todo se ve grande y los equipos ven a la vez el marcador y las respuestas.

## Los juegos

### 🧠 Trivial por equipos

- De 1 a 4 equipos, que contestan por turnos cada pregunta tipo test; al responder el último se revela la solución y los puntos se suman solos.
- Las preguntas de **respuesta escrita** las puntúa el maestro.
- Un banco puede traer solo test, solo escritas o cualquier mezcla.
- Se puede imprimir una **hoja de respuestas** para el alumnado (sin los enunciados, para que no lean por delante).

### 🔤 Rosco pasapalabra

- Un rosco por equipo. Acierto: la letra toma el color del equipo y sigue el mismo equipo. Fallo: la letra queda tachada y pasa el turno. *Pasapalabra*: la letra queda pendiente.
- Dos relojes opcionales: el bote de tiempo de cada equipo y un límite por letra.
- Se puede imprimir la **guía de soluciones** para el maestro.

### 🎲 Preguntas aleatorias

Mezcla preguntas de todos tus bancos (o del banco general) eligiendo cuántas test y cuántas escritas.

## Bancos de preguntas

- **Sin iniciar sesión** se juega con el **banco general**.
- **Con cuenta** (Entrar o Registrarse, solo usuario y contraseña), cada docente tiene y gestiona **sus** bancos, y puede seguir usando el general.
- Los bancos se añaden pegando texto o subiendo un `.csv` (se puede abrir en Excel), o se crean desde cero en el editor.
- **🤖 Generar con IA**: la web prepara el encargo (*prompt*) con el formato exacto para que una IA escriba las preguntas; después se pega la respuesta y se comprueba línea a línea.
- **🔗 Copiar enlace de juego**: `?jugar=<enlace>` abre un banco concreto sin iniciar sesión, para compartirlo.
- La **cuenta administradora** gestiona el banco general y los usuarios.

### Formato de los bancos

Una línea por elemento, separada por punto y coma. La primera palabra dice qué es cada línea:

```
TRIVIAL;Título del banco
TEST;Pregunta;opción A;opción B;opción C;opción D;letra correcta
ESCRITA;Pregunta;respuesta

ROSCO;Título del banco
SEGUNDOS;150
EQUIPO;Equipo 1
LETRA;A;EMPIEZA;definición;solución
LETRA;Ñ;CONTIENE;definición;solución
```

Hay ejemplos completos en [`data/`](data/).

## Opciones

Tiempos de cada juego, volumen de la música y de los efectos, subida de la música en el marcador entre preguntas y **modo ligero** para equipos poco potentes.

## Cómo está hecho

HTML, CSS y JavaScript sin frameworks ni compilación: lo que hay en el repositorio es exactamente lo que se publica. Las cuentas y los bancos van en [Supabase](https://supabase.com). La seguridad la imponen las reglas de la base de datos (RLS), no el código de la web.

| Archivo | Qué hace |
|---|---|
| `index.html` | Todas las vistas: menú, Trivial, Rosco, bancos, editor |
| `js/app.js`, `js/menu.js` | Navegación entre vistas y menú principal |
| `js/trivial.js`, `js/rosco.js` | Los dos juegos |
| `js/importar.js`, `js/editor.js`, `js/csv.js` | Bancos: añadir, editar y leer el formato CSV |
| `js/hoja.js` | Hoja de respuestas y guía de soluciones para imprimir |
| `js/config.js`, `js/nube.js`, `js/store.js`, `js/cuenta.js`, `js/admin.js` | Supabase: conexión, bancos, cuentas y administración |
| `js/audio.js` | Música y efectos; en Chrome, la música se repite sin cortes con Web Audio |
| `js/ajustes.js`, `js/rendimiento.js`, `js/fondo.js`, `js/fx.js`, `js/anim.js`, `js/tema.js`, `js/dialogo.js` | Opciones, modo ligero, fondo, efectos y ventanas |
| `js/vendor/supabase.js` | supabase-js, copia local para no depender de un CDN |
| `vercel.json`, `api/despierta.js` | Cabeceras de seguridad para Vercel y una tarea diaria que evita que el plan gratuito de Supabase pause el proyecto |

### Probarlo en local

Hay que servir la carpeta con un servidor web (por ejemplo, la extensión *Live Server* de VS Code, `npx serve .` o `python -m http.server 8080`).

## Créditos de terceros

- [supabase-js](https://github.com/supabase/supabase-js) (MIT): licencia en [`js/vendor/supabase-LICENSE.txt`](js/vendor/supabase-LICENSE.txt).
- Tipografía [Baloo 2](https://fonts.google.com/specimen/Baloo+2) (SIL Open Font License), de Google Fonts.

---

Hecho por Daniel Vera (profe Dani).
