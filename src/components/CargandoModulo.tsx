/**
 * Esqueleto que se muestra al instante al cambiar de módulo, mientras el servidor trae los datos.
 * Next lo precarga junto con los enlaces del menú (loading.tsx de cada módulo).
 */
export default function CargandoModulo() {
  return (
    <div className="animate-pulse" aria-busy="true" aria-label="Cargando">
      <div className="h-7 w-56 rounded-lg bg-slate-200" />
      <div className="mt-2 h-4 w-80 max-w-full rounded bg-slate-100" />

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="card h-24 p-5">
            <div className="h-3 w-20 rounded bg-slate-100" />
            <div className="mt-3 h-6 w-12 rounded bg-slate-200" />
          </div>
        ))}
      </div>

      <div className="card mt-6 overflow-hidden">
        <div className="border-b border-slate-100 px-5 py-4">
          <div className="h-4 w-40 rounded bg-slate-200" />
        </div>
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="flex items-center gap-3 border-b border-slate-100 px-5 py-3.5 last:border-0">
            <div className="h-9 w-9 shrink-0 rounded-full bg-slate-100" />
            <div className="flex-1 space-y-2">
              <div className="h-3.5 w-1/3 rounded bg-slate-200" />
              <div className="h-3 w-1/2 rounded bg-slate-100" />
            </div>
            <div className="hidden h-6 w-20 rounded-full bg-slate-100 sm:block" />
          </div>
        ))}
      </div>
    </div>
  );
}
