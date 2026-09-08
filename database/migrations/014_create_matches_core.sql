-- LeagueCore - Módulo 8 (Partidos), parte 1/1: núcleo del partido, participantes, resultado.
--
-- PRINCIPIO RECTOR (pedido explícito del usuario): NADA de una tabla `matches` gigante con una
-- columna por estadística. Cada tipo de dato es lo que realmente es:
--   - dbo.matches            -> identificación/contexto del partido (entidad)
--   - dbo.match_officials    -> participación de oficiales CON ROL (relación con atributo)
--   - dbo.match_coaches      -> participación de entrenadores/cuerpo técnico CON ROL (relación)
--   - dbo.match_lineups      -> participación de jugadores (relación con atributos: titular, dorsal)
--   - dbo.match_period_scores-> resultado ESTRUCTURADO por periodo (entidad propia, no columnas)
--   - dbo.match_shootout_kicks -> tanda de penales (secuencia de eventos, NO parte del resultado normal)
--   - dbo.goals/cards/substitutions (ya existían) -> eventos, extendidos con equipo/periodo/tiempo añadido
--   - dbo.offsides / dbo.match_interruptions -> eventos nuevos
--   - dbo.match_team_stats   -> estadísticas de EQUIPO por partido (agregadas, todas NULL-ables)
-- Estadísticas individuales detalladas, GPS, xG/xA/PPDA y datos espaciales quedan en una migración
-- separada (015), como tablas preparadas SIN interfaz de carga todavía (pedido explícito: no
-- desarrollar el motor de GPS/xG/heatmaps ahora, pero no bloquear la arquitectura).
--
-- Reutiliza entidades existentes sin duplicarlas: dbo.competitions, dbo.seasons, dbo.teams,
-- dbo.players, dbo.officials, dbo.venues. NO se crea una segunda tabla de equipos/jugadores/etc.
--
-- Regla "cero real vs. dato desconocido" (pedida explícitamente): toda estadística nueva es
-- NULL-able sin DEFAULT numérico — la ausencia de una fila (o de un valor) significa "sin datos",
-- nunca se asume 0.

SET QUOTED_IDENTIFIER ON;
GO

USE LeagueCore;
GO

-- =====================================================================================
-- 1) dbo.venues — se reutiliza (ya existía desde la migración 001). Sólo se agrega país;
--    no se construye un módulo completo de Estadios todavía (pedido explícito).
-- =====================================================================================
IF COL_LENGTH('dbo.venues', 'country') IS NULL
    ALTER TABLE dbo.venues ADD country NVARCHAR(80) NULL;
GO

-- =====================================================================================
-- 2) dbo.coaches — entidad nueva (Entrenadores/Cuerpo técnico). No existía nada reutilizable
--    (dbo.teams.manager_name es sólo texto libre, insuficiente para historial real). Mismo
--    patrón que dbo.players/dbo.officials: nombre nunca editable como texto libre aparte.
-- =====================================================================================
IF OBJECT_ID('dbo.coaches', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.coaches (
        id                  INT IDENTITY(1,1) PRIMARY KEY,
        first_name          NVARCHAR(100)   NOT NULL,
        last_name           NVARCHAR(100)   NOT NULL,
        full_name           AS (LTRIM(RTRIM(first_name + N' ' + last_name))) PERSISTED,
        nationality         NVARCHAR(80)    NULL,
        photo_url           NVARCHAR(500)   NULL,
        status              NVARCHAR(30)    NOT NULL CONSTRAINT DF_coaches_status DEFAULT N'active',
        data_origin         NVARCHAR(20)    NOT NULL CONSTRAINT DF_coaches_data_origin DEFAULT N'manual',
        external_source     NVARCHAR(50)    NULL,
        external_id         NVARCHAR(100)   NULL,
        external_url        NVARCHAR(500)   NULL,
        last_synced_at      DATETIME2       NULL,
        created_at          DATETIME2       NOT NULL CONSTRAINT DF_coaches_created_at DEFAULT SYSUTCDATETIME(),
        updated_at          DATETIME2       NOT NULL CONSTRAINT DF_coaches_updated_at DEFAULT SYSUTCDATETIME()
    );
    CREATE INDEX IX_coaches_full_name ON dbo.coaches(full_name);
    CREATE INDEX IX_coaches_status ON dbo.coaches(status);
END
GO

-- =====================================================================================
-- 3) dbo.matches — rediseño del núcleo (la tabla ya existía desde la migración 001, vacía).
-- =====================================================================================

