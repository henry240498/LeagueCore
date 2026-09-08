export type RefereeReportRow = {
  officialId: number
  officialName: string
  nationality: string | null
  matchesDirected: number
  yellowCards: number
  redCards: number
  fouls: number
  penalties: number
}

export type RefereeMatchRow = {
  id: number
  matchDate: string
  competitionName: string
  seasonLabel: string
  homeTeamName: string
  awayTeamName: string
  status: string
  homeScore: number | null
  awayScore: number | null
}

export type VenueReportRow = {
  venueId: number
  name: string
  city: string | null
  country: string | null
  capacity: number | null
  matchesPlayed: number
  competitionsCount: number
}

export type VenueMatchRow = {
  id: number
  matchDate: string
  competitionName: string
  homeTeamName: string
  awayTeamName: string
  status: string
  homeScore: number | null
  awayScore: number | null
}

export type HeadToHeadMatch = {
  id: number
  matchDate: string
  competitionName: string
  seasonLabel: string
  homeTeamId: number
  homeTeamName: string
  homeTeamLogoUrl: string | null
  awayTeamId: number
  awayTeamName: string
  awayTeamLogoUrl: string | null
  status: string
  round: string | null
  phase: string | null
  venueName: string | null
  homeScore: number | null
  awayScore: number | null
}

export type HeadToHeadReport = {
  matches: HeadToHeadMatch[]
  winsA: number
  winsB: number
  draws: number
  goalsA: number
  goalsB: number
  matchesMissingScore: number
}

export type AuditLogEntry = {
  id: number
  action: string
  entity: string | null
  entityId: number | null
  details: string | null
  ipAddress: string | null
  createdAt: string
  username: string | null
}

export type AuditLogResponse = {
  items: AuditLogEntry[]
  total: number
  page: number
  pageSize: number
}

export type SavedReport = {
  id: number
  userId: number
  username: string
  name: string
  reportType: string
  filters: Record<string, unknown>
  columns: string[] | null
  sortBy: string | null
  sortDir: string | null
  isFavorite: boolean
  createdAt: string
  updatedAt: string | null
}

export type SaveReportInput = {
  name: string
  reportType: string
  filters?: Record<string, unknown>
  columns?: string[]
  sortBy?: string
  sortDir?: string
}

export type DashboardCounts = {
  competiciones: number
  equipos: number
  partidos: number
  jugadores: number
  oficiales: number
  temporadas: number
  estadios: number
  investigaciones: number
}
