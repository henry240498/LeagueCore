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

/**
 * Parser CSV mínimo para pegar/importar planillas (el inverso de exportToCsv).
 *
 * Soporta comillas dobles, comas y saltos de línea dentro de un campo, y el BOM que agrega Excel.
 * Devuelve objetos usando la primera fila como encabezado, con las claves normalizadas
 * (sin espacios ni tildes) para que "Pos X" y "pos_x" lleguen igual.
 */
export function normalizeHeader(h: string): string {
  return h
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]/g, '')
}

export function parseCsv(text: string): Record<string, string>[] {
  const clean = text.replace(/^﻿/, '').trim()
  if (!clean) return []

  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false

  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i]
    if (inQuotes) {
      if (ch === '"') {
        if (clean[i + 1] === '"') {
          field += '"'
          i++
        } else inQuotes = false
      } else field += ch
      continue
    }
    if (ch === '"') inQuotes = true
    else if (ch === ',' || ch === ';' || ch === '\t') {
      row.push(field)
      field = ''
    } else if (ch === '\n') {
      row.push(field)
      rows.push(row)
      row = []
      field = ''
    } else if (ch !== '\r') field += ch
  }
  row.push(field)
  rows.push(row)

  const [header, ...body] = rows
  if (!header) return []
  const keys = header.map(normalizeHeader)
  return body
    .filter((r) => r.some((c) => c.trim() !== ''))
    .map((r) => Object.fromEntries(keys.map((k, i) => [k, (r[i] ?? '').trim()])))
}