-- 3a) Quitar lo que queda reemplazado por entidades/tablas propias:
--     referee_id (-> match_officials, permite MUCHOS oficiales con rol, no uno solo),
--     home_goals/away_goals (-> match_period_scores, resultado estructurado por periodo),
--     round SMALLINT (-> round NVARCHAR más abajo, admite "Jornada 5", fases no numéricas),
--     abandoned/void (-> status NVARCHAR unificado: 'suspended'/'cancelled', evita que dos
--     columnas booleanas pudieran contradecirse entre sí).
IF EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_matches_referee')
    ALTER TABLE dbo.matches DROP CONSTRAINT FK_matches_referee;
GO
IF COL_LENGTH('dbo.matches', 'referee_id') IS NOT NULL
    ALTER TABLE dbo.matches DROP COLUMN referee_id;
GO
-- home_goals/away_goals/abandoned/void tienen constraints DEFAULT nombrados (de la
-- migración 001) que hay que tirar explícitamente antes de poder tirar la columna — a
-- diferencia de un DEFAULT sin nombre, SQL Server no los borra solo con DROP COLUMN.
IF EXISTS (SELECT 1 FROM sys.default_constraints WHERE name = 'DF_matches_home_goals')
    ALTER TABLE dbo.matches DROP CONSTRAINT DF_matches_home_goals;
GO
IF COL_LENGTH('dbo.matches', 'home_goals') IS NOT NULL
    ALTER TABLE dbo.matches DROP COLUMN home_goals;
GO
IF EXISTS (SELECT 1 FROM sys.default_constraints WHERE name = 'DF_matches_away_goals')
    ALTER TABLE dbo.matches DROP CONSTRAINT DF_matches_away_goals;
GO
IF COL_LENGTH('dbo.matches', 'away_goals') IS NOT NULL
    ALTER TABLE dbo.matches DROP COLUMN away_goals;
GO
IF COL_LENGTH('dbo.matches', 'round') IS NOT NULL
    ALTER TABLE dbo.matches DROP COLUMN round;
GO
IF EXISTS (SELECT 1 FROM sys.default_constraints WHERE name = 'DF_matches_abandoned')
    ALTER TABLE dbo.matches DROP CONSTRAINT DF_matches_abandoned;
GO
IF COL_LENGTH('dbo.matches', 'abandoned') IS NOT NULL
    ALTER TABLE dbo.matches DROP COLUMN abandoned;
GO
IF EXISTS (SELECT 1 FROM sys.default_constraints WHERE name = 'DF_matches_void')
    ALTER TABLE dbo.matches DROP CONSTRAINT DF_matches_void;
GO
IF COL_LENGTH('dbo.matches', 'void') IS NOT NULL
    ALTER TABLE dbo.matches DROP COLUMN void;
GO

-- 3b) Temporada: cada partido pertenece a una temporada (que a su vez ya define la
--     competición) — igual patrón que dbo.teams/dbo.season_teams.
IF COL_LENGTH('dbo.matches', 'season_id') IS NULL
    ALTER TABLE dbo.matches ADD season_id INT NULL;
GO
IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_matches_season')
    ALTER TABLE dbo.matches ADD CONSTRAINT FK_matches_season FOREIGN KEY (season_id) REFERENCES dbo.seasons(id);
GO

-- 3c) Estado del partido: a diferencia de competitions/teams/players/officials/seasons
--     (siempre active/inactive), acá se necesita un ciclo de vida real con más de 2 estados
--     (programado/finalizado/aplazado/suspendido/cancelado) — divergencia deliberada del
--     binario habitual, documentada porque es un concepto genuinamente distinto (flujo de
--     estados de un evento, no un simple interruptor de "activo"). Validado en la app
--     (@IsIn), no con CHECK en base, para poder ampliar el conjunto sin una migración.
IF COL_LENGTH('dbo.matches', 'status') IS NULL
    ALTER TABLE dbo.matches ADD status NVARCHAR(20) NOT NULL CONSTRAINT DF_matches_status DEFAULT N'scheduled';
GO

