-- =====================================================================================================
-- VacunaApp - ESQUEMA COMPLETO DE LA BASE DE DATOS (un solo archivo)
-- =====================================================================================================
-- Reemplaza a schema, roles, confirmaciones, establecimiento, autorizacion, campanas, carne,
-- dosis_externas, multicentro, inventario, suscripciones y estado_whatsapp (.sql). Se ejecuta UNA vez y se puede REPETIR sin riesgo.
--
--   * Base nueva ........ crea todo el esquema final.
--   * Base ya en uso .... la actualiza sin perder datos (agrega lo que falte y vuelve a crear las
--                         funciones, triggers, vistas y políticas con su versión final).
--
-- Requiere PostgreSQL 15 o superior (Supabase usa 15/17).
--
-- Dónde ejecutarlo
--   * Supabase: Editor SQL > pegar todo > Run. No toques nada más.
--   * PostgreSQL propio: psql -d vacunaapp -v ON_ERROR_STOP=1 -f vacunaapp_esquema_completo.sql
--       La sección 0 crea lo mínimo que Supabase trae de fábrica (roles anon / authenticated / service_role,
--       esquema auth con auth.users y auth.uid()). Si ya existen, no las toca.
--       auth.uid() devuelve el usuario que la conexión declare con:
--           select set_config('request.jwt.claim.sub', '<uuid-del-usuario>', true);
--       Los permisos por fila (RLS) dependen de eso. Una conexión del dueño de las tablas (o un superusuario)
--       ignora RLS, como hace hoy la service role en las rutas /api del servidor.
--       Los logos (Storage) y el tiempo real (Realtime) son de Supabase: en PostgreSQL se omiten solos.
--
-- Qué NO incluye: los datos de demostración (supabase/seed.sql), que siguen aparte.
-- =====================================================================================================

-- 0. Compatibilidad con PostgreSQL puro (en Supabase no hace nada) ------------------------------------
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin; end if;
exception when insufficient_privilege then
  raise notice 'No se pudieron crear los roles anon/authenticated/service_role: créalos con un usuario con CREATEROLE.';
end $$;

do $$
begin
  if not exists (select 1 from pg_namespace where nspname = 'auth') then
    create schema auth;
    create table auth.users (
      id uuid primary key default gen_random_uuid(),
      email text unique,
      raw_user_meta_data jsonb not null default '{}',
      created_at timestamptz not null default now()
    );
    create function auth.uid() returns uuid language sql stable as
      $f$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $f$;
  end if;
end $$;

create extension if not exists "pgcrypto";

-- 1. Tipos enumerados --------------------------------------------------------------------------------
do $$ begin
  create type estado_cita as enum ('PENDIENTE', 'COMPLETADA', 'CANCELADA');
exception when duplicate_object then null; end $$;

do $$ begin
  create type estado_envio as enum ('PENDIENTE', 'ENVIADO', 'FALLIDO');
exception when duplicate_object then null; end $$;

do $$ begin
  create type canal_envio as enum ('EMAIL', 'WHATSAPP', 'AMBOS');
exception when duplicate_object then null; end $$;

-- 2. Funciones sin dependencias ----------------------------------------------------------------------
-- Token aleatorio de 20 caracteres, seguro para URL (120 bits): enlace secreto del carné digital
create or replace function nuevo_token_carne() returns text
language sql volatile set search_path = public, extensions as $$
  select translate(encode(gen_random_bytes(15), 'base64'), '+/', '-_')
$$;

-- 3. Tablas (esquema final) --------------------------------------------------------------------------
-- Centros de vacunación: cada uno ve y modifica solo sus datos (plataforma multi-centro)
create table if not exists centros (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  nit text,
  telefono text,
  email text,
  direccion text,
  ciudad text,
  sitio_web text,
  horario text,
  logo_url text,
  color text not null default 'azul',
  dias_atencion int[] not null default '{1,2,3,4,5,6}',      -- 0 = domingo … 6 = sábado
  cupos_por_dia int not null default 0 check (cupos_por_dia >= 0), -- 0 = sin límite
  whatsapp_from text,                     -- número de Twilio dedicado al centro (whatsapp:+57...), asignado por la plataforma; null = el número compartido
  activo boolean not null default true,   -- false = suspendido: sus usuarios pierden el acceso
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Perfil de cada usuario del personal (ADMIN: todo; VACUNADOR: registra vacunaciones y gestiona pacientes)
create table if not exists perfiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  nombre text not null,
  rol text not null check (rol in ('ADMIN', 'VACUNADOR')),
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  centro_id uuid references centros(id) on delete cascade
);

create table if not exists pacientes (
  id uuid primary key default gen_random_uuid(),
  nombre_completo text not null,
  documento_identidad text not null,                       -- único por centro (índice más abajo)
  email text,
  telefono text not null check (telefono ~ '^\+[1-9][0-9]{7,14}$'),  -- E.164
  fecha_nacimiento date,
  created_at timestamptz not null default now(),
  -- Autorización de mensajes, Ley 1581 de 2012 (null = sin registrar)
  autoriza_mensajes text check (autoriza_mensajes in ('AUTORIZADO', 'NO_AUTORIZADO')),
  autorizacion_fecha timestamptz,
  autorizacion_medio text check (autorizacion_medio in ('FORMULARIO', 'WHATSAPP', 'IMPORTACION')),
  centro_id uuid references centros(id) on delete cascade
);

