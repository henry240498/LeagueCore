import type { ReactNode } from 'react'
import { resolveAssetUrl } from '../../lib/assetUrl'
import type { Match, MatchOfficialEntry } from '../../types/match'
import { MATCH_STATUS_LABELS } from '../../types/match'

// Cabecera del Match Center (FASE 1). Concentra la identidad del partido: contexto (competición,
// temporada, ronda), estado con indicador LIVE, marcador (actual o por períodos), escudos, y meta
// del encuentro (fecha, hora, sede, asistencia, arbitraje, TV). Nunca inventa datos: cada bloque
// aparece sólo si el dato existe, y nunca muestra un logo de otro club (silueta genérica si falta).
//
// Retrocompatible: `match` es lo único obligatorio. `officials`, `liveMinute`, `addedMinutes` y
// `actions` son opcionales para no romper usos existentes.
type Props = {
  match: Match
  officials?: MatchOfficialEntry[]
  /** Minuto en vivo derivado (p. ej. del último evento del timeline). No se inventa. */
  liveMinute?: number | null
  /** Tiempo añadido, si la fuente lo provee. */
  addedMinutes?: number | null
  /** Contexto superior (competición/temporada/ronda). Si se pasa, reemplaza al texto autogenerado
   *  — permite, por ejemplo, mostrar enlaces navegables. Si se omite, se arma desde `match`. */
  context?: ReactNode
  /** Acciones contextuales (botones) que se muestran arriba a la derecha. */
  actions?: ReactNode
}

const LIVE_STATUS = 'in_progress'

// Estados que NO son juego activo: se muestran con su etiqueta y color propio, sin marcador grande
// engañoso cuando todavía no hay resultado.
const STATUS_TONE: Record<string, string> = {
  scheduled: 'bg-slate-200 text-slate-700',
  in_progress: 'bg-red-600 text-white',
  finished: 'bg-emerald-600 text-white',
  postponed: 'bg-amber-500 text-white',
  suspended: 'bg-amber-600 text-white',
  cancelled: 'bg-slate-600 text-white',
}

function timePart(matchTime: string | null): string {
  // mssql serializa TIME como 1970-01-01THH:MM:SS.000Z -- la hora real está en los caracteres 11-16
  // del ISO string, nunca al principio (bug ya corregido antes en Reportes y en el importador).
  return matchTime ? matchTime.slice(11, 16) : ''
}