-- 3d) Fase/ronda/grupo/ida-vuelta — texto libre a propósito (mismo criterio que
--     competition_type/sport/status): la taxonomía real la definirá el futuro módulo de
--     Configuración/Parametrización; distintas competiciones usan esquemas muy distintos
--     (jornadas de liga vs. fases de copa) para forzar una estructura rígida ahora.
IF COL_LENGTH('dbo.matches', 'round') IS NULL
    ALTER TABLE dbo.matches ADD round NVARCHAR(50) NULL;
GO
IF COL_LENGTH('dbo.matches', 'phase') IS NULL
    ALTER TABLE dbo.matches ADD phase NVARCHAR(50) NULL;
GO
IF COL_LENGTH('dbo.matches', 'group_name') IS NULL
    ALTER TABLE dbo.matches ADD group_name NVARCHAR(20) NULL;
GO
IF COL_LENGTH('dbo.matches', 'leg') IS NULL
    ALTER TABLE dbo.matches ADD leg NVARCHAR(20) NULL;
GO

-- 3e) Clima y césped: manuales por ahora (data_source lo deja preparado para una futura
--     fuente automática sin cambiar el esquema). NUNCA inventados — todo NULL-able.
IF COL_LENGTH('dbo.matches', 'weather_condition') IS NULL
    ALTER TABLE dbo.matches ADD weather_condition NVARCHAR(30) NULL;
GO
IF COL_LENGTH('dbo.matches', 'temperature_celsius') IS NULL
    ALTER TABLE dbo.matches ADD temperature_celsius DECIMAL(4,1) NULL;
GO
IF COL_LENGTH('dbo.matches', 'humidity_pct') IS NULL
    ALTER TABLE dbo.matches ADD humidity_pct DECIMAL(4,1) NULL;
GO
IF COL_LENGTH('dbo.matches', 'wind_kmh') IS NULL
    ALTER TABLE dbo.matches ADD wind_kmh DECIMAL(5,1) NULL;
GO
IF COL_LENGTH('dbo.matches', 'pitch_condition') IS NULL
    ALTER TABLE dbo.matches ADD pitch_condition NVARCHAR(30) NULL;
GO

-- 3f) Procedencia del dato — 4ta tabla con este mismo patrón (players, officials, seasons,
--     ahora matches). Ver docs/FUTURO_IMPORTACION_DATOS_EXTERNOS.md: sigue siendo una
--     decisión consciente no extraer todavía la tabla genérica de referencias externas.
IF COL_LENGTH('dbo.matches', 'data_origin') IS NULL
    ALTER TABLE dbo.matches ADD data_origin NVARCHAR(20) NOT NULL CONSTRAINT DF_matches_data_origin DEFAULT N'manual';
GO
IF COL_LENGTH('dbo.matches', 'external_source') IS NULL
    ALTER TABLE dbo.matches ADD external_source NVARCHAR(50) NULL;
GO
IF COL_LENGTH('dbo.matches', 'external_id') IS NULL
    ALTER TABLE dbo.matches ADD external_id NVARCHAR(100) NULL;
GO
IF COL_LENGTH('dbo.matches', 'external_url') IS NULL
    ALTER TABLE dbo.matches ADD external_url NVARCHAR(500) NULL;
GO
IF COL_LENGTH('dbo.matches', 'last_synced_at') IS NULL
    ALTER TABLE dbo.matches ADD last_synced_at DATETIME2 NULL;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_matches_season_id')
    CREATE INDEX IX_matches_season_id ON dbo.matches(season_id);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_matches_status')
    CREATE INDEX IX_matches_status ON dbo.matches(status);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_matches_match_date')
    CREATE INDEX IX_matches_match_date ON dbo.matches(match_date);
GO

