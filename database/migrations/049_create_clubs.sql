-- LeagueCore - Fase 1: gestion integral de clubes multi-equipo.
-- Un CLUB es la entidad madre (escudo, colores, identidad, historial); cada fila de dbo.teams
-- pasa a ser un EQUIPO/CATEGORIA del club (Primera, Reserva, Sub-20, Sub-17, Femenino,
-- Infantil, Equipo B). No se toca ningun equipo existente: club_id/category son NULLABLE.
-- Ejecutar con sqlcmd -f 65001 (UTF-8) como el resto de migraciones.

SET QUOTED_IDENTIFIER ON;
GO
SET ANSI_NULLS ON;
GO
USE LeagueCore;
GO

-- 1) Tabla madre de clubes -------------------------------------------------
IF OBJECT_ID('dbo.clubs', 'U') IS NULL
CREATE TABLE dbo.clubs (
    id INT IDENTITY(1,1) PRIMARY KEY,
    name NVARCHAR(150) NOT NULL,
    short_name NVARCHAR(20) NULL,
    country NVARCHAR(80) NULL,
    city NVARCHAR(120) NULL,
    founded_year INT NULL,
    logo_url NVARCHAR(500) NULL,
    primary_color NCHAR(7) NULL,
    secondary_color NCHAR(7) NULL,
    history NVARCHAR(MAX) NULL,
    status NVARCHAR(30) NOT NULL CONSTRAINT DF_clubs_status DEFAULT N'active',
    created_at DATETIME2 NOT NULL CONSTRAINT DF_clubs_created_at DEFAULT SYSUTCDATETIME(),
    updated_at DATETIME2 NOT NULL CONSTRAINT DF_clubs_updated_at DEFAULT SYSUTCDATETIME()
);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_clubs_status')
    CREATE INDEX IX_clubs_status ON dbo.clubs(status);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_clubs_country')
    CREATE INDEX IX_clubs_country ON dbo.clubs(country);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UX_clubs_name' AND object_id = OBJECT_ID('dbo.clubs'))
    CREATE UNIQUE INDEX UX_clubs_name ON dbo.clubs(name);
GO

-- 2) Vinculo equipo -> club + categoria --------------------------------------
IF COL_LENGTH('dbo.teams', 'club_id') IS NULL
    ALTER TABLE dbo.teams ADD club_id INT NULL CONSTRAINT FK_teams_club FOREIGN KEY REFERENCES dbo.clubs(id);
GO
IF COL_LENGTH('dbo.teams', 'category') IS NULL
    ALTER TABLE dbo.teams ADD category NVARCHAR(20) NULL;
GO

IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_teams_category')
    ALTER TABLE dbo.teams ADD CONSTRAINT CK_teams_category
        CHECK (category IS NULL OR category IN (
            'PRIMERA', 'RESERVA', 'SUB20', 'SUB17', 'FEMENINO', 'INFANTIL', 'EQUIPO_B'));
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_teams_club')
    CREATE INDEX IX_teams_club ON dbo.teams(club_id);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_teams_club_category')
    CREATE INDEX IX_teams_club_category ON dbo.teams(club_id, category);
GO

-- 3) Cuerpo tecnico + staff por club -----------------------------------------
IF OBJECT_ID('dbo.club_staff', 'U') IS NULL
CREATE TABLE dbo.club_staff (
    id INT IDENTITY(1,1) PRIMARY KEY,
    club_id INT NOT NULL CONSTRAINT FK_club_staff_club FOREIGN KEY REFERENCES dbo.clubs(id) ON DELETE CASCADE,
    full_name NVARCHAR(150) NOT NULL,
    role NVARCHAR(30) NOT NULL CONSTRAINT DF_club_staff_role DEFAULT N'OTRO',
    team_category NVARCHAR(20) NULL,
    start_date DATE NULL,
    end_date DATE NULL,
    contact NVARCHAR(200) NULL,
    created_at DATETIME2 NOT NULL CONSTRAINT DF_club_staff_created_at DEFAULT SYSUTCDATETIME(),
    CONSTRAINT CK_club_staff_role CHECK (role IN (
        'DT', 'ASISTENTE', 'PF', 'MEDICO', 'KINESIOLOGO',
        'ANALISTA', 'SCOUT', 'DIRECTOR_DEPORTIVO', 'DELEGADO', 'OTRO')),
    CONSTRAINT CK_club_staff_category CHECK (team_category IS NULL OR team_category IN (
        'PRIMERA', 'RESERVA', 'SUB20', 'SUB17', 'FEMENINO', 'INFANTIL', 'EQUIPO_B'))
);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_club_staff_club')
    CREATE INDEX IX_club_staff_club ON dbo.club_staff(club_id);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_club_staff_role')
    CREATE INDEX IX_club_staff_role ON dbo.club_staff(role);
GO
