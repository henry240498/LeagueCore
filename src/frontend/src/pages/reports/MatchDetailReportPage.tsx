import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import ReportLayout, { PrintButton } from '../../components/reports/ReportLayout'
import TacticalViewTab from '../../pages/matches/TacticalViewTab'
import { api } from '../../services/api'
import {
  CARD_TYPE_LABELS,
  MATCH_OFFICIAL_ROLE_LABELS,
  MATCH_STATUS_LABELS,
  type Match,
  type MatchCoachEntry,
  type MatchLineupEntry,
  type MatchOfficialEntry,
  type MatchTeamStats,
  type TimelineEvent,
} from '../../types/match'

// §7/§8: reporte detallado + visual de un partido -- agrega los endpoints que YA existen del
// módulo de Partidos (nada nuevo en el backend), en vez de un endpoint "todo en uno" que duplicaría
// lo que matches/timeline/lineups/officials/coaches/team-stats ya resuelven por separado.
export default function MatchDetailReportPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const matchId = Number(id)
  const [match, setMatch] = useState<Match | null>(null)
  const [timeline, setTimeline] = useState<TimelineEvent[]>([])
  const [lineups, setLineups] = useState<MatchLineupEntry[]>([])
  const [officials, setOfficials] = useState<MatchOfficialEntry[]>([])
  const [coaches, setCoaches] = useState<MatchCoachEntry[]>([])
  const [teamStats, setTeamStats] = useState<MatchTeamStats[]>([])
  const [tab, setTab] = useState<'general' | 'tactico'>('general')
  const [error, setError] = useState('')

  useEffect(() => {
    Promise.all([
      api.get<Match>(`/matches/${matchId}`),
      api.get<TimelineEvent[]>(`/matches/${matchId}/timeline`),
      api.get<MatchLineupEntry[]>(`/matches/${matchId}/lineups`),
      api.get<MatchOfficialEntry[]>(`/matches/${matchId}/officials`),
      api.get<MatchCoachEntry[]>(`/matches/${matchId}/coaches`),
      api.get<MatchTeamStats[]>(`/matches/${matchId}/team-stats`),
    ])
      .then(([m, t, l, o, c, ts]) => {
        setMatch(m)
        setTimeline(t)
        setLineups(l)
        setOfficials(o)
        setCoaches(c)
        setTeamStats(ts)
      })
      .catch(() => setError('No se pudo cargar el partido'))
  }, [matchId])

  if (error) return <p className="p-6 text-red-600">{error}</p>
  if (!match) return <p className="p-6 text-slate-500">Cargando...</p>

  const homeLineup = lineups.filter((l) => l.teamId === match.homeTeamId)
  const awayLineup = lineups.filter((l) => l.teamId === match.awayTeamId)
  const homeStats = teamStats.find((s) => s.teamId === match.homeTeamId)
  const awayStats = teamStats.find((s) => s.teamId === match.awayTeamId)
  // GET /matches/:id (a diferencia de la lista) no trae el campo `score` calculado -- sólo
  // periodScores crudo, mismo dato que ya usa MatchDetailPage.tsx del módulo Partidos.
  const fullTimeScore = match.periodScores.find((p) => p.period === 'full_time')

  return (
    <ReportLayout
      title={`${match.homeTeamName} vs ${match.awayTeamName}`}
      subtitle={`${match.competitionName} — ${match.seasonLabel}`}
      actions={
        <>
          <button
            type="button"
            onClick={() => navigate('/reportes/partidos')}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
          >
            ← Volver
          </button>
          <PrintButton />
        </>
      }
    >
      <div className="no-print mb-4 flex gap-2 border-b border-slate-200">
        {(['general', 'tactico'] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`border-b-2 px-3 py-2 text-sm font-medium ${
              tab === t ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            {t === 'general' ? 'Reporte detallado' : 'Vista táctica'}
          </button>
        ))}
      </div>

      {tab === 'tactico' ? (
        <TacticalViewTab match={match} onError={setError} />
      ) : (
        <div className="space-y-6">
          <Section title="Datos generales">
            <Grid>
              <Field label="Competición" value={match.competitionName} />
              <Field label="Temporada" value={match.seasonLabel} />
              <Field label="Fecha" value={new Date(match.matchDate).toLocaleDateString('es-PY')} />
              <Field label="Hora" value={match.matchTime ? match.matchTime.slice(11, 16) : 'No disponible'} />
              <Field label="Estadio" value={match.venueName ?? 'No disponible'} />
              <Field label="Público" value={match.attendance != null ? String(match.attendance) : 'No disponible'} />
              <Field label="Clima" value={match.weatherCondition ?? 'No disponible'} />
              <Field label="Estado del césped" value={match.pitchCondition ?? 'No disponible'} />
              <Field label="Estado" value={MATCH_STATUS_LABELS[match.status] ?? match.status} />
            </Grid>
          </Section>

          <Section title="Equipos y resultado">
            <div className="flex items-center justify-center gap-6 py-2 text-center">
              <div>
                <p className="font-bold text-slate-900">{match.homeTeamName}</p>
                <p className="text-xs text-slate-500">
                  DT: {coaches.find((c) => c.teamId === match.homeTeamId)?.coachFullName ?? 'No disponible'}
                </p>
              </div>
              <p className="text-3xl font-bold text-slate-900">
                {fullTimeScore ? `${fullTimeScore.homeScore} - ${fullTimeScore.awayScore}` : 'Sin datos'}
              </p>
              <div>
                <p className="font-bold text-slate-900">{match.awayTeamName}</p>
                <p className="text-xs text-slate-500">
                  DT: {coaches.find((c) => c.teamId === match.awayTeamId)?.coachFullName ?? 'No disponible'}
                </p>
              </div>
            </div>
          </Section>

          <Section title="Arbitraje">
            {officials.length === 0 ? (
              <p className="text-sm text-slate-500">Sin datos</p>
            ) : (
              <ul className="space-y-1 text-sm">
                {officials.map((o) => (
                  <li key={o.id}>
                    <span className="text-slate-500">{MATCH_OFFICIAL_ROLE_LABELS[o.role] ?? o.role}:</span>{' '}
                    <button onClick={() => navigate(`/oficiales/${o.officialId}`)} className="font-medium text-blue-600 hover:underline">
                      {o.officialFullName}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Section title="Alineaciones">
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              <LineupList title={match.homeTeamName ?? 'Local'} entries={homeLineup} onClickPlayer={(id) => navigate(`/jugadores/${id}`)} />
              <LineupList title={match.awayTeamName ?? 'Visitante'} entries={awayLineup} onClickPlayer={(id) => navigate(`/jugadores/${id}`)} />
            </div>
          </Section>

          <Section title="Eventos">
            {timeline.length === 0 ? (
              <p className="text-sm text-slate-500">Sin datos</p>
            ) : (
              <ul className="space-y-1 text-sm">
                {timeline.map((e) => (
                  <li key={`${e.type}-${e.id}`} className="flex gap-2">
                    <span className="w-10 shrink-0 text-slate-400">{e.minute != null ? `${e.minute}'` : '—'}</span>
                    <span>{describeEvent(e)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Section title="Estadísticas de equipo">
            {!homeStats && !awayStats ? (
              <p className="text-sm text-slate-500">Sin datos</p>
            ) : (
              <TeamStatsTable home={homeStats} away={awayStats} homeLabel={match.homeTeamName ?? 'Local'} awayLabel={match.awayTeamName ?? 'Visitante'} />
            )}
          </Section>
        </div>
      )}
    </ReportLayout>
  )
}

