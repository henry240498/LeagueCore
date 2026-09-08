import { useEffect, useState } from 'react'
import CompetitionSeasonFilter from '../../components/reports/CompetitionSeasonFilter'
import ReportLayout, { PrintButton } from '../../components/reports/ReportLayout'
import ReportTable, { type ReportColumn } from '../../components/reports/ReportTable'
import { exportToCsv } from '../../lib/csv'
import { api } from '../../services/api'
import { MATCH_STATUS_LABELS } from '../../types/match'
import type { RefereeMatchRow, RefereeReportRow } from '../../types/report'

// §18: reporte de árbitros. Nuevo endpoint /reports/referees (no existía nada parecido en ningún
// módulo -- Oficiales sólo tenía CRUD, sin agregaciones de actuaciones).
export default function RefereesReportPage() {
  const [competitionId, setCompetitionId] = useState<number | null>(null)
  const [seasonId, setSeasonId] = useState<number | null>(null)
  const [rows, setRows] = useState<RefereeReportRow[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<RefereeReportRow | null>(null)

  useEffect(() => {
    setLoading(true)
    const params = new URLSearchParams()
    if (competitionId) params.set('competitionId', String(competitionId))
    if (seasonId) params.set('seasonId', String(seasonId))
    api
      .get<RefereeReportRow[]>(`/reports/referees?${params}`)
      .then(setRows)
      .catch(() => setRows([]))
      .finally(() => setLoading(false))
  }, [competitionId, seasonId])

  const columns: ReportColumn<RefereeReportRow>[] = [
    { key: 'name', label: 'Árbitro', render: (r) => r.officialName, sortValue: (r) => r.officialName },
    { key: 'nationality', label: 'País', render: (r) => r.nationality ?? 'No disponible' },
    { key: 'matches', label: 'Partidos dirigidos', render: (r) => r.matchesDirected, sortValue: (r) => r.matchesDirected },
    { key: 'yellow', label: 'Amarillas', render: (r) => r.yellowCards, sortValue: (r) => r.yellowCards },
    { key: 'red', label: 'Rojas', render: (r) => r.redCards, sortValue: (r) => r.redCards },
    { key: 'fouls', label: 'Faltas', render: (r) => r.fouls, sortValue: (r) => r.fouls },
    { key: 'penalties', label: 'Penales', render: (r) => r.penalties, sortValue: (r) => r.penalties },
  ]

  return (
    <ReportLayout
      title="Reporte de Árbitros"
      subtitle="Actuaciones arbitrales (rol de árbitro principal). Click en un árbitro para ver los partidos que dirigió."
      actions={
        <>
          <button
            type="button"
            onClick={() =>
              exportToCsv(
                'arbitros.csv',
                rows.map((r) => ({
                  arbitro: r.officialName,
                  pais: r.nationality,
                  partidos: r.matchesDirected,
                  amarillas: r.yellowCards,
                  rojas: r.redCards,
                  faltas: r.fouls,
                  penales: r.penalties,
                })),
                [
                  { key: 'arbitro', label: 'Árbitro' },
                  { key: 'pais', label: 'País' },
                  { key: 'partidos', label: 'Partidos dirigidos' },
                  { key: 'amarillas', label: 'Amarillas' },
                  { key: 'rojas', label: 'Rojas' },
                  { key: 'faltas', label: 'Faltas' },
                  { key: 'penales', label: 'Penales' },
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
      <div className="no-print mb-4 flex flex-wrap items-end gap-3 rounded-lg bg-white p-4 shadow">
        <CompetitionSeasonFilter
          competitionId={competitionId}
          seasonId={seasonId}
          onCompetitionChange={setCompetitionId}
          onSeasonChange={setSeasonId}
        />
      </div>

      {loading ? (
        <p className="text-slate-500">Cargando...</p>
      ) : (
        <ReportTable columns={columns} rows={rows} getRowKey={(r) => r.officialId} onRowClick={setSelected} />
      )}

      {selected && (
        <RefereeMatchesModal
          referee={selected}
          competitionId={competitionId}
          seasonId={seasonId}
          onClose={() => setSelected(null)}
        />
      )}
    </ReportLayout>
  )
}

function RefereeMatchesModal({
  referee,
  competitionId,
  seasonId,
  onClose,
}: {
  referee: RefereeReportRow
  competitionId: number | null
  seasonId: number | null
  onClose: () => void
}) {
  const [matches, setMatches] = useState<RefereeMatchRow[] | null>(null)

  useEffect(() => {
    const params = new URLSearchParams()
    if (competitionId) params.set('competitionId', String(competitionId))
    if (seasonId) params.set('seasonId', String(seasonId))
    api
      .get<RefereeMatchRow[]>(`/reports/referees/${referee.officialId}/matches?${params}`)
      .then(setMatches)
      .catch(() => setMatches([]))
  }, [referee, competitionId, seasonId])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="max-h-[80vh] w-full max-w-2xl overflow-y-auto rounded-lg bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">Partidos dirigidos por {referee.officialName}</h2>
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
                  {m.competitionName} · {m.seasonLabel} · {new Date(m.matchDate).toLocaleDateString('es-PY')} ·{' '}
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
