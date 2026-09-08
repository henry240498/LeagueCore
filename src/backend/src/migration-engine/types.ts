// Contratos del motor de migración histórica (Registro Fútbol → LeagueCore). Ver plan técnico
// aprobado (docs/ANALISIS_REGISTRO_FUTBOL_VS_LEAGUECORE.md + el plan en sí) para el diseño completo.
//
// Decisión de forma: `raw_payload` en dbo.migration_staging_items NO es HTML/XML crudo de Registro
// Fútbol -- es JSON ya estructurado, con una forma por entityType definida acá. Igual que el motor
// de investigación (research/) recibe "ya investigado y normalizado", nunca hace su propio scraping,
// este motor recibe "ya capturado y estructurado" en la sesión supervisada (curl/lectura manual),
// nunca HTML crudo. Esto evita fabricar un parser contra un formato que todavía no se capturó
// realmente (Fase 0 del plan) -- la traducción HTML/XML→JSON la hace quien captura, no el backend.

export type EntityType =
  | 'competition'
  | 'season'
  | 'team'
  | 'venue'
  | 'player'
  | 'official'
  | 'coach'
  | 'player_team_history'
  | 'coach_team_history'
  | 'match'
  | 'lineup'
  | 'goal'
  | 'card'
  | 'penalty'
  | 'match_team_stats';

export type PipelineStatus =
  | 'captured'
  | 'normalized'
  | 'matched'
  | 'conflict'
  | 'reconciled'
  | 'validated'
  | 'committed'
  | 'rejected'
  | 'error';

export type MatchVerdict = 'new' | 'same' | 'ambiguous';

export interface StagingItemRow {
  id: number;
  syncRunId: number;
  entityType: EntityType;
  sourceRef: string | null;
  rawPayload: string;
  normalizedPayload: string | null;
  pipelineStatus: PipelineStatus;
  matchVerdict: MatchVerdict | null;
  matchedEntityId: number | null;
  committedEntityId: number | null;
  syncConflictId: number | null;
  errorMessage: string | null;
  capturedAt: Date;
  processedAt: Date | null;
}

// --- Formas por tipo de entidad (lo que va dentro de raw_payload/normalized_payload) ---

export interface CompetitionPayload {
  name: string;
  // Opcional a propósito -- una competición continental (Copa Libertadores, etc.) no tiene un solo
  // país (LeagueCore ya guarda `country=NULL` para su fila real de Copa Libertadores, confirmado
  // durante la captura real de la Fase 0). Forzar un país acá sería inventar un dato que la fuente
  // ni siquiera tiene un lugar natural para dar.
  country?: string;
}

export interface SeasonPayload {
  competitionName: string;
  country?: string;
  startYear: number;
  endYear?: number;
  championTeamName?: string;
  // Participación real equipo-temporada capturada directo, sin depender de una relación
  // jugador-equipo -- necesario para la migración masiva por equipo (historial de campaña, sin
  // plantel individual por campaña, ver plan de "todos los equipos y países").
  participantTeamName?: string;
  participantTeamCountry?: string;
}

export interface TeamPayload {
  name: string;
  // Opcional a propósito -- Registro Fútbol no etiqueta el país en su catálogo general de equipos
  // (sólo lo hace por casualidad en algunos nombres, ej. "12 Octubre Paraguay"). Para una captura
  // masiva de "todos los equipos" (no sólo los de contexto ya confirmado como Colo Colo/Chile),
  // forzar un país sería inventar un dato -- mejor NULL sincero que un país adivinado y falso para
  // un club que en realidad es de otro país sin sufijo (ej. "Alajuelense" es de Costa Rica).
  country?: string;
  city?: string;
}

export interface VenuePayload {
  name: string;
  city?: string;
  country?: string;
}

export interface PlayerPayload {
  firstName: string;
  lastName: string;
  dateOfBirth?: string;
  nationality?: string;
  position?: string;
}

export interface OfficialPayload {
  firstName: string;
  lastName: string;
  dateOfBirth?: string;
  nationality?: string;
  officialTypeName?: string;
}

export interface CoachPayload {
  firstName: string;
  lastName: string;
  nationality?: string;
}

export interface PlayerTeamHistoryPayload {
  playerFirstName: string;
  playerLastName: string;
  playerDateOfBirth?: string;
  teamName: string;
  teamCountry: string;
  competitionName?: string;
  seasonStartYear?: number;
  startDate?: string;
  endDate?: string;
  squadNumber?: number;
}

export interface CoachTeamHistoryPayload {
  coachFirstName: string;
  coachLastName: string;
  coachNationality?: string;
  teamName: string;
  teamCountry: string;
  seasonStartYear?: number;
  startDate?: string;
  endDate?: string;
}

