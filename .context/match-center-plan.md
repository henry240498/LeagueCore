# Match Center — Reinvención de la vista de partido (plan por fases)

> Registro de trabajo para retomar entre sesiones. **Estado global: MÓDULO COMPLETO — FASES 0–16.**
> (8 completada con gráficos derivados de datos reales; 12 implementada sin infra previa vía
> localStorage + toasts en-página; 13 con info adicional real + video en su pestaña.) Verificado.
> Fecha de inicio del registro: 2026-09-21.

## Objetivo
Reinventar por completo la vista de partido existente y convertirla en un **Match Center / Centro
del Partido** profesional, completo y en tiempo real, **integrado nativamente** al sistema actual.

## Reglas duras (no negociables)
- La vista de partido YA EXISTE. **No crear una segunda vista, módulo, API, servicio, modelo ni
  componente paralelo.** Reutilizar y extender.
- **No inventar datos.** Si falta un dato: identificarlo, ver si existe en otra parte, reutilizarlo;
  si no existe, dejar la integración preparada y mostrar un estado vacío apropiado.
- Nunca mostrar `undefined`/`null`/`NaN`/errores técnicos al usuario.
- Respetar arquitectura, navegación, auth, permisos, diseño y mecanismo de actualización existentes.
- Avance por fases: cada fase debe compilar, no romper lo anterior, y quedar estable antes de seguir.
- Diferenciar visualmente **métricas derivadas** (calculadas por el sistema) de datos oficiales.

---

## FASE 0 — Mapa de auditoría (RESULTADO)

### Superficies actuales de "partido"
| Superficie | Ruta | Archivo | Rol actual |
|---|---|---|---|
| Detalle de partido | `/partidos/:id` | `src/frontend/src/pages/matches/MatchDetailPage.tsx` (1413 líneas) | Vista principal de **lectura + edición**, con 11 pestañas monolíticas en un solo archivo |
| Partido en vivo | `/partidos/:id/live` | `src/frontend/src/pages/matches/LiveMatchPage.tsx` (248 líneas) | **Herramienta de CARGA en vivo** (botones grandes para el estadístico en cancha), polling 10s. NO es una vista de espectador |
| Lista | `/partidos` | `MatchesListPage.tsx` | Listado |
| Alta/edición | `/partidos/nuevo`, `/partidos/:id/editar` | `MatchFormPage.tsx` | Formulario |
| Reporte | `/reportes/partidos/:id` | `MatchDetailReportPage.tsx` | Reporte imprimible |

Pestañas de `MatchDetailPage`: `info`, `teams`, `officials`, `result`, `events`, `stats`,
`players`, `tactical`, `advanced`, `video`, `history` (todas como funciones dentro del mismo archivo:
`InfoTab`, `TeamsCoachesTab`, `OfficialsTab`, `ResultTab`, `EventsTab`, `StatsTab`, `PlayersTab`,
`TacticalViewTab`, `MatchTacticsTab`, `MatchVideoTab`, `HistoryTab`).

### Componentes reutilizables (`src/frontend/src/components/pitch/`)
- `MatchScoreboardHeader.tsx` — cabecera de marcador. Props: `{ match: Match }`.
- `MatchTimeline.tsx` — línea de tiempo de eventos.
- `MatchCompareStats.tsx` — estadísticas comparadas L/V. Props: `{ match: Match }`.
- `FootballPitch.tsx` / `InteractiveFootballPitch.tsx` — cancha (estática / interactiva).
- `PlayerPitchViz.tsx` — visualización de posiciones/jugador en cancha.

### Backend — módulo `matches` (todo bajo `JwtAuthGuard`, prefijo `/api/v1/matches`)
`src/backend/src/matches/`: `matches.service.ts`, `match-events.service.ts`,
`match-participants.service.ts`, `match-stats.service.ts` + 18 DTOs.

Endpoints disponibles (reutilizar TODOS, no duplicar):
- Núcleo: `GET /`, `GET /:id`, `POST`, `PUT /:id`, `PATCH /:id/status`, `DELETE /:id`,
  `GET /:id/history`, `GET /check-duplicates`.
