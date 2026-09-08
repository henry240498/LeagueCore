-- LeagueCore - Módulo 7 (Temporadas): dbo.seasons + dbo.season_teams.
--
-- Una competición (dbo.competitions, ya existe) tiene muchas temporadas. NO se confunde
-- "competición" con "temporada": dbo.competitions.season_year (columna suelta de la migración 001)
-- queda como estaba, sin usarse para este módulo — Temporadas es una entidad propia, no un campo
-- más de Competición.
--
-- Formato flexible de temporada (2026, 2025/2026, etc.) sin texto libre: start_year/end_year
-- (end_year NOT NULL, igual a start_year cuando la temporada es de un solo año — así el UNIQUE
-- funciona bien, un end_year NULL nunca es igual a otro NULL en SQL Server) + `label` computed
-- PERSISTED derivado de ambos, mismo patrón que players.full_name/officials.full_name: nunca
-- editable por separado, no puede desincronizarse.
--
-- "Temporada actual" por competición: mismo patrón que players (UX_pth_player_open_stint) — un
-- índice único filtrado garantiza a nivel de base de datos que como mucho una temporada por
-- competición tenga is_current = 1, en vez de confiar sólo en lógica de aplicación.
--
-- Equipos participantes: dbo.teams.competition_id ya fija a qué competición pertenece un equipo,
-- pero no todos los equipos de una competición participan necesariamente en todas sus temporadas
-- (pedido explícito). dbo.season_teams es una tabla puente simple (season_id, team_id) — sin
-- metadata adicional (fecha de inscripción, cuota, etc.) porque no fue pedida.
--
-- Procedencia de datos: mismas 5 columnas que players/officials (data_origin, external_source,
-- external_id, external_url, last_synced_at). Esta es la 3ra tabla con el mismo patrón repetido —
-- documentado en docs/ANALISIS_INICIAL_LEAGUECORE.md como el punto donde extraer una tabla
-- genérica de referencias externas empieza a valer la pena; no se hace en esta migración porque
-- implicaría tocar players/officials ya probados, fuera de alcance de este pedido.

SET QUOTED_IDENTIFIER ON;
GO

USE LeagueCore;
GO

IF OBJECT_ID('dbo.seasons', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.seasons (
        id                  INT IDENTITY(1,1) PRIMARY KEY,
        competition_id      INT             NOT NULL,
        start_year          SMALLINT        NOT NULL,
        end_year            SMALLINT        NOT NULL,
        label               AS (CASE WHEN end_year = start_year
                                      THEN CAST(start_year AS NVARCHAR(4))
                                      ELSE CAST(start_year AS NVARCHAR(4)) + N'/' + CAST(end_year AS NVARCHAR(4))
                                 END) PERSISTED,
        start_date          DATE            NULL,
        end_date            DATE            NULL,
        status              NVARCHAR(30)    NOT NULL CONSTRAINT DF_seasons_status DEFAULT N'active',
        is_current          BIT             NOT NULL CONSTRAINT DF_seasons_is_current DEFAULT 0,
        observations        NVARCHAR(1000)  NULL,
        data_origin         NVARCHAR(20)    NOT NULL CONSTRAINT DF_seasons_data_origin DEFAULT N'manual',
        external_source     NVARCHAR(50)    NULL,
        external_id         NVARCHAR(100)   NULL,
        external_url        NVARCHAR(500)   NULL,
        last_synced_at      DATETIME2       NULL,
        created_at          DATETIME2       NOT NULL CONSTRAINT DF_seasons_created_at DEFAULT SYSUTCDATETIME(),
        updated_at          DATETIME2       NOT NULL CONSTRAINT DF_seasons_updated_at DEFAULT SYSUTCDATETIME(),
        CONSTRAINT FK_seasons_competition FOREIGN KEY (competition_id) REFERENCES dbo.competitions(id),
        CONSTRAINT CK_seasons_years CHECK (end_year >= start_year),
        CONSTRAINT CK_seasons_dates CHECK (start_date IS NULL OR end_date IS NULL OR end_date >= start_date),
        -- Pedido explícito: no se puede repetir la misma temporada dos veces dentro de la misma
        -- competición; la unicidad incluye competition_id a propósito, para que la misma etiqueta
        -- (ej. "2026") sí pueda existir en competiciones distintas sin chocar.
        CONSTRAINT UX_seasons_competition_period UNIQUE (competition_id, start_year, end_year)
    );

    CREATE INDEX IX_seasons_competition_id ON dbo.seasons(competition_id);
    CREATE INDEX IX_seasons_status ON dbo.seasons(status);
    -- Como mucho una temporada "actual" por competición.
    CREATE UNIQUE INDEX UX_seasons_current_per_competition ON dbo.seasons(competition_id) WHERE is_current = 1;
END
GO

IF OBJECT_ID('dbo.season_teams', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.season_teams (
        season_id   INT         NOT NULL,
        team_id     INT         NOT NULL,
        added_at    DATETIME2   NOT NULL CONSTRAINT DF_season_teams_added_at DEFAULT SYSUTCDATETIME(),
        CONSTRAINT PK_season_teams PRIMARY KEY (season_id, team_id),
        CONSTRAINT FK_season_teams_season FOREIGN KEY (season_id) REFERENCES dbo.seasons(id),
        CONSTRAINT FK_season_teams_team FOREIGN KEY (team_id) REFERENCES dbo.teams(id)
    );
    CREATE INDEX IX_season_teams_team_id ON dbo.season_teams(team_id);
END
GO