-- =====================================================================================
-- 4) dbo.match_officials — Partido ↔ Oficial CON ROL (no un simple referee_id).
--    Roles validados en la app (@IsIn), no CHECK, mismo criterio que status de matches.
-- =====================================================================================
IF OBJECT_ID('dbo.match_officials', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.match_officials (
        id          INT IDENTITY(1,1) PRIMARY KEY,
        match_id    INT             NOT NULL,
        official_id INT             NOT NULL,
        role        NVARCHAR(30)    NOT NULL,
        created_at  DATETIME2       NOT NULL CONSTRAINT DF_mo_created_at DEFAULT SYSUTCDATETIME(),
        CONSTRAINT FK_mo_match FOREIGN KEY (match_id) REFERENCES dbo.matches(id),
        CONSTRAINT FK_mo_official FOREIGN KEY (official_id) REFERENCES dbo.officials(id),
        -- Un solo "árbitro principal" por partido, pero permite 2 asistentes distintos
        -- porque son roles DISTINTOS (assistant_referee_1 / assistant_referee_2).
        CONSTRAINT UX_mo_match_role UNIQUE (match_id, role)
    );
    CREATE INDEX IX_mo_official_id ON dbo.match_officials(official_id);
END
GO

-- =====================================================================================
-- 5) dbo.match_coaches — Partido ↔ Entrenador/Cuerpo técnico CON ROL y equipo.
-- =====================================================================================
IF OBJECT_ID('dbo.match_coaches', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.match_coaches (
        id          INT IDENTITY(1,1) PRIMARY KEY,
        match_id    INT             NOT NULL,
        team_id     INT             NOT NULL,
        coach_id    INT             NOT NULL,
        role        NVARCHAR(30)    NOT NULL CONSTRAINT DF_mc_role DEFAULT N'head_coach',
        created_at  DATETIME2       NOT NULL CONSTRAINT DF_mc_created_at DEFAULT SYSUTCDATETIME(),
        CONSTRAINT FK_mc_match FOREIGN KEY (match_id) REFERENCES dbo.matches(id),
        CONSTRAINT FK_mc_team FOREIGN KEY (team_id) REFERENCES dbo.teams(id),
        CONSTRAINT FK_mc_coach FOREIGN KEY (coach_id) REFERENCES dbo.coaches(id),
        CONSTRAINT UX_mc_match_team_coach UNIQUE (match_id, team_id, coach_id)
    );
    CREATE INDEX IX_mc_coach_id ON dbo.match_coaches(coach_id);
END
GO

-- =====================================================================================
-- 6) dbo.match_lineups — Partido ↔ Jugador (participante), con equipo/titular/dorsal
--    explícitos del partido — NO se deriva del equipo actual del jugador (que puede haber
--    cambiado desde entonces, ver player_team_history). Es también la base para validar
--    que un evento (gol/tarjeta/etc.) referencie a alguien que realmente jugó ese partido.
-- =====================================================================================
IF OBJECT_ID('dbo.match_lineups', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.match_lineups (
        id              INT IDENTITY(1,1) PRIMARY KEY,
        match_id        INT             NOT NULL,
        team_id         INT             NOT NULL,
        player_id       INT             NOT NULL,
        is_starting     BIT             NOT NULL CONSTRAINT DF_ml_is_starting DEFAULT 0,
        shirt_number    SMALLINT        NULL,
        position        NVARCHAR(30)    NULL,
        minutes_played  SMALLINT        NULL,
        created_at      DATETIME2       NOT NULL CONSTRAINT DF_ml_created_at DEFAULT SYSUTCDATETIME(),
        CONSTRAINT FK_ml_match FOREIGN KEY (match_id) REFERENCES dbo.matches(id),
        CONSTRAINT FK_ml_team FOREIGN KEY (team_id) REFERENCES dbo.teams(id),
        CONSTRAINT FK_ml_player FOREIGN KEY (player_id) REFERENCES dbo.players(id),
        CONSTRAINT UX_ml_match_player UNIQUE (match_id, player_id)
    );
    CREATE INDEX IX_ml_match_team ON dbo.match_lineups(match_id, team_id);
    CREATE INDEX IX_ml_player_id ON dbo.match_lineups(player_id);
END
GO

-- =====================================================================================
-- 7) dbo.match_period_scores — resultado ESTRUCTURADO. Sin filas = "sin resultado todavía"
--    (nunca se asume 0-0). 'full_time' es el resultado de los 90' reglamentarios; se guarda
--    explícito en vez de recalcularse siempre desde 'first_half', para no obligar a que
--    exista un desglose por tiempo si sólo se conoce el resultado final.
-- =====================================================================================
IF OBJECT_ID('dbo.match_period_scores', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.match_period_scores (
        id          INT IDENTITY(1,1) PRIMARY KEY,
        match_id    INT             NOT NULL,
        period      NVARCHAR(20)    NOT NULL,
        home_score  SMALLINT        NOT NULL,
        away_score  SMALLINT        NOT NULL,
        created_at  DATETIME2       NOT NULL CONSTRAINT DF_mps_created_at DEFAULT SYSUTCDATETIME(),
        CONSTRAINT FK_mps_match FOREIGN KEY (match_id) REFERENCES dbo.matches(id),
        CONSTRAINT CK_mps_period CHECK (period IN ('first_half', 'full_time', 'extra_time', 'penalties')),
        CONSTRAINT UX_mps_match_period UNIQUE (match_id, period)
    );
END
GO

-- =====================================================================================
-- 8) dbo.match_shootout_kicks — tanda de penales, deliberadamente SEPARADA de goals/
--    penalty_kicks: un penal de tanda no es un gol real ni cuenta en goleadores.
-- =====================================================================================
IF OBJECT_ID('dbo.match_shootout_kicks', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.match_shootout_kicks (
        id          INT IDENTITY(1,1) PRIMARY KEY,
        match_id    INT             NOT NULL,
        team_id     INT             NOT NULL,
        player_id   INT             NULL,
        kick_order  SMALLINT        NOT NULL,
        outcome     NVARCHAR(10)    NOT NULL,
        created_at  DATETIME2       NOT NULL CONSTRAINT DF_msk_created_at DEFAULT SYSUTCDATETIME(),
        CONSTRAINT FK_msk_match FOREIGN KEY (match_id) REFERENCES dbo.matches(id),
        CONSTRAINT FK_msk_team FOREIGN KEY (team_id) REFERENCES dbo.teams(id),
        CONSTRAINT FK_msk_player FOREIGN KEY (player_id) REFERENCES dbo.players(id),
        CONSTRAINT CK_msk_outcome CHECK (outcome IN ('scored', 'missed', 'saved')),
        CONSTRAINT UX_msk_match_team_order UNIQUE (match_id, team_id, kick_order)
    );
END
GO

-- =====================================================================================
-- 9) Eventos existentes (goals/cards/substitutions, migración 001) — se EXTIENDEN, no se
--    duplican. Se agrega equipo explícito (no se deriva del jugador — ver match_lineups),
--    minuto de tiempo añadido, periodo, y lo específico de cada tipo.
-- =====================================================================================

