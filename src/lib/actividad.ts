/**
 * Última actividad del usuario en este navegador, para el cierre de sesión por inactividad. Vive en
 * localStorage: la comparten las pestañas y sobrevive al cerrar la ventana, así que al volver se sabe
 * cuánto tiempo pasó.
 */
export const LIMITE_INACTIVIDAD_MS = 10 * 60 * 1000;
export const CLAVE_ACTIVIDAD = "ultima-actividad";

/** Momento de la última actividad registrada, o null si no hay registro. */
export function leerActividad(): number | null {
  try {
    return Number(localStorage.getItem(CLAVE_ACTIVIDAD)) || null;
  } catch {
    return null;
  }
}

/** Registra actividad ahora. Llamar también al iniciar sesión, para no heredar el registro de una sesión vieja. */
export function marcarActividad() {
  try {
    localStorage.setItem(CLAVE_ACTIVIDAD, String(Date.now()));
  } catch {
    // sin almacenamiento (modo privado): cada pestaña cuenta por su cuenta con la variable en memoria
  }
}
