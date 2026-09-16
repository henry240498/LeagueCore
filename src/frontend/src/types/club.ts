export const TEAM_CATEGORIES = [
  'PRIMERA',
  'RESERVA',
  'SUB20',
  'SUB17',
  'FEMENINO',
  'INFANTIL',
  'EQUIPO_B',
] as const

export type TeamCategory = (typeof TEAM_CATEGORIES)[number]

export const TEAM_CATEGORY_LABELS: Record<TeamCategory, string> = {
  PRIMERA: 'Primera división',
  RESERVA: 'Reserva',
  SUB20: 'Sub-20',
  SUB17: 'Sub-17',
  FEMENINO: 'Fútbol femenino',
  INFANTIL: 'Fútbol infantil',
  EQUIPO_B: 'Equipo B',
}

export const STAFF_ROLES = [
  'DT',
  'ASISTENTE',
  'PF',
  'MEDICO',
  'KINESIOLOGO',
  'ANALISTA',
  'SCOUT',
  'DIRECTOR_DEPORTIVO',
  'DELEGADO',
  'OTRO',
] as const

export type StaffRole = (typeof STAFF_ROLES)[number]

export const STAFF_ROLE_LABELS: Record<StaffRole, string> = {
  DT: 'Director técnico',
  ASISTENTE: 'Asistente',
  PF: 'Preparador físico',
  MEDICO: 'Médico',
  KINESIOLOGO: 'Kinesiólogo',
  ANALISTA: 'Analista',
  SCOUT: 'Scout',
  DIRECTOR_DEPORTIVO: 'Director deportivo',
  DELEGADO: 'Delegado',
  OTRO: 'Otro',
}

export type Club = {
  id: number
  name: string
  shortName: string | null
  country: string | null
  city: string | null
  foundedYear: number | null
  logoUrl: string | null
  primaryColor: string | null
  secondaryColor: string | null
  history: string | null
  status: 'active' | 'inactive'
  teamsCount: number
  staffCount: number
  createdAt: string
  updatedAt: string | null
}

export type ClubInput = {
  name: string
  shortName?: string
  country?: string
  city?: string
  foundedYear?: number
  logoUrl?: string
  primaryColor?: string
  secondaryColor?: string
  history?: string
  status?: 'active' | 'inactive'
}

export type ClubTeam = {
  id: number
  name: string
  category: TeamCategory | null
  city: string | null
  country: string | null
  status: string
  logoUrl: string | null
  playersCount: number
}

export type ClubStaff = {
  id: number
  clubId: number
  fullName: string
  role: StaffRole
  teamCategory: TeamCategory | null
  startDate: string | null
  endDate: string | null
  contact: string | null
  createdAt: string
}