-- 9a) goals: autor + asistente opcional + tipo de jugada + coordenadas del remate.
IF COL_LENGTH('dbo.goals', 'team_id') IS NULL
    ALTER TABLE dbo.goals ADD team_id INT NULL;
GO
IF COL_LENGTH('dbo.goals', 'assist_player_id') IS NULL
    ALTER TABLE dbo.goals ADD assist_player_id INT NULL;
GO
IF COL_LENGTH('dbo.goals', 'minute_extra') IS NULL
    ALTER TABLE dbo.goals ADD minute_extra SMALLINT NULL;
GO
IF COL_LENGTH('dbo.goals', 'period') IS NULL
    ALTER TABLE dbo.goals ADD period NVARCHAR(20) NULL;
GO
IF COL_LENGTH('dbo.goals', 'goal_type') IS NULL
    ALTER TABLE dbo.goals ADD goal_type NVARCHAR(20) NULL;
GO
IF COL_LENGTH('dbo.goals', 'pos_x') IS NULL
    ALTER TABLE dbo.goals ADD pos_x DECIMAL(5,2) NULL;
GO
IF COL_LENGTH('dbo.goals', 'pos_y') IS NULL
    ALTER TABLE dbo.goals ADD pos_y DECIMAL(5,2) NULL;
GO
IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_goals_team')
    ALTER TABLE dbo.goals ADD CONSTRAINT FK_goals_team FOREIGN KEY (team_id) REFERENCES dbo.teams(id);
GO
IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_goals_assist_player')
    ALTER TABLE dbo.goals ADD CONSTRAINT FK_goals_assist_player FOREIGN KEY (assist_player_id) REFERENCES dbo.players(id);
GO
IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_goals_period')
    ALTER TABLE dbo.goals ADD CONSTRAINT CK_goals_period
        CHECK (period IS NULL OR period IN ('first_half', 'second_half', 'extra_time_first', 'extra_time_second'));
GO

-- 9b) cards: equipo explícito + tiempo añadido/periodo/motivo + 'second_yellow' (amarilla
--     que deriva en roja por acumulación — distinta de una roja directa).
IF COL_LENGTH('dbo.cards', 'team_id') IS NULL
    ALTER TABLE dbo.cards ADD team_id INT NULL;
