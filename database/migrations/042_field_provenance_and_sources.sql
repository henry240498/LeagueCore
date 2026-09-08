SET QUOTED_IDENTIFIER ON;
GO
USE LeagueCore;
GO
-- Procedencia multifuente (Decisiones 3-4 del pedido de "implementación real"). Tres piezas:
--  1. dbo.data_sources: catálogo de fuentes citables (no confundir con dbo.sync_sources, que es el
--     catálogo de CONECTORES/motores de corrida -- una fuente citable como "Wikipedia" no tiene
--     conector propio, se cita desde el motor de investigación genérico).
--  2. dbo.field_provenance: log APEND-ONLY de qué fuente dijo qué valor para qué campo de qué
--     entidad. Nunca se sobrescribe una fila anterior -- si dos fuentes distintas informan la fecha
--     de nacimiento de un jugador, quedan ambas filas, la más reciente es la vigente. El valor real
--     sigue viviendo en la tabla de la entidad (players.date_of_birth, etc.) -- esta tabla es el
--     historial de procedencia, no la fuente de verdad del dato en sí.
--  3. dbo.entity_external_ids: una entidad puede tener varios identificadores externos a la vez
--     (Wikidata + Wikipedia + PESmaster + Sofascore, todos para el mismo jugador), no uno solo como
--     las columnas legado players.external_source/external_id.

