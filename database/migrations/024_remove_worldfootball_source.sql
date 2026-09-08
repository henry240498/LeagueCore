-- LeagueCore - Elimina WorldFootball.net del motor de importación por pedido explícito del
-- administrador. Nunca se conectó como fuente real (quedó siempre 'blocked' desde la migración 020
-- por su propio robots.txt) y ningún dbo.sync_runs la usó -- eliminar la fila es seguro, no rompe
-- ninguna corrida histórica. También corrige el texto de la fuente 'thesportsdb' (migración 022),
-- que comparaba explícitamente contra worldfootball.net en su status_reason.

USE LeagueCore;
GO

DELETE FROM dbo.sync_sources WHERE code = 'worldfootball';
GO

UPDATE dbo.sync_sources
SET status_reason = N'API oficial, acceso programático explícitamente permitido por sus términos de uso, sin restricción para rastreadores de IA. Límites reales del plan gratuito verificados el 2026-08-24: máximo 10 equipos por liga, 5 filas de tabla de posiciones, 15 partidos por temporada, 10 jugadores por plantel -- una temporada/plantel real casi siempre tiene más de lo que este plan puede devolver.'
WHERE code = 'thesportsdb';
GO
