-- LeagueCore - Fase 1: vista de tabla de posiciones
-- Calcula PJ/PG/PE/PP/goles/diferencia/puntos por equipo a partir de matches.
-- No incluye desempate por head-to-head (ver docs §10, limitación heredada del análisis
-- original: tampoco lo resolvía la vista SQLite de referencia). Ordenar al consultar:
--   SELECT * FROM dbo.standings WHERE competition_id = @id
--   ORDER BY points DESC, goal_difference DESC, goals_for DESC;

USE LeagueCore;
GO

IF OBJECT_ID('dbo.standings', 'V') IS NOT NULL
    DROP VIEW dbo.standings;
GO

CREATE VIEW dbo.standings AS
WITH team_matches AS (
    SELECT
        m.competition_id,
        m.home_team_id  AS team_id,
        m.home_goals    AS goals_for,
        m.away_goals    AS goals_against
    FROM dbo.matches m
    WHERE m.abandoned = 0 AND m.void = 0

    UNION ALL

    SELECT
        m.competition_id,
        m.away_team_id  AS team_id,
        m.away_goals    AS goals_for,
        m.home_goals    AS goals_against
    FROM dbo.matches m
    WHERE m.abandoned = 0 AND m.void = 0
)
SELECT
    t.id                                    AS team_id,
    t.competition_id,
    t.name                                  AS team_name,
    COUNT(tm.team_id)                       AS played,
    SUM(CASE WHEN tm.team_id IS NOT NULL AND tm.goals_for > tm.goals_against THEN 1 ELSE 0 END) AS won,
    SUM(CASE WHEN tm.team_id IS NOT NULL AND tm.goals_for = tm.goals_against THEN 1 ELSE 0 END) AS drawn,
    SUM(CASE WHEN tm.team_id IS NOT NULL AND tm.goals_for < tm.goals_against THEN 1 ELSE 0 END) AS lost,
    SUM(ISNULL(tm.goals_for, 0))            AS goals_for,
    SUM(ISNULL(tm.goals_against, 0))        AS goals_against,
    SUM(ISNULL(tm.goals_for, 0)) - SUM(ISNULL(tm.goals_against, 0)) AS goal_difference,
    SUM(CASE
            WHEN tm.team_id IS NULL THEN 0
            WHEN tm.goals_for > tm.goals_against THEN c.points_win
            WHEN tm.goals_for = tm.goals_against THEN c.points_draw
            ELSE c.points_loss
        END) + t.added_points               AS points
FROM dbo.teams t
JOIN dbo.competitions c ON c.id = t.competition_id
LEFT JOIN team_matches tm ON tm.team_id = t.id AND tm.competition_id = t.competition_id
GROUP BY t.id, t.competition_id, t.name, t.added_points;
GO
