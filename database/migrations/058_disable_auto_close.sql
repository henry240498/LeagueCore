-- 058_disable_auto_close.sql
-- Desactiva AUTO_CLOSE en la base actual.
--
-- Con AUTO_CLOSE ON, SQL Server apaga la base cuando se cierra su última conexión y la vuelve a
-- abrir en la siguiente. El pool de Node (mssql/tarn) cierra las conexiones ociosas a los 30 s, así
-- que tras un rato sin uso la primera petición tenía que reabrir la base (recovery + redo) y
-- superaba el requestTimeout de 15 s: el usuario veía un 500 intermitente en cualquier pantalla,
-- típicamente la primera que abría después de un descanso. Aparecía en el log de SQL Server como
-- "Starting up database 'LeagueCore'" repetido.
--
-- Es una opción de la base, no de esquema ni de datos: idempotente y reversible
-- (ALTER DATABASE ... SET AUTO_CLOSE ON).

DECLARE @db SYSNAME = DB_NAME();
IF EXISTS (SELECT 1 FROM sys.databases WHERE name = @db AND is_auto_close_on = 1)
BEGIN
  DECLARE @sql NVARCHAR(400) = N'ALTER DATABASE ' + QUOTENAME(@db) + N' SET AUTO_CLOSE OFF;';
  EXEC (@sql);
  PRINT '058: AUTO_CLOSE desactivado en ' + @db;
END
ELSE
  PRINT '058: AUTO_CLOSE ya estaba desactivado en ' + @db;
GO
