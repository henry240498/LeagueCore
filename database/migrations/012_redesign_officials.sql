-- LeagueCore - Módulo 6 (Oficiales/Árbitros): rediseño de dbo.officials + catálogo de tipos.
--
-- dbo.officials ya existía (migración 001: id, name, nationality, city, created_at) y
-- dbo.matches.referee_id ya la referencia por FK — se reutiliza la tabla existente, no se crea una
-- nueva. Está vacía (confirmado antes de esta migración) así que se puede alterar libremente.
--
-- Mismo criterio ya aplicado a dbo.players (migración 011, ver
-- docs/ANALISIS_INICIAL_LEAGUECORE.md v15): first_name/last_name + full_name computed PERSISTED
-- (nunca editable por separado), status/nationality como texto libre, foto, columnas de
-- procedencia para futuras importaciones desde fuentes externas.
--
-- Tipo de oficial: a diferencia de player.position (whitelist fija a nivel de aplicación), acá el
-- pedido fue explícito — "la estructura debe permitir agregar nuevos tipos posteriormente sin
-- modificar código" — eso pide una tabla, no un @IsIn(). dbo.official_types es un catálogo mínimo
-- (id, name, status), NO el módulo de Configuración/Parametrización (que sigue diferido); se
-- gestiona desde una pantalla chica dentro del propio módulo Oficiales
-- (src/frontend/src/pages/officials/OfficialTypesPage.tsx), no desde Seguridad ni un nav item
-- propio.
--
-- Columnas de origen/externas: se repiten acá igual que en players (data_origin, external_source,
-- external_id, external_url, last_synced_at) en vez de extraer ya la tabla genérica de referencias
-- externas que docs/FUTURO_IMPORTACION_DATOS_EXTERNOS.md recomienda para más adelante — hacerlo
-- ahora implicaría además migrar dbo.players (ya en producción/probado), un refactor cruzado que
-- no corresponde a este pedido. Con esto ya son 2 tablas duplicando el mismo patrón; si una
-- tercera entidad lo necesita, ese es el momento de extraer la tabla genérica.

SET QUOTED_IDENTIFIER ON;
GO

USE LeagueCore;
GO

-- 1) Catálogo de tipos de oficial — sin esto no se puede definir officials.official_type_id.
IF OBJECT_ID('dbo.official_types', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.official_types (
        id          INT IDENTITY(1,1) PRIMARY KEY,
        name        NVARCHAR(80)    NOT NULL,
        status      NVARCHAR(30)    NOT NULL CONSTRAINT DF_otypes_status DEFAULT N'active',
        sort_order  SMALLINT        NOT NULL CONSTRAINT DF_otypes_sort DEFAULT 0,
        created_at  DATETIME2       NOT NULL CONSTRAINT DF_otypes_created_at DEFAULT SYSUTCDATETIME(),
        CONSTRAINT UX_official_types_name UNIQUE (name)
    );

    INSERT INTO dbo.official_types (name, sort_order) VALUES
        (N'Árbitro principal', 1),
        (N'Árbitro asistente', 2),
        (N'Cuarto árbitro', 3),
        (N'VAR', 4),
        (N'AVAR', 5),
        (N'Otro', 6);
END
GO

-- 2) Nombre: mismo patrón que players — first_name/last_name, full_name SIEMPRE derivado.
IF COL_LENGTH('dbo.officials', 'first_name') IS NULL
    ALTER TABLE dbo.officials ADD first_name NVARCHAR(100) NOT NULL CONSTRAINT DF_officials_first_name DEFAULT N'';
GO
IF COL_LENGTH('dbo.officials', 'last_name') IS NULL
    ALTER TABLE dbo.officials ADD last_name NVARCHAR(100) NOT NULL CONSTRAINT DF_officials_last_name DEFAULT N'';
GO
IF COL_LENGTH('dbo.officials', 'full_name') IS NULL
    ALTER TABLE dbo.officials ADD full_name AS (LTRIM(RTRIM(first_name + N' ' + last_name))) PERSISTED;
GO
IF COL_LENGTH('dbo.officials', 'name') IS NOT NULL
    ALTER TABLE dbo.officials DROP COLUMN name;
GO

-- 3) Resto de columnas nuevas.
IF COL_LENGTH('dbo.officials', 'date_of_birth') IS NULL
    ALTER TABLE dbo.officials ADD date_of_birth DATE NULL;
GO
IF COL_LENGTH('dbo.officials', 'official_type_id') IS NULL
    ALTER TABLE dbo.officials ADD official_type_id INT NULL;
GO
IF COL_LENGTH('dbo.officials', 'status') IS NULL
    ALTER TABLE dbo.officials ADD status NVARCHAR(30) NOT NULL CONSTRAINT DF_officials_status DEFAULT N'active';
GO
IF COL_LENGTH('dbo.officials', 'photo_url') IS NULL
    ALTER TABLE dbo.officials ADD photo_url NVARCHAR(500) NULL;
GO
IF COL_LENGTH('dbo.officials', 'updated_at') IS NULL
    ALTER TABLE dbo.officials ADD updated_at DATETIME2 NOT NULL CONSTRAINT DF_officials_updated_at DEFAULT SYSUTCDATETIME();
GO
IF COL_LENGTH('dbo.officials', 'data_origin') IS NULL
    ALTER TABLE dbo.officials ADD data_origin NVARCHAR(20) NOT NULL CONSTRAINT DF_officials_data_origin DEFAULT N'manual';
GO
IF COL_LENGTH('dbo.officials', 'external_source') IS NULL
    ALTER TABLE dbo.officials ADD external_source NVARCHAR(50) NULL;
GO
IF COL_LENGTH('dbo.officials', 'external_id') IS NULL
    ALTER TABLE dbo.officials ADD external_id NVARCHAR(100) NULL;
GO
IF COL_LENGTH('dbo.officials', 'external_url') IS NULL
    ALTER TABLE dbo.officials ADD external_url NVARCHAR(500) NULL;
GO
IF COL_LENGTH('dbo.officials', 'last_synced_at') IS NULL
    ALTER TABLE dbo.officials ADD last_synced_at DATETIME2 NULL;
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_officials_type'
)
    ALTER TABLE dbo.officials ADD CONSTRAINT FK_officials_type
        FOREIGN KEY (official_type_id) REFERENCES dbo.official_types(id);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_officials_status')
    CREATE INDEX IX_officials_status ON dbo.officials(status);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_officials_full_name')
    CREATE INDEX IX_officials_full_name ON dbo.officials(full_name);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_officials_type_id')
    CREATE INDEX IX_officials_type_id ON dbo.officials(official_type_id);
GO
