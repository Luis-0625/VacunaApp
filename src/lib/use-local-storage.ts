import { useCallback, useSyncExternalStore } from "react";

const EVENTO = "almacenamiento-local";
// Respaldo en memoria cuando el navegador bloquea localStorage (modo privado, permisos)
const memoria = new Map<string, string>();

function leer(clave: string, porDefecto: string): string {
  try {
    return localStorage.getItem(clave) ?? memoria.get(clave) ?? porDefecto;
  } catch {
    return memoria.get(clave) ?? porDefecto;
  }
}

function suscribir(avisar: () => void) {
  window.addEventListener("storage", avisar);
  window.addEventListener(EVENTO, avisar);
  return () => {
    window.removeEventListener("storage", avisar);
    window.removeEventListener(EVENTO, avisar);
  };
}

/**
 * Valor de localStorage sincronizado con React. En el servidor (y en el primer render) devuelve
 * `porDefecto`, así no hay diferencias de hidratación.
 */
export function useLocalStorage(clave: string, porDefecto: string): [string, (valor: string) => void] {
  const valor = useSyncExternalStore(suscribir, () => leer(clave, porDefecto), () => porDefecto);
  const guardar = useCallback((nuevo: string) => {
    memoria.set(clave, nuevo);
    try { localStorage.setItem(clave, nuevo); } catch { /* sin almacenamiento: queda en memoria */ }
    window.dispatchEvent(new Event(EVENTO));
  }, [clave]);
  return [valor, guardar];
}
