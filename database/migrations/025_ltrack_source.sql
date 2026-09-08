-- LeagueCore - Tercera fuente REAL conectada al motor de importación: archivos propios de Ltrack
-- (.div/.bak), a pedido explícito del usuario tras eliminar WorldFootball.net del sistema (ver
-- migración 024). A diferencia de las otras dos fuentes (archivo genérico, TheSportsDB), ésta no es
-- una fuente externa de terceros -- son los datos históricos del propio usuario en un formato
-- binario propietario de Ltrack v7.0 (Nugget Software, descontinuado), reconstruido por ingeniería
-- inversa ya que nunca existió una especificación pública. Verificado contra archivos reales
-- (TORNEO REPUBLICA.div/.bak) el 2026-08-25: catálogo de equipos y jugadores con nombres reales,
-- historial de partidos con fecha/resultado real en el .bak. Sin llamadas a redes externas.

USE LeagueCore;
GO

IF NOT EXISTS (SELECT 1 FROM dbo.sync_sources WHERE code = 'ltrack_div')
BEGIN
    INSERT INTO dbo.sync_sources (code, name, status, status_reason) VALUES
    ('ltrack_div', 'Ltrack (.div / .bak)', 'available',
     N'Formato binario propio de Ltrack v7.0, sin especificación pública -- reconstruido por ingeniería inversa y verificado contra archivos reales. Los .div suelen tener sólo equipos y plantel de jugadores; el historial de partidos (fecha/resultado) generalmente sólo está en el .bak (respaldo). Subí ambos archivos del mismo torneo para obtener el panorama completo. Al ser un formato no documentado oficialmente, siempre revisá la vista previa antes de importar de verdad.');
END
GO
