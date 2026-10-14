import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

/** Next 16: el antiguo middleware se llama "proxy". Refresca la sesión y protege /dashboard. */
export function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  // /api/cron se autentica con CRON_SECRET; las demás rutas API validan sesión por sí mismas.
  matcher: ["/dashboard/:path*", "/plataforma/:path*"],
};
