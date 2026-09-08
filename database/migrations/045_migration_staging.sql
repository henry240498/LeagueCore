-- Motor de migración histórica (Registro Fútbol → LeagueCore) — cola de staging real.
--
-- Ningún pipeline existente sirve para esto a escala: el motor de importación genérico
-- (EntityMatcherService/ConflictResolutionService) es código muerto hoy, y el motor de
-- investigación (research/) escribe directo a producción registro a registro, sin cola ni
-- transacción. El propio pedido del cliente ("CAPTURA → COLA → NORMALIZACIÓN → MATCHING →
-- RECONCILIACIÓN → VALIDACIÓN → LEAGUECORE") pide exactamente lo que falta: una tabla de cola
-- real. Se reutiliza todo lo demás tal cual (dbo.sync_runs/sync_sources/sync_conflicts/
-- field_provenance/entity_external_ids) -- esta es la única tabla nueva de "motor" en sí, ver
-- docs/ANALISIS_INICIAL_LEAGUECORE.md y el plan técnico aprobado para el detalle completo.
--
-- Cada fila = una entidad candidata capturada de la fuente, que avanza por pipeline_status a
-- medida que las etapas del pipeline la procesan. sync_run_id agrupa todo bajo una corrida real
-- de dbo.sync_runs (source_code = 'registrofutbol_migration', ver seed más abajo).

SET QUOTED_IDENTIFIER ON;
GO
USE LeagueCore;
GO

IF OBJECT_ID('dbo.migration_staging_items', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.migration_staging_items (
        id                  BIGINT IDENTITY(1,1) PRIMARY KEY,
        sync_run_id         INT             NOT NULL,
        entity_type         NVARCHAR(30)    NOT NULL,
        source_ref          NVARCHAR(300)   NULL,
        raw_payload         NVARCHAR(MAX)   NOT NULL,
        normalized_payload  NVARCHAR(MAX)   NULL,
        pipeline_status     NVARCHAR(20)    NOT NULL CONSTRAINT DF_msi_status DEFAULT 'captured',
        match_verdict       NVARCHAR(20)    NULL,
        matched_entity_id   INT             NULL,
        committed_entity_id INT             NULL,
        sync_conflict_id    INT             NULL,
        error_message       NVARCHAR(1000)  NULL,
        captured_at         DATETIME2       NOT NULL CONSTRAINT DF_msi_captured_at DEFAULT SYSUTCDATETIME(),
        processed_at        DATETIME2       NULL,
        CONSTRAINT FK_msi_sync_run FOREIGN KEY (sync_run_id) REFERENCES dbo.sync_runs(id),
        CONSTRAINT FK_msi_sync_conflict FOREIGN KEY (sync_conflict_id) REFERENCES dbo.sync_conflicts(id),
        CONSTRAINT CK_msi_entity_type CHECK (entity_type IN (
            'competition', 'season', 'team', 'venue', 'player', 'official', 'coach',
            'player_team_history', 'coach_team_history', 'match', 'lineup',
            'goal', 'card', 'penalty', 'match_team_stats'
        )),
        CONSTRAINT CK_msi_status CHECK (pipeline_status IN (
            'captured', 'normalized', 'matched', 'conflict', 'reconciled',
            'validated', 'committed', 'rejected', 'error'
        )),
        CONSTRAINT CK_msi_verdict CHECK (match_verdict IS NULL OR match_verdict IN ('new', 'same', 'ambiguous'))
    );
    CREATE INDEX IX_msi_run_status ON dbo.migration_staging_items(sync_run_id, pipeline_status);
    CREATE INDEX IX_msi_entity_type ON dbo.migration_staging_items(entity_type, pipeline_status);
END
GO

-- Fuente citable (dbo.data_sources -- catálogo de fuentes, no de conectores).
IF NOT EXISTS (SELECT 1 FROM dbo.data_sources WHERE code = 'registrofutbol')
INSERT INTO dbo.data_sources (code, name, base_url, source_type, trust_level, priority, status, restrictions, last_checked_at)
VALUES ('registrofutbol', 'Registro Fútbol', 'https://registrofutbol.cl', 'paid_platform', 4, 55, 'available',
        'Acceso autenticado con cuenta personal del cliente, exclusivamente en modo lectura. Sin API pública; captura vía sesión supervisada, nunca automatizada sin supervisión.',
        SYSUTCDATETIME());
GO

-- Conector/motor (dbo.sync_sources) -- agrupa las corridas de este pipeline, separado de
-- 'historical_research' porque el flujo (captura por lotes + cola + commit transaccional) y el
-- volumen esperado son distintos, aunque comparten toda la infraestructura de tracking genérica.
IF NOT EXISTS (SELECT 1 FROM dbo.sync_sources WHERE code = 'registrofutbol_migration')
INSERT INTO dbo.sync_sources (code, name, status, status_reason)
VALUES ('registrofutbol_migration', 'Migración histórica — Registro Fútbol', 'available', NULL);
GO
