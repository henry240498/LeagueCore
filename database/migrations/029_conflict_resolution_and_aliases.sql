-- Motor de resolución de conflictos real (hasta ahora sync_conflicts sólo se LISTABA, nunca se
-- podía actuar sobre ellos -- 42 conflictos reales quedaron pendientes sin ninguna forma de
-- resolverlos). Dos tipos de conflicto:
--   'duplicate_entity' (el que ya existía): nombre parecido pero no idéntico contra una entidad
--   existente (competición/equipo/jugador) -- ¿son la misma o son distintas?
--   'field_diff' (nuevo): la MISMA entidad (mismo torneo/temporada/fecha/equipos) pero con algún
--   campo distinto (ej. resultado 2-1 vs 3-1, estadio distinto) -- ¿cuál valor vale?
SET QUOTED_IDENTIFIER ON;
GO
USE LeagueCore;
GO

ALTER TABLE dbo.sync_conflicts ADD conflict_kind NVARCHAR(20) NOT NULL DEFAULT 'duplicate_entity';
GO
ALTER TABLE dbo.sync_conflicts ADD CONSTRAINT CK_sync_conflicts_kind CHECK (conflict_kind IN ('duplicate_entity', 'field_diff'));
GO
ALTER TABLE dbo.sync_conflicts ADD resolution_action NVARCHAR(20) NULL;
GO
ALTER TABLE dbo.sync_conflicts ADD CONSTRAINT CK_sync_conflicts_resolution CHECK (
  resolution_action IS NULL OR resolution_action IN ('link_existing', 'create_new', 'keep_existing', 'use_imported', 'skip')
);
GO

-- Memoria de alias externos para competiciones/equipos (players/officials/seasons ya lo tenían) --
-- cuando un admin resuelve un conflicto de "duplicado" con "son la misma entidad", esto permite
-- que la PRÓXIMA importación de la misma fuente lo vincule automáticamente en vez de generar el
-- mismo conflicto de nuevo (EntityMatcherService ya sabe usar estas columnas para eso).
ALTER TABLE dbo.competitions ADD external_source NVARCHAR(50) NULL, external_id NVARCHAR(100) NULL;
GO
ALTER TABLE dbo.teams ADD external_source NVARCHAR(50) NULL, external_id NVARCHAR(100) NULL;
GO
