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