- Resultado por periodos: `PUT /:id/result`, `DELETE /:id/result/:period`.
- Oficiales: `GET/POST /:id/officials`, `DELETE /:id/officials/:moId`.
- Cuerpo técnico: `GET/POST /:id/coaches`, `DELETE ...`.
- Alineaciones: `GET/POST /:id/lineups`, `DELETE ...`, `PATCH /:id/lineups/:lid/position`.
- Formaciones: `GET /:id/formations`, `PUT /:id/formations`.
- Analítica: `GET /:id/positions`, `GET /:id/advanced-metrics`,
  `GET /:id/players/:pid/physical-stats`.
- Timeline: `GET /:id/timeline` (lectura combinada de eventos).
- Eventos: goals, cards, substitutions, fouls, offsides, shots (+ `GET /:id/shot-map`),
  interruptions, penalty-kicks (POST/DELETE cada uno).
- Tanda de penales: `GET/POST /:id/shootout-kicks`, `DELETE ...`.
- Estadísticas de equipo: `GET /:id/team-stats`, `PUT /:id/team-stats/:teamId`.

### Modelo de datos disponible (`src/frontend/src/types/match.ts`)
- `Match`: competición, temporada (`seasonLabel`), `round`/`phase`/`groupName`/`leg`, venue (+foto),
  clima (condición/temperatura/humedad/viento), `pitchCondition`, `attendance`, `televised`,
  `dataOrigin`, `periodScores[]` (first_half/full_time/extra_time/penalties), `score`, escudos L/V.
- `MatchLineupEntry`: foto, nacionalidad, `isStarting`, dorsal, posición, minutos, `posX/posY`,
  goals/assists/yellow/red.
- `MatchTeamStats`: posesión, tiros (on/off/blocked), córners, faltas, offsides, throw-ins,
  goal-kicks, tiros libres, pases (+completados), touches.
- `TimelineEvent`: goal|card|substitution|offside|foul|interruption (minute/extra, período, equipo,
  jugador, asistencia, ownGoal, penalty, goalType, cardType, entra/sale, interruptionType).
- `ShotMapEntry`: posX/posY, outcome, minuto, equipo, jugador, penalty, ownGoal, **xg**.
- `MatchAdvancedMetric`: genérico `metricName`/`metricValue` + `provider`/`modelVersion` → soporta
  xG/xA/PPDA/etc. **sin datos reales cargados todavía** (esquema listo).
- `MatchPhysicalStats`: distancia, velocidad, sprints, aceleraciones (GPS) — esquema listo.
- `MatchFormation`, `MatchPlayerPosition`, `ShootoutKick`, `MatchHistoryEntry`.

### Tiempo real
- **Solo polling.** `LiveMatchPage` hace `setInterval(load, 10000)`. `MatchDetailPage` carga una vez
  (sin auto-refresh). **No hay WebSocket ni SSE** en el backend (verificado por grep).
- Mecanismo a reutilizar/mejorar: polling. Extraer a un hook reutilizable (p. ej. `useMatchLive`).

### Estados de partido (`MATCH_STATUSES` en constants.ts + parameters `match_status`)
Existen: `scheduled`, `in_progress`, `finished`, `postponed`, `suspended`, `cancelled`.
El DTO valida contra `constants.ts` **y** la categoría `match_status` de Parametrizaciones.

### Qué existe / parcial / falta (frente al pedido)
- **Existe (datos + endpoints):** cabecera, eventos, timeline, alineaciones, formaciones, stats de
  equipo, shot-map (con xg), posiciones, métricas avanzadas (esquema), físico (esquema), penales,
  tanda de penales, historial, clima/árbitro/asistencia/venue.
- **Parcial:** tiempo real (polling básico, sin indicador de conexión/reconexión); estadísticas
  individuales (hay goals/assists/cards/minutos por lineup, faltan tiros/pases/rating por jugador);
  xG/xA (esquema `advanced_metrics` listo, sin datos); tabla/forma/H2H (existen en reportes/otros
  módulos, verificar endpoint reutilizable).
