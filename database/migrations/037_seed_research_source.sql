-- LeagueCore - Fuente para el nuevo motor de investigación histórica. sync_runs.source_code exige
-- una fila real en sync_sources (FK) -- mismo requisito ya visto con relational_import (migración
-- 033). Se reusa la tabla/infraestructura de corridas existente (sync_runs/sync_run_stages/
-- sync_conflicts/sync_errors/sync_log_entries) para el nuevo motor -- ver changelog v49 para la
-- decisión de no renombrar sync_*->research_* en esta pasada (prioridad: funcionalidad real, no
-- renombres cosméticos).

SET QUOTED_IDENTIFIER ON;
GO
USE LeagueCore;
GO

IF NOT EXISTS (SELECT 1 FROM dbo.sync_sources WHERE code = 'historical_research')
BEGIN
    INSERT INTO dbo.sync_sources (code, name, status, status_reason) VALUES
    ('historical_research', 'Investigación y Enriquecimiento Histórico', 'available',
     'Motor de investigación asistida (Wikipedia, Wikidata y otras fuentes públicas verificables) para jugadores, oficiales y valoraciones de videojuego. Cada corrida se registra con su alcance real (país/competición/rango de años) en scope_json.');
END
GO
