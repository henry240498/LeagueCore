-- LeagueCore - Fase 3: tactica + eventos avanzados (puntos 5-13, 28-29 del pedido).
--  - match_tactical_setups: planteo por equipo/partido/fase (INICIAL, DEFENSIVA, OFENSIVA, TRANSICION).
--  - tactical_plays: biblioteca de jugadas preparadas (CORNER-001, PRESSING-001...) con diagrama
--    JSON de la pizarra + video + resultado + contador de uso.
--  - match_possessions: secuencias de posesion con zonas, pases, distancia progresada y xG.
--  - custom_event_types + match_custom_events: eventos definidos por el usuario ("Presion efectiva"...).
--  - custom_metrics: metricas con formula evaluable ("goles*5+asistencias*4...").
--  - match_set_pieces: registro de balon parado con variante, resultado y jugada asociada.
-- Zonas (convencion 0-100 igual que goals/shots/lineups): se derivan en el backend, no se guardan.
-- Ejecutar con sqlcmd -f 65001 (UTF-8).

SET QUOTED_IDENTIFIER ON;
GO
SET ANSI_NULLS ON;
GO
USE LeagueCore;
GO

-- 1) Planteos tacticos ---------------------------------------------------------
IF OBJECT_ID('dbo.match_tactical_setups', 'U') IS NULL
CREATE TABLE dbo.match_tactical_setups (
    id INT IDENTITY(1,1) PRIMARY KEY,
    match_id INT NOT NULL CONSTRAINT FK_mts_match FOREIGN KEY REFERENCES dbo.matches(id) ON DELETE CASCADE,
    team_id INT NOT NULL CONSTRAINT FK_mts_team FOREIGN KEY REFERENCES dbo.teams(id),
    phase NVARCHAR(20) NOT NULL CONSTRAINT DF_mts_phase DEFAULT N'INICIAL',
    formation_shape NVARCHAR(10) NULL,
    block NVARCHAR(10) NULL,
    pressing NVARCHAR(100) NULL,
    buildup NVARCHAR(100) NULL,
    notes NVARCHAR(1000) NULL,
    created_at DATETIME2 NOT NULL CONSTRAINT DF_mts_created_at DEFAULT SYSUTCDATETIME(),
    updated_at DATETIME2 NOT NULL CONSTRAINT DF_mts_updated_at DEFAULT SYSUTCDATETIME(),
    CONSTRAINT CK_mts_phase CHECK (phase IN ('INICIAL', 'DEFENSIVA', 'OFENSIVA', 'TRANSICION')),
    CONSTRAINT CK_mts_block CHECK (block IS NULL OR block IN ('BAJO', 'MEDIO', 'ALTO')),
    CONSTRAINT UX_mts_match_team_phase UNIQUE (match_id, team_id, phase)
);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_mts_match')
    CREATE INDEX IX_mts_match ON dbo.match_tactical_setups(match_id);
GO

-- 2) Biblioteca de jugadas ------------------------------------------------------
IF OBJECT_ID('dbo.tactical_plays', 'U') IS NULL
CREATE TABLE dbo.tactical_plays (
    id INT IDENTITY(1,1) PRIMARY KEY,
    code NVARCHAR(30) NOT NULL,
    category NVARCHAR(20) NOT NULL,
    title NVARCHAR(150) NOT NULL,
    description NVARCHAR(MAX) NULL,
    diagram_json NVARCHAR(MAX) NULL,
    video_url NVARCHAR(500) NULL,
    rival NVARCHAR(150) NULL,
    result NVARCHAR(100) NULL,
    usage_count INT NOT NULL CONSTRAINT DF_tp_usage DEFAULT 0,
    created_at DATETIME2 NOT NULL CONSTRAINT DF_tp_created_at DEFAULT SYSUTCDATETIME(),
    updated_at DATETIME2 NOT NULL CONSTRAINT DF_tp_updated_at DEFAULT SYSUTCDATETIME(),
    CONSTRAINT CK_tp_category CHECK (category IN (
        'CORNER', 'FREEKICK', 'THROWIN', 'PENALTY', 'ATTACK', 'PRESSING', 'BUILDUP')),
    CONSTRAINT UX_tp_code UNIQUE (code)
);
GO

