# Persistencia — LeagueCore

NestJS 10, React/Vite; SQL Server

Conservar cambios existentes. Detener solo procesos identificados como propios.

## Fuentes locales
- [docs](<../docs>)

## SQL Server local (Express): síntomas de timeout de 15 s
El pool de `mssql` usa `requestTimeout` de 15 s; una consulta que no se resuelve en ese plazo llega al usuario como un 500 genérico ("Timeout: Request failed to complete in 15000ms" en `logs/backend.log`). Dos causas ya vistas, ambas fuera del código:
- **`AUTO_CLOSE ON`** en la base: al cerrar el pool sus conexiones ociosas (30 s) la base se apaga y la primera petición debe reabrirla. En el log de SQL Server aparece `Starting up database 'LeagueCore'` repetido. Corregido por la migración `058_disable_auto_close.sql`.
- **Falta de memoria del servidor**: con la PC casi sin RAM libre, Windows recorta a SQL Server y su presupuesto de memoria para consultas cae a unos pocos MB (`sys.dm_exec_query_resource_semaphores.target_memory_kb`). Una consulta cuyo mínimo supera el 25 % de ese presupuesto queda esperando `RESOURCE_SEMAPHORE` hasta el timeout, aunque en `sqlcmd` tarde 30 ms; falló `/matches`, `/players` y `/operations/discipline`. Se fijó `min server memory (MB) = 1024` a nivel de instancia (2026-09-23); revertir con `sp_configure 'min server memory (MB)', 16`. Es un ajuste de la instancia, no de la base: la comparten otras bases de la PC.

Para diagnosticar: lanzar la petición y, mientras cuelga, consultar `sys.dm_exec_requests` (columna `wait_type`) y `sys.dm_exec_query_memory_grants`.

Versión efectiva de una DB remota, último backup y última restauración: NO DETERMINADO. No inferir esos datos de la versión esperada en código. No editar migraciones aplicadas ni ejecutar DDL como efecto del arranque documental.
