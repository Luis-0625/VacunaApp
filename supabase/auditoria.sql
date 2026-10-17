-- Auditoría: registro automático de quién creó, modificó o eliminó vacunaciones, pacientes y vacunas.
-- Idempotente: se puede ejecutar varias veces. Requiere el esquema completo (tablas, centro_actual() y rol_actual()).
--
-- * Lo llenan triggers de la base de datos: ninguna ruta de la app puede saltárselo ni falsear al autor.
-- * Solo lo lee el ADMIN de cada centro; nadie lo modifica ni lo borra (ni siquiera con la llave de servicio),
--   salvo la función de anonimización de pacientes (Ley 1581), que se agregará aparte.
-- * Una modificación guarda solo los campos que cambiaron (antes y después). El enlace secreto del carné nunca se guarda.
-- * Lo hecho por procesos automáticos (respuestas de WhatsApp, cargas masivas) queda con origen SISTEMA.

create table if not exists auditoria (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  centro_id uuid,                         -- sin FK a propósito: el registro sobrevive aunque se elimine el centro
  tabla text not null check (tabla in ('citas_vacunacion', 'pacientes', 'vacunas')),
  registro_id uuid,
  accion text not null check (accion in ('CREAR', 'MODIFICAR', 'ELIMINAR')),
  paciente_id uuid,                       -- para consultar todo el historial de un paciente
  usuario_id uuid,
  usuario_nombre text,                    -- copia del nombre al momento del cambio
  origen text not null default 'USUARIO' check (origen in ('USUARIO', 'SISTEMA')),
  resumen text,
  antes jsonb,
  despues jsonb
);
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

  -- El enlace secreto del carné no se guarda; solo queda constancia de que cambió
  if tg_table_name = 'pacientes' then
    if tg_op = 'UPDATE' then
      if v_antes ? 'carne_token' then
        v_antes := v_antes || '{"carne_token": "(oculto)"}'::jsonb;
        v_despues := v_despues || '{"carne_token": "(oculto)"}'::jsonb;
      end if;
    else
      v_antes := v_antes - 'carne_token';
      v_despues := v_despues - 'carne_token';
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

notify pgrst, 'reload schema';
