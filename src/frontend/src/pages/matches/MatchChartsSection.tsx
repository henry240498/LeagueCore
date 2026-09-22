import { useEffect, useMemo, useState } from 'react'
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { api } from '../../services/api'
import type { ShotMapEntry } from '../../types/match'

// FASE 8 — Gráficos del partido. Todo se DERIVA de datos reales ya existentes (shot-map: tiros y
// goles con minuto, equipo y xG cuando la fuente lo trae). No se inventan valores: si no hay tiros,
// no hay gráfico; el xG acumulado sólo aparece si algún tiro tiene xG cargado. Las series calculadas
// por el sistema se rotulan como "derivadas".

type Props = {
  matchId: number
  homeTeamId: number
  homeTeamName: string
  awayTeamName: string
}

const HOME_COLOR = '#2563eb'
const AWAY_COLOR = '#dc2626'
const BUCKET = 5

export default function MatchChartsSection({ matchId, homeTeamId, homeTeamName, awayTeamName }: Props) {
  const [shots, setShots] = useState<ShotMapEntry[] | null>(null)

  useEffect(() => {
    api
      .get<ShotMapEntry[]>(`/matches/${matchId}/shot-map`)
      .then(setShots)
      .catch(() => setShots([]))
  }, [matchId])

  const momentum = useMemo(() => {
    if (!shots || shots.length === 0) return []
    const maxMin = Math.max(90, ...shots.map((s) => s.minute ?? 0))
    const buckets: { label: string; net: number }[] = []
    for (let start = 0; start <= maxMin; start += BUCKET) {
      const inBucket = shots.filter((s) => (s.minute ?? 0) >= start && (s.minute ?? 0) < start + BUCKET)
      let net = 0
      for (const s of inBucket) {
        const w = s.source === 'goal' ? 3 : 1
        net += s.teamId === homeTeamId ? w : -w
      }
      buckets.push({ label: `${start}'`, net })
    }
    return buckets
  }, [shots, homeTeamId])

  const xgSeries = useMemo(() => {
    if (!shots) return []
    const withXg = shots
      .filter((s) => s.xg != null)
      .slice()
      .sort((a, b) => (a.minute ?? 0) - (b.minute ?? 0))
    if (withXg.length === 0) return []
    let home = 0
    let away = 0
    return withXg.map((s) => {
      if (s.teamId === homeTeamId) home += s.xg ?? 0
      else away += s.xg ?? 0
      return {
        minute: s.minute ?? 0,
        home: Number(home.toFixed(2)),
        away: Number(away.toFixed(2)),
      }
    })
  }, [shots, homeTeamId])

  // Evolución de tiros: conteo acumulado de intentos (tiros + goles) por equipo a lo largo del tiempo.
  const shotsSeries = useMemo(() => {
    if (!shots || shots.length === 0) return []
    const sorted = shots.slice().sort((a, b) => (a.minute ?? 0) - (b.minute ?? 0))
    let home = 0
    let away = 0
    return sorted.map((s) => {
      if (s.teamId === homeTeamId) home += 1
      else away += 1
      return { minute: s.minute ?? 0, home, away }
    })
  }, [shots, homeTeamId])

  // xG por jugador (derivado del shot-map): sólo si hay tiros con xG cargado.
  const xgByPlayer = useMemo(() => {
    if (!shots) return []
    const map = new Map<string, number>()
    for (const s of shots) {
      if (s.xg == null) continue
      map.set(s.playerName, (map.get(s.playerName) ?? 0) + s.xg)
    }
    return Array.from(map.entries())
      .map(([name, xg]) => ({ name, xg: Number(xg.toFixed(2)) }))
      .sort((a, b) => b.xg - a.xg)
      .slice(0, 8)
  }, [shots])

  return (
    <section className="rounded-lg bg-white p-4 shadow sm:p-6">
      <div className="mb-3 flex items-center gap-2">
        <h2 className="text-lg font-bold">📈 Gráficos del partido</h2>
        <span className="rounded bg-violet-100 px-1.5 py-0.5 text-[11px] font-medium text-violet-700">derivadas</span>
      </div>

      {shots == null ? (
        <p className="py-4 text-center text-sm text-slate-400">Cargando...</p>
      ) : momentum.length === 0 ? (
        <p className="py-4 text-center text-sm text-slate-500">
          Sin tiros ni goles registrados todavía para graficar el desarrollo del partido.
        </p>
      ) : (
        <div className="space-y-6">
          <div>
            <p className="mb-1 text-sm font-medium text-slate-700">
              Momentum <span className="text-slate-400">({homeTeamName} arriba · {awayTeamName} abajo)</span>
            </p>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={momentum} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <ReferenceLine y={0} stroke="#94a3b8" />
                <Area type="monotone" dataKey="net" name="Presión (local +/− visitante)" stroke={HOME_COLOR} fill={HOME_COLOR} fillOpacity={0.25} />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div>
            <p className="mb-1 text-sm font-medium text-slate-700">Evolución de tiros (acumulado)</p>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={shotsSeries} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                <XAxis dataKey="minute" tick={{ fontSize: 11 }} unit="'" />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend />
                <Line type="stepAfter" dataKey="home" name={homeTeamName} stroke={HOME_COLOR} dot={false} />
                <Line type="stepAfter" dataKey="away" name={awayTeamName} stroke={AWAY_COLOR} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {xgSeries.length > 0 && (
            <div>
              <p className="mb-1 text-sm font-medium text-slate-700">xG acumulado</p>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={xgSeries} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                  <XAxis dataKey="minute" tick={{ fontSize: 11 }} unit="'" />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="home" name={homeTeamName} stroke={HOME_COLOR} dot={false} />
                  <Line type="monotone" dataKey="away" name={awayTeamName} stroke={AWAY_COLOR} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {xgByPlayer.length > 0 && (
            <div>
              <p className="mb-2 text-sm font-medium text-slate-700">xG por jugador</p>
              <ul className="space-y-1 text-sm">
                {xgByPlayer.map((p) => (
                  <li key={p.name} className="flex items-center justify-between gap-2">
                    <span className="min-w-0 truncate text-slate-600">{p.name}</span>
                    <span className="font-medium tabular-nums text-slate-800">{p.xg}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </section>
  )
}
