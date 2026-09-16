import { useEffect, useState } from 'react'
import FootballPitch, { dataYToSvg } from '../../components/pitch/FootballPitch'
import { ApiError } from '../../context/AuthContext'
import { api } from '../../services/api'

export type MatchMaps = {
  heat: { cols: number; rows: number; cells: { x: number; y: number; v: number }[]; max: number }
  positionSamples: number
  shots: { x: number; y: number; outcome: string; xg: number | null }[]
  goals: { x: number; y: number }[]
}

export default function MatchMapsSection({
  matchId,
  teamId,
  onError,
}: {
  matchId: number
  teamId?: number
  onError: (msg: string) => void
}) {
  const [maps, setMaps] = useState<MatchMaps | null>(null)
  const [mode, setMode] = useState<'heat' | 'shots'>('heat')

  useEffect(() => {
    api
      .get<MatchMaps>(`/insights/matches/${matchId}/maps${teamId ? `?teamId=${teamId}` : ''}`)
      .then(setMaps)
      .catch((err) => onError(err instanceof ApiError ? err.message : 'Error al cargar mapas'))
  }, [matchId, teamId, onError])

  if (!maps) return null
  const { heat } = maps
  const cellW = 100 / heat.cols
  const cellH = 100 / heat.rows

  return (
    <section className="rounded-lg bg-white p-6 shadow">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-bold">🗺️ Mapas ({maps.positionSamples} muestras)</h2>
        <div className="flex gap-1">
          {(
            [
              ['heat', 'Calor'],
              ['shots', 'Tiros'],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setMode(key)}
              className={`rounded-lg px-3 py-1 text-xs font-medium ${
                mode === key ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      {maps.positionSamples === 0 && mode === 'heat' ? (
        <p className="text-sm text-slate-500">
          Sin posiciones registradas. Cargalas en Jugadores (alineación) → posición en cancha.
        </p>
      ) : (
        <div className="max-w-md">
          <FootballPitch>
            {mode === 'heat' &&
              heat.cells.map((c, i) => (
                <rect
                  key={i}
                  x={c.x * cellW}
                  y={dataYToSvg(c.y * cellH)}
                  width={cellW}
                  height={dataYToSvg(cellH) - dataYToSvg(0)}
                  fill="#e03131"
                  opacity={heat.max ? (c.v / heat.max) * 0.65 : 0}
                />
              ))}
            {mode === 'shots' && (
              <>
                {maps.shots.map((s, i) => (
                  <g key={`s${i}`} transform={`translate(${s.x}, ${dataYToSvg(s.y)})`}>
                    <circle r={2.2} fill="#e03131" stroke="white" strokeWidth={0.5} opacity={0.9} />
                  </g>
                ))}
                {maps.goals.map((g, i) => (
                  <g key={`g${i}`} transform={`translate(${g.x}, ${dataYToSvg(g.y)})`}>
                    <circle r={3} fill="#2f9e44" stroke="white" strokeWidth={0.5} />
                  </g>
                ))}
              </>
            )}
          </FootballPitch>
        </div>
      )}
    </section>
  )
}
