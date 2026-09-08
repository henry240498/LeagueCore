-- LeagueCore - Vista táctica interactiva del Partido
-- Dos cambios mínimos, reutilizando todo lo que ya existía (Partidos/Eventos del módulo 8):
--
-- 1) dbo.match_lineups gana pos_x/pos_y (0-100 normalizado, igual que dbo.goals.pos_x/pos_y desde
--    la migración 015) -- la posición táctica real de un jugador en la cancha para ese partido.
--    NULL = "todavía no se posicionó", nunca se asume un valor por defecto guardado en base (el
--    layout inicial al editar se arma en el frontend, sin persistir, hasta que el admin guarda).
--
-- 2) dbo.shots: tiros que NO terminaron en gol (saved/blocked/off_target/post). Mismo criterio
--    exacto que ya se usó para separar dbo.penalty_kicks de dbo.goals en la migración 015: un tiro
--    que sí fue gol ya se representa en dbo.goals (con su pos_x/pos_y); acá sólo van los que no.
--    Así "mapa de tiros" se arma combinando goals (outcome='goal') + shots (outcome=otro) sin
--    duplicar ningún dato.

USE LeagueCore;
GO

IF COL_LENGTH('dbo.match_lineups', 'pos_x') IS NULL
    ALTER TABLE dbo.match_lineups ADD pos_x DECIMAL(5,2) NULL;
GO
IF COL_LENGTH('dbo.match_lineups', 'pos_y') IS NULL
    ALTER TABLE dbo.match_lineups ADD pos_y DECIMAL(5,2) NULL;
GO
IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_match_lineups_pos_x')
    ALTER TABLE dbo.match_lineups ADD CONSTRAINT CK_match_lineups_pos_x CHECK (pos_x IS NULL OR (pos_x >= 0 AND pos_x <= 100));
GO
IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_match_lineups_pos_y')
    ALTER TABLE dbo.match_lineups ADD CONSTRAINT CK_match_lineups_pos_y CHECK (pos_y IS NULL OR (pos_y >= 0 AND pos_y <= 100));
GO

IF OBJECT_ID('dbo.shots', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.shots (
        id           INT IDENTITY(1,1) PRIMARY KEY,
        match_id     INT NOT NULL REFERENCES dbo.matches(id),
        player_id    INT NOT NULL REFERENCES dbo.players(id),
        team_id      INT NOT NULL REFERENCES dbo.teams(id),
        minute       SMALLINT NULL,
        minute_extra SMALLINT NULL,
        period       NVARCHAR(20) NULL CHECK (period IS NULL OR period IN ('first_half','second_half','extra_time_first','extra_time_second')),
        pos_x        DECIMAL(5,2) NOT NULL CHECK (pos_x >= 0 AND pos_x <= 100),
        pos_y        DECIMAL(5,2) NOT NULL CHECK (pos_y >= 0 AND pos_y <= 100),
        outcome      NVARCHAR(20) NOT NULL CHECK (outcome IN ('saved','blocked','off_target','post')),
        body_part    NVARCHAR(20) NULL,
        xg           DECIMAL(4,3) NULL CHECK (xg IS NULL OR (xg >= 0 AND xg <= 1)),
        created_at   DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
    );
    CREATE INDEX IX_shots_match ON dbo.shots(match_id);
END
GO
