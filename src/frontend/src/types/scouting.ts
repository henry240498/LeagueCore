export type RivalProfile = {
  teamId: number
  usualFormation: string | null
  strengths: string | null
  weaknesses: string | null
  buildup: string | null
  pressing: string | null
  transitions: string | null
  setPieces: string | null
  offensivePatterns: string | null
  defensivePatterns: string | null
  dangerousPlayers: string | null
  notes: string | null
  updatedAt: string | null
}

export type RivalHistoryEntry = {
  matchId: number
  matchDate: string
  status: string
  homeName: string
  awayName: string
  weAre: 'home' | 'away'
  formations: { shape: string; period: string | null }[]
  goals: number
  xg: number
  score: { home_score: number; away_score: number } | { homeScore: number; awayScore: number } | null
}

export type RivalReport = {
  id: number
  rivalTeamId: number
  title: string
  content: string | null
  createdBy: string | null
  createdAt: string
}

export type ScoutedPlayer = {
  id: number
  fullName: string
  position: string | null
  nationality: string | null
  age: number | null
  heightCm: number | null
  preferredFoot: string | null
  teamId: number | null
  teamName: string | null
  goals: number
  assists: number
  techAvg: number | null
}

export type ComparedPlayer = {
  id: number
  fullName: string
  position: string | null
  age: number | null
  heightCm: number | null
  weightKg: number | null
  teamName: string | null
  matches: number
  goals: number
  assists: number
  technical: { attribute: string; value: number }[]
  physicalLatest: { maxSpeedKmh: number | null; distanceM: number | null; sprints: number | null; playerLoad: number | null } | null
}

export type ScoutingReport = {
  id: number
  playerId: number | null
  playerName: string | null
  externalName: string | null
  position: string | null
  strengths: string | null
  weaknesses: string | null
  recommendation: 'FICHAR' | 'SEGUIR' | 'DESCARTAR' | null
  rating: number | null
  scoutName: string | null
  reportDate: string | null
  createdAt: string
}

export const RECOMMENDATION_LABELS: Record<string, string> = {
  FICHAR: '✅ Fichar',
  SEGUIR: '👀 Seguir observando',
  DESCARTAR: '❌ Descartar',
}

export type WatchItem = {
  id: number
  playerId: number | null
  playerName: string | null
  externalName: string | null
  priority: 'ALTA' | 'MEDIA' | 'BAJA'
  status: 'OBSERVADO' | 'EN_SEGUIMIENTO' | 'OFERTADO' | 'DESCARTADO'
  owner: string | null
  lastObservation: string | null
  nextObservation: string | null
  notes: string | null
}
