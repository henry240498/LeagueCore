# Migraciones — LeagueCore

Scripts numerados, se aplican en orden. Motor: SQL Server local (`localhost:1433`, base `LeagueCore`).

## ⚠️ Ejecutar siempre con `-f 65001` (UTF-8)

Los scripts se guardan en UTF-8. `sqlcmd` **no** detecta la codificación automáticamente y por
default los lee con el codepage ANSI del sistema — cualquier `Ñ`/tilde en un script se corrompe al
insertarse (verificado: `Cerro Porteño` se guardó como `Cerro PorteÃ±o`, dos caracteres en vez de uno).
La collation de la base (`Modern_Spanish_CI_AS`) no tiene nada que ver con esto — el problema es
100% de lectura del archivo `.sql`, no de almacenamiento.

**Siempre** usar el flag `-f 65001`:

```powershell
& "C:\Program Files\Microsoft SQL Server\Client SDK\ODBC\170\Tools\Binn\sqlcmd.exe" `
  -S localhost,1433 -U sa -P 123456 -C -f 65001 -i "ruta\al\script.sql"
```

Esto aplica a cualquier script que inserte texto en español con tildes/Ñ — crítico para la Fase 2
(migración de los datos reales de Ltrack: "CERRO PORTEÑO", "GUARANÍ", etc.).

## ⚠️ `dbo.users` tiene un índice filtrado — requiere `SET QUOTED_IDENTIFIER ON`

Cualquier `INSERT`/`UPDATE`/`DELETE` contra `dbo.users` ejecutado con `sqlcmd -Q "..."` (modo query
inline) falla con `Msg 1934` porque la sesión de `sqlcmd` trae `QUOTED_IDENTIFIER OFF` por default, y
la tabla tiene un índice único filtrado (`UX_users_email_filtered`). Esto **no afecta** a la app (el
driver `mssql` de Node sí pone `QUOTED_IDENTIFIER ON` por conexión) — sólo a scripts/consultas sueltas
por `sqlcmd`. Si necesitás tocar `dbo.users` a mano, agregá `SET QUOTED_IDENTIFIER ON; GO` al principio
del script (ver `003b_fix_email_filtered_index.sql` como ejemplo).

## ⚠️ Desde la migración 047, `players`/`officials`/`coaches`/`teams`/`competitions`/`venues` también requieren `SET QUOTED_IDENTIFIER ON`

La migración 047 (índices de matching para el motor de migración histórica) agregó columnas
computadas persistidas (`normalized_last_name`/`normalized_full_name`/`normalized_name`) a estas
seis tablas. Igual que `dbo.users` (ver más abajo), cualquier `INSERT`/`UPDATE`/`DELETE` contra ellas
vía `sqlcmd -Q "..."` sin `SET QUOTED_IDENTIFIER ON` primero falla con `Msg 1934` (verificado
limpiando datos de prueba tras un smoke test del motor de migración: un `DELETE FROM dbo.players`
sencillo lo disparó). No afecta a la app (el driver `mssql` ya pone `QUOTED_IDENTIFIER ON` por
conexión) -- sólo a scripts/consultas sueltas por `sqlcmd`.

## Orden de aplicación

| Script | Contenido |
|---|---|
| `000_create_database.sql` | Crea la base `LeagueCore` (collation `Modern_Spanish_CI_AS`) |
| `001_create_core_tables.sql` | Tablas núcleo: users, competitions, venues, officials, teams, players, matches, goals, cards, substitutions, penalty_misses |
| `002_create_standings_view.sql` | Vista `dbo.standings` (tabla de posiciones calculada) |

Ver `docs/ANALISIS_INICIAL_LEAGUECORE.md` §4 y §12.6 para las decisiones de diseño (idioma de
identificadores en inglés, aún no confirmado formalmente por el usuario).
