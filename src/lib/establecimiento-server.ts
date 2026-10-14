import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { ESTABLECIMIENTO_DEFAULT, getEstablecimiento, type Establecimiento } from "@/lib/establecimiento";

/** Establecimiento para Server Components (una consulta por petición). */
export const getEstablecimientoActual = cache(async (): Promise<Establecimiento> => {
  try {
    return await getEstablecimiento(createClient());
  } catch {
    return ESTABLECIMIENTO_DEFAULT;
  }
});
