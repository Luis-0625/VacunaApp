-- Auditoría y anonimización de pacientes (Ley 1581 de 2012).
-- Idempotente: se puede ejecutar varias veces. Requiere el esquema completo (tablas, centro_actual() y rol_actual()).
--
-- AUDITORÍA: registro automático de quién creó, modificó o eliminó vacunaciones, pacientes y vacunas.
-- * Lo llenan triggers de la base de datos: ninguna ruta de la app puede saltárselo ni falsear al autor.
-- * Solo lo lee el ADMIN de cada centro; nadie lo modifica ni lo borra (ni siquiera con la llave de servicio),
--   salvo la función anonimizar_paciente (al final de este archivo).
-- * Una modificación guarda solo los campos que cambiaron (antes y después). Documento, teléfono, correo, fecha de
--   nacimiento y el enlace del carné nunca se guardan en el registro: solo queda constancia de que cambiaron.
-- * Lo hecho por procesos automáticos (respuestas de WhatsApp, cargas masivas) queda con origen SISTEMA.
--
-- ANONIMIZACIÓN: borra la identidad de un paciente (derecho de supresión) pero conserva sus dosis aplicadas, porque el
-- historial de vacunación debe conservarse. Ver anonimizar_paciente() al final.

create table if not exists auditoria (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  centro_id uuid,                         -- sin FK a propósito: el registro sobrevive aunque se elimine el centro
  tabla text not null check (tabla in ('citas_vacunacion', 'pacientes', 'vacunas')),
  registro_id uuid,
  accion text not null check (accion in ('CREAR', 'MODIFICAR', 'ELIMINAR', 'ANONIMIZAR')),
  paciente_id uuid,                       -- para consultar todo el historial de un paciente
  usuario_id uuid,
  usuario_nombre text,                    -- copia del nombre al momento del cambio
  origen text not null default 'USUARIO' check (origen in ('USUARIO', 'SISTEMA')),
  resumen text,
  antes jsonb,
  despues jsonb
);
-- Para bases donde la tabla se creó con una versión anterior de este archivo (sin la acción ANONIMIZAR)
alter table auditoria drop constraint if exists auditoria_accion_check;
alter table auditoria add constraint auditoria_accion_check
  check (accion in ('CREAR', 'MODIFICAR', 'ELIMINAR', 'ANONIMIZAR'));
create index if not exists idx_auditoria_centro_fecha on auditoria (centro_id, created_at desc);
create index if not exists idx_auditoria_paciente on auditoria (centro_id, paciente_id, created_at desc);

alter table auditoria enable row level security;
drop policy if exists "auditoria_admin_select" on auditoria;
create policy "auditoria_admin_select" on auditoria for select to authenticated
  using (centro_id = centro_actual() and rol_actual() = 'ADMIN');
revoke all on auditoria from anon, authenticated;
grant select on auditoria to authenticated;

-- Función única para las tres tablas
create or replace function auditar() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_new jsonb := case when tg_op <> 'DELETE' then to_jsonb(new) end;
  v_old jsonb := case when tg_op <> 'INSERT' then to_jsonb(old) end;
  v_fila jsonb := coalesce(v_new, v_old);
  v_uid uuid := auth.uid();
  v_actor uuid;
  v_sensibles text[] := array['documento_identidad', 'telefono', 'email', 'fecha_nacimiento', 'carne_token'];
  v_campo text;
  v_antes jsonb;
  v_despues jsonb;
  v_resumen text;
  v_paciente uuid;
  v_vacuna text;
  v_nombre text;
