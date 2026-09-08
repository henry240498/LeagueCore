-- LeagueCore - Segunda fuente REAL conectada al motor de importación: TheSportsDB (plan gratuito).
-- TheSportsDB permite explícitamente el acceso programático por sus propios términos de uso:
-- "You can scrape, copy and modify any content returned from the API, as long as you use the
-- official end points." Sin bloqueo de ClaudeBot ni de ningún rastreador de IA en su robots.txt/
-- términos -- verificado 2026-08-24.
--
-- Límites REALES del plan gratuito, verificados con llamadas reales (no sólo documentación):
-- máximo 10 equipos por liga, 5 filas de tabla de posiciones, 15 partidos por temporada, 10
-- jugadores por plantel -- se documentan acá y se muestran en la UI antes/después de cada
-- importación para no dar la impresión de una importación completa cuando no lo es.

USE LeagueCore;
GO

IF NOT EXISTS (SELECT 1 FROM dbo.sync_sources WHERE code = 'thesportsdb')
BEGIN
    INSERT INTO dbo.sync_sources (code, name, status, status_reason) VALUES
    ('thesportsdb', 'TheSportsDB.com (plan gratuito)', 'available',
     N'API oficial, acceso programático explícitamente permitido por sus términos de uso, sin restricción para rastreadores de IA. Límites reales del plan gratuito verificados el 2026-08-24: máximo 10 equipos por liga, 5 filas de tabla de posiciones, 15 partidos por temporada, 10 jugadores por plantel -- una temporada/plantel real casi siempre tiene más de lo que este plan puede devolver.');
END
GO
