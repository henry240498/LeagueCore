import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import MatchTimeline from '../../components/pitch/MatchTimeline'
import StatBars, { type StatBarRow } from '../../components/stats/StatBars'
import { api } from '../../services/api'
import type { UseMatchLive } from '../../hooks/useMatchLive'
import type { StandingsResponse } from '../../types/season'
import {
  CARD_TYPE_LABELS,
  EVENT_PERIOD_LABELS,
  GOAL_TYPE_LABELS,
  INTERRUPTION_TYPE_LABELS,
  type Match,
  type MatchAdvancedMetric,
  type MatchCoachEntry,
  type MatchFormation,
  type MatchLineupEntry,
  type MatchListResponse,
  type MatchTeamStats,
  type TimelineEvent,
  type Venue,
} from '../../types/match'
import MatchChartsSection from './MatchChartsSection'
import MatchMapsSection from './MatchMapsSection'

// FASE 2-11 del Match Center: la experiencia de CONSULTA reinventada del partido, en una sola vista.
// Reutiliza los endpoints y componentes existentes (timeline, StatBars, MatchMapsSection, standings,
// reportes) y el hook de tiempo real `useMatchLive`. Nunca inventa datos: cada sección muestra un
// estado vacío claro cuando la fuente no tiene información.

type Props = {
  match: Match
  live: UseMatchLive
  onError: (msg: string) => void
}

const COMPARE_FIELDS: { key: keyof MatchTeamStats; label: string }[] = [
  { key: 'possessionPct', label: 'Posesión (%)' },
  { key: 'shots', label: 'Tiros' },
  { key: 'shotsOnTarget', label: 'Tiros a puerta' },
  { key: 'shotsOffTarget', label: 'Tiros fuera' },
  { key: 'shotsBlocked', label: 'Tiros bloqueados' },
  { key: 'corners', label: 'Córners' },
  { key: 'fouls', label: 'Faltas' },
  { key: 'offsidesCount', label: 'Fuera de juego' },
  { key: 'passes', label: 'Pases' },
  { key: 'passesCompleted', label: 'Pases completados' },
  { key: 'touches', label: 'Toques' },
  { key: 'throwIns', label: 'Laterales' },
  { key: 'goalKicks', label: 'Saques de arco' },
  { key: 'freeKicksDirect', label: 'Tiros libres directos' },
  { key: 'freeKicksIndirect', label: 'Tiros libres indirectos' },
]

const EVENT_FILTERS: { key: string; label: string; types: TimelineEvent['type'][] }[] = [
  { key: 'all', label: 'Todos', types: ['goal', 'card', 'substitution', 'offside', 'foul', 'interruption'] },
  { key: 'goal', label: '⚽ Goles', types: ['goal'] },
  { key: 'card', label: '🟨 Tarjetas', types: ['card'] },
  { key: 'substitution', label: '🔄 Cambios', types: ['substitution'] },
  { key: 'other', label: '⚑ Otros', types: ['offside', 'foul', 'interruption'] },
]

function timePart(t: string | null): string {
  return t ? t.slice(11, 16) : ''
}

function scoreOf(m: Match): { h: number; a: number } | null {
  if (m.score) return { h: m.score.homeScore, a: m.score.awayScore }
  const ft = m.periodScores?.find((p) => p.period === 'full_time')
  return ft ? { h: ft.homeScore, a: ft.awayScore } : null
}

export default function MatchCenterTab({ match, live, onError }: Props) {
  const { timeline, teamStats, lineups, connected, lastUpdatedAt, refresh } = live
  const isFinished = match.status === 'finished'
  const isLive = match.status === 'in_progress'

  return (
    <div className="space-y-6">
      <LiveEventToasts
        timeline={timeline}
        homeTeamId={match.homeTeamId}
        homeTeamName={match.homeTeamName ?? 'Local'}
        awayTeamName={match.awayTeamName ?? 'Visitante'}
      />

      <StatusBar
        connected={connected}
        lastUpdatedAt={lastUpdatedAt}
        isLive={isLive}
        onRefresh={refresh}
        extra={
          <>
            <ShareButton match={match} />
            <FollowButton matchId={match.id} />
          </>
        }
      />

      {isFinished && <PostMatchSummary match={match} timeline={timeline} />}

      <TimelineSection match={match} timeline={timeline} isLive={isLive} />
      <StatsSection match={match} teamStats={teamStats} />
      <LineupsSection match={match} lineups={lineups} timeline={timeline} />
      <MatchMapsSection matchId={match.id} onError={onError} />
      <MatchChartsSection
        matchId={match.id}
        homeTeamId={match.homeTeamId}
        homeTeamName={match.homeTeamName ?? 'Local'}
        awayTeamName={match.awayTeamName ?? 'Visitante'}
      />
      <AdvancedSection matchId={match.id} />
      <PlayerCompareSection lineups={lineups} />
      <MatchExtraInfo match={match} />
      <ContextSection match={match} onError={onError} />
    </div>
  )
}

// ---------------------------------------------------------------------------- Tiempo real (FASE 3)
function StatusBar({
  connected,
  lastUpdatedAt,
  isLive,
  onRefresh,
  extra,
}: {
  connected: boolean
  lastUpdatedAt: Date | null
  isLive: boolean
  onRefresh: () => void
  extra?: ReactNode
}) {
  const [, force] = useState(0)
  // Re-renderiza el "hace Ns" cada 5 s sin volver a pedir datos.
  useEffect(() => {
    const t = setInterval(() => force((n) => n + 1), 5000)
    return () => clearInterval(t)
  }, [])

  const ago = lastUpdatedAt ? Math.max(0, Math.round((Date.now() - lastUpdatedAt.getTime()) / 1000)) : null
  const stale = ago != null && ago > 30

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs">
      <div className="flex items-center gap-2">
        <span
          className={`inline-block h-2.5 w-2.5 rounded-full ${
            !connected ? 'bg-red-500' : stale ? 'bg-amber-500' : 'bg-emerald-500'
          }`}
        />
        <span className="font-medium text-slate-700">
          {!connected ? 'Sin conexión — reintentando' : isLive ? 'En vivo · actualización automática' : 'Actualizado'}
        </span>
        {ago != null && (
          <span className="text-slate-400">
            {stale ? `datos de hace ${ago}s` : `hace ${ago}s`}
          </span>
        )}
      </div>
      <div className="flex items-center gap-2">
        {extra}
        <button type="button" onClick={onRefresh} className="rounded-md border border-slate-300 px-2.5 py-1 font-medium text-slate-600 hover:bg-slate-50">
          ↻ Actualizar
        </button>
      </div>
    </div>
  )
}

