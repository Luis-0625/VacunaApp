-- VacunaApp - plataforma multi-centro (ejecutar DESPUÉS de todos los demás .sql). Se puede repetir.
-- Cada centro de vacunación ve y modifica solo sus datos. Los datos existentes pasan al primer centro.
-- Orden para una instalación nueva: schema, roles, confirmaciones, establecimiento, autorizacion,
-- campanas, carne, dosis_externas y por último este archivo.

-- 1. Centros (reemplaza a la tabla de una sola fila "establecimiento") ---------------------------
create table if not exists centros (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  nit text,
  telefono text,
  email text,
  direccion text,
  ciudad text,
  sitio_web text,
  horario text,
  logo_url text,
  color text not null default 'azul',
  dias_atencion int[] not null default '{1,2,3,4,5,6}',
  cupos_por_dia int not null default 0 check (cupos_por_dia >= 0),
  whatsapp_from text,            -- número propio de WhatsApp del centro (whatsapp:+57...); null = el de la plataforma
  activo boolean not null default true,  -- false = suspendido: sus usuarios pierden el acceso
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists idx_centros_whatsapp on centros (whatsapp_from) where whatsapp_from is not null;

-- Primer centro con los datos del establecimiento actual
insert into centros (nombre, nit, telefono, email, direccion, ciudad, sitio_web, horario, logo_url, color, dias_atencion, cupos_por_dia)
select e.nombre, e.nit, e.telefono, e.email, e.direccion, e.ciudad, e.sitio_web, e.horario, e.logo_url, e.color, e.dias_atencion, e.cupos_por_dia
from establecimiento e
where not exists (select 1 from centros);
insert into centros (nombre) select 'Mi centro de vacunación' where not exists (select 1 from centros);

-- 2. Columna centro_id en todas las tablas (los datos existentes van al primer centro) --------------
do $$
declare
  t text;
  primero uuid := (select id from centros order by created_at, id limit 1);
begin
  foreach t in array array['perfiles','pacientes','vacunas','citas_vacunacion','recordatorios',
                           'autorizaciones_log','campanas','campana_envios','carne_consultas'] loop
    execute format('alter table %I add column if not exists centro_id uuid references centros(id) on delete cascade', t);
    execute format('update %I set centro_id = %L where centro_id is null', t, primero);
    execute format('alter table %I alter column centro_id set not null', t);
    execute format('create index if not exists %I on %I (centro_id)', 'idx_' || t || '_centro', t);
  end loop;
end $$;

-- 3. Funciones de acceso ---------------------------------------------------------------------------
-- Centro del usuario autenticado (null si no tiene perfil activo o su centro está suspendido)
create or replace function centro_actual() returns uuid
language sql stable security definer set search_path = public as $$
  select p.centro_id from perfiles p join centros c on c.id = p.centro_id
  where p.user_id = auth.uid() and p.activo and c.activo
$$;
grant execute on function centro_actual() to authenticated;

create or replace function rol_actual() returns text
language sql stable security definer set search_path = public as $$
  select p.rol from perfiles p join centros c on c.id = p.centro_id
  where p.user_id = auth.uid() and p.activo and c.activo
$$;
grant execute on function rol_actual() to authenticated;

-- Las filas que crea el personal desde la app quedan en su centro automáticamente
do $$
declare t text;
begin
  foreach t in array array['pacientes','vacunas','citas_vacunacion','recordatorios','autorizaciones_log',
                           'campanas','campana_envios','carne_consultas'] loop
    execute format('alter table %I alter column centro_id set default centro_actual()', t);
  end loop;
end $$;

-- 4. Unicidad por centro (dos centros pueden tener el mismo paciente o el mismo nombre de vacuna) ----
alter table pacientes drop constraint if exists pacientes_documento_identidad_key;
create unique index if not exists idx_pacientes_centro_documento on pacientes (centro_id, documento_identidad);
alter table vacunas drop constraint if exists vacunas_nombre_key;
create unique index if not exists idx_vacunas_centro_nombre on vacunas (centro_id, nombre);

-- 5. Triggers: las filas que generan heredan el centro ----------------------------------------------
create or replace function sync_recordatorio() returns trigger
language plpgsql as $$
begin
  if new.fecha_proxima_dosis is null or new.estado = 'CANCELADA' then
    delete from recordatorios where cita_id = new.id and estado_envio = 'PENDIENTE';
    return new;
  end if;

  insert into recordatorios (cita_id, fecha_programada, centro_id)
  values (new.id, new.fecha_proxima_dosis - 1, new.centro_id)
  on conflict (cita_id) do update
    set fecha_programada = excluded.fecha_programada
    where recordatorios.estado_envio = 'PENDIENTE';
  return new;
end $$;

create or replace function registrar_autorizacion() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.autoriza_mensajes is not null
     and (tg_op = 'INSERT' or new.autoriza_mensajes is distinct from old.autoriza_mensajes) then
    insert into autorizaciones_log (paciente_id, estado, medio, usuario_id, centro_id)
    values (new.id, new.autoriza_mensajes, new.autorizacion_medio,
            (select user_id from perfiles where user_id = auth.uid()), new.centro_id);
  end if;
  return null;
end $$;

-- 6. Vista de dosis pendientes con el centro (columna nueva al final) --------------------------------
create or replace view dosis_pendientes with (security_invoker = true) as
select
  u.cita_id, u.paciente_id, u.vacuna_id, u.numero_dosis, u.fecha_aplicacion, u.fecha_proxima_dosis,
  p.nombre_completo, p.documento_identidad, p.telefono, p.autoriza_mensajes,
  v.nombre as vacuna, v.dosis_totales,
  (select max(e.enviado_at) from campana_envios e where e.cita_id = u.cita_id) as ultimo_contacto,
  (select e.respuesta from campana_envios e
    where e.cita_id = u.cita_id and e.respuesta is not null
    order by e.respondido_at desc nulls last limit 1) as ultima_respuesta,
  u.centro_id
from (
  select distinct on (paciente_id, vacuna_id)
    id as cita_id, paciente_id, vacuna_id, numero_dosis, fecha_aplicacion, fecha_proxima_dosis, centro_id
  from citas_vacunacion
  where estado <> 'CANCELADA'
  order by paciente_id, vacuna_id, numero_dosis desc
) u
join pacientes p on p.id = u.paciente_id
join vacunas v on v.id = u.vacuna_id
where u.fecha_proxima_dosis is not null;
grant select on dosis_pendientes to authenticated;

-- 7. Seguridad (RLS): cada centro solo ve y modifica lo suyo ----------------------------------------
do $$
declare t text; p text;
begin
  foreach t in array array['perfiles','pacientes','vacunas','citas_vacunacion','recordatorios',
                           'autorizaciones_log','campanas','campana_envios','carne_consultas','centros'] loop
    execute format('alter table %I enable row level security', t);
    for p in select policyname from pg_policies where schemaname = 'public' and tablename = t loop
      execute format('drop policy if exists %I on %I', p, t);
    end loop;
  end loop;
end $$;

-- Centro propio: lo ven sus usuarios; solo el ADMIN edita sus datos (no el estado ni el número de WhatsApp)
create policy "centros_select" on centros for select to authenticated using (id = centro_actual());
create policy "centros_update" on centros for update to authenticated
  using (id = centro_actual() and rol_actual() = 'ADMIN') with check (id = centro_actual() and rol_actual() = 'ADMIN');
revoke insert, update, delete on centros from anon, authenticated;
grant update (nombre, nit, telefono, email, direccion, ciudad, sitio_web, horario, logo_url, color,
              dias_atencion, cupos_por_dia, updated_at) on centros to authenticated;

-- Perfiles: cada uno ve el suyo; el ADMIN gestiona los de su centro
create policy "perfiles_select" on perfiles for select to authenticated
  using (user_id = auth.uid() or (rol_actual() = 'ADMIN' and centro_id = centro_actual()));
create policy "perfiles_admin" on perfiles for all to authenticated
  using (rol_actual() = 'ADMIN' and centro_id = centro_actual())
  with check (rol_actual() = 'ADMIN' and centro_id = centro_actual());

-- Lectura para todo el personal activo de su centro
do $$
declare t text;
begin
  foreach t in array array['pacientes','vacunas','citas_vacunacion','recordatorios',
                           'autorizaciones_log','campanas','campana_envios','carne_consultas'] loop
    execute format('create policy %I on %I for select to authenticated using (centro_id = centro_actual())',
                   t || '_select', t);
  end loop;
end $$;

-- pacientes: el personal crea/edita; solo ADMIN elimina
create policy "pacientes_insert" on pacientes for insert to authenticated with check (centro_id = centro_actual());
create policy "pacientes_update" on pacientes for update to authenticated
  using (centro_id = centro_actual()) with check (centro_id = centro_actual());
create policy "pacientes_delete" on pacientes for delete to authenticated
  using (centro_id = centro_actual() and rol_actual() = 'ADMIN');

-- vacunas (catálogo): solo ADMIN modifica
create policy "vacunas_insert" on vacunas for insert to authenticated
  with check (centro_id = centro_actual() and rol_actual() = 'ADMIN');
create policy "vacunas_update" on vacunas for update to authenticated
  using (centro_id = centro_actual() and rol_actual() = 'ADMIN') with check (centro_id = centro_actual() and rol_actual() = 'ADMIN');
create policy "vacunas_delete" on vacunas for delete to authenticated
  using (centro_id = centro_actual() and rol_actual() = 'ADMIN');

-- citas_vacunacion: el personal registra; solo ADMIN elimina
create policy "citas_insert" on citas_vacunacion for insert to authenticated with check (centro_id = centro_actual());
create policy "citas_update" on citas_vacunacion for update to authenticated
  using (centro_id = centro_actual()) with check (centro_id = centro_actual());
create policy "citas_delete" on citas_vacunacion for delete to authenticated
  using (centro_id = centro_actual() and rol_actual() = 'ADMIN');

-- recordatorios: el personal los gestiona
create policy "recordatorios_insert" on recordatorios for insert to authenticated with check (centro_id = centro_actual());
create policy "recordatorios_update" on recordatorios for update to authenticated
  using (centro_id = centro_actual()) with check (centro_id = centro_actual());
create policy "recordatorios_delete" on recordatorios for delete to authenticated using (centro_id = centro_actual());

-- 8. Logos: cada centro sube a su propia carpeta del bucket "marca" ---------------------------------
drop policy if exists "marca_select" on storage.objects;
drop policy if exists "marca_insert" on storage.objects;
drop policy if exists "marca_update" on storage.objects;
drop policy if exists "marca_delete" on storage.objects;
create policy "marca_select" on storage.objects for select to authenticated using (bucket_id = 'marca');
create policy "marca_insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'marca' and rol_actual() = 'ADMIN' and (storage.foldername(name))[1] = centro_actual()::text);
create policy "marca_update" on storage.objects for update to authenticated
  using (bucket_id = 'marca' and rol_actual() = 'ADMIN' and (storage.foldername(name))[1] = centro_actual()::text);
create policy "marca_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'marca' and rol_actual() = 'ADMIN' and (storage.foldername(name))[1] = centro_actual()::text);

-- 9. Superadministradores de la plataforma (crean y suspenden centros) ------------------------------
create table if not exists plataforma_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table plataforma_admins enable row level security;
drop policy if exists "plataforma_admins_self" on plataforma_admins;
create policy "plataforma_admins_self" on plataforma_admins for select to authenticated using (user_id = auth.uid());

-- Los ADMIN actuales del primer centro quedan como superadministradores (solo la primera vez)
insert into plataforma_admins (user_id)
select p.user_id from perfiles p where p.rol = 'ADMIN'
  and not exists (select 1 from plataforma_admins)
on conflict do nothing;

notify pgrst, 'reload schema';
