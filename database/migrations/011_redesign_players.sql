-- LeagueCore - Módulo 5 (Jugadores): rediseño de dbo.players + historial de equipos.
--
-- dbo.players ya existía (migración 001) pero con un modelo insuficiente para el módulo real:
-- `name` como campo único (riesgo de inconsistencia nombre/apellido/nombre completo, ver
-- docs/ANALISIS_INICIAL_LEAGUECORE.md v15 §9), `team_id NOT NULL` (obliga a que todo jugador
-- tenga SIEMPRE un equipo, lo cual choca con el historial de equipos pedido explícitamente), y
-- `position NVARCHAR(10)` sin ninguna estructura. La tabla está vacía (confirmado antes de esta
-- migración, dashboard.controller.ts sólo hace COUNT(*) sobre ella) así que se puede alterar
-- libremente sin migrar datos.
--
-- Convenciones que se mantienen (ver 006/007_extend_*.sql):
--   * status/nationality/position como texto libre (NVARCHAR), no CHECK/enum — igual criterio que
--     competition_type/sport/status: estructura real la dará el futuro Módulo de
--     Configuración/Parametrización, todavía no construido. `position` sí se restringe a un
--     conjunto fijo, pero a nivel de aplicación (DTO @IsIn), no de base de datos — ver
--     src/backend/src/players/dto/create-player.dto.ts (PLAYER_POSITIONS).
--   * created_at/updated_at en toda tabla de dominio.
--
-- Preparación explícita para futuras importaciones desde fuentes externas (ver
-- docs/FUTURO_IMPORTACION_DATOS_EXTERNOS.md): columnas data_origin/external_source/external_id/
-- external_url/last_synced_at directamente en dbo.players, NO la tabla genérica de referencias
-- externas que ese documento recomienda para más adelante — con una sola entidad usándolo todavía
-- no se justifica esa abstracción (se reevalúa cuando un segundo módulo la necesite).

SET QUOTED_IDENTIFIER ON;
GO

USE LeagueCore;
GO

-- 1) Nombre: first_name + last_name, full_name SIEMPRE derivado (computed PERSISTED) para que no
--    pueda desincronizarse editándolo aparte — el problema que el usuario pidió evitar explícitamente.
IF COL_LENGTH('dbo.players', 'first_name') IS NULL
    ALTER TABLE dbo.players ADD first_name NVARCHAR(100) NOT NULL CONSTRAINT DF_players_first_name DEFAULT N'';
GO
IF COL_LENGTH('dbo.players', 'last_name') IS NULL
    ALTER TABLE dbo.players ADD last_name NVARCHAR(100) NOT NULL CONSTRAINT DF_players_last_name DEFAULT N'';
GO
IF COL_LENGTH('dbo.players', 'full_name') IS NULL
    ALTER TABLE dbo.players ADD full_name AS (LTRIM(RTRIM(first_name + N' ' + last_name))) PERSISTED;
GO
IF COL_LENGTH('dbo.players', 'name') IS NOT NULL
    ALTER TABLE dbo.players DROP COLUMN name;
GO

-- 2) Un jugador puede no tener equipo actual (agente libre, retirado, o todavía no vinculado tras
--    una importación futura) — el historial vive en dbo.player_team_history (más abajo).
IF EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID('dbo.players') AND name = 'team_id' AND is_nullable = 0
)
    ALTER TABLE dbo.players ALTER COLUMN team_id INT NULL;
GO

-- 3) position: ampliar de NVARCHAR(10) (insuficiente) a NVARCHAR(30).
IF EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID('dbo.players') AND name = 'position' AND max_length < 60
)
    ALTER TABLE dbo.players ALTER COLUMN position NVARCHAR(30) NULL;
GO

