import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { resolveAssetUrl } from '../../lib/assetUrl'
import { ApiError } from '../../context/AuthContext'
import { api } from '../../services/api'
import type { Match } from '../../types/match'
import { MATCH_STATUS_LABELS } from '../../types/match'
import type { Player } from '../../types/player'
import type { Team, TeamCompetitionHistoryEntry } from '../../types/team'

type TeamSummary = {
  played: number
  won: number
  drawn: number
  lost: number
  goalsFor: number
  goalsAgainst: number
  yellowCards: number
  redCards: number
  matchesMissingScore: number
}

type Tab = 'info' | 'jugadores' | 'partidos' | 'resultados' | 'estadisticas' | 'historial' | 'competiciones'

const TABS: { key: Tab; label: string }[] = [
  { key: 'info', label: 'Información general' },
  { key: 'jugadores', label: 'Jugadores' },
  { key: 'competiciones', label: 'Competiciones' },
  { key: 'partidos', label: 'Partidos' },
  { key: 'resultados', label: 'Resultados' },
  { key: 'estadisticas', label: 'Estadísticas' },
  { key: 'historial', label: 'Historial' },
]

export default function TeamDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [team, setTeam] = useState<Team | null>(null)
  const [tab, setTab] = useState<Tab>('info')
  const [error, setError] = useState('')

  useEffect(() => {
    api
      .get<Team>(`/teams/${id}`)
      .then(setTeam)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Error al cargar el equipo'))
  }, [id])

  if (error) return <p className="p-8 text-center text-red-600">{error}</p>
  if (!team) return <p className="p-8 text-center text-slate-500">Cargando...</p>

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-4">
          {team.logoUrl ? (
            <img src={resolveAssetUrl(team.logoUrl) ?? undefined} alt={team.name} className="h-14 w-14 rounded-full object-cover shadow" />
          ) : (
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-2xl shadow">🛡️</div>
          )}
          <div>
            <h1 className="text-2xl font-bold sm:text-3xl">{team.name}</h1>
            <p className="text-sm text-slate-500">
              {[team.city, team.country].filter(Boolean).join(' • ') || 'Club independiente'}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => navigate(`/equipos/${id}/editar`)}
          className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
        >
          Editar
        </button>
      </div>

      <TeamOverviewBar teamId={team.id} />

      <div className="mb-6 mt-4 flex gap-2 overflow-x-auto border-b border-slate-200">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium ${
              tab === t.key ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'info' && (
        <div className="rounded-lg bg-white p-6 shadow">
          <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Ciudad" value={team.city} />
            <Field label="País" value={team.country} />
            <Field label="Fundación" value={team.foundedYear?.toString()} />
            <Field label="Director técnico" value={team.managerName} />
            <Field label="Estado" value={team.status === 'active' ? 'Activo' : 'Inactivo'} />
          </dl>
          {team.note && (
            <div className="mt-4">
              <p className="text-sm text-slate-500">Notas</p>
              <p className="text-slate-900">{team.note}</p>
            </div>
          )}
        </div>
      )}
      {tab === 'jugadores' && <PlayersTab teamId={team.id} />}
      {tab === 'competiciones' && <CompetitionsHistoryTab teamId={team.id} />}
      {tab === 'partidos' && <MatchesTab teamId={team.id} />}
      {tab === 'resultados' && <ResultsTab teamId={team.id} />}
      {tab === 'estadisticas' && <TeamStatsTab teamId={team.id} />}
      {tab === 'historial' && <RosterHistoryTab teamId={team.id} />}
    </div>
  )
}

// Barra visual real (Fase 12 del pedido: "Partidos · Goles · Títulos" bajo el escudo) -- usa el
// mismo /stats/teams/:id/summary que ya alimenta la pestaña Estadísticas, sólo condensado. No hay
// tabla de títulos/trofeos en el esquema todavía, así que esa columna se omite en vez de inventarla.
function TeamOverviewBar({ teamId }: { teamId: number }) {
  const [summary, setSummary] = useState<TeamSummary | null>(null)

  useEffect(() => {
    api
      .get<TeamSummary>(`/stats/teams/${teamId}/summary`)
      .then(setSummary)
      .catch(() => setSummary(null))
  }, [teamId])

  if (!summary) return null

  return (
    <div className="mb-2 grid grid-cols-3 gap-3 rounded-lg bg-white p-3 shadow sm:grid-cols-6">
      <OverviewStat label="Partidos" value={summary.played} />
      <OverviewStat label="Ganados" value={summary.won} />
      <OverviewStat label="Empatados" value={summary.drawn} />
      <OverviewStat label="Perdidos" value={summary.lost} />
      <OverviewStat label="Goles a favor" value={summary.goalsFor} />
      <OverviewStat label="Goles en contra" value={summary.goalsAgainst} />
    </div>
  )
}

function OverviewStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="text-center">
      <p className="text-lg font-bold text-slate-900 tabular-nums">{value}</p>
      <p className="text-xs text-slate-500">{label}</p>
    </div>
  )
}

function Field({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <dt className="text-sm text-slate-500">{label}</dt>
      <dd className="font-medium text-slate-900">{value || '—'}</dd>
    </div>
  )
}

function CompetitionsHistoryTab({ teamId }: { teamId: number }) {
  const [history, setHistory] = useState<TeamCompetitionHistoryEntry[] | null>(null)
  const navigate = useNavigate()

  useEffect(() => {
    api
      .get<TeamCompetitionHistoryEntry[]>(`/teams/${teamId}/competitions-history`)
      .then(setHistory)
      .catch(() => setHistory([]))
  }, [teamId])

  return (
    <div className="rounded-lg bg-white p-6 shadow">
      <h2 className="mb-1 text-lg font-bold">Historial de competiciones</h2>
      <p className="mb-4 text-sm text-slate-400">
        Competiciones y temporadas en las que participó este equipo, según las temporadas registradas.
      </p>
      {!history && <p className="text-slate-500">Cargando...</p>}
      {history?.length === 0 && (
        <p className="text-slate-500">Este equipo todavía no tiene participaciones registradas en ninguna temporada.</p>
      )}
      <div className="space-y-4">
        {history?.map((c) => (
          <div key={c.competitionId} className="rounded-lg border border-slate-200 p-4">
            <button
              type="button"
              onClick={() => navigate(`/competiciones/${c.competitionId}`)}
              className="font-medium text-blue-600 hover:underline"
            >
              {c.competitionName}
            </button>
            {c.country && <span className="ml-2 text-xs text-slate-400">{c.country}</span>}
            <ul className="mt-2 flex flex-wrap gap-2">
              {c.seasons.map((s) => (
                <li key={s.seasonId}>
                  <button
                    type="button"
                    onClick={() => navigate(`/temporadas/${s.seasonId}`)}
                    className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-200"
                  >
                    {s.label}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  )
}

function MatchesTab({ teamId }: { teamId: number }) {
  const [matches, setMatches] = useState<Match[] | null>(null)
  const navigate = useNavigate()

  useEffect(() => {
    api
      .get<{ items: Match[] }>(`/matches?teamId=${teamId}&pageSize=100`)
      .then((r) => setMatches(r.items))
      .catch(() => setMatches([]))
  }, [teamId])

  return (
    <div className="rounded-lg bg-white p-6 shadow">
      <h2 className="mb-4 text-lg font-bold">Partidos</h2>
      {!matches && <p className="text-slate-500">Cargando...</p>}
      {matches?.length === 0 && <p className="text-slate-500">Todavía no hay partidos registrados para este equipo.</p>}
      <ul className="divide-y divide-slate-100">
        {matches?.map((m) => (
          <li key={m.id} className="flex items-center justify-between py-2">
            <button
              type="button"
              onClick={() => navigate(`/partidos/${m.id}`)}
              className="font-medium text-blue-600 hover:underline"
            >
              {m.homeTeamName} {m.score ? `${m.score.homeScore}-${m.score.awayScore}` : 'vs'} {m.awayTeamName}
            </button>
            <span className="text-sm text-slate-500">
              {m.matchDate.slice(0, 10)} · {MATCH_STATUS_LABELS[m.status]}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function ResultsTab({ teamId }: { teamId: number }) {
  const [matches, setMatches] = useState<Match[] | null>(null)
  const navigate = useNavigate()

  useEffect(() => {
    api
      .get<{ items: Match[] }>(`/matches?teamId=${teamId}&status=finished&pageSize=100`)
      .then((r) => setMatches(r.items))
      .catch(() => setMatches([]))
  }, [teamId])

  return (
    <div className="rounded-lg bg-white p-6 shadow">
      <h2 className="mb-4 text-lg font-bold">Resultados</h2>
      {!matches && <p className="text-slate-500">Cargando...</p>}
      {matches?.length === 0 && <p className="text-slate-500">Todavía no hay partidos finalizados para este equipo.</p>}
      <ul className="divide-y divide-slate-100">
        {matches?.map((m) => {
          const isHome = m.homeTeamId === teamId
          const own = isHome ? m.score?.homeScore : m.score?.awayScore
          const opp = isHome ? m.score?.awayScore : m.score?.homeScore
          const outcome = own == null || opp == null ? null : own > opp ? 'G' : own === opp ? 'E' : 'P'
          const outcomeColor =
            outcome === 'G' ? 'bg-green-100 text-green-700' : outcome === 'P' ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-600'
          return (
            <li key={m.id} className="flex items-center justify-between py-2">
              <button type="button" onClick={() => navigate(`/partidos/${m.id}`)} className="font-medium text-blue-600 hover:underline">
                {m.homeTeamName} {m.score ? `${m.score.homeScore}-${m.score.awayScore}` : 'vs'} {m.awayTeamName}
              </button>
              <div className="flex items-center gap-2">
                <span className="text-sm text-slate-500">{m.matchDate.slice(0, 10)}</span>
                {outcome && <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${outcomeColor}`}>{outcome}</span>}
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function TeamStatsTab({ teamId }: { teamId: number }) {
  const [summary, setSummary] = useState<TeamSummary | null>(null)


  useEffect(() => {
    api
      .get<TeamSummary>(`/stats/teams/${teamId}/summary`)
      .then(setSummary)
      .catch(() => setSummary(null))
  }, [teamId])

  return (
    <div className="rounded-lg bg-white p-6 shadow">
      <h2 className="mb-1 text-lg font-bold">Estadísticas</h2>
      <p className="mb-4 text-sm text-slate-400">
        Calculadas en tiempo real sobre todos los partidos finalizados del equipo, en cualquier competición o temporada.
      </p>
      {!summary && <p className="text-slate-500">Cargando...</p>}
      {summary && (
        <>
          <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <StatValue label="Jugados" value={summary.played} />
            <StatValue label="Ganados" value={summary.won} />
            <StatValue label="Empatados" value={summary.drawn} />
            <StatValue label="Perdidos" value={summary.lost} />
            <StatValue label="Goles a favor" value={summary.goalsFor} />
            <StatValue label="Goles en contra" value={summary.goalsAgainst} />
            <StatValue label="Amarillas" value={summary.yellowCards} />
            <StatValue label="Rojas" value={summary.redCards} />
          </dl>
          {summary.matchesMissingScore > 0 && (
            <p className="mt-4 text-xs text-amber-600">
              * {summary.matchesMissingScore} partido(s) finalizado(s) sin marcador de tiempo completo cargado -- excluido(s) del
              cálculo de goles y resultado.
            </p>
          )}
        </>
      )}
    </div>
  )
}

function StatValue({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <dt className="text-sm text-slate-500">{label}</dt>
      <dd className="text-xl font-bold text-slate-900">{value}</dd>
    </div>
  )
}

type RosterHistoryEntry = {
  id: number
  playerId: number
  playerName: string
  squadNumber: number | null
  startDate: string
  endDate: string | null
}

function RosterHistoryTab({ teamId }: { teamId: number }) {
  const [history, setHistory] = useState<RosterHistoryEntry[] | null>(null)
  const navigate = useNavigate()

  useEffect(() => {
    api
      .get<RosterHistoryEntry[]>(`/teams/${teamId}/roster-history`)
      .then(setHistory)
      .catch(() => setHistory([]))
  }, [teamId])

  return (
    <div className="rounded-lg bg-white p-6 shadow">
      <h2 className="mb-4 text-lg font-bold">Historial de plantel</h2>
      {!history && <p className="text-slate-500">Cargando...</p>}
      {history?.length === 0 && <p className="text-slate-500">Todavía no hay historial de plantel para este equipo.</p>}
      <ul className="divide-y divide-slate-100">
        {history?.map((h) => (
          <li key={h.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
            <button type="button" onClick={() => navigate(`/jugadores/${h.playerId}`)} className="font-medium text-blue-600 hover:underline">
              {h.playerName}
            </button>
            <span className="text-sm text-slate-500">
              {h.startDate.slice(0, 10)} — {h.endDate ? h.endDate.slice(0, 10) : 'Actual'}
              {h.squadNumber ? ` · #${h.squadNumber}` : ''}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function PlayersTab({ teamId }: { teamId: number }) {
  const [players, setPlayers] = useState<Player[] | null>(null)
  const navigate = useNavigate()

  useEffect(() => {
    api
      .get<{ items: Player[] }>(`/players?teamId=${teamId}&pageSize=100`)
      .then((r) => setPlayers(r.items))
      .catch(() => setPlayers([]))
  }, [teamId])

  return (
    <div className="rounded-lg bg-white p-6 shadow">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-bold">Jugadores</h2>
        <button
          type="button"
          onClick={() => navigate(`/jugadores/nuevo?teamId=${teamId}`)}
          className="rounded-lg bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
        >
          + Agregar jugador
        </button>
      </div>
      {!players && <p className="text-slate-500">Cargando...</p>}
      {players?.length === 0 && <p className="text-slate-500">Todavía no hay jugadores en este equipo.</p>}
      <ul className="divide-y divide-slate-100">
        {players?.map((p) => (
          <li key={p.id} className="flex items-center justify-between py-2">
            <button
              type="button"
              onClick={() => navigate(`/jugadores/${p.id}`)}
              className="font-medium text-blue-600 hover:underline"
            >
              {p.fullName}
            </button>
            {p.position && <span className="text-sm text-slate-500">{p.position}</span>}
          </li>
        ))}
      </ul>
    </div>
  )
}
