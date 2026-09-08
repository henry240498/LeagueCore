import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { resolveAssetUrl } from '../../lib/assetUrl'
import { MATCH_STATUS_LABELS } from '../../types/match'
import type { HeadToHeadMatch, HeadToHeadReport } from '../../types/report'

// Vista de enfrentamientos (concepto tomado de una imagen de referencia de tenis: dos jugadores
// con foto + H2H central + gráficos por ronda/resultado/año + tabla de partidos) -- adaptado al
// fútbol real de LeagueCore, nunca copiado literalmente. Compartido entre el Comparador
// (`ComparePage.tsx`) y el Reporte de Enfrentamientos (`HeadToHeadReportPage.tsx`) para no tener
// dos implementaciones del mismo gráfico. Todo lo mostrado sale de partidos reales -- no existe
// "por superficie" en fútbol, así que ese gráfico se reemplazó por "por localía" (local/visitante),
// el único concepto real y análogo disponible en el modelo de datos.
const TEAM_A_COLOR = '#2563eb'
const TEAM_B_COLOR = '#eab308'
const DRAW_COLOR = '#94a3b8'

type TeamRef = { id: number; name: string; logoUrl?: string | null }

// El importador RSSSF (`rsssf-import.service.ts`) escribe una clave sintética de deduplicación
// en `round` ("RSSSF-{año}-{local}-{visitante}") cuando no conoce la fecha exacta del partido --
// no es una ronda real de competición. Mostrarla como si lo fuera (en el filtro, el gráfico o la
// tabla) sería presentar un dato inventado con apariencia de dato real, así que se descarta acá.
function realRound(round: string | null): string | null {
  return round && !round.startsWith('RSSSF-') ? round : null
}

