-- Carga histórica de dosis desde Excel (pantalla "Carga inicial").
-- Idempotente: se puede ejecutar varias veces. Requiere el esquema completo.
--
-- Problema que resuelve: si una vacuna ya tiene lotes en el inventario, la base exige elegir un lote para cada dosis
-- aplicada. Las dosis HISTÓRICAS (aplicadas antes de llevar el inventario en el sistema) no tienen lote y no deben
-- descontar existencias. importar_dosis_historicas las registra sin lote y sin tocar el inventario.
--
-- * Solo la puede ejecutar el servidor con la llave de servicio (la ruta /api/importar, que ya validó que quien
--   carga es ADMIN). Un usuario con sesión no puede usarla.
-- * El trigger aplicar_lote solo omite la regla del lote cuando no hay sesión de usuario y la función activó la marca
--   dentro de su propia transacción. Las vacunaciones normales siguen exigiendo lote.
-- * Este archivo repite la función aplicar_lote de vacunaapp_esquema_completo.sql con el mismo contenido: si vuelves a
--   ejecutar el esquema completo, queda igual.

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

-- Inserta dosis históricas ya validadas por la app. Devuelve cuántas se registraron.
-- Cada fila: paciente_id, vacuna_id, numero_dosis, fecha_aplicacion, fecha_proxima_dosis (puede ser null).
create or replace function importar_dosis_historicas(p_centro uuid, p_usuario uuid, p_filas jsonb) returns int
language plpgsql security definer set search_path = public as $$
declare v_n int;
begin
  perform set_config('app.carga_historica', '1', true);   -- solo dentro de esta transacción
  insert into citas_vacunacion (centro_id, paciente_id, vacuna_id, numero_dosis, fecha_aplicacion,
                                fecha_proxima_dosis, estado, aplicada_por, externa)
  select p_centro, (f->>'paciente_id')::uuid, (f->>'vacuna_id')::uuid, (f->>'numero_dosis')::int,
         (f->>'fecha_aplicacion')::date, nullif(f->>'fecha_proxima_dosis', '')::date, 'COMPLETADA', p_usuario, false
  from jsonb_array_elements(p_filas) f
  where exists (select 1 from pacientes where id = (f->>'paciente_id')::uuid and centro_id = p_centro)
    and exists (select 1 from vacunas where id = (f->>'vacuna_id')::uuid and centro_id = p_centro);
  get diagnostics v_n = row_count;
  return v_n;
end $$;

revoke all on function importar_dosis_historicas(uuid, uuid, jsonb) from public, anon, authenticated;
grant execute on function importar_dosis_historicas(uuid, uuid, jsonb) to service_role;

notify pgrst, 'reload schema';
