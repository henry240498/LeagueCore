-- Corrección arquitectónica: un CLUB es una entidad independiente, no puede pertenecer a UNA sola
-- competición para siempre (pedido explícito del usuario, ejemplo real: "Valois Rivarola —
-- Campeonato Nacional Interligas" mostrado como si el equipo FUERA de esa competición, cuando en
-- realidad sólo PARTICIPÓ en ella). dbo.season_teams (migración 013) ya es la tabla de
-- participación real y correcta -- lo único que sobraba era teams.competition_id NOT NULL forzando
-- una relación 1:1 que nunca fue cierta en el fútbol real (un club juega Liga Y Copa Libertadores
-- el mismo año, sigue siendo el mismo club).
--
-- Verificado antes de escribir esta migración: de los 117 equipos reales, 50 no tienen ninguna fila
-- en season_teams y tampoco tienen partidos reales -- sin ese dato no hay forma honesta de inferir
-- a qué temporada pertenecían, así que NO se inventa ninguna. competition_id se deja NULLABLE (no
-- se borra, no se dropea la columna) para no perder ese dato real, aunque incompleto -- queda como
-- señal de respaldo ("competición registrada, sin temporada específica") hasta que se complete con
-- datos reales.
SET QUOTED_IDENTIFIER ON;
GO
SET ANSI_NULLS ON;
GO
USE LeagueCore;
GO

IF EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID('dbo.teams') AND name = 'competition_id' AND is_nullable = 0
)
    ALTER TABLE dbo.teams ALTER COLUMN competition_id INT NULL;
GO

-- País del club -- no existía. Antes se heredaba indirectamente (y de forma poco confiable) vía la
-- competición; ahora que un club puede participar en competiciones de países distintos (ej. un
-- club paraguayo en Copa Libertadores, un torneo sudamericano), el club necesita su propio país
-- real para que el matching de identidad (§21/§25 del pedido: "Olimpia" nunca debe fusionarse con
-- un club de otro país que casualmente comparta nombre) no dependa de una competición prestada.
IF COL_LENGTH('dbo.teams', 'country') IS NULL
    ALTER TABLE dbo.teams ADD country NVARCHAR(80) NULL;
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_teams_country')
    CREATE INDEX IX_teams_country ON dbo.teams(country);
GO

-- Nada se borra: los 117 equipos reales conservan su competition_id tal cual estaba. Sólo deja de
-- ser NOT NULL/obligatorio para equipos nuevos, y deja de ser la fuente de verdad para "en qué
-- competición participa" -- eso ahora es season_teams -> seasons -> competitions, ya real y correcto.
