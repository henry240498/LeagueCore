-- YA EJECUTADO (2026-09-01). No es una migración de esquema (la columna/constraint/índice ya existían
-- desde la migración 048), es un fix de datos puntual: clasifica como NATIONAL_TEAM exactamente las
-- 45 filas de dbo.teams autorizadas explícitamente por el cliente (Fase 2). Se documenta acá para el
-- historial, no para volver a correrlo -- si se ejecuta de nuevo no hace nada porque el guard
-- "AND entity_type IS NULL" ya no encuentra ninguna de las 45 filas en NULL.
--
-- Contexto: la auditoría de la migración 048 (ver Modulos/Modulo - Migracion Historica en el vault de
-- Obsidian) identificó que "Chile" (id 158, 676 jugadores) y "Paraguay" (id 143) -- y otros 43 países --
-- están cargados en dbo.teams como si fueran clubes, cuando en realidad son selecciones nacionales
-- (aparecen como rival en partidos internacionales de Registro Fútbol). El cliente autorizó clasificar
-- EXACTAMENTE estos 45, ninguno más:
--   Chile(158), Paraguay(143), Honduras(277), España(148), Francia(265), Rumania(356), Túnez(388),
--   Turquía(389), Serbia(363), Australia(369), Polonia(335), Guatemala(274), Japón(286), Marruecos(306),
--   Eslovaquia(250), Irán(527), Alemania(555), Suiza(377), Egipto(245), Suecia(145), Bulgaria(147),
--   Italia(152), Arabia Saudita(223), Países Bajos(327), Guinea(275), Jamaica(285), Qatar(345),
--   Ucrania(390), Corea del Sur(430), Nueva Zelanda(509), Islandia(525), Irlanda del Norte(526),
--   Austria(475), Camerún(406), Canadá(407), Costa de Marfil(425), Croacia(426), Portugal(336),
--   Bélgica(373), Rusia(357), Haití(276), Ghana(268), Irlanda(283), Israel(284), Dinamarca(244).
--
-- Los IDs se obtuvieron el mismo día, en la misma sesión, vía consulta de auditoría contra
-- normalized_name (columna computada accent-insensitive de la migración 047) -- nunca reutilizados de
-- memoria de una sesión anterior. Verificado antes de ejecutar: las 43 búsquedas por nombre + Chile/
-- Paraguay por id dieron exactamente 45 filas, sin nombre faltante ni duplicado.
--
-- Explícitamente NO tocado en este fix (fuera de alcance de esta fase, por decisión del cliente):
--   - Paraguay id 556 (la fila "Paraguay" sin country, duplicado real de 143 -- se queda NULL, no se
--     fusiona con 143 en esta fase).
--   - Temuco (190) y Unión Temuco (197) -- quedan NULL, sin tocar.
--   - Selección Temuco (479) y las otras 13 "Selección [Ciudad]" (Cauquenes, Valdivia, Tocopilla,
--     Schwager, Pétrufquen, Peñaflor, Ovalle, Osorno, Iquique, De Arica, Copiapó, Calama, Antofagasta)
--     -- evidencia insuficiente para clasificarlas (ver auditoría), quedan NULL.
--   - Ningún equipo se clasificó como CLUB en este fix -- sólo NATIONAL_TEAM, sólo estos 45.
--
-- Resultado verificado tras ejecutar: entity_type NULL=430 / CLUB=0 / NATIONAL_TEAM=45,
-- dbo.teams sigue en 475 filas totales (sin INSERT ni DELETE), cero FKs huérfanas, npm test 24/24 OK.

SET QUOTED_IDENTIFIER ON;
GO
USE LeagueCore;
GO

IF OBJECT_ID('tempdb..#authorized_ids') IS NOT NULL DROP TABLE #authorized_ids;
CREATE TABLE #authorized_ids (id INT PRIMARY KEY);
INSERT INTO #authorized_ids (id) VALUES
(143),(145),(147),(148),(152),(158),(223),(244),(245),(250),(265),(268),(274),(275),(276),(277),
(283),(284),(285),(286),(306),(327),(335),(336),(345),(356),(357),(363),(369),(373),(377),(388),
(389),(390),(406),(407),(425),(426),(430),(475),(509),(525),(526),(527),(555);
GO

BEGIN TRANSACTION;

BEGIN TRY
    UPDATE t SET entity_type = 'NATIONAL_TEAM'
    FROM dbo.teams t
    JOIN #authorized_ids a ON a.id = t.id
    WHERE t.entity_type IS NULL;

    IF (SELECT COUNT(*) FROM dbo.teams WHERE entity_type = 'NATIONAL_TEAM') NOT IN (0, 45)
    BEGIN
        RAISERROR('Conteo de NATIONAL_TEAM inesperado tras el UPDATE -- abortando.', 16, 1);
    END

    IF (SELECT COUNT(*) FROM dbo.teams WHERE entity_type = 'CLUB') <> 0
    BEGIN
        RAISERROR('Se clasificó algún equipo como CLUB -- no autorizado en este fix. Abortando.', 16, 1);
    END

    IF (SELECT COUNT(*) FROM dbo.teams) <> 475
    BEGIN
        RAISERROR('El conteo total de teams cambió de 475 -- abortando.', 16, 1);
    END

    IF EXISTS (SELECT 1 FROM dbo.teams WHERE id IN (556,190,197,479) AND entity_type IS NOT NULL)
    BEGIN
        RAISERROR('Se modificó uno de los ids protegidos (556/190/197/479) -- abortando.', 16, 1);
    END

    COMMIT TRANSACTION;
    SELECT 'OK - transacción confirmada' AS resultado;
END TRY
BEGIN CATCH
    ROLLBACK TRANSACTION;
    SELECT 'ERROR - se revirtió todo' AS resultado, ERROR_MESSAGE() AS mensaje;
END CATCH
GO
