# Match Center — CONTINUAR AQUÍ (handoff)

> Documento de traspaso para retomar el trabajo del Match Center. Si te dicen
> **"continúa lo que dejaste"**, empezá por acá. Complementa a
> [match-center-plan.md](match-center-plan.md) (plan completo + auditoría FASE 0).
> Última actualización: 2026-09-22.

---

## 0) TL;DR — ESTADO ACTUAL: F2→F9 COMPLETADAS ✅

El plan **F2→F9** (numeración del usuario) se **terminó** el 2026-09-22 y está **commiteado y verde**
(`tsc -b` OK, `vite build` sin warnings, `vitest` 34/34). Ya no hay nada "a medias".
Lo que quedó afuera son solo datos/fuentes inexistentes (ver §6) y deuda técnica ajena (§8).

Resumen de lo cerrado en esta tanda (detalle en §4):
- **F2**: iconos/títulos de interrupción VAR (🖥️) y lesión (🚑) + filtro "otros".
- **F3**: polling en dos niveles (10s en vivo / 60s fuera) — ya estaba, verificado.
- **F4**: campos reales extra (toques/laterales/saques/tiros libres) + "Precisión de pases (%)" derivada.
- **F5**: formación por equipo (`/formations`), link al perfil `/jugadores/:id`, marca de "sustituido".
- **F6**: H2H inline (resumen victorias/empates/goles + últimos 5) reusando `reports/head-to-head`.
- **F7**: momentum + xG acumulado + evolución de tiros + xG por jugador (todo derivado del shot-map).
- **F8**: panel "Resumen del partido" (goleadores/tarjetas/marcador por período) al finalizar.
- **F9**: compartir (`navigator.share` + fallback copiar link), seguir + notificaciones, mapas, info adicional.

> Si te dicen "continuá", ya no hay fase pendiente del Match Center. Revisá §6 (datos faltantes reales)
> y §8 (deuda técnica) por si quieren avanzar en eso; si no, el módulo está terminado.

**Regla del usuario**: ejecutar F2→F9 de una, sin pedir confirmación entre fases, y entregar UN
reporte final (formato en §7). No desviarse a seguridad/CI/Swagger/React Query (son deuda técnica
aparte, ya registrada).

---

## 1) Contexto arquitectónico (para no re-auditar)

- **Ruta única**: `/partidos/:id` → `src/frontend/src/pages/matches/MatchDetailPage.tsx` (1433 líneas,
  12 tabs). **No crear otra página/ruta.** La tab por defecto es **`🎯 Centro`** = `MatchCenterTab`.
- **Tabs de consumo**: `center` (MatchCenterTab), `tactical` (TacticalViewTab), `advanced`
  (MatchTacticsTab), `video` (MatchVideoTab). **Tabs CRUD** (conservar): teams, officials, result,
  events, stats, players, history — son funciones dentro de MatchDetailPage.tsx.
- **Cabecera**: `src/frontend/src/components/pitch/MatchScoreboardHeader.tsx` (= "MatchHeader"; ya deriva
  Prórroga/Penales de `periodScores`). Tiene test `MatchScoreboardHeader.test.tsx`.
- **Tiempo real**: `src/frontend/src/hooks/useMatchLive.ts` — polling (no hay WS/SSE en backend).
  Reutilizarlo, no crear otro. Alimenta cabecera + Centro.
- **Match Center**: `src/frontend/src/pages/matches/MatchCenterTab.tsx` (composición) +
  `MatchChartsSection.tsx` (gráficos) + `MatchMapsSection.tsx` (heat/shots).
- **Componentes reutilizables** (`components/pitch/`): MatchScoreboardHeader, MatchTimeline,
  MatchCompareStats, FootballPitch, InteractiveFootballPitch, PlayerPitchViz, PlayerMarker,
  PlayerInfoPanel, PassMap, TacticalBoard. Primitivo: `components/stats/StatBars.tsx`.

### Endpoints backend disponibles (todos `JwtAuthGuard`, prefijo `/api/v1`)
`matches/:id`, `/timeline`, `/team-stats`, `/lineups`, `/officials`, `/coaches`, `/formations`,
`/positions`, `/advanced-metrics` (**solo lectura, tabla vacía, sin escritor**), `/shot-map`,
`/shootout-kicks`, `/result`, `/history`, eventos (goals/cards/substitutions/fouls/offsides/shots/
interruptions/penalty-kicks). Contexto: `seasons/:id/standings`, `reports/head-to-head?teamAId&teamBId`,
`insights/matches/:id/maps`, `matches?teamId=&status=&sortBy=matchDate&sortDir=&pageSize=`.

### Shapes clave (ya verificados)
- `TimelineEvent.type`: `goal | card | substitution | offside | foul | interruption`
  (goal tiene `ownGoal`, `penalty`, `goalType`, `assistPlayerName`; card `cardType`:
  `yellow|red|second_yellow`; interruption `interruptionType`: `var_review|medical|hydration|weather|crowd|other`).
