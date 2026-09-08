# Análisis Registro Fútbol → LeagueCore

**Fecha**: 2026-08-27 (actualizado — auditoría autenticada real)
**Alcance**: recorrido real, autenticado, de sólo lectura de `registrofutbol.cl/app` con la cuenta
autorizada por el cliente. Sesión cerrada correctamente al finalizar ("cerrar sesión", tal como pide
el propio sitio). **No se creó, editó ni eliminó ningún dato** en Registro Fútbol — todas las
acciones fueron búsquedas/consultas (GET o POST de formularios de búsqueda), nunca un botón de
Agregar/Editar/Guardar/Eliminar. **Las credenciales no se guardaron en ningún archivo, código, Git,
memoria ni nota de Obsidian** — se usaron sólo en memoria de la sesión de terminal para autenticar, y
se descartaron junto con la cookie de sesión al terminar.

## 1. Acceso verificado

- `registrofutbol.cl/app` es una aplicación PHP clásica basada en `frameset` (no una SPA moderna) —
  esto permitió analizarla con peticiones HTTP directas (`curl` con manejo de cookies de sesión),
  replicando exactamente lo que haría un navegador, sin evadir ningún mecanismo de seguridad.
- Login real exitoso contra `validacion.php` (POST con campos `RUT`/`PASS`) → cookie `PHPSESSID` real
  → redirección a `buscador/menu_cliente.php` → estructura de 3 frames (`arriba.php`, `menu.php`,
  `bienvenida.php`).
- Sesión cerrada correctamente al finalizar vía el enlace real "cerrar sesión" del menú.

## 2. Módulos encontrados (menú real, confirmado)

Menú principal, igual en las 8 secciones: **Equipos, Partidos, Jugadores, Técnicos, Árbitros,
Estadios, Público, Rankings**.

## 3. Equipos

Submenú real: **Historial, Paralelos, Campañas, Rendimientos, Campeones Primera A, Campeones
Primera B**.

