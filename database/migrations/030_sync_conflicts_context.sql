-- Contexto adicional para poder resolver un conflicto de "duplicado" con "CREAR COMO NUEVO" después
-- de los hechos -- ej. un conflicto de EQUIPO necesita saber a qué competición pertenecía para poder
-- crearlo recién cuando el admin lo resuelve, dato que hasta ahora no se guardaba en ningún lado.
SET QUOTED_IDENTIFIER ON;
GO
USE LeagueCore;
GO
ALTER TABLE dbo.sync_conflicts ADD context_json NVARCHAR(MAX) NULL;
GO
