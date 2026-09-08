import { useEffect, useState } from 'react'
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { ApiError } from '../../context/AuthContext'
import { api } from '../../services/api'
import { MATCH_STATUS_LABELS, type MatchStatus } from '../../types/match'
import type {
  CardsByTeamRow,
  GoalsBySeasonRow,
  GoalsByTeamRow,
  MatchesByStatusRow,
  StatsOverview,
  TopAssistRow,
  TopScorerRow,
} from '../../types/stats'

// Piezas de estadísticas extraídas de StatisticsPage.tsx (el centro global) para poder reusarlas
// TAL CUAL desde cualquier vista con alcance competición/temporada -- misma data, mismo componente,
// nunca una segunda implementación del mismo gráfico.
export const CARD_COLOR = '#2563eb'

export function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg bg-white p-6 shadow">
      <h2 className="mb-4 text-lg font-bold">{title}</h2>
      {children}
    </div>
  )
}

export function EmptyState() {
  return <p className="py-8 text-center text-sm text-slate-400">Sin datos todavía.</p>
}

export function OverviewCards({ query, extended = false }: { query: string; extended?: boolean }) {
  const [data, setData] = useState<StatsOverview | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    setData(null)
    api
      .get<StatsOverview>(`/stats/overview?${query}`)
      .then(setData)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Error al cargar el resumen'))
  }, [query])

  if (error) return <p className="mb-6 text-red-600">{error}</p>
  if (!data) return <p className="mb-6 text-slate-500">Cargando...</p>

  const items = [
    { label: 'Partidos', value: data.totalMatches },
    { label: 'Finalizados', value: data.finishedMatches },
    { label: 'Goles', value: data.totalGoals },
    { label: 'Tarjetas', value: data.totalCards },
    ...(extended
      ? [
          { label: 'Equipos', value: data.totalTeams },
          { label: 'Jugadores', value: data.totalPlayers },
          { label: 'Penaltis convertidos', value: data.penaltyGoals },
          { label: 'Autogoles', value: data.ownGoals },
        ]
      : []),
  ]

  return (
    <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
      {items.map((it) => (
        <div key={it.label} className="rounded-lg bg-white p-4 text-center shadow">
          <div className="text-3xl font-bold text-slate-900">{it.value}</div>
          <div className="text-sm text-slate-500">{it.label}</div>
        </div>
      ))}
    </div>
  )
}

export function GoalsByTeamChart({ query, onTeamClick }: { query: string; onTeamClick: (id: number) => void }) {
  const [rows, setRows] = useState<GoalsByTeamRow[] | null>(null)
  useEffect(() => {
    setRows(null)
    api
      .get<GoalsByTeamRow[]>(`/stats/goals-by-team?${query}`)
      .then(setRows)
      .catch(() => setRows([]))
  }, [query])

  if (!rows) return <p className="text-slate-500">Cargando...</p>
  if (rows.length === 0) return <EmptyState />

  return (
    <ResponsiveContainer width="100%" height={Math.max(200, rows.length * 40)}>
      <BarChart data={rows} layout="vertical" margin={{ left: 24 }}>
        <CartesianGrid strokeDasharray="3 3" horizontal={false} />
        <XAxis type="number" allowDecimals={false} />
        <YAxis type="category" dataKey="teamName" width={140} tick={{ fontSize: 12 }} />
        <Tooltip />
        <Bar dataKey="goals" name="Goles" fill={CARD_COLOR} cursor="pointer" onClick={(d: any) => onTeamClick(d.teamId)} />
      </BarChart>
    </ResponsiveContainer>
  )
}

export function CardsByTeamChart({ query, onTeamClick }: { query: string; onTeamClick: (id: number) => void }) {
  const [rows, setRows] = useState<CardsByTeamRow[] | null>(null)
  useEffect(() => {
    setRows(null)
    api
      .get<CardsByTeamRow[]>(`/stats/cards-by-team?${query}`)
      .then(setRows)
      .catch(() => setRows([]))
  }, [query])

  if (!rows) return <p className="text-slate-500">Cargando...</p>
  if (rows.length === 0) return <EmptyState />

  return (
    <ResponsiveContainer width="100%" height={Math.max(200, rows.length * 40)}>
      <BarChart data={rows} layout="vertical" margin={{ left: 24 }}>
        <CartesianGrid strokeDasharray="3 3" horizontal={false} />
        <XAxis type="number" allowDecimals={false} />
        <YAxis type="category" dataKey="teamName" width={140} tick={{ fontSize: 12 }} />
        <Tooltip />
        <Legend />
        <Bar dataKey="yellowCards" name="Amarillas" stackId="c" fill="#eab308" cursor="pointer" onClick={(d: any) => onTeamClick(d.teamId)} />
        <Bar dataKey="redCards" name="Rojas" stackId="c" fill="#dc2626" cursor="pointer" onClick={(d: any) => onTeamClick(d.teamId)} />
      </BarChart>
    </ResponsiveContainer>
  )
}

