-- LeagueCore - extiende dbo.teams para el Módulo 4 (gestión de equipos): logo y activar/desactivar.
-- No se agrega vínculo a "temporada" todavía — esa es una entidad futura (Módulo "Temporadas")
-- que no existe aún; por ahora un equipo se asocia directamente a una competición (ya existía).

USE LeagueCore;
GO

IF COL_LENGTH('dbo.teams', 'logo_url') IS NULL
    ALTER TABLE dbo.teams ADD logo_url NVARCHAR(500) NULL;
GO
IF COL_LENGTH('dbo.teams', 'status') IS NULL
    ALTER TABLE dbo.teams ADD status NVARCHAR(30) NOT NULL CONSTRAINT DF_teams_status DEFAULT N'active';
GO
IF COL_LENGTH('dbo.teams', 'updated_at') IS NULL
    ALTER TABLE dbo.teams ADD updated_at DATETIME2 NOT NULL CONSTRAINT DF_teams_updated_at DEFAULT SYSUTCDATETIME();
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_teams_status')
    CREATE INDEX IX_teams_status ON dbo.teams(status);
GO
