import { useState } from 'react'

export type ReportColumn<T> = {
  key: string
  label: string
  render: (row: T) => React.ReactNode
  sortValue?: (row: T) => string | number
  defaultHidden?: boolean
}

// Tabla genérica compartida por todos los reportes tabulares (§33/§34/§35/§36/§44): mostrar/ocultar
// columnas, ordenar por cualquier columna, paginación en cliente (para listas ya acotadas por el
// backend -- las que pueden crecer mucho, como Partidos/Jugadores, paginan en el propio backend y
// esta tabla sólo muestra la página ya traída), estado vacío honesto ("Sin datos", nunca 0 falso),
// y navegación al hacer click en una fila cuando corresponde a una entidad real.
export default function ReportTable<T>({
  columns,
  rows,
  getRowKey,
  onRowClick,
  emptyMessage = 'Sin datos para los filtros elegidos.',
  pageSize = 25,
}: {
  columns: ReportColumn<T>[]
  rows: T[]
  getRowKey: (row: T) => string | number
  onRowClick?: (row: T) => void
  emptyMessage?: string
  pageSize?: number
}) {
  const [hidden, setHidden] = useState<Set<string>>(
    new Set(columns.filter((c) => c.defaultHidden).map((c) => c.key)),
  )
  const [sortKey, setSortKey] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [page, setPage] = useState(1)

  const visibleColumns = columns.filter((c) => !hidden.has(c.key))

  const sorted = (() => {
    if (!sortKey) return rows
    const col = columns.find((c) => c.key === sortKey)
    if (!col?.sortValue) return rows
    const copy = [...rows]
    copy.sort((a, b) => {
      const va = col.sortValue!(a)
      const vb = col.sortValue!(b)
      const cmp = typeof va === 'number' && typeof vb === 'number' ? va - vb : String(va).localeCompare(String(vb))
      return sortDir === 'asc' ? cmp : -cmp
    })
    return copy
  })()

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize))
  const pageRows = sorted.slice((page - 1) * pageSize, page * pageSize)

  const toggleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  return (
    <div className="rounded-lg bg-white shadow print:shadow-none">
      <div className="no-print flex flex-wrap items-center gap-3 border-b border-slate-100 px-4 py-2">
        <span className="text-xs font-medium text-slate-500">Columnas:</span>
        {columns.map((c) => (
          <label key={c.key} className="flex items-center gap-1 text-xs text-slate-600">
            <input
              type="checkbox"
              checked={!hidden.has(c.key)}
              onChange={() =>
                setHidden((prev) => {
                  const next = new Set(prev)
                  if (next.has(c.key)) next.delete(c.key)
                  else next.add(c.key)
                  return next
                })
              }
            />
            {c.label}
          </label>
        ))}
      </div>

      {rows.length === 0 ? (
        <p className="px-4 py-8 text-center text-sm text-slate-500">{emptyMessage}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 text-slate-500">
              <tr>
                {visibleColumns.map((c) => (
                  <th
                    key={c.key}
                    className={`py-2 px-3 ${c.sortValue ? 'cursor-pointer select-none hover:text-slate-800 print:cursor-auto' : ''}`}
                    onClick={() => c.sortValue && toggleSort(c.key)}
                  >
                    {c.label}
                    {sortKey === c.key && <span className="ml-1">{sortDir === 'asc' ? '↑' : '↓'}</span>}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {pageRows.map((row) => (
                <tr
                  key={getRowKey(row)}
                  className={onRowClick ? 'cursor-pointer hover:bg-slate-50' : ''}
                  onClick={() => onRowClick?.(row)}
                >
                  {visibleColumns.map((c) => (
                    <td key={c.key} className="px-3 py-2">
                      {c.render(row)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <div className="no-print flex items-center justify-between border-t border-slate-100 px-4 py-2 text-xs text-slate-500">
          <span>
            Página {page} de {totalPages} ({rows.length} registros)
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
              className="rounded border border-slate-300 px-2 py-1 disabled:opacity-40"
            >
              ← Anterior
            </button>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="rounded border border-slate-300 px-2 py-1 disabled:opacity-40"
            >
              Siguiente →
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
