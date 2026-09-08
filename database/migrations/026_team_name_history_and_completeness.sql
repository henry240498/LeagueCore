-- LeagueCore - Dos cambios mínimos de modelo, ambos identificados como necesarios reales (no
-- especulativos) al analizar RSSSF como fuente histórica antes de programar el conector:
--
-- 1) dbo.team_name_history: RSSSF documenta en prosa renombres reales de clubes paraguayos
--    ("Deportivo Meilicke" -> "General Caballero", "C.A.L.T." -> "Atlético Corrales") -- hoy
--    dbo.teams sólo tiene un `name`, sin forma de expresar que dos nombres son la MISMA entidad en
--    distintas épocas. Mismo patrón ya usado para dbo.player_team_history (migración 011): tabla de
--    historial simple, sin tocar la tabla principal. NUNCA se llena automáticamente por
--    coincidencia de texto (un renombre real tiene similitud ~0%) -- sólo se crea cuando un
--    administrador confirma manualmente el vínculo entre dos equipos que el importador dejó como
--    revisión pendiente.
--
-- 2) seasons.data_completeness: para poder registrar honestamente que la información de una
--    temporada histórica es parcial/fragmentaria (ej. "sólo se conoce el campeón, no la tabla
--    completa") en vez de dejarlo implícito en texto libre dentro de `observations`.

USE LeagueCore;
GO

IF OBJECT_ID('dbo.team_name_history', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.team_name_history (
        id          INT IDENTITY(1,1) PRIMARY KEY,
        team_id     INT             NOT NULL REFERENCES dbo.teams(id),
        name        NVARCHAR(200)   NOT NULL,
        valid_from  DATE            NULL,
        valid_to    DATE            NULL,
        source      NVARCHAR(100)   NULL,
        notes       NVARCHAR(500)   NULL,
        created_at  DATETIME2       NOT NULL CONSTRAINT DF_team_name_history_created DEFAULT SYSUTCDATETIME()
    );
    CREATE INDEX IX_team_name_history_team ON dbo.team_name_history(team_id);
END
GO

IF COL_LENGTH('dbo.seasons', 'data_completeness') IS NULL
BEGIN
    ALTER TABLE dbo.seasons ADD data_completeness NVARCHAR(20) NULL
        CONSTRAINT CK_seasons_data_completeness CHECK (data_completeness IN ('completo','parcial','fragmentario','desconocido','no_disponible','no_aplica'));
END
GO