GO
IF COL_LENGTH('dbo.cards', 'minute_extra') IS NULL
    ALTER TABLE dbo.cards ADD minute_extra SMALLINT NULL;
GO
IF COL_LENGTH('dbo.cards', 'period') IS NULL
    ALTER TABLE dbo.cards ADD period NVARCHAR(20) NULL;
GO
IF COL_LENGTH('dbo.cards', 'reason') IS NULL
    ALTER TABLE dbo.cards ADD reason NVARCHAR(200) NULL;
GO
IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_cards_team')
    ALTER TABLE dbo.cards ADD CONSTRAINT FK_cards_team FOREIGN KEY (team_id) REFERENCES dbo.teams(id);
GO
IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_cards_period')
    ALTER TABLE dbo.cards ADD CONSTRAINT CK_cards_period
        CHECK (period IS NULL OR period IN ('first_half', 'second_half', 'extra_time_first', 'extra_time_second'));
GO
DECLARE @cardTypeCk NVARCHAR(200) = (
    SELECT cc.name FROM sys.check_constraints cc WHERE cc.parent_object_id = OBJECT_ID('dbo.cards')
        AND cc.definition LIKE '%card_type%'
);
IF @cardTypeCk IS NOT NULL
    EXEC('ALTER TABLE dbo.cards DROP CONSTRAINT ' + @cardTypeCk);
ALTER TABLE dbo.cards ADD CONSTRAINT CK_cards_type CHECK (card_type IN ('yellow', 'red', 'second_yellow'));
GO

-- 9c) substitutions: equipo explícito + tiempo añadido/periodo/motivo.
IF COL_LENGTH('dbo.substitutions', 'team_id') IS NULL
    ALTER TABLE dbo.substitutions ADD team_id INT NULL;
GO
IF COL_LENGTH('dbo.substitutions', 'minute_extra') IS NULL
    ALTER TABLE dbo.substitutions ADD minute_extra SMALLINT NULL;
GO
IF COL_LENGTH('dbo.substitutions', 'period') IS NULL
    ALTER TABLE dbo.substitutions ADD period NVARCHAR(20) NULL;
GO
IF COL_LENGTH('dbo.substitutions', 'reason') IS NULL
    ALTER TABLE dbo.substitutions ADD reason NVARCHAR(200) NULL;
GO
IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_subs_team')
    ALTER TABLE dbo.substitutions ADD CONSTRAINT FK_subs_team FOREIGN KEY (team_id) REFERENCES dbo.teams(id);
GO
IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_subs_period')
    ALTER TABLE dbo.substitutions ADD CONSTRAINT CK_subs_period
        CHECK (period IS NULL OR period IN ('first_half', 'second_half', 'extra_time_first', 'extra_time_second'));
GO

-- 9d) penalty_misses -> renombrada a penalty_kicks: ahora cubre penales fallados Y atajados
--     durante el partido (NO de tanda — eso es match_shootout_kicks). "Convertido" ya se
--     representa con goals.penalty = 1; acá sólo van los que NO terminaron en gol.
IF OBJECT_ID('dbo.penalty_misses', 'U') IS NOT NULL AND OBJECT_ID('dbo.penalty_kicks', 'U') IS NULL
    EXEC sp_rename 'dbo.penalty_misses', 'penalty_kicks';
GO
IF COL_LENGTH('dbo.penalty_kicks', 'team_id') IS NULL
    ALTER TABLE dbo.penalty_kicks ADD team_id INT NULL;
GO
IF COL_LENGTH('dbo.penalty_kicks', 'outcome') IS NULL
    ALTER TABLE dbo.penalty_kicks ADD outcome NVARCHAR(10) NOT NULL CONSTRAINT DF_pk_outcome DEFAULT N'missed';
GO
IF COL_LENGTH('dbo.penalty_kicks', 'minute_extra') IS NULL
    ALTER TABLE dbo.penalty_kicks ADD minute_extra SMALLINT NULL;
GO
IF COL_LENGTH('dbo.penalty_kicks', 'period') IS NULL
    ALTER TABLE dbo.penalty_kicks ADD period NVARCHAR(20) NULL;
GO
IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_pk_team')
    ALTER TABLE dbo.penalty_kicks ADD CONSTRAINT FK_pk_team FOREIGN KEY (team_id) REFERENCES dbo.teams(id);
GO
IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_pk_outcome')
    ALTER TABLE dbo.penalty_kicks ADD CONSTRAINT CK_pk_outcome CHECK (outcome IN ('missed', 'saved'));
