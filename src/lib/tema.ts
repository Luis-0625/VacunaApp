export type Tema = "claro" | "oscuro";

export const CLAVE_TEMA = "tema";

/**
 * Script que se ejecuta en <head> antes de pintar la página: aplica la clase .dark si este navegador
 * eligió el tema oscuro. Cualquier otro valor guardado (incluido el antiguo "sistema") es el predeterminado.
 */
export const SCRIPT_TEMA = `(function(){try{
function aplicar(){var t='claro';try{t=localStorage.getItem('${CLAVE_TEMA}')||'claro'}catch(e){}
document.documentElement.classList.toggle('dark',t==='oscuro')}
aplicar();window.__aplicarTema=aplicar;
}catch(e){}})();`;
