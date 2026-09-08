-- LeagueCore - Cuarta fuente REAL conectada al motor de importación: RSSSF (Rec.Sport.Soccer
-- Statistics Foundation) para la reconstrucción histórica del fútbol paraguayo, a pedido explícito
-- del usuario. Verificado ANTES de programar: sin robots.txt (404, a diferencia de
-- worldfootball.net) y con permiso explícito de copia con atribución en la propia página
-- ("Access to all data collected in the archive shall be free for anyone with access to the WWW" +
-- "You are free to copy this document in whole or part provided that proper acknowledgement is
-- given to the RSSSF"), verificado el 2026-08-25.

USE LeagueCore;
GO

IF NOT EXISTS (SELECT 1 FROM dbo.sync_sources WHERE code = 'rsssf')
BEGIN
    INSERT INTO dbo.sync_sources (code, name, status, status_reason) VALUES
    ('rsssf', 'RSSSF - Paraguay (histórico 1906-presente)', 'available',
     N'Archivo histórico mantenido por voluntarios (rsssf.org). Sin robots.txt y con permiso explícito de copia citando la fuente. Cobertura real: 1906-1959 en un documento único, formato muy variable por época; desde 1960, una página por año, con más detalle cuanto más reciente. Nada anterior a 1906 (fundación de la LPF). Formato no documentado oficialmente, reconstruido analizando páginas reales -- se exige vista previa antes de importar de verdad.');
END
GO