begin
  -- Autor: la sesión de quien hizo el cambio. Sin sesión (proceso automático) queda como SISTEMA; solo al CREAR una
  -- vacunación se conserva quién la aplicó (por ejemplo, en cargas masivas). Un cambio automático posterior no se le atribuye.
  v_actor := coalesce(v_uid, case when tg_op = 'INSERT' and tg_table_name = 'citas_vacunacion'
                                  then (v_fila->>'aplicada_por')::uuid end);

  if tg_table_name = 'citas_vacunacion' then
    v_paciente := (v_fila->>'paciente_id')::uuid;
    select nombre into v_vacuna from vacunas where id = (v_fila->>'vacuna_id')::uuid;
    select nombre_completo into v_nombre from pacientes where id = v_paciente;
    v_resumen := format('Dosis %s de %s%s', v_fila->>'numero_dosis', coalesce(v_vacuna, 'una vacuna'),
                        case when v_nombre is not null then ' · ' || v_nombre else '' end);
  elsif tg_table_name = 'pacientes' then
    v_paciente := (v_fila->>'id')::uuid;
    v_resumen := 'Paciente ' || coalesce(v_fila->>'nombre_completo', '');
  else
    v_resumen := 'Vacuna ' || coalesce(v_fila->>'nombre', '');
  end if;

  if tg_op = 'INSERT' then
    v_despues := v_new;
  elsif tg_op = 'DELETE' then
    v_antes := v_old;
  else
    -- Solo los campos que cambiaron
    select jsonb_object_agg(k, v_old->k), jsonb_object_agg(k, v_new->k)
      into v_antes, v_despues
    from jsonb_object_keys(v_new) as k
    where v_new->k is distinct from v_old->k and k <> 'updated_at';
    if v_antes is null then return null; end if;   -- no cambió nada que valga la pena registrar
  end if;

  -- Datos de contacto y el enlace secreto del carné no se guardan en el registro: solo queda constancia de que
  -- cambiaron (el nombre sí, para saber de quién se trata).
  if tg_table_name = 'pacientes' then
    if tg_op = 'UPDATE' then
      foreach v_campo in array v_sensibles loop
        if v_antes ? v_campo then
          v_antes := jsonb_set(v_antes, array[v_campo], '"(oculto)"');
          v_despues := jsonb_set(v_despues, array[v_campo], '"(oculto)"');
        end if;
      end loop;
    else
      v_antes := v_antes - v_sensibles;
      v_despues := v_despues - v_sensibles;
    end if;
  end if;

  insert into auditoria (centro_id, tabla, registro_id, accion, paciente_id, usuario_id, usuario_nombre, origen,
                         resumen, antes, despues)
  values (
    (v_fila->>'centro_id')::uuid, tg_table_name, (v_fila->>'id')::uuid,
    case tg_op when 'INSERT' then 'CREAR' when 'UPDATE' then 'MODIFICAR' else 'ELIMINAR' end,
    v_paciente,
    v_actor,
    (select nombre from perfiles where user_id = v_actor),
    case when v_uid is null then 'SISTEMA' else 'USUARIO' end,
    v_resumen, v_antes, v_despues
  );
  return null;
end $$;

drop trigger if exists trg_auditar on citas_vacunacion;
create trigger trg_auditar after insert or update or delete on citas_vacunacion
for each row execute function auditar();
drop trigger if exists trg_auditar on pacientes;
create trigger trg_auditar after insert or update or delete on pacientes
for each row execute function auditar();
drop trigger if exists trg_auditar on vacunas;
create trigger trg_auditar after insert or update or delete on vacunas
for each row execute function auditar();

-- Nadie edita ni borra el registro (tampoco con la llave de servicio). La anonimización de pacientes, cuando se
-- agregue, lo hará con una función propia que activa app.permitir_editar_auditoria solo dentro de su transacción.
create or replace function auditoria_inmutable() returns trigger
language plpgsql as $$
begin
  if current_setting('app.permitir_editar_auditoria', true) = '1' then
    return case when tg_op = 'DELETE' then old else new end;
  end if;
  raise exception 'El registro de auditoría no se puede modificar ni eliminar' using errcode = 'P0001';
end $$;