create table if not exists vacunas (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,                                     -- único por centro (índice más abajo)
  dosis_totales int not null default 1 check (dosis_totales > 0),
  intervalo_dias_recom_dosis int check (intervalo_dias_recom_dosis > 0),
  descripcion text,
  stock_minimo int not null default 0 check (stock_minimo >= 0),
  centro_id uuid references centros(id) on delete cascade
);

-- Inventario: lotes con vencimiento y existencias
create table if not exists lotes (
  id uuid primary key default gen_random_uuid(),
  centro_id uuid references centros(id) on delete cascade,
  vacuna_id uuid not null references vacunas(id) on delete restrict,
  numero_lote text not null,
  laboratorio text,
  fecha_vencimiento date not null,
  fecha_ingreso date not null default current_date,
  cantidad_inicial int not null check (cantidad_inicial > 0),
  existencias int not null check (existencias >= 0),
  costo_unitario numeric(12, 2) check (costo_unitario >= 0),
  creado_por uuid references perfiles(user_id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);

create table if not exists citas_vacunacion (
  id uuid primary key default gen_random_uuid(),
  paciente_id uuid not null references pacientes(id) on delete cascade,
  vacuna_id uuid not null references vacunas(id),
  numero_dosis int not null default 1 check (numero_dosis > 0),
  fecha_aplicacion date not null,
  fecha_proxima_dosis date,
  estado estado_cita not null default 'PENDIENTE',
  aplicada_por uuid references perfiles(user_id) on delete set null,   -- quién aplicó la dosis
  externa boolean not null default false,       -- dosis aplicada en otro lugar (según el carné físico)
  lugar_externo text,
  lote_id uuid references lotes(id) on delete restrict,
  centro_id uuid references centros(id) on delete cascade
);

create table if not exists recordatorios (
  id uuid primary key default gen_random_uuid(),
  cita_id uuid not null unique references citas_vacunacion(id) on delete cascade,
  estado_envio estado_envio not null default 'PENDIENTE',
  canal canal_envio not null default 'AMBOS',
  fecha_programada date not null,
  intentos int not null default 0,
  ultimo_error text,
  -- Confirmación / reprogramación por WhatsApp
  confirmacion text check (confirmacion in ('CONFIRMADA', 'REPROGRAMANDO', 'REPROGRAMADA')),
  opciones_fecha date[],                        -- fechas ofrecidas al paciente mientras elige
  reprogramaciones int not null default 0,
  enviado_at timestamptz,
  respondido_at timestamptz,
  centro_id uuid references centros(id) on delete cascade
);

-- Evidencia de cada cambio de autorización (quién, cuándo, por qué medio)
create table if not exists autorizaciones_log (
  id uuid primary key default gen_random_uuid(),
  paciente_id uuid not null references pacientes(id) on delete cascade,
  estado text not null check (estado in ('AUTORIZADO', 'NO_AUTORIZADO')),
  medio text,
  usuario_id uuid references perfiles(user_id) on delete set null,  -- null = el propio paciente / sistema
  created_at timestamptz not null default now(),
  centro_id uuid references centros(id) on delete cascade
);

-- Campañas de pacientes atrasados
create table if not exists campanas (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  mensaje text not null,                        -- introducción editable (con {nombre}, {vacuna}, …)
  creada_por uuid references perfiles(user_id) on delete set null,
  created_at timestamptz not null default now(),
  centro_id uuid references centros(id) on delete cascade
);

create table if not exists campana_envios (
  id uuid primary key default gen_random_uuid(),
  campana_id uuid not null references campanas(id) on delete cascade,
  paciente_id uuid not null references pacientes(id) on delete cascade,
  cita_id uuid not null references citas_vacunacion(id) on delete cascade,  -- última dosis aplicada
  telefono text not null,
  mensaje text not null,                        -- texto final enviado
  variables jsonb not null default '{}',        -- para plantillas aprobadas de WhatsApp
  estado text not null default 'PENDIENTE' check (estado in ('PENDIENTE', 'ENVIADO', 'FALLIDO')),
  error text,
  enviado_at timestamptz,
  -- ELIGIENDO (escogiendo fecha), AGENDADA (paciente recuperado), YA_APLICADA (se vacunó en otro lugar)
  respuesta text check (respuesta in ('ELIGIENDO', 'AGENDADA', 'YA_APLICADA')),
  opciones_fecha date[],
  fecha_agendada date,
  respondido_at timestamptz,
  centro_id uuid references centros(id) on delete cascade,
  unique (campana_id, cita_id)
);

-- Cuántas veces y cuándo se abrió el carné digital
create table if not exists carne_consultas (
  id uuid primary key default gen_random_uuid(),
  paciente_id uuid not null references pacientes(id) on delete cascade,
  created_at timestamptz not null default now(),
  centro_id uuid references centros(id) on delete cascade
);

-- Kárdex del inventario: cantidad positiva = entra, negativa = sale
create table if not exists inventario_movimientos (
  id uuid primary key default gen_random_uuid(),
  centro_id uuid references centros(id) on delete cascade,
  lote_id uuid not null references lotes(id) on delete cascade,
  tipo text not null check (tipo in ('ENTRADA', 'APLICACION', 'BAJA', 'CONTEO', 'ANULACION')),
  cantidad int not null,
  motivo text,          -- BAJA: VENCIDA, ROTURA, CADENA_FRIO, FRASCO_ABIERTO, OTRO
  detalle text,
  cita_id uuid references citas_vacunacion(id) on delete set null,
  usuario_id uuid references perfiles(user_id) on delete set null,
  created_at timestamptz not null default now()
);

-- Superadministradores de la plataforma (crean y suspenden centros)
create table if not exists plataforma_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

-- 4. Actualización de bases anteriores (en una base nueva no hace nada) ---------------------------------
alter table pacientes
  add column if not exists autoriza_mensajes text check (autoriza_mensajes in ('AUTORIZADO', 'NO_AUTORIZADO')),
  add column if not exists autorizacion_fecha timestamptz,
  add column if not exists autorizacion_medio text check (autorizacion_medio in ('FORMULARIO', 'WHATSAPP', 'IMPORTACION'));

alter table vacunas
  add column if not exists stock_minimo int not null default 0 check (stock_minimo >= 0);

alter table citas_vacunacion
  add column if not exists aplicada_por uuid references perfiles(user_id) on delete set null,
  add column if not exists externa boolean not null default false,
  add column if not exists lugar_externo text,
  add column if not exists lote_id uuid references lotes(id) on delete restrict;

alter table recordatorios
  add column if not exists confirmacion text check (confirmacion in ('CONFIRMADA', 'REPROGRAMANDO', 'REPROGRAMADA')),
  add column if not exists opciones_fecha date[],
  add column if not exists reprogramaciones int not null default 0,
  add column if not exists enviado_at timestamptz,
  add column if not exists respondido_at timestamptz;

-- Plataforma multi-centro: las tablas anteriores no tenían centro_id
do $$
declare t text;
begin
  foreach t in array array['perfiles','pacientes','vacunas','citas_vacunacion','recordatorios',
                           'autorizaciones_log','campanas','campana_envios','carne_consultas',
                           'lotes','inventario_movimientos'] loop
    execute format('alter table %I add column if not exists centro_id uuid references centros(id) on delete cascade', t);
  end loop;
end $$;

-- Carné digital: cada paciente tiene un enlace secreto /carne/<carne_token> (uno nuevo invalida el anterior)
alter table pacientes add column if not exists carne_token text;
update pacientes set carne_token = nuevo_token_carne() where carne_token is null;
alter table pacientes alter column carne_token set default nuevo_token_carne();
alter table pacientes alter column carne_token set not null;

-- 5. Primer centro, usuarios existentes y centro_id en todas las tablas --------------------------------
-- 5.1 Debe existir al menos un centro (si la base traía la tabla de una sola fila "establecimiento",
--     sus datos pasan a ese primer centro).
do $$
begin
  if not exists (select 1 from centros) and to_regclass('public.establecimiento') is not null then
    execute 'insert into centros (nombre, nit, telefono, email, direccion, ciudad, sitio_web, horario, logo_url,
                                  color, dias_atencion, cupos_por_dia)
             select nombre, nit, telefono, email, direccion, ciudad, sitio_web, horario, logo_url,
                    color, dias_atencion, cupos_por_dia from establecimiento';
  end if;
  insert into centros (nombre) select 'Mi centro de vacunación' where not exists (select 1 from centros);
