-- VacunaApp - dosis aplicadas en otro lugar (ejecutar DESPUÉS de campanas.sql). Se puede repetir.
-- Se registran a partir del carné físico del paciente: cuentan para el esquema (número de dosis y
-- próxima dosis) pero no como dosis aplicadas por el centro en los reportes, y el carné digital las
-- muestra como "no verificadas".

alter table citas_vacunacion
  add column if not exists externa boolean not null default false,
  add column if not exists lugar_externo text;

-- La vista de dosis pendientes suma la última respuesta del paciente a una campaña
-- (ej. YA_APLICADA: dijo que se vacunó en otro lugar y falta registrar esa dosis).
create or replace view dosis_pendientes with (security_invoker = true) as
select
  u.cita_id, u.paciente_id, u.vacuna_id, u.numero_dosis, u.fecha_aplicacion, u.fecha_proxima_dosis,
  p.nombre_completo, p.documento_identidad, p.telefono, p.autoriza_mensajes,
  v.nombre as vacuna, v.dosis_totales,
  (select max(e.enviado_at) from campana_envios e where e.cita_id = u.cita_id) as ultimo_contacto,
  (select e.respuesta from campana_envios e
    where e.cita_id = u.cita_id and e.respuesta is not null
    order by e.respondido_at desc nulls last limit 1) as ultima_respuesta
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

notify pgrst, 'reload schema';
