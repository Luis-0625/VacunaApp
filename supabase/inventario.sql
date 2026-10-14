-- VacunaApp - inventario de vacunas por lote y vencimiento (ejecutar DESPUÉS de multicentro.sql).
-- Se puede repetir.
-- Reglas (las aplica la base de datos, no solo la pantalla):
--   * Una vacuna con lotes registrados en el centro solo se aplica indicando un lote vigente con existencias.
--   * Cada aplicación descuenta 1 dosis en la misma operación (sin carreras entre vacunadores).
--   * Las existencias solo cambian por entradas, aplicaciones, bajas o conteos, y todo queda en el kárdex.

-- 1. Tablas -------------------------------------------------------------------------------------
create table if not exists lotes (
  id uuid primary key default gen_random_uuid(),
  centro_id uuid not null default centro_actual() references centros(id) on delete cascade,
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
create unique index if not exists idx_lotes_centro_vacuna_numero on lotes (centro_id, vacuna_id, numero_lote);
create index if not exists idx_lotes_vacuna_vence on lotes (centro_id, vacuna_id, fecha_vencimiento);

-- Kárdex: cantidad positiva = entra, negativa = sale
create table if not exists inventario_movimientos (
  id uuid primary key default gen_random_uuid(),
  centro_id uuid not null references centros(id) on delete cascade,
  lote_id uuid not null references lotes(id) on delete cascade,
  tipo text not null check (tipo in ('ENTRADA', 'APLICACION', 'BAJA', 'CONTEO', 'ANULACION')),
  cantidad int not null,
  motivo text,          -- BAJA: VENCIDA, ROTURA, CADENA_FRIO, FRASCO_ABIERTO, OTRO
  detalle text,
  cita_id uuid references citas_vacunacion(id) on delete set null,
  usuario_id uuid references perfiles(user_id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists idx_movimientos_lote on inventario_movimientos (lote_id, created_at desc);
create index if not exists idx_movimientos_centro on inventario_movimientos (centro_id, created_at desc);

alter table vacunas add column if not exists stock_minimo int not null default 0 check (stock_minimo >= 0);
alter table citas_vacunacion add column if not exists lote_id uuid references lotes(id) on delete restrict;
create index if not exists idx_citas_lote on citas_vacunacion (lote_id);

-- 2. Lotes: las existencias empiezan en la cantidad recibida y la entrada queda en el kárdex ------------
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

-- 3. Vacunación: exige lote cuando la vacuna lleva inventario y descuenta la dosis -------------------
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

-- 4. Bajas y conteos físicos (solo ADMIN) ---------------------------------------------------------
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

-- 5. Seguridad (RLS) -------------------------------------------------------------------------------
alter table lotes enable row level security;
alter table inventario_movimientos enable row level security;
drop policy if exists "lotes_select" on lotes;
drop policy if exists "lotes_insert" on lotes;
drop policy if exists "lotes_update" on lotes;
drop policy if exists "lotes_delete" on lotes;
drop policy if exists "movimientos_select" on inventario_movimientos;

create policy "lotes_select" on lotes for select to authenticated using (centro_id = centro_actual());
create policy "lotes_insert" on lotes for insert to authenticated
  with check (centro_id = centro_actual() and rol_actual() = 'ADMIN');
create policy "lotes_update" on lotes for update to authenticated
  using (centro_id = centro_actual() and rol_actual() = 'ADMIN') with check (centro_id = centro_actual() and rol_actual() = 'ADMIN');
-- Solo se puede borrar un lote cargado por error que nunca se usó
create policy "lotes_delete" on lotes for delete to authenticated
  using (centro_id = centro_actual() and rol_actual() = 'ADMIN' and existencias = cantidad_inicial
         and not exists (select 1 from citas_vacunacion c where c.lote_id = lotes.id));
create policy "movimientos_select" on inventario_movimientos for select to authenticated using (centro_id = centro_actual());

-- Las existencias solo cambian por las funciones de arriba (nadie las edita a mano)
revoke update on lotes from anon, authenticated;
grant update (numero_lote, laboratorio, fecha_vencimiento, costo_unitario) on lotes to authenticated;
revoke insert, update, delete on inventario_movimientos from anon, authenticated;

notify pgrst, 'reload schema';
