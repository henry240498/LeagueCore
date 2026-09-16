-- LeagueCore - Fase 8: mapas + motor de informes (cierra gaps 9, 23 y 30).
--  - report_templates: plantillas con secciones configurables (JSON) por entidad.
-- Los mapas se derivan en vivo de match_player_positions/shots/goals (con coordenadas reales).
-- El analisis por estado del marcador (ganando/empatando/perdiendo) se deriva de la timeline
-- de goles + minutos de tiros -- ninguna tabla nueva.
-- Ejecutar con sqlcmd -f 65001 (UTF-8).

SET QUOTED_IDENTIFIER ON;
GO
SET ANSI_NULLS ON;
GO
USE LeagueCore;
GO

IF OBJECT_ID('dbo.report_templates', 'U') IS NULL
CREATE TABLE dbo.report_templates (
    id INT IDENTITY(1,1) PRIMARY KEY,
    name NVARCHAR(100) NOT NULL,
    entity NVARCHAR(20) NOT NULL,
    sections_json NVARCHAR(MAX) NOT NULL,
    created_at DATETIME2 NOT NULL CONSTRAINT DF_rt_created_at DEFAULT SYSUTCDATETIME(),
    updated_at DATETIME2 NOT NULL CONSTRAINT DF_rt_updated_at DEFAULT SYSUTCDATETIME(),
    CONSTRAINT CK_rt_entity CHECK (entity IN ('MATCH', 'PLAYER', 'TEAM')),
    CONSTRAINT UX_rt_name UNIQUE (name)
);
GO
