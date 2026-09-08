import { useState } from 'react'
import FootballPitch, { dataYToSvg } from './FootballPitch'
import type { MatchLineupEntry } from '../../types/match'

export type PassEvent = {
  id: number
  fromPlayerId: number
  toPlayerId: number
  fromX: number
  fromY: number
  toX: number
  toY: number
  completed: boolean
}

type Filter = 'all' | 'completed' | 'failed'

// Mapa de pases: jugador→jugador como conexiones sobre la cancha, con filtros (Todos/Completados/
// Fallados/jugador seleccionado). NO existe todavía ninguna tabla real de eventos de pase con
// coordenadas en LeagueCore (dbo.match_player_positions guarda posición, no pases) -- el componente
// está completamente implementado (filtros reales, cancha real, selección de jugador real) y acepta
// `passes` como prop para cuando exista una fuente real; mientras tanto `passes` llega vacío y se
// dice explícitamente que no hay datos, nunca se inventa una conexión.
export default function PassMap({ passes = [], players }: { passes?: PassEvent[]; players: MatchLineupEntry[] }) {
  const [filter, setFilter] = useState<Filter>('all')
  const [selectedPlayerId, setSelectedPlayerId] = useState<number | null>(null)

  const visible = passes.filter((p) => {
    if (filter === 'completed' && !p.completed) return false
    if (filter === 'failed' && p.completed) return false
    if (selectedPlayerId && p.fromPlayerId !== selectedPlayerId && p.toPlayerId !== selectedPlayerId) return false
    return true
  })

  return (
    <div className="rounded-lg bg-white p-4 shadow">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {(
          [
            ['all', 'Todos'],
            ['completed', 'Completados'],
            ['failed', 'Fallados'],
          ] as [Filter, string][]
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setFilter(key)}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
              filter === key ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {label}
          </button>
        ))}
        <select
          value={selectedPlayerId ?? ''}
          onChange={(e) => setSelectedPlayerId(e.target.value ? Number(e.target.value) : null)}
          className="ml-auto rounded-lg border border-slate-300 px-2 py-1.5 text-xs text-slate-700"
        >
          <option value="">Todos los jugadores</option>
          {players.map((p) => (
            <option key={p.playerId} value={p.playerId}>
              {p.playerFullName}
            </option>
          ))}
        </select>
      </div>

      <FootballPitch>
        {visible.map((p) => (
          <line
            key={p.id}
            x1={p.fromX}
            y1={dataYToSvg(p.fromY)}
            x2={p.toX}
            y2={dataYToSvg(p.toY)}
            stroke={p.completed ? '#22c55e' : '#ef4444'}
            strokeWidth={0.4}
            opacity={0.75}
          />
        ))}
      </FootballPitch>

      {visible.length === 0 && (
        <p className="mt-2 text-center text-sm text-slate-400">
          Sin datos de pases disponibles para este partido.
        </p>
      )}
    </div>
  )
}
