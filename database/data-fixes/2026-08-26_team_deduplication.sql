-- YA EJECUTADO (2026-08-26). No es una migración de esquema (no crea/altera tablas), es un fix de
-- datos puntual sobre el estado sucio encontrado ese día -- se documenta acá para el historial, no
-- para volver a correrlo (los ids duplicados que borra ya no existen). No re-ejecutar sin adaptar
-- los ids al estado real de la base en ese momento.
--
-- Consolida 15 clubes paraguayos que existían duplicados (58 filas -> 15 maestros, -43 filas) --
-- migra TODAS las relaciones reales antes de borrar cualquier duplicado (season_teams,
-- player_team_history, players.team_id, matches home/away, goals, match_lineups y el resto de
-- tablas de eventos de partido). Verificado antes de ejecutar: cero conflictos de clave compuesta,
-- cero partidos que quedarían con local=visitante, cero filas de player_team_history que quedarían
-- exactamente duplicadas. Ver docs/ANALISIS_INICIAL_LEAGUECORE.md v55 para el informe de auditoría
-- completo (maestro elegido por grupo, conteos reales antes/después, qué NO se fusionó y por qué).

SET QUOTED_IDENTIFIER ON;
GO
USE LeagueCore;
GO
IF OBJECT_ID('tempdb..#merge_map') IS NOT NULL DROP TABLE #merge_map;
CREATE TABLE #merge_map (old_id INT PRIMARY KEY, master_id INT NOT NULL, group_name NVARCHAR(100));
INSERT INTO #merge_map (old_id, master_id, group_name) VALUES
(130,75,'Olimpia'),(135,75,'Olimpia'),(138,75,'Olimpia'),(60,75,'Olimpia'),(66,75,'Olimpia'),(25,75,'Olimpia'),
(141,78,'Libertad'),(133,78,'Libertad'),(26,78,'Libertad'),(48,78,'Libertad'),(56,78,'Libertad'),
(129,77,'Nacional'),(28,77,'Nacional'),(65,77,'Nacional'),(58,77,'Nacional'),
(131,80,'Sol de America'),(32,80,'Sol de America'),(51,80,'Sol de America'),(57,80,'Sol de America'),
(139,79,'Cerro Porteno'),(132,79,'Cerro Porteno'),(34,79,'Cerro Porteno'),(47,79,'Cerro Porteno'),
(33,89,'Presidente Hayes'),(55,89,'Presidente Hayes'),(49,89,'Presidente Hayes'),
(61,87,'River Plate'),(46,87,'River Plate'),(35,87,'River Plate'),
(41,85,'Rubio Nu'),(59,85,'Rubio Nu'),(64,85,'Rubio Nu'),
(63,100,'San Lorenzo'),(52,100,'San Lorenzo'),
(50,81,'Sportivo Luqueno'),(54,81,'Sportivo Luqueno'),(40,81,'Sportivo Luqueno'),
(62,76,'Guarani'),(24,76,'Guarani'),
(30,88,'Atlantida'),
(142,82,'General Caballero JLM'),
(45,98,'Sport Colombia'),
(140,83,'Sportivo Ameliano');
GO

BEGIN TRANSACTION;

