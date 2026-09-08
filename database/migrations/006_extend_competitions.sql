-- LeagueCore - extiende dbo.competitions para el Módulo 3 (gestión de competiciones)
-- Campos propuestos por el usuario en el roadmap de módulos (2026-08-20): nombre (ya existía),
-- descripción, tipo, deporte, estado, fechas, organización, logo, observaciones.
--
-- IMPORTANTE: type/sport/status se guardan como texto libre (NVARCHAR), NO como enum/CHECK
-- constraint. El propio usuario indicó que "tipos de competición", "estados" y "deporte" son
-- justamente lo que debería parametrizar el futuro Módulo 2 (Configuración/Parametrización,
-- todavía no construido) — fijar una lista cerrada acá sería invertir el orden que él mismo pidió.

USE LeagueCore;
GO

IF COL_LENGTH('dbo.competitions', 'description') IS NULL
    ALTER TABLE dbo.competitions ADD description NVARCHAR(500) NULL;
GO
IF COL_LENGTH('dbo.competitions', 'competition_type') IS NULL
    ALTER TABLE dbo.competitions ADD competition_type NVARCHAR(50) NULL;
GO
IF COL_LENGTH('dbo.competitions', 'sport') IS NULL
    ALTER TABLE dbo.competitions ADD sport NVARCHAR(50) NOT NULL CONSTRAINT DF_comp_sport DEFAULT N'Fútbol';
GO
IF COL_LENGTH('dbo.competitions', 'status') IS NULL
    ALTER TABLE dbo.competitions ADD status NVARCHAR(30) NOT NULL CONSTRAINT DF_comp_status DEFAULT N'active';
GO
IF COL_LENGTH('dbo.competitions', 'start_date') IS NULL
    ALTER TABLE dbo.competitions ADD start_date DATE NULL;
GO
IF COL_LENGTH('dbo.competitions', 'end_date') IS NULL
    ALTER TABLE dbo.competitions ADD end_date DATE NULL;
GO
IF COL_LENGTH('dbo.competitions', 'organization') IS NULL
    ALTER TABLE dbo.competitions ADD organization NVARCHAR(150) NULL;
GO
IF COL_LENGTH('dbo.competitions', 'logo_url') IS NULL
    ALTER TABLE dbo.competitions ADD logo_url NVARCHAR(500) NULL;
GO
IF COL_LENGTH('dbo.competitions', 'observations') IS NULL
    ALTER TABLE dbo.competitions ADD observations NVARCHAR(1000) NULL;
GO
IF COL_LENGTH('dbo.competitions', 'updated_at') IS NULL
    ALTER TABLE dbo.competitions ADD updated_at DATETIME2 NOT NULL CONSTRAINT DF_comp_updated_at DEFAULT SYSUTCDATETIME();
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_competitions_status')
    CREATE INDEX IX_competitions_status ON dbo.competitions(status);
GO
