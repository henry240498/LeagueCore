import { api } from './api'
import type {
  Alert,
  Attendance,
  DisciplineRow,
  Exercise,
  Objective,
  Overview,
  RefereeRow,
  SubImpact,
  TeamContext,
  Training,
} from '../types/operations'

export const operationsService = {
  listTrainings: (teamId?: number) =>
    api.get<Training[]>(`/operations/trainings${teamId ? `?teamId=${teamId}` : ''}`),
  createTraining: (data: { teamId: number; trainingDate: string; durationMin?: number; objective?: string; loadLevel?: string; performance?: string; notes?: string; videoUrl?: string }) =>
    api.post<{ id: number }>('/operations/trainings', data),
  removeTraining: (id: number) => api.delete<{ message: string }>(`/operations/trainings/${id}`),
  getAttendance: (trainingId: number) => api.get<Attendance[]>(`/operations/trainings/${trainingId}/attendance`),
  setAttendance: (trainingId: number, playerId: number, status: string) =>
    api.post<Attendance[]>(`/operations/trainings/${trainingId}/attendance`, { playerId, status }),

  listExercises: (search?: string) =>
    api.get<Exercise[]>(`/operations/exercises${search ? `?search=${encodeURIComponent(search)}` : ''}`),
  createExercise: (data: { name: string; category?: string; objective?: string; ageGroup?: string; durationMin?: number; playersCount?: string; material?: string; intensity?: string }) =>
    api.post<{ id: number }>('/operations/exercises', data),
  removeExercise: (id: number) => api.delete<{ message: string }>(`/operations/exercises/${id}`),

  listPlayerObjectives: (playerId: number) => api.get<Objective[]>(`/operations/players/${playerId}/objectives`),
  createPlayerObjective: (playerId: number, data: { title: string; targetValue?: number; currentValue?: number; deadline?: string }) =>
    api.post<{ id: number }>(`/operations/players/${playerId}/objectives`, data),
  updatePlayerObjective: (id: number, data: { currentValue?: number; status?: string }) =>
    api.patch<{ id: number }>(`/operations/player-objectives/${id}`, data),
  removePlayerObjective: (id: number) => api.delete<{ message: string }>(`/operations/player-objectives/${id}`),

  listTeamObjectives: (teamId: number) => api.get<Objective[]>(`/operations/teams/${teamId}/objectives`),
  createTeamObjective: (teamId: number, data: { title: string; targetValue?: number; currentValue?: number; deadline?: string }) =>
    api.post<{ id: number }>(`/operations/teams/${teamId}/objectives`, data),
  updateTeamObjective: (id: number, data: { currentValue?: number; status?: string }) =>
    api.patch<{ id: number }>(`/operations/team-objectives/${id}`, data),
  removeTeamObjective: (id: number) => api.delete<{ message: string }>(`/operations/team-objectives/${id}`),

  getTeamContext: (teamId: number) => api.get<TeamContext>(`/operations/teams/${teamId}/context`),
  getSubImpact: (matchId: number) => api.get<SubImpact[]>(`/operations/matches/${matchId}/sub-impact`),
  getDiscipline: (teamId?: number) =>
    api.get<DisciplineRow[]>(`/operations/discipline${teamId ? `?teamId=${teamId}` : ''}`),
  getReferees: () => api.get<RefereeRow[]>('/operations/referees'),

  listAlerts: (status?: string) =>
    api.get<Alert[]>(`/operations/alerts${status ? `?status=${status}` : ''}`),
  runAlertCheck: () => api.post<{ created: number; messages: string[] }>('/operations/alerts/check'),
  resolveAlert: (id: number, status: 'LEIDA' | 'RESUELTA') =>
    api.patch<{ id: number }>(`/operations/alerts/${id}`, { status }),

  getOverview: (teamId?: number, playerId?: number) => {
    const qs = new URLSearchParams()
    if (teamId) qs.set('teamId', String(teamId))
    if (playerId) qs.set('playerId', String(playerId))
    const suffix = qs.toString() ? `?${qs.toString()}` : ''
    return api.get<Overview>(`/operations/overview${suffix}`)
  },
}
