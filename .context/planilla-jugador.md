# Planilla del jugador — trayectoria e historial

> Qué muestra, de dónde sale cada dato y qué falta. Implementado el 2026-09-23.
> Vive en la ruta existente `/jugadores/:id/expediente` (**no** se creó página ni ruta nueva).

## Por qué existe
El sistema ya guardaba mucho de lo que un jugador hizo, pero **ningún endpoint lo leía**: las tablas
estaban pobladas y no había forma de verlas. La planilla expone eso, sin agregar tablas ni inventar
datos.

## Dónde está

| Capa | Archivo |
|---|---|
| Servicio backend | `src/backend/src/players/player-career.service.ts` (+ `.spec.ts`) |
| Endpoints | `players.controller.ts` → `GET /players/:id/career` y `GET /players/:id/match-log` |
| Registro | `players.module.ts` (provider `PlayerCareerService`) |
| Tipos frontend | `src/frontend/src/types/player.ts` (`PlayerCareer`, `PlayerMatchLog`, …) |
| Servicio frontend | `src/frontend/src/services/playerProfile.ts` (`getCareer`, `getMatchLog`) |
| UI | `src/frontend/src/pages/players/PlayerCareerSection.tsx`, montada en `PlayerProfilePage.tsx` |

## De dónde sale cada dato (mapa real)

| Sección | Fuente |
|---|---|
| **Trayectoria** (clubes por los que pasó, fechas, dorsal, "Actual") | `dbo.player_team_history`. La base garantiza **un solo paso abierto** por jugador (índice único filtrado `UX_pth_player_open_stint`), así que `end_date IS NULL` = equipo actual. |
| **Totales de carrera** (PJ, titular, desde banco, minutos) | `dbo.match_lineups` |
| **Goles / asistencias / tarjetas** | **Derivados siempre** de `dbo.goals` y `dbo.cards`, nunca de un acumulador guardado — mismo criterio que usa la alineación del partido (`match-participants.service.ts`), para que no puedan quedar desincronizados. |
| **Por competición** | `match_lineups` ⋈ `matches` ⋈ `competitions` |
| **Posiciones jugadas** | `COALESCE(match_lineups.position, players.position)`, agrupado |
| **Estadísticas individuales** (tiros, pases, toques, entradas, intercepciones, despejes, recuperaciones, duelos, bloqueos) | `dbo.match_player_stats` |
| **Partido a partido** (paginado) | `match_lineups` ⋈ `matches` ⋈ `teams`/`competitions`/`seasons` ⋈ `match_period_scores` (full_time) |

### Dato útil que se descubrió
`match_player_stats` **sí tiene** duelos, recuperaciones, intercepciones, despejes y bloqueos **por
jugador**, aunque esas métricas **no existen a nivel equipo** en `match_team_stats` (ver
[deuda-tecnica.md](deuda-tecnica.md) y el reporte del Match Center).

## Reglas respetadas
- **Nada se inventa.** `statTotals` llega **`null`** si `match_player_stats` no tiene ninguna fila
  para el jugador — la UI dice "sin estadísticas cargadas" en vez de mostrar ceros que parecerían
  datos reales. Cada sección vacía se explica.
- `getMatchLog` **pagina** (por defecto 20, tope 100): un jugador puede tener cientos de partidos.
- La respuesta se **normaliza en el frontend**: si llegara incompleta, la planilla muestra ceros y
  listas vacías en vez de romper la pantalla.

## Qué falta (no se hizo a propósito)
- **No hay pantalla para CARGAR `match_player_stats`.** La tabla existe y la planilla ya la muestra,
  pero hoy nada la escribe desde la app → en la práctica esa sección va a decir "sin estadísticas"
  hasta que exista una forma de cargarla. **Es el siguiente paso natural de esta funcionalidad.**
- `dbo.player_objectives` existe y no se muestra en ningún lado (objetivos del jugador).
- Rating/valoración por jugador: no existe columna ni fuente.

## Verificación al cierre
Backend `nest build` 0 · `jest` **111/111** (19 suites) · Frontend `tsc` 0 · `vite build` 0 ·
`vitest` **47/47** (4 corridas seguidas) · `oxlint` 0.

### Dos bugs que encontraron los tests
1. `totals()` leía `recordset[0]` sin verificar que existiera → crasheaba si la consulta no devolvía
   fila. Corregido devolviendo ceros.
2. El test esperaba por el encabezado "📋 Planilla del jugador", **que también aparece durante la
   carga**, así que las aserciones corrían antes de que llegaran los datos. Ahora espera por el badge
   "Actual", que sólo existe con la trayectoria ya cargada. *(Patrón a evitar en tests nuevos.)*
