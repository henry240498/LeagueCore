// Debe coincidir con src/backend/src/matches/constants.ts y con la categoría 'match_status' del
// módulo de Parametrizaciones (dbo.parameters) — el DTO backend valida contra ambas capas (ver
// MatchesService.assertActiveCode), así que estas listas siguen debiendo coincidir a mano acá.
export const MATCH_STATUSES = ['scheduled', 'in_progress', 'finished', 'postponed', 'suspended', 'cancelled'] as const
export type MatchStatus = (typeof MATCH_STATUSES)[number]

export const MATCH_STATUS_LABELS: Record<MatchStatus, string> = {
  scheduled: 'Programado',
  in_progress: 'En curso',
  finished: 'Finalizado',
  postponed: 'Aplazado',
  suspended: 'Suspendido',
  cancelled: 'Cancelado',
}

export const MATCH_OFFICIAL_ROLES = [
  'main_referee',
  'assistant_referee_1',
  'assistant_referee_2',
  'fourth_official',
  'var',
  'avar',
  'replay_operator',
] as const

export const MATCH_OFFICIAL_ROLE_LABELS: Record<string, string> = {
  main_referee: 'Árbitro principal',
  assistant_referee_1: 'Árbitro asistente 1',
  assistant_referee_2: 'Árbitro asistente 2',
  fourth_official: 'Cuarto árbitro',
  var: 'VAR',
  avar: 'AVAR',
  replay_operator: 'Operador de repeticiones',
}

export const COACH_ROLES = ['head_coach', 'assistant_coach', 'other'] as const
export const COACH_ROLE_LABELS: Record<string, string> = {
  head_coach: 'Director técnico',
  assistant_coach: 'Asistente técnico',
  other: 'Otro',
}

export const EVENT_PERIODS = ['first_half', 'second_half', 'extra_time_first', 'extra_time_second'] as const
export const EVENT_PERIOD_LABELS: Record<string, string> = {
  first_half: '1er tiempo',
  second_half: '2do tiempo',
  extra_time_first: 'Prórroga 1',
  extra_time_second: 'Prórroga 2',
}

export const RESULT_PERIODS = ['first_half', 'full_time', 'extra_time', 'penalties'] as const
export const RESULT_PERIOD_LABELS: Record<string, string> = {
  first_half: 'Primer tiempo',
  full_time: 'Final (90\')',
  extra_time: 'Prórroga',
  penalties: 'Penales',
}

export const CARD_TYPES = ['yellow', 'red', 'second_yellow'] as const
export const CARD_TYPE_LABELS: Record<string, string> = {
  yellow: 'Amarilla',
  red: 'Roja',
  second_yellow: 'Doble amarilla',
}

export const GOAL_TYPES = ['open_play', 'header', 'penalty', 'free_kick', 'other'] as const
export const GOAL_TYPE_LABELS: Record<string, string> = {
  open_play: 'Jugada',
  header: 'Cabeza',
  penalty: 'Penal',
  free_kick: 'Tiro libre',
  other: 'Otro',
}

export const INTERRUPTION_TYPES = ['var_review', 'medical', 'hydration', 'weather', 'crowd', 'other'] as const
export const INTERRUPTION_TYPE_LABELS: Record<string, string> = {
  var_review: 'Revisión VAR',
  medical: 'Atención médica',
  hydration: 'Hidratación',
  weather: 'Clima',
  crowd: 'Público',
  other: 'Otro',
}

export const PITCH_CONDITIONS = ['Excelente', 'Bueno', 'Regular', 'Malo']
export const WEATHER_CONDITIONS = ['Soleado', 'Nublado', 'Lluvia', 'Tormenta', 'Niebla', 'Viento fuerte']

export type PeriodScore = { period: string; homeScore: number; awayScore: number }

export type Match = {
  id: number
  competitionId: number
  competitionName?: string
  seasonId: number
  seasonLabel?: string
  homeTeamId: number
  homeTeamName?: string
  homeTeamLogoUrl?: string | null
  awayTeamId: number
  awayTeamName?: string
  awayTeamLogoUrl?: string | null
  venueId: number | null
  venueName?: string | null
  venuePhotoUrl?: string | null
  matchDate: string
  matchTime: string | null
  status: MatchStatus
  attendance: number | null
  round: string | null
  phase: string | null
  groupName: string | null
  leg: string | null
  weatherCondition: string | null
  temperatureCelsius: number | null
  humidityPct: number | null
  windKmh: number | null
  pitchCondition: string | null
  comments: string | null
  televised: boolean
  dataOrigin: string
  periodScores: PeriodScore[]
  score?: { homeScore: number; awayScore: number } | null
  createdAt: string
  updatedAt: string | null
}

