export const TACTICAL_PHASES = ['INICIAL', 'DEFENSIVA', 'OFENSIVA', 'TRANSICION'] as const
export type TacticalPhase = (typeof TACTICAL_PHASES)[number]

export const TACTICAL_PHASE_LABELS: Record<TacticalPhase, string> = {
  INICIAL: 'Inicial',
  DEFENSIVA: 'Defensiva',
  OFENSIVA: 'Ofensiva',
  TRANSICION: 'Transición',
}

export const PLAY_CATEGORIES = ['CORNER', 'FREEKICK', 'THROWIN', 'PENALTY', 'ATTACK', 'PRESSING', 'BUILDUP'] as const
export type PlayCategory = (typeof PLAY_CATEGORIES)[number]

export const PLAY_CATEGORY_LABELS: Record<PlayCategory, string> = {
  CORNER: 'Córner',
  FREEKICK: 'Tiro libre',
  THROWIN: 'Saque de banda',
  PENALTY: 'Penal',
  ATTACK: 'Ataque',
  PRESSING: 'Presión',
  BUILDUP: 'Salida / Construcción',
}

export type TacticalSetup = {
  id: number
  matchId: number
  teamId: number
  teamName: string | null
  phase: TacticalPhase
  formationShape: string | null
  block: 'BAJO' | 'MEDIO' | 'ALTO' | null
  pressing: string | null
  buildup: string | null
  notes: string | null
}

export type TacticalPlay = {
  id: number
  code: string
  category: PlayCategory
  title: string
  description: string | null
  diagramJson: string | null
  videoUrl: string | null
  rival: string | null
  result: string | null
  usageCount: number
}

export type BoardDiagram = {
  tokens: { id: string; label: string; x: number; y: number; color?: string }[]
  arrows: { from: string; to: string }[]
}

export type Possession = {
  id: number
  matchId: number
  teamId: number
  teamName: string
  startMinute: number | null
  endMinute: number | null
  passes: number | null
  progressiveDistanceM: number | null
  startZone: string | null
  endZone: string | null
  outcome: string | null
  xg: number | null
  note: string | null
}

export type CustomEventType = {
  id: number
  code: string
  label: string
  fieldsJson: string | null
}

export type CustomEvent = {
  id: number
  teamId: number
  teamName: string
  playerId: number | null
  playerName: string | null
  eventCode: string
  eventLabel: string
  minute: number | null
  dataJson: string | null
  note: string | null
}

export type CustomMetric = {
  id: number
  name: string
  formula: string
  description: string | null
}

export type MetricEvaluation = CustomMetric & {
  variables: Record<string, number>
  value: number
}

export const METRIC_VARIABLE_LABELS: Record<string, string> = {
  goles: 'Goles',
  asistencias: 'Asistencias',
  tiros: 'Tiros',
  xg: 'xG',
  corners: 'Córners',
  faltas: 'Faltas',
  amarillas: 'Amarillas',
  rojas: 'Rojas',
  pases: 'Pases',
  recuperaciones: 'Recuperaciones',
  intercepciones: 'Intercepciones',
  posesiones: 'Posesiones',
  posesiones_xg: 'xG en posesiones',
}

export type SetPiece = {
  id: number
  teamId: number
  teamName: string
  kind: 'CORNER' | 'FREEKICK' | 'THROWIN' | 'PENALTY' | 'KICKOFF'
  variant: string | null
  minute: number | null
  outcome: string | null
  playCode: string | null
  note: string | null
}

export const SET_PIECE_KIND_LABELS: Record<string, string> = {
  CORNER: 'Córner',
  FREEKICK: 'Tiro libre',
  THROWIN: 'Saque de banda',
  PENALTY: 'Penal',
  KICKOFF: 'Salida',
}

export type ShotMapItem = {
  id: string
  teamId: number
  playerName: string
  minute: number | null
  posX: number
  posY: number
  outcome: string
  detail: string | null
  xg: number | null
  zone: string
}

export type ShotMap = {
  items: ShotMapItem[]
  totals: { teamId: number; shots: number; goals: number; xg: number }[]
}