end $$;

-- 5.2 Primera instalación: los usuarios que ya existen pasan a ADMIN del primer centro (el rol se cambia luego
--     desde la app). Solo si aún no hay perfiles, para que repetir este archivo no dé acceso a nadie más.
insert into perfiles (user_id, email, nombre, rol, centro_id)
select u.id, u.email, coalesce(u.raw_user_meta_data->>'nombre', split_part(u.email, '@', 1)), 'ADMIN',
       (select id from centros order by created_at, id limit 1)
from auth.users u
where not exists (select 1 from perfiles)
on conflict (user_id) do nothing;

-- 5.3 Los datos sin centro van al primer centro; después centro_id es obligatorio.
do $$
declare
  t text;
  primero uuid := (select id from centros order by created_at, id limit 1);
begin
  foreach t in array array['perfiles','pacientes','vacunas','citas_vacunacion','recordatorios',
                           'autorizaciones_log','campanas','campana_envios','carne_consultas',
                           'lotes','inventario_movimientos'] loop
    execute format('update %I set centro_id = %L where centro_id is null', t, primero);
    execute format('alter table %I alter column centro_id set not null', t);
    execute format('create index if not exists %I on %I (centro_id)', 'idx_' || t || '_centro', t);
  end loop;
end $$;

-- 5.4 Superadministradores de la plataforma: la primera vez, los ADMIN actuales.
insert into plataforma_admins (user_id)
select p.user_id from perfiles p
where p.rol = 'ADMIN' and not exists (select 1 from plataforma_admins)
on conflict do nothing;

-- 6. Funciones de acceso -------------------------------------------------------------------------------
-- Centro del usuario autenticado (null si no tiene perfil activo o su centro está suspendido).
-- SECURITY DEFINER evita la recursión de RLS.
create or replace function centro_actual() returns uuid
language sql stable security definer set search_path = public as $$
  select p.centro_id from perfiles p join centros c on c.id = p.centro_id
  where p.user_id = auth.uid() and p.activo and c.activo
$$;

create or replace function rol_actual() returns text
language sql stable security definer set search_path = public as $$
  select p.rol from perfiles p join centros c on c.id = p.centro_id
  where p.user_id = auth.uid() and p.activo and c.activo
$$;

grant execute on function centro_actual() to authenticated;
grant execute on function rol_actual() to authenticated;

