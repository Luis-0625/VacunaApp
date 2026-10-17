"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Download, FileSpreadsheet, Loader2, TriangleAlert, XCircle } from "lucide-react";
import { HOJAS, leerLibro, type ClaveHoja } from "@/lib/plantilla-carga";

interface Resultado {
  total: number;
  importados: number;
  omitidas?: number;
  errores: { fila: number; referencia?: string; documento?: string; motivo: string }[];
  error?: string;
}

type Estado = "esperando" | "cargando" | "listo" | "fallo";

export default function CargaInicial() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [archivo, setArchivo] = useState<string | null>(null);
  const [filas, setFilas] = useState<ReturnType<typeof leerLibro>>({});
  const [leyendo, setLeyendo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);
  const [estados, setEstados] = useState<Partial<Record<ClaveHoja, { estado: Estado; resultado?: Resultado }>>>({});

  const hojasConDatos = HOJAS.filter((h) => filas[h.clave]?.length);

  async function elegir(file: File) {
    setLeyendo(true);
    setError(null);
    setEstados({});
    try {
      const leidas = leerLibro(await file.arrayBuffer());
      if (!Object.keys(leidas).length) throw new Error("No encontré ninguna hoja con datos. Usa la plantilla y no cambies los nombres de las hojas.");
      setFilas(leidas);
      setArchivo(file.name);
    } catch (e) {
      setFilas({});
      setArchivo(null);
      setError((e as Error).message || "No se pudo leer el archivo");
    } finally {
      setLeyendo(false);
    }
  }

  async function cargar() {
    setCargando(true);
    setError(null);
    setEstados({});
    for (const h of hojasConDatos) {
      setEstados((s) => ({ ...s, [h.clave]: { estado: "cargando" } }));
      try {
        const body = h.clave === "pacientes" ? { rows: filas[h.clave] } : { seccion: h.clave, rows: filas[h.clave] };
        const res = await fetch(h.ruta, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
        const json: Resultado = await res.json().catch(() => ({ total: 0, importados: 0, errores: [], error: "Respuesta inválida del servidor" }));
        const fallo = !res.ok;
        setEstados((s) => ({ ...s, [h.clave]: { estado: fallo ? "fallo" : "listo", resultado: json } }));
        // Las hojas dependen de las anteriores: si una falla del todo, no se sigue
        if (fallo) break;
      } catch {
        setEstados((s) => ({ ...s, [h.clave]: { estado: "fallo", resultado: { total: 0, importados: 0, errores: [], error: "Sin conexión con el servidor" } } }));
        break;
      }
    }
    setCargando(false);
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Carga inicial de datos</h1>
        <p className="mt-1 text-sm text-slate-500">
          Sube una sola vez el catálogo de vacunas, los pacientes vacunados en los últimos meses, sus dosis aplicadas y el
          inventario de hoy, desde un único archivo de Excel.
        </p>
      </header>

      <section className="card space-y-3 p-5">
        <h2 className="font-semibold">1. Descarga la plantilla y entrégala al centro</h2>
        <p className="text-sm text-slate-600">
          Es un Excel con una hoja de instrucciones y cuatro hojas de colores, con listas desplegables y notas en cada columna:{" "}
          <strong>1. Vacunas</strong>, <strong>2. Pacientes</strong>, <strong>3. Dosis aplicadas</strong> y <strong>4. Inventario actual</strong>.
        </p>
        <a href="/api/importar/plantilla" download className="btn-secondary inline-flex"><Download size={16} /> Descargar plantilla (.xlsx)</a>
        <p className="flex gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 ring-1 ring-amber-200">
          <TriangleAlert size={14} className="mt-0.5 shrink-0" />
          <span>
            Las dosis ya aplicadas <strong>no descuentan del inventario</strong>. El inventario se carga con lo que hay hoy en la
            nevera, contado junto con el administrador del centro. Si una vacuna ya tiene lotes, no se pueden cargar dosis
            históricas de esa vacuna: cárgalas antes de los lotes.
          </span>
        </p>
      </section>

      <section className="card space-y-4 p-5">
        <h2 className="font-semibold">2. Sube la plantilla llena</h2>
        <div
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) elegir(f); }}
          className="cursor-pointer rounded-lg border-2 border-dashed border-slate-300 p-8 text-center transition hover:border-brand-500"
        >
          {leyendo ? <Loader2 className="mx-auto animate-spin text-brand-600" size={32} /> : <FileSpreadsheet className="mx-auto mb-2 text-brand-600" size={36} />}
          <p className="font-medium">{archivo ?? "Arrastra el archivo aquí o haz clic para seleccionarlo"}</p>
          <p className="mt-1 text-xs text-slate-500">.xlsx o .xls · hasta 5.000 filas por hoja</p>
          <input ref={inputRef} type="file" accept=".xlsx,.xls" hidden
            onChange={(e) => { const f = e.target.files?.[0]; if (f) elegir(f); e.target.value = ""; }} />
        </div>
        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-200">{error}</p>}

        {hojasConDatos.length > 0 && (
          <div className="space-y-3">
            <p className="text-sm font-medium">Se cargarán, en este orden:</p>
            <ol className="space-y-2">
              {hojasConDatos.map((h) => (
                <li key={h.clave} className="rounded-lg border border-slate-200 p-3">
                  <FilaHoja nombre={h.nombre} total={filas[h.clave]!.length} estado={estados[h.clave]?.estado} resultado={estados[h.clave]?.resultado} />
                </li>
              ))}
            </ol>
            <button onClick={cargar} disabled={cargando} className="btn-primary">
              {cargando ? "Cargando…" : "Cargar datos"}
            </button>
          </div>
        )}
      </section>
    </div>
  );
}

function FilaHoja({ nombre, total, estado, resultado }: { nombre: string; total: number; estado?: Estado; resultado?: Resultado }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="font-medium">{nombre} <span className="font-normal text-slate-500">· {total} filas</span></span>
        {estado === "cargando" && <Loader2 size={16} className="animate-spin text-brand-600" />}
        {estado === "listo" && <CheckCircle2 size={18} className="text-emerald-600" />}
        {estado === "fallo" && <XCircle size={18} className="text-red-600" />}
      </div>
      {resultado?.error && <p className="text-sm text-red-700">{resultado.error}</p>}
      {resultado && !resultado.error && (
        <>
          <p className="text-sm text-slate-600">
            <strong className="text-emerald-700">{resultado.importados} cargadas</strong>
            {!!resultado.omitidas && <> · {resultado.omitidas} ya existían (omitidas)</>}
            {resultado.errores.length > 0 && <> · <strong className="text-red-700">{resultado.errores.length} con error</strong></>}
          </p>
          {resultado.errores.length > 0 && (
            <div className="max-h-48 overflow-auto rounded-lg bg-red-50 p-2 text-xs ring-1 ring-red-200">
              {resultado.errores.map((e, i) => (
                <p key={i} className="py-0.5 text-red-800">
                  <strong>Fila {e.fila}</strong>{(e.referencia ?? e.documento) ? ` (${e.referencia ?? e.documento})` : ""}: {e.motivo}
                </p>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
