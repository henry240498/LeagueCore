import { useCallback, useEffect, useRef, useState } from 'react'
import { ApiError } from '../context/AuthContext'
import { api } from '../services/api'
import type {
  Match,
  MatchLineupEntry,
  MatchOfficialEntry,
  MatchTeamStats,
  TimelineEvent,
} from '../types/match'

// FASE 3 — Tiempo real del Match Center.
// Centraliza la actualización del partido reutilizando el ÚNICO mecanismo existente en el sistema:
// polling contra los endpoints ya presentes (no hay WebSocket/SSE en el backend). Sólo refresca de
// forma periódica mientras el partido está EN VIVO (`in_progress`); si está programado o finalizado
// carga una vez. Expone estado de conexión, última actualización y un refresh manual para que la
// vista no tenga que recargarse entera.

const LIVE_POLL_MS = 10000

export type MatchLiveData = {
  match: Match | null
  officials: MatchOfficialEntry[]
  timeline: TimelineEvent[]
  teamStats: MatchTeamStats[]
  lineups: MatchLineupEntry[]
}

export type UseMatchLive = MatchLiveData & {
  loading: boolean
  error: string
  connected: boolean
  lastUpdatedAt: Date | null
  /** Minuto en vivo derivado del último evento del timeline (sólo si el partido está en vivo). */
  liveMinute: number | null
  refresh: () => void
}

function deriveLiveMinute(timeline: TimelineEvent[], status: string | undefined): number | null {
  if (status !== 'in_progress' || timeline.length === 0) return null
  const minutes = timeline.map((e) => e.minute ?? 0)
  const max = Math.max(...minutes)
  return Number.isFinite(max) && max > 0 ? max : null
}

export function useMatchLive(matchId: number): UseMatchLive {
  const [data, setData] = useState<MatchLiveData>({
    match: null,
    officials: [],
    timeline: [],
    teamStats: [],
    lineups: [],
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [connected, setConnected] = useState(true)
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null)
  // Estado del partido en un ref para que el intervalo decida si seguir refrescando sin recrearse.
  const statusRef = useRef<string | null>(null)
  // FASE 15 — evita renders inútiles: sólo se reemplaza el estado cuando los datos realmente
  // cambian entre polls (comparación por serialización). Un poll idéntico no dispara re-render.
  const lastPayloadRef = useRef<string>('')

  const load = useCallback(async () => {
    try {
      const [match, officials, timeline, teamStats, lineups] = await Promise.all([
        api.get<Match>(`/matches/${matchId}`),
        api.get<MatchOfficialEntry[]>(`/matches/${matchId}/officials`).catch(() => [] as MatchOfficialEntry[]),
        api.get<TimelineEvent[]>(`/matches/${matchId}/timeline`).catch(() => [] as TimelineEvent[]),
        api.get<MatchTeamStats[]>(`/matches/${matchId}/team-stats`).catch(() => [] as MatchTeamStats[]),
        api.get<MatchLineupEntry[]>(`/matches/${matchId}/lineups`).catch(() => [] as MatchLineupEntry[]),
      ])
      statusRef.current = match.status
      const payload = JSON.stringify({ match, officials, timeline, teamStats, lineups })
      if (payload !== lastPayloadRef.current) {
        lastPayloadRef.current = payload
        setData({ match, officials, timeline, teamStats, lineups })
        setLastUpdatedAt(new Date())
      }
      // Primitivos: React descarta el set si el valor no cambió (no fuerza re-render).
      setConnected(true)
      setError('')
    } catch (err) {
      // Falló el fetch principal del partido: marcamos desconexión pero conservamos los últimos datos.
      setConnected(false)
      setError(err instanceof ApiError ? err.message : 'Sin conexión con el servidor')
    } finally {
      setLoading(false)
    }
  }, [matchId])

  useEffect(() => {
    if (!Number.isFinite(matchId)) return
    load()
    // Dos niveles: en vivo refresca cada 10s; fuera de vivo, cada ~60s (1 de cada 6 ticks) para
    // captar la transición programado→en vivo. Un partido finalizado o cancelado ya no cambia:
    // se deja de pedir por completo para no generar requests inútiles indefinidamente.
    let tick = 0
    const timer = setInterval(() => {
      const status = statusRef.current
      if (status === 'in_progress') {
        load()
        return
      }
      if (status === 'finished' || status === 'cancelled') return
      tick += 1
      if (tick % 6 === 0) load()
    }, LIVE_POLL_MS)
    return () => clearInterval(timer)
  }, [load, matchId])

  return {
    ...data,
    loading,
    error,
    connected,
    lastUpdatedAt,
    liveMinute: deriveLiveMinute(data.timeline, data.match?.status),
    refresh: load,
  }
}
