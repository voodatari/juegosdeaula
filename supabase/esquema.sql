-- =====================================================================
--  JUEGOS DE AULA · esquema de la base de datos en Supabase
--  Pégalo entero en  SQL Editor ▸ New query  y pulsa  Run.
--  Se puede volver a ejecutar sin perder datos (sirve también para
--  actualizar el esquema en versiones futuras).
--
--  Qué protege:
--   · Las contraseñas las guarda Supabase Auth cifradas (bcrypt); ni la
--     web ni estas tablas las ven nunca.
--   · Cada usuario solo puede leer y tocar SUS bancos.
--   · El banco general (publico = true) lo lee cualquiera, pero solo lo
--     modifica el administrador.
--   · La lista de usuarios solo la ve el administrador.
--   · Un enlace de juego da acceso a UN banco concreto, y a nada más.
-- =====================================================================

-- Dominio ficticio de los correos internos: el registro solo pide usuario y
-- contraseña, y Supabase necesita un «email». Tiene que coincidir con
-- DOMINIO_USUARIOS de js/config.js.
create or replace function public.dominio_usuarios() returns text
language sql immutable set search_path = '' as $$ select 'usuarios.juegosdeaula.invalid' $$;


-- ---------------------------------------------------------------------
--  Tablas
-- ---------------------------------------------------------------------
create table if not exists public.perfiles (
  id        uuid primary key references auth.users (id) on delete cascade,
  usuario   text not null unique check (usuario ~ '^[a-z0-9][a-z0-9._-]{2,19}$'),
  es_admin  boolean not null default false,
  creado    timestamptz not null default now()
);

-- cuenta los elementos de una lista JSON (0 si no es una lista)
create or replace function public.cuenta(j jsonb) returns integer
language sql immutable set search_path = '' as $$
  select case when jsonb_typeof(j) = 'array' then jsonb_array_length(j) else 0 end $$;

create table if not exists public.bancos (
  id           uuid primary key default gen_random_uuid(),
  propietario  uuid references public.perfiles (id) on delete cascade default auth.uid(),
  publico      boolean not null default false,
  tipo         text not null check (tipo in ('trivial', 'rosco')),
  titulo       text not null check (char_length(btrim(titulo)) between 1 and 120),
  datos        jsonb not null check (jsonb_typeof(datos) = 'object'
                                     and octet_length(datos::text) <= 400000),
  enlace       uuid not null unique default gen_random_uuid(),
  -- trivial: n1 = test, n2 = escritas · rosco: n1 = roscos, n2 = letras del primero
  n1           integer generated always as (
                 case when tipo = 'trivial' then public.cuenta(datos -> 'test')
                      else public.cuenta(datos -> 'roscos') end) stored,
  n2           integer generated always as (
                 case when tipo = 'trivial' then public.cuenta(datos -> 'escritas')
                      else public.cuenta(datos -> 'roscos' -> 0 -> 'letras') end) stored,
  creado       timestamptz not null default now(),
  actualizado  timestamptz not null default now(),
  constraint bancos_con_dueno check (publico or propietario is not null)
);
create index if not exists bancos_propietario_idx on public.bancos (propietario);
create index if not exists bancos_publico_idx on public.bancos (publico) where publico;


-- ---------------------------------------------------------------------
--  ¿Es administrador quien hace la petición?
-- ---------------------------------------------------------------------
create or replace function public.es_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select p.es_admin from public.perfiles p where p.id = auth.uid()), false) $$;


-- ---------------------------------------------------------------------
--  Registro: cada usuario nuevo de Auth recibe su perfil.
--  Solo se admiten correos del dominio interno: así nadie puede
--  registrarse con un correo real ni «colarse» con otro nombre.
-- ---------------------------------------------------------------------
create or replace function public.al_registrarse() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  local  text := lower(split_part(new.email, '@', 1));
  dom    text := lower(split_part(new.email, '@', 2));