// ------------------------------------------------------------- Seguir + notificaciones (FASE 12)
// No existe un sistema de notificaciones/favoritos en el backend (auditoría FASE 0), así que esto
// NO duplica ninguno: la preferencia "seguir" se guarda por-visitante en localStorage y los avisos
// de eventos nuevos son toasts en-página mientras el partido está abierto. (Un push en segundo plano
// requeriría infraestructura de servidor que hoy no existe.)
const FOLLOW_KEY = 'lc:followed-matches'

function readFollowed(): number[] {
  try {
    const raw = localStorage.getItem(FOLLOW_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === 'number') : []
  } catch {
    return []
  }
}

function FollowButton({ matchId }: { matchId: number }) {
  const [followed, setFollowed] = useState(false)
  useEffect(() => {
    setFollowed(readFollowed().includes(matchId))
  }, [matchId])

  const toggle = () => {
    try {
      const set = new Set(readFollowed())
      if (set.has(matchId)) set.delete(matchId)
      else set.add(matchId)
      localStorage.setItem(FOLLOW_KEY, JSON.stringify([...set]))
      const nowFollowing = set.has(matchId)
      setFollowed(nowFollowing)
      // Al empezar a seguir, pedimos permiso de notificaciones del navegador (avisos aunque la
      // pestaña no esté enfocada). No hay push en 2º plano con la pestaña cerrada (sin servidor).
      if (nowFollowing && typeof Notification !== 'undefined' && Notification.permission === 'default') {
        try {
          void Notification.requestPermission()
        } catch {
          // El navegador puede bloquearlo; se ignora.
        }
      }
    } catch {
      // localStorage no disponible (modo privado); se ignora.
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      className={`rounded-md px-2.5 py-1 font-medium ${
        followed ? 'bg-amber-400 text-amber-950' : 'border border-slate-300 text-slate-600 hover:bg-slate-50'
      }`}
      title={followed ? 'Dejar de seguir este partido' : 'Seguir este partido'}
    >
      {followed ? '★ Siguiendo' : '☆ Seguir'}
    </button>
  )
}

// -------------------------------------------------------------------------------- Compartir (FASE 9)
function ShareButton({ match }: { match: Match }) {
  const [done, setDone] = useState(false)
  const share = async () => {
    const url = typeof window !== 'undefined' ? window.location.href : ''
    const title = `${match.homeTeamName ?? 'Local'} vs ${match.awayTeamName ?? 'Visitante'}`
    const s = scoreOf(match)
    const text = s ? `${title} · ${s.h}-${s.a}` : title
    try {
      if (typeof navigator !== 'undefined' && navigator.share) {
        await navigator.share({ title, text, url })
        return
      }
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(url)
        setDone(true)
        setTimeout(() => setDone(false), 1500)
      }
    } catch {
      // el usuario canceló el diálogo o la API no está disponible; se ignora
    }
  }
  return (
    <button
      type="button"
      onClick={share}
      className="rounded-md border border-slate-300 px-2.5 py-1 font-medium text-slate-600 hover:bg-slate-50"
      title="Compartir partido"
    >
      {done ? '✓ Copiado' : '↗ Compartir'}
    </button>
  )
}

function toastText(e: TimelineEvent, homeTeamId: number, homeTeamName: string, awayTeamName: string): string {
  const team = e.teamId === homeTeamId ? homeTeamName : e.teamId != null ? awayTeamName : ''
  const suffix = team ? ` · ${team}` : ''
  switch (e.type) {
    case 'goal':
      return `⚽ ¡Gol! ${e.playerName ?? ''}${suffix}`
    case 'card':
      return `${e.cardType === 'red' ? '🟥' : '🟨'} ${e.playerName ?? 'Tarjeta'}${suffix}`
    case 'substitution':
      return `🔄 Cambio: ${e.playerInName ?? '—'} por ${e.playerOutName ?? '—'}${suffix}`
    default:
      return 'Nuevo evento'
  }
}

function LiveEventToasts({
  timeline,
  homeTeamId,
  homeTeamName,
  awayTeamName,
}: {
  timeline: TimelineEvent[]
  homeTeamId: number
  homeTeamName: string
  awayTeamName: string
}) {
  const [toasts, setToasts] = useState<{ key: string; text: string }[]>([])
  // null hasta el primer render: así no se disparan avisos por los eventos ya existentes al abrir.
  const seenRef = useRef<Set<string> | null>(null)
  // Timers de auto-cierre: se limpian al desmontar para no tocar estado de un componente muerto.
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([])
  useEffect(() => () => timersRef.current.forEach(clearTimeout), [])

  useEffect(() => {
    const ids = new Set(timeline.map((e) => `${e.type}-${e.id}`))
    if (seenRef.current === null) {
      seenRef.current = ids
      return
    }
    const fresh = timeline.filter(
      (e) =>
        !seenRef.current!.has(`${e.type}-${e.id}`) &&
        (e.type === 'goal' || e.type === 'card' || e.type === 'substitution'),
    )
    seenRef.current = ids
    if (fresh.length === 0) return

    const added = fresh.map((e) => ({
      key: `${e.type}-${e.id}-${Date.now()}-${Math.random()}`,
      text: toastText(e, homeTeamId, homeTeamName, awayTeamName),
    }))
    setToasts((prev) => [...prev, ...added])
    for (const t of added) {
      timersRef.current.push(
        setTimeout(() => setToasts((prev) => prev.filter((x) => x.key !== t.key)), 6000),
      )
    }

    // Notificación nativa del navegador cuando la pestaña NO está enfocada (evita duplicar el toast
    // cuando el usuario ya está mirando). Requiere permiso concedido; si no, sólo quedan los toasts.
    if (
      typeof Notification !== 'undefined' &&
      Notification.permission === 'granted' &&
      typeof document !== 'undefined' &&
      document.hidden
    ) {
      for (const t of added) {
        try {
          new Notification('LeagueCore', { body: t.text })
        } catch {
          // Algunos navegadores exigen Service Worker para notificar; se ignora.
        }
      }
    }
  }, [timeline, homeTeamId, homeTeamName, awayTeamName])

  if (toasts.length === 0) return null
  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-50 flex max-w-xs flex-col gap-2">
      {toasts.map((t) => (
        <div
          key={t.key}
          className="pointer-events-auto animate-pulse rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow-lg"
        >
          {t.text}
        </div>
      ))}
    </div>
  )
}