function describeEvent(e: TimelineEvent): string {
  switch (e.type) {
    case 'goal':
      return `⚽ Gol de ${e.playerName ?? '—'} (${e.teamName ?? '—'})${e.assistPlayerName ? ` — asistencia de ${e.assistPlayerName}` : ''}${e.ownGoal ? ' (en contra)' : ''}${e.penalty ? ' (penal)' : ''}`
    case 'card':
      return `🟨 ${CARD_TYPE_LABELS[e.cardType ?? ''] ?? e.cardType} a ${e.playerName ?? '—'} (${e.teamName ?? '—'})`
    case 'substitution':
      return `🔄 Sale ${e.playerOutName ?? '—'}, entra ${e.playerInName ?? '—'} (${e.teamName ?? '—'})`
    case 'offside':
      return `🚩 Fuera de juego, ${e.playerName ?? '—'} (${e.teamName ?? '—'})`
    case 'foul':
      return `⚠️ Falta de ${e.playerName ?? '—'} (${e.teamName ?? '—'})`
    case 'interruption':
      return `⏸ Interrupción (${e.interruptionType ?? '—'})`
    default:
      return e.type
  }
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg bg-white p-6 shadow print:shadow-none print:break-inside-avoid">
      <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-500">{title}</h2>
      {children}
    </div>
  )
}