begin
  if dom is distinct from public.dominio_usuarios() then
    raise exception 'Registro no permitido' using errcode = '42501';
  end if;
  if local !~ '^[a-z0-9][a-z0-9._-]{2,19}$' then
    raise exception 'Nombre de usuario no válido' using errcode = '22023';
  end if;
  insert into public.perfiles (id, usuario) values (new.id, local);
  return new;
end $$;

drop trigger if exists al_registrarse on auth.users;
create trigger al_registrarse after insert on auth.users
  for each row execute function public.al_registrarse();


-- ---------------------------------------------------------------------
--  Reglas de los bancos
-- ---------------------------------------------------------------------
create or replace function public.antes_de_guardar_banco() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    -- el banco general no tiene dueño; los demás son siempre de quien los crea
    if new.publico then
      new.propietario := null;
    elsif not public.es_admin() then
      new.propietario := auth.uid();
    end if;
    -- tope por usuario, para que nadie llene la base
    if new.propietario is not null and
       (select count(*) from public.bancos b where b.propietario = new.propietario) >= 200 then
      raise exception 'Has llegado al máximo de 200 bancos' using errcode = '54000';
    end if;
  end if;
  new.titulo := btrim(new.titulo);
  new.actualizado := now();
  return new;
end $$;

drop trigger if exists antes_de_guardar_banco on public.bancos;
create trigger antes_de_guardar_banco before insert or update on public.bancos
  for each row execute function public.antes_de_guardar_banco();


-- ---------------------------------------------------------------------
--  Permisos: se quita todo y se da solo lo imprescindible
-- ---------------------------------------------------------------------
alter table public.perfiles enable row level security;
alter table public.bancos   enable row level security;

revoke all on public.perfiles from anon, authenticated;
revoke all on public.bancos   from anon, authenticated;

grant select on public.perfiles to authenticated;
grant select (id, propietario, publico, tipo, titulo, datos, enlace, n1, n2, creado, actualizado)
  on public.bancos to anon, authenticated;
grant insert (propietario, publico, tipo, titulo, datos) on public.bancos to authenticated;
grant update (titulo, datos) on public.bancos to authenticated;
grant delete on public.bancos to authenticated;

-- perfiles: cada uno ve el suyo; el administrador, todos
drop policy if exists perfiles_leer on public.perfiles;
create policy perfiles_leer on public.perfiles for select to authenticated
  using (id = (select auth.uid()) or (select public.es_admin()));

-- bancos: el general lo lee cualquiera; los demás, su dueño y el administrador
drop policy if exists bancos_leer on public.bancos;
create policy bancos_leer on public.bancos for select to anon, authenticated
  using (publico or propietario = (select auth.uid()) or (select public.es_admin()));

drop policy if exists bancos_crear on public.bancos;
create policy bancos_crear on public.bancos for insert to authenticated
  with check ((not publico and propietario = (select auth.uid())) or (select public.es_admin()));

drop policy if exists bancos_cambiar on public.bancos;
create policy bancos_cambiar on public.bancos for update to authenticated
  using ((not publico and propietario = (select auth.uid())) or (select public.es_admin()))
  with check ((not publico and propietario = (select auth.uid())) or (select public.es_admin()));

drop policy if exists bancos_borrar on public.bancos;
create policy bancos_borrar on public.bancos for delete to authenticated
  using ((not publico and propietario = (select auth.uid())) or (select public.es_admin()));


-- ---------------------------------------------------------------------
--  Funciones que la web puede llamar
-- ---------------------------------------------------------------------

-- Abrir un banco con su enlace de juego (sin iniciar sesión).
create or replace function public.banco_compartido(p_enlace uuid)
returns table (tipo text, titulo text, datos jsonb)
language sql stable security definer set search_path = '' as $$
  select b.tipo, b.titulo, b.datos from public.bancos b where b.enlace = p_enlace $$;