- `MatchTeamStats` (campos REALES): possessionPct, shots, shotsOnTarget, shotsOffTarget, shotsBlocked,
  corners, fouls, offsidesCount, throwIns, goalKicks, freeKicksDirect, freeKicksIndirect, passes,
  passesCompleted, touches. **NO existen**: crosses, recoveries, interceptions, clearances, blocks,
  duels, attacks, dangerousAttacks, bigChances.
- `MatchLineupEntry`: isStarting, shirtNumber, position, minutesPlayed, posX/posY, goals, assists,
  yellowCards, redCards, playerFullName, photoUrl, playerId. **NO existe**: capitán, lesionado/suspendido.
- `ShotMapEntry`: source `goal|shot`, minute, teamId, playerId, playerName, posX/posY, penalty, ownGoal, `xg`.
- `MatchFormation`: teamId, formationShape (ej "4-3-3"), period, updatedAt.
- `StandingsResponse` (`types/season.ts`): `{ standings: StandingsRow[], pointsRule, warning }`.
- `head-to-head` devuelve `{ matches[], winsA, winsB, draws, goalsA, goalsB, matchesMissingScore }`
  (A = teamAId = el que mandás primero; pasá home como A, away como B).

---

## 2) Reglas duras (del usuario)
- **No inventar datos** (stats, xG, jugadores, ratings, clima, árbitros, posiciones, resultados).
  Si un dato no existe: buscar en front/back/DB/otro módulo; si no existe, **documentar el hueco**,
  NO crear endpoints artificiales solo para llenar UI.
- **No duplicar**: ni página, ni Match Center, ni fuentes, ni APIs/servicios/modelos/lógica, ni
  sistemas paralelos de tiempo real/jugadores/estadísticas.
- **Reutilizar > extender > extraer > crear**. Extraer de MatchDetailPage.tsx sólo con responsabilidad
  real (no trocear por reducir líneas).
- Tras cada fase: `tsc -b`, `vite build`, tests, revisar consola/requests/runtime/responsive y que lo
  anterior siga funcionando.

---

## 3) ⚠️ Primer paso obligatorio al retomar
Dejar el árbol compilando. En `MatchCenterTab.tsx` hay imports sin usar (`MatchFormation`,
`INTERRUPTION_TYPE_LABELS`). O bien completás F2 y F5 (que los usan — ver §4) en la misma tanda, o
los quitás temporalmente. Verificá con:
```
cd src/frontend && npx tsc -b
```

---

## 4) Trabajo restante por fase (tareas concretas)

### F2 — Eventos + Timeline  (PARCIAL)
Ya hay: timeline horizontal (`MatchTimeline`) + lista vertical agrupada por período con filtros
(tipo/equipo), goles destacados, "ir al último", resalte del último evento en vivo.
**Falta (real, con datos existentes):**
- Distinguir en `eventIcon`/`eventTitle` (en MatchCenterTab.tsx) los `interruption` por subtipo:
  `var_review` → 🖥️ "Revisión VAR"; `medical` → 🚑 "Atención médica / lesión"; resto →
  `INTERRUPTION_TYPE_LABELS[...]`. (Por eso se importó `INTERRUPTION_TYPE_LABELS`.)
- Agregar un chip de filtro para "otros" (offside/foul/interruption) en `EVENT_FILTERS`.
**No existe (documentar, no inventar):** gol anulado, penal concedido/anulado, penal fallado en juego
(hay tabla penalty-kicks pero sin GET ni en timeline), marcadores de inicio/HT/final/ET como eventos
(no están en el timeline; se representan por la agrupación por período).

### F3 — Tiempo real  (HECHO, sin commitear — ver §5)

### F4 — Estadísticas  (HECHO parcial, sin commitear — ver §5)
Ya se agregaron los campos reales que faltaban. **Falta**: en `StatsSection`, agregar fila **derivada**
"Precisión de pases (%)" = `passesCompleted/passes*100` por equipo (solo si `passes` existe).
**No existen** (documentar): centros, recuperaciones, intercepciones, despejes, bloqueos, duelos,
ataques, ataques peligrosos, (grandes) ocasiones — no están en `MatchTeamStats`.

### F5 — Alineaciones y jugadores  (FALTA)
Ya hay: XI/suplentes por equipo, DT (de `/coaches`), badges (goles/amarillas/rojas/minutos),
comparador de jugadores (StatBars con goals/assists/minutos/tarjetas).
**Falta (real):**
- En `LineupsSection`: fetch `/matches/:id/formations` → mostrar `formationShape` por equipo.
  (Por eso se importó `MatchFormation`.)
- Marcar jugadores **sustituidos**: derivar del timeline (subs `playerOutId`) → indicador "↩".
- **Link al perfil existente**: nombre del jugador → `navigate('/jugadores/'+playerId)` (PlayerDetailPage
  existe; NO crear perfil nuevo). `MatchLineupEntry.playerId` está disponible.
**No existe (documentar):** capitán, estado lesionado/suspendido en el lineup, stats individuales
avanzadas por jugador (advanced-metrics por jugador está vacío).

