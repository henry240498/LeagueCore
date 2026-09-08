import { useEffect, useState } from 'react'
import ReportLayout, { PrintButton } from '../../components/reports/ReportLayout'
import ReportTable, { type ReportColumn } from '../../components/reports/ReportTable'
import { exportToCsv } from '../../lib/csv'
import { api } from '../../services/api'
import { MATCH_STATUS_LABELS } from '../../types/match'
import type { VenueMatchRow, VenueReportRow } from '../../types/report'

// §19: reporte de estadios. dbo.venues no tiene columnas de superficie/césped/asistencia -- nunca
// se pidieron ni se cargaron, así que se muestran honestamente como "No disponible" en vez de
// inventar un valor. Es la primera pantalla del módulo Estadios en todo el frontend (antes sólo
// existía como buscador embebido en el formulario de Partidos).
export default function VenuesReportPage() {
  const [rows, setRows] = useState<VenueReportRow[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<VenueReportRow | null>(null)

  useEffect(() => {
    api
      .get<VenueReportRow[]>('/reports/venues')
      .then(setRows)
      .catch(() => setRows([]))
      .finally(() => setLoading(false))
  }, [])

  const columns: ReportColumn<VenueReportRow>[] = [
    { key: 'name', label: 'Estadio', render: (r) => r.name, sortValue: (r) => r.name },
    { key: 'city', label: 'Ciudad', render: (r) => r.city ?? 'No disponible' },
    { key: 'country', label: 'País', render: (r) => r.country ?? 'No disponible' },
    { key: 'capacity', label: 'Capacidad', render: (r) => r.capacity ?? 'No disponible', sortValue: (r) => r.capacity ?? 0 },
    { key: 'matches', label: 'Partidos disputados', render: (r) => r.matchesPlayed, sortValue: (r) => r.matchesPlayed },
    { key: 'competitions', label: 'Competiciones', render: (r) => r.competitionsCount, sortValue: (r) => r.competitionsCount },
  ]

  return (
    <ReportLayout
      title="Reporte de Estadios"
      subtitle="Click en un estadio para ver los partidos disputados ahí."
      actions={
        <>
          <button
            type="button"
            onClick={() =>
              exportToCsv(
                'estadios.csv',
                rows.map((r) => ({
                  estadio: r.name,
                  ciudad: r.city,
                  pais: r.country,
                  capacidad: r.capacity,
                  partidos: r.matchesPlayed,
                  competiciones: r.competitionsCount,
                })),
                [
                  { key: 'estadio', label: 'Estadio' },
                  { key: 'ciudad', label: 'Ciudad' },
                  { key: 'pais', label: 'País' },
                  { key: 'capacidad', label: 'Capacidad' },
                  { key: 'partidos', label: 'Partidos disputados' },
                  { key: 'competiciones', label: 'Competiciones' },
                ],
              )
            }
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
          >
            ⬇ CSV / Excel
          </button>
          <PrintButton />
        </>
      }
    >
      {loading ? (
        <p className="text-slate-500">Cargando...</p>
      ) : (
        <ReportTable columns={columns} rows={rows} getRowKey={(r) => r.venueId} onRowClick={setSelected} />
      )}

      {selected && <VenueMatchesModal venue={selected} onClose={() => setSelected(null)} />}
    </ReportLayout>
  )
}

function VenueMatchesModal({ venue, onClose }: { venue: VenueReportRow; onClose: () => void }) {
  const [matches, setMatches] = useState<VenueMatchRow[] | null>(null)

  useEffect(() => {
    api
      .get<VenueMatchRow[]>(`/reports/venues/${venue.venueId}/matches`)
      .then(setMatches)
      .catch(() => setMatches([]))
  }, [venue])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="max-h-[80vh] w-full max-w-2xl overflow-y-auto rounded-lg bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">Partidos en {venue.name}</h2>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600">
            ✕
          </button>
        </div>
        {!matches ? (
          <p className="text-slate-500">Cargando...</p>
        ) : matches.length === 0 ? (
          <p className="text-slate-500">Sin datos</p>
        ) : (
          <ul className="divide-y divide-slate-100 text-sm">
            {matches.map((m) => (
              <li key={m.id} className="py-2">
                <p className="font-medium text-slate-900">
                  {m.homeTeamName} {m.homeScore != null ? `${m.homeScore} - ${m.awayScore}` : 'vs'} {m.awayTeamName}
                </p>
                <p className="text-xs text-slate-500">
                  {m.competitionName} · {new Date(m.matchDate).toLocaleDateString('es-PY')} ·{' '}
                  {MATCH_STATUS_LABELS[m.status as keyof typeof MATCH_STATUS_LABELS] ?? m.status}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
