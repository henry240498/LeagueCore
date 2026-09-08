function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return ''
  const s = String(value)
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

// El BOM (﻿) hace que Excel detecte UTF-8 automáticamente al abrir el archivo -- sin esto,
// tildes/Ñ se ven corruptas en Excel aunque el archivo esté bien codificado (mismo problema de
// fondo que motivó -f 65001 en sqlcmd, documentado en memoria del proyecto).
export function exportToCsv(filename: string, rows: Record<string, unknown>[], columns: { key: string; label: string }[]) {
  const header = columns.map((c) => csvEscape(c.label)).join(',')
  const lines = rows.map((r) => columns.map((c) => csvEscape(r[c.key])).join(','))
  const csv = [header, ...lines].join('\r\n')
  const BOM = String.fromCharCode(0xfeff)
  const blob = new Blob([BOM + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
