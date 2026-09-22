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

## ⏳ Pendiente (decisión del equipo, no bloqueante)

| Tema | Por qué no se hizo |
|---|---|
| **Contraseña sembrada `admin/123456`** | Es el mayor riesgo práctico que queda, sobre todo con el túnel abierto. **No se cambió unilateralmente** porque altera el flujo de trabajo de Henry. Recomendación: cambiar la contraseña de `admin` (o crear otro administrador y desactivar ese) antes de compartir el enlace remoto. Ya advertido en `DEV_TOOLS_QUITAR_ANTES_DE_RELEASE.md`. |
| **Cobertura de tests** | Backend ~18 specs / 179 fuentes, frontend 13 / 141. Se cubrió lo crítico nuevo; subirla en general es trabajo abierto, mejor por módulo y con criterio. |
| **React Query / Swagger / logging estructurado** | Postergados explícitamente. React Query es un refactor grande y transversal del fetching; Swagger y el logger son valiosos pero no urgentes. |
| **Filtro global de excepciones** | Se evaluó: Nest ya devuelve `500 Internal server error` genérico ante errores no controlados, así que **no hay fuga** de detalles SQL. El valor restante sería sólo de logging → baja prioridad. |
| **~20 warnings `set-state-in-effect` (oxlint)** | Preexistentes y repartidos por todo el frontend. Corregirlos es churn amplio sin beneficio funcional; el lint sale 0 (son warnings, no errores). |
| **`MatchDetailPage.tsx` ~1400 líneas** | Sólo conviene extraer con responsabilidad real (ya se hizo con el Match Center). Trocear por reducir líneas fue descartado a propósito. |

## Verificación al cierre (2026-09-22)
- Backend: `nest build` 0 · `jest` **105/105** (18 suites).
- Frontend: `tsc -b` 0 · `vite build` 0 sin warnings · `vitest` **41/41** · `oxlint` 0.
