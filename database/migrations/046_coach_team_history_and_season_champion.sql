-- Dos gaps reales confirmados durante el diseño de la migración histórica de Registro Fútbol
-- (ver docs/ANALISIS_REGISTRO_FUTBOL_VS_LEAGUECORE.md y el plan técnico aprobado):
--
-- 1) Técnicos no tienen historial por período/temporada -- sólo dbo.match_coaches (relación por
--    partido puntual). El cliente pide explícitamente "Técnico → Equipo → período → temporada →
--    partidos", y Registro Fútbol sí modela esto (Técnicos → Con Equipo). Se agrega
--    dbo.coach_team_history con el mismo patrón que dbo.player_team_history (migración 011),
--    incluyendo el índice único filtrado de "un solo período abierto por técnico".
--
-- 2) No existe un registro explícito de campeón de temporada -- bloquea poblar el ranking "Más
--    Campeones" de Registro Fútbol (jugadores por títulos ganados) y la pregunta de ejemplo del
--    cliente sobre campeones. Se agrega dbo.seasons.champion_team_id, NULL por defecto (no se
--    infiere de la tabla de posiciones -- sólo se completa cuando la fuente lo confirma
--    explícitamente).

SET QUOTED_IDENTIFIER ON;
GO
USE LeagueCore;
GO

IF OBJECT_ID('dbo.coach_team_history', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.coach_team_history (
        id          INT IDENTITY(1,1) PRIMARY KEY,
        coach_id    INT             NOT NULL,
        team_id     INT             NOT NULL,
        season_id   INT             NULL,
        start_date  DATE            NOT NULL CONSTRAINT DF_cth_start_date DEFAULT CAST(SYSUTCDATETIME() AS DATE),
        end_date    DATE            NULL,
        note        NVARCHAR(300)   NULL,
        created_at  DATETIME2       NOT NULL CONSTRAINT DF_cth_created_at DEFAULT SYSUTCDATETIME(),
        updated_at  DATETIME2       NOT NULL CONSTRAINT DF_cth_updated_at DEFAULT SYSUTCDATETIME(),
        CONSTRAINT FK_cth_coach FOREIGN KEY (coach_id) REFERENCES dbo.coaches(id),
        CONSTRAINT FK_cth_team FOREIGN KEY (team_id) REFERENCES dbo.teams(id),
        CONSTRAINT FK_cth_season FOREIGN KEY (season_id) REFERENCES dbo.seasons(id),
        CONSTRAINT CK_cth_dates CHECK (end_date IS NULL OR end_date >= start_date)
    );
    CREATE INDEX IX_cth_coach_id ON dbo.coach_team_history(coach_id);
    CREATE INDEX IX_cth_team_id ON dbo.coach_team_history(team_id);
    CREATE UNIQUE INDEX UX_cth_coach_open_stint ON dbo.coach_team_history(coach_id) WHERE end_date IS NULL;
END
GO

IF COL_LENGTH('dbo.seasons', 'champion_team_id') IS NULL
    ALTER TABLE dbo.seasons ADD champion_team_id INT NULL;
GO
IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_seasons_champion_team')
    ALTER TABLE dbo.seasons ADD CONSTRAINT FK_seasons_champion_team FOREIGN KEY (champion_team_id) REFERENCES dbo.teams(id);
GO
