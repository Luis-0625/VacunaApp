-- Límite de peticiones (rate limit) sin servicios externos: un contador por clave y ventana de tiempo, en la base.
-- Lo usan las rutas públicas (/api/solicitud-prueba y la recuperación de contraseña) a través de src/lib/rate-limit.ts.
-- Idempotente: se puede ejecutar varias veces. Solo el servidor (service role) puede usarlo.
create table if not exists rate_limits (
  key text primary key,
  hits int not null default 0,
  window_start timestamptz not null default now()
);
alter table rate_limits enable row level security;  -- sin políticas: nadie con la llave pública puede leerla ni escribirla

-- Suma 1 petición a la clave y devuelve true si todavía está dentro del máximo de la ventana.
-- Atómico: peticiones simultáneas no se saltan el límite.
create or replace function rate_limit_hit(p_key text, p_window_s int, p_max int) returns boolean
language plpgsql security definer set search_path = public as $$
declare v_hits int;
begin
  insert into rate_limits as r (key, hits, window_start) values (p_key, 1, now())
  on conflict (key) do update set
    hits = case when r.window_start < now() - make_interval(secs => p_window_s) then 1 else r.hits + 1 end,
    window_start = case when r.window_start < now() - make_interval(secs => p_window_s) then now() else r.window_start end
  returning hits into v_hits;

  -- Limpieza ocasional de claves viejas, para que la tabla no crezca
  if random() < 0.01 then
    delete from rate_limits where window_start < now() - interval '1 day';
  end if;
  return v_hits <= p_max;
end $$;

revoke all on function rate_limit_hit(text, int, int) from public, anon, authenticated;
grant execute on function rate_limit_hit(text, int, int) to service_role;

notify pgrst, 'reload schema';
