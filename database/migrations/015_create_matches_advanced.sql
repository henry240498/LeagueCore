-- LeagueCore - Módulo 8 (Partidos), parte 2/2: estructura avanzada preparada pero SIN
-- interfaz de carga todavía (pedido explícito del usuario: no desarrollar el motor de GPS,
-- xG/xA/PPDA ni el visualizador de heatmaps ahora, pero no bloquear la arquitectura).
--
-- Estas 4 tablas quedan vacías después de esta migración y no tienen endpoints ni pantallas
-- en esta entrega — se documentan acá y en docs/ANALISIS_INICIAL_LEAGUECORE.md como
-- "preparado, no implementado". El detalle del partido las muestra como "Sin datos
-- disponibles" (mismo patrón que Jugadores/Oficiales con sus secciones de estadísticas
-- futuras), nunca inventando valores.

SET QUOTED_IDENTIFIER ON;
GO

USE LeagueCore;
GO

-- =====================================================================================
-- 1) dbo.match_player_stats — estadísticas de CAJA individuales que NO se derivan de los
--    eventos ya modelados (goles/asistencias/tarjetas SÍ se derivan de goals/cards en
--    tiempo de consulta, no se duplican acá). Todo NULL-able, sin DEFAULT numérico.
-- =====================================================================================
IF OBJECT_ID('dbo.match_player_stats', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.match_player_stats (
        match_id            INT             NOT NULL,
        player_id           INT             NOT NULL,
        team_id             INT             NOT NULL,
        shots               SMALLINT        NULL,
        shots_on_target     SMALLINT        NULL,
        passes              SMALLINT        NULL,
        passes_completed    SMALLINT        NULL,
        touches             SMALLINT        NULL,
        tackles             SMALLINT        NULL,
        tackles_won         SMALLINT        NULL,
        interceptions       SMALLINT        NULL,
        clearances          SMALLINT        NULL,
        recoveries          SMALLINT        NULL,
        duels_ground_won    SMALLINT        NULL,
        duels_ground_lost   SMALLINT        NULL,
        duels_aerial_won    SMALLINT        NULL,
        duels_aerial_lost   SMALLINT        NULL,
        blocks_shots        SMALLINT        NULL,
        blocks_passes       SMALLINT        NULL,
        data_source         NVARCHAR(20)    NOT NULL CONSTRAINT DF_mps2_data_source DEFAULT N'manual',
        updated_at          DATETIME2       NOT NULL CONSTRAINT DF_mps2_updated_at DEFAULT SYSUTCDATETIME(),
        CONSTRAINT PK_match_player_stats PRIMARY KEY (match_id, player_id),
        CONSTRAINT FK_mps2_match FOREIGN KEY (match_id) REFERENCES dbo.matches(id),
        CONSTRAINT FK_mps2_player FOREIGN KEY (player_id) REFERENCES dbo.players(id),
        CONSTRAINT FK_mps2_team FOREIGN KEY (team_id) REFERENCES dbo.teams(id)
    );
END
GO

-- =====================================================================================
-- 2) dbo.match_player_physical_stats — GPS. Puede no existir para ningún jugador de un
--    partido dado (la mayoría de los partidos, hoy) — ausencia de fila = "sin datos GPS",
--    nunca ceros.
-- =====================================================================================
IF OBJECT_ID('dbo.match_player_physical_stats', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.match_player_physical_stats (
        match_id            INT             NOT NULL,
        player_id           INT             NOT NULL,
        distance_km         DECIMAL(5,2)    NULL,
        top_speed_kmh       DECIMAL(4,1)    NULL,
        steps_count         INT             NULL,
        sprints_count       SMALLINT        NULL,
        accelerations       SMALLINT        NULL,
        decelerations       SMALLINT        NULL,
        walk_distance_km    DECIMAL(5,2)    NULL,
        jog_distance_km     DECIMAL(5,2)    NULL,
        run_distance_km     DECIMAL(5,2)    NULL,
        sprint_distance_km  DECIMAL(5,2)    NULL,
        data_source         NVARCHAR(50)    NULL,
        updated_at          DATETIME2       NOT NULL CONSTRAINT DF_mpps_updated_at DEFAULT SYSUTCDATETIME(),
        CONSTRAINT PK_match_player_physical_stats PRIMARY KEY (match_id, player_id),
        CONSTRAINT FK_mpps_match FOREIGN KEY (match_id) REFERENCES dbo.matches(id),
        CONSTRAINT FK_mpps_player FOREIGN KEY (player_id) REFERENCES dbo.players(id)
    );
END
GO

-- =====================================================================================
-- 3) dbo.match_advanced_metrics — xG/xA/PPDA y cualquier métrica futura, en formato
--    "atributo-valor" A PROPÓSITO: agregar una métrica nueva (o una nueva versión de
--    modelo de un proveedor) es una fila nueva, cero cambios de esquema. Resuelve
--    directamente el requisito de que xG "no sea un número arbitrario" — el proveedor y
--    la versión del modelo viajan siempre junto con el valor, nunca sueltos.
-- =====================================================================================
IF OBJECT_ID('dbo.match_advanced_metrics', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.match_advanced_metrics (
        id              INT IDENTITY(1,1) PRIMARY KEY,
        match_id        INT             NOT NULL,
        team_id         INT             NULL,
        player_id       INT             NULL,
        metric_name     NVARCHAR(50)    NOT NULL,
        metric_value    DECIMAL(10,4)   NOT NULL,
        provider        NVARCHAR(50)    NULL,
        model_version   NVARCHAR(50)    NULL,
        recorded_at     DATETIME2       NOT NULL CONSTRAINT DF_mam_recorded_at DEFAULT SYSUTCDATETIME(),
        CONSTRAINT FK_mam_match FOREIGN KEY (match_id) REFERENCES dbo.matches(id),
        CONSTRAINT FK_mam_team FOREIGN KEY (team_id) REFERENCES dbo.teams(id),
        CONSTRAINT FK_mam_player FOREIGN KEY (player_id) REFERENCES dbo.players(id),
        CONSTRAINT CK_mam_target CHECK (team_id IS NOT NULL OR player_id IS NOT NULL)
    );
    CREATE INDEX IX_mam_match_metric ON dbo.match_advanced_metrics(match_id, metric_name);
END
GO

-- =====================================================================================
-- 4) dbo.match_player_positions — datos espaciales estructurados (posición media,
--    heatmap como nube de puntos). x/y normalizados 0-100 (% de largo/ancho de cancha) —
--    no depende de conocer las medidas reales de cada estadio. Varias filas por jugador
--    = nube de puntos (heatmap); una sola fila = posición media. NO se guarda como imagen.
-- =====================================================================================
IF OBJECT_ID('dbo.match_player_positions', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.match_player_positions (
        id          INT IDENTITY(1,1) PRIMARY KEY,
        match_id    INT             NOT NULL,
        player_id   INT             NOT NULL,
        team_id     INT             NOT NULL,
        period      NVARCHAR(20)    NULL,
        minute      SMALLINT        NULL,
        pos_x       DECIMAL(5,2)    NOT NULL,
        pos_y       DECIMAL(5,2)    NOT NULL,
        weight      DECIMAL(6,2)    NULL,
        source      NVARCHAR(50)    NULL,
        recorded_at DATETIME2       NOT NULL CONSTRAINT DF_mpp_recorded_at DEFAULT SYSUTCDATETIME(),
        CONSTRAINT FK_mpp_match FOREIGN KEY (match_id) REFERENCES dbo.matches(id),
        CONSTRAINT FK_mpp_player FOREIGN KEY (player_id) REFERENCES dbo.players(id),
        CONSTRAINT FK_mpp_team FOREIGN KEY (team_id) REFERENCES dbo.teams(id)
    );
    CREATE INDEX IX_mpp_match_player ON dbo.match_player_positions(match_id, player_id);
END
GO
