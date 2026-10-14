import type { Config } from "tailwindcss";

const SHADES = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950];

/** Escala de color que lee variables CSS (--<nombre>-<tono>), definidas en globals.css para claro y oscuro. */
const escala = (nombre: string) =>
  Object.fromEntries(SHADES.map((s) => [s, `rgb(var(--${nombre}-${s}) / <alpha-value>)`]));

const config: Config = {
  darkMode: "class",
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        surface: "rgb(var(--surface) / <alpha-value>)",
        brand: escala("brand"),
        slate: escala("slate"),
        red: escala("red"),
        emerald: escala("emerald"),
        amber: escala("amber"),
        sky: escala("sky"),
        violet: escala("violet"),
        rose: escala("rose"),
        green: escala("green"),
      },
    },
  },
  plugins: [],
};
export default config;