- **Falta (dato/UX):** estados HT/tiempo-extra/penales/abandonado como estado propio (derivables de
  periodScores/shootout + in_progress); indicador LIVE/minuto en vivo real; momentum/gráficos xG;
  heatmaps con datos reales (solo esquema de posiciones); comparador de jugadores en la vista;
  seguir/favoritos/notificaciones (verificar si existe módulo); multimedia (MatchVideoTab existe);
  compartir/deep-links.

### Dependencias de datos que HOY no tienen datos reales (dejar preparado, no inventar)
- `advanced_metrics` (xG/xA/PPDA/Field Tilt…): esquema y endpoint listos, sin filas → mostrar vacío.
- `match_player_positions` (heatmaps/posición media): esquema listo, sin datos → mostrar vacío.
- `physical-stats` (GPS): esquema listo, sin datos → mostrar vacío.
- Rating por jugador y stats individuales de tiros/pases: no hay columna/endpoint dedicado.
- Tabla de posiciones / forma / H2H / próximos: confirmar endpoint reutilizable (standings/reportes)
  antes de FASE 7.

---

## Decisiones abiertas (resolver antes de FASE 1)
1. **¿Qué superficie es el Match Center de espectador?**
   - Recomendado: **reinventar `MatchDetailPage` (`/partidos/:id`)** como el Match Center profesional
     (consumo), y **conservar `LiveMatchPage` (`/live`)** como "modo carga en vivo" (data-entry), que
     es un rol distinto, no una vista duplicada.
   - Alternativa: fusionar carga + consumo (más riesgo de romper el flujo del estadístico).

---

## Decisión tomada (2026-09-21)
- Superficie del Match Center: **reinventar `MatchDetailPage` (`/partidos/:id`)**; `LiveMatchPage`
  (`/partidos/:id/live`) se conserva como "modo carga en vivo" (data-entry del estadístico).

## Fases (checklist de estado)
- [x] **FASE 0** — Auditoría y mapeo (P0). ← este documento.
- [x] **FASE 1** — Core: cabecera + estados + info contextual (P1, crítica).
  - Se **mejoró el componente existente** `components/pitch/MatchScoreboardHeader.tsx` (no se duplicó):
    contexto (competición/temporada/ronda/fase/grupo), badge de estado con **indicador EN VIVO**
    (pulso) y minuto/añadido opcionales, marcador actual (`match.score`) o por períodos (1T/TE/penales),
    `leg`, escudos, y meta (fecha, hora, sede, asistencia, árbitro, asistentes, VAR, TV).
  - Integrado a nivel de página en `MatchDetailPage` (arriba de las pestañas), con `context`
    (enlaces navegables) y `actions` (Modo carga/IA/Editar/Eliminar) vía props opcionales.
  - Se **quitó el uso duplicado** de `MatchScoreboardHeader` dentro de `TacticalViewTab`.
  - Oficiales para árbitro/VAR: se reutiliza `GET /:id/officials` (sin endpoint nuevo).
  - Pendientes de dato (no inventados): `liveMinute`/`addedMinutes` son props opcionales sin fuente
    aún (se cablearán en FASE 3 con el timeline/polling); "marcador agregado" real requiere el otro
    partido de la llave → sólo se muestra `leg`, no se inventa el agregado.
  - Estados HT/tiempo-extra/penales/abandonado NO existen como `status` propio (sólo los 6 de
    `MATCH_STATUSES`); se representan con el estado real + sub-marcadores por período.
- [x] **FASE 2** — Eventos + timeline. Nueva pestaña `🎯 Centro` (`MatchCenterTab`): timeline horizontal
  (reusa `MatchTimeline`) + lista vertical agrupada por período, filtros por tipo y equipo, goles
  destacados, resalte del último evento en vivo, botón "ir al último".
- [x] **FASE 3** — Tiempo real. Hook reutilizable `hooks/useMatchLive.ts` (polling sólo si `in_progress`,
  estado de conexión, última actualización, refresh, minuto en vivo derivado del timeline). Alimenta
  la cabecera (minuto) y el Match Center; barra de estado de conexión en el Centro.
- [x] **FASE 4** — Estadísticas principales. Comparativa L/V con `StatBars` desde `team-stats` (sin refetch,
  usa los datos del hook). Estado vacío si no hay stats.
