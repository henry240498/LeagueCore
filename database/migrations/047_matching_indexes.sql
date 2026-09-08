-- Columnas normalizadas + índices para que el matching de la migración histórica escale.
--
-- Hoy name-match.util.ts (motor de investigación) hace un SELECT * de toda dbo.players/officials
-- y normaliza+puntúa en memoria por CADA registro sometido -- aceptable con "decenas de filas"
-- (comentario propio del código), no para una migración masiva. En vez de reescribir la
-- normalización Unicode (NFD + strip de diacríticos) como una función CLR, se resuelve con el
-- mecanismo nativo de SQL Server: una columna computada PERSISTED comparada con una collation
-- accent-insensitive (Latin1_General_100_CI_AI, no Modern_Spanish_CI_AS que es accent-SENSITIVE,
-- ver database/migrations/README.md). Así "Porteño" y "Porteno" comparan igual sin reimplementar
-- nada de lógica de texto -- el matcher hace primero un WHERE indexado (shortlist), y recién
-- sobre ese shortlist aplica el scoring multi-atributo (nombre+DOB+nacionalidad+contexto) que ya
-- existe en name-match.util.ts / entity-matcher.service.ts, sin escanear la tabla completa.
--
-- last_name aparte (no sólo full_name) porque el propio scoring de name-match.util.ts usa
-- "mismo apellido" como la señal que define el balde de candidatos (+15/+35/+60 según el resto
-- coincida) -- filtrar primero por apellido normalizado es más selectivo que un LIKE sobre el
-- nombre completo.

SET QUOTED_IDENTIFIER ON;
GO
USE LeagueCore;
GO

IF COL_LENGTH('dbo.players', 'normalized_last_name') IS NULL
    ALTER TABLE dbo.players ADD normalized_last_name AS (LOWER(last_name) COLLATE Latin1_General_100_CI_AI) PERSISTED;
GO
-- full_name en sí es una columna computada (first_name + ' ' + last_name, migración 011) y SQL
-- Server no permite que una columna computada persistida use otra computada como base -- se repite
-- la expresión sobre las columnas físicas en vez de referenciar full_name.
IF COL_LENGTH('dbo.players', 'normalized_full_name') IS NULL
    ALTER TABLE dbo.players ADD normalized_full_name AS (LOWER(LTRIM(RTRIM(first_name + N' ' + last_name))) COLLATE Latin1_General_100_CI_AI) PERSISTED;
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_players_normalized_last_name')
    CREATE INDEX IX_players_normalized_last_name ON dbo.players(normalized_last_name);
GO

IF COL_LENGTH('dbo.officials', 'normalized_last_name') IS NULL
    ALTER TABLE dbo.officials ADD normalized_last_name AS (LOWER(last_name) COLLATE Latin1_General_100_CI_AI) PERSISTED;
GO
IF COL_LENGTH('dbo.officials', 'normalized_full_name') IS NULL
    ALTER TABLE dbo.officials ADD normalized_full_name AS (LOWER(LTRIM(RTRIM(first_name + N' ' + last_name))) COLLATE Latin1_General_100_CI_AI) PERSISTED;
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_officials_normalized_last_name')
    CREATE INDEX IX_officials_normalized_last_name ON dbo.officials(normalized_last_name);
GO

IF COL_LENGTH('dbo.coaches', 'normalized_last_name') IS NULL
    ALTER TABLE dbo.coaches ADD normalized_last_name AS (LOWER(last_name) COLLATE Latin1_General_100_CI_AI) PERSISTED;
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_coaches_normalized_last_name')
    CREATE INDEX IX_coaches_normalized_last_name ON dbo.coaches(normalized_last_name);
GO

IF COL_LENGTH('dbo.teams', 'normalized_name') IS NULL
    ALTER TABLE dbo.teams ADD normalized_name AS (LOWER(name) COLLATE Latin1_General_100_CI_AI) PERSISTED;
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_teams_normalized_name')
    CREATE INDEX IX_teams_normalized_name ON dbo.teams(normalized_name);
GO

IF COL_LENGTH('dbo.competitions', 'normalized_name') IS NULL
    ALTER TABLE dbo.competitions ADD normalized_name AS (LOWER(name) COLLATE Latin1_General_100_CI_AI) PERSISTED;
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_competitions_normalized_name')
    CREATE INDEX IX_competitions_normalized_name ON dbo.competitions(normalized_name);
GO

IF COL_LENGTH('dbo.venues', 'normalized_name') IS NULL
    ALTER TABLE dbo.venues ADD normalized_name AS (LOWER(name) COLLATE Latin1_General_100_CI_AI) PERSISTED;
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_venues_normalized_name')
    CREATE INDEX IX_venues_normalized_name ON dbo.venues(normalized_name);
GO
