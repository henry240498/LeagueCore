-- LeagueCore - Módulo Parametrizaciones
-- Catálogo genérico de valores parametrizables (categoría + código), para dejar de tener listas
-- fijas repartidas en el código de cada módulo sin ningún lugar donde administrarlas. No reemplaza
-- dbo.official_types (ya es su propio módulo completo, con su propia UI -- regla del pedido: si un
-- módulo ya existe con otro nombre, se usa el existente, no se duplica) ni reemplaza estados
-- binarios active/inactive (eso es estado de flujo, no una taxonomía parametrizable).
--
-- Cada categoría documenta explícitamente "dónde se utiliza" (used_in) porque el pedido lo exige
-- ("cada parametrización debe indicar dónde se utiliza").
--
-- Alcance de esta migración: crea el catálogo y lo puebla 1:1 con los valores que HOY ya existen
-- como listas fijas en el código (para no inventar nada nuevo), más el valor 'in_progress' (EN
-- CURSO) para match_status, que no existía todavía y el pedido de finalización lo pide
-- explícitamente. Sólo match_status queda con validación dinámica real contra esta tabla en esta
-- pasada (ver MatchesService.assertValidStatus) -- el resto de las categorías quedan sembradas y
-- administrables acá, pero sus validadores de aplicación (@IsIn en los DTOs) no se tocaron todavía
-- para no arriesgar módulos ya probados fuera del alcance de este cambio.

USE LeagueCore;
GO

