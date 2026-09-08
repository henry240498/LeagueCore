// Contrato conceptual que describe cualquier fuente externa conectable al motor de importación
// (archivo, API deportiva, otra web). Las fuentes reales conectadas (file_import, thesportsdb) no
// implementan esta interfaz literalmente -- ver docs/FUTURO_IMPORTACION_DATOS_EXTERNOS.md.
export interface SourceAdapter {
  code: string;
  name: string;
  getStages(): StageDefinition[];
  fetchStage(stageName: string, scope: SyncScope, onBatch: (records: CandidateRecord[]) => Promise<void>): Promise<void>;
}

export interface StageDefinition {
  name: string;
  label: string;
  sortOrder: number;
  entityType: string;
}

export interface SyncScope {
  countries?: string[];
  competitionRefs?: string[];
  seasonFrom?: number;
  seasonTo?: number;
  dataTypes?: string[];
}

export interface CandidateRecord {
  entityType: string;
  externalId: string;
  name: string;
  data: Record<string, unknown>;
}

export type MatchDecision = 'new' | 'exact_external_match' | 'exact_name_match' | 'conflict';

export interface MatchResult {
  decision: MatchDecision;
  existingEntityId: number | null;
  similarityPct: number;
}
