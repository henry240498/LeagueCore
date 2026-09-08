import { useEffect, useState } from 'react'
import type { useNavigate } from 'react-router-dom'
import { exportToCsv } from '../../lib/csv'
import { api } from '../../services/api'
import { MATCH_STATUS_LABELS, type Match, type MatchListResponse } from '../../types/match'
import type { CardsByPlayerRow, TopScorerRow } from '../../types/stats'
import ReportTable, { type ReportColumn } from './ReportTable'

// Secciones de reporte de competición (goleadores/tarjetas/calendario) extraídas de
// CompetitionReportPage.tsx para poder reusarlas TAL CUAL, sin duplicar código, dentro de la
// pestaña "Reportes" embebida en Competición → Detalle (misma data, mismo componente, dos lugares
// de entrada -- nunca dos implementaciones distintas del mismo reporte).

export function ScorersSection({
  competitionId,
  seasonId,
  navigate,
}: {
  competitionId: number
  seasonId: number | null
  navigate: ReturnType<typeof useNavigate>
}) {
  const [rows, setRows] = useState<TopScorerRow[]>([])
  useEffect(() => {
    const params = new URLSearchParams({ competitionId: String(competitionId), limit: '50' })
    if (seasonId) params.set('seasonId', String(seasonId))
    api.get<TopScorerRow[]>(`/stats/top-scorers?${params}`).then(setRows).catch(() => setRows([]))
  }, [competitionId, seasonId])

  const columns: ReportColumn<TopScorerRow>[] = [
    { key: 'pos', label: 'Pos.', render: (r) => rows.indexOf(r) + 1 },
    { key: 'player', label: 'Jugador', render: (r) => r.playerName, sortValue: (r) => r.playerName },
    { key: 'team', label: 'Equipo', render: (r) => r.teamName },
    { key: 'goals', label: 'Goles', render: (r) => r.goals, sortValue: (r) => r.goals },
  ]

  return <ReportTable columns={columns} rows={rows} getRowKey={(r) => r.playerId} onRowClick={(r) => navigate(`/reportes/jugadores/${r.playerId}`)} />
}

export function CardsSection({
  competitionId,
  seasonId,
  navigate,
}: {
  competitionId: number
  seasonId: number | null
  navigate: ReturnType<typeof useNavigate>
}) {
  const [rows, setRows] = useState<CardsByPlayerRow[]>([])
  useEffect(() => {
    const params = new URLSearchParams({ competitionId: String(competitionId), limit: '50' })
    if (seasonId) params.set('seasonId', String(seasonId))
    api.get<CardsByPlayerRow[]>(`/stats/cards-by-player?${params}`).then(setRows).catch(() => setRows([]))
  }, [competitionId, seasonId])

  const columns: ReportColumn<CardsByPlayerRow>[] = [
    { key: 'player', label: 'Jugador', render: (r) => r.playerName, sortValue: (r) => r.playerName },
    { key: 'team', label: 'Equipo', render: (r) => r.teamName },
    { key: 'yellow', label: 'Amarillas', render: (r) => r.yellowCards, sortValue: (r) => r.yellowCards },
    { key: 'red', label: 'Rojas', render: (r) => r.redCards, sortValue: (r) => r.redCards },
  ]

  return <ReportTable columns={columns} rows={rows} getRowKey={(r) => r.playerId} onRowClick={(r) => navigate(`/reportes/jugadores/${r.playerId}`)} />
}

export function CalendarSection({
  competitionId,
  seasonId,
  navigate,
}: {
  competitionId: number
  seasonId: number | null
  navigate: ReturnType<typeof useNavigate>
}) {
  const [rows, setRows] = useState<Match[]>([])
  useEffect(() => {
    const params = new URLSearchParams({ competitionId: String(competitionId), pageSize: '500' })
    if (seasonId) params.set('seasonId', String(seasonId))
    api.get<MatchListResponse>(`/matches?${params}`).then((r) => setRows(r.items)).catch(() => setRows([]))
  }, [competitionId, seasonId])

  const columns: ReportColumn<Match>[] = [
    { key: 'date', label: 'Fecha', render: (m) => new Date(m.matchDate).toLocaleDateString('es-PY'), sortValue: (m) => m.matchDate },
    { key: 'home', label: 'Local', render: (m) => m.homeTeamName ?? '—' },
    { key: 'result', label: 'Resultado', render: (m) => (m.score ? `${m.score.homeScore} - ${m.score.awayScore}` : 'vs') },
    { key: 'away', label: 'Visitante', render: (m) => m.awayTeamName ?? '—' },
    { key: 'venue', label: 'Estadio', render: (m) => m.venueName ?? 'No disponible' },
    { key: 'status', label: 'Estado', render: (m) => MATCH_STATUS_LABELS[m.status] ?? m.status },
  ]

  return (
    <>
      <div className="no-print mb-3 flex justify-end">
        <button
          type="button"
          onClick={() =>
            exportToCsv(
              'calendario.csv',
              rows.map((m) => ({
                fecha: m.matchDate,
                local: m.homeTeamName,
                resultado: m.score ? `${m.score.homeScore}-${m.score.awayScore}` : '',
                visitante: m.awayTeamName,
                estadio: m.venueName,
                estado: m.status,
              })),
              [
                { key: 'fecha', label: 'Fecha' },
                { key: 'local', label: 'Local' },
                { key: 'resultado', label: 'Resultado' },
                { key: 'visitante', label: 'Visitante' },
                { key: 'estadio', label: 'Estadio' },
                { key: 'estado', label: 'Estado' },
              ],
            )
          }
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
        >
          ⬇ CSV / Excel
        </button>
      </div>
      <ReportTable columns={columns} rows={rows} getRowKey={(m) => m.id} onRowClick={(m) => navigate(`/reportes/partidos/${m.id}`)} />
    </>
  )
}
