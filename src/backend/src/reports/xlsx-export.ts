import * as XLSX from 'xlsx';

export interface ExportSheet {
  name: string;
  columns: { key: string; label: string }[];
  rows: Record<string, unknown>[];
}

// Exportación real a .xlsx (antes "Excel" era el mismo CSV con BOM abierto en Excel, ver
// docs/ANALISIS_INICIAL_LEAGUECORE.md v31) -- convierte lo que la pantalla YA tiene en memoria
// (mismos datos que el admin está viendo, sin volver a consultar la base) a un libro real, una hoja
// por reporte. Reusa la misma librería `xlsx` ya sumada para las plantillas de importación.
export function buildXlsxWorkbook(sheets: ExportSheet[]): Buffer {
  const wb = XLSX.utils.book_new();
  for (const sheet of sheets) {
    const rows = sheet.rows.map((row) => {
      const out: Record<string, unknown> = {};
      for (const col of sheet.columns) out[col.label] = row[col.key] ?? '';
      return out;
    });
    const ws = XLSX.utils.json_to_sheet(rows, { header: sheet.columns.map((c) => c.label) });
    // Excel no permite nombres de hoja de más de 31 caracteres ni con / \ ? * [ ]
    const safeName = sheet.name.replace(/[/\\?*[\]]/g, ' ').slice(0, 31) || 'Hoja';
    XLSX.utils.book_append_sheet(wb, ws, safeName);
  }
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
}
