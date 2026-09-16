-- LeagueCore - Fase 7: asistente IA local por reglas (puntos 40-42 del pedido).
-- Sin LLM externo ni infraestructura nueva: las respuestas se generan con reglas deterministicas
-- sobre datos reales. ai_queries guarda el historial (pregunta, intencion detectada, respuesta).
-- ai_reports guarda informes generados (resumen de partido, scouting) para relectura/auditoria.
-- Ejecutar con sqlcmd -f 65001 (UTF-8).

SET QUOTED_IDENTIFIER ON;
GO
SET ANSI_NULLS ON;
GO
USE LeagueCore;
GO

IF OBJECT_ID('dbo.ai_queries', 'U') IS NULL
CREATE TABLE dbo.ai_queries (
    id INT IDENTITY(1,1) PRIMARY KEY,
    question NVARCHAR(1000) NOT NULL,
    intent NVARCHAR(50) NULL,
    answer NVARCHAR(MAX) NULL,
    created_by NVARCHAR(150) NULL,
    created_at DATETIME2 NOT NULL CONSTRAINT DF_aiq_created_at DEFAULT SYSUTCDATETIME()
);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_aiq_created')
    CREATE INDEX IX_aiq_created ON dbo.ai_queries(created_at DESC);
GO

IF OBJECT_ID('dbo.ai_reports', 'U') IS NULL
CREATE TABLE dbo.ai_reports (
    id INT IDENTITY(1,1) PRIMARY KEY,
    kind NVARCHAR(30) NOT NULL,
    entity_type NVARCHAR(30) NULL,
    entity_id INT NULL,
    title NVARCHAR(200) NOT NULL,
    content NVARCHAR(MAX) NULL,
    created_by NVARCHAR(150) NULL,
    created_at DATETIME2 NOT NULL CONSTRAINT DF_air_created_at DEFAULT SYSUTCDATETIME(),
    CONSTRAINT CK_air_kind CHECK (kind IN ('RESUMEN_PARTIDO', 'SCOUTING', 'TENDENCIA', 'RESPUESTA'))
);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_air_kind')
    CREATE INDEX IX_air_kind ON dbo.ai_reports(kind, created_at DESC);
GO
