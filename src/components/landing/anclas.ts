/**
 * Anclas a las que apuntan los botones de la landing (#prueba, #prueba-pro…). Cada una existe como
 * elemento junto al formulario para que el navegador haga scroll, y el formulario elige tipo y plan.
 */
export const ANCLAS = {
  prueba: { tipo: "prueba" },
  "prueba-basico": { tipo: "prueba", plan: "Básico" },
  "prueba-pro": { tipo: "prueba", plan: "Pro" },
  "ventas-enterprise": { tipo: "demostracion", plan: "Enterprise" },
  demostracion: { tipo: "demostracion" },
} satisfies Record<string, { tipo: "prueba" | "demostracion"; plan?: string }>;

export type Ancla = keyof typeof ANCLAS;
