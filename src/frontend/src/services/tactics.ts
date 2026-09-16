import { api } from './api'
import type {
  CustomEvent,
  CustomEventType,
  CustomMetric,
  MetricEvaluation,
  PlayCategory,
  Possession,
  SetPiece,
  ShotMap,
  TacticalPhase,
  TacticalPlay,
  TacticalSetup,
} from '../types/tactics'

export const tacticsService = {
  // Planteos
  listSetups: (matchId: number) => api.get<TacticalSetup[]>(`/tactics/matches/${matchId}/setups`),
  saveSetup: (
    matchId: number,
    data: { teamId: number; phase: TacticalPhase; formationShape?: string | null; block?: string | null; pressing?: string | null; buildup?: string | null; notes?: string | null },
  ) => api.post<TacticalSetup[]>(`/tactics/matches/${matchId}/setups`, data),
  removeSetup: (id: number) => api.delete<{ message: string }>(`/tactics/setups/${id}`),

  // Jugadas
  listPlays: (params?: { search?: string; category?: PlayCategory | '' }) => {
    const qs = new URLSearchParams()
    if (params?.search) qs.set('search', params.search)
    if (params?.category) qs.set('category', params.category)
    const suffix = qs.toString() ? `?${qs.toString()}` : ''
    return api.get<TacticalPlay[]>(`/tactics/plays${suffix}`)
  },
  getPlay: (id: number) => api.get<TacticalPlay>(`/tactics/plays/${id}`),
  createPlay: (data: { code: string; category: PlayCategory; title: string; description?: string; diagramJson?: string; videoUrl?: string; rival?: string; result?: string }) =>
    api.post<TacticalPlay>('/tactics/plays', data),
  updatePlay: (id: number, data: Partial<TacticalPlay>) => api.put<TacticalPlay>(`/tactics/plays/${id}`, data),
  removePlay: (id: number) => api.delete<{ message: string }>(`/tactics/plays/${id}`),
  registerPlayUse: (id: number) => api.post<TacticalPlay>(`/tactics/plays/${id}/use`),

  // Posesiones
  listPossessions: (matchId: number) => api.get<Possession[]>(`/tactics/matches/${matchId}/possessions`),
  createPossession: (matchId: number, data: { teamId: number; startMinute?: number; endMinute?: number; passes?: number; progressiveDistanceM?: number; startZone?: string; endZone?: string; outcome?: string; xg?: number; note?: string }) =>
    api.post<{ id: number }>(`/tactics/matches/${matchId}/possessions`, data),
  removePossession: (matchId: number, possessionId: number) =>
    api.delete<{ message: string }>(`/tactics/matches/${matchId}/possessions/${possessionId}`),

  // Eventos personalizados
  listEventTypes: () => api.get<CustomEventType[]>('/tactics/event-types'),
  createEventType: (data: { code: string; label: string; fieldsJson?: string }) =>
    api.post<{ id: number }>('/tactics/event-types', data),
  removeEventType: (id: number) => api.delete<{ message: string }>(`/tactics/event-types/${id}`),
  listCustomEvents: (matchId: number) => api.get<CustomEvent[]>(`/tactics/matches/${matchId}/custom-events`),
  createCustomEvent: (matchId: number, data: { teamId: number; playerId?: number; eventCode: string; minute?: number; dataJson?: string; note?: string }) =>
    api.post<{ id: number }>(`/tactics/matches/${matchId}/custom-events`, data),
  removeCustomEvent: (matchId: number, eventId: number) =>
    api.delete<{ message: string }>(`/tactics/matches/${matchId}/custom-events/${eventId}`),

  // Métricas
  listMetrics: () => api.get<CustomMetric[]>('/tactics/metrics'),
  createMetric: (data: { name: string; formula: string; description?: string }) =>
    api.post<{ id: number }>('/tactics/metrics', data),
  updateMetric: (id: number, data: Partial<CustomMetric>) => api.put<CustomMetric>(`/tactics/metrics/${id}`, data),
  removeMetric: (id: number) => api.delete<{ message: string }>(`/tactics/metrics/${id}`),
  evaluateMetric: (id: number, matchId: number, teamId?: number) =>
    api.post<MetricEvaluation>(`/tactics/metrics/${id}/evaluate`, { matchId, teamId }),

  // Balón parado
  listSetPieces: (matchId: number) => api.get<SetPiece[]>(`/tactics/matches/${matchId}/set-pieces`),
  createSetPiece: (matchId: number, data: { teamId: number; kind: string; variant?: string; minute?: number; outcome?: string; playCode?: string; note?: string }) =>
    api.post<{ id: number }>(`/tactics/matches/${matchId}/set-pieces`, data),
  removeSetPiece: (matchId: number, setPieceId: number) =>
    api.delete<{ message: string }>(`/tactics/matches/${matchId}/set-pieces/${setPieceId}`),

  // Mapa de tiros
  getShotMap: (matchId: number) => api.get<ShotMap>(`/tactics/matches/${matchId}/shot-map`),
}
