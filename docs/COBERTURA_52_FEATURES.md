# Cobertura — 52 features pedidas vs. construido

Leyenda: ✅ construido · 📐 diseño documentado (requiere infra externa).

| # | Feature | Estado | Dónde |
|---|---------|--------|-------|
| 1 | Gestión de clubes multi-equipo + staff + historial + identidad | ✅ | Mig 049, `clubs`, `/clubes` |
| 2 | Expediente del jugador (datos, contrato, rendimiento) | ✅ | Mig 050, `/jugadores/:id/expediente` |
| 3 | Perfil físico + GPS/wearables | ✅ | `player_physical_records` (fuente gps/wearable), Fase 2 |
| 4 | Perfil técnico 1–100 + radar | ✅ | `player_technical_ratings` (21 atributos), `StatRadar` |
| 5 | Análisis táctico (formaciones por fase, bloque, presión, salida) | ✅ | Mig 051, pestaña 📐 del partido |
| 6 | Pizarra táctica interactiva | ✅ | `TacticalBoard`, `/jugadas` |
| 7 | Análisis de posesiones | ✅ | `match_possessions` |
| 8 | Análisis por zonas | ✅ | `deriveZone` (tercios × carriles) + mapa de tiros por zona |
| 9 | Mapas (heat/pass/shot/touch…) | ✅ | `GET /insights/matches/:id/maps` (calor real de `match_player_positions` + tiros), sección 🗺️ en Táctica avanzada |
| 10 | Análisis de tiros + xG | ✅ | `shots` + `goals`, `/tactics/.../shot-map` |
| 10 | Análisis de tiros + xG | ✅ | `shots` + `goals`, `/tactics/.../shot-map` |
| 11 | Balón parado | ✅ | `match_set_pieces` + variantes |
| 12 | Jugadas preparadas (biblioteca) | ✅ | `tactical_plays`, `/jugadas` |
| 13 | Video analysis (timeline, marcas, clips, velocidades) | ✅ | Mig 052, pestaña 🎬, 0.25x–2x |
| 14 | Sync estadística + video | ✅ | `GET /video/matches/:id/sync` |
| 15 | Etiquetado de video | ✅ | `video_tags` + 14 por defecto |
| 16 | Scouting de rivales (expediente) | ✅ | `rival_profiles`, `/scouting/rivales` |
| 17 | Informe del rival | ✅ | Generador auto + `rival_reports` |
| 18 | Scouting de jugadores (filtros) | ✅ | `GET /scouting/players` (edad, posición, pie, goles, técnica…) |
| 19 | Comparador con radar | ✅ | `/comparador` existente + `GET /scouting/compare` |
| 20 | Sistema de scouting (informe + recomendación) | ✅ | `scouting_reports` (FICHAR/SEGUIR/DESCARTAR, 1–10) |
| 21 | Lista de seguimiento | ✅ | `watchlist`, `/scouting/seguimiento` |
| 22 | Base de datos de rivales (historial auto) | ✅ | `GET /scouting/rivals/:id/history` (derivado) |
| 23 | Análisis histórico (preguntas) | ✅ | Historial + contexto + IA (`estado_marcador`: perdiendo/empatando/ganando por equipo y partido) |
| 24 | Análisis contextual (local/visita, resultado, minutos) | ✅ | `GET /operations/teams/:id/context` |
| 25 | Análisis de sustituciones + impacto | ✅ | `GET /operations/matches/:id/sub-impact` |
| 26 | Análisis de árbitros | ✅ | `GET /operations/referees` + `RefereesReportPage` existente |
| 27 | Análisis disciplinario + riesgo | ✅ | `GET /operations/discipline` (⚠️ con 3+ amarillas) |
| 28 | Motor de métricas personalizadas | ✅ | `custom_metrics` + evaluador seguro, `/metricas` |
| 29 | Eventos personalizados | ✅ | `custom_event_types` + `match_custom_events` |
| 30 | Motor de reportes | ✅ | `report_templates` + generador Markdown + descarga, `/reportes/plantillas` (partido/jugador/equipo) |
| 31–34 | Dashboards (director/entrenador/analista/jugador) | ✅ | `GET /operations/overview` + `/operativa` (filtrable por equipo/jugador) |
| 35–36 | Objetivos individuales/colectivos | ✅ | `player/team_objectives`, `/entrenamientos` |
| 37–38 | Entrenamientos + biblioteca de ejercicios | ✅ | `trainings`, `training_exercises`, `/entrenamientos` |
| 39 | Asistencia y disponibilidad | ✅ | `training_attendance` + disponibilidad en expediente |
| 40–42 | IA (resumen, scouting NL, táctica NL, lenguaje natural) | ✅ | Fase 7: `/asistente`, 11 intents + resumen + tendencias (por reglas, sin LLM externo) |
| 43 | Alertas | ✅ | `alerts` + chequeo por reglas, `/operativa` |
| 44 | Auditoría profesional | ✅ | `audit_log` existente + `AuditReportPage` |
| 45 | Multiusuario y permisos (10 roles) | 📐 | Vigente: solo `admin`/`basico` (decisión explícita mig 028). No se crean roles nuevos |
| 46 | API para integraciones | ✅ | API REST existente (clubes, expediente, táctica, video, scouting, operaciones, IA) |
| 47 | App móvil | 📐 | El modo live es responsive (tablet/celular); app nativa requiere proyecto móvil aparte |
| 48 | Modo tablet | ✅ | Live + pizarra + tablas responsive; polling 10 s multi-dispositivo |
| 49 | Modo dos operadores | ✅ | Mismo partido editable desde 2+ dispositivos (DB compartida + polling) |
| 50 | Sincronización entre dispositivos | ✅ | Vía API + polling (sin websockets; tiempo real blando) |
| 51 | Etiquetas/categorías ilimitadas | ✅ | `custom_event_types`, `video_tags`, `training_exercises.category` |
| 52 | Marketplace SaaS | 📐 | Requiere multi-tenant, facturación y legal; fuera del alcance on-premise actual |

Migraciones nuevas: 049–056. Módulos backend nuevos: `clubs`, `tactics`, `video`, `scouting`, `operations`, `ai`, `insights`.