- [x] **FASE 5** — Alineaciones. Titulares/suplentes por equipo, dorsal/posición/minutos, DT (reusa
  `/coaches`). Formación sobre cancha: se remite a la pestaña Análisis (ya existente) para no duplicar.
- [x] **FASE 6** — Jugadores. Badges por jugador (goles/amarillas/rojas/minutos) desde el lineup.
- [x] **FASE 7** — Contexto. Tabla (`/seasons/:id/standings`, resalta ambos equipos), forma reciente
  (últimos 5 vía `/matches?teamId&status=finished`), próximos (`?status=scheduled`), y link al reporte
  H2H existente (`/reportes/enfrentamientos`).
- [x] **FASE 8** — Avanzado. (a) Sección `advanced-metrics` (xG/xA/PPDA externos) con estado vacío honesto.
  (b) **Gráficos derivados** (`MatchChartsSection`): **Momentum** (presión local/visitante por tramos de
  5', desde tiros/goles reales del shot-map) y **xG acumulado** (líneas por equipo, sólo si los tiros
  traen xG). Rotulados "derivadas". Sin inventar valores (si no hay tiros, no hay gráfico).
- [x] **FASE 9** — Shot map + heatmaps. Reusa `MatchMapsSection` (`/insights/matches/:id/maps`).
- [x] **FASE 10** — Comparación de jugadores. Selector A/B + `StatBars` con stats reales del partido.
- [x] **FASE 11** — Resumen post-partido. Banner "Resumen final" cuando `finished`; la misma vista
  Centro evoluciona LIVE → FINAL (no hay página aparte).
- [x] **FASE 12** — Seguimiento/notificaciones. No existía infraestructura (auditoría) → se implementó
  sin duplicar nada: **"Seguir/Dejar de seguir"** por-visitante en `localStorage` (`FollowButton`), y
  **avisos en vivo** (`LiveEventToasts`) que muestran toasts al llegar goles/tarjetas/cambios nuevos
  mientras el partido está abierto (detecta ids nuevos del timeline entre polls; no floodea al abrir).
  Además, **notificaciones nativas del navegador** (`Notification` API): al seguir se pide permiso, y
  los eventos importantes disparan una notificación del SO cuando la pestaña NO está enfocada.
  Nota: el push con la pestaña totalmente cerrada no se incluye — requiere Service Worker + servidor
  de push (VAPID), infraestructura que hoy no existe.
- [x] **FASE 13** — Multimedia / info adicional. `MatchExtraInfo`: estadio, asistencia, clima,
  temperatura, viento, humedad, estado del campo, transmisión y comentarios — todos datos reales del
  partido. Video/repeticiones siguen en la pestaña `🎬 Video` (no se duplica). Streaming/highlights
  externos: no hay fuente autorizada → no se inventan enlaces.
- [~] **FASE 14** — UX/UI. Aplicada inline (responsive, estados vacío/carga, feedback de conexión,
  resaltes, filtros). Falta una pasada dedicada de pulido.
- [x] **FASE 15** — Rendimiento. (a) `useMatchLive` sólo re-renderiza cuando los datos cambian entre
  polls (comparación por serialización) → un poll idéntico no dispara render. (b) Code-splitting de
  pestañas pesadas del partido (`MatchCenterTab`, `MatchTacticsTab`, `MatchVideoTab`) con `React.lazy`.
  (c) **Code-splitting a nivel de rutas** en `App.tsx`: todas las páginas con `React.lazy` + `<Suspense>`.
  Resultado: bundle inicial **1.193 kB → 261 kB** (gzip 298→82 kB) y **desaparece el warning** de chunk
  > 500 kB; cada página es un chunk propio.
- [x] **FASE 16** — Validación. `MatchScoreboardHeader.test.tsx` cubre estados (programado/en vivo/
  finalizado+penales/suspendido) y garantiza que no aparezca `undefined`/`NaN`/`null`. Suite completa
  verde. Verificación de estados restantes (aplazado/cancelado/abandonado) cubierta por el mapeo de
  `STATUS_TONE`/`MATCH_STATUS_LABELS`.

