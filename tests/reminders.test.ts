import { beforeEach, describe, expect, it, vi } from "vitest";

const correos: any[] = [];
const whatsapps: any[] = [];
let fallaWhatsApp = false;

vi.mock("@/lib/notifications/email", () => ({
  sendReminderEmail: async (i: any) => { correos.push(i); },
}));
vi.mock("@/lib/notifications/whatsapp", () => ({
  sendReminderWhatsApp: async (i: any) => {
    if (fallaWhatsApp) throw new Error("Twilio caído");
    whatsapps.push(i);
    return "SM123";
  },
}));

import { processReminders } from "@/lib/reminders";

const est = { nombre: "IPS Salud" } as any;

function rec(id: string, over: { canal?: string; telefono?: string; email?: string | null; autoriza?: string; paciente?: string; vacuna?: string } = {}) {
  return {
    id, centro_id: "c1", canal: over.canal ?? "WHATSAPP", intentos: 0, fecha_programada: "2026-10-16",
    cita: {
      paciente_id: over.paciente ?? "p1", numero_dosis: 1, fecha_proxima_dosis: "2026-10-16",
      paciente: {
        id: over.paciente ?? "p1", nombre_completo: "Ana Pérez", telefono: over.telefono ?? "3001234567",
        email: over.email === undefined ? "ana@mail.com" : over.email, autoriza_mensajes: over.autoriza ?? "AUTORIZADO",
      },
      vacuna: { nombre: over.vacuna ?? "Hepatitis B" },
    },
  } as any;
}

/** Base falsa: acumula cada update de la tabla recordatorios por id. */
function fakeDb() {
  const updates = new Map<string, any>();
  const db = {
    from: () => ({
      update: (v: any) => ({
        eq: async (_col: string, id: string) => { updates.set(id, { ...updates.get(id), ...v }); return { error: null }; },
      }),
    }),
  } as any;
  return { db, updates };
}

beforeEach(() => { correos.length = 0; whatsapps.length = 0; fallaWhatsApp = false; });

describe("processReminders", () => {
  it("envía el WhatsApp con la dosis siguiente y marca ENVIADO", async () => {
    const { db, updates } = fakeDb();
    const [r] = await processReminders(db, [rec("r1")], est);
    expect(r.ok).toBe(true);
    expect(whatsapps[0]).toMatchObject({ to: "+573001234567", dosis: [{ vacuna: "Hepatitis B", dosis: 2 }] });
    expect(updates.get("r1")).toMatchObject({ estado_envio: "ENVIADO", intentos: 1, whatsapp_sid: "SM123" });
  });

  it("respeta a quien NO autoriza mensajes: no se envía nada y queda FALLIDO con el motivo", async () => {
    const { db, updates } = fakeDb();
    const [r] = await processReminders(db, [rec("r1", { autoriza: "NO_AUTORIZADO", canal: "AMBOS" })], est);
    expect(r.ok).toBe(false);
    expect(whatsapps).toHaveLength(0);
    expect(correos).toHaveLength(0);
    expect(updates.get("r1").estado_envio).toBe("FALLIDO");
    expect(updates.get("r1").ultimo_error).toContain("Ley 1581");
  });

  it("agrupa en un solo mensaje las dosis de hermanos con el mismo teléfono", async () => {
    const { db } = fakeDb();
    await processReminders(db, [rec("r1", { paciente: "p1" }), rec("r2", { paciente: "p2", vacuna: "Polio" })], est);
    expect(whatsapps).toHaveLength(1);
    expect(whatsapps[0].dosis).toHaveLength(2);
  });

  it("teléfono inválido: FALLIDO y no intenta enviar", async () => {
    const { db, updates } = fakeDb();
    const [r] = await processReminders(db, [rec("r1", { telefono: "12" })], est);
    expect(r.ok).toBe(false);
    expect(whatsapps).toHaveLength(0);
    expect(updates.get("r1").ultimo_error).toContain("Teléfono inválido");
  });

  it("canal AMBOS: si falla WhatsApp pero sale el correo queda ENVIADO con el aviso", async () => {
    fallaWhatsApp = true;
    const { db, updates } = fakeDb();
    const [r] = await processReminders(db, [rec("r1", { canal: "AMBOS" })], est);
    expect(r.ok).toBe(true);
    expect(correos).toHaveLength(1);
    expect(updates.get("r1")).toMatchObject({ estado_envio: "ENVIADO" });
    expect(updates.get("r1").ultimo_error).toContain("Twilio caído");
  });

  it("si falla el único canal queda FALLIDO", async () => {
    fallaWhatsApp = true;
    const { db, updates } = fakeDb();
    const [r] = await processReminders(db, [rec("r1")], est);
    expect(r.ok).toBe(false);
    expect(updates.get("r1").estado_envio).toBe("FALLIDO");
  });

  it("paciente sin correo en canal EMAIL: FALLIDO", async () => {
    const { db, updates } = fakeDb();
    await processReminders(db, [rec("r1", { canal: "EMAIL", email: null })], est);
    expect(updates.get("r1").ultimo_error).toContain("sin email");
  });
});