export function MatchesByStatusChart({ query }: { query: string }) {
  const [rows, setRows] = useState<MatchesByStatusRow[] | null>(null)
  useEffect(() => {
    setRows(null)
    api
      .get<MatchesByStatusRow[]>(`/stats/matches-by-status?${query}`)
      .then(setRows)
      .catch(() => setRows([]))
  }, [query])

  if (!rows) return <p className="text-slate-500">Cargando...</p>
  if (rows.length === 0) return <EmptyState />

  const data = rows.map((r) => ({ ...r, label: MATCH_STATUS_LABELS[r.status as MatchStatus] ?? r.status }))

  return (
    <ResponsiveContainer width="100%" height={Math.max(200, data.length * 40)}>
      <BarChart data={data} layout="vertical" margin={{ left: 24 }}>
        <CartesianGrid strokeDasharray="3 3" horizontal={false} />
        <XAxis type="number" allowDecimals={false} />
        <YAxis type="category" dataKey="label" width={100} tick={{ fontSize: 12 }} />
        <Tooltip />
        <Bar dataKey="total" name="Partidos" fill="#0f172a" />
      </BarChart>
    </ResponsiveContainer>
  )
}

export function GoalsBySeasonChart({ competitionId }: { competitionId: number }) {
  const [rows, setRows] = useState<GoalsBySeasonRow[] | null>(null)
  useEffect(() => {
    setRows(null)
    api
      .get<GoalsBySeasonRow[]>(`/stats/goals-by-season?competitionId=${competitionId}`)
      .then(setRows)
      .catch(() => setRows([]))
  }, [competitionId])

  if (!rows) return <p className="text-slate-500">Cargando...</p>
  if (rows.length === 0) return <EmptyState />

  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={rows.map((r) => ({ ...r, label: `T. ${r.seasonLabel}` }))}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="label" tick={{ fontSize: 12 }} />
        <YAxis allowDecimals={false} />
        <Tooltip />
        <Line type="monotone" dataKey="goals" name="Goles" stroke={CARD_COLOR} strokeWidth={2} />
      </LineChart>
    </ResponsiveContainer>
  )
}

export function TopListCard({
  title,
  query,
  kind,
  onPlayerClick,
}: {
  title: string
  query: string
  kind: 'scorers' | 'assists'
  onPlayerClick: (id: number) => void
}) {
  const [rows, setRows] = useState<(TopScorerRow | TopAssistRow)[] | null>(null)

  useEffect(() => {
    setRows(null)
    const path = kind === 'scorers' ? 'top-scorers' : 'top-assists'
    api
      .get<(TopScorerRow | TopAssistRow)[]>(`/stats/${path}?${query}`)
      .then(setRows)
      .catch(() => setRows([]))
  }, [query, kind])

  return (
    <div className="rounded-lg bg-white p-6 shadow">
      <h2 className="mb-4 text-lg font-bold">{title}</h2>
      {!rows && <p className="text-slate-500">Cargando...</p>}
      {rows && rows.length === 0 && <EmptyState />}
      {rows && rows.length > 0 && (
        <ol className="divide-y divide-slate-100">
          {rows.map((r, i) => (
            <li key={r.playerId} className="flex items-center justify-between py-2">
              <div className="flex items-center gap-3">
                <span className="w-5 text-sm text-slate-400">{i + 1}</span>
                <button type="button" onClick={() => onPlayerClick(r.playerId)} className="font-medium text-blue-600 hover:underline">
                  {r.playerName}
                </button>
                <span className="text-sm text-slate-500">{r.teamName}</span>
              </div>
              <span className="font-bold text-slate-900">{kind === 'scorers' ? (r as TopScorerRow).goals : (r as TopAssistRow).assists}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}