export default function HeadToHeadView({
  teamA,
  teamB,
  report,
  onChangeTeamA,
  onChangeTeamB,
  matchPath = (id) => `/partidos/${id}`,
  teamPath = (id) => `/equipos/${id}`,
}: {
  teamA: TeamRef
  teamB: TeamRef
  report: HeadToHeadReport
  onChangeTeamA?: () => void
  onChangeTeamB?: () => void
  matchPath?: (id: number) => string
  teamPath?: (id: number) => string
}) {
  const navigate = useNavigate()
  const [yearFilter, setYearFilter] = useState<string | null>(null)
  const [roundFilter, setRoundFilter] = useState<string | null>(null)
  const [competitionFilter, setCompetitionFilter] = useState<string | null>(null)

  const years = useMemo(() => Array.from(new Set(report.matches.map((m) => new Date(m.matchDate).getFullYear().toString()))).sort().reverse(), [report.matches])
  const rounds = useMemo(
    () => Array.from(new Set(report.matches.map((m) => realRound(m.round) || m.phase).filter(Boolean))) as string[],
    [report.matches],
  )
  const competitions = useMemo(() => Array.from(new Set(report.matches.map((m) => m.competitionName))), [report.matches])

  const filteredMatches = report.matches.filter((m) => {
    if (yearFilter && new Date(m.matchDate).getFullYear().toString() !== yearFilter) return false
    if (roundFilter && realRound(m.round) !== roundFilter && m.phase !== roundFilter) return false
    if (competitionFilter && m.competitionName !== competitionFilter) return false
    return true
  })

  const outcomeOf = (m: HeadToHeadMatch): 'A' | 'B' | 'draw' | null => {
    if (m.status !== 'finished' || m.homeScore == null || m.awayScore == null) return null
    const scoreA = m.homeTeamId === teamA.id ? m.homeScore : m.awayScore
    const scoreB = m.homeTeamId === teamA.id ? m.awayScore : m.homeScore
    if (scoreA > scoreB) return 'A'
    if (scoreB > scoreA) return 'B'
    return 'draw'
  }

  const donutData = [
    { name: teamA.name, value: report.winsA, color: TEAM_A_COLOR },
    { name: 'Empates', value: report.draws, color: DRAW_COLOR },
    { name: teamB.name, value: report.winsB, color: TEAM_B_COLOR },
  ].filter((d) => d.value > 0)

  const byRoundData = useMemo(() => {
    const map = new Map<string, { round: string; a: number; b: number; draw: number }>()
    for (const m of report.matches) {
      const key = realRound(m.round) || m.phase
      if (!key) continue
      const outcome = outcomeOf(m)
      if (!outcome) continue
      const row = map.get(key) ?? { round: key, a: 0, b: 0, draw: 0 }
      if (outcome === 'A') row.a++
      else if (outcome === 'B') row.b++
      else row.draw++
      map.set(key, row)
    }
    return Array.from(map.values())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [report.matches])

  const byScoreData = useMemo(() => {
    const map = new Map<string, number>()
    for (const m of report.matches) {
      if (m.status !== 'finished' || m.homeScore == null || m.awayScore == null) continue
      const scoreA = m.homeTeamId === teamA.id ? m.homeScore : m.awayScore
      const scoreB = m.homeTeamId === teamA.id ? m.awayScore : m.homeScore
      const key = `${scoreA}-${scoreB}`
      map.set(key, (map.get(key) ?? 0) + 1)
    }
    return Array.from(map.entries())
      .map(([score, count]) => ({ score, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [report.matches, teamA.id])

  const byYearData = useMemo(() => {
    const map = new Map<string, { year: string; a: number; b: number }>()
    for (const m of report.matches) {
      const outcome = outcomeOf(m)
      if (!outcome || outcome === 'draw') continue
      const year = new Date(m.matchDate).getFullYear().toString()
      const row = map.get(year) ?? { year, a: 0, b: 0 }
      if (outcome === 'A') row.a++
      else row.b++
      map.set(year, row)
    }
    return Array.from(map.values()).sort((a, b) => a.year.localeCompare(b.year))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [report.matches])

  const homeAwayData = useMemo(() => {
    let homeA = 0,
      awayA = 0
    for (const m of report.matches) {
      const outcome = outcomeOf(m)
      if (outcome !== 'A') continue
      if (m.homeTeamId === teamA.id) homeA++
      else awayA++
    }
    let homeB = 0,
      awayB = 0
    for (const m of report.matches) {
      const outcome = outcomeOf(m)
      if (outcome !== 'B') continue
      if (m.homeTeamId === teamB.id) homeB++
      else awayB++
    }
    return [
      { name: 'Como local', a: homeA, b: homeB },
      { name: 'Como visitante', a: awayA, b: awayB },
    ]
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [report.matches, teamA.id, teamB.id])

  return (
    <div className="space-y-4">
      {/* Encabezado con fotos + H2H central */}
      <div className="overflow-hidden rounded-lg bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 p-6 text-white shadow">
        <div className="grid grid-cols-3 items-center gap-3">
          <TeamHeader team={teamA} onChange={onChangeTeamA} align="right" teamPath={teamPath} />
          <div className="text-center">
            <p className="text-xs uppercase tracking-wide text-white/50">H2H</p>
            <p className="text-3xl font-bold sm:text-4xl">
              {report.winsA} - {report.winsB}
            </p>
            {report.draws > 0 && <p className="mt-1 text-xs text-white/60">{report.draws} empate(s)</p>}
          </div>
          <TeamHeader team={teamB} onChange={onChangeTeamB} align="left" teamPath={teamPath} />
        </div>
      </div>

      {report.matches.length === 0 ? (
        <p className="rounded-lg bg-amber-50 p-3 text-center text-sm text-amber-700">
          {teamA.name} y {teamB.name} no se han enfrentado todavía en los datos cargados.
        </p>
      ) : (
        <>
          {/* Filtros -- se calculan de los partidos reales, nunca una lista fija */}
          <div className="flex flex-wrap items-end gap-3 rounded-lg bg-white p-4 shadow">
            <FilterSelect label="Año" value={yearFilter} onChange={setYearFilter} options={years} />
            <FilterSelect label="Competición" value={competitionFilter} onChange={setCompetitionFilter} options={competitions} />
            <FilterSelect label="Ronda" value={roundFilter} onChange={setRoundFilter} options={rounds} />
            {(yearFilter || roundFilter || competitionFilter) && (
              <button
                type="button"
                onClick={() => {
                  setYearFilter(null)
                  setRoundFilter(null)
                  setCompetitionFilter(null)
                }}
                className="text-xs text-blue-600 hover:underline"
              >
                Limpiar filtros
              </button>
            )}
          </div>

          {report.matchesMissingScore > 0 && (
            <p className="text-center text-xs text-amber-600">
              * {report.matchesMissingScore} partido(s) finalizado(s) sin marcador cargado, no incluido(s) en los gráficos.
            </p>
          )}

          {/* Gráficos */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ChartCard title="Resultados">
          {donutData.length === 0 ? (
            <EmptyChart />
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={donutData} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80} paddingAngle={2}>
                  {donutData.map((d) => (
                    <Cell key={d.name} fill={d.color} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="Por ronda">
          {byRoundData.length === 0 ? (
            <EmptyChart />
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={byRoundData} onClick={(d: any) => d?.activeLabel && setRoundFilter(d.activeLabel)}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="round" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="a" name={teamA.name} fill={TEAM_A_COLOR} stackId="r" cursor="pointer" />
                <Bar dataKey="draw" name="Empates" fill={DRAW_COLOR} stackId="r" cursor="pointer" />
                <Bar dataKey="b" name={teamB.name} fill={TEAM_B_COLOR} stackId="r" cursor="pointer" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="Marcadores más frecuentes">
          {byScoreData.length === 0 ? (
            <EmptyChart />
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={byScoreData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="score" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="count" name="Veces" fill="#0f172a" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="Por año">
          {byYearData.length === 0 ? (
            <EmptyChart />
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={byYearData} onClick={(d: any) => d?.activeLabel && setYearFilter(d.activeLabel)}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="year" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="a" name={teamA.name} stroke={TEAM_A_COLOR} strokeWidth={2} />
                <Line type="monotone" dataKey="b" name={teamB.name} stroke={TEAM_B_COLOR} strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="Victorias como local / visitante" span>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={homeAwayData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Legend />
              <Bar dataKey="a" name={teamA.name} fill={TEAM_A_COLOR} />
              <Bar dataKey="b" name={teamB.name} fill={TEAM_B_COLOR} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Tabla de enfrentamientos -- respeta los filtros de arriba, click lleva al partido real */}
      <div className="rounded-lg bg-white p-4 shadow">
        <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-500">
          Enfrentamientos {filteredMatches.length !== report.matches.length ? `(${filteredMatches.length} de ${report.matches.length})` : ''}
        </h2>
        {filteredMatches.length === 0 ? (
          <p className="text-sm text-slate-500">Sin partidos para este filtro.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-slate-500">
                <tr>
                  <th className="py-1.5 pr-3">Fecha</th>
                  <th className="py-1.5 pr-3">Competición</th>
                  <th className="py-1.5 pr-3">Ronda</th>
                  <th className="py-1.5 pr-3">Resultado</th>
                  <th className="py-1.5 pr-3">Estadio</th>
                  <th className="py-1.5 pr-3">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredMatches.map((m) => (
                  <tr key={m.id} className="cursor-pointer hover:bg-slate-50" onClick={() => navigate(matchPath(m.id))}>
                    <td className="py-1.5 pr-3">{new Date(m.matchDate).toLocaleDateString('es-PY')}</td>
                    <td className="py-1.5 pr-3">
                      {m.competitionName} · {m.seasonLabel}
                    </td>
                    <td className="py-1.5 pr-3">{realRound(m.round) || m.phase || '—'}</td>
                    <td className="py-1.5 pr-3 font-medium text-slate-900">
                      {m.homeTeamName} {m.homeScore != null ? `${m.homeScore} - ${m.awayScore}` : 'vs'} {m.awayTeamName}
                    </td>
                    <td className="py-1.5 pr-3">{m.venueName ?? '—'}</td>
                    <td className="py-1.5 pr-3">{MATCH_STATUS_LABELS[m.status as keyof typeof MATCH_STATUS_LABELS] ?? m.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
        </>
      )}
    </div>
  )
}

function TeamHeader({
  team,
  onChange,
  align,
  teamPath,
}: {
  team: TeamRef
  onChange?: () => void
  align: 'left' | 'right'
  teamPath: (id: number) => string
}) {
  const navigate = useNavigate()
  const logoUrl = resolveAssetUrl(team.logoUrl)
  return (
    <div className={`flex flex-col items-center gap-2 ${align === 'right' ? 'justify-self-end' : 'justify-self-start'}`}>
      <button
        type="button"
        onClick={() => navigate(teamPath(team.id))}
        className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full border-2 border-white/30 bg-white/10 sm:h-20 sm:w-20"
        title="Ver equipo"
      >
        {logoUrl ? <img src={logoUrl} alt={team.name} className="h-full w-full object-contain" /> : <span className="text-3xl">🛡️</span>}
      </button>
      <p className="max-w-[8rem] truncate text-center text-sm font-semibold sm:text-base">{team.name}</p>
      {onChange && (
        <button type="button" onClick={onChange} className="text-xs text-white/60 hover:text-white hover:underline">
          Cambiar ▾
        </button>
      )}
    </div>
  )
}

function ChartCard({ title, children, span }: { title: string; children: React.ReactNode; span?: boolean }) {
  return (
    <div className={`rounded-lg bg-white p-4 shadow ${span ? 'lg:col-span-2' : ''}`}>
      <h3 className="mb-2 text-sm font-bold text-slate-700">{title}</h3>
      {children}
    </div>
  )
}

function EmptyChart() {
  return <p className="py-8 text-center text-xs text-slate-400">Sin datos suficientes todavía.</p>
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string
  value: string | null
  onChange: (v: string | null) => void
  options: string[]
}) {
  if (options.length <= 1) return null
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-slate-600">{label}</label>
      <select
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value || null)}
        className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        <option value="">Todos</option>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </div>
  )
}