IF OBJECT_ID('dbo.data_sources', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.data_sources (
        id              INT IDENTITY(1,1) PRIMARY KEY,
        code            NVARCHAR(50)    NOT NULL,
        name            NVARCHAR(200)   NOT NULL,
        base_url        NVARCHAR(500)   NULL,
        source_type     NVARCHAR(50)    NOT NULL,
        trust_level     TINYINT         NOT NULL CONSTRAINT DF_ds_trust DEFAULT 3,
        priority        INT             NOT NULL CONSTRAINT DF_ds_priority DEFAULT 100,
        status          NVARCHAR(20)    NOT NULL CONSTRAINT DF_ds_status DEFAULT 'available',
        restrictions    NVARCHAR(1000)  NULL,
        last_checked_at DATETIME2       NULL,
        created_at      DATETIME2       NOT NULL CONSTRAINT DF_ds_created_at DEFAULT SYSUTCDATETIME(),
        updated_at      DATETIME2       NOT NULL CONSTRAINT DF_ds_updated_at DEFAULT SYSUTCDATETIME(),
        CONSTRAINT UX_ds_code UNIQUE (code),
        CONSTRAINT CK_ds_status CHECK (status IN ('available', 'blocked', 'restricted')),
        CONSTRAINT CK_ds_trust CHECK (trust_level BETWEEN 1 AND 5)
    );
END
GO

IF OBJECT_ID('dbo.field_provenance', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.field_provenance (
        id                  BIGINT IDENTITY(1,1) PRIMARY KEY,
        entity_type         NVARCHAR(30)    NOT NULL,
        entity_id           INT             NOT NULL,
        field_name          NVARCHAR(100)   NOT NULL,
        field_value         NVARCHAR(500)   NULL,
        data_source_id      INT             NULL,
        source_name         NVARCHAR(200)   NULL,
        source_url          NVARCHAR(500)   NULL,
        confidence          TINYINT         NULL,
        sync_run_id         INT             NULL,
        recorded_by_user_id INT             NULL,
        recorded_at         DATETIME2       NOT NULL CONSTRAINT DF_fp_recorded_at DEFAULT SYSUTCDATETIME(),
        CONSTRAINT FK_fp_data_source FOREIGN KEY (data_source_id) REFERENCES dbo.data_sources(id),
        CONSTRAINT FK_fp_sync_run FOREIGN KEY (sync_run_id) REFERENCES dbo.sync_runs(id),
        CONSTRAINT FK_fp_user FOREIGN KEY (recorded_by_user_id) REFERENCES dbo.users(id),
        CONSTRAINT CK_fp_confidence CHECK (confidence IS NULL OR confidence BETWEEN 1 AND 5),
        CONSTRAINT CK_fp_source CHECK (data_source_id IS NOT NULL OR source_name IS NOT NULL)
    );
    CREATE INDEX IX_fp_entity ON dbo.field_provenance(entity_type, entity_id, field_name, recorded_at DESC);
END
GO

IF OBJECT_ID('dbo.entity_external_ids', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.entity_external_ids (
        id              INT IDENTITY(1,1) PRIMARY KEY,
        entity_type     NVARCHAR(30)    NOT NULL,
        entity_id       INT             NOT NULL,
        data_source_id  INT             NOT NULL,
        external_id     NVARCHAR(200)   NOT NULL,
        external_url    NVARCHAR(500)   NULL,
        created_at      DATETIME2       NOT NULL CONSTRAINT DF_eei_created_at DEFAULT SYSUTCDATETIME(),
        CONSTRAINT FK_eei_data_source FOREIGN KEY (data_source_id) REFERENCES dbo.data_sources(id),
        CONSTRAINT UX_eei_entity_source UNIQUE (entity_type, entity_id, data_source_id)
    );
    CREATE INDEX IX_eei_entity ON dbo.entity_external_ids(entity_type, entity_id);
END
GO

-- Semilla: sólo fuentes con estado REAL ya verificado en esta sesión (nunca inventado). Las
-- bloqueadas quedan igual catalogadas -- el motor de investigación las consulta primero acá antes de
-- intentar nada, así "marcarla como no disponible y continuar" (pedido explícito) es una consulta a
-- esta tabla, no una decisión improvisada en cada corrida.
IF NOT EXISTS (SELECT 1 FROM dbo.data_sources WHERE code = 'wikipedia')
INSERT INTO dbo.data_sources (code, name, base_url, source_type, trust_level, priority, status, restrictions, last_checked_at) VALUES
('wikipedia', 'Wikipedia', 'https://wikipedia.org', 'encyclopedia', 3, 50, 'available', 'Verificado accesible (es/en) durante la investigación de jugadores paraguayos.', SYSUTCDATETIME()),
('wikidata', 'Wikidata', 'https://www.wikidata.org', 'encyclopedia', 4, 40, 'available', 'API/consulta estructurada verificada accesible; buena fuente para fecha de nacimiento/nacionalidad con identificador estable (Q-id).', SYSUTCDATETIME()),
('wikimedia_commons', 'Wikimedia Commons', 'https://commons.wikimedia.org', 'media', 4, 40, 'available', 'Verificado accesible -- única fuente de fotografías usada hasta ahora, siempre confirmando licencia (CC BY / CC BY-SA) por archivo antes de usar.', SYSUTCDATETIME()),
('rsssf', 'RSSSF - Paraguay', 'https://www.rsssf.org', 'stats_site', 4, 60, 'available', 'robots.txt sin restricciones, permiso explícito de copia citando la fuente. Cobertura real 1906-1959 en documento único (formato muy variable), desde 1960 una página por año.', SYSUTCDATETIME()),
('pesmaster', 'PESmaster.com', 'https://www.pesmaster.com', 'videogame_ratings', 3, 70, 'available', 'robots.txt permite todo (Allow: /). Fotos de jugador cargadas por JavaScript, no extraíbles vía WebFetch.', SYSUTCDATETIME()),
('sofascore', 'Sofascore.com', 'https://www.sofascore.com', 'stats_site', 3, 70, 'available', 'robots.txt sólo bloquea Bytespider + rutas de archivo. Planteles/páginas de equipo funcionan; pestañas de alineación/formación/árbitro son JS-driven (no accesibles). api.sofascore.com bloqueado (403), no intentado evadir.', SYSUTCDATETIME()),
('sofifa', 'SoFIFA.com', 'https://sofifa.com', 'videogame_ratings', 3, 90, 'blocked', 'Bloquea acceso automatizado (HTTP 403). No se intentó evadir.', SYSUTCDATETIME()),
('fifacm', 'FIFACM.com', 'https://www.fifacm.com', 'videogame_ratings', 3, 90, 'blocked', 'Bloquea acceso automatizado (HTTP 403). No se intentó evadir.', SYSUTCDATETIME()),
('futwiz', 'Futwiz.com', 'https://www.futwiz.com', 'videogame_ratings', 3, 90, 'blocked', 'Bloquea acceso automatizado (HTTP 403). No se intentó evadir.', SYSUTCDATETIME()),
('fifaindex', 'FIFAIndex.com', 'https://fifaindex.com', 'videogame_ratings', 3, 90, 'blocked', 'Bloqueo a nivel de dominio (incluso su propio robots.txt devuelve 403) -- no se intentó evadir.', SYSUTCDATETIME()),
('api_sofascore', 'api.sofascore.com', 'https://api.sofascore.com', 'stats_site', 3, 90, 'blocked', 'API interna que devuelve 403 a peticiones automatizadas. No se intentó evadir.', SYSUTCDATETIME());
GO