### F6 — Contexto de competición  (PARCIAL)
Ya hay: tabla (`/seasons/:id/standings`, resalta ambos equipos), forma reciente (últimos 5), próximos,
link al reporte H2H.
**Falta (real):**
- **H2H inline** en `ContextSection`: fetch `reports/head-to-head?teamAId={home}&teamBId={away}` y
  mostrar resumen (winsA/draws/winsB, goalsA-goalsB) + últimos 3 de `matches`. Mantener el link al
  reporte completo. (Shape en §1.)
- Opcional: forma como local/visitante por separado (hay data vía `matches?teamId`).
**No existe/gap:** zonas de clasificación (ascenso/descenso) — standings no trae zonas; el agregado de
llave necesita el otro partido (solo se muestra `leg`).

### F7 — Analítica avanzada  (HECHO ampliado, sin commitear — ver §5)
Ya hay: momentum + xG acumulado (derivados del shot-map). Se agregaron **evolución de tiros** y
**xG por jugador** (derivados). Verificar cálculo. **No inventar** xG/xA/PPDA externos: tabla
`match_advanced_metrics` vacía y **sin escritor** → NO crear POST (sería API solo para UI).

### F8 — Post-partido  (FALTA)
Ya hay: banner "Resumen final" cuando `finished` (la misma vista evoluciona LIVE→FINAL).
**Falta (real):** un panel **Resumen** cuando `finished`, cerca del tope, con datos ya cargados:
goleadores (de timeline goals, agrupados por jugador), resumen de tarjetas, marcador final por período.
No crear página FINAL separada. (No hay MVP en datos → no mostrar.)

### F9 — Extras  (PARCIAL)
Ya hay: seguir (localStorage) + notificaciones (toasts + Notification API cuando la pestaña no está
enfocada), mapas/heatmaps (MatchMapsSection), info adicional (clima/estadio/asistencia/TV/comentarios).
**Falta (real):** **Compartir** — botón con `navigator.share` (y fallback copiar link) en la
`StatusBar` (prop `extra`, junto a FollowButton). No inventar multimedia/highlights (sin fuente).

---

## 5) Edits YA aplicados en el working tree (SIN commit)
Si continuás en esta misma máquina, ya están. Si no, reproducilos:

1. **`hooks/useMatchLive.ts`** (F3): el `setInterval` ahora refresca cada 10s si `in_progress`, y cada
   ~60s (1 de cada 6 ticks) si no, para captar transición programado→en vivo. ✅ compila.
2. **`pages/matches/MatchChartsSection.tsx`** (F7): agregados `shotsSeries` (evolución de tiros,
   LineChart stepAfter) y `xgByPlayer` (top 8 por xG, lista). ✅ compila.
3. **`pages/matches/MatchCenterTab.tsx`** (F4 + imports F2/F5):
   - `COMPARE_FIELDS` ahora incluye touches, throwIns, goalKicks, freeKicksDirect, freeKicksIndirect.
   - Imports agregados `INTERRUPTION_TYPE_LABELS` y `MatchFormation` **aún sin usar** → **rompe build**
     hasta completar F2/F5.

---

## 6) Datos que realmente NO existen (no inventar)
xG/xA/PPDA/Field Tilt externos (tabla vacía, sin escritor) · rating por jugador · capitán ·
lesionado/suspendido en lineup · stats de equipo: centros/recuperaciones/intercepciones/despejes/
bloqueos/duelos/ataques/ocasiones · gol anulado / penal fallado en juego / penal concedido-anulado ·
marcador agregado de llave · streaming/highlights externos · MVP · clima solo si el partido lo tiene
cargado (campos existen: weatherCondition/temperatureCelsius/windKmh/humidityPct/pitchCondition).

---

## 7) Validación + formato de reporte final (lo que el usuario espera)
Correr: `cd src/frontend && npx tsc -b && npm run build && npm test`.
(Backend, si tocás algo: `cd src/backend && npm run build && npm test`.)
Entregar UN reporte:
```
FASE 2..9: COMPLETADA / PARCIAL / BLOQUEADA
  implementado / reutilizado / modificado / datos faltantes / endpoints / archivos / tests / problemas /
  qué quedó sin implementar y por qué
MATCH CENTER: COMPLETADO / PARCIAL
BUILD: / TESTS: / RUNTIME: / RESPONSIVE: / DATOS FALTANTES REALES: / DEUDA TÉCNICA RESTANTE:
```

## 8) Deuda técnica ajena (NO tocar en este trabajo)
`PlayerProfilePage.test.tsx` es **flaky** bajo carga (mock de `fetch` por orden de llamadas; aislado
pasa 3/3) — ajeno al Match Center. Además, hallazgos generales ya registrados: JWT_SECRET fallback,
falta helmet/rate-limit/CI/tests/logging (ver conversación). Todo eso es **deuda separada**, no parte
del Match Center.

## 9) Git / repos
- Repo real: `https://github.com/henry240498/LeagueCore` (rama `main`). `origin` debe apuntar ahí
  (a veces se revierte solo por el sandbox: `git remote set-url origin https://github.com/henry240498/LeagueCore.git`).
- Último commit verde: **`87f243c`**. Atribución de commits: `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.
