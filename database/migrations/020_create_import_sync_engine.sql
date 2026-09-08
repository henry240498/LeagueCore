-- LeagueCore - Motor de Importación y Sincronización (Seguridad → Importación de datos)
--
-- Contexto: se pidió un motor REUTILIZABLE (no un botón atado a una sola fuente) para poblar
-- LeagueCore desde fuentes externas, con progreso real, pausa/cancelación/reanudación, detección
-- de conflictos y auditoría. Auditoría técnica previa (robots.txt real de worldfootball.net,
-- 2026-08-24): esa fuente bloquea explícitamente "ClaudeBot" por nombre (junto con GPTBot,
-- Google-Extended, etc.), y el user-agent genérico (*) declara Content-Signal ai-train=no,
-- use=reference. Se decidió con el usuario NO construir el conector contra esa fuente por ahora
-- (ver docs/FUTURO_IMPORTACION_DATOS_EXTERNOS.md) -- esta migración construye el MOTOR genérico,
-- sin ninguna fuente conectada todavía.
--
-- dbo.sync_sources: catálogo de fuentes soportables (hoy: worldfootball, listada como bloqueada,
-- con el motivo real). No se reinventa el patrón de "external_source/external_id" que ya existe
-- como columnas directas en competitions/teams/players/officials/seasons/matches -- estas tablas
-- nuevas son sobre el PROCESO de sincronización (corridas, etapas, conflictos, errores, log), no
-- sobre el dato importado en sí (eso ya tiene dónde vivir).

USE LeagueCore;
GO

IF OBJECT_ID('dbo.sync_sources', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.sync_sources (
        code          NVARCHAR(40)  NOT NULL PRIMARY KEY,
        name          NVARCHAR(120) NOT NULL,
        status        NVARCHAR(20)  NOT NULL CHECK (status IN ('available','blocked','planned')),
        status_reason NVARCHAR(500) NULL,
        created_at    DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME()
    );
END
GO

IF NOT EXISTS (SELECT 1 FROM dbo.sync_sources WHERE code = 'worldfootball')
BEGIN
    INSERT INTO dbo.sync_sources (code, name, status, status_reason) VALUES
    ('worldfootball', 'WorldFootball.net', 'blocked',
     'robots.txt de worldfootball.net bloquea explícitamente "ClaudeBot" por nombre (junto con GPTBot, Google-Extended, CCBot, etc.) y declara Content-Signal ai-train=no, use=reference para el resto. Verificado el 2026-08-24. No se conectó este origen por decisión del administrador -- ver docs/FUTURO_IMPORTACION_DATOS_EXTERNOS.md.');
END
GO

IF OBJECT_ID('dbo.sync_runs', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.sync_runs (
        id                  INT IDENTITY(1,1) PRIMARY KEY,
        source_code         NVARCHAR(40)  NOT NULL REFERENCES dbo.sync_sources(code),
        scope_json          NVARCHAR(MAX) NULL,
        status              NVARCHAR(20)  NOT NULL CHECK (status IN ('pending','running','paused','completed','cancelled','failed')),
        is_simulation       BIT           NOT NULL DEFAULT 0,
        started_at          DATETIME2     NULL,
        finished_at         DATETIME2     NULL,
        started_by_user_id  INT           NOT NULL REFERENCES dbo.users(id),
        current_stage       NVARCHAR(60)  NULL,
        current_stage_pct   DECIMAL(5,2)  NULL,
        total_analyzed      INT NOT NULL DEFAULT 0,
        total_new           INT NOT NULL DEFAULT 0,
        total_updated       INT NOT NULL DEFAULT 0,
        total_unchanged     INT NOT NULL DEFAULT 0,
        total_ignored       INT NOT NULL DEFAULT 0,
        total_conflicts     INT NOT NULL DEFAULT 0,
        total_errors        INT NOT NULL DEFAULT 0,
        cancel_requested    BIT NOT NULL DEFAULT 0,
        pause_requested     BIT NOT NULL DEFAULT 0,
        created_at          DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
    );
    CREATE INDEX IX_sync_runs_source ON dbo.sync_runs(source_code, created_at DESC);
END
GO

IF OBJECT_ID('dbo.sync_run_stages', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.sync_run_stages (
        id              INT IDENTITY(1,1) PRIMARY KEY,
        sync_run_id     INT NOT NULL REFERENCES dbo.sync_runs(id),
        stage_name      NVARCHAR(60) NOT NULL,
        sort_order      INT NOT NULL,
        status          NVARCHAR(20) NOT NULL CHECK (status IN ('pending','running','completed','skipped','failed')),
        total_items     INT NULL,
        processed_items INT NOT NULL DEFAULT 0,
        started_at      DATETIME2 NULL,
        finished_at     DATETIME2 NULL
    );
    CREATE INDEX IX_sync_run_stages_run ON dbo.sync_run_stages(sync_run_id, sort_order);
END
GO

IF OBJECT_ID('dbo.sync_conflicts', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.sync_conflicts (
        id                   INT IDENTITY(1,1) PRIMARY KEY,
        sync_run_id          INT NOT NULL REFERENCES dbo.sync_runs(id),
        entity_type          NVARCHAR(40) NOT NULL,
        leaguecore_entity_id INT NULL,
        external_id          NVARCHAR(100) NULL,
        leaguecore_value     NVARCHAR(MAX) NULL,
        external_value       NVARCHAR(MAX) NULL,
        similarity_pct       DECIMAL(5,2) NULL,
        status               NVARCHAR(30) NOT NULL DEFAULT 'pending'
                              CHECK (status IN ('pending','resolved_use_leaguecore','resolved_use_external','resolved_merge','ignored')),
        created_at           DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        resolved_at          DATETIME2 NULL,
        resolved_by_user_id  INT NULL REFERENCES dbo.users(id)
    );
    CREATE INDEX IX_sync_conflicts_run ON dbo.sync_conflicts(sync_run_id, status);
END
GO

IF OBJECT_ID('dbo.sync_errors', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.sync_errors (
        id             INT IDENTITY(1,1) PRIMARY KEY,
        sync_run_id    INT NOT NULL REFERENCES dbo.sync_runs(id),
        entity_type    NVARCHAR(40) NULL,
        resource_ref   NVARCHAR(400) NULL,
        error_type     NVARCHAR(60) NOT NULL,
        message        NVARCHAR(1000) NOT NULL,
        attempt_count  INT NOT NULL DEFAULT 1,
        created_at     DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
    );
    CREATE INDEX IX_sync_errors_run ON dbo.sync_errors(sync_run_id);
END
GO

IF OBJECT_ID('dbo.sync_log_entries', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.sync_log_entries (
        id           INT IDENTITY(1,1) PRIMARY KEY,
        sync_run_id  INT NOT NULL REFERENCES dbo.sync_runs(id),
        created_at   DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        level        NVARCHAR(20) NOT NULL CHECK (level IN ('info','success','warning','error')),
        message      NVARCHAR(500) NOT NULL,
        entity_type  NVARCHAR(40) NULL,
        entity_label NVARCHAR(200) NULL
    );
    CREATE INDEX IX_sync_log_entries_run ON dbo.sync_log_entries(sync_run_id, id DESC);
END
GO
