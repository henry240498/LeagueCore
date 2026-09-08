import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import ReportLayout, { PrintButton } from '../../components/reports/ReportLayout'
import { resolveAssetUrl } from '../../lib/assetUrl'
import { api } from '../../services/api'
import type { Player, PlayerListResponse } from '../../types/player'
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

type Scorer = { playerId: number; playerName: string; teamId: number; goals: number }
type ScorersByCompetition = { competitionId: number; competitionName: string; scorers: Scorer[] }

// §13: reporte completo de equipo -- info general/logo/entrenador/plantilla ya existen en /teams,
// /teams/:id, /players?teamId=; resumen W/D/L/goles/tarjetas reusa /stats/teams/:id/summary (el
// mismo que usa el Comparador). Un equipo puede haber participado en varias competiciones (un club
// es una entidad independiente, §Corrección arquitectónica), así que los goleadores se agrupan por
// cada competición real en la que participó (vía /teams/:id/competitions-history), no por una sola
// "competición del equipo" que ya no existe como campo fijo.
export default function TeamProfileReportPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const teamId = Number(id)
  const [team, setTeam] = useState<Team | null>(null)
  const [summary, setSummary] = useState<TeamSummary | null>(null)
  const [roster, setRoster] = useState<Player[]>([])
  const [scorersByCompetition, setScorersByCompetition] = useState<ScorersByCompetition[]>([])
  const [error, setError] = useState('')

  useEffect(() => {
    Promise.all([
      api.get<Team>(`/teams/${teamId}`),
      api.get<TeamSummary>(`/stats/teams/${teamId}/summary`),
      api.get<PlayerListResponse>(`/players?teamId=${teamId}&pageSize=100`),
      api.get<TeamCompetitionHistoryEntry[]>(`/teams/${teamId}/competitions-history`),
    ])
      .then(([t, s, p, history]) => {
        setTeam(t)
        setSummary(s)
        setRoster(p.items)
        return Promise.all(
          history.map((h) =>
            api
              .get<Scorer[]>(`/stats/top-scorers?competitionId=${h.competitionId}&limit=50`)
              .then((scorers) => ({
                competitionId: h.competitionId,
                competitionName: h.competitionName,
                scorers: scorers?.filter((sc) => sc.teamId === teamId) ?? [],
              }))
              .catch(() => ({ competitionId: h.competitionId, competitionName: h.competitionName, scorers: [] })),
          ),
        )
      })
      .then((grouped) => setScorersByCompetition(grouped.filter((g) => g.scorers.length > 0)))
      .catch(() => setError('No se pudo cargar el equipo'))
  }, [teamId])

  if (error) return <p className="p-6 text-red-600">{error}</p>
  if (!team || !summary) return <p className="p-6 text-slate-500">Cargando...</p>

  return (
    <ReportLayout
      title={`Reporte de Equipo — ${team.name}`}
      subtitle={[team.city, team.country].filter(Boolean).join(', ') || undefined}
      actions={
        <>
          <button
            type="button"
            onClick={() => navigate('/reportes/equipos')}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
          >
            ← Volver
          </button>
          <button
            type="button"
            onClick={() => navigate(`/equipos/${teamId}`)}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
          >
            Ver ficha completa
          </button>
          <PrintButton />
        </>
      }
    >
      <div className="space-y-6">
        <div className="flex items-center gap-4 rounded-lg bg-white p-6 shadow">
          {team.logoUrl ? (
            <img src={resolveAssetUrl(team.logoUrl)} alt="" className="h-16 w-16 object-contain" />
          ) : (
            <div className="flex h-16 w-16 items-center justify-center rounded bg-slate-100 text-2xl">🛡️</div>
          )}
          <div>
            <p className="text-xl font-bold text-slate-900">{team.name}</p>
            <p className="text-sm text-slate-500">
              {team.city ?? 'Ciudad no disponible'} · Fundado: {team.foundedYear ?? 'No disponible'}
            </p>
            <p className="text-xs text-slate-400">Entrenador: {team.managerName ?? 'No disponible'}</p>
          </div>
        </div>

        <Section title="Resumen (histórico, todas las competiciones/temporadas)">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Stat label="Jugados" value={summary.played} />
            <Stat label="Ganados" value={summary.won} />
            <Stat label="Empatados" value={summary.drawn} />
            <Stat label="Perdidos" value={summary.lost} />
            <Stat label="Goles a favor" value={summary.goalsFor} />
            <Stat label="Goles en contra" value={summary.goalsAgainst} />
            <Stat label="Amarillas" value={summary.yellowCards} />
            <Stat label="Rojas" value={summary.redCards} />
          </div>
          {summary.matchesMissingScore > 0 && (
            <p className="mt-2 text-xs text-amber-600">
              * {summary.matchesMissingScore} partido(s) finalizado(s) sin marcador cargado, no incluido(s).
            </p>
          )}
        </Section>

        <Section title="Goleadores por competición">
          {scorersByCompetition.length === 0 ? (
            <p className="text-sm text-slate-500">Sin datos</p>
          ) : (
            <div className="space-y-4">
              {scorersByCompetition.map((g) => (
                <div key={g.competitionId}>
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">{g.competitionName}</p>
                  <ul className="space-y-1 text-sm">
                    {g.scorers.map((s) => (
                      <li key={s.playerId} className="flex justify-between">
                        <button onClick={() => navigate(`/reportes/jugadores/${s.playerId}`)} className="text-blue-600 hover:underline">
                          {s.playerName}
                        </button>
                        <span className="font-medium">{s.goals}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </Section>

        <Section title="Plantilla">
          {roster.length === 0 ? (
            <p className="text-sm text-slate-500">Sin datos</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-200 text-slate-500">
                  <tr>
                    <th className="py-1 pr-2">#</th>
                    <th className="py-1 pr-2">Jugador</th>
                    <th className="py-1 pr-2">Posición</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {roster.map((p) => (
                    <tr key={p.id} className="cursor-pointer hover:bg-slate-50" onClick={() => navigate(`/reportes/jugadores/${p.id}`)}>
                      <td className="py-1 pr-2 text-slate-500">{p.squadNumber ?? '—'}</td>
                      <td className="py-1 pr-2 font-medium text-blue-600">{p.fullName}</td>
                      <td className="py-1 pr-2">{p.position ?? 'No disponible'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Section>
      </div>
    </ReportLayout>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg bg-white p-6 shadow print:break-inside-avoid">
      <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-500">{title}</h2>
      {children}
    </div>
  )
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <p className="text-xs text-slate-500">{label}</p>
      <p className="text-lg font-bold text-slate-900">{value}</p>
    </div>
  )
}