export type MatchInput = {
  competitionId: number
  seasonId: number
  homeTeamId: number
  awayTeamId: number
  matchDate: string
  matchTime?: string | null
  venueId?: number | null
  status?: MatchStatus
  attendance?: number | null
  round?: string | null
  phase?: string | null
  groupName?: string | null
  leg?: string | null
  weatherCondition?: string | null
  temperatureCelsius?: number | null
  humidityPct?: number | null
  windKmh?: number | null
  pitchCondition?: string | null
  comments?: string | null
}

export type MatchListResponse = {
  items: Match[]
  total: number
  page: number
  pageSize: number
}

export type DuplicateMatch = {
  id: number
  matchDate: string
  round: string | null
  phase: string | null
  homeTeamName: string
  awayTeamName: string
}

export type MatchOfficialEntry = {
  id: number
  role: string
  officialId: number
  officialFullName: string
  officialTypeName: string | null
}

export type MatchCoachEntry = {
  id: number
  role: string
  teamId: number
  teamName: string
  coachId: number
  coachFullName: string
}

export type MatchLineupEntry = {
  id: number
  teamId: number
  playerId: number
  playerFullName: string
  photoUrl: string | null
  nationality: string | null
  isStarting: boolean
  shirtNumber: number | null
  position: string | null
  minutesPlayed: number | null
  posX: number | null
  posY: number | null
  goals: number
  assists: number
  yellowCards: number
  redCards: number
}

export const FORMATION_SHAPES = [
  '4-4-2',
  '4-3-3',
  '4-2-3-1',
  '4-1-4-1',
  '4-5-1',
  '4-1-3-2',
  '4-3-2-1',
  '3-5-2',
  '3-4-3',
  '5-3-2',
  '5-4-1',
] as const

export type MatchPlayerPosition = {
  id: number
  playerId: number
  teamId: number
  period: string | null
  minute: number | null
  posX: number
  posY: number
  weight: number | null
  source: string | null
  recordedAt: string
}

export type MatchAdvancedMetric = {
  id: number
  teamId: number | null
  playerId: number | null
  metricName: string
  metricValue: number
  provider: string | null
  modelVersion: string | null
  recordedAt: string
}

export type MatchPhysicalStats = {
  distanceKm: number | null
  topSpeedKmh: number | null
  stepsCount: number | null
  sprintsCount: number | null
  accelerations: number | null
  decelerations: number | null
  walkDistanceKm: number | null
  jogDistanceKm: number | null
  runDistanceKm: number | null
  sprintDistanceKm: number | null
  dataSource: string | null
  updatedAt: string
}

export type MatchFormation = {
  id: number
  teamId: number
  formationShape: string
  period: string | null
  source: string | null
  updatedAt: string
}

export type ShotMapEntry = {
  id: number
  source: 'goal' | 'shot'
  outcome: string
  minute: number | null
  minuteExtra: number | null
  period: string | null
  teamId: number
  teamName: string
  playerId: number
  playerName: string
  posX: number
  posY: number
  penalty: boolean
  ownGoal: boolean
  xg: number | null
}

export const SHOT_OUTCOMES = ['saved', 'blocked', 'off_target', 'post'] as const
export const SHOT_OUTCOME_LABELS: Record<string, string> = {
  goal: 'Gol',
  saved: 'Atajado',
  blocked: 'Bloqueado',
  off_target: 'Desviado',
  post: 'Al palo',
}

export type TimelineEvent = {
  type: 'goal' | 'card' | 'substitution' | 'offside' | 'foul' | 'interruption'
  id: number
  minute: number | null
  minuteExtra?: number | null
  minuteEnd?: number | null
  period: string | null
  teamId?: number
  teamName?: string
  playerId?: number
  playerName?: string
  assistPlayerId?: number | null
  assistPlayerName?: string | null
  ownGoal?: boolean
  penalty?: boolean
  goalType?: string | null
  cardType?: string
  reason?: string | null
  playerOutId?: number
  playerOutName?: string
  playerInId?: number
  playerInName?: string
  interruptionType?: string
}

export type MatchTeamStats = {
  teamId: number
  possessionPct: number | null
  shots: number | null
  shotsOnTarget: number | null
  shotsOffTarget: number | null
  shotsBlocked: number | null
  corners: number | null
  fouls: number | null
  offsidesCount: number | null
  throwIns: number | null
  goalKicks: number | null
  freeKicksDirect: number | null
  freeKicksIndirect: number | null
  passes: number | null
  passesCompleted: number | null
  touches: number | null
  dataSource: string
  updatedAt: string
}

export type ShootoutKick = {
  id: number
  teamId: number
  teamName: string
  playerId: number | null
  playerName: string | null
  kickOrder: number
  outcome: 'scored' | 'missed' | 'saved'
}

export type MatchHistoryEntry = {
  action: string
  details: string | null
  createdAt: string
  username: string | null
}

export type Coach = {
  id: number
  firstName: string
  lastName: string
  fullName: string
  nationality: string | null
  photoUrl: string | null
  status: 'active' | 'inactive'
}

export type Venue = {
  id: number
  name: string
  city: string | null
  country: string | null
  capacity: number | null
  openedYear: number | null
}
