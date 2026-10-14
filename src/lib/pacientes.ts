import { toE164 } from "@/lib/phone";

export interface PacienteInput {
  nombre_completo: string;
  documento_identidad: string;
  email: string | null;
  telefono: string;
  fecha_nacimiento: string | null;
}

/** Valida y normaliza el cuerpo de una petición para crear/editar un paciente. */
export function parsePaciente(
  body: unknown,
  countryCode = process.env.DEFAULT_COUNTRY_CODE ?? "57"
): { ok: true; data: PacienteInput } | { ok: false; error: string } {
  const b = (body ?? {}) as Record<string, unknown>;
  const str = (v: unknown) => (v == null ? "" : String(v).trim());

  const nombre = str(b.nombre_completo);
  const doc = str(b.documento_identidad);
  const email = str(b.email).toLowerCase();
  const fecha = str(b.fecha_nacimiento);

  if (!nombre) return { ok: false, error: "El nombre es obligatorio" };
  if (!doc) return { ok: false, error: "El documento es obligatorio" };
  if (!str(b.telefono)) return { ok: false, error: "El teléfono es obligatorio" };

  const telefono = toE164(b.telefono, countryCode);
  if (!telefono) return { ok: false, error: "Teléfono inválido" };
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, error: "Email inválido" };
  if (fecha && !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return { ok: false, error: "Fecha de nacimiento inválida" };

  return {
    ok: true,
    data: {
      nombre_completo: nombre,
      documento_identidad: doc,
      email: email || null,
      telefono,
      fecha_nacimiento: fecha || null,
    },
  };
}

export const DUPLICATE_MSG = "Ya existe un paciente con ese documento";
