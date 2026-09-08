SET QUOTED_IDENTIFIER ON;
GO
USE LeagueCore;
GO
IF NOT EXISTS (SELECT 1 FROM dbo.data_sources WHERE code = 'abc_color')
INSERT INTO dbo.data_sources (code, name, base_url, source_type, trust_level, priority, status, restrictions, last_checked_at) VALUES
('abc_color', 'ABC Color', 'https://www.abc.com.py', 'media', 3, 60, 'available', 'Diario paraguayo real. robots.txt sin restricción para el artículo usado (edición impresa/deportes). Verificado accesible.', SYSUTCDATETIME()),
('portal_guarani', 'Portal Guaraní', 'https://www.portalguarani.com', 'encyclopedia', 3, 60, 'blocked', 'robots.txt bloquea explícitamente a GPTBot (rastreadores de IA) -- no se usó ningún dato de acá aunque el contenido era accesible por fetch directo, por la misma regla de no evadir restricciones de la fuente.', SYSUTCDATETIME());
GO
