export type Tema = "claro" | "oscuro" | "sistema";

export const CLAVE_TEMA = "tema";

/**
 * Script que se ejecuta en <head> antes de pintar la página: aplica la clase .dark según la
 * preferencia guardada en este navegador (por defecto, claro) y sigue los cambios del sistema.
 */
export const SCRIPT_TEMA = `(function(){try{
var m=window.matchMedia('(prefers-color-scheme: dark)');
function aplicar(){var t='claro';try{t=localStorage.getItem('${CLAVE_TEMA}')||'claro'}catch(e){}
document.documentElement.classList.toggle('dark',t==='oscuro'||(t==='sistema'&&m.matches))}
aplicar();m.addEventListener('change',aplicar);window.__aplicarTema=aplicar;
}catch(e){}})();`;
