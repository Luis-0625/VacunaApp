import { describe, expect, it } from "vitest";
import { isE164, toE164 } from "@/lib/phone";

describe("toE164", () => {
  it("agrega el código de país a un celular nacional", () => {
    expect(toE164("3001234567")).toBe("+573001234567");
    expect(toE164("300 123 4567")).toBe("+573001234567");
  });
  it("respeta números que ya traen código de país", () => {
    expect(toE164("+57 300 123 4567")).toBe("+573001234567");
    expect(toE164("573001234567")).toBe("+573001234567");
    expect(toE164("+1 415 555 2671")).toBe("+14155552671");
  });
  it("convierte el prefijo 00", () => {
    expect(toE164("0057 300 123 4567")).toBe("+573001234567");
  });
  it("rechaza vacíos y basura", () => {
    for (const v of [null, undefined, "", "   ", "abc", "123"]) expect(toE164(v)).toBeNull();
  });
  it("usa el código de país indicado", () => {
    expect(toE164("5512345678", "52")).toBe("+525512345678");
  });
  it("isE164 valida el formato final", () => {
    expect(isE164("+573001234567")).toBe(true);
    expect(isE164("3001234567")).toBe(false);
  });
});
