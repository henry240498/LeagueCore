-- LeagueCore - creación inicial de la base de datos
-- Collation Modern_Spanish_CI_AS: los datos reales de Ltrack incluyen nombres con Ñ y tildes
-- (ej. "CERRO PORTEÑO"). Ajustable mientras la base esté vacía.

IF DB_ID(N'LeagueCore') IS NULL
BEGIN
    CREATE DATABASE LeagueCore
    COLLATE Modern_Spanish_CI_AS;
END
GO