- **Historial**: se elige un equipo (selector real con ~430 equipos — clubes chilenos históricos,
  selecciones nacionales chilenas por ciudad/época, y clubes/selecciones internacionales rivales de
  copas continentales) + rango de años. Devuelve una tabla real: **AÑO | Campeonato | PJ | PG | PE |
  PP | Gol F | Gol C | Dif**, una fila por cada campaña (competición×año) del club, con enlace "Ver
  Detalle" por fila.
  - **Verificado con datos reales**: historial completo de Colo Colo 1933-2024, incluyendo
    campañas de Copa Libertadores, Copa Sudamericana, Torneo Oficial Primera A, Supercopa, Copa
    Chile — cada una como fila separada del mismo club (nunca duplicado).
  - **"Ver Detalle" de una campaña puntual** abre un resumen real con: Partidos Jugados/Ganados/
    Empatados/Perdidos, Goles Favor/Contra, Autogoles Favor/Contra, Diferencia de Gol, Mayor Goleada
    a Favor/en Contra (con "Ocurrencia"), Partido con más Goles — y **Resumen de Incidencias**
    (conteo real por tipo, ej. "Gol de Juego: 9", "Tarjeta Roja: 3", con enlaces "Ver Todas" y "Ver
    por Jugador"). Además: **exportación real a XML** de cualquier consulta filtrada ("generar xml").
- **Paralelos**: **NO es una categoría/serie del club (mi suposición del informe público estaba mal,
  corregida acá con datos reales)**. Es un **comparador cabeza a cabeza entre dos equipos**
  (selecciona Equipo 1 + Equipo 2 + rango de años). Devuelve: Partidos Jugados, Ganados/Empatados/
  Perdidos por cada equipo, Total de Goles de cada equipo, Diferencia de Gol, Mayor Goleada de cada
  equipo, Partido con más Goles, y el mismo desglose de Incidencias **por separado para cada uno de
  los dos equipos** (Gol de Juego, Tarjeta Roja, Gol de Penal, Autogol, Penal Atajado, Penal
  Desviado).
  - **Verificado con datos reales**: Colo Colo vs Universidad de Chile, 1933-2024 → 243 partidos
    jugados, 110 ganados Colo Colo, 70 empates, 63 ganados U. de Chile, 398 goles Colo Colo vs 291
    goles U. de Chile, mayor goleada 6-0 (Colo Colo) y 5-0 (U. de Chile).
  - **Esto es exactamente el mismo tipo de funcionalidad que `HeadToHeadView.tsx`/`ComparePage.tsx`
    de LeagueCore ya implementan** — LeagueCore no está atrás acá, sólo le faltan los tipos de
    incidencia adicionales (ver §11).
- **Campañas** / **Rendimientos**: vistas alternativas del mismo historial (no se profundizó en la
  diferencia exacta entre ambas, ambas parten de la misma tabla base ya documentada arriba).
- **Campeones Primera A / Primera B**: páginas estáticas (`.htm`), confirman que SÍ existe un
  registro explícito de campeón por año y división — no es sólo "derivable de la tabla de
  posiciones" como asumí en el informe anterior, es contenido propio curado.

## 4. Partidos

Submenú real: **Buscar Partido, Goleadas, Más Goles, Tablas, Resumen**.

- Buscar Partido: selector de dos equipos (misma mecánica que Paralelos) para encontrar
  enfrentamientos puntuales.
- Goleadas / Más Goles: rankings de partidos por mayor diferencia de gol / más goles totales,
  filtrable por equipo y rango de años (mismo patrón de filtros que el resto del sistema).
- Tablas: tabla de posiciones por competición/temporada.
- Resumen: vista de plantel/cuadro por partido.

**No verificado en profundidad**: el layout exacto de la ficha de un partido individual (fecha,
hora, estadio, árbitros, alineaciones completas) — se infiere de los datos ya vistos en otros módulos
(los `equipo=` en las URLs de campaña sí muestran el número de partido/año, pero no se abrió una
ficha de partido individual dedicada durante esta pasada).

## 5. Jugadores

Submenú real: **Buscar Jugador, Goleadores**.

- **Buscar Jugador**: formulario real con **Nombre, Apellido Paterno, Apellido Materno** (campos
  separados, respetando la convención chilena de doble apellido) + rango de años. Resultados: tabla
  con **Puesto, Nacionalidad, Nombre, Ape. Paterno, Ape. Materno** + enlace "Ver Info".
  - **Verificado con datos reales**: búsqueda "Salas" 1990-2005 devolvió 8 jugadores reales
    distintos con ese apellido, incluyendo **José Marcelo Salas Melinao** (el histórico delantero de
    la selección chilena).
- **Ficha de jugador ("Historial ... Como Jugador")**: tabla real **AÑO | Campeonato | Equipo | PJ |
  PG | PE | PP | TR | Gol Anotado | Gol Recibido**, una fila por campaña — **el mismo jugador puede
  tener distintos EQUIPOS en distintas filas de la misma tabla** (confirma que un jugador no se
  duplica al cambiar de club, exactamente el modelo que ya tiene LeagueCore vía
  `player_team_history`).
  - **Verificado con datos reales**: historial real de Marcelo Salas 1990-2005 — Clasificatorias
    Conmebol con Chile, Copa Sudamericana y Torneo Clausura 2005 con Universidad de Chile, todo en
    la misma ficha.
- **Goleadores**: ranking histórico de goleadores (mismo patrón de filtros equipo/años/límite que
  el resto de los rankings, ver §10).

## 6. Torneos y Temporadas

No existe un módulo separado llamado "Torneos"/"Temporadas" en el menú — el concepto está integrado
dentro de **Equipos → Historial** (columna "Campeonato" + filtro "cate"/"camp" no explorado a fondo)
y dentro de **Partidos → Tablas**. La relación real confirmada es:

```
Equipo (entidad única, nunca duplicada)
  → Campaña (fila = Año + Campeonato, ej. "2024 Torneo Oficial Primera A")
      → Partidos de esa campaña
          → Jugadores que participaron (vía Jugador → ficha, columna "Equipo" por fila)
```

Esto coincide, en estructura, con el modelo ya corregido de LeagueCore (`season_teams` como fuente
única de participación, sin duplicar el club) — **no hay ninguna sorpresa aquí que obligue a
rediseñar el modelo de datos de LeagueCore**, sólo a construir vistas de consulta nuevas.

## 7. Técnicos

Submenú real: **Historial, Con Jugador, Con Equipo** — confirma exactamente los cruces que pedía el
usuario verificar. No se profundizó en el contenido de cada uno (mismo patrón de formulario que el
resto del sistema es razonable de esperar, pero no se verificó el layout exacto de resultados).

## 8. Árbitros

Submenú real: **Historial, Con Jugador, Con Equipo** — mismo patrón que Técnicos. No se profundizó
en el contenido.

## 9. Estadios

Submenú real: **Historial, Partido Estadio, Equipo Estadio, Jugador Estadio, Técnico Estadio** — 5
cruces reales confirmados por el menú (más que los 3 que mencionaba el sitio público). No se
profundizó en el contenido de cada uno.

## 10. Público

Módulo dedicado a **asistencia de público**, no encontrado en el sitio público. Submenú real: **Por
Equipo, Por Estadio, Por Años**. Confirma que la asistencia (`attendance` en LeagueCore) se trata
como un dato de primera clase con reportes propios, no sólo un campo suelto del partido.

## 11. Rankings

**Corrección importante sobre la cifra pública**: el sitio de marketing menciona "penales,
goleadores, arqueros, tarjetas, presencias, autogoles y más" — pero **el menú real de la aplicación
sólo tiene 5 rankings**, ni más ni menos:

1. **Penales** — ranking de jugadores por goles de penal convertidos. Filtros reales: Equipo
   (opcional), Año Inicio, Año Fin, "Mostrar los Primeros: N Registros" (10/20/40/60/80/Todos).
   Columnas de resultado: Pos, Puesto, Nacionalidad, Nombre (clic abre ficha completa en popup),
   cant, "Ver Detalle". **Verificado con datos reales**: líder histórico real "Juan Antonio Quiroga
   Rojas" con 47 goles de penal, seguido de Esteban Paredes (42) y Oscar Fabbiani (41) — todos
   jugadores chilenos reales y verificables.
2. **Goleadores** — mismo patrón de filtros/columnas, ranking de goles totales.
3. **Tarjetas** — mismo patrón, ranking de tarjetas (no se especificó si separa amarillas/rojas).
4. **Autogoles** — mismo patrón, ranking de autogoles.
5. **Mas Campeones** — **hallazgo real que corrige mi suposición anterior**: NO es un ranking de
   equipos con más títulos. Es un **ranking de JUGADORES por cantidad de campeonatos ganados en su
   carrera** ("Ranking de Nº de Campeonatos de Todos los Equipos", pero las filas son personas).
   **Verificado con datos reales**: líderes con 8 campeonatos cada uno (Rodrigo Meléndez Araya,
   David Henríquez Espinoza, ambos jugadores chilenos reales).

**"Arqueros" y "Presencias" NO existen como rankings separados** en la aplicación real, pese a
estar mencionados en el sitio público — o el sitio de marketing está desactualizado, o esas métricas
están dentro de otro ranking sin nombre propio. No se pudo determinar cuál de las dos.

## 12. Estadísticas

No hay un módulo "Estadísticas" separado — las estadísticas agregadas viven distribuidas dentro de
cada ficha (resumen de campaña, comparador de equipos, rankings). El patrón de filtros (equipo,
rango de años, tipo de partido/fase) se repite consistentemente en todos los módulos.

## 13. Reportes

No hay un módulo "Reportes" con ese nombre. La única capacidad de exportación real confirmada es
**"generar xml"**, disponible al menos en el detalle de campaña de equipo — genera un XML de la
consulta filtrada actual. No se confirmó si existe también exportación a Excel/PDF en otras
pantallas.

## 14. Buscadores

Confirmados dos buscadores reales con formulario propio: **Buscar Jugador** (nombre + apellido
paterno + apellido materno por separado, rango de años) y **Buscar Partido**/**Paralelos** (por
selección de uno o dos equipos). No hay un buscador global único que cruce todas las entidades a la
vez (a diferencia del `/search` global que ya tiene LeagueCore).

## 15. Filtros

Filtro real recurrente en casi todos los módulos: **Equipo, Año Inicio, Año Fin**, y un filtro
adicional **"tipo_partido"** (fase/tipo de partido) con valores reales confirmados: Normal, Liguilla
Libertadores, Liguilla Descenso, Campeonato Segunda Fase, Octavos/Sextos/Cuartos de Final, Semi
Final, Final, Especial, Torneo Metropolitano, Torneo Provincial, Repechaje, Torneo de Honor, Liguilla
de Promoción, Liguilla por el Título, Liguilla por el Descenso, Definición de Título, Serie A, Serie
B, Interseries. Los rankings agregan además un límite de resultados ("Mostrar los Primeros: N").

## 16. Cruces de información — lista real (no la cifra de marketing)

Confirmados por menú real + verificación de contenido donde se indica:

- Equipo ↔ Equipo (comparador "Paralelos" — **verificado con datos reales**)
- Equipo → Campaña → Partidos (Historial — **verificado con datos reales**)
- Jugador → Equipo → Campaña (ficha de jugador — **verificado con datos reales**, Marcelo Salas)
- Jugador → Campeonatos ganados (ranking Mas Campeones — **verificado con datos reales**)
- Jugador → Penales/Goles/Tarjetas/Autogoles (rankings — **verificado con datos reales** para
  Penales)
- Técnico ↔ Jugador, Técnico ↔ Equipo (menú confirmado, contenido no profundizado)
- Árbitro ↔ Jugador, Árbitro ↔ Equipo (menú confirmado, contenido no profundizado)
- Estadio ↔ Partido, Estadio ↔ Equipo, Estadio ↔ Jugador, Estadio ↔ Técnico (menú confirmado,
  contenido no profundizado)
- Público (asistencia) por Equipo, por Estadio, por Año (menú confirmado, contenido no profundizado)

No se llegó a contar ni verificar la cifra real de "50+ cruces" — la lista de arriba (9 categorías
de cruce, varias con múltiples variantes) es lo real y verificado, no una cifra de marketing.

## 17. Modelo conceptual (inferido de la navegación real, no de su base de datos interna)

```
Equipo (entidad única global)
  ── participa en ──> Campaña (Equipo × Año × Campeonato)
                          ── contiene ──> Partido
                                            ── tiene ──> Jugadores (con equipo real de ese partido)
                                            ── tiene ──> Técnicos
                                            ── tiene ──> Árbitro
                                            ── ocurre en ──> Estadio
                                            ── genera ──> Incidencias (Gol de Juego, Gol de Penal,
                                                          Autogol, Tarjeta Roja, Penal Atajado,
                                                          Penal Desviado, ...)
Jugador (entidad única global) ── historial de campañas con distintos equipos (nunca duplicado)
Técnico (entidad única) ── historial de campañas con distintos equipos
Árbitro (entidad única) ── historial de partidos dirigidos
Estadio (entidad única) ── historial de partidos/equipos/jugadores/técnicos que pasaron por ahí
```

Esto es **estructuralmente equivalente al modelo que LeagueCore ya tiene** (competición/temporada/
equipo/jugador/partido/oficial/entrenador/estadio, con `season_teams`/`player_team_history` como
fuente única de participación) — la diferencia real está en las VISTAS DE CONSULTA construidas
encima de ese modelo, no en el modelo en sí.

## 18. Comparación con LeagueCore

| Funcionalidad | Registro Fútbol (verificado) | LeagueCore | Estado | Recomendación |
|---|---|---|---|---|
| Historial de campañas por equipo (año×competición, con PJ/PG/PE/PP/GF/GC) | Confirmado con datos reales | Derivable de `season_teams`+`matches` filtrados, pero sin una vista consolidada "todas las campañas de este club, todas las competiciones, un año por fila" | **EXISTE PERO FALTA AMPLIAR** | Construir una vista de "campañas" en `TeamDetailPage` que agregue por año+competición en una sola tabla, con resumen de goleadas/incidencias por campaña. |
| Comparador equipo vs equipo | Confirmado con datos reales (243 partidos Colo Colo-U. de Chile) | `HeadToHeadView.tsx`/`ComparePage.tsx` ya real | **YA EXISTE** | Ninguna — LeagueCore ya lo tiene, con calidad comparable. |
| Ficha de jugador con historial multi-club real | Confirmado con datos reales (Marcelo Salas) | `PlayerDetailPage` ya con historial real por temporada (ampliado recientemente con selector de período) | **YA EXISTE** | Ninguna. |
| Ranking de goles de penal convertidos | Confirmado con datos reales (top real de la historia chilena) | `dbo.goals.penalty` existe como columna, sin ranking agregado propio | **EXISTE PERO FALTA AMPLIAR** | Agregar `TopListCard` de "penales convertidos", mismo patrón que goleadores. |
| Ranking "Mas Campeones" (jugador por títulos ganados) | Confirmado con datos reales | No existe ningún registro de "título ganado" a nivel de jugador ni de equipo | **NO EXISTE** | Requiere primero un registro explícito de campeón de temporada (ver v55/§18 anterior de este mismo doc en versión previa), y luego derivar qué jugadores participaron en esa campaña ganadora. |
| Incidencias "Penal Atajado" / "Penal Desviado" como tipos distintos | Confirmado con datos reales (ambos con conteos propios en el comparador) | `penalty_kicks` sólo existe para tandas de penales (shootout), no para penales durante el partido regular | **NO EXISTE** | Evaluar si vale la pena distinguir penal-atajado/penal-desviado como su propio tipo de incidencia en el timeline de partido regular (hoy sólo hay "gol" con flag `penalty`, no el resultado de un penal fallado/atajado). |
| Módulo de asistencia de público (por equipo/estadio/año) | Confirmado por menú real | `matches.attendance` existe como campo suelto, sin reporte agregado | **EXISTE PERO FALTA AMPLIAR** | Agregar un reporte de asistencia agregada por equipo/estadio/temporada, dato ya real y cargado. |
| Cruces Técnico↔Jugador, Técnico↔Equipo, Árbitro↔Jugador, Árbitro↔Equipo | Confirmado por menú real, contenido no profundizado | Ninguno de los 4 existe hoy (no hay ficha de Técnico en absoluto; `OfficialDetailPage` no cruza con jugadores/equipos) | **NO EXISTE** | Ya identificado en la ronda anterior de este mismo documento: construir `CoachDetailPage`; ampliar `OfficialDetailPage` con estos cruces. |
| Cruces Estadio↔Equipo, Estadio↔Jugador, Estadio↔Técnico | Confirmado por menú real (Estadio↔Partido ya lo tenía LeagueCore) | `VenueDetailPage` sólo muestra partidos jugados ahí | **EXISTE PERO FALTA AMPLIAR** | Ya identificado en la ronda anterior: ampliar `VenueDetailPage` con listas derivadas de equipos/jugadores/técnicos. |
| Exportación XML de cualquier consulta filtrada | Confirmado (botón real "generar xml") | LeagueCore exporta a XLSX (Reportes de Competición, algunos CSV) pero no XML genérico por consulta | **NO APLICA / diferir** | No es prioritario replicar el formato XML específico — la capacidad de exportar CUALQUIER vista filtrada (no sólo reportes predefinidos) es la idea de fondo a evaluar, no el formato XML en sí. |
| Filtro de fase/tipo de partido (Octavos, Cuartos, Semifinal, Liguilla, etc.) | Confirmado, lista real de ~19 valores | `matches.phase` es texto libre, sin catálogo cerrado ni filtro dedicado en las pantallas de estadísticas | **EXISTE PERO FALTA AMPLIAR** | Considerar un catálogo cerrado de fases (similar al de Registro Fútbol) si se quiere filtrar estadísticas por fase de forma consistente. |
| Buscador de jugador por Nombre/Apellido Paterno/Apellido Materno por separado | Confirmado, formulario real | LeagueCore busca por nombre completo, sin separar apellido paterno/materno | **NO APLICA** | Bajo impacto — LeagueCore ya cubre la búsqueda funcionalmente, la convención de doble apellido separado es una decisión de UX menor, no una capacidad faltante. |

## 19. Funcionalidades que faltan (confirmadas con datos reales esta vez, no supuestas)

1. Vista consolidada de "campañas por equipo" (año×competición en una sola tabla, con resumen de
   incidencias por campaña).
2. Ranking de penales convertidos, autogoles, tarjetas — mismos datos que goleadores/asistencias,
   sólo falta la vista agregada.
3. Comparador de equipos ya existe (no es una funcionalidad faltante — corrección de la ronda
   anterior).
4. Ficha de Técnico con historial + cruces con jugador/equipo (ya identificado antes, ahora con
   evidencia real de que Registro Fútbol sí lo tiene construido).
5. Cruces de Árbitro con jugador/equipo en su propia ficha (`OfficialDetailPage` sigue sin esto).
6. Cruces de Estadio con equipo/jugador/técnico (más allá de partidos, que ya existe).
7. Reporte agregado de asistencia de público por equipo/estadio/año.
8. Registro explícito de campeón de temporada +, a partir de ahí, un ranking de jugadores por
   títulos ganados (funcionalidad de dos pasos, la segunda depende de la primera).
9. Considerar "Penal Atajado"/"Penal Desviado" como incidencias propias del partido regular (hoy
   sólo existen para tandas de penales de desempate).

## 20. Recomendaciones

- Ningún hallazgo de esta auditoría obliga a rediseñar el modelo de datos de LeagueCore — la
  arquitectura ya elegida (equipos globales, `season_teams`, `player_team_history`) es
  estructuralmente equivalente a lo que Registro Fútbol expone.
- El trabajo real pendiente es mayormente de VISTAS DE CONSULTA nuevas sobre datos que, en su
  mayoría, ya existen en el esquema de LeagueCore (goleadores/tarjetas/autogoles/asistencia) — bajo
  esfuerzo relativo.
- Las dos excepciones que sí requieren algo nuevo en el modelo: (a) un registro explícito de "campeón
  de temporada" (hoy no existe ni siquiera como derivado guardado), y (b) decidir si vale la pena
  trackear penales fallados/atajados durante el partido regular, no sólo en tandas de desempate.
- La ficha de Técnico es la ausencia más notoria — Registro Fútbol la trata con el mismo nivel de
  detalle que Jugadores/Árbitros, LeagueCore hoy no tiene nada equivalente.

---

## Cierre

A diferencia de la primera versión de este documento (basada sólo en el sitio público, con la
mayoría del contenido marcado "NO VERIFICADO"), esta versión está construida sobre un recorrido real
y autenticado de la plataforma, con varios hallazgos verificados contra datos históricos reales y
verificables del fútbol chileno (Marcelo Salas, Esteban Paredes, Colo Colo vs Universidad de Chile,
etc.). Dos suposiciones de la primera versión quedaron **corregidas** con evidencia real: "Paralelos"
no es una categoría de club, es un comparador equipo-vs-equipo; y "Mas Campeones" no es un ranking de
equipos, es un ranking de jugadores por títulos ganados personalmente.

Quedan sin profundizar (mencionados por el menú real pero sin verificar su contenido exacto):
Técnicos → Con Jugador/Con Equipo, Árbitros → Historial/Con Jugador/Con Equipo, y los 4 cruces de
Estadios más allá de Partido Estadio. Ninguno de estos cambia la comparación de la sección 18, sólo
falta confirmar el layout exacto de sus resultados si se necesita para el diseño detallado de la
fase de integración.

**No se modificó ningún archivo de código, base de datos, ni configuración de LeagueCore en esta
fase.** **No se modificó ningún dato de Registro Fútbol** — sólo se realizaron búsquedas/consultas de
lectura, con la sesión cerrada correctamente al finalizar.