-- Las filas que crea el personal desde la app quedan en su centro automáticamente
do $$
declare t text;
begin
  foreach t in array array['pacientes','vacunas','citas_vacunacion','recordatorios','autorizaciones_log',
                           'campanas','campana_envios','carne_consultas','lotes'] loop
    execute format('alter table %I alter column centro_id set default centro_actual()', t);
  end loop;
end $$;

-- 7. Índices -------------------------------------------------------------------------------------------
-- Unicidad por centro: dos centros pueden tener el mismo paciente o el mismo nombre de vacuna
alter table pacientes drop constraint if exists pacientes_documento_identidad_key;
alter table vacunas drop constraint if exists vacunas_nombre_key;
create unique index if not exists idx_pacientes_centro_documento on pacientes (centro_id, documento_identidad);
create unique index if not exists idx_vacunas_centro_nombre on vacunas (centro_id, nombre);
create unique index if not exists idx_pacientes_carne_token on pacientes (carne_token);
create unique index if not exists idx_centros_whatsapp on centros (whatsapp_from) where whatsapp_from is not null;
create unique index if not exists idx_lotes_centro_vacuna_numero on lotes (centro_id, vacuna_id, numero_lote);

create index if not exists idx_citas_proxima on citas_vacunacion (fecha_proxima_dosis);
create index if not exists idx_citas_paciente on citas_vacunacion (paciente_id);
create index if not exists idx_citas_aplicada_por on citas_vacunacion (aplicada_por);
create index if not exists idx_citas_lote on citas_vacunacion (lote_id);
create index if not exists idx_recordatorios_estado_fecha on recordatorios (estado_envio, fecha_programada);
create index if not exists idx_recordatorios_conversacion on recordatorios (estado_envio, confirmacion, enviado_at desc);
create index if not exists idx_pacientes_telefono on pacientes (telefono);
create index if not exists idx_autorizaciones_paciente on autorizaciones_log (paciente_id, created_at desc);
create index if not exists idx_envios_campana on campana_envios (campana_id, estado);
create index if not exists idx_envios_telefono on campana_envios (telefono, estado, enviado_at desc);
create index if not exists idx_envios_cita on campana_envios (cita_id, enviado_at desc);
create index if not exists idx_carne_consultas_paciente on carne_consultas (paciente_id, created_at desc);
create index if not exists idx_lotes_vacuna_vence on lotes (centro_id, vacuna_id, fecha_vencimiento);
create index if not exists idx_movimientos_lote on inventario_movimientos (lote_id, created_at desc);
create index if not exists idx_movimientos_centro on inventario_movimientos (centro_id, created_at desc);

-- 8. Triggers y funciones de negocio ---------------------------------------------------------------------
-- 8.1 Recordatorio: se crea/actualiza 1 día antes de la próxima dosis y hereda el centro de la cita
create or replace function sync_recordatorio() returns trigger
language plpgsql as $$
begin
  if new.fecha_proxima_dosis is null or new.estado = 'CANCELADA' then
    delete from recordatorios where cita_id = new.id and estado_envio = 'PENDIENTE';
    return new;
  end if;

  insert into recordatorios (cita_id, fecha_programada, centro_id)
  values (new.id, new.fecha_proxima_dosis - 1, new.centro_id)
  on conflict (cita_id) do update
    set fecha_programada = excluded.fecha_programada
    where recordatorios.estado_envio = 'PENDIENTE';
  return new;
end $$;

drop trigger if exists trg_sync_recordatorio on citas_vacunacion;
create trigger trg_sync_recordatorio
after insert or update of fecha_proxima_dosis, estado on citas_vacunacion
for each row execute function sync_recordatorio();

-- 8.2 Autorización de mensajes: fecha automática y registro en el historial solo cuando cambia
create or replace function fechar_autorizacion() returns trigger
language plpgsql as $$
begin
  if tg_op = 'UPDATE' and new.autoriza_mensajes is not distinct from old.autoriza_mensajes then
    -- Sin cambio: conserva la fecha y el medio originales
    new.autorizacion_fecha := old.autorizacion_fecha;
    new.autorizacion_medio := old.autorizacion_medio;
  elsif new.autoriza_mensajes is not null then
    new.autorizacion_fecha := now();
  end if;
  return new;
end $$;

create or replace function registrar_autorizacion() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.autoriza_mensajes is not null
     and (tg_op = 'INSERT' or new.autoriza_mensajes is distinct from old.autoriza_mensajes) then
    insert into autorizaciones_log (paciente_id, estado, medio, usuario_id, centro_id)
    values (new.id, new.autoriza_mensajes, new.autorizacion_medio,
            (select user_id from perfiles where user_id = auth.uid()), new.centro_id);
  end if;
  return null;
end $$;

drop trigger if exists trg_registrar_autorizacion on pacientes;
drop trigger if exists trg_fechar_autorizacion on pacientes;
create trigger trg_fechar_autorizacion
before insert or update of autoriza_mensajes, autorizacion_medio on pacientes
for each row execute function fechar_autorizacion();
create trigger trg_registrar_autorizacion
after insert or update of autoriza_mensajes on pacientes
for each row execute function registrar_autorizacion();

-- 8.3 Inventario. Reglas que aplica la base de datos (no solo la pantalla):
--   * Una vacuna con lotes registrados en el centro solo se aplica indicando un lote vigente con existencias.
--   * Cada aplicación descuenta 1 dosis en la misma operación (sin carreras entre vacunadores).
--   * Las existencias solo cambian por entradas, aplicaciones, bajas o conteos, y todo queda en el kárdex.

