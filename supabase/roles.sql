-- VacunaApp - roles y permisos (ejecutar DESPUÉS de schema.sql). Se puede repetir sin problema.
--   ADMIN      : todo (catálogo de vacunas, usuarios, reportes, exportar/importar, eliminar).
--   VACUNADOR  : registrar vacunaciones, ver/crear/editar pacientes y ver recordatorios.

-- 1. Perfiles ----------------------------------------------------------------
create table if not exists perfiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  nombre text not null,
  rol text not null check (rol in ('ADMIN', 'VACUNADOR')),
  activo boolean not null default true,
  created_at timestamptz not null default now()
);

-- Quién aplicó cada dosis (para el control por vacunador)
alter table citas_vacunacion
  add column if not exists aplicada_por uuid references perfiles(user_id) on delete set null;
create index if not exists idx_citas_aplicada_por on citas_vacunacion (aplicada_por);

-- Rol del usuario autenticado (null si no tiene perfil activo). SECURITY DEFINER evita recursión de RLS.
create or replace function rol_actual() returns text
language sql stable security definer set search_path = public as $$
  select rol from perfiles where user_id = auth.uid() and activo
$$;
grant execute on function rol_actual() to authenticated;

-- Los usuarios que ya existen pasan a ADMIN (cambia el rol luego desde la app).
insert into perfiles (user_id, email, nombre, rol)
select id, email, coalesce(raw_user_meta_data->>'nombre', split_part(email, '@', 1)), 'ADMIN'
from auth.users
on conflict (user_id) do nothing;

-- 2. RLS ---------------------------------------------------------------------
alter table perfiles enable row level security;

drop policy if exists "perfiles_select" on perfiles;
drop policy if exists "perfiles_admin" on perfiles;
create policy "perfiles_select" on perfiles for select to authenticated
  using (user_id = auth.uid() or rol_actual() = 'ADMIN');
create policy "perfiles_admin" on perfiles for all to authenticated
  using (rol_actual() = 'ADMIN') with check (rol_actual() = 'ADMIN');

-- Se reemplazan las políticas genéricas de schema.sql por políticas por rol.
do $$
declare t text; p text;
begin
  foreach t in array array['pacientes','vacunas','citas_vacunacion','recordatorios'] loop
    for p in select policyname from pg_policies where schemaname = 'public' and tablename = t loop
      execute format('drop policy if exists %I on %I', p, t);
    end loop;
    -- Lectura: cualquier personal activo
    execute format('create policy "%s_select" on %I for select to authenticated using (rol_actual() is not null)', t, t);
  end loop;
end $$;

-- pacientes: el personal crea/edita; solo ADMIN elimina
create policy "pacientes_insert" on pacientes for insert to authenticated with check (rol_actual() is not null);
create policy "pacientes_update" on pacientes for update to authenticated using (rol_actual() is not null) with check (rol_actual() is not null);
create policy "pacientes_delete" on pacientes for delete to authenticated using (rol_actual() = 'ADMIN');

-- vacunas (catálogo): solo ADMIN modifica
create policy "vacunas_insert" on vacunas for insert to authenticated with check (rol_actual() = 'ADMIN');
create policy "vacunas_update" on vacunas for update to authenticated using (rol_actual() = 'ADMIN') with check (rol_actual() = 'ADMIN');
create policy "vacunas_delete" on vacunas for delete to authenticated using (rol_actual() = 'ADMIN');

-- citas_vacunacion: el personal registra; solo ADMIN elimina
create policy "citas_insert" on citas_vacunacion for insert to authenticated with check (rol_actual() is not null);
create policy "citas_update" on citas_vacunacion for update to authenticated using (rol_actual() is not null) with check (rol_actual() is not null);
create policy "citas_delete" on citas_vacunacion for delete to authenticated using (rol_actual() = 'ADMIN');

-- recordatorios: el personal los gestiona (el trigger y el reintento los modifican)
create policy "recordatorios_insert" on recordatorios for insert to authenticated with check (rol_actual() is not null);
create policy "recordatorios_update" on recordatorios for update to authenticated using (rol_actual() is not null) with check (rol_actual() is not null);
create policy "recordatorios_delete" on recordatorios for delete to authenticated using (rol_actual() is not null);

-- Refresca la caché de esquema de la API
notify pgrst, 'reload schema';
