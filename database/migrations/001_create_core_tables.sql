-- LeagueCore - Fase 1: esquema de datos núcleo
-- Adaptado a T-SQL/SQL Server del modelo heredado del análisis de Ltrack
-- (docs/ANALISIS_INICIAL_LEAGUECORE.md §4), con substitutions/penalty_misses agregadas
-- (funcionalidades confirmadas en §2 que faltaban en el modelo original) y una tabla
-- users mínima para el auth por token acordado en §8.1.
--
-- Identificadores en inglés: decisión propia documentada como pendiente de confirmación
-- (§12.6) — renombrar es sencillo mientras la base no tenga datos cargados.

USE LeagueCore;
GO

-- Usuarios (auth mínima, ver §8.1 regla 2: auth basada en token, no en sesión de navegador)
IF OBJECT_ID('dbo.users', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.users (
        id              INT IDENTITY(1,1) PRIMARY KEY,
        email           NVARCHAR(256)   NOT NULL UNIQUE,
        password_hash   NVARCHAR(256)   NOT NULL,
        display_name    NVARCHAR(120)   NULL,
        role            NVARCHAR(20)    NOT NULL CONSTRAINT DF_users_role DEFAULT 'admin',
        is_active       BIT             NOT NULL CONSTRAINT DF_users_is_active DEFAULT 1,
        created_at      DATETIME2       NOT NULL CONSTRAINT DF_users_created_at DEFAULT SYSUTCDATETIME(),
        CONSTRAINT CK_users_role CHECK (role IN ('admin', 'editor', 'viewer'))
    );
END
GO

-- Competiciones / ligas
IF OBJECT_ID('dbo.competitions', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.competitions (
        id                          INT IDENTITY(1,1) PRIMARY KEY,
        name                        NVARCHAR(150)   NOT NULL,
        season_year                 SMALLINT        NULL,
        points_win                  TINYINT         NOT NULL CONSTRAINT DF_comp_points_win DEFAULT 3,
        points_draw                 TINYINT         NOT NULL CONSTRAINT DF_comp_points_draw DEFAULT 1,
        points_loss                 TINYINT         NOT NULL CONSTRAINT DF_comp_points_loss DEFAULT 0,
        auto_promotion_slots        TINYINT         NOT NULL CONSTRAINT DF_comp_promo DEFAULT 0,
        auto_relegation_slots       TINYINT         NOT NULL CONSTRAINT DF_comp_releg DEFAULT 0,
        promotion_playoff_slots     TINYINT         NOT NULL CONSTRAINT DF_comp_promo_po DEFAULT 0,
        relegation_playoff_slots    TINYINT         NOT NULL CONSTRAINT DF_comp_releg_po DEFAULT 0,
        match_duration_minutes      SMALLINT        NOT NULL CONSTRAINT DF_comp_duration DEFAULT 90,
        periods_per_match           TINYINT         NOT NULL CONSTRAINT DF_comp_periods DEFAULT 2,
        created_at                  DATETIME2       NOT NULL CONSTRAINT DF_comp_created_at DEFAULT SYSUTCDATETIME()
    );
END
GO

-- Estadios
IF OBJECT_ID('dbo.venues', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.venues (
        id          INT IDENTITY(1,1) PRIMARY KEY,
        name        NVARCHAR(150)   NOT NULL,
        city        NVARCHAR(120)   NULL,
        capacity    INT             NULL,
        opened_year SMALLINT        NULL,
        created_at  DATETIME2       NOT NULL CONSTRAINT DF_venues_created_at DEFAULT SYSUTCDATETIME()
    );
END
GO

-- Árbitros
IF OBJECT_ID('dbo.officials', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.officials (
        id          INT IDENTITY(1,1) PRIMARY KEY,
        name        NVARCHAR(150)   NOT NULL,
        nationality NVARCHAR(80)    NULL,
        city        NVARCHAR(120)   NULL,
        created_at  DATETIME2       NOT NULL CONSTRAINT DF_officials_created_at DEFAULT SYSUTCDATETIME()
    );
END
GO

-- Equipos
IF OBJECT_ID('dbo.teams', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.teams (
        id              INT IDENTITY(1,1) PRIMARY KEY,
        competition_id  INT             NOT NULL,
        venue_id        INT             NULL,
        name            NVARCHAR(150)   NOT NULL,
        city            NVARCHAR(120)   NULL,
        founded_year    SMALLINT        NULL,
        manager_name    NVARCHAR(150)   NULL,
        manager_since   DATE            NULL,
        added_points    SMALLINT        NOT NULL CONSTRAINT DF_teams_added_points DEFAULT 0,
        note            NVARCHAR(500)   NULL,
        created_at      DATETIME2       NOT NULL CONSTRAINT DF_teams_created_at DEFAULT SYSUTCDATETIME(),
        CONSTRAINT FK_teams_competition FOREIGN KEY (competition_id) REFERENCES dbo.competitions(id),
        CONSTRAINT FK_teams_venue FOREIGN KEY (venue_id) REFERENCES dbo.venues(id)
    );
    CREATE INDEX IX_teams_competition_id ON dbo.teams(competition_id);
END
GO

-- Jugadores
IF OBJECT_ID('dbo.players', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.players (
        id              INT IDENTITY(1,1) PRIMARY KEY,
        team_id         INT             NOT NULL,
        name            NVARCHAR(150)   NOT NULL,
        position        NVARCHAR(10)    NULL,
        squad_number    SMALLINT        NULL,
        date_of_birth   DATE            NULL,
        nationality     NVARCHAR(80)    NULL,
        height_m        DECIMAL(3,2)    NULL,
        weight_kg        DECIMAL(5,2)    NULL,
        created_at      DATETIME2       NOT NULL CONSTRAINT DF_players_created_at DEFAULT SYSUTCDATETIME(),
        CONSTRAINT FK_players_team FOREIGN KEY (team_id) REFERENCES dbo.teams(id)
    );
    CREATE INDEX IX_players_team_id ON dbo.players(team_id);
END
GO

-- Partidos
IF OBJECT_ID('dbo.matches', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.matches (
        id              INT IDENTITY(1,1) PRIMARY KEY,
        competition_id  INT             NOT NULL,
        home_team_id    INT             NOT NULL,
        away_team_id    INT             NOT NULL,
        venue_id        INT             NULL,
        referee_id      INT             NULL,
        home_goals      SMALLINT        NOT NULL CONSTRAINT DF_matches_home_goals DEFAULT 0,
        away_goals      SMALLINT        NOT NULL CONSTRAINT DF_matches_away_goals DEFAULT 0,
        match_date      DATE            NOT NULL,
        match_time      TIME            NULL,
        round           SMALLINT        NULL,
        attendance      INT             NULL,
        televised       BIT             NOT NULL CONSTRAINT DF_matches_televised DEFAULT 0,
        abandoned       BIT             NOT NULL CONSTRAINT DF_matches_abandoned DEFAULT 0,
        void            BIT             NOT NULL CONSTRAINT DF_matches_void DEFAULT 0,
        comments        NVARCHAR(1000)  NULL,
        created_at      DATETIME2       NOT NULL CONSTRAINT DF_matches_created_at DEFAULT SYSUTCDATETIME(),
        updated_at      DATETIME2       NOT NULL CONSTRAINT DF_matches_updated_at DEFAULT SYSUTCDATETIME(),
        CONSTRAINT FK_matches_competition FOREIGN KEY (competition_id) REFERENCES dbo.competitions(id),
        CONSTRAINT FK_matches_home_team FOREIGN KEY (home_team_id) REFERENCES dbo.teams(id),
        CONSTRAINT FK_matches_away_team FOREIGN KEY (away_team_id) REFERENCES dbo.teams(id),
        CONSTRAINT FK_matches_venue FOREIGN KEY (venue_id) REFERENCES dbo.venues(id),
        CONSTRAINT FK_matches_referee FOREIGN KEY (referee_id) REFERENCES dbo.officials(id),
        CONSTRAINT CK_matches_teams_differ CHECK (home_team_id <> away_team_id)
    );
    CREATE INDEX IX_matches_competition_id ON dbo.matches(competition_id);
    CREATE INDEX IX_matches_home_team_id ON dbo.matches(home_team_id);
    CREATE INDEX IX_matches_away_team_id ON dbo.matches(away_team_id);
END
GO

-- Goles
IF OBJECT_ID('dbo.goals', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.goals (
        id          INT IDENTITY(1,1) PRIMARY KEY,
        match_id    INT             NOT NULL,
        player_id   INT             NOT NULL,
        minute      SMALLINT        NULL,
        own_goal    BIT             NOT NULL CONSTRAINT DF_goals_own_goal DEFAULT 0,
        penalty     BIT             NOT NULL CONSTRAINT DF_goals_penalty DEFAULT 0,
        created_at  DATETIME2       NOT NULL CONSTRAINT DF_goals_created_at DEFAULT SYSUTCDATETIME(),
        CONSTRAINT FK_goals_match FOREIGN KEY (match_id) REFERENCES dbo.matches(id),
        CONSTRAINT FK_goals_player FOREIGN KEY (player_id) REFERENCES dbo.players(id)
    );
    CREATE INDEX IX_goals_match_id ON dbo.goals(match_id);
    CREATE INDEX IX_goals_player_id ON dbo.goals(player_id);
END
GO

-- Tarjetas
IF OBJECT_ID('dbo.cards', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.cards (
        id          INT IDENTITY(1,1) PRIMARY KEY,
        match_id    INT             NOT NULL,
        player_id   INT             NOT NULL,
        card_type   NVARCHAR(10)    NOT NULL,
        minute      SMALLINT        NULL,
        created_at  DATETIME2       NOT NULL CONSTRAINT DF_cards_created_at DEFAULT SYSUTCDATETIME(),
        CONSTRAINT FK_cards_match FOREIGN KEY (match_id) REFERENCES dbo.matches(id),
        CONSTRAINT FK_cards_player FOREIGN KEY (player_id) REFERENCES dbo.players(id),
        CONSTRAINT CK_cards_type CHECK (card_type IN ('yellow', 'red'))
    );
    CREATE INDEX IX_cards_match_id ON dbo.cards(match_id);
    CREATE INDEX IX_cards_player_id ON dbo.cards(player_id);
END
GO

-- Sustituciones (funcionalidad confirmada en §2, faltaba en el modelo heredado)
IF OBJECT_ID('dbo.substitutions', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.substitutions (
        id              INT IDENTITY(1,1) PRIMARY KEY,
        match_id        INT             NOT NULL,
        player_out_id   INT             NOT NULL,
        player_in_id    INT             NOT NULL,
        minute          SMALLINT        NULL,
        created_at      DATETIME2       NOT NULL CONSTRAINT DF_subs_created_at DEFAULT SYSUTCDATETIME(),
        CONSTRAINT FK_subs_match FOREIGN KEY (match_id) REFERENCES dbo.matches(id),
        CONSTRAINT FK_subs_player_out FOREIGN KEY (player_out_id) REFERENCES dbo.players(id),
        CONSTRAINT FK_subs_player_in FOREIGN KEY (player_in_id) REFERENCES dbo.players(id)
    );
    CREATE INDEX IX_subs_match_id ON dbo.substitutions(match_id);
END
GO

-- Penales fallados (los convertidos ya quedan cubiertos por goals.penalty = 1)
IF OBJECT_ID('dbo.penalty_misses', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.penalty_misses (
        id          INT IDENTITY(1,1) PRIMARY KEY,
        match_id    INT             NOT NULL,
        player_id   INT             NOT NULL,
        minute      SMALLINT        NULL,
        created_at  DATETIME2       NOT NULL CONSTRAINT DF_penmiss_created_at DEFAULT SYSUTCDATETIME(),
        CONSTRAINT FK_penmiss_match FOREIGN KEY (match_id) REFERENCES dbo.matches(id),
        CONSTRAINT FK_penmiss_player FOREIGN KEY (player_id) REFERENCES dbo.players(id)
    );
    CREATE INDEX IX_penmiss_match_id ON dbo.penalty_misses(match_id);
END
GO
