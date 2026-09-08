import { useState } from 'react'
import { CARD_TYPE_LABELS, GOAL_TYPE_LABELS, INTERRUPTION_TYPE_LABELS, type TimelineEvent } from '../../types/match'

const EVENT_ICONS: Record<TimelineEvent['type'], string> = {
  goal: '⚽',
  card: '🟨',
  substitution: '🔄',
  offside: '🚩',
  foul: '✋',
  interruption: '⏱',
}

function minuteOf(e: TimelineEvent): number {
  if (e.minute == null) return 0
  return e.minute + (e.minuteExtra ? e.minuteExtra / 10 : 0)
}

function describe(e: TimelineEvent): { title: string; lines: string[] } {
  switch (e.type) {
    case 'goal':
      return {
        title: e.ownGoal ? 'Gol en contra' : 'Gol',
        lines: [
          `Jugador: ${e.playerName ?? '—'}`,
          ...(e.assistPlayerName ? [`Asistencia: ${e.assistPlayerName}`] : []),
          `Tipo: ${GOAL_TYPE_LABELS[e.goalType ?? ''] ?? 'Jugada'}`,
          ...(e.penalty ? ['Penal'] : []),
        ],
      }
    case 'card':
      return { title: CARD_TYPE_LABELS[e.cardType ?? ''] ?? 'Tarjeta', lines: [`Jugador: ${e.playerName ?? '—'}`] }
    case 'substitution':
      return { title: 'Cambio', lines: [`Sale: ${e.playerOutName ?? '—'}`, `Entra: ${e.playerInName ?? '—'}`] }
    case 'offside':
      return { title: 'Fuera de juego', lines: [e.playerName ? `Jugador: ${e.playerName}` : 'Sin jugador especificado'] }
    case 'foul':
      return { title: 'Falta', lines: [e.playerName ? `Jugador: ${e.playerName}` : 'Sin jugador especificado', ...(e.reason ? [e.reason] : [])] }
    case 'interruption':
      return { title: 'Interrupción', lines: [INTERRUPTION_TYPE_LABELS[e.interruptionType ?? ''] ?? '—', ...(e.reason ? [e.reason] : [])] }
    default:
      return { title: '', lines: [] }
  }
}

// Timeline horizontal interactiva (00'-90'+): cada evento real se ubica según su minuto real, con
// ícono por tipo; clic abre el detalle. Usa exactamente los mismos eventos que ya trae `/matches/:id/
// timeline` (goles/tarjetas/cambios/offsides/faltas/interrupciones) -- no agrega ninguna fuente de
// datos nueva, sólo una forma distinta de recorrerlos.
export default function MatchTimeline({
  events,
  homeTeamId,
  homeTeamName,
  awayTeamName,
}: {
  events: TimelineEvent[]
  homeTeamId: number
  homeTeamName: string
  awayTeamName: string
}) {
  const [selected, setSelected] = useState<TimelineEvent | null>(null)
  const maxMinute = Math.max(90, ...events.map((e) => minuteOf(e)))
  const withMinute = events.filter((e) => e.minute != null).sort((a, b) => minuteOf(a) - minuteOf(b))

  if (withMinute.length === 0) {
    return <p className="py-4 text-center text-sm text-slate-400">Sin eventos con minuto registrado todavía.</p>
  }

  return (
    <div className="rounded-lg bg-white p-4 shadow">
      <div className="mb-2 flex justify-between text-xs font-medium text-slate-500">
        <span>{homeTeamName}</span>
        <span>{awayTeamName}</span>
      </div>
      <div className="relative h-16">
        <div className="absolute left-0 right-0 top-1/2 h-0.5 -translate-y-1/2 bg-slate-200" />
        {Array.from({ length: Math.floor(maxMinute / 15) + 1 }).map((_, i) => (
          <span
            key={i}
            className="absolute top-full mt-1 -translate-x-1/2 text-[10px] text-slate-400"
            style={{ left: `${(i * 15 * 100) / maxMinute}%` }}
          >
            {i * 15}'
          </span>
        ))}
        {withMinute.map((e) => {
          const left = (minuteOf(e) * 100) / maxMinute
          const top = e.teamId === homeTeamId ? '30%' : e.teamId ? '70%' : '50%'
          return (
            <button
              key={`${e.type}-${e.id}`}
              type="button"
              onClick={() => setSelected(e)}
              title={`${e.minute}' ${describe(e).title}`}
              className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full bg-white text-base leading-none shadow transition-transform hover:z-10 hover:scale-125"
              style={{ left: `${left}%`, top }}
            >
              {EVENT_ICONS[e.type]}
            </button>
          )
        })}
      </div>

      {selected && (
        <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
          <div className="mb-1 flex items-center justify-between">
            <span className="font-bold text-slate-900">
              {selected.minute}
              {selected.minuteExtra ? `+${selected.minuteExtra}` : ''}' {EVENT_ICONS[selected.type]} {describe(selected).title}
            </span>
            <button type="button" onClick={() => setSelected(null)} className="text-slate-400 hover:text-slate-600">
              ✕
            </button>
          </div>
          {selected.teamName && <p className="mb-1 text-xs text-slate-500">{selected.teamName}</p>}
          {describe(selected).lines.map((l, i) => (
            <p key={i} className="text-slate-700">
              {l}
            </p>
          ))}
        </div>
      )}
    </div>
  )
}