function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">{children}</div>
}

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <p className="text-xs text-slate-500">{label}</p>
      <p className="text-sm font-medium text-slate-900">{value || 'No disponible'}</p>
    </div>
  )
}

function LineupList({
  title,
  entries,
  onClickPlayer,
}: {
  title: string
  entries: MatchLineupEntry[]
  onClickPlayer: (playerId: number) => void
}) {
  const starters = entries.filter((e) => e.isStarting)
  const bench = entries.filter((e) => !e.isStarting)
  return (
    <div>
      <p className="mb-2 text-sm font-bold text-slate-900">{title}</p>
      {entries.length === 0 ? (
        <p className="text-xs text-slate-500">Sin datos</p>
      ) : (
        <>
          <p className="mb-1 text-xs font-medium text-slate-500">Titulares</p>
          <ul className="mb-2 space-y-0.5 text-sm">
            {starters.map((e) => (
              <li key={e.id}>
                <button onClick={() => onClickPlayer(e.playerId)} className="text-blue-600 hover:underline">
                  {e.shirtNumber != null ? `${e.shirtNumber}. ` : ''}
                  {e.playerFullName}
                </button>{' '}
                <span className="text-xs text-slate-400">{e.position ?? ''}</span>
              </li>
            ))}
          </ul>
          {bench.length > 0 && (
            <>
              <p className="mb-1 text-xs font-medium text-slate-500">Suplentes</p>
              <ul className="space-y-0.5 text-sm">
                {bench.map((e) => (
                  <li key={e.id}>
                    <button onClick={() => onClickPlayer(e.playerId)} className="text-blue-600 hover:underline">
                      {e.shirtNumber != null ? `${e.shirtNumber}. ` : ''}
                      {e.playerFullName}
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </>
      )}
    </div>
  )
}

const STAT_ROWS: { key: keyof MatchTeamStats; label: string }[] = [
  { key: 'possessionPct', label: 'Posesión (%)' },
  { key: 'shots', label: 'Tiros' },
  { key: 'shotsOnTarget', label: 'Tiros a puerta' },
  { key: 'corners', label: 'Córners' },
  { key: 'fouls', label: 'Faltas' },
  { key: 'offsidesCount', label: 'Offsides' },
  { key: 'passes', label: 'Pases' },
  { key: 'passesCompleted', label: 'Pases completados' },
]

function TeamStatsTable({
  home,
  away,
  homeLabel,
  awayLabel,
}: {
  home?: MatchTeamStats
  away?: MatchTeamStats
  homeLabel: string
  awayLabel: string
}) {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-slate-200 text-left text-slate-500">
          <th className="py-1">Estadística</th>
          <th className="py-1 text-center">{homeLabel}</th>
          <th className="py-1 text-center">{awayLabel}</th>
        </tr>
      </thead>
      <tbody>
        {STAT_ROWS.map((row) => {
          const hv = home?.[row.key]
          const av = away?.[row.key]
          return (
            <tr key={row.key} className="border-b border-slate-100 last:border-0">
              <td className="py-1 text-slate-600">{row.label}</td>
              <td className="py-1 text-center">{hv != null ? String(hv) : 'No disponible'}</td>
              <td className="py-1 text-center">{av != null ? String(av) : 'No disponible'}</td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}