IF OBJECT_ID('dbo.parameters', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.parameter_categories (
        code        NVARCHAR(60)  NOT NULL PRIMARY KEY,
        name        NVARCHAR(120) NOT NULL,
        description NVARCHAR(400) NULL,
        used_in     NVARCHAR(400) NULL,
        created_at  DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME()
    );

    CREATE TABLE dbo.parameters (
        id            INT IDENTITY(1,1) PRIMARY KEY,
        category_code NVARCHAR(60)  NOT NULL REFERENCES dbo.parameter_categories(code),
        code          NVARCHAR(60)  NOT NULL,
        label         NVARCHAR(120) NOT NULL,
        sort_order    INT           NOT NULL DEFAULT 0,
        is_active     BIT           NOT NULL DEFAULT 1,
        is_system     BIT           NOT NULL DEFAULT 0,
        created_at    DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME(),
        updated_at    DATETIME2     NULL,
        CONSTRAINT UQ_parameters_category_code UNIQUE (category_code, code)
    );
END
GO

-- ---------- Categorías ----------
IF NOT EXISTS (SELECT 1 FROM dbo.parameter_categories)
BEGIN
    INSERT INTO dbo.parameter_categories (code, name, description, used_in) VALUES
    ('match_status', 'Estados de partido', 'Ciclo de vida de un partido.',
        'dbo.matches.status -- determina si un partido cuenta para Clasificaciones (sólo "finished") y cómo se muestra en listados, detalle y dashboard.'),
    ('match_official_role', 'Roles arbitrales', 'Rol de un oficial dentro de un partido específico.',
        'dbo.match_officials.role -- pestaña Arbitraje del detalle de Partido.'),
    ('coach_role', 'Roles de cuerpo técnico', 'Rol de un entrenador dentro de un partido específico.',
        'dbo.match_coaches.role -- pestaña Equipos/Cuerpos técnicos del detalle de Partido.'),
    ('card_type', 'Tipos de tarjeta', 'Clasificación de una tarjeta mostrada durante un partido.',
        'dbo.cards.card_type -- evento "tarjeta" en la pestaña Eventos del detalle de Partido.'),
    ('goal_type', 'Tipos de gol', 'Cómo se convirtió un gol.',
        'dbo.goals.goal_type -- evento "gol" en la pestaña Eventos del detalle de Partido.'),
    ('interruption_type', 'Tipos de interrupción', 'Motivo de una interrupción del juego.',
        'dbo.match_interruptions.interruption_type -- evento "interrupción" en la pestaña Eventos del detalle de Partido.'),
    ('pitch_condition', 'Estado del césped', 'Condición del terreno de juego el día del partido.',
        'dbo.matches.pitch_condition -- pestaña Información general del detalle de Partido (campo de texto libre sugerido, no forzado).'),
    ('weather_condition', 'Condición climática', 'Clima durante el partido.',
        'dbo.matches.weather_condition -- pestaña Información general del detalle de Partido (campo de texto libre sugerido, no forzado).'),
    ('player_position', 'Posiciones de jugador', 'Posición habitual de un jugador.',
        'dbo.players.position y dbo.match_lineups.position -- ficha de Jugador y alineación del Partido.'),
    ('competition_type', 'Tipos de competición', 'Formato/naturaleza de una competición.',
        'dbo.competitions.competition_type -- ficha de Competición (campo de texto libre sugerido, no forzado).');
END
GO

-- ---------- Valores ----------
IF NOT EXISTS (SELECT 1 FROM dbo.parameters)
BEGIN
    INSERT INTO dbo.parameters (category_code, code, label, sort_order, is_system) VALUES
    -- match_status: agrega 'in_progress' (EN CURSO), único valor nuevo respecto del código actual.
    ('match_status', 'scheduled',   'Programado',  1, 1),
    ('match_status', 'in_progress', 'En curso',    2, 1),
    ('match_status', 'finished',    'Finalizado',  3, 1),
    ('match_status', 'postponed',   'Aplazado',    4, 1),
    ('match_status', 'suspended',   'Suspendido',  5, 1),
    ('match_status', 'cancelled',   'Cancelado',   6, 1),

    ('match_official_role', 'main_referee',         'Árbitro principal',    1, 1),
    ('match_official_role', 'assistant_referee_1',  'Árbitro asistente 1',  2, 1),
    ('match_official_role', 'assistant_referee_2',  'Árbitro asistente 2',  3, 1),
    ('match_official_role', 'fourth_official',      'Cuarto árbitro',       4, 1),
    ('match_official_role', 'var',                  'VAR',                  5, 1),
    ('match_official_role', 'avar',                 'AVAR',                 6, 1),
    ('match_official_role', 'replay_operator',      'Operador de repeticiones', 7, 1),

    ('coach_role', 'head_coach',      'Director técnico',  1, 1),
    ('coach_role', 'assistant_coach', 'Asistente técnico',  2, 1),
    ('coach_role', 'other',           'Otro',                3, 1),

    ('card_type', 'yellow',        'Amarilla',        1, 1),
    ('card_type', 'red',           'Roja',            2, 1),
    ('card_type', 'second_yellow', 'Doble amarilla',  3, 1),

    ('goal_type', 'open_play', 'Jugada',      1, 1),
    ('goal_type', 'header',    'Cabeza',      2, 1),
    ('goal_type', 'penalty',   'Penal',       3, 1),
    ('goal_type', 'free_kick', 'Tiro libre',  4, 1),
    ('goal_type', 'other',     'Otro',        5, 1),

    ('interruption_type', 'var_review', 'Revisión VAR',    1, 1),
    ('interruption_type', 'medical',    'Atención médica', 2, 1),
    ('interruption_type', 'hydration',  'Hidratación',     3, 1),
    ('interruption_type', 'weather',    'Clima',           4, 1),
    ('interruption_type', 'crowd',      'Público',         5, 1),
    ('interruption_type', 'other',      'Otro',            6, 1),

    ('pitch_condition', 'Excelente', 'Excelente', 1, 1),
    ('pitch_condition', 'Bueno',     'Bueno',     2, 1),
    ('pitch_condition', 'Regular',   'Regular',   3, 1),
    ('pitch_condition', 'Malo',      'Malo',      4, 1),

    ('weather_condition', 'Soleado',       'Soleado',       1, 1),
    ('weather_condition', 'Nublado',       'Nublado',       2, 1),
    ('weather_condition', 'Lluvia',        'Lluvia',        3, 1),
    ('weather_condition', 'Tormenta',      'Tormenta',      4, 1),
    ('weather_condition', 'Niebla',        'Niebla',        5, 1),
    ('weather_condition', 'Viento fuerte', 'Viento fuerte', 6, 1),

    ('player_position', 'Portero',        'Portero',        1, 1),
    ('player_position', 'Defensor',       'Defensor',       2, 1),
    ('player_position', 'Mediocampista',  'Mediocampista',  3, 1),
    ('player_position', 'Delantero',      'Delantero',      4, 1),

    ('competition_type', 'Liga',      'Liga',      1, 0),
    ('competition_type', 'Copa',      'Copa',      2, 0),
    ('competition_type', 'Torneo',    'Torneo',    3, 0),
    ('competition_type', 'Amistoso',  'Amistoso',  4, 0),
    ('competition_type', 'Playoff',   'Playoff',   5, 0);
END
GO
