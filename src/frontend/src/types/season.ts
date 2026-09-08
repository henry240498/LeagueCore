export type SeasonTeam = {
  id: number
  name: string
  status: 'active' | 'inactive'
}

export type Season = {
  id: number
  competitionId: number
  competitionName?: string
  startYear: number
  endYear: number
  label: string
  startDate: string | null
  endDate: string | null
  status: 'active' | 'inactive'
  isCurrent: boolean
  observations: string | null
  dataOrigin: string
  externalSource: string | null
  externalId: string | null
  externalUrl: string | null
  lastSyncedAt: string | null
  teams?: SeasonTeam[]
  createdAt: string
  updatedAt: string | null
}

export type SeasonInput = {
  competitionId: number
  startYear: number
  endYear?: number
  startDate?: string | null
  endDate?: string | null
  status?: 'active' | 'inactive'
  observations?: string | null
}

export type SeasonListResponse = {
  items: Season[]
  total: number
  page: number
  pageSize: number
}

export type StandingsRow = {
  position: number
  teamId: number
  teamName: string
  played: number
  won: number
  drawn: number
  lost: number
  goalsFor: number
  goalsAgainst: number
  goalDifference: number
  addedPoints: number
  points: number
  matchesMissingScore: number
}

export type StandingsResponse = {
  standings: StandingsRow[]
  pointsRule: { win: number; draw: number; loss: number }
  warning: string | null
}
