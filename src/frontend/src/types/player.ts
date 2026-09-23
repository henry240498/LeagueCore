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
  weightKg: number | null
  contractStatus: string | null
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
  weightKg?: number | null
  contractStatus?: string | null
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

// Expediente avanzado (Fase 2): perfil fisico, tecnico 1-100 y lesiones.
export const TECHNICAL_ATTRIBUTES = [
  'VELOCIDAD',
  'REGATE',
  'PASE_CORTO',
  'PASE_LARGO',
  'PASE_PROGRESIVO',
  'PASE_CLAVE',
  'CENTRO',
  'CONTROL',
  'CONDUCCION',
  'TIRO',
  'FINALIZACION',
  'JUEGO_AEREO',
  'BALON_PARADO',
  'RECUPERACION',
  'ENTRADA',
  'INTERCEPCION',
  'DESPEJE',
  'VISION',
  'DEFENSA',
  'FISICO',
  'PORTERIA',
] as const

export type TechnicalAttribute = (typeof TECHNICAL_ATTRIBUTES)[number]

export const TECHNICAL_ATTRIBUTE_LABELS: Record<string, string> = {
  VELOCIDAD: 'Velocidad',
  REGATE: 'Regate',
  PASE_CORTO: 'Pase corto',
  PASE_LARGO: 'Pase largo',
  PASE_PROGRESIVO: 'Pase progresivo',
  PASE_CLAVE: 'Pase clave',
  CENTRO: 'Centro',
  CONTROL: 'Control',
  CONDUCCION: 'Conducción',
  TIRO: 'Tiro',
  FINALIZACION: 'Finalización',
  JUEGO_AEREO: 'Juego aéreo',
  BALON_PARADO: 'Balón parado',
  RECUPERACION: 'Recuperación',
  ENTRADA: 'Entrada',
  INTERCEPCION: 'Intercepción',
  DESPEJE: 'Despeje',
  VISION: 'Visión',
  DEFENSA: 'Defensa',
  FISICO: 'Físico',
  PORTERIA: 'Portería',
}

export type PhysicalRecord = {
  id: number
  playerId: number
  recordedAt: string
  maxSpeedKmh: number | null
  avgSpeedKmh: number | null
  distanceM: number | null
  hiDistanceM: number | null
  sprints: number | null
  accelerations: number | null
  decelerations: number | null
  directionChanges: number | null
  hiMinutes: number | null
  playerLoad: number | null
  acwr: number | null
  heartRateAvg: number | null
  externalLoad: number | null
  internalLoad: number | null
  fatigue: number | null
  availability: string | null
  source: string | null
  note: string | null
  createdAt: string
}

export type TechnicalRating = {
  id: number
  playerId: number
  attribute: string
  value: number
  evaluatedAt: string
  evaluator: string | null
}

export type PlayerInjury = {
  id: number
  playerId: number
  injuryType: string
  bodyPart: string | null
  severity: 'LEVE' | 'MODERADA' | 'GRAVE' | null
  startDate: string
  endDate: string | null
  status: 'ACTIVA' | 'RECUPERADO'
  note: string | null
  createdAt: string
  updatedAt: string
}

export type PlayerProfile = {
  player: Player
  physicalLatest: PhysicalRecord | null
  physicalEvolution: PhysicalRecord[]
  technical: TechnicalRating[]
  activeInjury: PlayerInjury | null
  injuriesCount: number
}

// ---------------------------------------------------------------- Planilla / trayectoria
// Todo lo que el jugador realmente hizo, derivado de datos existentes (ver
// backend: players/player-career.service.ts). Nada se inventa: las secciones sin
// filas llegan vacías y `statTotals` llega en null si la fuente nunca cargó nada.

export type PlayerTeamStint = {
  id: number
  teamId: number
  teamName: string
  teamLogoUrl: string | null
  startDate: string
  endDate: string | null
  squadNumber: number | null
  note: string | null
  /** true = equipo actual (sin fecha de fin) */
  current: boolean
}

export type PlayerCareerTotals = {
  matches: number
  starts: number
  substituteAppearances: number
  minutes: number
  goals: number
  ownGoals: number
  assists: number
  yellowCards: number
  redCards: number
}

export type PlayerCompetitionLine = {
  competitionId: number
  competitionName: string
  matches: number
  minutes: number
  goals: number
  assists: number
  yellowCards: number
  redCards: number
}

export type PlayerPositionLine = { position: string; matches: number }

export type PlayerStatTotals = {
  matchesWithStats: number
  shots: number | null
  shotsOnTarget: number | null
  passes: number | null
  passesCompleted: number | null
  touches: number | null
  tackles: number | null
  tacklesWon: number | null
  interceptions: number | null
  clearances: number | null
  recoveries: number | null
  duelsGroundWon: number | null
  duelsGroundLost: number | null
  duelsAerialWon: number | null
  duelsAerialLost: number | null
  blocksShots: number | null
  blocksPasses: number | null
}

export type PlayerCareer = {
  teamHistory: PlayerTeamStint[]
  totals: PlayerCareerTotals
  byCompetition: PlayerCompetitionLine[]
  positions: PlayerPositionLine[]
  statTotals: PlayerStatTotals | null
}

export type PlayerMatchLogEntry = {
  matchId: number
  matchDate: string
  status: string
  competitionName: string
  seasonLabel: string | null
  round: string | null
  teamId: number
  teamName: string
  isHome: boolean
  opponentName: string
  homeScore: number | null
  awayScore: number | null
  isStarting: boolean
  position: string | null
  shirtNumber: number | null
  minutesPlayed: number | null
  goals: number
  ownGoals: number
  assists: number
  yellowCards: number
  redCards: number
}

export type PlayerMatchLog = {
  items: PlayerMatchLogEntry[]
  total: number
  page: number
  pageSize: number
}
