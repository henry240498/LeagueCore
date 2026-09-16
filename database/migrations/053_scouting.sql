-- LeagueCore - Fase 5: scouting de rivales y jugadores (puntos 16-23 del pedido).
--  - rival_profiles: expediente tactico del rival (1 por equipo).
--  - rival_reports: informes previos generados/guardados.
--  - scouting_reports: informes sobre jugadores (propios o externos).
--  - watchlist: jugadores en seguimiento con prioridad/estado/responsable.
-- El historial del rival (ultimos partidos, formaciones, resultados) se deriva en vivo de
-- matches/match_formations/goals/shots -- no se duplica ningun dato.
-- Ejecutar con sqlcmd -f 65001 (UTF-8).

SET QUOTED_IDENTIFIER ON;
GO
SET ANSI_NULLS ON;
GO
USE LeagueCore;
GO

-- 1) Expediente del rival ---------------------------------------------------------
IF OBJECT_ID('dbo.rival_profiles', 'U') IS NULL
CREATE TABLE dbo.rival_profiles (
    id INT IDENTITY(1,1) PRIMARY KEY,
    team_id INT NOT NULL,
    usual_formation NVARCHAR(10) NULL,
    strengths NVARCHAR(MAX) NULL,
    weaknesses NVARCHAR(MAX) NULL,
    buildup NVARCHAR(500) NULL,
    pressing NVARCHAR(500) NULL,
    transitions NVARCHAR(500) NULL,
    set_pieces NVARCHAR(500) NULL,
    offensive_patterns NVARCHAR(MAX) NULL,
    defensive_patterns NVARCHAR(MAX) NULL,
    dangerous_players NVARCHAR(500) NULL,
    notes NVARCHAR(MAX) NULL,
    created_at DATETIME2 NOT NULL CONSTRAINT DF_rp_created_at DEFAULT SYSUTCDATETIME(),
    updated_at DATETIME2 NOT NULL CONSTRAINT DF_rp_updated_at DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_rp_team FOREIGN KEY (team_id) REFERENCES dbo.teams(id) ON DELETE CASCADE,
    CONSTRAINT UX_rp_team UNIQUE (team_id)
);
GO

-- 2) Informes previos del rival ------------------------------------------------------
IF OBJECT_ID('dbo.rival_reports', 'U') IS NULL
CREATE TABLE dbo.rival_reports (
    id INT IDENTITY(1,1) PRIMARY KEY,
    rival_team_id INT NOT NULL CONSTRAINT FK_rr_team FOREIGN KEY REFERENCES dbo.teams(id) ON DELETE CASCADE,
    title NVARCHAR(200) NOT NULL,
    content NVARCHAR(MAX) NULL,
    created_by NVARCHAR(150) NULL,
    created_at DATETIME2 NOT NULL CONSTRAINT DF_rr_created_at DEFAULT SYSUTCDATETIME()
);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_rr_team')
    CREATE INDEX IX_rr_team ON dbo.rival_reports(rival_team_id, created_at DESC);
GO

-- 3) Informes de scouting de jugadores -------------------------------------------------
IF OBJECT_ID('dbo.scouting_reports', 'U') IS NULL
CREATE TABLE dbo.scouting_reports (
    id INT IDENTITY(1,1) PRIMARY KEY,
    player_id INT NULL CONSTRAINT FK_sr_player FOREIGN KEY REFERENCES dbo.players(id) ON DELETE SET NULL,
    external_name NVARCHAR(200) NULL,
    position NVARCHAR(30) NULL,
    strengths NVARCHAR(MAX) NULL,
    weaknesses NVARCHAR(MAX) NULL,
    recommendation NVARCHAR(20) NULL,
    rating SMALLINT NULL,
    scout_name NVARCHAR(150) NULL,
    report_date DATE NULL,
    created_at DATETIME2 NOT NULL CONSTRAINT DF_sr_created_at DEFAULT SYSUTCDATETIME(),
    CONSTRAINT CK_sr_reco CHECK (recommendation IS NULL OR recommendation IN ('FICHAR', 'SEGUIR', 'DESCARTAR')),
    CONSTRAINT CK_sr_rating CHECK (rating IS NULL OR (rating >= 1 AND rating <= 10)),
    CONSTRAINT CK_sr_subject CHECK (player_id IS NOT NULL OR external_name IS NOT NULL)
);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_sr_player')
    CREATE INDEX IX_sr_player ON dbo.scouting_reports(player_id);
GO

-- 4) Lista de seguimiento ----------------------------------------------------------------
IF OBJECT_ID('dbo.watchlist', 'U') IS NULL
CREATE TABLE dbo.watchlist (
    id INT IDENTITY(1,1) PRIMARY KEY,
    player_id INT NULL CONSTRAINT FK_wl_player FOREIGN KEY REFERENCES dbo.players(id) ON DELETE SET NULL,
    external_name NVARCHAR(200) NULL,
    priority NVARCHAR(10) NOT NULL CONSTRAINT DF_wl_priority DEFAULT N'MEDIA',
    status NVARCHAR(20) NOT NULL CONSTRAINT DF_wl_status DEFAULT N'OBSERVADO',
    owner NVARCHAR(150) NULL,
    last_observation DATE NULL,
    next_observation DATE NULL,
    notes NVARCHAR(1000) NULL,
    created_at DATETIME2 NOT NULL CONSTRAINT DF_wl_created_at DEFAULT SYSUTCDATETIME(),
    updated_at DATETIME2 NOT NULL CONSTRAINT DF_wl_updated_at DEFAULT SYSUTCDATETIME(),
    CONSTRAINT CK_wl_priority CHECK (priority IN ('ALTA', 'MEDIA', 'BAJA')),
    CONSTRAINT CK_wl_status CHECK (status IN ('OBSERVADO', 'EN_SEGUIMIENTO', 'OFERTADO', 'DESCARTADO')),
    CONSTRAINT CK_wl_subject CHECK (player_id IS NOT NULL OR external_name IS NOT NULL)
);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_wl_status_priority')
    CREATE INDEX IX_wl_status_priority ON dbo.watchlist(status, priority);
GO
