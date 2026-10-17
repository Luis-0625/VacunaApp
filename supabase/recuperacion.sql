-- Recuperación de contraseña con código de 5 dígitos. Idempotente: se puede ejecutar varias veces.
--
-- Supabase solo genera códigos de 6 a 10 dígitos, así que la app crea y valida los suyos
-- (/api/auth/recuperar). Se guarda solo el hash del código, con vencimiento y contador de intentos.
-- Tras confirmar el código queda un token de un solo uso para cambiar la contraseña.
-- Solo la usa el servidor con la llave de servicio: RLS activo y sin políticas.
create table if not exists codigos_recuperacion (
  email text primary key,
  codigo_hash text,
  vence timestamptz not null,
  intentos int not null default 0,
  token_hash text,
  token_vence timestamptz,
  created_at timestamptz not null default now()
);
alter table codigos_recuperacion enable row level security;

-- Id del usuario de Auth con ese correo (o null). Solo para el servidor.
create or replace function usuario_id_por_email(p_email text) returns uuid
language sql stable security definer set search_path = public, auth as $$
  select id from auth.users where lower(email) = lower(p_email) limit 1;
$$;
revoke all on function usuario_id_por_email(text) from public, anon, authenticated;
grant execute on function usuario_id_por_email(text) to service_role;

notify pgrst, 'reload schema';

-- ---------------------------------------------------------------------------------------------------------------
-- Endurecimiento anti fuerza bruta. Todo atómico: no depende de leer y luego escribir desde la app.
-- ---------------------------------------------------------------------------------------------------------------
alter table codigos_recuperacion add column if not exists envios int not null default 0;
alter table codigos_recuperacion add column if not exists ventana timestamptz;

-- Suma 1 intento y devuelve el total. Solo cuenta si hay un código vigente por verificar.
create or replace function recuperacion_contar_intento(p_email text) returns int
language sql security definer set search_path = public as $$
  update codigos_recuperacion set intentos = intentos + 1
  where email = p_email and codigo_hash is not null
  returning intentos;
$$;

-- Reserva un envío si pasó la espera mínima y no se superó el máximo por hora. Devuelve si se puede enviar.
create or replace function recuperacion_reservar_envio(p_email text, p_espera_s int, p_max_hora int) returns boolean
language plpgsql security definer set search_path = public as $$
declare ok boolean;
begin
  insert into codigos_recuperacion as c (email, vence, envios, ventana, created_at)
  values (p_email, now(), 1, now(), now())
  on conflict (email) do update set
    envios = case when c.ventana is null or c.ventana < now() - interval '1 hour' then 1 else c.envios + 1 end,
    ventana = case when c.ventana is null or c.ventana < now() - interval '1 hour' then now() else c.ventana end,
    created_at = now()
  where c.created_at < now() - make_interval(secs => p_espera_s)
    and (c.ventana is null or c.ventana < now() - interval '1 hour' or c.envios < p_max_hora)
  returning true into ok;
  return coalesce(ok, false);
end $$;

-- Cierra todas las sesiones de un usuario (sus refresh tokens se borran en cascada).
create or replace function cerrar_sesiones_usuario(p_user_id uuid) returns void
language sql security definer set search_path = public, auth as $$
  delete from auth.sessions where user_id = p_user_id;
$$;

revoke all on function recuperacion_contar_intento(text) from public, anon, authenticated;
revoke all on function recuperacion_reservar_envio(text, int, int) from public, anon, authenticated;
revoke all on function cerrar_sesiones_usuario(uuid) from public, anon, authenticated;
grant execute on function recuperacion_contar_intento(text) to service_role;
grant execute on function recuperacion_reservar_envio(text, int, int) to service_role;
grant execute on function cerrar_sesiones_usuario(uuid) to service_role;

notify pgrst, 'reload schema';
