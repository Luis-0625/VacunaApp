-- VacunaApp - esquema PostgreSQL (ejecutar en el Editor SQL de Supabase)

create extension if not exists "pgcrypto";

-- Tipos enumerados ---------------------------------------------------------
do $$ begin
  create type estado_cita as enum ('PENDIENTE', 'COMPLETADA', 'CANCELADA');
exception when duplicate_object then null; end $$;

do $$ begin
  create type estado_envio as enum ('PENDIENTE', 'ENVIADO', 'FALLIDO');
exception when duplicate_object then null; end $$;

do $$ begin
  create type canal_envio as enum ('EMAIL', 'WHATSAPP', 'AMBOS');
exception when duplicate_object then null; end $$;

-- Tablas -------------------------------------------------------------------
create table if not exists pacientes (
  id uuid primary key default gen_random_uuid(),
  nombre_completo text not null,
  documento_identidad text not null unique,
  email text,
  telefono text not null check (telefono ~ '^\+[1-9][0-9]{7,14}$'),  -- E.164
  fecha_nacimiento date,
  created_at timestamptz not null default now()
);

create table if not exists vacunas (
  id uuid primary key default gen_random_uuid(),
  nombre text not null unique,
  dosis_totales int not null default 1 check (dosis_totales > 0),
  intervalo_dias_recom_dosis int check (intervalo_dias_recom_dosis > 0),
  descripcion text
);

create table if not exists citas_vacunacion (
  id uuid primary key default gen_random_uuid(),
  paciente_id uuid not null references pacientes(id) on delete cascade,
  vacuna_id uuid not null references vacunas(id),
  numero_dosis int not null default 1 check (numero_dosis > 0),
  fecha_aplicacion date not null,
  fecha_proxima_dosis date,
  estado estado_cita not null default 'PENDIENTE'
);

create table if not exists recordatorios (
  id uuid primary key default gen_random_uuid(),
  cita_id uuid not null unique references citas_vacunacion(id) on delete cascade,
  estado_envio estado_envio not null default 'PENDIENTE',
  canal canal_envio not null default 'AMBOS',
  fecha_programada date not null,
  intentos int not null default 0,
  ultimo_error text
);

-- Índices ------------------------------------------------------------------
create index if not exists idx_citas_proxima on citas_vacunacion (fecha_proxima_dosis);
create index if not exists idx_citas_paciente on citas_vacunacion (paciente_id);
create index if not exists idx_recordatorios_estado_fecha on recordatorios (estado_envio, fecha_programada);

-- Trigger: crea/actualiza el recordatorio (1 día antes de la próxima dosis) -
create or replace function sync_recordatorio() returns trigger
language plpgsql as $$
begin
  if new.fecha_proxima_dosis is null or new.estado = 'CANCELADA' then
    delete from recordatorios where cita_id = new.id and estado_envio = 'PENDIENTE';
    return new;
  end if;

  insert into recordatorios (cita_id, fecha_programada)
  values (new.id, new.fecha_proxima_dosis - 1)
  on conflict (cita_id) do update
    set fecha_programada = excluded.fecha_programada
    where recordatorios.estado_envio = 'PENDIENTE';
  return new;
end $$;

drop trigger if exists trg_sync_recordatorio on citas_vacunacion;
create trigger trg_sync_recordatorio
after insert or update of fecha_proxima_dosis, estado on citas_vacunacion
for each row execute function sync_recordatorio();

-- Row Level Security -------------------------------------------------------
-- El personal autenticado accede a todo; el service role (cron/API) ignora RLS.
alter table pacientes enable row level security;
alter table vacunas enable row level security;
alter table citas_vacunacion enable row level security;
alter table recordatorios enable row level security;

do $$
declare t text;
begin
  foreach t in array array['pacientes','vacunas','citas_vacunacion','recordatorios'] loop
    execute format('drop policy if exists "staff_all" on %I', t);
    execute format(
      'create policy "staff_all" on %I for all to authenticated using (true) with check (true)', t);
  end loop;
end $$;

-- Datos semilla ------------------------------------------------------------
insert into vacunas (nombre, dosis_totales, intervalo_dias_recom_dosis, descripcion) values
  ('Hepatitis B', 3, 30, 'Esquema 0-1-6 meses'),
  ('Influenza', 1, null, 'Dosis anual'),
  ('COVID-19', 2, 28, 'Esquema primario de dos dosis'),
  ('Tétanos / Difteria (Td)', 3, 30, 'Refuerzo cada 10 años')
on conflict (nombre) do nothing;

-- Realtime para el monitor de recordatorios ---------------------------------
do $$ begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'recordatorios'
  ) then
    alter publication supabase_realtime add table recordatorios;
  end if;
end $$;
