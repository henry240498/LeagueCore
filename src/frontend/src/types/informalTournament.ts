export type TournamentFormat = 'liga' | 'eliminacion' | 'grupos' | 'amistoso'
export type TournamentStatus = 'abierto' | 'en_curso' | 'finalizado'

export interface InformalTournament {
  id: number
  name: string
  sport?: string | null
  format?: TournamentFormat | null
  status: TournamentStatus
  location?: string | null
  startDate?: string | null
  endDate?: string | null
  maxTeams?: number | null
  organizer?: string | null
  contact?: string | null
  participants?: string | null
  observations?: string | null
  createdAt: string
  updatedAt: string
}

export const FORMAT_LABELS: Record<TournamentFormat, string> = {
  liga: 'Liga (todos contra todos)',
  eliminacion: 'Eliminación directa',
  grupos: 'Fase de grupos',
  amistoso: 'Amistoso',
}

export const STATUS_LABELS: Record<TournamentStatus, string> = {
  abierto: 'Abierto',
  en_curso: 'En curso',
  finalizado: 'Finalizado',
}
