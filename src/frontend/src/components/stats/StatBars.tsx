// Comparación genérica de dos series como barras enfrentadas (A a la izquierda, B a la derecha,
// proporcional al total de la fila) -- primitivo reutilizable: partido (local/visitante), jugador
// (comparación A/B), equipo (temporada/temporada). Nunca inventa un valor: una fila sin ningún dato
// real en ninguno de los dos lados se omite antes de llegar acá (decisión del llamador).
export type StatBarRow = {
  key: string
  label: string
  a: number | null
  b: number | null
}

export default function StatBars({
  rows,
  labelA,
  labelB,
  colorA = '#2563eb',
  colorB = '#dc2626',
}: {
  rows: StatBarRow[]
  labelA: string
  labelB: string
  colorA?: string
  colorB?: string
}) {
  if (rows.length === 0) {
    return <p className="py-4 text-center text-sm text-slate-400">Sin datos disponibles para comparar todavía.</p>
  }

  return (
    <div className="space-y-3">
      <div className="mb-1 flex justify-between text-sm font-bold text-slate-700">
        <span>{labelA}</span>
        <span>{labelB}</span>
      </div>
      {rows.map((row) => {
        const total = (row.a ?? 0) + (row.b ?? 0)
        const aPct = total > 0 ? ((row.a ?? 0) / total) * 100 : 50
        return (
          <div key={row.key}>
            <div className="mb-0.5 flex justify-between text-xs text-slate-600">
              <span className="font-medium tabular-nums">{row.a ?? '—'}</span>
              <span>{row.label}</span>
              <span className="font-medium tabular-nums">{row.b ?? '—'}</span>
            </div>
            <div className="flex h-2 overflow-hidden rounded-full bg-slate-100">
              <div className="transition-all duration-500" style={{ width: `${aPct}%`, backgroundColor: colorA }} />
              <div className="transition-all duration-500" style={{ width: `${100 - aPct}%`, backgroundColor: colorB }} />
            </div>
          </div>
        )
      })}
    </div>
  )
}