-- Las existencias de un lote nuevo son la cantidad recibida y la entrada queda en el kárdex
create or replace function lote_nuevo() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    new.existencias := new.cantidad_inicial;
    return new;
  end if;
  return new;
end $$;

create or replace function lote_entrada() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into inventario_movimientos (centro_id, lote_id, tipo, cantidad, usuario_id)
  values (new.centro_id, new.id, 'ENTRADA', new.cantidad_inicial,
          (select user_id from perfiles where user_id = auth.uid()));
  return null;
end $$;

drop trigger if exists trg_lote_nuevo on lotes;
create trigger trg_lote_nuevo before insert on lotes for each row execute function lote_nuevo();
drop trigger if exists trg_lote_entrada on lotes;
create trigger trg_lote_entrada after insert on lotes for each row execute function lote_entrada();

-- Vacunación: exige lote cuando la vacuna lleva inventario y descuenta la dosis
create or replace function aplicar_lote() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_nombre text;
  v_lote lotes;
begin
  if tg_op = 'UPDATE' then
    if new.lote_id is distinct from old.lote_id then
      raise exception 'El lote de una vacunación registrada no se puede cambiar' using errcode = 'P0001';
    end if;
    return new;
  end if;

  -- Carga histórica desde Excel: dosis aplicadas antes de llevar el inventario en el sistema. No exigen lote ni
  -- descuentan existencias. Solo la activa importar_dosis_historicas (supabase/carga_historica.sql), con la llave de servicio.
  if new.lote_id is null and auth.uid() is null and current_setting('app.carga_historica', true) = '1' then
    return new;
  end if;

  -- Dosis aplicada en otro lugar: no sale del inventario del centro
  if new.externa then
    new.lote_id := null;
    return new;
  end if;

  if new.lote_id is null then
    if exists (select 1 from lotes where centro_id = new.centro_id and vacuna_id = new.vacuna_id) then
      select nombre into v_nombre from vacunas where id = new.vacuna_id;
      if exists (select 1 from lotes where centro_id = new.centro_id and vacuna_id = new.vacuna_id
                 and existencias > 0 and fecha_vencimiento >= new.fecha_aplicacion) then
        raise exception '% lleva inventario: selecciona el lote de la dosis aplicada', v_nombre using errcode = 'P0001';
      end if;
      raise exception 'No hay dosis disponibles de % en el inventario (sin existencias o lotes vencidos)', v_nombre using errcode = 'P0001';
    end if;
    return new;  -- vacuna sin inventario: se registra como siempre
  end if;

  -- Descuento atómico: solo si el lote es del centro, de esta vacuna, vigente y con existencias
  update lotes set existencias = existencias - 1
  where id = new.lote_id and centro_id = new.centro_id and vacuna_id = new.vacuna_id
    and existencias > 0 and fecha_vencimiento >= new.fecha_aplicacion
  returning * into v_lote;

  if v_lote.id is null then
    select * into v_lote from lotes where id = new.lote_id;
    if v_lote.id is null or v_lote.centro_id <> new.centro_id or v_lote.vacuna_id <> new.vacuna_id then
      raise exception 'El lote seleccionado no corresponde a esta vacuna' using errcode = 'P0001';
    elsif v_lote.fecha_vencimiento < new.fecha_aplicacion then
      raise exception 'El lote % está vencido (venció el %)', v_lote.numero_lote, to_char(v_lote.fecha_vencimiento, 'DD/MM/YYYY') using errcode = 'P0001';
    else
      raise exception 'El lote % no tiene dosis disponibles', v_lote.numero_lote using errcode = 'P0001';
    end if;
  end if;
  return new;
end $$;

create or replace function registrar_aplicacion() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' and new.lote_id is not null then
    insert into inventario_movimientos (centro_id, lote_id, tipo, cantidad, cita_id, usuario_id)
    values (new.centro_id, new.lote_id, 'APLICACION', -1, new.id, new.aplicada_por);
  elsif tg_op = 'DELETE' and old.lote_id is not null then
    -- Vacunación eliminada: la dosis vuelve al lote
    update lotes set existencias = existencias + 1 where id = old.lote_id;
    insert into inventario_movimientos (centro_id, lote_id, tipo, cantidad, detalle, usuario_id)
    values (old.centro_id, old.lote_id, 'ANULACION', 1, 'Vacunación eliminada',
            (select user_id from perfiles where user_id = auth.uid()));
  end if;
  return null;
end $$;

drop trigger if exists trg_aplicar_lote on citas_vacunacion;
create trigger trg_aplicar_lote before insert or update of lote_id on citas_vacunacion
for each row execute function aplicar_lote();
drop trigger if exists trg_registrar_aplicacion on citas_vacunacion;
create trigger trg_registrar_aplicacion after insert or delete on citas_vacunacion
for each row execute function registrar_aplicacion();

