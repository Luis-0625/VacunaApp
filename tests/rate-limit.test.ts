import { describe, expect, it, vi } from "vitest";
import { ipDe, limitarPorIp, permitir } from "@/lib/rate-limit";

/** Base falsa con un contador como el de la función SQL rate_limit_hit. */
function dbContador() {
  const hits = new Map<string, number>();
  const llamadas: string[] = [];
  const db = {
    rpc: async (_f: string, a: { p_key: string; p_max: number }) => {
      llamadas.push(a.p_key);
      const n = (hits.get(a.p_key) ?? 0) + 1;
      hits.set(a.p_key, n);
      return { data: n <= a.p_max, error: null };
    },
  } as any;
  return { db, llamadas };
}

describe("ipDe", () => {
  it("toma la primera IP de x-forwarded-for", () => {
    expect(ipDe(new Headers({ "x-forwarded-for": "203.0.113.7, 10.0.0.1" }))).toBe("203.0.113.7");
  });
  it("usa x-real-ip y, si no hay nada, 'desconocida'", () => {
    expect(ipDe(new Headers({ "x-real-ip": "198.51.100.2" }))).toBe("198.51.100.2");
    expect(ipDe(new Headers())).toBe("desconocida");
  });
});

describe("limitarPorIp", () => {
  it("deja pasar hasta el máximo y luego responde 429 con Retry-After", async () => {
    const { db } = dbContador();
    const h = new Headers({ "x-forwarded-for": "203.0.113.7" });
    for (let i = 0; i < 3; i++) expect(await limitarPorIp(db, h, "ruta", 3600, 3)).toBeNull();
    const r = await limitarPorIp(db, h, "ruta", 3600, 3);
    expect(r?.status).toBe(429);
    expect(r?.headers.get("Retry-After")).toBe("3600");
  });
  it("cada IP y cada ruta tienen su propio contador", async () => {
    const { db } = dbContador();
    const a = new Headers({ "x-forwarded-for": "203.0.113.7" });
    const b = new Headers({ "x-forwarded-for": "203.0.113.8" });
    await limitarPorIp(db, a, "ruta", 60, 1);
    expect((await limitarPorIp(db, a, "ruta", 60, 1))?.status).toBe(429);
    expect(await limitarPorIp(db, b, "ruta", 60, 1)).toBeNull();
    expect(await limitarPorIp(db, a, "otra", 60, 1)).toBeNull();
  });
  it("no guarda la IP en claro", async () => {
    const { db, llamadas } = dbContador();
    await limitarPorIp(db, new Headers({ "x-forwarded-for": "203.0.113.7" }), "ruta", 60, 5);
    expect(llamadas[0]).toMatch(/^ruta:[0-9a-f]{24}$/);
    expect(llamadas[0]).not.toContain("203.0.113.7");
  });
});

describe("permitir", () => {
  it("si el contador falla (SQL sin ejecutar) deja pasar y lo registra", async () => {
    const espia = vi.spyOn(console, "error").mockImplementation(() => {});
    const db = { rpc: async () => ({ data: null, error: { message: "function not found" } }) } as any;
    expect(await permitir(db, "x", 60, 1)).toBe(true);
    expect(espia).toHaveBeenCalled();
    espia.mockRestore();
  });
});
