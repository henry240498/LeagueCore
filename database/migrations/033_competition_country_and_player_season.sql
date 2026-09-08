-- Corrección arquitectónica del modelo relacional (competición/temporada/equipo/jugador) para
-- soportar la importación masiva multi-hoja: dos huecos reales confirmados analizando el esquema.
--
SET QUOTED_IDENTIFIER ON;
GO
SET ANSI_NULLS ON;
GO
USE LeagueCore;
GO
--
-- 1) dbo.competitions NO tenía columna de país -- confirmado en las 32 migraciones anteriores. Sin
--    esto, "Primera División" de Paraguay y "Primera División" de Argentina son indistinguibles
--    para el matching por nombre (dbo.competitions.name es todo lo que hay). El propio importador
--    RSSSF ya documentaba esta limitación en su código ("sólo procesa Paraguay, no se fuerza país
--    porque no existe en el modelo") -- ahora sí se necesita porque el importador relacional nuevo
--    debe distinguir competiciones de países distintos con el mismo nombre.
IF COL_LENGTH('dbo.competitions', 'country') IS NULL
    ALTER TABLE dbo.competitions ADD country NVARCHAR(80) NULL;
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_competitions_country')
    CREATE INDEX IX_competitions_country ON dbo.competitions(country);
GO

-- 2) dbo.player_team_history no tenía season_id -- se creó en la migración 011, ANTES de que
--    existiera dbo.seasons (migración 013), y nunca se retocó (documentado explícitamente en el
--    comentario de la 011: "Temporada todavía no existe como módulo, a propósito no se inventa
--    acá"). Sin esto, la participación de un jugador en un equipo sólo se puede inferir por rango
--    de fechas (start_date/end_date), nunca atarla a una temporada concreta -- el mismo problema
--    estructural que competitions/country, aplicado a jugadores en vez de competiciones.
IF COL_LENGTH('dbo.player_team_history', 'season_id') IS NULL
    ALTER TABLE dbo.player_team_history ADD season_id INT NULL;
GO
IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_pth_season')
    ALTER TABLE dbo.player_team_history ADD CONSTRAINT FK_pth_season FOREIGN KEY (season_id) REFERENCES dbo.seasons(id);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_pth_season_id')
    CREATE INDEX IX_pth_season_id ON dbo.player_team_history(season_id);
GO

-- Ambos cambios son NULL-able y puramente aditivos: no se toca ni se borra ningún dato existente.
-- Verificado antes de escribir esta migración que los 189 partidos / 13 competiciones / 328 filas
-- de season_teams ya reales en la base no requieren ninguna reconstrucción -- el importador RSSSF
-- ya resolvía season_id correctamente; el hueco era sólo en el importador genérico de archivos.

-- 3) Nueva fuente para dbo.sync_sources -- mismo patrón que la migración 021 (file_import): el
--    importador relacional multi-hoja es un conector nuevo y distinto de FileImportService (procesa
--    TODAS las hojas de un archivo en una corrida, no una entidad a la vez), así que necesita su
--    propio código registrado -- dbo.sync_runs.source_code tiene FK a esta tabla catálogo.
IF NOT EXISTS (SELECT 1 FROM dbo.sync_sources WHERE code = 'relational_import')
BEGIN
    INSERT INTO dbo.sync_sources (code, name, status, status_reason) VALUES
    ('relational_import', 'Importación relacional (Excel multi-hoja)', 'available',
     N'Procesa todas las hojas de un mismo archivo (Competiciones/Estadios/Equipos/Jugadores/Partidos/Oficiales) en una sola corrida, resolviendo competición+país+temporada por fila -- corrige la limitación de "un tipo de entidad por corrida" del importador de archivo genérico.');
END
GO
