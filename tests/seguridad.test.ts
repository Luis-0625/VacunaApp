import { createHmac } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { DIGITOS, generarCodigo, generarToken, hashSecreto, minutosDesdeAhora, mismoHash } from "@/lib/recuperacion";
import { firmaValida } from "@/lib/mercadopago";

beforeAll(() => { process.env.SUPABASE_SERVICE_ROLE_KEY = "llave-de-prueba"; });

describe("recuperación de contraseña", () => {
  it("el código tiene al menos 6 dígitos y conserva los ceros a la izquierda", () => {
    expect(DIGITOS).toBeGreaterThanOrEqual(6);
    for (let i = 0; i < 200; i++) expect(generarCodigo()).toMatch(new RegExp(`^\\d{${DIGITOS}}$`));
  });
  it("los tokens son largos y no se repiten", () => {
    const a = generarToken(), b = generarToken();
    expect(a.length).toBeGreaterThanOrEqual(40);
    expect(a).not.toBe(b);
  });
  it("el hash depende del correo y del valor, y se compara en tiempo constante", () => {
    const h = hashSecreto("a@x.com", "123456");
    expect(mismoHash(h, hashSecreto("a@x.com", "123456"))).toBe(true);
    expect(mismoHash(h, hashSecreto("a@x.com", "123457"))).toBe(false);
    expect(mismoHash(h, hashSecreto("b@x.com", "123456"))).toBe(false);
    expect(mismoHash(null, h)).toBe(false);
  });
  it("el vencimiento queda en el futuro", () => {
    expect(new Date(minutosDesdeAhora(15)).getTime()).toBeGreaterThan(Date.now() + 14 * 60_000);
  });
});

describe("firma de Mercado Pago", () => {
  const secreto = "secreto-mp";
  const firmar = (id: string, reqId: string, ts: string) =>
    createHmac("sha256", secreto).update(`id:${id.toLowerCase()};request-id:${reqId};ts:${ts};`).digest("hex");

  it("acepta una firma correcta y rechaza una alterada o ausente", () => {
    process.env.MERCADOPAGO_WEBHOOK_SECRET = secreto;
    const ts = "1700000000";
    const bueno = new Headers({ "x-request-id": "r1", "x-signature": `ts=${ts},v1=${firmar("ABC", "r1", ts)}` });
    expect(firmaValida(bueno, "ABC")).toBe(true);
    expect(firmaValida(bueno, "OTRO")).toBe(false);
    expect(firmaValida(new Headers({ "x-request-id": "r1", "x-signature": `ts=${ts},v1=${"0".repeat(64)}` }), "ABC")).toBe(false);
    expect(firmaValida(new Headers(), "ABC")).toBe(false);
  });
  it("sin secreto configurado no valida (el pago se consulta igual a Mercado Pago)", () => {
    delete process.env.MERCADOPAGO_WEBHOOK_SECRET;
    expect(firmaValida(new Headers(), "ABC")).toBe(true);
  });
});
