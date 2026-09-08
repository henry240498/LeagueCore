-- LeagueCore - Limpieza: eliminar la vista dbo.standings (creada en 002_create_standings_view.sql)
-- Quedó obsoleta desde 014_create_matches_core.sql: referencia matches.home_goals/away_goals/
-- abandoned/void, columnas eliminadas cuando Partidos se rediseñó (goles ahora viven por período
-- en dbo.match_period_scores, y "abandoned/void" se reemplazó por dbo.matches.status).
-- SQL Server no valida los nombres de columna de una vista sin SCHEMABINDING al crearla (resolución
-- diferida), así que esta vista quedó "viva" pero rota en silencio -- cualquier SELECT contra ella
-- falla con "Invalid column name". Detectado en auditoría 2026-08 antes de construir Clasificaciones.
--
-- El reemplazo NO es otra vista: el cálculo de clasificación pasa a ser una consulta parametrizada
-- por temporada en SeasonsService.getStandings() (src/backend/src/seasons/seasons.service.ts),
-- igual que el resto de la lógica de negocio del proyecto (sin ORM, sin vistas de negocio en la
-- base). Motivo: Temporadas no existía cuando se creó la vista original, así que la vista agrupaba
-- por competición completa (todas las temporadas mezcladas) en vez de por temporada -- ya no es lo
-- que se necesita ahora que existe dbo.seasons/dbo.season_teams.

USE LeagueCore;
GO

IF OBJECT_ID('dbo.standings', 'V') IS NOT NULL
    DROP VIEW dbo.standings;
GO
