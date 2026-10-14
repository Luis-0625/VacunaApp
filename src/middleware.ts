import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export function middleware(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  // /api/cron se autentica con CRON_SECRET; las demás rutas API validan sesión por sí mismas.
  matcher: ["/dashboard/:path*"],
};