-- 3) Posesiones ------------------------------------------------------------------
IF OBJECT_ID('dbo.match_possessions', 'U') IS NULL
CREATE TABLE dbo.match_possessions (
    id INT IDENTITY(1,1) PRIMARY KEY,
    match_id INT NOT NULL CONSTRAINT FK_mpos_match FOREIGN KEY REFERENCES dbo.matches(id) ON DELETE CASCADE,
    team_id INT NOT NULL CONSTRAINT FK_mpos_team FOREIGN KEY REFERENCES dbo.teams(id),
    start_minute SMALLINT NULL,
    end_minute SMALLINT NULL,
    passes SMALLINT NULL,
    progressive_distance_m INT NULL,
    start_zone NVARCHAR(30) NULL,
    end_zone NVARCHAR(30) NULL,
    outcome NVARCHAR(30) NULL,
    xg DECIMAL(4,3) NULL,
    note NVARCHAR(500) NULL,
    created_at DATETIME2 NOT NULL CONSTRAINT DF_mpos_created_at DEFAULT SYSUTCDATETIME(),
    CONSTRAINT CK_mpos_outcome CHECK (outcome IS NULL OR outcome IN (
        'TIRO', 'GOL', 'PERDIDA', 'FALTA_RECIBIDA', 'FALTA_COMETIDA', 'CORNER', 'SAQUE_MANOS', 'FIN_PERIODO'))
);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_mpos_match')
    CREATE INDEX IX_mpos_match ON dbo.match_possessions(match_id, team_id);
GO

-- 4) Eventos personalizados -------------------------------------------------------
IF OBJECT_ID('dbo.custom_event_types', 'U') IS NULL
CREATE TABLE dbo.custom_event_types (
    id INT IDENTITY(1,1) PRIMARY KEY,
    code NVARCHAR(50) NOT NULL,
    label NVARCHAR(150) NOT NULL,
    fields_json NVARCHAR(MAX) NULL,
    created_at DATETIME2 NOT NULL CONSTRAINT DF_cet_created_at DEFAULT SYSUTCDATETIME(),
    CONSTRAINT UX_cet_code UNIQUE (code)
);
GO

IF OBJECT_ID('dbo.match_custom_events', 'U') IS NULL
CREATE TABLE dbo.match_custom_events (
    id INT IDENTITY(1,1) PRIMARY KEY,
    match_id INT NOT NULL CONSTRAINT FK_mce_match FOREIGN KEY REFERENCES dbo.matches(id) ON DELETE CASCADE,
    team_id INT NOT NULL CONSTRAINT FK_mce_team FOREIGN KEY REFERENCES dbo.teams(id),
    player_id INT NULL CONSTRAINT FK_mce_player FOREIGN KEY REFERENCES dbo.players(id),
    event_code NVARCHAR(50) NOT NULL CONSTRAINT FK_mce_type FOREIGN KEY REFERENCES dbo.custom_event_types(code),
    minute SMALLINT NULL,
    data_json NVARCHAR(MAX) NULL,
    note NVARCHAR(500) NULL,
    created_at DATETIME2 NOT NULL CONSTRAINT DF_mce_created_at DEFAULT SYSUTCDATETIME()
);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_mce_match')
    CREATE INDEX IX_mce_match ON dbo.match_custom_events(match_id, event_code);
GO

-- 5) Metricas personalizadas -------------------------------------------------------
IF OBJECT_ID('dbo.custom_metrics', 'U') IS NULL
CREATE TABLE dbo.custom_metrics (
    id INT IDENTITY(1,1) PRIMARY KEY,
    name NVARCHAR(100) NOT NULL,
    formula NVARCHAR(500) NOT NULL,
    description NVARCHAR(500) NULL,
    created_at DATETIME2 NOT NULL CONSTRAINT DF_cm_created_at DEFAULT SYSUTCDATETIME(),
    updated_at DATETIME2 NOT NULL CONSTRAINT DF_cm_updated_at DEFAULT SYSUTCDATETIME(),
    CONSTRAINT UX_cm_name UNIQUE (name)
);
GO

-- 6) Balon parado ------------------------------------------------------------------
IF OBJECT_ID('dbo.match_set_pieces', 'U') IS NULL
CREATE TABLE dbo.match_set_pieces (
    id INT IDENTITY(1,1) PRIMARY KEY,
    match_id INT NOT NULL CONSTRAINT FK_msp_match FOREIGN KEY REFERENCES dbo.matches(id) ON DELETE CASCADE,
    team_id INT NOT NULL CONSTRAINT FK_msp_team FOREIGN KEY REFERENCES dbo.teams(id),
    kind NVARCHAR(20) NOT NULL,
    variant NVARCHAR(100) NULL,
    minute SMALLINT NULL,
    outcome NVARCHAR(30) NULL,
    play_code NVARCHAR(30) NULL,
    note NVARCHAR(500) NULL,
    created_at DATETIME2 NOT NULL CONSTRAINT DF_msp_created_at DEFAULT SYSUTCDATETIME(),
    CONSTRAINT CK_msp_kind CHECK (kind IN ('CORNER', 'FREEKICK', 'THROWIN', 'PENALTY', 'KICKOFF')),
    CONSTRAINT CK_msp_outcome CHECK (outcome IS NULL OR outcome IN (
        'GOL', 'OCASION', 'DESPEJADO', 'PERDIDA', 'REPETICION', 'SIN_RESULTADO'))
);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_msp_match')
    CREATE INDEX IX_msp_match ON dbo.match_set_pieces(match_id, kind);
GO
