-- LeagueCore - Primera fuente REAL conectada al motor de importación (migración 020): carga de
-- archivos CSV/JSON que el propio administrador provee. Sin llamadas a redes externas, así que no
-- hereda ninguna restricción de robots.txt/ToS como otras fuentes web (ver
-- docs/FUTURO_IMPORTACION_DATOS_EXTERNOS.md).

USE LeagueCore;
GO

IF NOT EXISTS (SELECT 1 FROM dbo.sync_sources WHERE code = 'file_import')
BEGIN
    INSERT INTO dbo.sync_sources (code, name, status, status_reason) VALUES
    ('file_import', 'Archivo (CSV/JSON)', 'available',
     N'Carga de archivos que el propio administrador provee -- sin llamadas a redes externas, sin restricciones de robots.txt/ToS. Se procesan con el mismo motor de coincidencia/conflictos que cualquier otra fuente.');
END
GO
