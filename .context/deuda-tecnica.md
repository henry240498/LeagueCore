# Deuda técnica — estado

> Backlog de mejoras del sistema **fuera** del Match Center (que está cerrado, ver
> [match-center-plan.md](match-center-plan.md)). Actualizado: 2026-09-22.

## ✅ Resuelto

| Tema | Qué se hizo |
|---|---|
| **JWT_SECRET con default público** | `resolveJwtSecret()` centraliza el secreto y **lanza en producción** si falta (antes caía a `dev-secret-change-me`, que está publicado en el repo → cualquiera podía firmar tokens de admin). Falla al **arrancar**, no en el primer login. Tests en `auth/jwt-secret.spec.ts`. |
| **Sin cabeceras de seguridad** | `helmet` en `main.ts` (con `crossOriginResourcePolicy: cross-origin` para que `/uploads` siga sirviendo imágenes al frontend). |
| **Login sin rate limiting** | `@nestjs/throttler`: 300 req/min global (el polling del Match Center hace ~30/min, no molesta) y **10/min en `POST /auth/login`** contra fuerza bruta. |
| **Sin CI** | `.github/workflows/ci.yml`: en push y PR a `main`, jobs paralelos backend (build + jest) y frontend (tsc+vite build, vitest, oxlint). Cachea npm y cancela corridas viejas. |
| **Pantalla en blanco ante error de render** | `ErrorBoundary` global en `main.tsx` con reintentar / volver al inicio. Test propio. |
| **Sesión vencida sin manejo global** | `api.ts` notifica los 401 a un handler; `AuthContext` limpia el usuario y `ProtectedRoute` redirige al login (antes cada pantalla mostraba su error suelto). |
| **Tests flaky** | `PlayerProfilePage` y `MatchVideoTab` usaban mocks de `fetch` **por orden de llamada**; los requests salen de efectos distintos con orden no determinista, así que cada uno recibía el cuerpo del otro. Ahora mockean **por URL**. `MatchVideoTab` además necesitaba `waitFor` con timeout explícito (la cadena listar→seleccionar→sync supera 1s con la suite en paralelo). Suite estable 6/6 corridas. |
| **`useMatchLive` sin tests** | 5 casos: carga, minuto derivado en vivo, sin minuto fuera de vivo, desconexión sin datos basura, tolerancia a fallos de endpoints secundarios. |
| **Fallos de red invisibles** | El frontend descarta el error en ~130 llamadas (`.catch(() => {})` o caída a estado vacío): con la API caída el usuario sólo veía secciones vacías, sin distinguir "no hay datos" de "falló". Se resolvió en **un solo punto** (`api.ts`, por donde pasan todas las peticiones) + `GlobalErrorToasts`, **sin tocar ningún call site**. Sólo avisa fallos de red y 5xx; los 4xx son respuestas esperadas del negocio. |
| **Emojis sin texto accesible** | Los decorativos pasan a `aria-hidden`; los que comunican información (cabeceras de tarjetas, columna de selección, indicadores de amarilla/roja/sustitución) reciben `aria-label`. |

## 🔍 Auditado y descartado (con evidencia)

| Tema | Hallazgo |
|---|---|
| **Inyección SQL por `ORDER BY` dinámico** | 8 servicios interpolan `ORDER BY`. **Los 8 son seguros**: 5 usan whitelist `SORTABLE_COLUMNS` + `sortDir` ternario que sólo produce `ASC`/`DESC`; `stats.service` recibe el `orderBy` por parámetro pero sus 3 llamadas pasan literales. Ningún input de usuario llega al SQL. |
| **Accesibilidad general** | 0 imágenes sin `alt`; los formularios usan `<label>` vía el componente `Field`. Estaba mejor de lo esperado. |
| **Filtro global de excepciones** | Nest ya devuelve `500 Internal server error` genérico: **no hay fuga** de detalles SQL. El valor restante era sólo logging. |

## ⏳ Pendiente (decisión del equipo, no bloqueante)

| Tema | Por qué no se hizo |
|---|---|
| **Contraseña sembrada `admin/123456`** | Es el mayor riesgo práctico que queda, sobre todo con el túnel abierto. **No se cambió unilateralmente** porque altera el flujo de trabajo de Henry. Recomendación: cambiar la contraseña de `admin` (o crear otro administrador y desactivar ese) antes de compartir el enlace remoto. Ya advertido en `DEV_TOOLS_QUITAR_ANTES_DE_RELEASE.md`. |
| **Cobertura de tests** | Backend ~18 specs / 179 fuentes, frontend 13 / 141. Se cubrió lo crítico nuevo; subirla en general es trabajo abierto, mejor por módulo y con criterio. |
| **React Query / Swagger / logging estructurado** | Postergados explícitamente. React Query es un refactor grande y transversal del fetching; Swagger y el logger son valiosos pero no urgentes. |
| **Filtro global de excepciones** | Se evaluó: Nest ya devuelve `500 Internal server error` genérico ante errores no controlados, así que **no hay fuga** de detalles SQL. El valor restante sería sólo de logging → baja prioridad. |
| **~20 warnings `set-state-in-effect` (oxlint)** | Preexistentes y repartidos por todo el frontend. Corregirlos es churn amplio sin beneficio funcional; el lint sale 0 (son warnings, no errores). |
| **`MatchDetailPage.tsx` ~1400 líneas** | Sólo conviene extraer con responsabilidad real (ya se hizo con el Match Center). Trocear por reducir líneas fue descartado a propósito. |

## 📋 Candidatos identificados, no ejecutados

| Tema | Estado / por qué |
|---|---|
| **Listados sin paginación** | 6 catálogos user-facing (clubes, competiciones, entrenadores, estadios, scouting, operativa) hacen `SELECT *` sin `OFFSET/FETCH`. Las tablas grandes (partidos, jugadores, oficiales) **sí** paginan. Hoy son catálogos acotados, así que es especulativo; agregarlo cambia contratos de API y el frontend. Revisar si el motor de importación histórica hace crecer alguna. |
| **Fetching sin abstracción compartida** | Cada pantalla reimplementa loading/error/empty con `useEffect` + `useState`. La solución correcta es una abstracción compartida (React Query o un hook propio) — refactor transversal, postergado a propósito. El aviso global mitiga el síntoma más grave. |

## Verificación al cierre (2026-09-22)
- Backend: `nest build` 0 · `jest` **105/105** (18 suites).
- Frontend: `tsc -b` 0 · `vite build` 0 sin warnings · `vitest` **46/46** · `oxlint` 0.
