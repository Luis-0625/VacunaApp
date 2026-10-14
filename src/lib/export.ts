import * as XLSX from "xlsx";
import Papa from "papaparse";
import type { Paciente } from "@/types/db";

const rowsOf = (pacientes: Paciente[]) =>
  pacientes.map((p) => ({
    nombre_completo: p.nombre_completo,
    documento_identidad: p.documento_identidad,
    telefono: p.telefono,
    email: p.email ?? "",
    fecha_nacimiento: p.fecha_nacimiento ?? "",
    autoriza_mensajes: p.autoriza_mensajes === "AUTORIZADO" ? "si" : p.autoriza_mensajes === "NO_AUTORIZADO" ? "no" : "",
  }));

const stamp = () => new Date().toISOString().slice(0, 10);

/** Las columnas coinciden con las que acepta la importación, así el archivo se puede reimportar. */
export function exportPacientes(pacientes: Paciente[], format: "xlsx" | "csv") {
  const rows = rowsOf(pacientes);
  const name = `pacientes-${stamp()}`;

  if (format === "xlsx") {
    const ws = XLSX.utils.json_to_sheet(rows);
    ws["!cols"] = [{ wch: 30 }, { wch: 18 }, { wch: 16 }, { wch: 30 }, { wch: 16 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Pacientes");
    XLSX.writeFile(wb, `${name}.xlsx`);
    return;
  }

  // BOM para que Excel respete las tildes al abrir el CSV.
  const blob = new Blob(["﻿" + Papa.unparse(rows)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${name}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
