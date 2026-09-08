-- LeagueCore - Campos que la investigación histórica necesita completar y que hoy no existen:
-- ciudad/lugar de nacimiento, altura y pie dominante del jugador; ciudad/lugar de nacimiento del
-- oficial (pedido explícito, "Parte 4" y "Parte 6" del pedido de investigación real). Puramente
-- aditivo, mismo criterio que toda esta serie de migraciones.

SET QUOTED_IDENTIFIER ON;
GO
USE LeagueCore;
GO

IF COL_LENGTH('dbo.players', 'birth_place') IS NULL
    ALTER TABLE dbo.players ADD birth_place NVARCHAR(120) NULL;
GO
IF COL_LENGTH('dbo.players', 'height_cm') IS NULL
    ALTER TABLE dbo.players ADD height_cm SMALLINT NULL;
GO
IF COL_LENGTH('dbo.players', 'preferred_foot') IS NULL
    ALTER TABLE dbo.players ADD preferred_foot NVARCHAR(20) NULL;
GO

IF COL_LENGTH('dbo.officials', 'birth_place') IS NULL
    ALTER TABLE dbo.officials ADD birth_place NVARCHAR(120) NULL;
GO
