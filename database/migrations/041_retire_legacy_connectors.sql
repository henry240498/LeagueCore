SET QUOTED_IDENTIFIER ON;
GO
USE LeagueCore;
GO
-- No se borran las filas de dbo.sync_sources (ni las corridas históricas que las referencian por
-- FK) -- son datos reales de lo que efectivamente se ejecutó. Sólo se marca 'blocked' porque el
-- código de estos conectores (RSSSF/TheSportsDB/Ltrack .div-.bak/importador de archivo CSV-JSON-TXT-
-- Excel) fue eliminado del backend: ya no existe ningún endpoint real que pueda iniciar una corrida
-- nueva contra estas fuentes. El motor genérico de investigación (código 'historical_research') es
-- ahora el único conector activo.
UPDATE dbo.sync_sources
SET status = 'blocked',
    status_reason = 'Conector eliminado del sistema (limpieza de importadores legado). Se conserva el registro histórico de corridas ya ejecutadas, pero ya no puede iniciarse una corrida nueva contra esta fuente.'
WHERE code IN ('file_import', 'relational_import', 'ltrack_div', 'rsssf', 'thesportsdb');
GO
