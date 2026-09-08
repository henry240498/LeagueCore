-- LeagueCore - Valoraciones de videojuegos (FIFA/EA SPORTS FC/PES/eFootball) por jugador.
--
-- Modelo histórico normalizado (pedido explícito): cada edición es una FILA, nunca una columna
-- (nada de fifa20/fifa21/...). Las 6 categorías (PAC/SHO/PAS/DRI/DEF/PHY) son un catálogo chico y
-- fijo; los atributos detallados son libres por juego (EAV) para no depender de qué atributos use
-- cada edición. Provenance simplificada como columnas directas en player_videogame_ratings
-- (source_name/source_url/retrieved_at) en vez del "field_provenance" genérico propuesto en la
-- arquitectura -- una sola fuente por valoración es suficiente hoy; se revisita si hace falta más
-- adelante, mismo criterio que ya dejaron documentado las migraciones 011/012 para este tipo de
-- decisión.

SET QUOTED_IDENTIFIER ON;
GO
USE LeagueCore;
GO

IF OBJECT_ID('dbo.videogames', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.videogames (
        id          INT IDENTITY(1,1) PRIMARY KEY,
        name        NVARCHAR(80)    NOT NULL,
        publisher   NVARCHAR(80)    NULL,
        status      NVARCHAR(30)    NOT NULL CONSTRAINT DF_videogames_status DEFAULT N'active',
        created_at  DATETIME2       NOT NULL CONSTRAINT DF_videogames_created_at DEFAULT SYSUTCDATETIME(),
        CONSTRAINT UX_videogames_name UNIQUE (name)
    );
    INSERT INTO dbo.videogames (name, publisher) VALUES
        (N'EA SPORTS FIFA', N'EA Sports'),
        (N'EA SPORTS FC', N'EA Sports'),
        (N'Pro Evolution Soccer', N'Konami'),
        (N'eFootball', N'Konami');
END
GO

IF OBJECT_ID('dbo.videogame_editions', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.videogame_editions (
        id              INT IDENTITY(1,1) PRIMARY KEY,
        videogame_id    INT             NOT NULL,
        name            NVARCHAR(60)    NOT NULL,
        year            SMALLINT        NOT NULL,
        sort_order      INT             NOT NULL CONSTRAINT DF_vge_sort DEFAULT 0,
        created_at      DATETIME2       NOT NULL CONSTRAINT DF_vge_created_at DEFAULT SYSUTCDATETIME(),
        CONSTRAINT FK_vge_videogame FOREIGN KEY (videogame_id) REFERENCES dbo.videogames(id),
        CONSTRAINT UX_vge_videogame_name UNIQUE (videogame_id, name)
    );
    CREATE INDEX IX_vge_videogame ON dbo.videogame_editions(videogame_id, sort_order);
END
GO

-- Catálogo fijo y chico -- las 6 categorías de campo + las 6 equivalentes de arquero. Un jugador de
-- campo nunca ve categorías de arquero y viceversa (player_type las separa).
IF OBJECT_ID('dbo.player_videogame_attribute_categories', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.player_videogame_attribute_categories (
        id          INT IDENTITY(1,1) PRIMARY KEY,
        code        NVARCHAR(10)    NOT NULL,
        name_es     NVARCHAR(40)    NOT NULL,
        player_type NVARCHAR(20)    NOT NULL CONSTRAINT DF_pvac_player_type DEFAULT N'field',
        sort_order  INT             NOT NULL CONSTRAINT DF_pvac_sort DEFAULT 0,
        CONSTRAINT CK_pvac_player_type CHECK (player_type IN ('field', 'goalkeeper')),
        CONSTRAINT UX_pvac_code UNIQUE (code)
    );
    INSERT INTO dbo.player_videogame_attribute_categories (code, name_es, player_type, sort_order) VALUES
        (N'PAC', N'Velocidad', N'field', 1),
        (N'SHO', N'Tiro',      N'field', 2),
        (N'PAS', N'Pase',      N'field', 3),
        (N'DRI', N'Regate',    N'field', 4),
        (N'DEF', N'Defensa',   N'field', 5),
        (N'PHY', N'Físico',    N'field', 6),
        (N'DIV', N'Estirada',        N'goalkeeper', 1),
        (N'HAN', N'Manejo',          N'goalkeeper', 2),
        (N'KIC', N'Saque',           N'goalkeeper', 3),
        (N'REF', N'Reflejos',        N'goalkeeper', 4),
        (N'SPD', N'Velocidad',       N'goalkeeper', 5),
        (N'POS', N'Posicionamiento', N'goalkeeper', 6);
END
GO

-- Una fila por (jugador, edición, variante de carta) -- nunca se pisa entre ediciones. card_variant
-- default 'base' deja lugar para cartas especiales (TOTW, etc.) sin romper la clave el día que se
-- necesiten, sin obligar a llenarla hoy.
IF OBJECT_ID('dbo.player_videogame_ratings', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.player_videogame_ratings (
        id                      INT IDENTITY(1,1) PRIMARY KEY,
        player_id               INT             NOT NULL,
        videogame_edition_id    INT             NOT NULL,
        overall_rating          SMALLINT        NULL,
        card_variant            NVARCHAR(30)    NOT NULL CONSTRAINT DF_pvr_variant DEFAULT N'base',
        position_ingame         NVARCHAR(10)    NULL,
        source_name             NVARCHAR(150)   NULL,
        source_url              NVARCHAR(500)   NULL,
        retrieved_at            DATETIME2       NULL,
        created_at              DATETIME2       NOT NULL CONSTRAINT DF_pvr_created_at DEFAULT SYSUTCDATETIME(),
        updated_at              DATETIME2       NOT NULL CONSTRAINT DF_pvr_updated_at DEFAULT SYSUTCDATETIME(),
        CONSTRAINT FK_pvr_player FOREIGN KEY (player_id) REFERENCES dbo.players(id),
        CONSTRAINT FK_pvr_edition FOREIGN KEY (videogame_edition_id) REFERENCES dbo.videogame_editions(id),
        CONSTRAINT UX_pvr UNIQUE (player_id, videogame_edition_id, card_variant),
        CONSTRAINT CK_pvr_overall CHECK (overall_rating IS NULL OR (overall_rating BETWEEN 1 AND 99))
    );
    CREATE INDEX IX_pvr_player ON dbo.player_videogame_ratings(player_id);
END
GO

IF OBJECT_ID('dbo.player_videogame_category_scores', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.player_videogame_category_scores (
        id          INT IDENTITY(1,1) PRIMARY KEY,
        rating_id   INT             NOT NULL,
        category_id INT             NOT NULL,
        score       SMALLINT        NOT NULL,
        CONSTRAINT FK_pvcs_rating FOREIGN KEY (rating_id) REFERENCES dbo.player_videogame_ratings(id) ON DELETE CASCADE,
        CONSTRAINT FK_pvcs_category FOREIGN KEY (category_id) REFERENCES dbo.player_videogame_attribute_categories(id),
        CONSTRAINT UX_pvcs UNIQUE (rating_id, category_id),
        CONSTRAINT CK_pvcs_score CHECK (score BETWEEN 1 AND 99)
    );
END
GO

-- EAV a propósito -- un juego nuevo con atributos distintos es filas nuevas, cero cambios de
-- esquema (pedido explícito, §12/§18 del pedido de valoraciones).
IF OBJECT_ID('dbo.player_videogame_detailed_attributes', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.player_videogame_detailed_attributes (
        id                      INT IDENTITY(1,1) PRIMARY KEY,
        rating_id               INT             NOT NULL,
        category_id             INT             NULL,
        attribute_code          NVARCHAR(60)    NOT NULL,
        attribute_name_source   NVARCHAR(120)   NULL,
        value                   SMALLINT        NULL,
        CONSTRAINT FK_pvda_rating FOREIGN KEY (rating_id) REFERENCES dbo.player_videogame_ratings(id) ON DELETE CASCADE,
        CONSTRAINT FK_pvda_category FOREIGN KEY (category_id) REFERENCES dbo.player_videogame_attribute_categories(id),
        CONSTRAINT UX_pvda UNIQUE (rating_id, attribute_code)
    );
END
GO
