-- VacunaApp - confirmación y reprogramación por WhatsApp (ejecutar DESPUÉS de roles.sql). Se puede repetir.
--   confirmacion    : null = sin respuesta, CONFIRMADA, REPROGRAMANDO (eligiendo fecha), REPROGRAMADA
--   opciones_fecha  : fechas ofrecidas al paciente mientras elige (REPROGRAMANDO)
--   reprogramaciones: cuántas veces el paciente movió la cita por WhatsApp

alter table recordatorios
  add column if not exists confirmacion text
    check (confirmacion in ('CONFIRMADA', 'REPROGRAMANDO', 'REPROGRAMADA')),
  add column if not exists opciones_fecha date[],
  add column if not exists reprogramaciones int not null default 0,
  add column if not exists enviado_at timestamptz,
  add column if not exists respondido_at timestamptz;

-- Búsqueda de la conversación activa al llegar un mensaje
create index if not exists idx_recordatorios_conversacion
  on recordatorios (estado_envio, confirmacion, enviado_at desc);

-- Teléfono del paciente (para encontrar al remitente del WhatsApp)
create index if not exists idx_pacientes_telefono on pacientes (telefono);

notify pgrst, 'reload schema';
