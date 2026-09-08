export type SyncSource = {
  code: string
  name: string
  status: 'available' | 'blocked' | 'planned'
  statusReason: string | null
}

export type SyncRunStatus = 'pending' | 'running' | 'paused' | 'completed' | 'cancelled' | 'failed'

export type SyncRun = {
  id: number
  sourceCode: string
  scope: Record<string, unknown> | null
  status: SyncRunStatus
  isSimulation: boolean
  startedAt: string | null
  finishedAt: string | null
  startedByUserId: number
  startedByUsername: string
  currentStage: string | null
  currentStagePct: number | null
  totalAnalyzed: number
  totalNew: number
  totalUpdated: number
  totalUnchanged: number
  totalIgnored: number
  totalConflicts: number
  totalErrors: number
  cancelRequested: boolean
  pauseRequested: boolean
  createdAt: string
}

export type SyncRunStage = {
  id: number
  stageName: string
  sortOrder: number
  status: string
  totalItems: number | null
  processedItems: number
  startedAt: string | null
  finishedAt: string | null
}

export type ConflictKind = 'duplicate_entity' | 'field_diff'

export type SyncConflict = {
  id: number
  entityType: string
  conflictKind: ConflictKind
  leaguecoreEntityId: number | null
  externalId: string | null
  leaguecoreValue: string | null
  externalValue: string | null
  existingDisplay: Record<string, string | number | null> | null
  importedDisplay: Record<string, string | number | null> | null
  similarityPct: number | null
  status: string
  resolutionAction: string | null
  context: Record<string, unknown> | null
  createdAt: string
  resolvedAt: string | null
  sourceCode?: string
  syncRunId?: number
}

export type SyncError = {
  id: number
  entityType: string | null
  resourceRef: string | null
  errorType: string
  message: string
  attemptCount: number
  createdAt: string
}

export type SyncLogEntry = {
  id: number
  createdAt: string
  level: 'info' | 'success' | 'warning' | 'error'
  message: string
  entityType: string | null
  entityLabel: string | null
}

export type SyncRunDetail = SyncRun & {
  stages: SyncRunStage[]
  conflicts: SyncConflict[]
  errors: SyncError[]
  log: SyncLogEntry[]
}

export const SOURCE_STATUS_LABELS: Record<SyncSource['status'], string> = {
  available: 'Disponible',
  blocked: 'Bloqueada',
  planned: 'Planeada',
}

export const RUN_STATUS_LABELS: Record<SyncRunStatus, string> = {
  pending: 'Pendiente',
  running: 'En ejecución',
  paused: 'Pausada',
  completed: 'Completada',
  cancelled: 'Cancelada',
  failed: 'Falló',
}
