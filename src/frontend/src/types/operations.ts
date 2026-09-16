export type Training = {
  id: number
  teamId: number
  teamName: string
  trainingDate: string
  durationMin: number | null
  objective: string | null
  loadLevel: 'BAJA' | 'MEDIA' | 'ALTA' | null
  performance: string | null
  notes: string | null
  videoUrl: string | null
  attendanceCount: number
}

export type Exercise = {
  id: number
  name: string
  category: string | null
  objective: string | null
  ageGroup: string | null
  durationMin: number | null
  playersCount: string | null
  material: string | null
  diagram: string | null
  videoUrl: string | null
  intensity: string | null
}

export const ATTENDANCE_STATUSES = [
  'ENTRENO',
  'NO_ENTRENO',
  'LESIONADO',
  'SANCIONADO',
  'DESCANSO',
  'SELECCION',
  'PERMISO',
] as const

export type Attendance = {
  playerId: number
  playerName: string
  status: string
}

export type Objective = {
  id: number
  title: string
  targetValue: number | null
  currentValue: number | null
  deadline: string | null
  status: 'EN_CURSO' | 'LOGRADO' | 'VENCIDO'
}

export type TeamContext = {
  home: { p: number; w: number; d: number; l: number; gf: number; ga: number }
  away: { p: number; w: number; d: number; l: number; gf: number; ga: number }
  halves: { gf_1t: number; ga_1t: number; gf_2t: number; ga_2t: number; gf_last15: number; ga_last15: number }
}

export type SubImpact = {
  id: number
  teamId: number
  teamName: string
  minute: number | null
  outName: string | null
  inName: string | null
  scoreBefore: string
  scoreAfter: string
}

export type DisciplineRow = {
  playerId: number
  playerName: string
  teamName: string | null
  fouls: number
  yellows: number
  reds: number
  suspensionRisk: boolean
}

export type RefereeRow = {
  officialId: number
  officialName: string
  matches: number
  yellowsPerMatch: number
  reds: number
  foulsPerMatch: number
}

export type Alert = {
  id: number
  kind: string
  entityType: string | null
  entityId: number | null
  message: string
  status: 'PENDIENTE' | 'LEIDA' | 'RESUELTA'
  createdAt: string
}

export type Overview = {
  squad: number
  availabilityPct: number
  activeInjuries: number
  avgTech: number
  goals: number
  xg: number
  watchPending: number
  alertsPending: number
  upcomingMatches: { id: number; home: string; away: string; match_date: string }[]
  player: { full_name: string; goals: number; assists: number; matches: number; objectives: number } | null
}
