import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useAuth } from '../context/AuthContext'
import { api } from '../services/api'
import { MATCH_STATUS_LABELS, type MatchStatus } from '../types/match'

type Stats = {
  competiciones: number
  equipos: number
  partidos: number
  jugadores: number
  oficiales: number
  temporadas: number
}

type UpcomingMatch = {
  id: number
  matchDate: string
  matchTime: string | null
  competitionName: string
  homeTeamName: string
  awayTeamName: string
}

type RecentMatch = {
  id: number
  matchDate: string
  competitionName: string
  homeTeamName: string
  awayTeamName: string
  homeScore: number | null
  awayScore: number | null
}

type GoalsByTeamRow = { teamId: number; teamName: string; goals: number }
type MatchesByStatusRow = { status: string; total: number }

export default function DashboardPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [stats, setStats] = useState<Stats | null>(null)
  const [upcoming, setUpcoming] = useState<UpcomingMatch[] | null>(null)
  const [recent, setRecent] = useState<RecentMatch[] | null>(null)
  const [goalsByTeam, setGoalsByTeam] = useState<GoalsByTeamRow[] | null>(null)
  const [matchesByStatus, setMatchesByStatus] = useState<MatchesByStatusRow[] | null>(null)

  useEffect(() => {
    api.get<Stats>('/dashboard/stats').then(setStats).catch(() => setStats(null))
    api.get<UpcomingMatch[]>('/dashboard/upcoming-matches').then(setUpcoming).catch(() => setUpcoming([]))
    api.get<RecentMatch[]>('/dashboard/recent-matches').then(setRecent).catch(() => setRecent([]))
    api.get<GoalsByTeamRow[]>('/stats/goals-by-team').then(setGoalsByTeam).catch(() => setGoalsByTeam([]))
    api.get<MatchesByStatusRow[]>('/stats/matches-by-status').then(setMatchesByStatus).catch(() => setMatchesByStatus([]))
  }, [])

  const topGoalTeams = (goalsByTeam ?? []).slice(0, 8)

  return (
    <div>
      <div className="bg-gradient-to-r from-slate-900 to-slate-800 py-8 text-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <h1 className="text-3xl font-bold sm:text-4xl">📊 Dashboard</h1>
          <p className="mt-2 text-slate-300">Bienvenido a LeagueCore, {user?.username}</p>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6 lg:grid-cols-4">
          <StatCard title="Competiciones" value={stats?.competiciones} icon="🏆" link="/competiciones" />
          <StatCard title="Temporadas" value={stats?.temporadas} icon="📅" link="/temporadas" />
          <StatCard title="Equipos" value={stats?.equipos} icon="⚽" link="/equipos" />
          <StatCard title="Partidos" value={stats?.partidos} icon="🎯" link="/partidos" />
          <StatCard title="Jugadores" value={stats?.jugadores} icon="👤" link="/jugadores" />
          <StatCard title="Oficiales" value={stats?.oficiales} icon="🧑‍⚖️" link="/oficiales" />
        </div>

        <div className="mb-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="rounded-lg bg-white p-6 shadow">
            <h2 className="mb-4 text-lg font-bold">Próximos partidos</h2>
            {!upcoming && <p className="text-slate-500">Cargando...</p>}
            {upcoming?.length === 0 && <p className="text-slate-500">No hay partidos programados próximamente.</p>}
            <ul className="divide-y divide-slate-100">
              {upcoming?.map((m) => (
                <li key={m.id} className="cursor-pointer py-2" onClick={() => navigate(`/partidos/${m.id}`)}>
                  <p className="font-medium text-blue-600 hover:underline">
                    {m.homeTeamName} vs {m.awayTeamName}
                  </p>
                  <p className="text-xs text-slate-500">
                    {m.competitionName} · {m.matchDate.slice(0, 10)}
                    {m.matchTime ? ` ${m.matchTime}` : ''}
                  </p>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-lg bg-white p-6 shadow">
            <h2 className="mb-4 text-lg font-bold">Últimos resultados</h2>
            {!recent && <p className="text-slate-500">Cargando...</p>}
            {recent?.length === 0 && <p className="text-slate-500">Todavía no hay partidos finalizados.</p>}
            <ul className="divide-y divide-slate-100">
              {recent?.map((m) => (
                <li key={m.id} className="cursor-pointer py-2" onClick={() => navigate(`/partidos/${m.id}`)}>
                  <p className="font-medium text-blue-600 hover:underline">
                    {m.homeTeamName} {m.homeScore != null && m.awayScore != null ? `${m.homeScore}-${m.awayScore}` : 'vs'}{' '}
                    {m.awayTeamName}
                  </p>
                  <p className="text-xs text-slate-500">
                    {m.competitionName} · {m.matchDate.slice(0, 10)}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mb-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="rounded-lg bg-white p-6 shadow">
            <h2 className="mb-4 text-lg font-bold">Goles por equipo</h2>
            {!goalsByTeam && <p className="text-slate-500">Cargando...</p>}
            {goalsByTeam?.length === 0 && <p className="py-8 text-center text-sm text-slate-400">Sin datos todavía.</p>}
            {topGoalTeams.length > 0 && (
              <ResponsiveContainer width="100%" height={Math.max(200, topGoalTeams.length * 32)}>
                <BarChart data={topGoalTeams} layout="vertical" margin={{ left: 24 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" allowDecimals={false} />
                  <YAxis type="category" dataKey="teamName" width={140} tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Bar dataKey="goals" name="Goles" fill="#2563eb" cursor="pointer" onClick={(d: any) => navigate(`/equipos/${d.teamId}`)} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="rounded-lg bg-white p-6 shadow">
            <h2 className="mb-4 text-lg font-bold">Partidos por estado</h2>
            {!matchesByStatus && <p className="text-slate-500">Cargando...</p>}
            {matchesByStatus?.length === 0 && <p className="py-8 text-center text-sm text-slate-400">Sin datos todavía.</p>}
            {matchesByStatus && matchesByStatus.length > 0 && (
              <ResponsiveContainer width="100%" height={Math.max(200, matchesByStatus.length * 40)}>
                <BarChart
                  data={matchesByStatus.map((r) => ({ ...r, label: MATCH_STATUS_LABELS[r.status as MatchStatus] ?? r.status }))}
                  layout="vertical"
                  margin={{ left: 24 }}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" allowDecimals={false} />
                  <YAxis type="category" dataKey="label" width={100} tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Bar dataKey="total" name="Partidos" fill="#0f172a" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function StatCard({
  title,
  value,
  icon,
  link,
}: {
  title: string
  value: number | undefined
  icon: string
  link: string
}) {
  const navigate = useNavigate()
  return (
    <button
      type="button"
      onClick={() => navigate(link)}
      className="rounded-lg bg-white p-6 text-left shadow transition hover:shadow-lg"
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-slate-600">{title}</p>
          <p className="mt-2 text-3xl font-bold">{value ?? '—'}</p>
        </div>
        <span className="text-4xl">{icon}</span>
      </div>
    </button>
  )
}
