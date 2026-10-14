import { createClient } from "@supabase/supabase-js";

/** Cliente con service role (ignora RLS). SOLO servidor: cron y API routes. */
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}
