import { api } from './api'

export type AskResponse = {
  intent: string
  answer: string
  sources: { type: string; id: number | null }[]
}

export type TrendResponse = {
  matches: { matchId: number; date: string; label: string; outcome: string | null }[]
  verdict: string
}

export type AiQuery = {
  id: number
  question: string
  intent: string | null
  answer: string | null
  createdAt: string
}

export const aiService = {
  ask: (question: string, teamId?: number, matchId?: number) =>
    api.post<AskResponse>('/ai/ask', { question, teamId, matchId }),
  summarize: (matchId: number) => api.post<{ title: string; content: string }>(`/ai/summarize/${matchId}`),
  trends: (teamId?: number) => api.get<TrendResponse>(`/ai/trends${teamId ? `?teamId=${teamId}` : ''}`),
  listQueries: () => api.get<AiQuery[]>('/ai/queries?limit=30'),
}