// ------------------------------------------------------- Información adicional / multimedia (FASE 13)
function MatchExtraInfo({ match }: { match: Match }) {
  // Ciudad y capacidad viven en dbo.venues, no en el partido: se piden sólo si hay estadio.
  const [venue, setVenue] = useState<Venue | null>(null)
  useEffect(() => {
    if (match.venueId == null) {
      setVenue(null)
      return
    }
    api.get<Venue>(`/venues/${match.venueId}`).then(setVenue).catch(() => setVenue(null))
  }, [match.venueId])

  const rows: { label: string; value: string }[] = []
  if (match.venueName) rows.push({ label: 'Estadio', value: match.venueName })
  if (venue?.city) {
    rows.push({ label: 'Ciudad', value: [venue.city, venue.country].filter(Boolean).join(', ') })
  }
  if (venue?.capacity != null) {
    rows.push({ label: 'Capacidad', value: venue.capacity.toLocaleString('es-PY') })
  }
  if (match.attendance != null) {
    rows.push({ label: 'Asistencia', value: match.attendance.toLocaleString('es-PY') })
    // Ocupación real: sólo si hay capacidad cargada (métrica derivada, no inventada).
    if (venue?.capacity) {
      rows.push({
        label: 'Ocupación',
        value: `${Math.round((match.attendance / venue.capacity) * 100)}%`,
      })
    }
  }
  if (match.weatherCondition) rows.push({ label: 'Clima', value: match.weatherCondition })
  if (match.temperatureCelsius != null) rows.push({ label: 'Temperatura', value: `${match.temperatureCelsius}°C` })
  if (match.windKmh != null) rows.push({ label: 'Viento', value: `${match.windKmh} km/h` })
  if (match.humidityPct != null) rows.push({ label: 'Humedad', value: `${match.humidityPct}%` })
  if (match.pitchCondition) rows.push({ label: 'Estado del campo', value: match.pitchCondition })
  rows.push({ label: 'Transmisión', value: match.televised ? 'Televisado' : 'No televisado' })

  return (
    <section className="rounded-lg bg-white p-4 shadow sm:p-6">
      <h2 className="mb-3 text-lg font-bold">ℹ️ Información adicional</h2>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-3">
        {rows.map((r) => (
          <div key={r.label}>
            <dt className="text-xs uppercase tracking-wide text-slate-400">{r.label}</dt>
            <dd className="font-medium text-slate-700">{r.value}</dd>
          </div>
        ))}
      </dl>
      {match.comments && <p className="mt-3 border-t border-slate-100 pt-3 text-sm text-slate-600">{match.comments}</p>}
      <p className="mt-3 text-xs text-slate-400">Videos y repeticiones del partido: pestaña "🎬 Video".</p>
    </section>
  )
}

// ------------------------------------------------------------------- Resumen post-partido (FASE 8)
function PostMatchSummary({ match, timeline }: { match: Match; timeline: TimelineEvent[] }) {
  const s = scoreOf(match)
  const goals = timeline.filter((e) => e.type === 'goal')
  const homeScorers = goals.filter((g) => g.teamId === match.homeTeamId)
  const awayScorers = goals.filter((g) => g.teamId === match.awayTeamId)
  const yellow = timeline.filter((e) => e.type === 'card' && e.cardType === 'yellow').length
  const red = timeline.filter(
    (e) => e.type === 'card' && (e.cardType === 'red' || e.cardType === 'second_yellow'),
  ).length
  const periods = match.periodScores ?? []
  const ht = periods.find((p) => p.period === 'first_half')
  const et = periods.find((p) => p.period === 'extra_time')
  const pen = periods.find((p) => p.period === 'penalties')

  const scorerLine = (list: TimelineEvent[]) =>
    list.length === 0
      ? '—'
      : list
          .map((g) => `${g.playerName ?? '—'} ${g.minute ?? '?'}′${g.ownGoal ? ' (e.c.)' : g.penalty ? ' (pen)' : ''}`)
          .join(', ')

  const periodLine = [
    ht ? `1T ${ht.homeScore}-${ht.awayScore}` : '',
    et ? `TE ${et.homeScore}-${et.awayScore}` : '',
    pen ? `Penales ${pen.homeScore}-${pen.awayScore}` : '',
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <section className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 shadow-sm sm:p-6">
      <div className="mb-2 flex items-center gap-2">
        <span className="rounded-full bg-emerald-600 px-2 py-0.5 text-xs font-semibold text-white">FINAL</span>
        <h2 className="text-lg font-bold text-emerald-900">Resumen del partido</h2>
      </div>
      <p className="text-2xl font-bold text-emerald-900">
        {match.homeTeamName ?? 'Local'} {s ? s.h : '–'} <span className="text-emerald-400">—</span> {s ? s.a : '–'}{' '}
        {match.awayTeamName ?? 'Visitante'}
      </p>
      {periodLine && <p className="mt-0.5 text-xs text-emerald-700">{periodLine}</p>}
      {goals.length > 0 && (
        <div className="mt-3 grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
          <p>
            <span className="font-semibold">⚽ {match.homeTeamName ?? 'Local'}:</span> {scorerLine(homeScorers)}
          </p>
          <p>
            <span className="font-semibold">⚽ {match.awayTeamName ?? 'Visitante'}:</span> {scorerLine(awayScorers)}
          </p>
        </div>
      )}
      <p className="mt-2 text-xs text-emerald-700">
        🟨 {yellow} amarillas · 🟥 {red} rojas · {goals.length} goles
      </p>
      <p className="mt-2 text-xs text-emerald-600">
        Debajo: desarrollo completo, estadísticas, alineaciones y gráficos.
      </p>
    </section>
  )
}