-- Bajas y conteos físicos (solo ADMIN)
create or replace function registrar_baja(p_lote uuid, p_cantidad int, p_motivo text, p_detalle text default null)
returns void language plpgsql security definer set search_path = public as $$
declare v_lote lotes;
begin
  if rol_actual() is distinct from 'ADMIN' then
    raise exception 'Solo un administrador puede registrar bajas' using errcode = 'P0001';
  end if;
  if p_cantidad is null or p_cantidad <= 0 then
    raise exception 'La cantidad debe ser mayor que cero' using errcode = 'P0001';
  end if;
  if p_motivo not in ('VENCIDA', 'ROTURA', 'CADENA_FRIO', 'FRASCO_ABIERTO', 'OTRO') then
    raise exception 'Motivo de baja inválido' using errcode = 'P0001';
  end if;
  update lotes set existencias = existencias - p_cantidad
  where id = p_lote and centro_id = centro_actual() and existencias >= p_cantidad
  returning * into v_lote;
  if v_lote.id is null then
    raise exception 'El lote no existe o no tiene % dosis disponibles', p_cantidad using errcode = 'P0001';
  end if;
  insert into inventario_movimientos (centro_id, lote_id, tipo, cantidad, motivo, detalle, usuario_id)
  values (v_lote.centro_id, v_lote.id, 'BAJA', -p_cantidad, p_motivo, nullif(trim(p_detalle), ''), auth.uid());
end $$;

create or replace function registrar_conteo(p_lote uuid, p_existencias int, p_detalle text default null)
returns void language plpgsql security definer set search_path = public as $$
declare v_antes int; v_lote lotes;
begin
  if rol_actual() is distinct from 'ADMIN' then
    raise exception 'Solo un administrador puede ajustar existencias' using errcode = 'P0001';
  end if;
  if p_existencias is null or p_existencias < 0 then
    raise exception 'Las existencias no pueden ser negativas' using errcode = 'P0001';
  end if;
  select existencias into v_antes from lotes where id = p_lote and centro_id = centro_actual() for update;
  if v_antes is null then
    raise exception 'Lote no encontrado' using errcode = 'P0001';
  end if;
  if v_antes = p_existencias then return; end if;
  update lotes set existencias = p_existencias where id = p_lote returning * into v_lote;
  insert into inventario_movimientos (centro_id, lote_id, tipo, cantidad, detalle, usuario_id)
  values (v_lote.centro_id, v_lote.id, 'CONTEO', p_existencias - v_antes,
          coalesce(nullif(trim(p_detalle), ''), 'Ajuste por conteo físico'), auth.uid());
end $$;

revoke execute on function registrar_baja(uuid, int, text, text) from public, anon;
revoke execute on function registrar_conteo(uuid, int, text) from public, anon;
grant execute on function registrar_baja(uuid, int, text, text) to authenticated;
grant execute on function registrar_conteo(uuid, int, text) to authenticated;

-- 9. Vista de dosis pendientes (última dosis de cada paciente/vacuna con próxima dosis) ---------------------
-- La app filtra fecha_proxima_dosis < hoy para obtener los atrasados.
create or replace view dosis_pendientes with (security_invoker = true) as
select
  u.cita_id, u.paciente_id, u.vacuna_id, u.numero_dosis, u.fecha_aplicacion, u.fecha_proxima_dosis,
  p.nombre_completo, p.documento_identidad, p.telefono, p.autoriza_mensajes,
  v.nombre as vacuna, v.dosis_totales,
  (select max(e.enviado_at) from campana_envios e where e.cita_id = u.cita_id) as ultimo_contacto,
  (select e.respuesta from campana_envios e
    where e.cita_id = u.cita_id and e.respuesta is not null
    order by e.respondido_at desc nulls last limit 1) as ultima_respuesta,
  u.centro_id
from (
  select distinct on (paciente_id, vacuna_id)
    id as cita_id, paciente_id, vacuna_id, numero_dosis, fecha_aplicacion, fecha_proxima_dosis, centro_id
  from citas_vacunacion
  where estado <> 'CANCELADA'
  order by paciente_id, vacuna_id, numero_dosis desc
) u
join pacientes p on p.id = u.paciente_id
join vacunas v on v.id = u.vacuna_id
where u.fecha_proxima_dosis is not null;

-- 10. Seguridad (RLS): cada centro solo ve y modifica lo suyo ------------------------------------------------
-- El service role (cron, rutas /api del servidor) ignora RLS.
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;

do $$
declare t text; p text;
begin
  foreach t in array array['centros','perfiles','pacientes','vacunas','citas_vacunacion','recordatorios',
                           'autorizaciones_log','campanas','campana_envios','carne_consultas',
                           'lotes','inventario_movimientos','plataforma_admins'] loop
    execute format('alter table %I enable row level security', t);
    for p in select policyname from pg_policies where schemaname = 'public' and tablename = t loop
      execute format('drop policy if exists %I on %I', p, t);
    end loop;
  end loop;
end $$;

-- Centro propio: lo ven sus usuarios; solo el ADMIN edita sus datos (no el estado ni el número de WhatsApp)
create policy "centros_select" on centros for select to authenticated using (id = centro_actual());
create policy "centros_update" on centros for update to authenticated
  using (id = centro_actual() and rol_actual() = 'ADMIN') with check (id = centro_actual() and rol_actual() = 'ADMIN');
revoke insert, update, delete on centros from anon, authenticated;
grant update (nombre, nit, telefono, email, direccion, ciudad, sitio_web, horario, logo_url, color,
              dias_atencion, cupos_por_dia, updated_at) on centros to authenticated;

-- Perfiles: cada uno ve el suyo; el ADMIN gestiona los de su centro
create policy "perfiles_select" on perfiles for select to authenticated
  using (user_id = auth.uid() or (rol_actual() = 'ADMIN' and centro_id = centro_actual()));
