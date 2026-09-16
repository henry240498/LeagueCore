export const VIDEO_KINDS = ['PARTIDO_COMPLETO', 'ENTRENAMIENTO', 'FRAGMENTO', 'SCOUTING'] as const
export type VideoKind = (typeof VIDEO_KINDS)[number]

export const VIDEO_KIND_LABELS: Record<VideoKind, string> = {
  PARTIDO_COMPLETO: 'Partido completo',
  ENTRENAMIENTO: 'Entrenamiento',
  FRAGMENTO: 'Fragmento',
  SCOUTING: 'Scouting',
}

export const SPEEDS = [0.25, 0.5, 1, 1.5, 2]

export type MatchVideo = {
  id: number
  matchId: number | null
  title: string
  kind: VideoKind
  videoUrl: string | null
  durationSeconds: number | null
  offsetSeconds: number
  recordedAt: string | null
  markersCount: number
  clipsCount: number
}

export type VideoTag = {
  id: number
  code: string
  label: string
}

export const DEFAULT_TAGS = [
  'GOL',
  'TIRO',
  'ERROR',
  'PRESION',
  'RECUPERACION',
  'PERDIDA',
  'TRANSICION',
  'CONTRAATAQUE',
  'CENTRO',
  'PASE_PROGRESIVO',
  'ERROR_DEFENSIVO',
  'OPORTUNIDAD',
  'UNO_VS_UNO',
  'BALON_PARADO',
]

export type VideoMarker = {
  id: number
  videoId: number
  timeSeconds: number
  timestamp: string
  tagCode: string | null
  tagLabel: string | null
  eventSource: string | null
  eventId: number | null
  note: string | null
  favorite: boolean
}

export type VideoClip = {
  id: number
  videoId: number
  title: string
  startSeconds: number
  endSeconds: number
  startTimestamp: string
  endTimestamp: string
  description: string | null
}

export type SyncItem = {
  timeSeconds: number | null
  timestamp: string | null
  kind: 'goal' | 'shot' | 'card' | 'substitution' | 'custom' | 'marker'
  label: string
  ref: string
}

export type SyncTimeline = {
  video: MatchVideo
  items: SyncItem[]
}