GO

-- =====================================================================================
-- 10) dbo.offsides — evento nuevo (Partido, Equipo, Jugador, Minuto).
-- =====================================================================================
IF OBJECT_ID('dbo.offsides', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.offsides (
        id              INT IDENTITY(1,1) PRIMARY KEY,
        match_id        INT             NOT NULL,
        team_id         INT             NOT NULL,
        player_id       INT             NULL,
        minute          SMALLINT        NULL,
        minute_extra    SMALLINT        NULL,
        period          NVARCHAR(20)    NULL,
        created_at      DATETIME2       NOT NULL CONSTRAINT DF_offsides_created_at DEFAULT SYSUTCDATETIME(),
        CONSTRAINT FK_offsides_match FOREIGN KEY (match_id) REFERENCES dbo.matches(id),
        CONSTRAINT FK_offsides_team FOREIGN KEY (team_id) REFERENCES dbo.teams(id),
        CONSTRAINT FK_offsides_player FOREIGN KEY (player_id) REFERENCES dbo.players(id),
        CONSTRAINT CK_offsides_period CHECK (period IS NULL OR period IN ('first_half', 'second_half', 'extra_time_first', 'extra_time_second'))
    );
    CREATE INDEX IX_offsides_match_id ON dbo.offsides(match_id);
END
GO

-- =====================================================================================
-- 11) dbo.match_interruptions — VAR, atención médica, hidratación, clima, etc. Duración NO
--     siempre conocida (minute_end NULL-able a propósito).
-- =====================================================================================
IF OBJECT_ID('dbo.match_interruptions', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.match_interruptions (
        id                  INT IDENTITY(1,1) PRIMARY KEY,
        match_id            INT             NOT NULL,
        interruption_type   NVARCHAR(30)    NOT NULL,
        minute_start        SMALLINT        NULL,
        minute_end          SMALLINT        NULL,
        period              NVARCHAR(20)    NULL,
        reason              NVARCHAR(300)   NULL,
        created_at          DATETIME2       NOT NULL CONSTRAINT DF_mi_created_at DEFAULT SYSUTCDATETIME(),
        CONSTRAINT FK_mi_match FOREIGN KEY (match_id) REFERENCES dbo.matches(id),
        CONSTRAINT CK_mi_period CHECK (period IS NULL OR period IN ('first_half', 'second_half', 'extra_time_first', 'extra_time_second'))
    );
    CREATE INDEX IX_mi_match_id ON dbo.match_interruptions(match_id);
END
GO

-- =====================================================================================
-- 12) dbo.match_team_stats — estadísticas de EQUIPO por partido. TODO NULL-able sin
--     DEFAULT numérico: la ausencia de un valor es "sin datos", nunca se asume 0.
-- =====================================================================================
IF OBJECT_ID('dbo.match_team_stats', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.match_team_stats (
        match_id                INT             NOT NULL,
        team_id                 INT             NOT NULL,
        possession_pct          DECIMAL(4,1)    NULL,
        shots                   SMALLINT        NULL,
        shots_on_target         SMALLINT        NULL,
        shots_off_target        SMALLINT        NULL,
        shots_blocked           SMALLINT        NULL,
        corners                 SMALLINT        NULL,
        fouls                   SMALLINT        NULL,
        offsides_count          SMALLINT        NULL,
        throw_ins                SMALLINT        NULL,
        goal_kicks               SMALLINT        NULL,
        free_kicks_direct        SMALLINT        NULL,
        free_kicks_indirect      SMALLINT        NULL,
        passes                  SMALLINT        NULL,
        passes_completed        SMALLINT        NULL,
        touches                 SMALLINT        NULL,
        data_source              NVARCHAR(20)    NOT NULL CONSTRAINT DF_mts_data_source DEFAULT N'manual',
        updated_at               DATETIME2       NOT NULL CONSTRAINT DF_mts_updated_at DEFAULT SYSUTCDATETIME(),
        CONSTRAINT PK_match_team_stats PRIMARY KEY (match_id, team_id),
        CONSTRAINT FK_mts_match FOREIGN KEY (match_id) REFERENCES dbo.matches(id),
        CONSTRAINT FK_mts_team FOREIGN KEY (team_id) REFERENCES dbo.teams(id)
    );
END
GO