create policy "perfiles_admin" on perfiles for all to authenticated
  using (rol_actual() = 'ADMIN' and centro_id = centro_actual())
  with check (rol_actual() = 'ADMIN' and centro_id = centro_actual());

-- Lectura para todo el personal activo de su centro
do $$
declare t text;
begin
  foreach t in array array['pacientes','vacunas','citas_vacunacion','recordatorios',
                           'autorizaciones_log','campanas','campana_envios','carne_consultas','lotes'] loop
    execute format('create policy %I on %I for select to authenticated using (centro_id = centro_actual())',
                   t || '_select', t);
  end loop;
end $$;
create policy "movimientos_select" on inventario_movimientos for select to authenticated
  using (centro_id = centro_actual());

-- pacientes: el personal crea/edita; solo ADMIN elimina
create policy "pacientes_insert" on pacientes for insert to authenticated with check (centro_id = centro_actual());
create policy "pacientes_update" on pacientes for update to authenticated
  using (centro_id = centro_actual()) with check (centro_id = centro_actual());
create policy "pacientes_delete" on pacientes for delete to authenticated
  using (centro_id = centro_actual() and rol_actual() = 'ADMIN');

-- vacunas (catálogo): solo ADMIN modifica
create policy "vacunas_insert" on vacunas for insert to authenticated
  with check (centro_id = centro_actual() and rol_actual() = 'ADMIN');
create policy "vacunas_update" on vacunas for update to authenticated
  using (centro_id = centro_actual() and rol_actual() = 'ADMIN') with check (centro_id = centro_actual() and rol_actual() = 'ADMIN');
create policy "vacunas_delete" on vacunas for delete to authenticated
  using (centro_id = centro_actual() and rol_actual() = 'ADMIN');

-- citas_vacunacion: el personal registra; solo ADMIN elimina
create policy "citas_insert" on citas_vacunacion for insert to authenticated with check (centro_id = centro_actual());
create policy "citas_update" on citas_vacunacion for update to authenticated
  using (centro_id = centro_actual()) with check (centro_id = centro_actual());
create policy "citas_delete" on citas_vacunacion for delete to authenticated
  using (centro_id = centro_actual() and rol_actual() = 'ADMIN');

-- recordatorios: el personal los gestiona (el trigger y el reintento los modifican)
create policy "recordatorios_insert" on recordatorios for insert to authenticated with check (centro_id = centro_actual());
create policy "recordatorios_update" on recordatorios for update to authenticated
  using (centro_id = centro_actual()) with check (centro_id = centro_actual());
create policy "recordatorios_delete" on recordatorios for delete to authenticated using (centro_id = centro_actual());

-- autorizaciones_log, campanas, campana_envios, carne_consultas, inventario_movimientos:
-- el personal solo consulta; escribe el trigger o la app con el service role tras validar el rol ADMIN.

-- lotes: solo ADMIN gestiona; las existencias solo cambian por las funciones de arriba (nadie las edita a mano)
create policy "lotes_insert" on lotes for insert to authenticated
  with check (centro_id = centro_actual() and rol_actual() = 'ADMIN');
create policy "lotes_update" on lotes for update to authenticated
  using (centro_id = centro_actual() and rol_actual() = 'ADMIN') with check (centro_id = centro_actual() and rol_actual() = 'ADMIN');
-- Solo se puede borrar un lote cargado por error que nunca se usó
create policy "lotes_delete" on lotes for delete to authenticated
  using (centro_id = centro_actual() and rol_actual() = 'ADMIN' and existencias = cantidad_inicial
         and not exists (select 1 from citas_vacunacion c where c.lote_id = lotes.id));
revoke update on lotes from anon, authenticated;
grant update (numero_lote, laboratorio, fecha_vencimiento, costo_unitario) on lotes to authenticated;
revoke insert, update, delete on inventario_movimientos from anon, authenticated;

-- plataforma_admins: cada superadministrador ve su propia fila
create policy "plataforma_admins_self" on plataforma_admins for select to authenticated using (user_id = auth.uid());

grant select on dosis_pendientes to authenticated;

-- 11. Datos iniciales: vacunas de ejemplo para el primer centro (solo si el catálogo está vacío) --------------
insert into vacunas (centro_id, nombre, dosis_totales, intervalo_dias_recom_dosis, descripcion)
select (select id from centros order by created_at, id limit 1), v.*
from (values
  ('Hepatitis B', 3, 30, 'Esquema 0-1-6 meses'),
  ('Influenza', 1, null, 'Dosis anual'),
  ('COVID-19', 2, 28, 'Esquema primario de dos dosis'),
  ('Tétanos / Difteria (Td)', 3, 30, 'Refuerzo cada 10 años')
) as v(nombre, dosis_totales, intervalo_dias_recom_dosis, descripcion)
where not exists (select 1 from vacunas);