// matchRef identifica el partido de forma estable entre varios staging items relacionados (lineup/
// goal/card/penalty de UN MISMO partido) sin depender de un id de producción que todavía no existe
// al momento de capturar -- competición+temporada+fecha+equipos es la misma regla de identidad de
// partido que ya usa el resto del sistema (ver ConflictResolutionService/MatchesService).
// homeTeamCountry/awayTeamCountry por separado (no un solo `country` compartido) -- bug real
// encontrado en la captura real de la Fase 0: en un partido de competición continental (Copa
// Libertadores), el equipo local y el visitante pueden tener países DISTINTOS (Colo Colo=Chile vs
// Cerro Porteño=Paraguay). Un único campo país habría forzado a inventar cuál de los dos usar.
export interface MatchRef {
  competitionName: string;
  competitionCountry?: string;
  seasonStartYear?: number;
  matchDate: string;
  homeTeamName: string;
  homeTeamCountry: string;
  awayTeamName: string;
  awayTeamCountry: string;
}

export interface MatchOfficialRef {
  firstName: string;
  lastName: string;
  role: string;
}

export interface MatchCoachRef {
  firstName: string;
  lastName: string;
  teamName: string;
}

export interface MatchPayload {
  ref: MatchRef;
  venueName?: string;
  phase?: string;
  round?: string;
  homeScore?: number;
  awayScore?: number;
  attendance?: number;
  officials?: MatchOfficialRef[];
  coaches?: MatchCoachRef[];
}

export interface LineupPayload {
  matchRef: MatchRef;
  teamName: string;
  playerFirstName: string;
  playerLastName: string;
  isStarting?: boolean;
  shirtNumber?: number;
  position?: string;
  minutesPlayed?: number;
}

export interface GoalPayload {
  matchRef: MatchRef;
  teamName: string;
  playerFirstName: string;
  playerLastName: string;
  minute?: number;
  ownGoal?: boolean;
  penalty?: boolean;
  assistFirstName?: string;
  assistLastName?: string;
}

export interface CardPayload {
  matchRef: MatchRef;
  teamName: string;
  playerFirstName: string;
  playerLastName: string;
  cardType: 'yellow' | 'red' | 'second_yellow';
  minute?: number;
  reason?: string;
}

// Convertido en juego -> entity_type 'goal' con penalty:true (nunca acá). Este tipo es
// exclusivamente fallado/atajado durante el juego regular (taxonomía real confirmada en la
// auditoría: "Penal Atajado"/"Penal Desviado", distinto de las tandas de penales -- ver
// dbo.match_shootout_kicks, que este motor no toca en la Fase 0).
export interface PenaltyPayload {
  matchRef: MatchRef;
  teamName: string;
  playerFirstName: string;
  playerLastName: string;
  minute?: number;
  outcome: 'missed' | 'saved';
}

export interface MatchTeamStatsPayload {
  matchRef: MatchRef;
  teamName: string;
  possessionPct?: number;
  shots?: number;
  shotsOnTarget?: number;
  corners?: number;
  fouls?: number;
}

export type EntityPayload =
  | CompetitionPayload
  | SeasonPayload
  | TeamPayload
  | VenuePayload
  | PlayerPayload
  | OfficialPayload
  | CoachPayload
  | PlayerTeamHistoryPayload
  | CoachTeamHistoryPayload
  | MatchPayload
  | LineupPayload
  | GoalPayload
  | CardPayload
  | PenaltyPayload
  | MatchTeamStatsPayload;

// Catálogo real de ~19 valores de tipo_partido confirmado en la auditoría (§15) -- se usa para
// canonicalizar `phase` en NormalizationService en vez de dejarlo como texto libre sin control,
// aunque dbo.matches.phase siga siendo NVARCHAR libre (gap real, documentado, no se fuerza un CHECK
// nuevo sobre una columna que hoy acepta cualquier texto).
export const REGISTROFUTBOL_PHASE_CATALOG = [
  'Normal', 'Liguilla Libertadores', 'Liguilla Descenso', 'Campeonato Segunda Fase',
  'Octavos de Final', 'Sextos de Final', 'Cuartos de Final', 'Semi Final', 'Final', 'Especial',
  'Torneo Metropolitano', 'Torneo Provincial', 'Repechaje', 'Torneo de Honor',
  'Liguilla de Promoción', 'Liguilla por el Título', 'Liguilla por el Descenso',
  'Definición de Título', 'Serie A', 'Serie B', 'Interseries',
] as const;
