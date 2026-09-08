// Debe coincidir con src/backend/src/players/dto/create-player.dto.ts (PLAYER_POSITIONS) — sin
// módulo de Configuración/Parametrización todavía, este conjunto se mantiene sincronizado a mano
// entre frontend y backend. Documentado como pendiente en docs/ANALISIS_INICIAL_LEAGUECORE.md.
export const PLAYER_POSITIONS = ['Portero', 'Defensor', 'Mediocampista', 'Delantero'] as const
export type PlayerPosition = (typeof PLAYER_POSITIONS)[number]

export type PlayerTeamHistoryEntry = {
  id: number
  teamId: number
  teamName: string
  startDate: string
  endDate: string | null
  squadNumber: number | null
  seasonId: number | null
  seasonLabel: string | null
}

export type Player = {
  id: number
  firstName: string
  lastName: string
  fullName: string
  dateOfBirth: string | null
  birthPlace: string | null
  nationality: string | null
  position: string | null
  squadNumber: number | null
  heightCm: number | null
  preferredFoot: string | null
  teamId: number | null
  teamName?: string | null
  status: 'active' | 'inactive'
  photoUrl: string | null
  dataOrigin: string
  externalSource: string | null
  externalId: string | null
  externalUrl: string | null
  lastSyncedAt: string | null
  teamHistory?: PlayerTeamHistoryEntry[]
  createdAt: string
  updatedAt: string | null
}

export type PlayerInput = {
  firstName: string
  lastName: string
  dateOfBirth?: string | null
  birthPlace?: string | null
  nationality?: string | null
  position?: string | null
  squadNumber?: number | null
  heightCm?: number | null
  preferredFoot?: string | null
  teamId?: number | null
  status?: 'active' | 'inactive'
  photoUrl?: string | null
}

export type PlayerListResponse = {
  items: Player[]
  total: number
  page: number
  pageSize: number
}

export type PlayerPositionEntry = {
  id: number
  matchId: number
  period: string | null
  minute: number | null
  posX: number
  posY: number
  weight: number | null
  matchDate: string
  matchLabel: string
}

export type DuplicateMatch = {
  id: number
  fullName: string
  dateOfBirth: string | null
  nationality: string | null
  teamName: string | null
}
