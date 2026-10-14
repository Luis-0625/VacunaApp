-- VacunaApp - datos y marca del establecimiento (ejecutar DESPUÉS de roles.sql). Se puede repetir.
-- Una sola fila: cada centro de vacunación tiene su propia instalación.

create table if not exists establecimiento (
  id boolean primary key default true check (id),
  nombre text not null default 'Mi centro de vacunación',
  nit text,
  telefono text,
  email text,
  direccion text,
  ciudad text,
  sitio_web text,
  horario text,
  logo_url text,
  color text not null default 'azul',
  dias_atencion int[] not null default '{1,2,3,4,5,6}',   -- 0 = domingo … 6 = sábado
  cupos_por_dia int not null default 0 check (cupos_por_dia >= 0), -- 0 = sin límite
  updated_at timestamptz not null default now()
);

insert into establecimiento (id) values (true) on conflict (id) do nothing;

-- RLS: nombre, logo y color son públicos (se muestran en el login); solo ADMIN modifica.
alter table establecimiento enable row level security;
drop policy if exists "establecimiento_select" on establecimiento;
drop policy if exists "establecimiento_update" on establecimiento;
create policy "establecimiento_select" on establecimiento for select to anon, authenticated using (true);
create policy "establecimiento_update" on establecimiento for update to authenticated
  using (rol_actual() = 'ADMIN') with check (rol_actual() = 'ADMIN');

-- Almacenamiento del logo (bucket público, máx. 2 MB) ---------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('marca', 'marca', true, 2097152, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do nothing;

drop policy if exists "marca_select" on storage.objects;
drop policy if exists "marca_insert" on storage.objects;
drop policy if exists "marca_update" on storage.objects;
drop policy if exists "marca_delete" on storage.objects;
create policy "marca_select" on storage.objects for select to authenticated using (bucket_id = 'marca');
create policy "marca_insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'marca' and rol_actual() = 'ADMIN');
create policy "marca_update" on storage.objects for update to authenticated
  using (bucket_id = 'marca' and rol_actual() = 'ADMIN');
create policy "marca_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'marca' and rol_actual() = 'ADMIN');

notify pgrst, 'reload schema';
