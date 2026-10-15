-- Suscripciones mensuales de los centros con pago en Mercado Pago. Idempotente: se puede ejecutar varias veces.
--
-- Cada centro tiene un plan y la fecha hasta la que está pagado (inclusive). El ADMIN del centro no puede
-- cambiarlos (no están en el GRANT UPDATE de centros): solo cambian con un pago aprobado, que aplica el
-- servidor con aplicar_pago_suscripcion, o desde /plataforma.

-- 1. Plan y vencimiento en cada centro ------------------------------------------------------------------
alter table centros add column if not exists plan text not null default 'PRUEBA';
alter table centros add column if not exists suscripcion_vence date;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'centros_plan_check') then
    alter table centros add constraint centros_plan_check check (plan in ('PRUEBA', 'BASICO', 'PRO', 'ENTERPRISE'));
  end if;
end $$;

-- Los centros que ya existen tienen 30 días para renovar; los nuevos empiezan con 6 días de prueba.
update centros set suscripcion_vence = current_date + 30 where suscripcion_vence is null;
alter table centros alter column suscripcion_vence set default (current_date + 6);
alter table centros alter column suscripcion_vence set not null;

-- 2. Pagos ----------------------------------------------------------------------------------------------
create table if not exists pagos_suscripcion (
  id uuid primary key default gen_random_uuid(),
  centro_id uuid not null references centros(id) on delete cascade,
  plan text not null check (plan in ('BASICO', 'PRO', 'ENTERPRISE')),
  meses int not null check (meses in (1, 12)),
  monto int not null check (monto > 0),                -- COP
  estado text not null default 'PENDIENTE' check (estado in ('PENDIENTE', 'APROBADO', 'RECHAZADO')),
  mp_payment_id text unique,                           -- id del pago en Mercado Pago
  creado_por uuid references auth.users(id) on delete set null,
  vence_antes date,                                    -- vencimiento antes y después de aplicar el pago
  vence_despues date,
  created_at timestamptz not null default now(),
  pagado_at timestamptz
);
create index if not exists pagos_suscripcion_centro_idx on pagos_suscripcion (centro_id, created_at desc);

-- El ADMIN ve los pagos de su centro; nadie los escribe desde el navegador (solo el servidor).
alter table pagos_suscripcion enable row level security;
drop policy if exists "pagos_suscripcion_select" on pagos_suscripcion;
create policy "pagos_suscripcion_select" on pagos_suscripcion for select to authenticated
  using (centro_id = centro_actual() and rol_actual() = 'ADMIN');
revoke insert, update, delete on pagos_suscripcion from anon, authenticated;
grant select on pagos_suscripcion to authenticated;

-- 3. Aplicar un pago aprobado ---------------------------------------------------------------------------
-- Extiende la suscripción desde el vencimiento actual (o desde hoy, si ya venció) y cambia el plan.
-- Bloquea las filas para que el webhook y el regreso desde Mercado Pago no lo apliquen dos veces.
-- p_hoy viene de la app (zona horaria de Colombia). Devuelve false si el pago ya estaba aplicado.
create or replace function aplicar_pago_suscripcion(p_pago uuid, p_payment_id text, p_hoy date)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  v_pago pagos_suscripcion;
  v_antes date;
  v_despues date;
begin
  select * into v_pago from pagos_suscripcion where id = p_pago for update;
  if not found or v_pago.estado = 'APROBADO' then
    return false;
  end if;

  select suscripcion_vence into v_antes from centros where id = v_pago.centro_id for update;
  v_despues := (greatest(v_antes, p_hoy) + make_interval(months => v_pago.meses))::date;

  update centros set plan = v_pago.plan, suscripcion_vence = v_despues, updated_at = now()
  where id = v_pago.centro_id;

  update pagos_suscripcion
  set estado = 'APROBADO', mp_payment_id = p_payment_id, pagado_at = now(),
      vence_antes = v_antes, vence_despues = v_despues
  where id = p_pago;
  return true;
end $$;

revoke execute on function aplicar_pago_suscripcion(uuid, text, date) from public, anon, authenticated;
grant execute on function aplicar_pago_suscripcion(uuid, text, date) to service_role;
