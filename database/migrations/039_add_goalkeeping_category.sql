-- LeagueCore - eFootball, a diferencia de FIFA/EA SPORTS FC, no reemplaza las categorías de campo
-- por un set exclusivo de arquero -- un arquero real (ej. Gatito Fernández) tiene valores genuinos
-- en Ataque/Regate/Defensa/Pase/Físico Y ADEMÁS una categoría "Goalkeeping" compuesta real (no un
-- valor base de relleno como sí ocurre con los jugadores de campo). El catálogo DIV/HAN/KIC/REF/
-- SPD/POS sembrado en la migración 035 modela la convención de FIFA, que no aplica acá -- se agrega
-- "GK" como categoría real y propia en vez de forzar los datos de eFootball dentro de ese set
-- ajeno, mismo criterio que ya motivó agregar "ATK" en la migración 038.

SET QUOTED_IDENTIFIER ON;
GO
USE LeagueCore;
GO

IF NOT EXISTS (SELECT 1 FROM dbo.player_videogame_attribute_categories WHERE code = 'GK')
BEGIN
    INSERT INTO dbo.player_videogame_attribute_categories (code, name_es, player_type, sort_order) VALUES
        (N'GK', N'Portería', N'goalkeeper', 0);
END
GO