-- 12. Extras de Supabase: logos (Storage) y tiempo real (Realtime). En PostgreSQL puro se omiten. ---------------
do $$
begin
  -- Logos: bucket público "marca" (máx. 2 MB); cada centro sube a su propia carpeta <centro_id>/...
  if to_regclass('storage.buckets') is not null and to_regclass('storage.objects') is not null then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values ('marca', 'marca', true, 2097152, array['image/png', 'image/jpeg', 'image/webp'])
    on conflict (id) do nothing;

    drop policy if exists "marca_select" on storage.objects;
    drop policy if exists "marca_insert" on storage.objects;
    drop policy if exists "marca_update" on storage.objects;
    drop policy if exists "marca_delete" on storage.objects;
    create policy "marca_select" on storage.objects for select to authenticated using (bucket_id = 'marca');
    create policy "marca_insert" on storage.objects for insert to authenticated
      with check (bucket_id = 'marca' and rol_actual() = 'ADMIN' and (storage.foldername(name))[1] = centro_actual()::text);
    create policy "marca_update" on storage.objects for update to authenticated
      using (bucket_id = 'marca' and rol_actual() = 'ADMIN' and (storage.foldername(name))[1] = centro_actual()::text);
    create policy "marca_delete" on storage.objects for delete to authenticated
      using (bucket_id = 'marca' and rol_actual() = 'ADMIN' and (storage.foldername(name))[1] = centro_actual()::text);
  end if;

  -- Tiempo real para el monitor de recordatorios
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables
                     where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'recordatorios') then
    alter publication supabase_realtime add table recordatorios;
  end if;
end $$;

-- 13. Suscripciones de los centros (plan, vencimiento y pagos con Mercado Pago) ----------------------------
-- 1. Plan y vencimiento en cada centro ------------------------------------------------------------------
alter table centros add column if not exists plan text not null default 'PRUEBA';
alter table centros add column if not exists suscripcion_vence date;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'centros_plan_check') then
    alter table centros add constraint centros_plan_check check (plan in ('PRUEBA', 'BASICO', 'PRO', 'ENTERPRISE'));
  end if;
end $$;

-- Los centros que ya existen tienen 30 días para renovar; los nuevos empiezan con 6 días de prueba.
update centros set suscripcion_vence = current_date + 30 where suscripcion_vence is null;
alter table centros alter column suscripcion_vence set default (current_date + 6);
alter table centros alter column suscripcion_vence set not null;

-- 2. Pagos ----------------------------------------------------------------------------------------------
create table if not exists pagos_suscripcion (
  id uuid primary key default gen_random_uuid(),
  centro_id uuid not null references centros(id) on delete cascade,
  plan text not null check (plan in ('BASICO', 'PRO', 'ENTERPRISE')),
  meses int not null check (meses in (1, 12)),
  monto int not null check (monto > 0),                -- COP
  estado text not null default 'PENDIENTE' check (estado in ('PENDIENTE', 'APROBADO', 'RECHAZADO')),
  mp_payment_id text unique,                           -- id del pago en Mercado Pago
  creado_por uuid references auth.users(id) on delete set null,
  vence_antes date,                                    -- vencimiento antes y después de aplicar el pago
  vence_despues date,
  created_at timestamptz not null default now(),
  pagado_at timestamptz
);
create index if not exists pagos_suscripcion_centro_idx on pagos_suscripcion (centro_id, created_at desc);

-- El ADMIN ve los pagos de su centro; nadie los escribe desde el navegador (solo el servidor).
alter table pagos_suscripcion enable row level security;
drop policy if exists "pagos_suscripcion_select" on pagos_suscripcion;
create policy "pagos_suscripcion_select" on pagos_suscripcion for select to authenticated
  using (centro_id = centro_actual() and rol_actual() = 'ADMIN');
revoke insert, update, delete on pagos_suscripcion from anon, authenticated;
grant select on pagos_suscripcion to authenticated;

-- 3. Aplicar un pago aprobado ---------------------------------------------------------------------------
-- Extiende la suscripción desde el vencimiento actual (o desde hoy, si ya venció) y cambia el plan.
-- Bloquea las filas para que el webhook y el regreso desde Mercado Pago no lo apliquen dos veces.
-- p_hoy viene de la app (zona horaria de Colombia). Devuelve false si el pago ya estaba aplicado.
create or replace function aplicar_pago_suscripcion(p_pago uuid, p_payment_id text, p_hoy date)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  v_pago pagos_suscripcion;
  v_antes date;
  v_despues date;
begin
  select * into v_pago from pagos_suscripcion where id = p_pago for update;
  if not found or v_pago.estado = 'APROBADO' then
    return false;
  end if;

  select suscripcion_vence into v_antes from centros where id = v_pago.centro_id for update;
  v_despues := (greatest(v_antes, p_hoy) + make_interval(months => v_pago.meses))::date;

  update centros set plan = v_pago.plan, suscripcion_vence = v_despues, updated_at = now()
  where id = v_pago.centro_id;

  update pagos_suscripcion
  set estado = 'APROBADO', mp_payment_id = p_payment_id, pagado_at = now(),
      vence_antes = v_antes, vence_despues = v_despues
  where id = p_pago;
  return true;
end $$;

revoke execute on function aplicar_pago_suscripcion(uuid, text, date) from public, anon, authenticated;
grant execute on function aplicar_pago_suscripcion(uuid, text, date) to service_role;

-- 14. Estado real de entrega de los WhatsApp (id del mensaje de Twilio en cada recordatorio) -------------
alter table recordatorios add column if not exists whatsapp_sid text;
create index if not exists recordatorios_whatsapp_sid_idx on recordatorios (whatsapp_sid) where whatsapp_sid is not null;

-- Refresca la caché de esquema de la API de Supabase (en PostgreSQL puro no tiene efecto)
notify pgrst, 'reload schema';

-- Opcional, cuando confirmes que ya no la necesitas: la tabla de una sola fila que reemplazó "centros".
-- drop table if exists establecimiento;
