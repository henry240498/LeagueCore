-- LeagueCore - Formación táctica por equipo y partido. Gap real identificado analizando el formato
-- de datos abiertos de StatsBomb (estructura únicamente -- nunca sus datos reales, ver
-- docs/ANALISIS_INICIAL_LEAGUECORE.md changelog v52): su evento "Starting XI" guarda
-- tactics.formation (ej. 433) por equipo, y "Tactical Shift" permite que cambie a mitad de partido.
-- LeagueCore ya tenía match_lineups.pos_x/pos_y (posición real de CADA jugador, migración 019) pero
-- nunca la forma táctica del EQUIPO como tal (ej. "Olimpia — 4-3-3") -- hoy la vista táctica sólo
-- agrupa jugadores por posición y los reparte de forma pareja, sin ninguna forma real detrás.
--
-- `period` NULL = formación de todo el partido; 'first_half'/'second_half'/etc. permite registrar un
-- cambio táctico real sin perder la formación anterior (mismo concepto que el evento "Tactical
-- Shift" de StatsBomb) -- nunca se sobrescribe, cada período es una fila propia.

SET QUOTED_IDENTIFIER ON;
GO
USE LeagueCore;
GO

IF OBJECT_ID('dbo.match_formations', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.match_formations (
        id              INT IDENTITY(1,1) PRIMARY KEY,
        match_id        INT             NOT NULL,
        team_id         INT             NOT NULL,
        formation_shape NVARCHAR(10)    NOT NULL,
        period          NVARCHAR(20)    NULL,
        source          NVARCHAR(100)   NULL,
        created_at      DATETIME2       NOT NULL CONSTRAINT DF_mf_created_at DEFAULT SYSUTCDATETIME(),
        updated_at      DATETIME2       NOT NULL CONSTRAINT DF_mf_updated_at DEFAULT SYSUTCDATETIME(),
        CONSTRAINT FK_mf_match FOREIGN KEY (match_id) REFERENCES dbo.matches(id),
        CONSTRAINT FK_mf_team FOREIGN KEY (team_id) REFERENCES dbo.teams(id),
        CONSTRAINT UX_mf_match_team_period UNIQUE (match_id, team_id, period)
    );
    CREATE INDEX IX_mf_match ON dbo.match_formations(match_id);
END
GO