drop trigger if exists trg_auditoria_inmutable on auditoria;
create trigger trg_auditoria_inmutable before update or delete on auditoria
for each row execute function auditoria_inmutable();

-- ---------------------------------------------------------------------------------------------------------------
-- Anonimización de pacientes (Ley 1581 de 2012): derecho de supresión.
-- El historial de vacunación es parte de la historia clínica y debe conservarse, así que NO se borran las dosis: se
-- borra la identidad. Después de anonimizar, nadie (ni el centro) puede saber de quién eran.
-- ---------------------------------------------------------------------------------------------------------------
alter table pacientes add column if not exists anonimizado_at timestamptz;

create or replace function anonimizar_paciente(p_paciente uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_pac pacientes%rowtype;
  v_actor uuid := auth.uid();
  v_nombre_actor text;
begin
  if rol_actual() is distinct from 'ADMIN' then
    raise exception 'Solo un administrador puede anonimizar pacientes' using errcode = 'P0001';
  end if;
  select * into v_pac from pacientes where id = p_paciente and centro_id = centro_actual();
  if not found then
    raise exception 'Paciente no encontrado' using errcode = 'P0001';
  end if;
  if v_pac.anonimizado_at is not null then
    raise exception 'Este paciente ya fue anonimizado' using errcode = 'P0001';
  end if;
  select nombre into v_nombre_actor from perfiles where user_id = v_actor;

  -- 1. Datos personales. El documento queda como ANON-<id> (único por centro); el teléfono, como un número que no
  --    existe; nunca recibirá mensajes; y el enlace del carné se renueva, así que el anterior deja de funcionar.
  update pacientes set
    nombre_completo = 'Paciente anonimizado',
    documento_identidad = 'ANON-' || substr(replace(id::text, '-', ''), 1, 12),
    email = null,
    telefono = '+10000000000',
    fecha_nacimiento = null,
    autoriza_mensajes = 'NO_AUTORIZADO',
    autorizacion_medio = null,
    carne_token = nuevo_token_carne(),
    anonimizado_at = now()
  where id = p_paciente;

  -- 2. Otros rastros: mensajes de campañas, errores de envío (traen teléfonos) y recordatorios por enviar
  update campana_envios set telefono = '+10000000000', mensaje = '(anonimizado)', variables = '{}', error = null
  where paciente_id = p_paciente;
  update recordatorios set ultimo_error = null
  where cita_id in (select id from citas_vacunacion where paciente_id = p_paciente);
  delete from recordatorios
  where estado_envio = 'PENDIENTE' and cita_id in (select id from citas_vacunacion where paciente_id = p_paciente);

  -- 3. Auditoría: se borran los nombres y valores personales de sus registros. Los registros se conservan (quién, qué y
  --    cuándo), pero ya no dicen de quién. Es la única operación permitida sobre una tabla inmutable.
  perform set_config('app.permitir_editar_auditoria', '1', true);
  update auditoria set antes = null, despues = null, resumen = 'Paciente anonimizado'
  where paciente_id = p_paciente and tabla = 'pacientes';
  update auditoria set resumen = regexp_replace(resumen, ' · .*$', ' · Paciente anonimizado')
  where paciente_id = p_paciente and tabla = 'citas_vacunacion' and resumen like '% · %';
  perform set_config('app.permitir_editar_auditoria', '0', true);

  insert into auditoria (centro_id, tabla, registro_id, accion, paciente_id, usuario_id, usuario_nombre, origen, resumen)
  values (v_pac.centro_id, 'pacientes', p_paciente, 'ANONIMIZAR', p_paciente, v_actor, v_nombre_actor, 'USUARIO',
          'Paciente anonimizado a solicitud (derecho de supresión)');
end $$;

revoke all on function anonimizar_paciente(uuid) from public, anon;
grant execute on function anonimizar_paciente(uuid) to authenticated;

notify pgrst, 'reload schema';