BEGIN TRY
  -- 0) Completar geografía del maestro: los 15 maestros ya tenían ciudad pero no país -- todos son
  --    clubes paraguayos reales (lista explícita del pedido), y varios duplicados del MISMO grupo ya
  --    tenían country='Paraguay' cargado -- se propaga ese dato real, no se inventa nada nuevo.
  UPDATE t SET country = 'Paraguay'
  FROM dbo.teams t
  WHERE t.id IN (SELECT DISTINCT master_id FROM #merge_map) AND t.country IS NULL;

  -- 1) season_teams (participación real por temporada -- verificado sin colisiones antes de correr)
  UPDATE st SET team_id = mm.master_id
  FROM dbo.season_teams st JOIN #merge_map mm ON mm.old_id = st.team_id;

  -- 2) player_team_history (historial real de clubes -- nunca se toca start_date/end_date, sólo el FK)
  UPDATE pth SET team_id = mm.master_id
  FROM dbo.player_team_history pth JOIN #merge_map mm ON mm.old_id = pth.team_id;

  -- 3) players.team_id (columna de conveniencia "equipo actual")
  UPDATE p SET team_id = mm.master_id
  FROM dbo.players p JOIN #merge_map mm ON mm.old_id = p.team_id;

  -- 4) matches (local/visitante) -- verificado: ningún partido queda con local=visitante
  UPDATE m SET home_team_id = mm.master_id
  FROM dbo.matches m JOIN #merge_map mm ON mm.old_id = m.home_team_id;

  UPDATE m SET away_team_id = mm.master_id
  FROM dbo.matches m JOIN #merge_map mm ON mm.old_id = m.away_team_id;

  -- 5) Eventos de partido y relaciones restantes (todas con team_id como columna simple, sin
  --    conflicto de clave posible -- verificado antes de ejecutar)
  UPDATE x SET team_id = mm.master_id FROM dbo.match_lineups x JOIN #merge_map mm ON mm.old_id = x.team_id;
  UPDATE x SET team_id = mm.master_id FROM dbo.goals x JOIN #merge_map mm ON mm.old_id = x.team_id;
  UPDATE x SET team_id = mm.master_id FROM dbo.cards x JOIN #merge_map mm ON mm.old_id = x.team_id;
  UPDATE x SET team_id = mm.master_id FROM dbo.fouls x JOIN #merge_map mm ON mm.old_id = x.team_id;
  UPDATE x SET team_id = mm.master_id FROM dbo.offsides x JOIN #merge_map mm ON mm.old_id = x.team_id;
  UPDATE x SET team_id = mm.master_id FROM dbo.substitutions x JOIN #merge_map mm ON mm.old_id = x.team_id;
  UPDATE x SET team_id = mm.master_id FROM dbo.penalty_kicks x JOIN #merge_map mm ON mm.old_id = x.team_id;
  UPDATE x SET team_id = mm.master_id FROM dbo.shots x JOIN #merge_map mm ON mm.old_id = x.team_id;
  UPDATE x SET team_id = mm.master_id FROM dbo.match_coaches x JOIN #merge_map mm ON mm.old_id = x.team_id;
  UPDATE x SET team_id = mm.master_id FROM dbo.match_formations x JOIN #merge_map mm ON mm.old_id = x.team_id;
  UPDATE x SET team_id = mm.master_id FROM dbo.match_shootout_kicks x JOIN #merge_map mm ON mm.old_id = x.team_id;
  UPDATE x SET team_id = mm.master_id FROM dbo.match_team_stats x JOIN #merge_map mm ON mm.old_id = x.team_id;
  UPDATE x SET team_id = mm.master_id FROM dbo.match_player_stats x JOIN #merge_map mm ON mm.old_id = x.team_id;
  UPDATE x SET team_id = mm.master_id FROM dbo.match_player_positions x JOIN #merge_map mm ON mm.old_id = x.team_id;
  UPDATE x SET team_id = mm.master_id FROM dbo.match_advanced_metrics x JOIN #merge_map mm ON mm.old_id = x.team_id;
  UPDATE x SET team_id = mm.master_id FROM dbo.team_name_history x JOIN #merge_map mm ON mm.old_id = x.team_id;

  -- 6) Verificación de integridad DENTRO de la transacción: cero filas en cualquier tabla deberían
  --    seguir apuntando a un id duplicado a esta altura.
  IF EXISTS (SELECT 1 FROM dbo.season_teams st JOIN #merge_map mm ON mm.old_id = st.team_id)
     OR EXISTS (SELECT 1 FROM dbo.player_team_history x JOIN #merge_map mm ON mm.old_id = x.team_id)
     OR EXISTS (SELECT 1 FROM dbo.players x JOIN #merge_map mm ON mm.old_id = x.team_id)
     OR EXISTS (SELECT 1 FROM dbo.matches x JOIN #merge_map mm ON mm.old_id = x.home_team_id OR mm.old_id = x.away_team_id)
  BEGIN
    RAISERROR('Quedaron referencias sin migrar -- abortando.', 16, 1);
  END

  -- 7) Recién ahora, con TODAS las relaciones migradas y verificadas, eliminar los duplicados.
  DELETE t FROM dbo.teams t JOIN #merge_map mm ON mm.old_id = t.id;

  COMMIT TRANSACTION;
  SELECT 'OK - transacción confirmada' AS resultado;
END TRY
BEGIN CATCH
  ROLLBACK TRANSACTION;
  SELECT 'ERROR - se revirtió todo' AS resultado, ERROR_MESSAGE() AS mensaje;
END CATCH
GO
