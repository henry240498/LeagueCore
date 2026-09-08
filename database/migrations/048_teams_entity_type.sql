-- Fase 1 de la corrección de matching de equipos (ver auditoría real: dos filas "Paraguay" --
-- id 143 country=Paraguay real, id 556 country=NULL creado por un país mal atribuido en el
-- scraping de Registro Fútbol -- y al menos 45 equipos más que en realidad son selecciones
-- nacionales, no clubes, incl. "Chile" id 158 con 676 jugadores y 0 atributos de club).
--
-- teams.entity_type distingue explícitamente CLUB de NATIONAL_TEAM sin crear una tabla separada
-- (decisión del cliente: seguir modelando selecciones dentro de dbo.teams, porque las 21 tablas
-- que referencian teams.id ya representan correctamente la relación jugador/partido/estadística
-- sin importar el tipo de equipo -- separar en otra tabla duplicaría esa relación sin necesidad).
--
-- Esta migración es SOLO estructura. A propósito:
--   - NULL permitido, SIN default -- de los 475 equipos existentes, la mayoría no tiene evidencia
--     todavía para clasificar (405 sin country siquiera). Forzar un valor inventaría un dato.
--   - Ningún UPDATE clasifica ningún equipo (ni los 45 candidatos ya identificados con evidencia
--     alta, ni Paraguay 556/143, ni Temuco 190/197, ni los 14 "Selección [Ciudad]" ambiguos).
--   - Sin tocar ninguna de las otras 20 tablas que referencian teams.id.
-- La clasificación real y el algoritmo de matching que la usa quedan para fases posteriores,
-- explícitamente autorizadas por separado.

SET QUOTED_IDENTIFIER ON;
GO
USE LeagueCore;
GO

IF COL_LENGTH('dbo.teams', 'entity_type') IS NULL
    ALTER TABLE dbo.teams ADD entity_type NVARCHAR(20) NULL;
GO

IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_teams_entity_type')
    ALTER TABLE dbo.teams ADD CONSTRAINT CK_teams_entity_type
        CHECK (entity_type IS NULL OR entity_type IN ('CLUB', 'NATIONAL_TEAM'));
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_teams_entity_type')
    CREATE INDEX IX_teams_entity_type ON dbo.teams(entity_type);
GO
