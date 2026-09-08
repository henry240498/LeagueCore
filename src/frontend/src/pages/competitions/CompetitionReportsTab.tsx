import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CalendarSection, CardsSection, ScorersSection } from '../../components/reports/CompetitionReportSections'
import StandingsTable from '../../components/StandingsTable'
import { ApiError } from '../../context/AuthContext'
import { api, API_URL } from '../../services/api'
import type { Match, MatchListResponse } from '../../types/match'
import type { Season, StandingsResponse } from '../../types/season'
import type { CardsByPlayerRow, TopScorerRow } from '../../types/stats'

type Tab = 'clasificacion' | 'goleadores' | 'tarjetas' | 'calendario'

// Centro de reportes de la competición (§12-19 del pedido) -- reusa las mismas secciones que ya
// existen en /reportes/competiciones (components/reports/CompetitionReportSections.tsx), sólo que
// pre-filtradas por esta competición y embebidas dentro de su propia navegación (nunca hay que
// volver a elegir la competición ni perder el contexto, §17/§25 del pedido de visualización).
export default function CompetitionReportsTab({ competitionId, competitionName }: { competitionId: number; competitionName: string }) {
  const navigate = useNavigate()
  const [seasons, setSeasons] = useState<Season[]>([])
  const [seasonId, setSeasonId] = useState<number | null>(null)
  const [tab, setTab] = useState<Tab>('clasificacion')
  const [exporting, setExporting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    api
      .get<{ items: Season[] }>(`/seasons?competitionId=${competitionId}&pageSize=100`)
      .then((r) => {
        setSeasons(r.items)
        const current = r.items.find((s) => s.isCurrent) ?? r.items[0]
        setSeasonId(current?.id ?? null)
      })
      .catch(() => setSeasons([]))
  }, [competitionId])

  const handleExportXlsx = async () => {
    setError('')
    setExporting(true)
    try {
      const sheets: { name: string; columns: { key: string; label: string }[]; rows: Record<string, unknown>[] }[] = []

      if (seasonId) {
        const standings = await api.get<StandingsResponse>(`/seasons/${seasonId}/standings`)
        sheets.push({
          name: 'Clasificacion',
          columns: [
            { key: 'position', label: 'Pos' }, { key: 'teamName', label: 'Equipo' }, { key: 'played', label: 'PJ' },
            { key: 'won', label: 'PG' }, { key: 'drawn', label: 'PE' }, { key: 'lost', label: 'PP' },
            { key: 'goalsFor', label: 'GF' }, { key: 'goalsAgainst', label: 'GC' }, { key: 'points', label: 'Pts' },
          ],
          rows: standings.standings,
        })
      }

      const scorersParams = new URLSearchParams({ competitionId: String(competitionId), limit: '100' })
      if (seasonId) scorersParams.set('seasonId', String(seasonId))
      const scorers = await api.get<TopScorerRow[]>(`/stats/top-scorers?${scorersParams}`)
      sheets.push({
        name: 'Goleadores',
        columns: [{ key: 'playerName', label: 'Jugador' }, { key: 'teamName', label: 'Equipo' }, { key: 'goals', label: 'Goles' }],
        rows: scorers,
      })

      const cards = await api.get<CardsByPlayerRow[]>(`/stats/cards-by-player?${scorersParams}`)
      sheets.push({
        name: 'Tarjetas',
        columns: [
          { key: 'playerName', label: 'Jugador' }, { key: 'teamName', label: 'Equipo' },
          { key: 'yellowCards', label: 'Amarillas' }, { key: 'redCards', label: 'Rojas' },
        ],
        rows: cards,
      })

      const matchParams = new URLSearchParams({ competitionId: String(competitionId), pageSize: '500' })
      if (seasonId) matchParams.set('seasonId', String(seasonId))
      const matches = await api.get<MatchListResponse>(`/matches?${matchParams}`)
      sheets.push({
        name: 'Calendario',
        columns: [
          { key: 'matchDate', label: 'Fecha' }, { key: 'homeTeamName', label: 'Local' }, { key: 'resultado', label: 'Resultado' },
          { key: 'awayTeamName', label: 'Visitante' }, { key: 'venueName', label: 'Estadio' },
        ],
        rows: matches.items.map((m: Match) => ({ ...m, resultado: m.score ? `${m.score.homeScore}-${m.score.awayScore}` : '' })),
      })

      const res = await fetch(`${API_URL}/reports/export-xlsx`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: `reporte_${competitionName.replace(/\s+/g, '_')}.xlsx`, sheets }),
      })
      if (!res.ok) throw new Error('Error al generar el archivo Excel')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `reporte_${competitionName.replace(/\s+/g, '_')}.xlsx`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Error al exportar el reporte')
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-white p-4 shadow">
        <div className="flex items-center gap-3">
          <label className="text-xs font-medium text-slate-600">Temporada</label>
          <select
            value={seasonId ?? ''}
            onChange={(e) => setSeasonId(e.target.value ? Number(e.target.value) : null)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Todas</option>
            {seasons.map((s) => (
              <option key={s.id} value={s.id}>
                Temporada {s.label}
                {s.isCurrent ? ' (actual)' : ''}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => window.print()} className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100">
            🖨️ Imprimir / PDF
          </button>
          <button
            type="button"
            disabled={exporting}
            onClick={handleExportXlsx}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50"
          >
            {exporting ? 'Generando...' : '⬇ Descargar reporte completo (Excel)'}
          </button>
          <button
            type="button"
            onClick={() => navigate(`/reportes/competiciones?competitionId=${competitionId}`)}
            className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
          >
            Ver reporte completo →
          </button>
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex gap-2 border-b border-slate-200">
        {(['clasificacion', 'goleadores', 'tarjetas', 'calendario'] as Tab[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`border-b-2 px-3 py-2 text-sm font-medium capitalize ${
              tab === t ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === 'clasificacion' && (
        <div className="rounded-lg bg-white p-6 shadow">
          {!seasonId ? <p className="text-sm text-slate-500">Elegí una temporada para ver la clasificación.</p> : <StandingsTable seasonId={seasonId} />}
        </div>
      )}
      {tab === 'goleadores' && <ScorersSection competitionId={competitionId} seasonId={seasonId} navigate={navigate} />}
      {tab === 'tarjetas' && <CardsSection competitionId={competitionId} seasonId={seasonId} navigate={navigate} />}
      {tab === 'calendario' && <CalendarSection competitionId={competitionId} seasonId={seasonId} navigate={navigate} />}
    </div>
  )
}
