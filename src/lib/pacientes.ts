import { toE164 } from "@/lib/phone";
import type { AutorizaMensajes } from "@/types/db";

export interface PacienteInput {
  nombre_completo: string;
  documento_identidad: string;
  email: string | null;
  telefono: string;
  fecha_nacimiento: string | null;
  /** Solo se incluye si el personal registró una decisión (los pacientes antiguos pueden quedar sin registrar). */
  autoriza_mensajes?: AutorizaMensajes;
  autorizacion_medio?: "FORMULARIO";
}

/** "si", "sí", "x", "true", "1" -> AUTORIZADO; "no", "false", "0" -> NO_AUTORIZADO; vacío -> undefined. */
export function parseAutoriza(v: unknown): AutorizaMensajes | undefined | "invalid" {
  if (v === undefined || v === null || v === "") return undefined;
  if (v === true || v === "AUTORIZADO") return "AUTORIZADO";
  if (v === false || v === "NO_AUTORIZADO") return "NO_AUTORIZADO";
  const s = String(v).trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  if (["si", "s", "x", "true", "1", "autoriza", "autorizado"].includes(s)) return "AUTORIZADO";
  if (["no", "n", "false", "0", "no autoriza", "no autorizado"].includes(s)) return "NO_AUTORIZADO";
  return "invalid";
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
  const autoriza = parseAutoriza(b.autoriza_mensajes);
  if (autoriza === "invalid") return { ok: false, error: "Valor de autorización de mensajes inválido" };

  return {
    ok: true,
    data: {
      nombre_completo: nombre,
      documento_identidad: doc,
      email: email || null,
      telefono,
      fecha_nacimiento: fecha || null,
      ...(autoriza && { autoriza_mensajes: autoriza, autorizacion_medio: "FORMULARIO" as const }),
    },
  };
}

export const DUPLICATE_MSG = "Ya existe un paciente con ese documento";
