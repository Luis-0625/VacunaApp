const E164 = /^\+[1-9]\d{7,14}$/;

/**
 * Normaliza un teléfono a E.164. Devuelve null si no es válido.
 * - "+57 300 123 4567" -> "+573001234567"
 * - "0057300..."       -> "+57300..."
 * - "3001234567"       -> "+573001234567" (aplica el código de país por defecto)
 */
export function toE164(raw: unknown, defaultCountryCode = "57"): string | null {
  if (raw === null || raw === undefined) return null;
  const input = String(raw).trim();
  if (!input) return null;

  const hasPlus = input.startsWith("+");
  let digits = input.replace(/\D/g, "");
  if (!digits) return null;

  if (!hasPlus && digits.startsWith("00")) digits = digits.slice(2);
  else if (!hasPlus) {
    digits = digits.replace(/^0+/, "");
    // Número nacional sin código de país
    if (!digits.startsWith(defaultCountryCode) || digits.length <= 10) {
      digits = defaultCountryCode + digits;
    }
  }

  const result = `+${digits}`;
  return E164.test(result) ? result : null;
}

export const isE164 = (v: string) => E164.test(v);
