/**
 * Datos legales y de contacto de VacunaApp que se muestran en la página pública (footer, términos,
 * botón de WhatsApp). Meta y Twilio los revisan al aprobar la cuenta empresarial.
 * Los campos vacíos no se muestran.
 */
export const EMPRESA = {
  nombreComercial: "VacunaApp",
  razonSocial: "", // ej. "Luis Rivera Paternina" o "VacunaApp S.A.S."
  nit: "", // ej. "1.102.345.678-9"
  direccion: "", // ej. "Calle 25 # 20-30, Sincelejo, Sucre"
  ciudad: "Sincelejo, Sucre, Colombia",
  email: process.env.NEXT_PUBLIC_CONTACTO_PRIVACIDAD ?? "",
  /** WhatsApp de ventas y soporte, solo dígitos con indicativo (ej. "573001234567"). */
  whatsapp: "573206300392",
};

/**
 * Props de un enlace a ventas: chat de WhatsApp con el mensaje escrito (en otra pestaña), o correo
 * si no hay número, o el footer de contacto si tampoco hay correo. Uso: <a {...enlaceVentas("…")}>.
 */
export function enlaceVentas(mensaje: string): { href: string; target?: string; rel?: string } {
  if (EMPRESA.whatsapp) {
    return { href: `https://wa.me/${EMPRESA.whatsapp}?text=${encodeURIComponent(mensaje)}`, target: "_blank", rel: "noopener noreferrer" };
  }
  if (EMPRESA.email) return { href: `mailto:${EMPRESA.email}?subject=${encodeURIComponent(mensaje)}` };
  return { href: "#contacto" };
}

/** "573001234567" -> "+57 300 123 4567". */
export function telefonoLegible(digitos: string): string {
  const m = digitos.match(/^57(\d{3})(\d{3})(\d{4})$/);
  return m ? `+57 ${m[1]} ${m[2]} ${m[3]}` : `+${digitos}`;
}
