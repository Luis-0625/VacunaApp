-- VacunaApp - autorización de mensajes del paciente, Ley 1581 de 2012 (ejecutar DESPUÉS de roles.sql).
-- Se puede repetir.
--   autoriza_mensajes : null = sin registrar (pacientes anteriores), AUTORIZADO, NO_AUTORIZADO
--   autorizacion_medio: FORMULARIO (personal), WHATSAPP (el paciente respondió SALIR/ALTA), IMPORTACION (Excel)
-- Cada cambio queda en autorizaciones_log como evidencia (quién, cuándo, por qué medio).

alter table pacientes
  add column if not exists autoriza_mensajes text check (autoriza_mensajes in ('AUTORIZADO', 'NO_AUTORIZADO')),
  add column if not exists autorizacion_fecha timestamptz,
  add column if not exists autorizacion_medio text check (autorizacion_medio in ('FORMULARIO', 'WHATSAPP', 'IMPORTACION'));

create table if not exists autorizaciones_log (
  id uuid primary key default gen_random_uuid(),
  paciente_id uuid not null references pacientes(id) on delete cascade,
  estado text not null check (estado in ('AUTORIZADO', 'NO_AUTORIZADO')),
  medio text,
  usuario_id uuid references perfiles(user_id) on delete set null, -- null = el propio paciente / sistema
  created_at timestamptz not null default now()
);
create index if not exists idx_autorizaciones_paciente on autorizaciones_log (paciente_id, created_at desc);

-- Triggers: fecha automática y registro en el historial solo cuando la autorización cambia ---
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
    insert into autorizaciones_log (paciente_id, estado, medio, usuario_id)
    values (new.id, new.autoriza_mensajes, new.autorizacion_medio,
            (select user_id from perfiles where user_id = auth.uid()));
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

-- RLS: el personal consulta el historial; solo el trigger escribe en él ---------------------
alter table autorizaciones_log enable row level security;
drop policy if exists "autorizaciones_select" on autorizaciones_log;
create policy "autorizaciones_select" on autorizaciones_log for select to authenticated
  using (rol_actual() is not null);

-- Búsqueda por teléfono al recibir SALIR/ALTA por WhatsApp
create index if not exists idx_pacientes_telefono on pacientes (telefono);

notify pgrst, 'reload schema';
