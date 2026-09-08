import { useEffect, useMemo, useState } from 'react'
import FootballPitch, { dataYToSvg } from './FootballPitch'
import PassMap, { type PassEvent } from './PassMap'
import type { MatchLineupEntry, ShotMapEntry } from '../../types/match'

type PositionSample = { minute: number | null; posX: number; posY: number; weight?: number | null }

type Mode = 'posicion' | 'heatmap' | 'recorrido' | 'pases' | 'tiros'

const MODES: { key: Mode; label: string }[] = [
  { key: 'posicion', label: 'Posición' },
  { key: 'heatmap', label: 'Mapa de calor' },
  { key: 'recorrido', label: 'Recorrido' },
  { key: 'pases', label: 'Pases' },
  { key: 'tiros', label: 'Tiros' },
]

// Cancha del jugador, componente reutilizable con selector de vista (Fase 10 del pedido: "Posición
// / Heatmap / Pases / Tiros / Recorrido", con el mismo InteractiveFootballPitch/FootballPitch base
// que el resto del sistema -- no una cancha distinta por pantalla). Recibe datos REALES ya
// cargados por el llamador (perfil del jugador = todas sus posiciones a través de partidos; vista
// de partido = sólo las de ese partido) -- cuando el array llega vacío (hoy, siempre, en toda la
// base) cada modo dice explícitamente que no hay datos, nunca dibuja algo inventado.
export default function PlayerPitchViz({
  positions,
  shots = [],
  passes = [],
  lineupPlayers = [],
  teamColor = '#2563eb',
}: {
  positions: PositionSample[]
  shots?: ShotMapEntry[]
  passes?: PassEvent[]
  lineupPlayers?: MatchLineupEntry[]
  teamColor?: string
}) {
  const [mode, setMode] = useState<Mode>('posicion')
  const [playIndex, setPlayIndex] = useState(0)
  const [playing, setPlaying] = useState(false)

  const ordered = useMemo(() => [...positions].sort((a, b) => (a.minute ?? 0) - (b.minute ?? 0)), [positions])

  useEffect(() => {
    if (!playing || mode !== 'recorrido' || ordered.length === 0) return
    const t = setInterval(() => {
      setPlayIndex((i) => {
        if (i >= ordered.length - 1) {
          setPlaying(false)
          return i
        }
        return i + 1
      })
    }, 500)
    return () => clearInterval(t)
  }, [playing, mode, ordered.length])

  return (
    <div className="rounded-lg bg-white p-4 shadow">
      <div className="mb-3 flex flex-wrap gap-2">
        {MODES.map((m) => (
          <button
            key={m.key}
            type="button"
            onClick={() => {
              setMode(m.key)
              setPlayIndex(0)
              setPlaying(false)
            }}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              mode === m.key ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      {mode === 'pases' ? (
        <PassMap passes={passes} players={lineupPlayers} />
      ) : (
        <FootballPitch>
          {mode === 'posicion' &&
            ordered.map((p, i) => (
              <circle key={i} cx={p.posX} cy={dataYToSvg(p.posY)} r={1.8} fill={teamColor} stroke="white" strokeWidth={0.3} opacity={0.85} />
            ))}

          {mode === 'heatmap' &&
            ordered.map((p, i) => (
              <circle key={i} cx={p.posX} cy={dataYToSvg(p.posY)} r={6} fill={teamColor} opacity={0.08} />
            ))}

          {mode === 'recorrido' && ordered.length > 0 && (
            <>
              <polyline
                points={ordered
                  .slice(0, playIndex + 1)
                  .map((p) => `${p.posX},${dataYToSvg(p.posY)}`)
                  .join(' ')}
                fill="none"
                stroke={teamColor}
                strokeWidth={0.6}
                opacity={0.7}
              />
              {ordered[playIndex] && (
                <circle
                  cx={ordered[playIndex].posX}
                  cy={dataYToSvg(ordered[playIndex].posY)}
                  r={2.2}
                  fill={teamColor}
                  stroke="white"
                  strokeWidth={0.4}
                />
              )}
            </>
          )}

          {mode === 'tiros' &&
            shots.map((s) => (
              <circle
                key={`${s.source}-${s.id}`}
                cx={s.posX}
                cy={dataYToSvg(s.posY)}
                r={1.8}
                fill={s.outcome === 'goal' ? '#facc15' : 'white'}
                stroke="#0f172a"
                strokeWidth={0.3}
                opacity={0.9}
              >
                <title>
                  {s.minute != null ? `${s.minute}'` : ''} — {s.outcome}
                </title>
              </circle>
            ))}
        </FootballPitch>
      )}

      {mode === 'recorrido' && (
        <div className="mt-3 flex items-center gap-3">
          <button
            type="button"
            onClick={() => setPlayIndex((i) => Math.max(0, i - 1))}
            disabled={ordered.length === 0}
            className="rounded-lg border border-slate-300 px-2 py-1 text-sm disabled:opacity-30"
          >
            ⏪
          </button>
          <button
            type="button"
            onClick={() => setPlaying((v) => !v)}
            disabled={ordered.length === 0}
            className="rounded-lg bg-slate-900 px-3 py-1 text-sm text-white disabled:opacity-30"
          >
            {playing ? '⏸' : '▶'}
          </button>
          <button
            type="button"
            onClick={() => setPlayIndex((i) => Math.min(ordered.length - 1, i + 1))}
            disabled={ordered.length === 0}
            className="rounded-lg border border-slate-300 px-2 py-1 text-sm disabled:opacity-30"
          >
            ⏩
          </button>
          <input
            type="range"
            min={0}
            max={Math.max(0, ordered.length - 1)}
            value={playIndex}
            onChange={(e) => setPlayIndex(Number(e.target.value))}
            disabled={ordered.length === 0}
            className="flex-1"
          />
          <span className="w-12 shrink-0 text-right text-xs text-slate-500 tabular-nums">
            {ordered[playIndex]?.minute != null ? `${ordered[playIndex].minute}'` : '—'}
          </span>
        </div>
      )}

      {mode !== 'pases' && ordered.length === 0 && mode !== 'tiros' && (
        <p className="mt-2 text-center text-sm text-slate-400">Sin datos de posicionamiento disponibles todavía.</p>
      )}
      {mode === 'tiros' && shots.length === 0 && (
        <p className="mt-2 text-center text-sm text-slate-400">Sin tiros con coordenadas cargadas.</p>
      )}
    </div>
  )
}
