-- LeagueCore - eFootball/PES agrupa sus atributos ofensivos bajo una categoría "Attacking" (finalización +
-- definición ofensiva + potencia de tiro) que no equivale exactamente a "Tiro" (SHO, categoría de
-- FIFA/EA SPORTS FC) -- mapearla ahí sería tergiversar el dato real de la fuente. Se agrega como
-- categoría propia en vez de forzarla dentro de una existente, mismo criterio de flexibilidad del
-- catálogo ya documentado en la migración 035 ("si otro videojuego usa otros atributos, no
-- descartarlos").

SET QUOTED_IDENTIFIER ON;
GO
USE LeagueCore;
GO

IF NOT EXISTS (SELECT 1 FROM dbo.player_videogame_attribute_categories WHERE code = 'ATK')
BEGIN
    INSERT INTO dbo.player_videogame_attribute_categories (code, name_es, player_type, sort_order) VALUES
        (N'ATK', N'Ataque', N'field', 0);
END
GO
