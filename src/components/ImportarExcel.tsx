"use client";

import { useRef, useState } from "react";
import * as XLSX from "xlsx";
import Papa from "papaparse";
import { CheckCircle2, FileSpreadsheet, XCircle } from "lucide-react";

interface ImportResult {
  total: number;
  importados: number;
  errores: { fila: number; documento?: string; motivo: string }[];
}

async function parseFile(file: File): Promise<Record<string, unknown>[]> {
  if (file.name.toLowerCase().endsWith(".csv")) {
    return new Promise((resolve, reject) =>
      Papa.parse<Record<string, unknown>>(file, {
        header: true,
        skipEmptyLines: true,
        complete: (r) => resolve(r.data),
        error: reject,
      })
    );
  }
  const wb = XLSX.read(await file.arrayBuffer(), { type: "array" });
  return XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[wb.SheetNames[0]], { defval: "" });
}

export default function ImportarExcel({ onDone }: { onDone?: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File) {
    setLoading(true);
    setError(null);
    setResult(null);
    setFileName(file.name);
    try {
      const rows = await parseFile(file);
      const res = await fetch("/api/pacientes/importar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Error al importar");
      setResult(json);
      onDone?.();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          const f = e.dataTransfer.files?.[0];
          if (f) handleFile(f);
        }}
        className={`cursor-pointer border-2 border-dashed rounded-lg p-8 text-center transition ${
          dragging ? "border-brand-600 bg-brand-50" : "border-slate-300 hover:border-brand-500"
        }`}
      >
        <FileSpreadsheet className="mx-auto mb-2 text-brand-600" size={36} />
        <p className="font-medium">Arrastra tu archivo aquí o haz clic para seleccionarlo</p>
        <p className="text-xs text-slate-500 mt-1">
          .xlsx, .xls o .csv · Columnas: nombre_completo, documento_identidad, telefono, email, fecha_nacimiento
        </p>
        <input
          ref={inputRef} type="file" accept=".xlsx,.xls,.csv" hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
            e.target.value = "";
          }}
        />
      </div>

      {loading && <p className="text-sm text-slate-600">Procesando {fileName}…</p>}
      {error && <p className="text-sm text-red-600 flex items-center gap-1"><XCircle size={16} /> {error}</p>}

      {result && (
        <div className="space-y-3">
          <div className="flex gap-6 text-sm">
            <span className="flex items-center gap-1 text-green-700">
              <CheckCircle2 size={16} /> {result.importados} importados
            </span>
            <span className="flex items-center gap-1 text-red-700">
              <XCircle size={16} /> {result.errores.length} con error
            </span>
            <span className="text-slate-500">de {result.total} filas</span>
          </div>
          {result.errores.length > 0 && (
            <div className="max-h-56 overflow-y-auto border rounded-lg">
              <table className="w-full text-xs">
                <thead className="bg-slate-100 text-left sticky top-0">
                  <tr><th className="p-2">Fila</th><th className="p-2">Documento</th><th className="p-2">Motivo</th></tr>
                </thead>
                <tbody>
                  {result.errores.map((e, i) => (
                    <tr key={i} className="border-t">
                      <td className="p-2">{e.fila}</td>
                      <td className="p-2">{e.documento ?? "—"}</td>
                      <td className="p-2 text-red-700">{e.motivo}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
