import { useEffect, useState } from 'react'
import { api } from '../../services/api'
import type { Competition } from '../../types/competition'
import type { Season, SeasonListResponse } from '../../types/season'

// Selector competición -> temporada en cascada, compartido por los reportes de Partidos/
// Competiciones/Estadísticas (antes reimplementado por separado en cada pantalla -- ComparePage y
// StatisticsPage siguen con su propia copia porque tocarlas no era parte de este pedido, pero todo
// reporte nuevo de este módulo usa esta única versión).
export default function CompetitionSeasonFilter({
  competitionId,
  seasonId,
  onCompetitionChange,
  onSeasonChange,
}: {
  competitionId: number | null
  seasonId: number | null
  onCompetitionChange: (id: number | null) => void
  onSeasonChange: (id: number | null) => void
}) {
  const [competitions, setCompetitions] = useState<Competition[]>([])
  const [seasons, setSeasons] = useState<Season[]>([])

  useEffect(() => {
    api.get<Competition[]>('/competitions').then(setCompetitions).catch(() => setCompetitions([]))
  }, [])

  useEffect(() => {
    if (!competitionId) {
      setSeasons([])
      return
    }
    api
      .get<SeasonListResponse>(`/seasons?competitionId=${competitionId}&pageSize=100`)
      .then((r) => setSeasons(r.items))
      .catch(() => setSeasons([]))
  }, [competitionId])

  return (
    <>
      <div>
        <label className="mb-1 block text-xs font-medium text-slate-600">Competición</label>
        <select
          value={competitionId ?? ''}
          onChange={(e) => {
            onCompetitionChange(e.target.value ? Number(e.target.value) : null)
            onSeasonChange(null)
          }}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Todas</option>
          {competitions.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-slate-600">Temporada</label>
        <select
          value={seasonId ?? ''}
          onChange={(e) => onSeasonChange(e.target.value ? Number(e.target.value) : null)}
          disabled={!competitionId}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
        >
          <option value="">Todas</option>
          {seasons.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>
      </div>
    </>
  )
}
