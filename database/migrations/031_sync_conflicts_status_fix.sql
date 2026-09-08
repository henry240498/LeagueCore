-- Bug real encontrado probando el motor de resolución de conflictos de punta a punta: la tabla
-- sync_conflicts ya tenía un CHECK constraint viejo (de cuando se creó la tabla, nunca usado por
-- ningún código hasta ahora) que sólo permitía
-- status IN ('ignored','resolved_merge','resolved_use_external','resolved_use_leaguecore','pending')
-- -- el nuevo ConflictResolutionService usa 'resolved' + una columna separada resolution_action
-- (más flexible: cinco acciones distintas según el tipo de conflicto), lo cual hacía que CUALQUIER
-- resolución fallara con un error de constraint (500 genérico) aunque el resto del trabajo real
-- (actualizar el partido, etc.) ya se hubiera aplicado correctamente -- sólo la fila de
-- sync_conflicts se quedaba sin marcar como resuelta.
SET QUOTED_IDENTIFIER ON;
GO
USE LeagueCore;
GO

ALTER TABLE dbo.sync_conflicts DROP CONSTRAINT [CK__sync_conf__statu__668030F6];
GO
ALTER TABLE dbo.sync_conflicts ADD CONSTRAINT CK_sync_conflicts_status CHECK (status IN ('pending', 'resolved'));
GO