-- Cambiar el enlace de un banco: el anterior deja de funcionar.
create or replace function public.nuevo_enlace(p_id uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare e uuid;
begin
  update public.bancos b set enlace = gen_random_uuid()
   where b.id = p_id
     and ((not b.publico and b.propietario = auth.uid()) or public.es_admin())
  returning b.enlace into e;
  if e is null then raise exception 'No tienes permiso sobre ese banco' using errcode = '42501'; end if;
  return e;
end $$;

-- Lista de usuarios (solo administrador).
create or replace function public.admin_usuarios()
returns table (id uuid, usuario text, es_admin boolean, creado timestamptz,
               ultimo_acceso timestamptz, n_trivial bigint, n_rosco bigint)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.es_admin() then
    raise exception 'Solo el administrador' using errcode = '42501';
  end if;
  return query
    select p.id, p.usuario, p.es_admin, p.creado, u.last_sign_in_at,
           count(b.id) filter (where b.tipo = 'trivial'),
           count(b.id) filter (where b.tipo = 'rosco')
      from public.perfiles p
      join auth.users u on u.id = p.id
      left join public.bancos b on b.propietario = p.id
     group by p.id, u.last_sign_in_at
     order by p.es_admin desc, p.usuario;
end $$;

-- Borrar un usuario con todos sus bancos (solo administrador).
create or replace function public.admin_borrar_usuario(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.es_admin() then
    raise exception 'Solo el administrador' using errcode = '42501';
  end if;
  if p_id = auth.uid() or exists (select 1 from public.perfiles p where p.id = p_id and p.es_admin) then
    raise exception 'No se puede borrar a un administrador' using errcode = '42501';
  end if;
  delete from auth.users u where u.id = p_id;       -- en cascada: perfil y bancos
end $$;

-- Copiar bancos de usuarios al banco general (solo administrador).
create or replace function public.admin_copiar_al_general(p_ids uuid[]) returns integer
language plpgsql security definer set search_path = '' as $$
declare n integer;
begin
  if not public.es_admin() then
    raise exception 'Solo el administrador' using errcode = '42501';
  end if;
  insert into public.bancos (propietario, publico, tipo, titulo, datos)
  select null, true, b.tipo, b.titulo, b.datos
    from public.bancos b where b.id = any (p_ids) and not b.publico;
  get diagnostics n = row_count;
  return n;
end $$;

-- Poner una contraseña nueva a un usuario que la ha olvidado (solo
-- administrador). El administrador la escribe y se la dice al usuario;
-- en la base solo queda cifrada.
create or replace function public.admin_cambiar_clave(p_id uuid, p_clave text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.es_admin() then
    raise exception 'Solo el administrador' using errcode = '42501';
  end if;
  if char_length(coalesce(p_clave, '')) < 8 then
    raise exception 'La contraseña necesita al menos 8 caracteres' using errcode = '22023';
  end if;
  update auth.users u
     set encrypted_password = extensions.crypt(p_clave, extensions.gen_salt('bf')),
         updated_at = now()
   where u.id = p_id;
  if not found then
    raise exception 'No existe ese usuario' using errcode = 'P0002';
  end if;
end $$;

-- Quién puede ejecutar cada función (por defecto, cualquiera: se recorta)
revoke all on function public.banco_compartido(uuid)          from public, anon, authenticated;
revoke all on function public.nuevo_enlace(uuid)              from public, anon, authenticated;
revoke all on function public.admin_usuarios()                from public, anon, authenticated;
revoke all on function public.admin_borrar_usuario(uuid)      from public, anon, authenticated;
revoke all on function public.admin_copiar_al_general(uuid[]) from public, anon, authenticated;
revoke all on function public.admin_cambiar_clave(uuid, text)   from public, anon, authenticated;
revoke all on function public.al_registrarse()                from public, anon, authenticated;
revoke all on function public.antes_de_guardar_banco()        from public, anon, authenticated;
revoke all on function public.es_admin()                      from public, anon, authenticated;

grant execute on function public.banco_compartido(uuid)          to anon, authenticated;
grant execute on function public.es_admin()                      to anon, authenticated;
grant execute on function public.nuevo_enlace(uuid)              to authenticated;
grant execute on function public.admin_usuarios()                to authenticated;
grant execute on function public.admin_borrar_usuario(uuid)      to authenticated;
grant execute on function public.admin_copiar_al_general(uuid[]) to authenticated;
grant execute on function public.admin_cambiar_clave(uuid, text)   to authenticated;
