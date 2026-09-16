import { api } from './api'
import type { Club, ClubInput, ClubStaff, ClubTeam, StaffRole, TeamCategory } from '../types/club'

export const clubsService = {
  list: (params?: { search?: string; status?: string }) => {
    const qs = new URLSearchParams()
    if (params?.search) qs.set('search', params.search)
    if (params?.status) qs.set('status', params.status)
    const suffix = qs.toString() ? `?${qs.toString()}` : ''
    return api.get<Club[]>(`/clubs${suffix}`)
  },
  getById: (id: number) => api.get<Club>(`/clubs/${id}`),
  create: (data: ClubInput) => api.post<Club>('/clubs', data),
  update: (id: number, data: Partial<ClubInput>) => api.put<Club>(`/clubs/${id}`, data),
  setStatus: (id: number, status: 'active' | 'inactive') =>
    api.patch<Club>(`/clubs/${id}/status`, { status }),
  remove: (id: number) => api.delete<{ message: string }>(`/clubs/${id}`),
  getTeams: (id: number) => api.get<ClubTeam[]>(`/clubs/${id}/teams`),
  linkTeam: (id: number, teamId: number, category?: TeamCategory) =>
    api.post<ClubTeam[]>(`/clubs/${id}/teams`, { teamId, category }),
  unlinkTeam: (id: number, teamId: number) =>
    api.delete<ClubTeam[]>(`/clubs/${id}/teams/${teamId}`),
  getStaff: (id: number) => api.get<ClubStaff[]>(`/clubs/${id}/staff`),
  addStaff: (
    id: number,
    data: { fullName: string; role: StaffRole; teamCategory?: TeamCategory; startDate?: string; endDate?: string; contact?: string },
  ) => api.post<ClubStaff>(`/clubs/${id}/staff`, data),
  removeStaff: (id: number, staffId: number) =>
    api.delete<{ message: string }>(`/clubs/${id}/staff/${staffId}`),
}
