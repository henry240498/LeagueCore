import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import CompetitionSeasonFilter from '../../components/reports/CompetitionSeasonFilter'
import ReportLayout, { PrintButton } from '../../components/reports/ReportLayout'
import ReportTable, { type ReportColumn } from '../../components/reports/ReportTable'
import SaveReportButton from '../../components/reports/SaveReportButton'
import { exportToCsv } from '../../lib/csv'
import { api } from '../../services/api'
import { MATCH_STATUS_LABELS, type Match, type MatchListResponse, type MatchStatus } from '../../types/match'
import type { Team } from '../../types/team'

type SavedFilters = { competitionId?: number; seasonId?: number; teamId?: number; status?: string }

export default function MatchesReportPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const savedFilters = (location.state as { savedFilters?: SavedFilters } | null)?.savedFilters

  const [competitionId, setCompetitionId] = useState<number | null>(savedFilters?.competitionId ?? null)
  const [seasonId, setSeasonId] = useState<number | null>(savedFilters?.seasonId ?? null)
  const [teamId, setTeamId] = useState<number | null>(savedFilters?.teamId ?? null)
  const [status, setStatus] = useState<string>(savedFilters?.status ?? '')
  const [teams, setTeams] = useState<Team[]>([])
  const [matches, setMatches] = useState<Match[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get<Team[]>('/teams').then(setTeams).catch(() => setTeams([]))
  }, [])

  useEffect(() => {
    setLoading(true)
    const params = new URLSearchParams()
    if (competitionId) params.set('competitionId', String(competitionId))
    if (seasonId) params.set('seasonId', String(seasonId))
    if (teamId) params.set('teamId', String(teamId))
    if (status) params.set('status', status)
    params.set('pageSize', '500')
    api
      .get<MatchListResponse>(`/matches?${params.toString()}`)
      .then((r) => setMatches(r.items))
      .catch(() => setMatches([]))
      .finally(() => setLoading(false))
  }, [competitionId, seasonId, teamId, status])

  const columns: ReportColumn<Match>[] = [
    {
      key: 'date',
      label: 'Fecha',
      render: (m) => new Date(m.matchDate).toLocaleDateString('es-PY'),
      sortValue: (m) => m.matchDate,
    },
    { key: 'competition', label: 'Competición', render: (m) => m.competitionName ?? '—', sortValue: (m) => m.competitionName ?? '' },
    { key: 'season', label: 'Temporada', render: (m) => m.seasonLabel ?? '—' },
    { key: 'round', label: 'Jornada', render: (m) => m.round ?? '—' },
    { key: 'home', label: 'Local', render: (m) => m.homeTeamName ?? '—', sortValue: (m) => m.homeTeamName ?? '' },
    {
      key: 'result',
      label: 'Resultado',
      render: (m) => (m.score ? `${m.score.homeScore} - ${m.score.awayScore}` : 'Sin datos'),
    },
    { key: 'away', label: 'Visitante', render: (m) => m.awayTeamName ?? '—', sortValue: (m) => m.awayTeamName ?? '' },
    { key: 'venue', label: 'Estadio', render: (m) => m.venueName ?? 'No disponible' },
    {
      key: 'status',
      label: 'Estado',
      render: (m) => MATCH_STATUS_LABELS[m.status] ?? m.status,
      sortValue: (m) => m.status,
    },
  ]

  const filterSummary = [
    competitionId && `competición #${competitionId}`,
    seasonId && `temporada #${seasonId}`,
    teamId && `equipo #${teamId}`,
    status && MATCH_STATUS_LABELS[status as MatchStatus],
  ]
    .filter(Boolean)
    .join(', ')

  return (
    <ReportLayout
      title="Reporte de Partidos"
      subtitle="Todos los partidos cargados en LeagueCore, con filtros combinables."
      filterSummary={filterSummary || 'ninguno'}
      actions={
        <>
          <SaveReportButton reportType="matches" filters={{ competitionId, seasonId, teamId, status }} />
          <button
            type="button"
            onClick={() =>
              exportToCsv(
                'partidos.csv',
                matches.map((m) => ({
                  fecha: m.matchDate,
                  competicion: m.competitionName,
                  temporada: m.seasonLabel,
                  jornada: m.round,
                  local: m.homeTeamName,
                  resultado: m.score ? `${m.score.homeScore}-${m.score.awayScore}` : '',
                  visitante: m.awayTeamName,
                  estadio: m.venueName,
                  estado: MATCH_STATUS_LABELS[m.status] ?? m.status,
                })),
                [
                  { key: 'fecha', label: 'Fecha' },
                  { key: 'competicion', label: 'Competición' },
                  { key: 'temporada', label: 'Temporada' },
                  { key: 'jornada', label: 'Jornada' },
                  { key: 'local', label: 'Local' },
                  { key: 'resultado', label: 'Resultado' },
                  { key: 'visitante', label: 'Visitante' },
                  { key: 'estadio', label: 'Estadio' },
                  { key: 'estado', label: 'Estado' },
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
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Equipo</label>
          <select
            value={teamId ?? ''}
            onChange={(e) => setTeamId(e.target.value ? Number(e.target.value) : null)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Todos</option>
            {teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Estado</label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Todos</option>
            {Object.entries(MATCH_STATUS_LABELS).map(([k, label]) => (
              <option key={k} value={k}>
                {label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <p className="text-slate-500">Cargando...</p>
      ) : (
        <ReportTable
          columns={columns}
          rows={matches}
          getRowKey={(m) => m.id}
          onRowClick={(m) => navigate(`/reportes/partidos/${m.id}`)}
        />
      )}
    </ReportLayout>
  )
}