export default function MatchScoreboardHeader({ match, officials, liveMinute, addedMinutes, context, actions }: Props) {
  const isLive = match.status === LIVE_STATUS
  const isScheduled = match.status === 'scheduled'

  const fullTime = match.periodScores.find((p) => p.period === 'full_time')
  const firstHalf = match.periodScores.find((p) => p.period === 'first_half')
  const extraTime = match.periodScores.find((p) => p.period === 'extra_time')
  const penalties = match.periodScores.find((p) => p.period === 'penalties')

  // Marcador a mostrar en grande: el score actual (live) si existe, si no el resultado final por
  // períodos. Para un partido programado no hay marcador -> "vs".
  const current = match.score ?? (fullTime ? { homeScore: fullTime.homeScore, awayScore: fullTime.awayScore } : null)
  const showScore = !isScheduled && current != null

  const referee = officials?.find((o) => o.role === 'main_referee')
  const varOfficial = officials?.find((o) => o.role === 'var')
  const assistants = officials?.filter(
    (o) => o.role === 'assistant_referee_1' || o.role === 'assistant_referee_2',
  )

  const dateStr = new Date(match.matchDate).toLocaleDateString('es-PY', {
    weekday: 'short',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  })
  const timeStr = timePart(match.matchTime)

  const autoContext = [match.competitionName, match.seasonLabel, match.round, match.phase, match.groupName]
    .filter(Boolean)
    .join(' · ')

  const meta: string[] = []
  if (dateStr) meta.push(dateStr)
  if (timeStr) meta.push(timeStr)
  if (match.venueName) meta.push(`🏟️ ${match.venueName}`)
  if (match.attendance != null) meta.push(`👥 ${match.attendance.toLocaleString('es-PY')}`)
  if (referee) meta.push(`🧑‍⚖️ ${referee.officialFullName}`)
  if (assistants && assistants.length > 0) meta.push(`🚩 ${assistants.map((a) => a.officialFullName).join(', ')}`)
  if (varOfficial) meta.push(`📺 VAR: ${varOfficial.officialFullName}`)
  if (match.televised) meta.push('📡 Televisado')

  return (
    <div className="overflow-hidden rounded-xl bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white shadow">
      {/* Fila superior: contexto + estado + acciones */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 px-4 py-2 sm:px-6">
        <div className="min-w-0 truncate text-xs text-white/70 sm:text-sm">{context ?? (autoContext || 'Partido')}</div>
        <div className="flex items-center gap-2">
          <StatusBadge status={match.status} isLive={isLive} liveMinute={liveMinute} addedMinutes={addedMinutes} />
          {actions}
        </div>
      </div>

      {/* Marcador */}
      <div className="grid grid-cols-3 items-center gap-2 px-4 py-5 sm:px-8">
        <TeamBlock name={match.homeTeamName ?? 'Local'} logoUrl={match.homeTeamLogoUrl} align="right" />

        <div className="text-center">
          {showScore ? (
            <p className="text-4xl font-bold tabular-nums tracking-wide sm:text-5xl">
              {current!.homeScore} <span className="text-white/40">-</span> {current!.awayScore}
            </p>
          ) : (
            <p className="text-3xl font-semibold text-white/70 sm:text-4xl">vs</p>
          )}

          {/* Sub-marcadores por período (sólo los que existan) */}
          <div className="mt-1 space-y-0.5 text-xs text-white/60">
            {firstHalf && (
              <p>
                <span className="text-white/40">1T</span> {firstHalf.homeScore}-{firstHalf.awayScore}
              </p>
            )}
            {extraTime && (
              <p>
                <span className="text-white/40">TE</span> {extraTime.homeScore}-{extraTime.awayScore}
              </p>
            )}
            {penalties && (
              <p className="text-cyan-300">
                {penalties.homeScore}-{penalties.awayScore} <span className="text-white/50">penales</span>
              </p>
            )}
          </div>

          {match.leg && <p className="mt-1 text-[11px] uppercase tracking-wide text-white/40">{match.leg}</p>}
        </div>

        <TeamBlock name={match.awayTeamName ?? 'Visitante'} logoUrl={match.awayTeamLogoUrl} align="left" />
      </div>

      {/* Meta del encuentro */}
      {meta.length > 0 && (
        <div className="border-t border-white/10 bg-black/20 px-4 py-2 text-center text-xs text-white/70 sm:px-8">
          {meta.join('  ·  ')}
        </div>
      )}
    </div>
  )
}

function StatusBadge({
  status,
  isLive,
  liveMinute,
  addedMinutes,
}: {
  status: string
  isLive: boolean
  liveMinute?: number | null
  addedMinutes?: number | null
}) {
  const tone = STATUS_TONE[status] ?? 'bg-slate-500 text-white'
  const label = MATCH_STATUS_LABELS[status as keyof typeof MATCH_STATUS_LABELS] ?? status

  if (isLive) {
    return (
      <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${tone}`}>
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white/80" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-white" />
        </span>
        EN VIVO
        {liveMinute != null && (
          <span className="tabular-nums">
            {' '}
            {liveMinute}
            {addedMinutes != null && addedMinutes > 0 ? `+${addedMinutes}` : ''}′
          </span>
        )}
      </span>
    )
  }

  return (
    <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${tone}`}>{label}</span>
  )
}

function TeamBlock({ name, logoUrl, align }: { name: string; logoUrl?: string | null; align: 'left' | 'right' }) {
  const url = resolveAssetUrl(logoUrl)
  return (
    <div
      className={`flex items-center gap-2 sm:gap-3 ${
        align === 'right' ? 'flex-row-reverse justify-self-end text-right' : 'justify-self-start'
      }`}
    >
      <div className="flex h-12 w-12 flex-none items-center justify-center overflow-hidden rounded-full bg-white/10 sm:h-16 sm:w-16">
        {url ? <img src={url} alt={name} className="h-full w-full object-contain" /> : <span className="text-2xl">🛡️</span>}
      </div>
      <p className="truncate text-sm font-semibold sm:text-base">{name}</p>
    </div>
  )
}
