import { useEffect, useState } from 'react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import HeadToHeadView from '../components/reports/HeadToHeadView'
import StatRadar, { type RadarPoint } from '../components/stats/StatRadar'
import { resolveAssetUrl } from '../lib/assetUrl'
import { api } from '../services/api'
import type { Competition } from '../types/competition'
import type { Player } from '../types/player'
import type { HeadToHeadReport } from '../types/report'
import type { Season } from '../types/season'
import type { Team } from '../types/team'
import type { VideogameRating } from '../types/videogameRating'

type Mode = 'jugadores' | 'equipos' | 'temporadas'

type PlayerSummary = { matchesPlayed: number; goals: number; assists: number; yellowCards: number; redCards: number }
type TeamSummary = {
  played: number
  won: number
  drawn: number
  lost: number
  goalsFor: number
  goalsAgainst: number
  yellowCards: number
  redCards: number
}
type Overview = { totalMatches: number; finishedMatches: number; totalGoals: number; totalCards: number }

export default function ComparePage() {
  const [mode, setMode] = useState<Mode>('jugadores')

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <h1 className="mb-1 text-2xl font-bold sm:text-3xl">🆚 Comparador</h1>
      <p className="mb-6 text-sm text-slate-500">Compará dos jugadores, equipos o temporadas con datos reales.</p>

      <div className="mb-6 flex gap-2 border-b border-slate-200">
        {(['jugadores', 'equipos', 'temporadas'] as Mode[]).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={`border-b-2 px-3 py-2 text-sm font-medium capitalize ${
              mode === m ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            {m}
          </button>
        ))}
      </div>

      {mode === 'jugadores' && <PlayerCompare />}
      {mode === 'equipos' && <TeamCompare />}
      {mode === 'temporadas' && <SeasonCompare />}
    </div>
  )
}

function EntityPicker<T extends { id: number }>({
  label,
  getLabel,
  fetchOptions,
  selected,
  onSelect,
}: {
  label: string
  getLabel: (item: T) => string
  fetchOptions: (search: string) => Promise<T[]>
  selected: T | null
  onSelect: (item: T | null) => void
}) {
  const [query, setQuery] = useState('')
  const [options, setOptions] = useState<T[]>([])

  useEffect(() => {
    if (!query.trim()) {
      setOptions([])
      return
    }
    const t = setTimeout(() => {
      fetchOptions(query).then(setOptions).catch(() => setOptions([]))
    }, 250)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query])

  if (selected) {
    return (
      <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
        <div className="flex items-center justify-between">
          <span className="font-medium text-blue-900">{getLabel(selected)}</span>
          <button type="button" onClick={() => onSelect(null)} className="text-sm text-blue-600 hover:underline">
            Cambiar
          </button>
        </div>
      </div>
    )
  }

  return (
    <div>
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={`Buscar ${label}...`}
        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      {options.length > 0 && (
        <ul className="mt-1 max-h-48 overflow-y-auto rounded-lg border border-slate-200 bg-white shadow">
          {options.map((o) => (
            <li key={o.id}>
              <button
                type="button"
                onClick={() => {
                  onSelect(o)
                  setQuery('')
                  setOptions([])
                }}
                className="block w-full px-3 py-2 text-left text-sm hover:bg-slate-50"
              >
                {getLabel(o)}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function ComparisonTable({ rows, aLabel, bLabel }: { rows: [string, number, number][]; aLabel: string; bLabel: string }) {
  return (
    <div className="overflow-x-auto rounded-lg bg-white shadow">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-left text-slate-500">
            <th className="px-4 py-3">Métrica</th>
            <th className="px-4 py-3 text-center">{aLabel}</th>
            <th className="px-4 py-3 text-center">{bLabel}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([label, a, b]) => (
            <tr key={label} className="border-b border-slate-100 last:border-0">
              <td className="px-4 py-2 text-slate-600">{label}</td>
              <td className={`px-4 py-2 text-center font-bold ${a > b ? 'text-blue-600' : 'text-slate-900'}`}>{a}</td>
              <td className={`px-4 py-2 text-center font-bold ${b > a ? 'text-blue-600' : 'text-slate-900'}`}>{b}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function PlayerPhotoHeader({ player }: { player: Player }) {
  const url = resolveAssetUrl(player.photoUrl)
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full border-2 border-slate-200 bg-slate-100">
        {url ? <img src={url} alt={player.fullName} className="h-full w-full object-cover" /> : <span className="text-3xl">🧑</span>}
      </div>
      <p className="max-w-[9rem] truncate text-center text-sm font-semibold">{player.fullName}</p>
    </div>
  )
}

// Sin H2H de jugadores: en fútbol no existe un registro real de "partido 1 contra 1" como en
// tenis -- por eso el concepto de la imagen de referencia se traduce acá en un gráfico comparativo
// de estadísticas reales por jugador, nunca en un conteo de enfrentamientos inventado.
function PlayerCompare() {
  const [a, setA] = useState<Player | null>(null)
  const [b, setB] = useState<Player | null>(null)
  const [summaryA, setSummaryA] = useState<PlayerSummary | null>(null)
  const [summaryB, setSummaryB] = useState<PlayerSummary | null>(null)
  const [ratingA, setRatingA] = useState<VideogameRating | null>(null)
  const [ratingB, setRatingB] = useState<VideogameRating | null>(null)

  useEffect(() => {
    if (!a) return setSummaryA(null)
    api.get<PlayerSummary>(`/stats/players/${a.id}/summary`).then(setSummaryA).catch(() => setSummaryA(null))
    api
      .get<VideogameRating[]>(`/players/${a.id}/videogame-ratings`)
      .then((r) => setRatingA(r[r.length - 1] ?? null))
      .catch(() => setRatingA(null))
  }, [a])
  useEffect(() => {
    if (!b) return setSummaryB(null)
    api.get<PlayerSummary>(`/stats/players/${b.id}/summary`).then(setSummaryB).catch(() => setSummaryB(null))
    api
      .get<VideogameRating[]>(`/players/${b.id}/videogame-ratings`)
      .then((r) => setRatingB(r[r.length - 1] ?? null))
      .catch(() => setRatingB(null))
  }, [b])

  const radarData: RadarPoint[] = []
  if (ratingA && ratingB) {
    for (const catA of ratingA.categories) {
      const catB = ratingB.categories.find((c) => c.code === catA.code)
      if (catB) radarData.push({ attribute: catA.nameEs, a: catA.score ?? 0, b: catB.score ?? 0 })
    }
  }

  const fetchPlayers = async (search: string) => {
    const r = await api.get<{ items: Player[] }>(`/players?search=${encodeURIComponent(search)}&pageSize=10`)
    return r.items
  }

  const chartData =
    summaryA && summaryB
      ? [
          { metric: 'Partidos', a: summaryA.matchesPlayed, b: summaryB.matchesPlayed },
          { metric: 'Goles', a: summaryA.goals, b: summaryB.goals },
          { metric: 'Asistencias', a: summaryA.assists, b: summaryB.assists },
          { metric: 'Amarillas', a: summaryA.yellowCards, b: summaryB.yellowCards },
          { metric: 'Rojas', a: summaryA.redCards, b: summaryB.redCards },
        ]
      : []

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <EntityPicker label="jugador" getLabel={(p: Player) => p.fullName} fetchOptions={fetchPlayers} selected={a} onSelect={setA} />
        <EntityPicker label="jugador" getLabel={(p: Player) => p.fullName} fetchOptions={fetchPlayers} selected={b} onSelect={setB} />
      </div>
      {summaryA && summaryB && a && b && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4 rounded-lg bg-white p-4 shadow">
            <PlayerPhotoHeader player={a} />
            <PlayerPhotoHeader player={b} />
          </div>
          <div className="rounded-lg bg-white p-4 shadow">
            <h3 className="mb-2 text-sm font-bold text-slate-700">Comparación de estadísticas</h3>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="metric" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="a" name={a.fullName} fill="#2563eb" />
                <Bar dataKey="b" name={b.fullName} fill="#eab308" />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="rounded-lg bg-white p-4 shadow">
            <h3 className="mb-2 text-sm font-bold text-slate-700">Comparación de valoraciones</h3>
            {radarData.length > 0 ? (
              <StatRadar data={radarData} labelA={a.fullName} labelB={b.fullName} colorA="#2563eb" colorB="#eab308" />
            ) : (
              <p className="py-4 text-center text-sm text-slate-400">
                NO DISPONIBLE — falta una valoración cargada para {!ratingA ? a.fullName : b.fullName}.
              </p>
            )}
          </div>
          <ComparisonTable
            aLabel={a.fullName}
            bLabel={b.fullName}
            rows={[
              ['Partidos jugados', summaryA.matchesPlayed, summaryB.matchesPlayed],
              ['Goles', summaryA.goals, summaryB.goals],
              ['Asistencias', summaryA.assists, summaryB.assists],
              ['Amarillas', summaryA.yellowCards, summaryB.yellowCards],
              ['Rojas', summaryA.redCards, summaryB.redCards],
            ]}
          />
        </div>
      )}
    </div>
  )
}

function TeamCompare() {
  const [a, setA] = useState<Team | null>(null)
  const [b, setB] = useState<Team | null>(null)
  const [summaryA, setSummaryA] = useState<TeamSummary | null>(null)
  const [summaryB, setSummaryB] = useState<TeamSummary | null>(null)
  const [h2h, setH2h] = useState<HeadToHeadReport | null>(null)

  useEffect(() => {
    if (!a) return setSummaryA(null)
    api.get<TeamSummary>(`/stats/teams/${a.id}/summary`).then(setSummaryA).catch(() => setSummaryA(null))
  }, [a])
  useEffect(() => {
    if (!b) return setSummaryB(null)
    api.get<TeamSummary>(`/stats/teams/${b.id}/summary`).then(setSummaryB).catch(() => setSummaryB(null))
  }, [b])
  useEffect(() => {
    if (!a || !b) return setH2h(null)
    api
      .get<HeadToHeadReport>(`/reports/head-to-head?teamAId=${a.id}&teamBId=${b.id}`)
      .then(setH2h)
      .catch(() => setH2h(null))
  }, [a, b])

  const fetchTeams = async (search: string) => api.get<Team[]>(`/teams?search=${encodeURIComponent(search)}`)

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <EntityPicker label="equipo" getLabel={(t: Team) => t.name} fetchOptions={fetchTeams} selected={a} onSelect={setA} />
        <EntityPicker label="equipo" getLabel={(t: Team) => t.name} fetchOptions={fetchTeams} selected={b} onSelect={setB} />
      </div>

      {h2h && a && b && (
        <HeadToHeadView teamA={a} teamB={b} report={h2h} onChangeTeamA={() => setA(null)} onChangeTeamB={() => setB(null)} />
      )}

      {summaryA && summaryB && a && b && (
        <ComparisonTable
          aLabel={a.name}
          bLabel={b.name}
          rows={[
            ['Partidos jugados', summaryA.played, summaryB.played],
            ['Ganados', summaryA.won, summaryB.won],
            ['Empatados', summaryA.drawn, summaryB.drawn],
            ['Perdidos', summaryA.lost, summaryB.lost],
            ['Goles a favor', summaryA.goalsFor, summaryB.goalsFor],
            ['Goles en contra', summaryA.goalsAgainst, summaryB.goalsAgainst],
            ['Amarillas', summaryA.yellowCards, summaryB.yellowCards],
            ['Rojas', summaryA.redCards, summaryB.redCards],
          ]}
        />
      )}
    </div>
  )
}

function SeasonCompare() {
  const [competitions, setCompetitions] = useState<Competition[]>([])
  const [competitionId, setCompetitionId] = useState<number | null>(null)
  const [seasons, setSeasons] = useState<Season[]>([])
  const [seasonAId, setSeasonAId] = useState<number | null>(null)
  const [seasonBId, setSeasonBId] = useState<number | null>(null)
  const [overviewA, setOverviewA] = useState<Overview | null>(null)
  const [overviewB, setOverviewB] = useState<Overview | null>(null)

  useEffect(() => {
    api.get<Competition[]>('/competitions').then(setCompetitions).catch(() => setCompetitions([]))
  }, [])

  useEffect(() => {
    setSeasonAId(null)
    setSeasonBId(null)
    if (!competitionId) return setSeasons([])
    api
      .get<{ items: Season[] }>(`/seasons?competitionId=${competitionId}&pageSize=100`)
      .then((r) => setSeasons(r.items))
      .catch(() => setSeasons([]))
  }, [competitionId])

  useEffect(() => {
    if (!competitionId || !seasonAId) return setOverviewA(null)
    api.get<Overview>(`/stats/overview?competitionId=${competitionId}&seasonId=${seasonAId}`).then(setOverviewA).catch(() => setOverviewA(null))
  }, [competitionId, seasonAId])
  useEffect(() => {
    if (!competitionId || !seasonBId) return setOverviewB(null)
    api.get<Overview>(`/stats/overview?competitionId=${competitionId}&seasonId=${seasonBId}`).then(setOverviewB).catch(() => setOverviewB(null))
  }, [competitionId, seasonBId])

  const seasonALabel = seasons.find((s) => s.id === seasonAId)?.label ?? ''
  const seasonBLabel = seasons.find((s) => s.id === seasonBId)?.label ?? ''
  const competitionName = competitions.find((c) => c.id === competitionId)?.name ?? ''

  const chartData =
    overviewA && overviewB
      ? [
          { metric: 'Partidos', a: overviewA.totalMatches, b: overviewB.totalMatches },
          { metric: 'Finalizados', a: overviewA.finishedMatches, b: overviewB.finishedMatches },
          { metric: 'Goles', a: overviewA.totalGoals, b: overviewB.totalGoals },
          { metric: 'Tarjetas', a: overviewA.totalCards, b: overviewB.totalCards },
        ]
      : []

  return (
    <div className="space-y-6">
      <select
        value={competitionId ?? ''}
        onChange={(e) => setCompetitionId(e.target.value ? Number(e.target.value) : null)}
        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 sm:w-auto"
      >
        <option value="">Elegir competición...</option>
        {competitions.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>

      {competitionId && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <select
            value={seasonAId ?? ''}
            onChange={(e) => setSeasonAId(e.target.value ? Number(e.target.value) : null)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Temporada A...</option>
            {seasons.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
          <select
            value={seasonBId ?? ''}
            onChange={(e) => setSeasonBId(e.target.value ? Number(e.target.value) : null)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Temporada B...</option>
            {seasons.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
      )}

      {overviewA && overviewB && (
        <div className="space-y-4">
          <div className="rounded-lg bg-white p-4 shadow">
            <h3 className="mb-2 text-sm font-bold text-slate-700">
              {competitionName} — {seasonALabel} vs {seasonBLabel}
            </h3>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="metric" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="a" name={`Temporada ${seasonALabel}`} fill="#2563eb" />
                <Bar dataKey="b" name={`Temporada ${seasonBLabel}`} fill="#eab308" />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <ComparisonTable
            aLabel={`Temporada ${seasonALabel}`}
            bLabel={`Temporada ${seasonBLabel}`}
            rows={[
              ['Partidos', overviewA.totalMatches, overviewB.totalMatches],
              ['Finalizados', overviewA.finishedMatches, overviewB.finishedMatches],
              ['Goles', overviewA.totalGoals, overviewB.totalGoals],
              ['Tarjetas', overviewA.totalCards, overviewB.totalCards],
            ]}
          />
        </div>
      )}
    </div>
  )
}
