import { api } from './api'
import type {
  ComparedPlayer,
  RivalHistoryEntry,
  RivalProfile,
  RivalReport,
  ScoutedPlayer,
  ScoutingReport,
  WatchItem,
} from '../types/scouting'

export const scoutingService = {
  getRivalProfile: (teamId: number) => api.get<RivalProfile | null>(`/scouting/rivals/${teamId}/profile`),
  saveRivalProfile: (teamId: number, data: Partial<RivalProfile>) =>
    api.put<RivalProfile>(`/scouting/rivals/${teamId}/profile`, data),
  getRivalHistory: (teamId: number, limit = 10) =>
    api.get<RivalHistoryEntry[]>(`/scouting/rivals/${teamId}/history?limit=${limit}`),
  listRivalReports: (teamId: number) => api.get<RivalReport[]>(`/scouting/rivals/${teamId}/reports`),
  createRivalReport: (teamId: number, data: { title: string; content?: string; createdBy?: string }) =>
    api.post<{ id: number }>(`/scouting/rivals/${teamId}/reports`, data),
  removeRivalReport: (teamId: number, reportId: number) =>
    api.delete<{ message: string }>(`/scouting/rivals/${teamId}/reports/${reportId}`),

  searchPlayers: (params: Record<string, string | number | undefined>) => {
    const qs = new URLSearchParams()
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== '') qs.set(k, String(v))
    }
    const suffix = qs.toString() ? `?${qs.toString()}` : ''
    return api.get<ScoutedPlayer[]>(`/scouting/players${suffix}`)
  },
  comparePlayers: (ids: number[]) => api.get<ComparedPlayer[]>(`/scouting/compare?ids=${ids.join(',')}`),

  listScoutingReports: (playerId?: number) =>
    api.get<ScoutingReport[]>(`/scouting/reports${playerId ? `?playerId=${playerId}` : ''}`),
  createScoutingReport: (data: {
    playerId?: number
    externalName?: string
    position?: string
    strengths?: string
    weaknesses?: string
    recommendation?: string
    rating?: number
    scoutName?: string
    reportDate?: string
  }) => api.post<{ id: number }>('/scouting/reports', data),
  removeScoutingReport: (id: number) => api.delete<{ message: string }>(`/scouting/reports/${id}`),

  listWatchlist: (status?: string) =>
    api.get<WatchItem[]>(`/scouting/watchlist${status ? `?status=${status}` : ''}`),
  addWatchItem: (data: {
    playerId?: number
    externalName?: string
    priority?: string
    status?: string
    owner?: string
    nextObservation?: string
    notes?: string
  }) => api.post<{ id: number }>('/scouting/watchlist', data),
  updateWatchItem: (id: number, data: Partial<WatchItem>) =>
    api.put<{ id: number }>(`/scouting/watchlist/${id}`, data),
  removeWatchItem: (id: number) => api.delete<{ message: string }>(`/scouting/watchlist/${id}`),
}
