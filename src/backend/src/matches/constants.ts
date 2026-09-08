// Listas fijas a nivel de aplicación (no CHECK en base salvo donde se indique). Desde el módulo de
// Parametrizaciones (migración 018), MATCH_STATUSES sigue siendo el filtro de forma en el DTO
// (@IsIn — rechaza basura estructural sin ir a la base), pero MatchesService además valida en
// tiempo real contra dbo.parameters (categoría 'match_status') vía ParametersService.assertActiveCode:
// si un admin desactiva un valor desde Parametrizaciones, dejar de poder usarlo en partidos nuevos
// tiene efecto real, no es sólo una pantalla informativa. Esta lista debe reflejar el seed de la
// migración 018 (agrega 'in_progress' / EN CURSO, pedido explícito del prompt de finalización §48).

export const MATCH_STATUSES = ['scheduled', 'in_progress', 'finished', 'postponed', 'suspended', 'cancelled'] as const;

export const MATCH_OFFICIAL_ROLES = [
  'main_referee',
  'assistant_referee_1',
  'assistant_referee_2',
  'fourth_official',
  'var',
  'avar',
  'replay_operator',
] as const;

export const COACH_ROLES = ['head_coach', 'assistant_coach', 'other'] as const;

// first_half/second_half/extra_time_first/extra_time_second — usado por eventos
// (goals/cards/substitutions/offsides/interruptions). CHECK en base de datos para estos 4.
export const EVENT_PERIODS = ['first_half', 'second_half', 'extra_time_first', 'extra_time_second'] as const;

// first_half/full_time/extra_time/penalties — usado sólo por match_period_scores (resultado
// estructurado). CHECK en base de datos.
export const RESULT_PERIODS = ['first_half', 'full_time', 'extra_time', 'penalties'] as const;

export const CARD_TYPES = ['yellow', 'red', 'second_yellow'] as const;

export const GOAL_TYPES = ['open_play', 'header', 'penalty', 'free_kick', 'other'] as const;

export const INTERRUPTION_TYPES = ['var_review', 'medical', 'hydration', 'weather', 'crowd', 'other'] as const;

export const SHOOTOUT_OUTCOMES = ['scored', 'missed', 'saved'] as const;

export const PENALTY_OUTCOMES = ['missed', 'saved'] as const;

// Formas tácticas reales más comunes en fútbol 11 vs 11 (arquero implícito, no se cuenta en el
// número). Lista curada a nivel de aplicación (no CHECK en base) -- mismo criterio que el resto de
// catálogos "de forma", ver Reglas Fijas del vault de Obsidian del proyecto.
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
] as const;
