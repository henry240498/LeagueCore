import { api } from './api'
import type { PhysicalRecord, PlayerInjury, PlayerProfile, TechnicalRating } from '../types/player'

export const playerProfileService = {
  getProfile: (id: number) => api.get<PlayerProfile>(`/players/${id}/profile`),
  listPhysical: (id: number, limit = 30) =>
    api.get<PhysicalRecord[]>(`/players/${id}/physical?limit=${limit}`),
  addPhysical: (id: number, data: Partial<PhysicalRecord> & { recordedAt?: string }) =>
    api.post<PhysicalRecord>(`/players/${id}/physical`, data),
  getTechnical: (id: number) => api.get<TechnicalRating[]>(`/players/${id}/technical`),
  saveTechnical: (
    id: number,
    data: { ratings: { attribute: string; value: number }[]; evaluatedAt?: string; evaluator?: string },
  ) => api.put<TechnicalRating[]>(`/players/${id}/technical`, data),
  listInjuries: (id: number) => api.get<PlayerInjury[]>(`/players/${id}/injuries`),
  addInjury: (
    id: number,
    data: { injuryType: string; bodyPart?: string; severity?: string; startDate: string; endDate?: string; note?: string },
  ) => api.post<PlayerInjury>(`/players/${id}/injuries`, data),
  updateInjury: (id: number, injuryId: number, data: Partial<PlayerInjury>) =>
    api.put<PlayerInjury>(`/players/${id}/injuries/${injuryId}`, data),
  removeInjury: (id: number, injuryId: number) =>
    api.delete<{ message: string }>(`/players/${id}/injuries/${injuryId}`),
}