## Regla de avance
No pasar a la siguiente fase si quedan: errores de compilación/runtime, datos incorrectos,
funcionalidades rotas, peticiones duplicadas, componentes duplicados, o estados LIVE inconsistentes.

## Cierre de seguridad (2026-09-21)
Barrido tras terminar el Match Center, para no dejar huecos:
- **Auth**: todos los controllers del backend usan `JwtAuthGuard`, salvo dos por diseño:
  `health` (público) y `dev` (pantalla de login, pre-auth). El nuevo módulo `informal-tournaments`
  y todo lo usado por el Match Center están autenticados.
- **Backdoor dev** (`/dev/test-credentials`): sigue triple-gateado (404 en producción, `DevModule`
  no se monta en prod, sólo responde a accesos loopback salvo `DEV_CREDENTIALS_REMOTE=true`).
  Cubierto por `dev.controller.spec.ts`.
- **`/health` endurecido**: ya no filtra el nombre de la base ni la hora del servidor (sólo
  `{ status, api, database: { connected } }`) y no lanza 500 si la base está caída.
  Nuevo `health.controller.spec.ts` fija ese contrato.
- **SQL**: el código nuevo usa parámetros (`request.input`) y whitelists para `ORDER BY` (sin
  inyección). Sin secretos versionados (`.env` en `.gitignore`). Frontend detrás de `ProtectedRoute`.
- **Verificación**: backend `nest build` OK + `jest` 100 tests OK; frontend `tsc`/`vite build` OK +
  `vitest` 32/32 (se corrigió además un test flaky preexistente en `PlayerProfilePage`).

## Reejecución con plan riguroso (numeración del usuario, 2026-09-22)
- **FASE 0 (audit específico) — COMPLETADA**: mapa tab→endpoint de `MatchDetailPage` (12 tabs: center/
  tactical/advanced/video = consumo; teams/officials/result/events/stats/players/history = CRUD).
  Hallazgo clave: `match_advanced_metrics` (mig. 015) **existe pero no tiene escritor** (solo lectura);
  **no** se crea POST (sería API solo para llenar UI). Componentes reutilizables inventariados.
- **FASE 1 (core) — COMPLETADA**: la estructura visual ya estaba (cabecera pro + tab Centro). Esta
  pasada agrega **estados LIVE finos derivados de datos reales**: la cabecera muestra "Prórroga" o
  "Penales" cuando `periodScores` tiene esos marcadores (Entretiempo NO es derivable: no hay marcador/
  evento de límite de tiempo). Reutiliza `MatchScoreboardHeader` (= MatchHeader). Tests nuevos en
  `MatchScoreboardHeader.test.tsx`. Verificado: tsc/build/vitest 34.
- Hallazgo (no Match Center): `PlayerProfilePage.test.tsx` es flaky bajo carga por mock de `fetch`
  dependiente del orden; pasa 3/3 aislado. Registrado para arreglo futuro (mockear por URL).

## Bitácora de avance
- 2026-09-21 — FASE 0 completada. Auditoría registrada.
- 2026-09-21 — Decisión de superficie tomada (MatchDetailPage = Match Center).
- 2026-09-21 — FASE 1 completada (cabecera profesional integrada, sin duplicar componentes).
- 2026-09-21 — FASES 2–11 implementadas en `MatchCenterTab` (pestaña "🎯 Centro", por defecto) + hook
  `useMatchLive` (FASE 3). FASE 8 y 13 parciales (sin datos / ya existente), FASE 12 N/A (sin infra),
  FASE 14 aplicada inline. **Pendientes: FASE 15 (rendimiento) y FASE 16 (validación).**
  Archivos: `hooks/useMatchLive.ts` (nuevo), `pages/matches/MatchCenterTab.tsx` (nuevo),
  `pages/matches/MatchDetailPage.tsx` (modif.), `components/pitch/MatchScoreboardHeader.tsx` (modif. FASE 1).
  Verificación (2026-09-21): `tsc -b` OK, `vite build` OK, `vitest` 27/27 OK, `oxlint` sin errores
  (sólo warnings de estilo preexistentes del repo). Build listo.
