import { useEffect, useState } from 'react'
import { ApiError } from '../../context/AuthContext'
import { operationsService } from '../../services/operations'
import { api } from '../../services/api'
import type { Team } from '../../types/team'
import type { Match } from '../../types/match'
import type { Alert, DisciplineRow, Overview, RefereeRow, SubImpact, TeamContext } from '../../types/operations'

const inputClass =
  'rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500'

export default function OperationsPage() {
  const [teams, setTeams] = useState<Team[]>([])
  const [matches, setMatches] = useState<Match[]>([])
  const [teamId, setTeamId] = useState('')
  const [matchId, setMatchId] = useState('')
  const [error, setError] = useState('')

  const [overview, setOverview] = useState<Overview | null>(null)
  const [context, setContext] = useState<TeamContext | null>(null)
  const [discipline, setDiscipline] = useState<DisciplineRow[]>([])
  const [referees, setReferees] = useState<RefereeRow[]>([])
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [subs, setSubs] = useState<SubImpact[]>([])

  useEffect(() => {
    api.get<Team[]>('/teams').then(setTeams).catch(() => {})
    api.get<Match[]>('/matches?pageSize=50').then((r: unknown) => {
      const list = Array.isArray(r) ? r : (r as { items?: Match[] }).items ?? []
      setMatches(list)
    }).catch(() => {})
    operationsService.getReferees().then(setReferees).catch(() => {})
  }, [])

  useEffect(() => {
    operationsService
      .getOverview(teamId ? Number(teamId) : undefined)
      .then(setOverview)
      .catch(() => {})
    if (teamId) {
      operationsService.getTeamContext(Number(teamId)).then(setContext).catch(() => setContext(null))
      operationsService.getDiscipline(Number(teamId)).then(setDiscipline).catch(() => {})
    } else {
      setContext(null)
      operationsService.getDiscipline().then(setDiscipline).catch(() => {})
    }
  }, [teamId])

  useEffect(() => {
    operationsService.listAlerts('PENDIENTE').then(setAlerts).catch(() => {})
  }, [])

  useEffect(() => {
    if (matchId) operationsService.getSubImpact(Number(matchId)).then(setSubs).catch(() => setSubs([]))
    else setSubs([])
  }, [matchId])

  const runCheck = async () => {
    try {
      const res = await operationsService.runAlertCheck()
      operationsService.listAlerts('PENDIENTE').then(setAlerts).catch(() => {})
      setError(res.created === 0 ? 'Sin alertas nuevas.' : `${res.created} alerta(s) generada(s).`)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Error')
    }
  }

  const card = 'rounded-lg bg-white p-4 shadow'

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <h1 className="mb-6 text-2xl font-bold sm:text-3xl">🖥️ Centro operativo</h1>

      {error && (
        <div className="mb-4 rounded-lg border border-amber-400 bg-amber-50 px-4 py-3 text-amber-800">{error}</div>
      )}

      <div className="mb-6 flex flex-wrap gap-2">
        <select value={teamId} onChange={(e) => setTeamId(e.target.value)} className={`${inputClass} min-w-[220px]`}>
          <option value="">Todos los equipos</option>
          {teams.map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
        <select value={matchId} onChange={(e) => setMatchId(e.target.value)} className={`${inputClass} min-w-[220px]`}>
          <option value="">Partido (impacto de cambios)…</option>
          {matches.map((m) => (
            <option key={m.id} value={m.id}>{m.homeTeamName} vs {m.awayTeamName}</option>
          ))}
        </select>
      </div>

      {overview && (
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            ['Plantel', overview.squad],
            ['Disponibilidad', `${overview.availabilityPct}%`],
            ['Lesiones activas', overview.activeInjuries],
            ['Promedio técnico', overview.avgTech || '—'],
            ['Goles', overview.goals],
            ['xG', overview.xg],
            ['En seguimiento', overview.watchPending],
            ['Alertas', overview.alertsPending],
          ].map(([label, value]) => (
            <div key={label} className={card}>
              <p className="text-xs text-slate-500">{label}</p>
              <p className="text-2xl font-bold text-slate-900">{value}</p>
            </div>
          ))}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {context && (
          <section className={card}>
            <h2 className="mb-2 font-bold">🏠 Análisis contextual</h2>
            <table className="w-full text-sm">
              <thead className="text-slate-500">
                <tr>
                  <th className="text-left">Contexto</th>
                  <th className="text-right">PJ</th>
                  <th className="text-right">G-E-P</th>
                  <th className="text-right">GF:GC</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                <tr>
                  <td className="py-1">Local</td>
                  <td className="py-1 text-right">{context.home.p}</td>
                  <td className="py-1 text-right">{context.home.w}-{context.home.d}-{context.home.l}</td>
                  <td className="py-1 text-right">{context.home.gf ?? 0}:{context.home.ga ?? 0}</td>
                </tr>
                <tr>
                  <td className="py-1">Visitante</td>
                  <td className="py-1 text-right">{context.away.p}</td>
                  <td className="py-1 text-right">{context.away.w}-{context.away.d}-{context.away.l}</td>
                  <td className="py-1 text-right">{context.away.gf ?? 0}:{context.away.ga ?? 0}</td>
                </tr>
              </tbody>
            </table>
            <p className="mt-2 text-sm text-slate-600">
              1T: <strong>{context.halves.gf_1t ?? 0}:{context.halves.ga_1t ?? 0}</strong> · 2T:{' '}
              <strong>{context.halves.gf_2t ?? 0}:{context.halves.ga_2t ?? 0}</strong> · Últimos 15′:{' '}
              <strong>{context.halves.gf_last15 ?? 0}:{context.halves.ga_last15 ?? 0}</strong>
            </p>
          </section>
        )}

        <section className={card}>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="font-bold">🔔 Alertas pendientes ({alerts.length})</h2>
            <button type="button" onClick={runCheck} className="rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-900">
              Ejecutar chequeo
            </button>
          </div>
          {alerts.length === 0 ? (
            <p className="text-sm text-slate-500">Sin alertas. El chequeo revisa lesiones, contratos, tarjetas, seguimientos y partidos próximos.</p>
          ) : (
            <ul className="max-h-56 divide-y divide-slate-100 overflow-y-auto text-sm">
              {alerts.map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-2 py-1.5">
                  <span>{a.message}</span>
                  <button
                    type="button"
                    onClick={async () => {
                      await operationsService.resolveAlert(a.id, 'RESUELTA')
                      setAlerts((list) => list.filter((x) => x.id !== a.id))
                    }}
                    className="shrink-0 text-xs text-green-700 hover:underline"
                  >
                    Resolver
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        {subs.length > 0 && (
          <section className={card}>
            <h2 className="mb-2 font-bold">🔄 Impacto de sustituciones</h2>
            <ul className="divide-y divide-slate-100 text-sm">
              {subs.map((s) => (
                <li key={s.id} className="py-1.5">
                  <strong>{s.minute ?? '?'}′</strong> {s.teamName}: {s.outName ?? '?'} → {s.inName ?? '?'}
                  <span className="block text-xs text-slate-500">
                    Antes {s.scoreBefore} · Después {s.scoreAfter}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className={card}>
          <h2 className="mb-2 font-bold">🟨 Disciplina {teamId ? '' : '(todos)'}</h2>
          <div className="max-h-56 overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="text-slate-500">
                <tr>
                  <th className="text-left">Jugador</th>
                  <th className="text-right">Faltas</th>
                  <th className="text-right">🟨</th>
                  <th className="text-right">🟥</th>
                  <th className="text-right">Riesgo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {discipline.slice(0, 20).map((d) => (
                  <tr key={d.playerId}>
                    <td className="py-1">{d.playerName}</td>
                    <td className="py-1 text-right">{d.fouls}</td>
                    <td className="py-1 text-right">{d.yellows}</td>
                    <td className="py-1 text-right">{d.reds}</td>
                    <td className="py-1 text-right">{d.suspensionRisk ? '⚠️' : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className={`${card} lg:col-span-2`}>
          <h2 className="mb-2 font-bold">🧑‍⚖️ Tendencias de árbitros</h2>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px] text-sm">
              <thead className="text-slate-500">
                <tr>
                  <th className="text-left">Árbitro</th>
                  <th className="text-right">Partidos</th>
                  <th className="text-right">Amarillas/p</th>
                  <th className="text-right">Rojas</th>
                  <th className="text-right">Faltas/p</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {referees.slice(0, 15).map((r) => (
                  <tr key={r.officialId}>
                    <td className="py-1 font-medium">{r.officialName}</td>
                    <td className="py-1 text-right">{r.matches}</td>
                    <td className="py-1 text-right">{r.yellowsPerMatch}</td>
                    <td className="py-1 text-right">{r.reds}</td>
                    <td className="py-1 text-right">{r.foulsPerMatch}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  )
}
