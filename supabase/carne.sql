-- VacunaApp - carné digital de vacunación con QR (ejecutar DESPUÉS de autorizacion.sql). Se puede repetir.
-- Cada paciente tiene un enlace secreto: /carne/<carne_token>. Generar un token nuevo invalida el anterior.

create extension if not exists "pgcrypto";

-- Token aleatorio de 20 caracteres, seguro para URL (120 bits)
create or replace function nuevo_token_carne() returns text
language sql volatile set search_path = public, extensions as $$
  select translate(encode(gen_random_bytes(15), 'base64'), '+/', '-_')
$$;

alter table pacientes add column if not exists carne_token text;
update pacientes set carne_token = nuevo_token_carne() where carne_token is null;
alter table pacientes alter column carne_token set default nuevo_token_carne();
alter table pacientes alter column carne_token set not null;
create unique index if not exists idx_pacientes_carne_token on pacientes (carne_token);

-- Registro de consultas del carné (cuántas veces y cuándo se abrió)
create table if not exists carne_consultas (
  id uuid primary key default gen_random_uuid(),
  paciente_id uuid not null references pacientes(id) on delete cascade,
  created_at timestamptz not null default now()
);
create index if not exists idx_carne_consultas_paciente on carne_consultas (paciente_id, created_at desc);

alter table carne_consultas enable row level security;
drop policy if exists "carne_consultas_select" on carne_consultas;
create policy "carne_consultas_select" on carne_consultas for select to authenticated
  using (rol_actual() is not null);

notify pgrst, 'reload schema';