-- 4) Campos nuevos: estado (misma convención que competitions/teams), foto, y procedencia del dato.
IF COL_LENGTH('dbo.players', 'status') IS NULL
    ALTER TABLE dbo.players ADD status NVARCHAR(30) NOT NULL CONSTRAINT DF_players_status DEFAULT N'active';
GO
IF COL_LENGTH('dbo.players', 'photo_url') IS NULL
    ALTER TABLE dbo.players ADD photo_url NVARCHAR(500) NULL;
GO
IF COL_LENGTH('dbo.players', 'updated_at') IS NULL
    ALTER TABLE dbo.players ADD updated_at DATETIME2 NOT NULL CONSTRAINT DF_players_updated_at DEFAULT SYSUTCDATETIME();
GO
IF COL_LENGTH('dbo.players', 'data_origin') IS NULL
    ALTER TABLE dbo.players ADD data_origin NVARCHAR(20) NOT NULL CONSTRAINT DF_players_data_origin DEFAULT N'manual';
GO
IF COL_LENGTH('dbo.players', 'external_source') IS NULL
    ALTER TABLE dbo.players ADD external_source NVARCHAR(50) NULL;
GO
IF COL_LENGTH('dbo.players', 'external_id') IS NULL
    ALTER TABLE dbo.players ADD external_id NVARCHAR(100) NULL;
GO
IF COL_LENGTH('dbo.players', 'external_url') IS NULL
    ALTER TABLE dbo.players ADD external_url NVARCHAR(500) NULL;
GO
IF COL_LENGTH('dbo.players', 'last_synced_at') IS NULL
    ALTER TABLE dbo.players ADD last_synced_at DATETIME2 NULL;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_players_status')
    CREATE INDEX IX_players_status ON dbo.players(status);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_players_full_name')
    CREATE INDEX IX_players_full_name ON dbo.players(full_name);
GO

-- 5) Historial de equipos — para que un cambio de equipo no borre por dónde pasó antes el jugador
--    (pedido explícito, ver docs/ANALISIS_INICIAL_LEAGUECORE.md v15 §13-14). No incluye
--    competición/temporada como columnas propias: la competición ya se deriva de team_id → team →
--    competition_id, y "Temporada" todavía no existe como módulo (a propósito, no se inventa acá).
IF OBJECT_ID('dbo.player_team_history', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.player_team_history (
        id              INT IDENTITY(1,1) PRIMARY KEY,
        player_id       INT             NOT NULL,
        team_id         INT             NOT NULL,
        start_date      DATE            NOT NULL CONSTRAINT DF_pth_start_date DEFAULT CAST(SYSUTCDATETIME() AS DATE),
        end_date        DATE            NULL,
        squad_number    SMALLINT        NULL,
        note            NVARCHAR(300)   NULL,
        created_at      DATETIME2       NOT NULL CONSTRAINT DF_pth_created_at DEFAULT SYSUTCDATETIME(),
        updated_at      DATETIME2       NOT NULL CONSTRAINT DF_pth_updated_at DEFAULT SYSUTCDATETIME(),
        CONSTRAINT FK_pth_player FOREIGN KEY (player_id) REFERENCES dbo.players(id),
        CONSTRAINT FK_pth_team FOREIGN KEY (team_id) REFERENCES dbo.teams(id),
        CONSTRAINT CK_pth_dates CHECK (end_date IS NULL OR end_date >= start_date)
    );
    CREATE INDEX IX_pth_player_id ON dbo.player_team_history(player_id);
    CREATE INDEX IX_pth_team_id ON dbo.player_team_history(team_id);
    -- Como mucho un "paso" abierto (end_date NULL, = equipo actual) por jugador a la vez — el
    -- mismo patrón de índice único filtrado que UX_users_email_filtered, aplicado acá para que la
    -- regla de negocio "un jugador tiene un solo equipo actual" no dependa sólo del código.
    CREATE UNIQUE INDEX UX_pth_player_open_stint ON dbo.player_team_history(player_id) WHERE end_date IS NULL;
END
GO