// ------------------------------------------------------------------------ Eventos + timeline (FASE 2)
function TimelineSection({ match, timeline, isLive }: { match: Match; timeline: TimelineEvent[]; isLive: boolean }) {
  const [typeFilter, setTypeFilter] = useState('all')
  const [teamFilter, setTeamFilter] = useState<'all' | 'home' | 'away'>('all')
  const [periodFilter, setPeriodFilter] = useState('all')
  const bottomRef = useRef<HTMLDivElement>(null)
  // Evento enlazado por URL (#evento-...): se resalta y se hace scroll hasta él una vez cargado.
  const [targetedAnchor, setTargetedAnchor] = useState<string | null>(null)

  useEffect(() => {
    const hash = window.location.hash.replace('#', '')
    if (!hash.startsWith('evento-') || timeline.length === 0) return
    setTargetedAnchor(hash)
    // Se espera al pintado para que el nodo exista antes de hacer scroll.
    const id = setTimeout(() => {
      document.getElementById(hash)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 100)
    return () => clearTimeout(id)
  }, [timeline.length])

  // Períodos realmente presentes en este partido (no se ofrece filtrar por uno que no ocurrió).
  const availablePeriods = useMemo(() => {
    const seen: string[] = []
    for (const e of timeline) {
      const p = e.period ?? 'first_half'
      if (!seen.includes(p)) seen.push(p)
    }
    return seen
  }, [timeline])

  const filtered = useMemo(() => {
    const allowed = EVENT_FILTERS.find((f) => f.key === typeFilter)?.types ?? []
    return timeline
      .filter((e) => allowed.includes(e.type))
      .filter((e) => {
        if (teamFilter === 'all') return true
        if (teamFilter === 'home') return e.teamId === match.homeTeamId
        return e.teamId === match.awayTeamId
      })
      .filter((e) => periodFilter === 'all' || (e.period ?? 'first_half') === periodFilter)
      .slice()
      .sort((a, b) => (a.minute ?? 0) - (b.minute ?? 0) || a.id - b.id)
  }, [timeline, typeFilter, teamFilter, periodFilter, match.homeTeamId, match.awayTeamId])

  // Agrupación por período para separar 1T / 2T / prórroga.
  const groups = useMemo(() => {
    const map = new Map<string, TimelineEvent[]>()
    for (const e of filtered) {
      const key = e.period ?? 'first_half'
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(e)
    }
    return Array.from(map.entries())
  }, [filtered])

  return (
    <section className="rounded-lg bg-white p-4 shadow sm:p-6">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-bold">📋 Desarrollo del partido</h2>
        <button
          type="button"
          onClick={() => bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })}
          className="rounded-md border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
        >
          ↓ Último evento
        </button>
      </div>

      {timeline.length > 0 && (
        <div className="mb-4">
          <MatchTimeline
            events={timeline}
            homeTeamId={match.homeTeamId}
            homeTeamName={match.homeTeamName ?? 'Local'}
            awayTeamName={match.awayTeamName ?? 'Visitante'}
          />
        </div>
      )}

      <div className="mb-3 flex flex-wrap gap-2">
        {EVENT_FILTERS.map((f) => (
          <FilterChip key={f.key} active={typeFilter === f.key} onClick={() => setTypeFilter(f.key)}>
            {f.label}
          </FilterChip>
        ))}
        <span className="mx-1 w-px bg-slate-200" />
        <FilterChip active={teamFilter === 'all'} onClick={() => setTeamFilter('all')}>
          Ambos
        </FilterChip>
        <FilterChip active={teamFilter === 'home'} onClick={() => setTeamFilter('home')}>
          {match.homeTeamName ?? 'Local'}
        </FilterChip>
        <FilterChip active={teamFilter === 'away'} onClick={() => setTeamFilter('away')}>
          {match.awayTeamName ?? 'Visitante'}
        </FilterChip>

        {/* Filtro por período: sólo se ofrecen los que realmente tuvieron eventos. */}
        {availablePeriods.length > 1 && (
          <>
            <span className="mx-1 w-px bg-slate-200" />
            <FilterChip active={periodFilter === 'all'} onClick={() => setPeriodFilter('all')}>
              Todo el partido
            </FilterChip>
            {availablePeriods.map((p) => (
              <FilterChip key={p} active={periodFilter === p} onClick={() => setPeriodFilter(p)}>
                {EVENT_PERIOD_LABELS[p] ?? p}
              </FilterChip>
            ))}
          </>
        )}
      </div>

      {filtered.length === 0 ? (
        <p className="py-6 text-center text-sm text-slate-500">
          {timeline.length === 0 ? 'Sin eventos registrados todavía.' : 'No hay eventos para este filtro.'}
        </p>
      ) : (
        <div className="space-y-4">
          {groups.map(([period, events], gi) => (
            <div key={period}>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                {EVENT_PERIOD_LABELS[period] ?? period}
              </p>
              <ul className="space-y-1.5">
                {events.map((e, i) => {
                  const isLast = isLive && gi === groups.length - 1 && i === events.length - 1
                  const anchor = eventAnchor(e)
                  const isTargeted = targetedAnchor === anchor
                  return (
                    <li
                      key={anchor}
                      id={anchor}
                      className={`group flex items-start gap-3 rounded-lg px-3 py-2 text-sm scroll-mt-24 ${
                        e.type === 'goal' ? 'bg-emerald-50' : 'bg-slate-50'
                      } ${isLast ? 'ring-2 ring-emerald-400' : ''} ${
                        isTargeted ? 'ring-2 ring-blue-500' : ''
                      }`}
                    >
                      <span className="w-10 shrink-0 text-right font-bold tabular-nums text-slate-500">
                        {e.minute ?? '?'}
                        {e.minuteExtra ? `+${e.minuteExtra}` : ''}′
                      </span>
                      <span className="shrink-0">{eventIcon(e)}</span>
                      <span className="min-w-0 flex-1">
                        <span className={e.type === 'goal' ? 'font-semibold' : ''}>{eventTitle(e)}</span>
                        {e.teamName ? <span className="text-slate-400"> · {e.teamName}</span> : ''}
                      </span>
                      <EventShareButton anchor={anchor} />
                    </li>
                  )
                })}
              </ul>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>
      )}
    </section>
  )
}

/** Ancla estable de un evento, para poder enlazarlo: /partidos/123#evento-goal-45 */
function eventAnchor(e: TimelineEvent): string {
  return `evento-${e.type}-${e.id}`
}

/** Copia el enlace directo a un evento concreto del partido. */
function EventShareButton({ anchor }: { anchor: string }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    try {
      const { origin, pathname } = window.location
      await navigator.clipboard.writeText(`${origin}${pathname}#${anchor}`)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // portapapeles no disponible; se ignora
    }
  }
  return (
    <button
      type="button"
      onClick={copy}
      aria-label="Copiar enlace a este evento"
      title="Copiar enlace a este evento"
      className="shrink-0 rounded px-1 text-xs text-slate-400 opacity-0 transition hover:bg-slate-200 hover:text-slate-600 focus:opacity-100 group-hover:opacity-100"
    >
      {copied ? '✓' : '🔗'}
    </button>
  )
}

function eventIcon(e: TimelineEvent): string {
  switch (e.type) {
    case 'goal':
      return e.ownGoal ? '🥅' : '⚽'
    case 'card':
      return e.cardType === 'red' ? '🟥' : e.cardType === 'second_yellow' ? '🟨🟥' : '🟨'
    case 'substitution':
      return '🔄'
    case 'offside':
      return '🚩'
    case 'foul':
      return '✋'
    case 'interruption':
      return e.interruptionType === 'var_review' ? '🖥️' : e.interruptionType === 'medical' ? '🚑' : '⏱'
    default:
      return '•'
  }
}

function eventTitle(e: TimelineEvent): string {
  switch (e.type) {
    case 'goal': {
      const base = e.ownGoal ? 'Gol en contra' : 'Gol'
      const who = e.playerName ?? '—'
      const assist = e.assistPlayerName ? ` (asist. ${e.assistPlayerName})` : ''
      const kind = e.penalty ? ' [penal]' : e.goalType ? ` [${GOAL_TYPE_LABELS[e.goalType] ?? e.goalType}]` : ''
      return `${base}: ${who}${assist}${kind}`
    }
    case 'card':
      return `${CARD_TYPE_LABELS[e.cardType ?? ''] ?? 'Tarjeta'}: ${e.playerName ?? '—'}`
    case 'substitution':
      return `Cambio: sale ${e.playerOutName ?? '—'}, entra ${e.playerInName ?? '—'}`
    case 'offside':
      return `Fuera de juego${e.playerName ? `: ${e.playerName}` : ''}`
    case 'foul':
      return `Falta${e.playerName ? `: ${e.playerName}` : ''}`
    case 'interruption':
      return e.interruptionType === 'var_review'
        ? 'Revisión VAR'
        : e.interruptionType === 'medical'
          ? 'Atención médica / lesión'
          : INTERRUPTION_TYPE_LABELS[e.interruptionType ?? ''] ?? 'Interrupción'
    default:
      return e.type
  }
}

function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-3 py-1 text-xs font-medium transition ${
        active ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
      }`}
    >
      {children}
    </button>
  )
}

// ------------------------------------------------------------------- Estadísticas comparadas (FASE 4)
function StatsSection({ match, teamStats }: { match: Match; teamStats: MatchTeamStats[] }) {
  const home = teamStats.find((s) => s.teamId === match.homeTeamId)
  const away = teamStats.find((s) => s.teamId === match.awayTeamId)
  const rows: StatBarRow[] = COMPARE_FIELDS.filter(
    (f) => home?.[f.key] != null || away?.[f.key] != null,
  ).map((f) => ({
    key: String(f.key),
    label: f.label,
    a: (home?.[f.key] as number | null) ?? null,
    b: (away?.[f.key] as number | null) ?? null,
  }))

  // Métrica DERIVADA de datos reales: precisión de pases = completados / totales.
  const accOf = (s?: MatchTeamStats) =>
    s && s.passes ? Math.round(((s.passesCompleted ?? 0) / s.passes) * 100) : null
  const accA = accOf(home)
  const accB = accOf(away)
  if (accA != null || accB != null) {
    rows.push({ key: 'passAccuracy', label: 'Precisión de pases (%)', a: accA, b: accB })
  }

  return (
    <section className="rounded-lg bg-white p-4 shadow sm:p-6">
      <h2 className="mb-3 text-lg font-bold">📊 Estadísticas</h2>
      {rows.length === 0 ? (
        <p className="py-6 text-center text-sm text-slate-500">
          Estadísticas de equipo no disponibles todavía. Se cargan desde la pestaña "Estadísticas".
        </p>
      ) : (
        <StatBars rows={rows} labelA={match.homeTeamName ?? 'Local'} labelB={match.awayTeamName ?? 'Visitante'} />
      )}
    </section>
  )
}

// ------------------------------------------------------------- Alineaciones + jugadores (FASE 5)
function LineupsSection({ match, lineups, timeline }: { match: Match; lineups: MatchLineupEntry[]; timeline: TimelineEvent[] }) {
  const navigate = useNavigate()
  const [coaches, setCoaches] = useState<MatchCoachEntry[]>([])
  const [formations, setFormations] = useState<MatchFormation[]>([])

  useEffect(() => {
    api.get<MatchCoachEntry[]>(`/matches/${match.id}/coaches`).then(setCoaches).catch(() => setCoaches([]))
    // Formación por equipo (reusa el endpoint existente; no crea datos).
    api.get<MatchFormation[]>(`/matches/${match.id}/formations`).then(setFormations).catch(() => setFormations([]))
  }, [match.id])

  // Jugadores que ya fueron sustituidos (derivado del timeline real, no inventado).
  const subbedOff = useMemo(() => {
    const set = new Set<number>()
    for (const e of timeline) if (e.type === 'substitution' && e.playerOutId != null) set.add(e.playerOutId)
    return set
  }, [timeline])

  if (lineups.length === 0) {
    return (
      <section className="rounded-lg bg-white p-4 shadow sm:p-6">
        <h2 className="mb-3 text-lg font-bold">👥 Alineaciones</h2>
        <p className="py-4 text-center text-sm text-slate-500">Alineaciones no disponibles todavía.</p>
      </section>
    )
  }

  const shapeOf = (teamId: number) => formations.find((f) => f.teamId === teamId)?.formationShape

  return (
    <section className="rounded-lg bg-white p-4 shadow sm:p-6">
      <h2 className="mb-4 text-lg font-bold">👥 Alineaciones</h2>
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <TeamLineup
          title={match.homeTeamName ?? 'Local'}
          formation={shapeOf(match.homeTeamId)}
          entries={lineups.filter((l) => l.teamId === match.homeTeamId)}
          coach={coaches.find((c) => c.teamId === match.homeTeamId)}
          subbedOff={subbedOff}
          onOpenPlayer={(id) => navigate(`/jugadores/${id}`)}
        />
        <TeamLineup
          title={match.awayTeamName ?? 'Visitante'}
          formation={shapeOf(match.awayTeamId)}
          entries={lineups.filter((l) => l.teamId === match.awayTeamId)}
          coach={coaches.find((c) => c.teamId === match.awayTeamId)}
          subbedOff={subbedOff}
          onOpenPlayer={(id) => navigate(`/jugadores/${id}`)}
        />
      </div>
      <p className="mt-3 text-xs text-slate-400">Formación sobre la cancha: ver la pestaña "📊 Análisis".</p>
    </section>
  )
}

function TeamLineup({
  title,
  formation,
  entries,
  coach,
  subbedOff,
  onOpenPlayer,
}: {
  title: string
  formation?: string
  entries: MatchLineupEntry[]
  coach?: MatchCoachEntry
  subbedOff: Set<number>
  onOpenPlayer: (playerId: number) => void
}) {
  const starters = entries.filter((e) => e.isStarting).sort((a, b) => (a.shirtNumber ?? 99) - (b.shirtNumber ?? 99))
  const bench = entries.filter((e) => !e.isStarting).sort((a, b) => (a.shirtNumber ?? 99) - (b.shirtNumber ?? 99))

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="font-semibold text-slate-800">{title}</h3>
        {formation && (
          <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs font-medium text-slate-600">{formation}</span>
        )}
      </div>
      {coach && <p className="mb-2 text-xs text-slate-500">DT: {coach.coachFullName}</p>}
      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Titulares</p>
      <ul className="mb-3 divide-y divide-slate-100">
        {starters.map((p) => (
          <PlayerRow key={p.id} p={p} subbed={subbedOff.has(p.playerId)} onOpen={onOpenPlayer} />
        ))}
        {starters.length === 0 && <li className="py-1.5 text-sm text-slate-400">Sin titulares cargados.</li>}
      </ul>
      {bench.length > 0 && (
        <>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Suplentes</p>
          <ul className="divide-y divide-slate-100">
            {bench.map((p) => (
              <PlayerRow key={p.id} p={p} subbed={subbedOff.has(p.playerId)} onOpen={onOpenPlayer} />
            ))}
          </ul>
        </>
      )}
    </div>
  )
}

function PlayerRow({ p, subbed, onOpen }: { p: MatchLineupEntry; subbed: boolean; onOpen: (playerId: number) => void }) {
  const badges: string[] = []
  for (let i = 0; i < p.goals; i++) badges.push('⚽')
  for (let i = 0; i < p.yellowCards; i++) badges.push('🟨')
  for (let i = 0; i < p.redCards; i++) badges.push('🟥')
  return (
    <li className="flex items-center gap-2 py-1.5 text-sm">
      <span className="w-6 shrink-0 text-right font-bold tabular-nums text-slate-400">{p.shirtNumber ?? '–'}</span>
      <button
        type="button"
        onClick={() => onOpen(p.playerId)}
        className="min-w-0 flex-1 truncate text-left text-blue-600 hover:underline"
        title="Ver perfil del jugador"
      >
        {p.playerFullName}
        {p.position ? <span className="text-slate-400"> · {p.position}</span> : ''}
      </button>
      {subbed && <span className="shrink-0 text-xs text-slate-400" title="Sustituido" aria-label="Sustituido" role="img">↩</span>}
      {p.minutesPlayed != null && <span className="shrink-0 text-xs text-slate-400">{p.minutesPlayed}′</span>}
      {badges.length > 0 && <span className="shrink-0">{badges.join('')}</span>}
    </li>
  )
}

// ----------------------------------------------------------------- Métricas avanzadas (FASE 8)
function AdvancedSection({ matchId }: { matchId: number }) {
  const [metrics, setMetrics] = useState<MatchAdvancedMetric[] | null>(null)
  useEffect(() => {
    api.get<MatchAdvancedMetric[]>(`/matches/${matchId}/advanced-metrics`).then(setMetrics).catch(() => setMetrics([]))
  }, [matchId])

  return (
    <section className="rounded-lg bg-white p-4 shadow sm:p-6">
      <div className="mb-3 flex items-center gap-2">
        <h2 className="text-lg font-bold">📐 Métricas avanzadas</h2>
        <span className="rounded bg-violet-100 px-1.5 py-0.5 text-[11px] font-medium text-violet-700">
          derivadas / externas
        </span>
      </div>
      {metrics == null ? (
        <p className="py-4 text-center text-sm text-slate-400">Cargando...</p>
      ) : metrics.length === 0 ? (
        <p className="py-4 text-center text-sm text-slate-500">
          Sin métricas avanzadas (xG, xA, PPDA…) cargadas para este partido. La estructura está lista para
          integrarlas cuando la fuente las provea.
        </p>
      ) : (
        <ul className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-3">
          {metrics.map((m) => (
            <li key={m.id} className="rounded-lg bg-slate-50 px-3 py-2">
              <p className="text-xs uppercase tracking-wide text-slate-400">{m.metricName}</p>
              <p className="font-bold tabular-nums">{m.metricValue}</p>
              {m.provider && <p className="text-[11px] text-slate-400">{m.provider}</p>}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

// ------------------------------------------------------------- Comparación de jugadores (FASE 10)
function PlayerCompareSection({ lineups }: { lineups: MatchLineupEntry[] }) {
  const [aId, setAId] = useState('')
  const [bId, setBId] = useState('')
  if (lineups.length < 2) return null

  const a = lineups.find((l) => String(l.playerId) === aId)
  const b = lineups.find((l) => String(l.playerId) === bId)
  const rows: StatBarRow[] =
    a && b
      ? [
          { key: 'goals', label: 'Goles', a: a.goals, b: b.goals },
          { key: 'assists', label: 'Asistencias', a: a.assists, b: b.assists },
          { key: 'minutes', label: 'Minutos', a: a.minutesPlayed ?? null, b: b.minutesPlayed ?? null },
          { key: 'yellow', label: 'Amarillas', a: a.yellowCards, b: b.yellowCards },
          { key: 'red', label: 'Rojas', a: a.redCards, b: b.redCards },
        ]
      : []

  return (
    <section className="rounded-lg bg-white p-4 shadow sm:p-6">
      <h2 className="mb-3 text-lg font-bold">⚖️ Comparar jugadores</h2>
      <div className="mb-4 grid grid-cols-2 gap-2">
        <PlayerSelect value={aId} onChange={setAId} lineups={lineups} placeholder="Jugador A…" />
        <PlayerSelect value={bId} onChange={setBId} lineups={lineups} placeholder="Jugador B…" />
      </div>
      {a && b ? (
        <StatBars rows={rows} labelA={a.playerFullName} labelB={b.playerFullName} />
      ) : (
        <p className="py-2 text-center text-sm text-slate-400">
          Elegí dos jugadores para comparar sus estadísticas del partido.
        </p>
      )}
    </section>
  )
}

function PlayerSelect({
  value,
  onChange,
  lineups,
  placeholder,
}: {
  value: string
  onChange: (v: string) => void
  lineups: MatchLineupEntry[]
  placeholder: string
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
    >
      <option value="">{placeholder}</option>
      {lineups.map((l) => (
        <option key={l.id} value={l.playerId}>
          {l.shirtNumber ? `${l.shirtNumber} · ` : ''}
          {l.playerFullName}
        </option>
      ))}
    </select>
  )
}

// ----------------------------------------------------------------- Contexto de competición (FASE 7)
function ContextSection({ match, onError }: { match: Match; onError: (m: string) => void }) {
  const navigate = useNavigate()
  const [standings, setStandings] = useState<StandingsResponse | null>(null)

  useEffect(() => {
    api
      .get<StandingsResponse>(`/seasons/${match.seasonId}/standings`)
      .then(setStandings)
      .catch(() => setStandings({ standings: [], pointsRule: { win: 3, draw: 1, loss: 0 }, warning: null }))
  }, [match.seasonId])

  return (
    <section className="space-y-6">
      <div className="rounded-lg bg-white p-4 shadow sm:p-6">
        <h2 className="mb-3 text-lg font-bold">🏆 Tabla de posiciones</h2>
        {standings == null ? (
          <p className="py-4 text-center text-sm text-slate-400">Cargando...</p>
        ) : standings.standings.length === 0 ? (
          <p className="py-4 text-center text-sm text-slate-500">Tabla no disponible para esta temporada.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead className="border-b border-slate-200 text-xs text-slate-500">
                <tr>
                  <th className="px-2 py-2">#</th>
                  <th className="px-2 py-2">Equipo</th>
                  <th className="px-2 py-2 text-center">PJ</th>
                  <th className="px-2 py-2 text-center">PG</th>
                  <th className="px-2 py-2 text-center">PE</th>
                  <th className="px-2 py-2 text-center">PP</th>
                  <th className="px-2 py-2 text-center">GF</th>
                  <th className="px-2 py-2 text-center">GC</th>
                  <th className="px-2 py-2 text-center">DG</th>
                  <th className="px-2 py-2 text-center font-bold">Pts</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {standings.standings.map((r) => {
                  const isMatchTeam = r.teamId === match.homeTeamId || r.teamId === match.awayTeamId
                  return (
                    <tr key={r.teamId} className={isMatchTeam ? 'bg-blue-50 font-medium' : ''}>
                      <td className="px-2 py-1.5 tabular-nums text-slate-500">{r.position}</td>
                      <td className="px-2 py-1.5">{r.teamName}</td>
                      <td className="px-2 py-1.5 text-center tabular-nums">{r.played}</td>
                      <td className="px-2 py-1.5 text-center tabular-nums">{r.won}</td>
                      <td className="px-2 py-1.5 text-center tabular-nums">{r.drawn}</td>
                      <td className="px-2 py-1.5 text-center tabular-nums">{r.lost}</td>
                      <td className="px-2 py-1.5 text-center tabular-nums">{r.goalsFor}</td>
                      <td className="px-2 py-1.5 text-center tabular-nums">{r.goalsAgainst}</td>
                      <td className="px-2 py-1.5 text-center tabular-nums">{r.goalDifference}</td>
                      <td className="px-2 py-1.5 text-center font-bold tabular-nums">{r.points}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {standings.warning && <p className="mt-2 text-xs text-amber-600">{standings.warning}</p>}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <TeamContext teamId={match.homeTeamId} teamName={match.homeTeamName ?? 'Local'} onError={onError} />
        <TeamContext teamId={match.awayTeamId} teamName={match.awayTeamName ?? 'Visitante'} onError={onError} />
      </div>

      <HeadToHeadPanel match={match} onOpenReport={() => navigate('/reportes/enfrentamientos')} />
    </section>
  )
}

// H2H inline — reutiliza el endpoint existente reports/head-to-head (teamA = local, teamB = visitante).
type H2HMatch = {
  id: number
  matchDate: string
  homeTeamId: number
  homeTeamName: string
  awayTeamName: string
  homeScore: number | null
  awayScore: number | null
  competitionName: string
}
type H2HResponse = {
  matches: H2HMatch[]
  winsA: number
  winsB: number
  draws: number
  goalsA: number
  goalsB: number
  matchesMissingScore: number
}

function HeadToHeadPanel({ match, onOpenReport }: { match: Match; onOpenReport: () => void }) {
  const [h2h, setH2h] = useState<H2HResponse | null>(null)
  useEffect(() => {
    api
      .get<H2HResponse>(`/reports/head-to-head?teamAId=${match.homeTeamId}&teamBId=${match.awayTeamId}`)
      .then(setH2h)
      .catch(() => setH2h(null))
  }, [match.homeTeamId, match.awayTeamId])

  const home = match.homeTeamName ?? 'Local'
  const away = match.awayTeamName ?? 'Visitante'

  return (
    <div className="rounded-lg bg-white p-4 shadow sm:p-6">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-bold">🤝 Enfrentamientos directos</h2>
        <button
          type="button"
          onClick={onOpenReport}
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100"
        >
          Ver historial completo
        </button>
      </div>

      {h2h == null ? (
        <p className="py-2 text-center text-sm text-slate-400">Historial no disponible.</p>
      ) : h2h.matches.length === 0 ? (
        <p className="py-2 text-center text-sm text-slate-500">Sin enfrentamientos previos registrados.</p>
      ) : (
        <>
          <div className="mb-3 grid grid-cols-3 overflow-hidden rounded-lg border border-slate-200 text-center text-sm">
            <div className="bg-blue-50 px-2 py-2">
              <p className="text-xs text-slate-500">{home}</p>
              <p className="text-lg font-bold text-blue-700">{h2h.winsA}</p>
            </div>
            <div className="px-2 py-2">
              <p className="text-xs text-slate-500">Empates</p>
              <p className="text-lg font-bold text-slate-600">{h2h.draws}</p>
            </div>
            <div className="bg-red-50 px-2 py-2">
              <p className="text-xs text-slate-500">{away}</p>
              <p className="text-lg font-bold text-red-700">{h2h.winsB}</p>
            </div>
          </div>
          <p className="mb-3 text-center text-xs text-slate-500">
            Goles totales: {home} {h2h.goalsA} — {h2h.goalsB} {away}
          </p>
          <ul className="space-y-1 text-sm">
            {h2h.matches.slice(0, 5).map((m) => (
              <li key={m.id} className="flex items-center justify-between gap-2 text-slate-600">
                <span className="min-w-0 truncate">
                  {m.matchDate.slice(0, 10)} · {m.homeTeamName} vs {m.awayTeamName}
                </span>
                <span className="shrink-0 font-medium tabular-nums">
                  {m.homeScore != null && m.awayScore != null ? `${m.homeScore}-${m.awayScore}` : '—'}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}

function TeamContext({ teamId, teamName, onError }: { teamId: number; teamName: string; onError: (m: string) => void }) {
  const [form, setForm] = useState<Match[] | null>(null)
  const [next, setNext] = useState<Match[] | null>(null)

  useEffect(() => {
    api
      .get<MatchListResponse>(`/matches?teamId=${teamId}&status=finished&sortBy=matchDate&sortDir=desc&pageSize=5`)
      .then((r) => setForm(r.items))
      .catch((err) => onError(err instanceof Error ? err.message : 'Error al cargar forma'))
    api
      .get<MatchListResponse>(`/matches?teamId=${teamId}&status=scheduled&sortBy=matchDate&sortDir=asc&pageSize=3`)
      .then((r) => setNext(r.items))
      .catch(() => setNext([]))
  }, [teamId, onError])

  return (
    <div className="rounded-lg bg-white p-4 shadow sm:p-6">
      <h3 className="mb-2 font-semibold text-slate-800">{teamName}</h3>

      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Forma reciente</p>
      {form == null ? (
        <p className="text-sm text-slate-400">Cargando...</p>
      ) : form.length === 0 ? (
        <p className="text-sm text-slate-400">Sin partidos finalizados.</p>
      ) : (
        <div className="mb-3 flex flex-wrap gap-1.5">
          {form.map((m) => {
            const s = scoreOf(m)
            const isHome = m.homeTeamId === teamId
            let letter = '·'
            let tone = 'bg-slate-200 text-slate-600'
            if (s) {
              const gf = isHome ? s.h : s.a
              const ga = isHome ? s.a : s.h
              if (gf > ga) {
                letter = 'G'
                tone = 'bg-emerald-500 text-white'
              } else if (gf === ga) {
                letter = 'E'
                tone = 'bg-slate-400 text-white'
              } else {
                letter = 'P'
                tone = 'bg-red-500 text-white'
              }
            }
            const rival = isHome ? m.awayTeamName : m.homeTeamName
            return (
              <span
                key={m.id}
                title={`${rival ?? ''} ${s ? `${s.h}-${s.a}` : ''} · ${m.matchDate.slice(0, 10)}`}
                className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${tone}`}
              >
                {letter}
              </span>
            )
          })}
        </div>
      )}

      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Próximos</p>
      {next == null ? (
        <p className="text-sm text-slate-400">Cargando...</p>
      ) : next.length === 0 ? (
        <p className="text-sm text-slate-400">Sin próximos partidos programados.</p>
      ) : (
        <ul className="space-y-1 text-sm">
          {next.map((m) => {
            const isHome = m.homeTeamId === teamId
            const rival = isHome ? m.awayTeamName : m.homeTeamName
            return (
              <li key={m.id} className="text-slate-600">
                {m.matchDate.slice(0, 10)}
                {m.matchTime ? ` ${timePart(m.matchTime)}` : ''} · {isHome ? 'vs' : '@'} {rival ?? '—'}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
