-- VacunaApp - pacientes atrasados y campañas por WhatsApp (ejecutar DESPUÉS de autorizacion.sql).
-- Se puede repetir.

-- 1. Campañas y envíos -------------------------------------------------------
create table if not exists campanas (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  mensaje text not null,                         -- introducción editable (con {nombre}, {vacuna}, …)
  creada_por uuid references perfiles(user_id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists campana_envios (
  id uuid primary key default gen_random_uuid(),
  campana_id uuid not null references campanas(id) on delete cascade,
  paciente_id uuid not null references pacientes(id) on delete cascade,
  cita_id uuid not null references citas_vacunacion(id) on delete cascade, -- última dosis aplicada
  telefono text not null,
  mensaje text not null,                         -- texto final enviado
  variables jsonb not null default '{}',         -- para plantillas aprobadas de WhatsApp
  estado text not null default 'PENDIENTE' check (estado in ('PENDIENTE', 'ENVIADO', 'FALLIDO')),
  error text,
  enviado_at timestamptz,
  -- Conversación: ELIGIENDO (escogiendo fecha), AGENDADA (paciente recuperado), YA_APLICADA (se vacunó en otro lugar)
  respuesta text check (respuesta in ('ELIGIENDO', 'AGENDADA', 'YA_APLICADA')),
  opciones_fecha date[],
  fecha_agendada date,
  respondido_at timestamptz,
  unique (campana_id, cita_id)
);
create index if not exists idx_envios_campana on campana_envios (campana_id, estado);
create index if not exists idx_envios_telefono on campana_envios (telefono, estado, enviado_at desc);
create index if not exists idx_envios_cita on campana_envios (cita_id, enviado_at desc);

-- 2. Última dosis de cada paciente/vacuna con la próxima dosis pendiente --------------------
-- La app filtra fecha_proxima_dosis < hoy para obtener los atrasados.
create or replace view dosis_pendientes with (security_invoker = true) as
select
  u.cita_id, u.paciente_id, u.vacuna_id, u.numero_dosis, u.fecha_aplicacion, u.fecha_proxima_dosis,
  p.nombre_completo, p.documento_identidad, p.telefono, p.autoriza_mensajes,
  v.nombre as vacuna, v.dosis_totales,
  (select max(e.enviado_at) from campana_envios e where e.cita_id = u.cita_id) as ultimo_contacto
from (
  select distinct on (paciente_id, vacuna_id)
    id as cita_id, paciente_id, vacuna_id, numero_dosis, fecha_aplicacion, fecha_proxima_dosis
  from citas_vacunacion
  where estado <> 'CANCELADA'
  order by paciente_id, vacuna_id, numero_dosis desc
) u
join pacientes p on p.id = u.paciente_id
join vacunas v on v.id = u.vacuna_id
where u.fecha_proxima_dosis is not null;

grant select on dosis_pendientes to authenticated;

-- 3. RLS: el personal consulta; la app escribe con el service role tras validar el rol ADMIN --
alter table campanas enable row level security;
alter table campana_envios enable row level security;
drop policy if exists "campanas_select" on campanas;
drop policy if exists "campana_envios_select" on campana_envios;
create policy "campanas_select" on campanas for select to authenticated using (rol_actual() is not null);
create policy "campana_envios_select" on campana_envios for select to authenticated using (rol_actual() is not null);

notify pgrst, 'reload schema';
