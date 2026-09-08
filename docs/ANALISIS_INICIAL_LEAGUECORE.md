# Informe de Análisis Inicial — LeagueCore

**Etapa:** 0 — Análisis y comprensión (sin desarrollo)
**Fecha:** 2026-08-19
**Autor:** Claude (análisis de material existente)
**Estado:** Pendiente de aprobación del usuario + de un insumo crítico faltante (ver §0)

Este informe responde al pedido de análisis previo al desarrollo de **LeagueCore**. No se ha creado
código de producción, tablas, APIs ni componentes. Se realizaron únicamente lecturas de los
documentos provistos y verificaciones puntuales (hexdump de archivos reales, confirmación de rutas)
para separar lo que está **verificado**, lo que es **afirmado sin verificar** por el análisis previo, y lo
que es **inferencia propia** pendiente de confirmación.

### Historial de actualizaciones

- **2026-08-19 (v1):** Informe inicial basado en el material de `/Archivos` (Ltrack) + instrucciones
  de infraestructura (SQL Server, ubicación del proyecto).
- **2026-08-19 (v2):** Incorpora el requisito arquitectónico adicional "Web + futura app" (web
  responsive desde el inicio, arquitectura API-first, preparación para multi-cliente, evaluación PWA).
  Ver §8 (reescrito), §7, §11 y §12 (actualizados).
- **2026-08-19 (v3):** Primer arranque de infraestructura (a pedido explícito del usuario, sin esperar
  el texto de requisitos funcionales aún pendiente): se creó la base `LeagueCore` en SQL Server
  (collation `Modern_Spanish_CI_AS`) y un esqueleto mínimo backend/frontend siguiendo §8 (NestJS +
  TypeScript + `mssql` en `src/backend`; React + Vite + TypeScript + Tailwind v4 en `src/frontend`),
  con un endpoint `/api/v1/health` que confirma la cadena Web → API → SQL Server. Se agregó
  `start.bat` en la raíz del repo + un acceso directo `LeagueCore.lnk` en el Escritorio para levantar
  ambos servidores con un doble clic. **Hallazgo importante:** este equipo ya corre otro proyecto
  ("SIGBO") con backend en el puerto 3001 y frontend en el 3000 — el backend de LeagueCore se movió
  al puerto **4001** para no chocar. El backend recomendado (NestJS) se usó por default al no haber
  objeción del usuario, pero sigue siendo una decisión abierta a revisar (§12.3) si en algún momento
  se prefiere .NET.
- **2026-08-19 (v4):** Fase 1 (diseño de datos) ejecutada. Esquema T-SQL creado en `LeagueCore`
  (`database/migrations/001_create_core_tables.sql`, `002_create_standings_view.sql`): 10 tablas +
  vista `standings`, adaptando el modelo de §4 con `substitutions` y `penalty_misses` agregadas
  (funcionalidades confirmadas en §2 que faltaban en el modelo heredado) y una tabla `users` mínima
  para el auth por token de §8.1. Probado con datos temporales (insert + rollback): la vista de
  posiciones calcula PJ/PG/PE/PP/goles/diferencia/puntos correctamente. **Hallazgo crítico para la
  Fase 2:** `sqlcmd` corrompe `Ñ`/tildes si no se lo invoca con `-f 65001` (UTF-8) — no es un
  problema de collation, es de lectura del archivo `.sql`. Documentado en
  `database/migrations/README.md`; **toda** carga de datos reales de Ltrack en Fase 2 debe usar ese
  flag o los nombres de equipos/jugadores quedarán corruptos.
- **2026-08-19 (v5):** Confirmado por el usuario: **idioma español/castellano para todo el sistema**
  (§12.6 resuelto). Se interpreta como idioma de UI/mensajes — los identificadores internos de
  código/base de datos siguen en inglés (convención técnica separada, invisible para el usuario; si
  se quiere español también ahí, avisar).
  Sprint de **Seguridad + Menú + Dashboard** completado, a partir de una especificación que trajo el
  usuario escrita por un agente anterior para un stack distinto (SQLite + Express + JS plano con JWT
  en localStorage). Se adaptó a la arquitectura real del proyecto, con estas decisiones/desvíos
  documentados:
  - Esquema `dbo.users` extendido (migraciones 003/003b) + tablas `sessions` y `audit_log`
    (migración 004): login por `username` (no email), bloqueo tras 5 intentos fallidos (15 min),
    contraseña temporal forzada en primer login, auditoría de login/logout/cambios de contraseña.
  - **Desvío deliberado de la spec:** el JWT no se guarda en `localStorage` (la propia spec original
    se contradecía: lo hacía en el código de ejemplo pero lo prohibía en su checklist de seguridad).
    Se implementó con cookie `httpOnly` para el cliente web + el token también devuelto en el body
    (para que un futuro cliente no-browser lo use como Bearer token) — consistente con la regla 2 de
    §8.1.
  - bcrypt → `bcryptjs` (evita compilación nativa en Windows). Rate limiting → contador en BD
    (`login_attempts`/`locked_until`), no una librería de rate-limit por IP. Jest (frontend) →
    Vitest (nativo de Vite, compatible con la API de Jest).
  - Dashboard reemplaza los datos de "actividad reciente" inventados de la spec original por un
    panel de estado real basado en conteos reales de la base (hoy en 0, porque los datos históricos
    de Ltrack todavía no se migraron).
  - **Hallazgo nuevo:** `sqlcmd` con `-Q` (modo inline) falla contra `dbo.users` por tener un índice
    filtrado, salvo que se agregue `SET QUOTED_IDENTIFIER ON` — no afecta a la app (el driver
    `mssql` de Node ya lo maneja bien). Documentado en `database/migrations/README.md`.
  - Probado extremo a extremo con navegador real (Playwright, no sólo compilación): login,
    bloqueo por intentos, cambio forzado de contraseña, cambio normal, reseteo, logout, y layout
    responsive en desktop y mobile (390px). Tests unitarios: 8 backend (Jest) + 2 frontend
    (Vitest), todos verdes. Usuario `admin`/`123456` sembrado, con cambio de contraseña obligatorio
    en el primer login.
- **2026-08-20 (v6):** Corrección y ampliación del módulo Login + Seguridad, a pedido del usuario
  tras reportar que el Login era ilegible y mostraba las credenciales como texto fijo.
  - **Bug real encontrado y corregido** (no era una cuestión de gusto): `index.css` tenía
    `color-scheme: light dark`, y los `<input>` no fijaban color de fondo/texto propio. Con el
    sistema operativo en modo oscuro, el navegador pintaba el texto del input en **blanco sobre
    fondo transparente** dentro de una tarjeta blanca → texto invisible. Confirmado con
    `getComputedStyle` antes y después del fix (capturas en el historial de la sesión). Se fijó
    `color-scheme: light` de forma explícita y ahora todos los inputs declaran su propio
    color/fondo — ya no depende de las preferencias del SO del usuario.
  - Se sacó por completo el texto "Usuario inicial: admin / Contraseña: 123456" del Login.
  - Se agregó mostrar/ocultar contraseña (ícono de ojo).
  - **Configuración del Login (Seguridad → Configuración del Login):** administrable desde la UI,
    sin tocar código — tabla `dbo.login_settings` (fila única, migración
    `005_create_login_settings.sql`; cada columna tiene su `DEFAULT`, así "restaurar valores
    predeterminados" es literalmente `SET columna = DEFAULT` en vez de duplicar los valores por
    default en el código). Cubre identidad (logo, título, subtítulo, mensaje de bienvenida, con
    toggles mostrar/ocultar), fondo (color/imagen/posición/tamaño/repetición/overlay), 10 colores,
    y textos del formulario (placeholders, texto del botón). Subida de logos/fondo con
    validación de formato y tamaño (2 MB), servidos como archivos estáticos desde
    `src/backend/uploads/login/` (no versionados en git). Vista previa en vivo reutilizando el
    mismo componente visual (`LoginVisual`) que usa el Login real — cambios en el formulario se
    reflejan al instante en la vista previa, sin guardar.
  - **Autorización real en el backend**, no sólo ocultar el link: `AdminOnlyGuard` nuevo, aplicado
    a `PUT/POST /settings/login*`. Probado con un usuario `viewer` de prueba: la API devuelve
    403, no sólo el frontend esconde el botón.
  - Menú principal ampliado: Inicio, Competiciones, Equipos, Jugadores, Partidos, **Estadísticas**
    (nueva), Reportes, **Seguridad** (ahora visible como ítem principal, no escondida en el
    dropdown, y sólo para rol admin). Dropdown de usuario reordenado: Mi perfil (página nueva,
    mínima) / Cambiar contraseña / Cerrar sesión.
  - **Bug de layout encontrado durante las pruebas** (no relacionado al pedido original): el fondo
    del Login no llenaba toda la pantalla en algunos viewports por una cadena de `min-height` sin
    una altura definida en los ancestros (`min-h-full` no resuelve porcentajes contra un padre que
    sólo tiene `min-height`). Corregido pasando la clase de altura como prop
    (`min-h-svh` en la página real, `h-full` en el panel de vista previa con altura fija).
  - Probado extremo a extremo con navegador real: contraste en modo claro/oscuro del SO (valores
    computados, no sólo capturas), flujo completo login → cambio forzado → dashboard → Seguridad →
    cambiar color/texto → ver vista previa reaccionar en vivo → guardar → **confirmar el cambio en
    una sesión de navegador completamente distinta** (prueba real de persistencia en backend, no
    sólo estado local) → restaurar valores predeterminados → subir y quitar una imagen real vía
    input de archivo → Mi perfil → cambiar contraseña → resetear → logout. Responsive verificado en
    1366×768, 390×844 y 375×812 (Login y el panel de configuración completo, ~25 campos, colapsan
    bien a una columna). Cuenta `admin` restaurada a su estado sembrado original al final
    (`123456`, cambio de contraseña pendiente) — no se dejaron datos de prueba residuales.
- **2026-08-20 (v7):** Roadmap de módulos compartido por el usuario (18 módulos, orden: Login+
  Seguridad → Configuración/Parametrización → Competiciones → Temporadas → Equipos → Jugadores →
  Árbitros/Oficiales → Partidos → Resultados → Clasificación → Estadísticas → Goleadores/tarjetas →
  Récords → Importación Ltrack → Query Builder → Reportes → Dashboard → Auditoría avanzada), con
  la recomendación explícita de NO construir Configuración/Parametrización todavía (diseñarla
  después, con lo que surja de Ltrack + requisitos) y de mantener Competiciones acotado a CRUD +
  navegación, sin inventar campos. Consultado el orden inmediato, se eligió terminar Login +
  Seguridad por completo antes de arrancar Competiciones. Se completó la única pieza que faltaba:
  **Sesiones activas** — `GET /api/v1/auth/sessions` (propias, no revocadas, no expiradas, marca
  cuál es la actual), `POST /api/v1/auth/sessions/:id/revoke` (sólo sesiones propias — probado que
  intentar revocar una ajena devuelve 404), `POST /api/v1/auth/sessions/revoke-others`. Probado con
  dos "dispositivos" (dos contextos de navegador) reales: revocar la sesión del dispositivo B desde
  el dispositivo A lo desloguea de verdad en la siguiente navegación. 4 tests unitarios nuevos
  (`src/backend/src/auth/sessions.spec.ts`), 12/12 tests totales en verde. **Con esto, Login +
  Seguridad queda completo** según los criterios de aceptación pedidos — el siguiente módulo a
  definir es Configuración/Parametrización (diseño, no desarrollo todavía) o Competiciones, a
  confirmar con el usuario.
- **2026-08-20 (v8):** El usuario reportó que al abrir el sistema saltaban varias ventanas de
  consola (backend, frontend, y una con error de puerto duplicado). Se rediseñó el lanzador:
  - `start.bat` ahora sólo delega a `scripts/start-hidden.vbs`, que arranca backend y frontend
    con `WshShell.Run(..., 0, False)` (ventana oculta, no bloqueante) y recién después abre el
    navegador — cero ventanas de consola visibles.
  - Salida de ambos procesos redirigida a `logs/backend.log` / `logs/frontend.log` (gitignorados
    vía el patrón `*.log` ya existente) — necesario porque, al ocultar las ventanas, ya no hay
    forma de ver errores a simple vista si algo falla.
  - Se agregó `stop.bat` (+ `scripts/stop.ps1`) para poder apagar la API y la Web liberando los
    puertos 4001/5173, ya que sin ventanas visibles no hay un Ctrl+C a mano.
  - El acceso directo del Escritorio (`LeagueCore.lnk`) se actualizó para apuntar directo a
    `wscript.exe` + el `.vbs` (no a `start.bat`), evitando incluso el parpadeo mínimo de la
    ventana del propio `.bat`.
  - **Causa raíz de las ventanas duplicadas/con error de puerto:** lanzamientos anteriores de
    prueba (varios a lo largo de la sesión) habían dejado árboles de procesos huérfanos vivos —
    `nest start --watch` y `vite` no mueren solos al matar sólo el proceso que escucha el puerto;
    hay que matar toda la cadena `cmd /k → npm run ... → nest/vite → hijo compilado`. Se hizo una
    limpieza completa verificando con `Get-CimInstance Win32_Process` + `ParentProcessId` cuáles
    PIDs pertenecían realmente a LeagueCore antes de matar nada (este mismo equipo corre otro
    proyecto, SIGBO, en paralelo — ver `project_sigbo_port_conflict` en memoria). Verificado tras
    la limpieza: exactamente 1 backend + 1 frontend, en los puertos correctos, cero ventanas
    visibles, SIGBO intacto.
- **2026-08-20 (v9):** El usuario notó que no había avance visible en Módulo 3 (Competiciones) ni
  Módulo 4 (Equipos) tras terminar Sesiones activas. Se aclaró que Módulo 2
  (Configuración/Parametrización) sigue diferido a pedido explícito del propio usuario, y se
  construyeron Competiciones y Equipos con el alcance que él mismo describió (CRUD + navegación
  preparada, sin inventar campos definitivos):
  - Esquema extendido: `competitions` (migración 006) y `teams` (migración 007) ganan los campos
    que el usuario propuso (descripción, tipo, estado, fechas, organización, logo, etc.) — **`tipo`,
    `deporte` y `estado` se guardan como texto libre, no como enum/CHECK constraint**, a propósito:
    son justo lo que el futuro Módulo 2 debería parametrizar, así que fijar una lista cerrada ahora
    hubiera invertido el orden que el usuario pidió.
  - Backend: CRUD completo (`src/backend/src/competitions/`, `src/backend/src/teams/`) — listar con
    búsqueda/filtro/orden, ver, crear, editar, activar/desactivar, eliminar. Eliminar une equipo
    con partidos, o una competición con equipos, devuelve un mensaje claro en vez de un error SQL
    crudo (se captura el código de violación de FK, 547). 8 tests unitarios nuevos, 21/21 en verde.
  - Frontend: listados con filtros, formularios de alta/edición, vista de detalle con navegación
    preparada (pestañas Temporadas/Jugadores/Partidos/Clasificación/Estadísticas/Reportes como
    "Próximamente" — sólo Información general y, dentro de una competición, Equipos están
    funcionales). La pestaña Equipos de una competición usa datos reales del módulo Equipos, no un
    placeholder — crear un equipo desde ahí lo asocia automáticamente a esa competición.
  - Probado con navegador real: crear competición → agregar equipo desde su pestaña → confirmar
    que aparece → listado global de equipos con el nombre de competición correcto → activar/
    desactivar → intento de borrado con datos asociados rechazado con mensaje claro.
  - **Nota operativa:** durante las pruebas, la cuenta `admin` compartida cambió de estado varias
    veces entre llamadas — evidencia de que alguien (probablemente el propio usuario) está
    probando la app en un navegador real en simultáneo. Se creó y usó un usuario descartable
    (`test_e2e`) para las pruebas automatizadas de esta sesión en vez de pelear por la cuenta
    compartida; se borró al terminar. Recomendación a futuro: no asumir que el estado de `admin`
    es estable entre pasos si la app está corriendo y accesible.
- **2026-08-20 (v10):** El fondo del Login ahora soporta **video**, además de color/imagen, a
  pedido del usuario — con recorte (inicio/fin en segundos) y opción de audio.
  - Esquema: `dbo.login_settings` gana `background_type` (color/image/video — este sí es un enum
    con CHECK constraint real, a diferencia de `competition_type`/`sport`/`status`, porque cada
    valor exige una forma de renderizado distinta en el frontend; no es un dato de negocio que el
    Módulo 2 vaya a parametrizar), `background_video_url`, `background_video_muted`,
    `background_video_start_seconds`, `background_video_end_seconds` (migración 008).
  - Backend: subida de video reutiliza el mismo endpoint de upload que las imágenes
    (`POST /settings/login/upload/:field`), con su propio límite de tamaño (30 MB vs 2 MB de
    imagen) y formatos (`MP4`/`WEBM`); subir un video nuevo resetea el recorte anterior (podía ser
    más largo que el video nuevo).
  - **Restricción técnica real, no arbitraria:** los navegadores bloquean el autoplay de video
    *con sonido* salvo que el usuario ya haya interactuado con la página — es política de Chrome/
    Firefox/Safari, no configurable. Por eso el video del Login **siempre arranca muteado**
    (autoplay confiable) y, si el admin activó "Reproducir con audio", se muestra un botón
    "🔇 Activar sonido" para que el visitante lo habilite con un clic — la única forma que
    realmente funciona.
  - El recorte se resuelve en el cliente (`LoginVisual`): al llegar al segundo de fin, vuelve al
    de inicio (loop dentro del rango), sin depender de que el archivo en sí esté recortado. El
    panel de configuración tiene un editor con vista previa nativa del video, botones "Usar
    posición actual" para fijar inicio/fin mientras se escuchan/miran, y "Probar recorte".
  - **Bug real encontrado y corregido durante la prueba** (no cosmético): el endpoint de upload
    persiste y devuelve el estado *completo* guardado en el servidor; el frontend hacía
    `setDraft(respuestaCompleta)`, lo que pisaba cualquier edición local todavía no guardada — en
    la práctica, elegir "Tipo de fondo: Video" en el desplegable y subir el archivo a continuación
    revertía la elección a "Color" porque el tipo nunca había llegado a guardarse antes del
    upload. Se corrigió fusionando sólo el campo subido en el draft local
    (`src/frontend/src/pages/LoginSettingsPanel.tsx`, `handleUpload`/`handleClearImage`) en vez de
    reemplazar todo el estado — se detectó probando el flujo real en navegador, no leyendo el
    código.
  - Probado de punta a punta con un video real generado con `canvas.captureStream()` +
    `MediaRecorder` (no había `ffmpeg` disponible): subida, recorte 1s–3s, activar audio, guardar,
    y confirmar en una sesión de navegador nueva que el Login real reproduce el video correcto,
    recortado, muteado, con el botón de sonido visible. 21/21 tests de backend siguen en verde.
- **2026-08-20 (v11):** El usuario quedó bloqueado de `admin` ("Usuario bloqueado temporalmente por
  intentos fallidos") con credenciales que decía correctas — causado casi con certeza por las
  pruebas automatizadas extensas de esta sesión sobre la cuenta compartida (login con contraseña
  vieja tras cambios de estado). Se desbloqueó la cuenta al instante (`login_attempts = 0`,
  `locked_until = NULL`) y, a pedido explícito del usuario, **se eliminó el bloqueo automático por
  intentos fallidos por completo**: "no debería bloquearse nunca por intentos fallidos, solo si el
  admin lo bloquea desde seguridad a algún usuario".
  - `AuthService.login` (`src/backend/src/auth/auth.service.ts`) ya no cuenta intentos para
    bloquear ni fija `locked_until` automáticamente. `login_attempts` se sigue incrementando en
    cada fallo, pero sólo como dato informativo/auditoría — no dispara ninguna consecuencia.
  - El bloqueo **manual** (el que el usuario sí quiere) ya existe a nivel de datos y de
    `login()`: `is_active = 0` en `dbo.users` impide el login sin importar la contraseña. Lo que
    falta es la pantalla en Seguridad para que el admin lo accione sobre otro usuario — no se
    construyó todavía porque hoy sólo existe la cuenta `admin` (la gestión multiusuario sigue
    explícitamente diferida, ver v1–v9). `locked_until` queda como mecanismo disponible sin usar
    por ahora, por si se quiere en el futuro un bloqueo temporal además del permanente.
  - Tests actualizados: se sacó el test de "bloquea al 5to intento" y se agregaron "NO bloquea
    tras 10 intentos fallidos seguidos" y "rechaza login con is_active=false aunque la contraseña
    sea correcta". Probado también en vivo: 8 intentos fallidos reales contra un usuario de
    prueba, seguidos de un login correcto que funcionó sin problema. 22/22 tests en verde.
- **2026-08-20 (v12):** Pese al desbloqueo de v11, el usuario siguió sin poder entrar a `admin`
  ("Usuario o contraseña incorrectos" — un error distinto, ya no de bloqueo). **Causa real:** la
  contraseña de la cuenta compartida había quedado en un estado distinto al que el usuario
  recordaba, por las mismas pruebas automatizadas extensas de esta sesión (no era un bug de
  bloqueo, era deriva de contraseña). Se resolvió reseteando `admin` a la contraseña `123456` por
  SQL directo, verificado con un login real.
  - A la vez, el usuario pidió una solución de fondo: que el propio admin decida, por usuario,
    si un reseteo de contraseña exige cambiarla en el próximo login o no — en vez de que sea un
    comportamiento fijo del sistema. Se construyó como preferencia configurable:
    `dbo.users.force_password_change_on_reset` (BIT, default `1`; migración `009`), con `admin`
    explícitamente en `0` (no se le exige cambiar tras un reseteo) y todo usuario nuevo en `1`
    (exigido) vía el `DEFAULT` de la columna.
  - `AuthService.login` (`src/backend/src/auth/auth.service.ts`) ahora sólo devuelve
    `passwordTempReset: true` (lo que dispara la pantalla de cambio obligatorio) cuando **ambas**
    condiciones se cumplen: `password_temp_reset` (hay una contraseña temporal pendiente) **y**
    `force_password_change_on_reset` (la política del usuario lo exige). `sanitizeUser` expone
    `forcePasswordChangeOnReset` en `/auth/me` y en la respuesta de login.
  - Nuevo endpoint de autoservicio `PATCH /auth/preferences` (`UpdatePreferencesDto`, validado con
    `class-validator`) para que el usuario autenticado cambie su propia preferencia, auditado en
    `dbo.audit_log`. Nueva UI en Seguridad → "Resetear contraseña"
    (`src/frontend/src/pages/SecurityPage.tsx`): checkbox "¿Solicitar cambio de contraseña al
    iniciar sesión la primera vez después de un reseteo?", que llama al endpoint y refresca el
    usuario en `AuthContext` (`refreshUser`).
  - **Bug real encontrado y corregido durante la prueba** (no relacionado a la preferencia): dos
    logins dentro del mismo segundo generaban el mismo JWT byte a byte (mismo `sub`/`username`/
    `role`/`iat`), lo que violaba el índice único `UX_sessions_token_hash` al insertar la segunda
    sesión y devolvía **500** en el login. Se corrigió agregando un claim `jti` (UUID aleatorio)
    a cada token firmado (`AuthService.signToken`), garantizando unicidad sin depender del
    timestamp.
  - Probado de punta a punta con dos usuarios descartables (`test_prefs_on` con la preferencia en
    `1`, `test_prefs_off` en `0`): reset + login siguiente confirma `passwordTempReset: true` para
    el primero y `false` para el segundo; el toggle vía `PATCH /auth/preferences` persiste y se
    refleja en `/auth/me`; un payload inválido devuelve 400. Verificado además que `admin` sigue
    entrando normalmente con la política ya aplicada. Usuarios, sesiones y auditoría de prueba
    eliminados al terminar; no se tocó ninguna sesión real de `admin`. 23/23 tests de backend en
    verde (se agregó un test para la nueva lógica de gating).
- **2026-08-20 (v13):** El fondo del **formulario** del Login (la tarjeta blanca, `color_form_bg`)
  ahora admite **opacidad/transparencia** configurable, no sólo color sólido — a pedido del
  usuario. Nueva columna `dbo.login_settings.color_form_bg_opacity` (`DECIMAL(3,2)`, DEFAULT
  `1.00` = opaco, igual al comportamiento previo; migración `010`). Mismo patrón que
  `overlay_opacity` (§v-anteriores): validado en `UpdateLoginSettingsDto` con `@Min(0) @Max(1)`,
  incorporado automáticamente al `COLUMN_MAP` genérico de `LoginSettingsService` (get/update/reset
  no necesitaron lógica especial).
  - Frontend: nuevo slider "Opacidad del fondo del formulario" en Seguridad → Configuración del
    Login → Colores (`LoginSettingsPanel.tsx`), mismo componente `RangeField` que ya se usaba para
    la opacidad del overlay.
  - `LoginVisual.tsx` combina `colorFormBg` (hex) + `colorFormBgOpacity` en un `rgba(...)` para el
    `backgroundColor` de la tarjeta — **a propósito no se usó la propiedad CSS `opacity`**, porque
    esa desvanecería también el texto y los inputs de adentro, no sólo el fondo.
  - Probado end-to-end contra la fila real de `login_settings` (único endpoint singleton, no hay
    fila de prueba posible): `GET` público confirma el default `1`; login real de `admin` +
    `PUT {colorFormBgOpacity: 0.5}` + `GET` público confirma que se refleja; `PUT` con `1.5`
    (fuera de rango) devuelve 400; se revirtió a `1` (default) y se cerró la sesión de verificación
    antes de terminar, sin dejar la apariencia real del Login alterada. Type-check limpio en
    frontend y backend, 23/23 tests de backend en verde (sin cambios de lógica que ameriten un test
    nuevo — el mapeo es genérico).
- **2026-08-20 (v14):** Registrado un **requisito futuro, explícitamente NO implementado todavía**:
  importación de datos externos desde **worldfootball.net** (competiciones, temporadas, equipos,
  partidos, jugadores, goleadores, tarjetas, etc.) para poblar LeagueCore al instalarse, con
  detección de duplicados multi-criterio, trazabilidad de origen, prioridad manual-sobre-importado,
  vista previa, progreso real, historial de corridas y ejecución por etapas reanudable — pedido a
  propósito por adelantado para que la arquitectura actual no lo bloquee, no para construirlo
  ahora. Se documentó en detalle en **`docs/FUTURO_IMPORTACION_DATOS_EXTERNOS.md`** (nuevo
  archivo): qué de la arquitectura actual ya lo soporta (patrón módulo-por-dominio, convención
  desactivar-en-vez-de-borrar, `created_at`/`updated_at`, campos `type`/`sport`/`status` como texto
  libre), la única brecha real detectada (no hay hoy ningún mecanismo de proceso largo/asíncrono
  con progreso consultable — todo el backend es request/response síncrono), qué elementos de
  modelo de datos habrá que diseñar cuando corresponda (tabla genérica de referencias externas en
  vez de columnas de origen repetidas por tabla, dado que el propio requisito contempla un registro
  con múltiples orígenes a la vez), y qué criterios mínimos seguir mientras tanto en los módulos que
  faltan para no cerrarse esa puerta. **No se creó ninguna tabla, columna, migración ni módulo para
  esto** — es puramente documentación/planificación. El usuario también reconfirmó (ya sabido, ver
  v7 y memoria del proyecto) que Configuración/Parametrización sigue diferido como módulo formal
  hasta que haya configuraciones reales identificadas que administrar. No se tocó ningún módulo
  existente. **Aclaración para no confundir con el roadmap de v7:** "Importación Ltrack" (paso ya
  existente en el roadmap de 18 módulos) es migrar los `.div`/`.bak` reales de Ltrack de este
  usuario; esto es distinto — una fuente pública externa (worldfootball.net) para poblar datos que
  Ltrack nunca tuvo. Son dos funcionalidades de importación separadas, con orígenes y mecanismos de
  extracción no relacionados.
- **2026-08-24 (v15):** Módulo 5 (**Jugadores**) construido — deja de ser un `PlaceholderPage` y
  pasa a ser un módulo completo, siguiendo la misma filosofía visual/arquitectónica que
  Competiciones/Equipos (mismo patrón backend módulo-por-dominio con SQL parametrizado sin ORM,
  mismo estilo de listado/formulario/detalle, misma convención `status active/inactive` +
  `DELETE` bloqueado por FK en vez de borrado físico).
  - **Rediseño de `dbo.players`** (migración `011`, tabla vacía confirmada antes de tocarla): tenía
    `name` único y `team_id NOT NULL` desde la migración 001 original, insuficiente para el módulo
    real. Ahora: `first_name`/`last_name` + `full_name` **computed PERSISTED** (nunca editable por
    separado — resuelve de raíz el riesgo de inconsistencia nombre/apellido/nombre completo que el
    usuario marcó explícitamente), `team_id` ahora NULL-able (un jugador puede no tener equipo
    actual), `position` ampliado a NVARCHAR(30), + `status`, `photo_url`, `updated_at` y columnas
    de procedencia (`data_origin`, `external_source`, `external_id`, `external_url`,
    `last_synced_at` — preparación explícita para la futura importación de WorldFootball.net, ver
    `docs/FUTURO_IMPORTACION_DATOS_EXTERNOS.md`; con una sola entidad usándolas todavía no se
    justifica la tabla genérica de referencias externas que ese documento recomienda para más
    adelante, se reevalúa cuando un segundo módulo las necesite).
  - **Historial de equipos real**, no un campo de texto: tabla nueva `dbo.player_team_history`
    (jugador, equipo, fecha inicio/fin, dorsal de ese paso), con un índice único filtrado
    (`UX_pth_player_open_stint`, mismo patrón que `UX_users_email_filtered`) que garantiza a nivel
    de base de datos que un jugador tiene **un solo** paso "abierto" (equipo actual) a la vez.
    `PlayersService` lo mantiene sincronizado automáticamente: crear un jugador con equipo abre el
    primer paso; cambiar de equipo cierra el paso anterior y abre uno nuevo; quitar el equipo
    (`teamId: null`) cierra sin abrir otro. No incluye competición/temporada como columnas propias
    (se derivan de `team_id` → `team.competition_id`; "Temporada" sigue sin existir como módulo, a
    propósito no se inventó acá — ver v7).
  - **Posición estructurada sin construir Parametrización:** conjunto fijo de 4 valores (Portero,
    Defensor, Mediocampista, Delantero) validado con `@IsIn` en el DTO y `<select>` en el
    formulario — no un catálogo/tabla ni CHECK en base de datos, mismo criterio que
    `competition_type`/`sport`/`status`. Documentado acá como pendiente para cuando exista
    Configuración/Parametrización. Nacionalidad se mantiene texto libre (sin catálogo/tabla de
    países), con un `<datalist>` de sugerencias sólo del lado del cliente
    (`src/frontend/src/lib/countries.ts`) para reducir errores de tipeo sin construir
    infraestructura nueva.
  - **Detección de duplicados al crear** (`GET /players/check-duplicates`): compara apellido exacto
    y nombre+apellido parcial usando `COLLATE Latin1_General_CI_AI` sólo en esa consulta (no
    cambia el collation real de la tabla, `Modern_Spanish_CI_AS`, que es sensible a tildes) — así
    "Juan Perez" encuentra a "Juan Pérez". Es una advertencia, no un bloqueo: el formulario muestra
    los posibles duplicados con link a revisar en pestaña nueva, y sólo pide una confirmación
    extra antes de crear igual — nunca impide crear.
  - **Paginación real** en `GET /players` (`OFFSET/FETCH` + `COUNT(*) OVER()` en una sola consulta,
    25 por página) — a diferencia de Competiciones/Equipos, que hoy devuelven la lista completa sin
    paginar. Es una divergencia deliberada, no una inconsistencia: el propio pedido señaló que
    Jugadores debe estar preparado para cientos de miles de registros por la futura importación,
    cosa que no aplica (todavía) a Competiciones/Equipos.
  - **Responsive con tabla → tarjetas en mobile** (`sm:hidden`/`hidden sm:block`, dos renders del
    mismo dato): a diferencia de Competiciones/Equipos (que sólo hacen scroll horizontal), acá se
    pidió explícitamente evitar una tabla ilegible en pantalla chica.
  - **Foto de jugador:** mismo patrón de upload que los logos/fondos de Login (`multer` +
    `diskStorage`, servido estático en `/uploads/players/...`, validado por MIME real y tamaño
    máximo 2 MB — no sólo por extensión). En el formulario de creación, si se elige una foto antes
    de guardar, se sube recién después de crear el jugador (no existe `id` todavía); en edición se
    sube de inmediato. Quitar la foto reutiliza `PUT /players/:id { photoUrl: null }`, igual que
    Login hace con sus imágenes.
  - **Hueco de accesibilidad real encontrado durante la prueba** (no específico de Jugadores): los
    formularios de Equipos/Competiciones (`Field` interno de `TeamFormPage`/`CompetitionFormPage`)
    nunca asociaron `<label>` con su `<input>` (sin `htmlFor`/`id`) — funciona visualmente pero un
    lector de pantalla no anuncia la etiqueta correctamente. Se corrigió en el `Field` de
    `PlayerFormPage` (con `htmlFor`/`id` generados a partir del label) — se detectó porque bloqueaba
    probar el formulario con Playwright (`getByLabel` no encontraba los inputs sin esa asociación,
    la misma razón por la que un lector de pantalla tampoco los asociaría bien). No se tocó el
    `Field` de Equipos/Competiciones (fuera de alcance de este pedido), pero queda anotado como
    mejora menor aplicable ahí después.
  - Pestañas "Jugadores" ya existentes como "Próximamente" en `TeamDetailPage` y
    `CompetitionDetailPage` (ver v7) ahora muestran el roster real (`GET /players?teamId=` /
    `?competitionId=`, este último nuevo, se agregó al mismo endpoint) — mismo criterio ya usado
    con la pestaña "Equipos" de Competiciones: una vez que el módulo referenciado existe, se
    conecta en vez de dejarlo inerte.
  - **Auditoría:** Competiciones y Equipos no escriben en `dbo.audit_log` hoy (verificado antes de
    decidir) — Jugadores mantiene esa misma consistencia a propósito, en vez de ser el primer
    módulo de dominio en auditar mientras los otros dos no. Se anota como mejora futura pareja para
    los tres, no como algo específico de este módulo.
  - Probado de punta a punta con un usuario descartable y un navegador real (Playwright/Chromium,
    no sólo `curl`): login → crear competición/equipos de prueba (verificando que Competiciones y
    Equipos siguen funcionando) → crear jugador con foto/posición/equipo → detalle muestra nombre,
    edad calculada, equipo, historial y estadísticas en `--` → buscar y filtrar por posición en el
    listado → advertencia de posible duplicado real al repetir el nombre → cambiar de equipo desde
    Editar y confirmar que el historial conserva el equipo anterior → subir/reemplazar foto →
    desactivar/activar → **vista mobile real en 375×812 confirma tarjetas, no tabla** → pestañas
    "Jugadores" de Equipos y Competiciones muestran el jugador → intentar eliminar un jugador con
    historial devuelve el error amigable esperado, no rompe la pantalla → Seguridad sigue
    accesible. 29/29 verificaciones automatizadas en verde, capturas de pantalla revisadas
    visualmente (contraste, layout). 23/23 tests de backend (Auth) siguen en verde, sin tocar ese
    módulo. Datos y usuario de prueba eliminados al terminar; no se tocó la cuenta real de `admin`.
- **2026-08-24 (v16):** Módulo 6 (**Oficiales**) construido — nombre elegido a propósito en vez de
  "Árbitros", porque el módulo ya contempla más tipos de oficial que sólo el árbitro principal.
  Misma filosofía arquitectónica que Jugadores (backend módulo-por-dominio, listado con
  búsqueda/filtros/paginación real, foto con multer, detección de duplicados accent-insensitive,
  responsive tabla→tarjetas en mobile).
  - **Reutiliza `dbo.officials`**, que ya existía desde la migración 001 (id, name, nationality,
    city) con `dbo.matches.referee_id` ya referenciándola por FK — no se creó una tabla nueva.
    Migración `012`: mismo rediseño que `players` (migración 011): `first_name`/`last_name` +
    `full_name` computed PERSISTED, `status`, `photo_url`, `updated_at`, columnas de procedencia
    (`data_origin`/`external_source`/`external_id`/`external_url`/`last_synced_at`).
  - **Tipo de oficial como catálogo real, no whitelist fija:** a diferencia de `player.position`
    (4 valores fijos validados con `@IsIn` en el DTO), acá el pedido fue explícito — "debe permitir
    agregar nuevos tipos sin modificar código" — eso pide una tabla, no un enum de aplicación. Tabla
    nueva `dbo.official_types` (id, name, status, sort\_order), sembrada con 6 valores razonables
    (Árbitro principal/asistente, Cuarto árbitro, VAR, AVAR, Otro) que el admin puede ampliar desde
    una pantalla chica **dentro del propio módulo Oficiales**
    (`/oficiales/tipos`, enlazada desde el listado, no un ítem de navegación propio ni el módulo de
    Configuración/Parametrización que sigue diferido) — agregar un tipo nuevo es una fila en una
    tabla con status propio (desactivar un tipo no le pasa nada a los oficiales que ya lo tienen).
    `officials.official_type_id` es NULL-able en la base (flexibilidad para una futura importación
    que no siempre pueda determinar el tipo) pero **requerido en el DTO de creación y en el
    formulario** — un alta manual siempre debe elegir tipo.
  - **Sin historial de oficiación todavía, a propósito:** a diferencia de Jugadores (que sí
    necesitaba `player_team_history` porque "equipo actual" es un concepto real hoy), un oficial no
    tiene ningún estado "actual" análogo fuera de los partidos — por eso NO se creó ninguna tabla de
    historial ahora. El detalle muestra "Partidos dirigidos / Competiciones / Temporadas" en `--`
    (mismo patrón que las Estadísticas de Jugadores), con la nota de que se habilita cuando exista
    Partidos. La protección contra pérdida de historial ya funciona igual, gratis, por el FK
    preexistente `matches.referee_id → officials.id`: **verificado insertando un partido de prueba
    directo por SQL** (Partidos no existe como módulo) referenciando un oficial y confirmando que
    `DELETE /officials/:id` lo rechaza con el mismo mensaje amigable que usa Jugadores/Equipos/
    Competiciones ante una FK, en vez de romper.
  - **Decisión consciente, no un descuido:** las columnas de procedencia (`data_origin`,
    `external_source`, etc.) se repitieron una vez más como columnas directas en `officials`, igual
    que en `players`, en lugar de extraer ya la tabla genérica de referencias externas que
    `docs/FUTURO_IMPORTACION_DATOS_EXTERNOS.md` recomienda para más adelante. Es la segunda tabla
    con el mismo patrón duplicado — refactorizar ahora habría significado tocar el módulo Jugadores
    ya probado y en uso, fuera del alcance de este pedido. Si una tercera entidad lo necesita, ese
    es el momento de hacer el refactor (o puede pedirse como tarea aparte antes).
  - Filtro de nacionalidad en el listado usa un nuevo endpoint `GET /officials/nationalities`
    (`DISTINCT` sobre los oficiales reales cargados) en vez de una lista de países inventada — el
    propio pedido advirtió explícitamente "no crear filtros que no tengan una fuente de datos real".
  - **Refactor menor de consistencia:** con Oficiales, el badge de estado activo/inactivo y el
    avatar con foto/ícono de reemplazo se repetían por tercera vez (ya estaban en Equipos inline y
    en Jugadores como funciones locales) — se extrajeron a `src/frontend/src/components/
    StatusBadge.tsx` y `Avatar.tsx`, compartidos ahora por Jugadores y Oficiales (Equipos no se
    tocó, sigue con su badge inline, fuera de alcance de este pedido).
  - Auditoría: mismo criterio que Jugadores — Competiciones/Equipos/Jugadores no escriben en
    `dbo.audit_log` hoy, así que Oficiales tampoco, por consistencia (no por descuido).
  - Probado de punta a punta con un usuario descartable y Playwright/Chromium real: login → crear
    tipo de oficial nuevo desde `/oficiales/tipos` → crear oficial con foto/nacionalidad/ciudad/tipo
    → detalle muestra nombre completo, edad calculada, tipo, nacionalidad, ciudad, origen "Manual" e
    historial en `--` → buscar y filtrar por tipo y por nacionalidad (dato real) → advertencia de
    posible duplicado con "Diaz" sin tilde encontrando a "Díaz" → editar cambiando el tipo →
    subir/quitar foto → desactivar/activar → **vista mobile real en 375×812 confirma tarjetas** →
    eliminar sin relaciones funciona → verificado por API que `DELETE` con un partido asociado
    devuelve el error amigable, no 500 → `GET /officials` sin sesión devuelve 401 (seguridad real
    en backend, no sólo oculta botones) → Competiciones/Equipos/Jugadores/Seguridad siguen
    funcionando. 29/32 verificaciones automatizadas en verde; las 3 restantes fueron falsos
    negativos del propio script de prueba (una lectura de texto tomada antes de que terminara de
    cargar la pantalla — la captura de pantalla posterior confirma que sí carga bien; y dos casos
    donde la validación nativa del navegador, `required`/`max` en los inputs, bloqueó el envío
    antes de que corriera mi JS de prueba — validación real y correcta, sólo que más estricta de lo
    que esperaba el script), no fallas del producto. 23/23 tests de backend (Auth) siguen en verde.
    Datos y usuario de prueba eliminados al terminar; no se tocó la cuenta real de `admin`.
- **2026-08-24 (v17):** Módulo 7 (**Temporadas**) construido — tabla nueva `dbo.seasons` (migración
  `013`), directamente relacionada con `dbo.competitions` (ya existente, no se creó una segunda
  entidad de competiciones). Se agregó al menú entre Competiciones y Equipos, siguiendo el orden
  del roadmap de módulos acordado en v7.
  - **Competición ≠ Temporada, reforzado a nivel de datos, no sólo de nomenclatura:** una temporada
    siempre tiene `competition_id` (FK NOT NULL) — nunca se guarda "Primera División 2026" como si
    fuera una competición nueva.
  - **Formato de temporada flexible sin texto libre:** `start_year` + `end_year` (`end_year` NOT
    NULL, igual a `start_year` cuando es de un solo año — a propósito, para que la restricción de
    unicidad funcione bien: un `end_year` NULL nunca es igual a otro NULL en SQL Server) + `label`
    **computed PERSISTED** ("2026" o "2025/2026" según corresponda) — mismo patrón exacto que
    `full_name` en Jugadores/Oficiales: la etiqueta nunca se guarda como texto editable aparte, así
    que no puede desincronizarse de los años reales. El formulario pide "Año de inicio" y "Año de
    fin" (opcional) con una vista previa en vivo de la etiqueta resultante, en vez de un campo de
    texto libre.
  - **No permite duplicados dentro de la misma competición**, con restricción real en base de datos
    (`UNIQUE(competition_id, start_year, end_year)`, no sólo una advertencia de aplicación como en
    Jugadores/Oficiales) — acá la coincidencia es exacta y determinística (mismos años, misma
    competición), no un juicio difuso sobre nombres de personas, así que una restricción dura es lo
    correcto. La misma etiqueta ("2026") sí puede repetirse en competiciones distintas, porque la
    unicidad incluye `competition_id`.
  - **Temporada actual por competición:** columna `is_current` con un índice único filtrado
    (`UX_seasons_current_per_competition ... WHERE is_current = 1`) — mismo patrón que
    `UX_pth_player_open_stint` de Jugadores — garantiza a nivel de base de datos que como mucho una
    temporada por competición esté marcada como actual. Se gestiona con un endpoint dedicado
    (`PATCH /seasons/:id/current`) que primero desmarca cualquier otra temporada actual de la misma
    competición y recién después marca la nueva — **nunca** a través del `PUT` genérico, para que
    esa invariante no se pueda saltear.
  - **Estado:** se mantuvo el mismo binario `active`/`inactive` que usa todo el resto del sistema
    (no se agregaron `FINALIZADA`/`CANCELADA` como estados nuevos — sin un consumidor real todavía,
    como Partidos, no había justificación concreta) pero con etiquetas contextuales en la UI de
    Temporadas ("Activa"/"Finalizada" en vez de "Activo"/"Inactivo") — la columna es la misma de
    siempre, sólo cambia cómo se lee para esta entidad en particular.
  - **Equipos participantes:** tabla puente nueva `dbo.season_teams` (season_id, team_id) — a
    diferencia del historial de oficiación (deliberadamente NO construido, ver v16), la
    participación de un equipo en una temporada SÍ es un dato real y conocido antes de que exista
    un solo partido (es una inscripción, no un derivado de partidos jugados), así que se construyó
    ahora con una UI mínima (agregar/quitar equipo) en el detalle de la temporada — validado que el
    equipo a agregar pertenezca a la competición de la temporada, y que no se pueda agregar dos
    veces el mismo equipo.
  - **Historial preservado por diseño:** no hay eliminación automática de temporadas antiguas;
    `DELETE /seasons/:id` usa el mismo patrón de captura de FK (error 547 → mensaje amigable,
    sugerir desactivar) que Competiciones/Equipos/Jugadores/Oficiales — hoy sólo protege contra
    borrar una temporada con equipos participantes (`season_teams`), pero en cuanto exista Partidos
    y agregue su propio FK hacia `seasons`, la misma protección se activa sin tocar código.
  - **Decisión consciente, no un descuido (igual que en v16):** las columnas de procedencia
    (`data_origin`, `external_source`, etc.) se repitieron una tercera vez como columnas directas
    en `seasons`, en vez de extraer ya la tabla genérica de referencias externas que
    `docs/FUTURO_IMPORTACION_DATOS_EXTERNOS.md` recomienda. Esta es la tercera tabla con el patrón
    duplicado — el punto que yo mismo había marcado como "ahí conviene refactorizar" ya llegó; se
    optó por no hacerlo dentro de este pedido (tocaría Jugadores y Oficiales, ya probados y en uso,
    fuera de alcance) y en cambio dejarlo señalado acá para que el usuario decida si lo pide como
    tarea aparte.
  - Auditoría: mismo criterio que Jugadores/Oficiales — Competiciones/Equipos tampoco auditan hoy,
    así que Temporadas no es la excepción.
  - Probado de punta a punta con un usuario descartable y Playwright/Chromium real: login → crear
    competición de prueba (confirmando que Competiciones/Equipos/Jugadores/Oficiales siguen
    funcionando) → crear temporada 2026 → detalle muestra label, competición, e "Información
    futura" en `--` (Partidos/Jugadores/Oficiales/Clasificación/Estadísticas) → crear temporada
    2025/2026 con vista previa de etiqueta correcta antes de guardar → intentar el duplicado exacto
    2026 rechazado con mensaje visible, sin navegar → buscar "2025" encuentra la temporada
    2025/2026 → filtrar por competición → marcar 2026 como actual, después marcar 2025/2026 como
    actual y confirmar que 2026 se desmarca sola → agregar un equipo participante y verlo aparecer
    → cambiar estado a Finalizada y persistir → fechas de fin anteriores a inicio rechazadas →
    eliminar una temporada con equipo participante devuelve el error amigable, no rompe la pantalla
    → **vista mobile real en 375×812 confirma tarjetas** → pestaña "Temporadas" de Competiciones
    muestra las temporadas reales → API rechaza una competición inexistente → Seguridad sigue
    accesible. **29/29 verificaciones automatizadas en verde**, capturas revisadas visualmente. 23/23
    tests de backend (Auth) en verde. Datos y usuario de prueba eliminados al terminar; no se tocó
    la cuenta real de `admin`.
- **2026-08-24 (v18):** Módulo 8 (**Partidos**) construido — el más grande del proyecto hasta ahora,
  pedido explícitamente como la entidad central de LeagueCore (Competición → Temporada → Partido →
  equipos/jugadores/oficiales/cuerpo técnico/eventos/estadísticas). Migraciones `014` y `015`.
  **Principio rector cumplido:** nada de una tabla `matches` gigante con una columna por
  estadística — cada tipo de dato es una entidad, relación o evento propio, normalizado.
  - **Reutiliza `dbo.matches` y `dbo.venues`** (ya existían desde la migración 001) y **`dbo.goals`/
    `dbo.cards`/`dbo.substitutions`/`dbo.penalty_misses`** (extendidos, no duplicados). Entidades
    nuevas: `dbo.coaches` (mismo patrón que Jugadores/Oficiales — nombre nunca editable aparte),
    `dbo.match_officials` (Partido↔Oficial CON ROL, no un `referee_id` suelto — el que tenía
    `matches` se eliminó), `dbo.match_coaches`, `dbo.match_lineups` (participantes reales del
    partido, con equipo/dorsal propios del partido — no se deriva del equipo actual del jugador),
    `dbo.match_period_scores` (resultado ESTRUCTURADO por periodo, ausencia de fila = "sin
    resultado", nunca se asume 0-0), `dbo.match_shootout_kicks` (tanda de penales, deliberadamente
    separada del resultado normal y de los goles), `dbo.offsides`, `dbo.match_interruptions`,
    `dbo.match_team_stats` (estadísticas de equipo, TODO NULL-able sin default numérico — "cero
    real" vs. "dato desconocido" respetado en todo el módulo).
  - **`dbo.penalty_misses` renombrada a `penalty_kicks`** y extendida con `outcome`
    (`missed`/`saved`) — un penal convertido ya se representa con `goals.penalty = 1`; acá sólo van
    los que no terminaron en gol. La tanda de penales es una tabla aparte (§33 del pedido: "no
    mezclar penal durante el partido con penal de tanda").
  - **Minutos con tiempo añadido real:** `minute` + `minute_extra` + `period` (1er/2do
    tiempo/prórroga 1/prórroga 2) en goles/tarjetas/sustituciones/offsides — representa 45+2,
    90+5, 120+3 correctamente, no como texto.
  - **Coordenadas espaciales reales** (`pos_x`/`pos_y`, 0-100 normalizado) agregadas a `goals` para
    la ubicación del remate — estructura reconstruible, no una imagen.
  - **Estado del partido genuinamente distinto del binario** `active`/`inactive` que usa el resto
    del sistema: `scheduled`/`finished`/`postponed`/`suspended`/`cancelled` — divergencia
    deliberada y documentada porque es un flujo de estados real, no un interruptor. Validado en la
    app (`@IsIn`), no con CHECK en base, para poder ampliarlo sin migración.
  - **Tipo de oficial del partido, cuerpo técnico y clima/césped: texto/listas a nivel de
    aplicación**, no catálogos en base — mismo criterio que `player.position`. `round`/`phase`/
    `group_name`/`leg` también texto libre a propósito (distintas competiciones usan esquemas de
    fases muy distintos; forzar una estructura rígida ahora hubiera sido prematuro).
  - **Integridad referencial real, no sólo documentada:** temporada debe pertenecer a la
    competición del partido; ambos equipos deben pertenecer a esa competición; local ≠ visitante;
    un evento (gol/tarjeta/sustitución/offside/penal/tanda) sólo puede registrar a un jugador que
    ya esté cargado como participante (`match_lineups`) de ese equipo en ese partido — validado en
    `MatchEventsService.assertLineupMembership`, no sólo confiado al frontend.
  - **Detección de duplicados** (misma competición+equipos+fecha) es una advertencia blanda con
    confirmación, no un bloqueo — el propio pedido advirtió que ida/vuelta, desempates y
    reprogramaciones son casos legítimos de "duplicado" aparente.
  - **Auditoría real, por primera vez en un módulo de dominio:** a diferencia de Competiciones/
    Equipos/Jugadores/Oficiales/Temporadas (que deliberadamente no auditan, ver v15-v17), acá el
    pedido fue explícito ("registrar cambios importantes... utilizar el sistema de auditoría
    existente"). Se reutilizaron columnas `entity`/`entity_id` que ya existían en `dbo.audit_log`
    desde la migración 004 pero nunca se habían usado — no se creó ninguna tabla nueva de
    auditoría. Pestaña "Historial" en el detalle del partido, con `GET /matches/:id/history`
    filtrando por `entity = 'match'`.
  - **Timeline unificado de sólo lectura:** `GET /matches/:id/timeline` combina goles, tarjetas,
    sustituciones, offsides e interrupciones en un único orden cronológico — es una vista que junta
    las tablas normalizadas, no una tabla "eventos" genérica con columnas opcionales por tipo (eso
    sí hubiera sido la "tabla gigante" que el pedido explícitamente prohibió).
  - **Goles/asistencias/tarjetas por jugador se derivan siempre de `goals`/`cards`** en el momento
    de la consulta (`match-participants.service.ts`, `listLineups`) — nunca se guardan aparte en la
    alineación, así no pueden desincronizarse del timeline real.
  - **Preparado para GPS/xG/xA/PPDA/heatmaps sin construirlos** (migración `015`, pedido explícito
    de no desarrollarlos todavía): `match_player_stats` (caja individual no derivable de eventos),
    `match_player_physical_stats` (GPS, ausencia de fila = "sin datos GPS"),
    `match_advanced_metrics` (formato atributo-valor a propósito — `metric_name`/`metric_value`/
    `provider`/`model_version`: agregar xG, una nueva versión de modelo, o una métrica futura es
    una fila nueva, cero cambios de esquema; resuelve directamente el pedido de que "xG no sea un
    número arbitrario"), `match_player_positions` (datos espaciales para posición media/heatmap,
    x/y normalizados, sin guardarse como imagen). **Estas 4 tablas quedan vacías, sin endpoints ni
    pantallas de carga** — el detalle del partido las muestra como "Sin datos GPS/físicos
    disponibles" y "Sin datos de analítica avanzada disponibles", nunca inventando valores.
  - **Coaches y Venues: backends deliberadamente mínimos** (buscar + crear rápido, sin pantallas de
    listado/detalle propias) — se usan desde selectores embebidos en el formulario/detalle de
    Partidos. Documentado como candidato a expandirse a un módulo completo si se pide más adelante.
  - **Decisión consciente, no un descuido:** con Partidos, `data_origin`/`external_source`/etc. se
    repiten una CUARTA vez (players, officials, seasons, matches) sin extraer todavía la tabla
    genérica de referencias externas — sigue siendo la misma decisión deliberada de v16-v17,
    señalada de nuevo para que el usuario decida si la pide como tarea aparte.
  - Pestañas "Partidos" ya existentes como "Próximamente" en `CompetitionDetailPage` y
    `TeamDetailPage` (ver v7) ahora muestran partidos reales — mismo criterio ya aplicado con
    Temporadas/Jugadores en esas mismas páginas.
  - Probado de punta a punta con un usuario descartable y Playwright/Chromium real, cubriendo el
    flujo completo del pedido: login → confirmar que Competiciones/Temporadas/Equipos/Jugadores/
    Oficiales siguen funcionando → crear competición/temporada/2 equipos/3 jugadores de prueba vía
    UI → crear partido (competición → temporada en cascada, equipos filtrados por competición,
    estadio creado al vuelo) → validación local=visitante → advertencia de partido duplicado →
    cargar alineación (3 jugadores) → gol con asistencia, tarjeta amarilla, sustitución, offside e
    interrupción VAR, todos aparecen correctamente ordenados en el timeline → agregar oficial
    (búsqueda) y entrenador (creado al vuelo) → cargar estadísticas de equipo (posesión) →
    resultado por periodo (1er tiempo 1-0, final 1-1) reflejado en el encabezado → pestañas
    Físico/GPS y Analítica muestran los placeholders correctos, sin datos inventados → cambiar
    estado a Finalizado → historial de auditoría muestra `create_match` y `update_match` → intentar
    eliminar un partido con eventos devuelve el error amigable esperado, no rompe la pantalla →
    **vista mobile real en 375×812** confirma que tanto el listado como el detalle (con sus 10
    pestañas) se ven y usan bien → Seguridad sigue accesible. **36/37 verificaciones automatizadas
    en verde**; la única "falla" fue un selector de Playwright mal escrito en el propio script de
    prueba (no una aserción real) — confirmado visualmente con la captura de pantalla que el
    detalle se ve perfecto en mobile. 23/23 tests de backend (Auth) en verde, sin tocar ese módulo.
    Datos y usuario de prueba eliminados al terminar; no se tocó la cuenta real de `admin`.
- **2026-08-24 (v19):** Ajuste al Módulo 8 (Partidos) a partir de una revisión del usuario que
  reorganizó la arquitectura de Partidos en 9 áreas (Datos generales, Equipos, Cuerpos técnicos,
  Arbitraje, Eventos, Estadísticas de equipo, Estadísticas individuales, GPS, Analítica avanzada) y
  pidió explícitamente clasificar cada una como dato **manual**, **importable de
  WorldFootball.net**, **de otra fuente**, o **calculado por LeagueCore** — sin asumir que la fuente
  externa tiene todo lo que se está modelando.
  - **Revisión de cobertura:** de las 9 áreas, 8 ya estaban correctamente resueltas en v18 como
    entidades/relaciones/eventos separados (nunca como campos sueltos) — la propia arquitectura ya
    seguida (`match_officials` con rol, `match_lineups`, `match_period_scores`,
    `match_advanced_metrics` en formato atributo-valor con proveedor, etc.) era exactamente lo que
    esta revisión pedía. El único gap real encontrado: **Faltas** — el pedido original de Partidos
    (§18) ya las pedía como evento individual (partido, equipo, jugador, minuto, tipo) y en v18
    sólo habían quedado como número agregado en `match_team_stats.fouls`.
  - **Corregido:** tabla nueva `dbo.fouls` (migración `016`), mismo patrón exacto que `dbo.offsides`
    — equipo que comete la falta, jugador opcional, minuto/tiempo añadido/periodo, y una referencia
    opcional a `cards.id` cuando la falta derivó en una tarjeta ya registrada (para no duplicar tipo
    /motivo en dos lugares). Sumada a `MatchEventsService`, al controlador
    (`POST/DELETE /matches/:id/fouls`) y al timeline unificado. Probada por API: falta válida
    aceptada, falta de un jugador no registrado en la alineación rechazada (misma validación que
    goles/tarjetas/sustituciones/offsides), aparece correctamente en el timeline.
  - **Clasificación de origen de datos, documentada en detalle** en
    `docs/FUTURO_IMPORTACION_DATOS_EXTERNOS.md` §8 (tabla completa por área) — resumen: WorldFootball
    probablemente cubre datos generales básicos, equipos, árbitro principal y goles/tarjetas; **no**
    GPS ni Posicionamiento (requieren un proveedor de tracking, estructuralmente imposible que una
    base de resultados históricos los tenga); Analítica avanzada (xG/xA/PPDA) tiene dos caminos
    igual de válidos — proveedor especializado O calculado por el propio LeagueCore — y
    `match_advanced_metrics.provider` ya distingue ambos casos sin conflicto (por ejemplo,
    `provider = 'leaguecore'` para un xG calculado internamente). Nada de esto se implementa ahora;
    es la base para cuando se analice la fuente real (§7 del documento, sigue pendiente).
  - No se tocó ningún otro módulo. 23/23 tests de backend en verde. Sin cambios de frontend más
    allá de sumar el evento "falta" al timeline (ícono, descripción, formulario rápido) siguiendo
    el mismo patrón ya usado para offsides.
- **2026-08-24 (v20):** Primer tramo del "Prompt maestro de finalización del sistema" — auditoría
  completa pedida antes de tocar código, seguida de las piezas de mayor prioridad ("conectan todo").
  Dado el alcance real del pedido (20 módulos, 76 secciones), se acordó con el usuario un plan
  priorizado en vez de intentar todo con el mismo rigor en una sola pasada; este primer tramo cubre
  **Clasificaciones (Standings)**.
  - **Hallazgo de auditoría (real, no fabricado):** `dbo.standings` existía como VISTA desde la
    migración `002` (fase muy temprana del proyecto, antes de que existiera Temporadas), agrupando
    por competición completa. La migración `014` (rediseño de Partidos, v18) eliminó las columnas
    `matches.home_goals`/`away_goals`/`abandoned`/`void` que esa vista todavía referenciaba — SQL
    Server no valida nombres de columna al crear una vista sin `SCHEMABINDING` (resolución diferida),
    así que quedó **viva pero rota en silencio**: cualquier `SELECT` contra ella habría fallado con
    "Invalid column name". Nadie la había consultado desde entonces.
  - **Corregido:** migración `017` elimina la vista. El cálculo de clasificación NO se repuso como
    otra vista — pasó a ser una consulta parametrizada por temporada en
    `SeasonsService.getStandings()` (mismo criterio sin ORM/sin lógica de negocio en la base que
    usa el resto del proyecto), expuesta en `GET /seasons/:id/standings`. Motivo del cambio de forma:
    la vista original no podía existir cuando se creó Temporadas, así que agrupaba mal (por
    competición completa, mezclando todas las temporadas) para lo que hace falta ahora.
  - **Cálculo:** por equipo, sólo partidos con `status = 'finished'` de esa temporada, resultado
    tomado de `match_period_scores` con `period = 'full_time'`. Usa las columnas ya existentes desde
    la migración 001 — `competitions.points_win/points_draw/points_loss` (puntos por resultado
    **configurables**, nunca asumidos 3-1-0) y `teams.added_points` (bonificación/sanción aplicada a
    nivel competición, no reseteada por temporada — comportamiento heredado de la vista original, no
    rediseñado en esta pasada). Orden: puntos desc, diferencia de gol desc, goles a favor desc,
    nombre alfabético como desempate final determinístico (sin desempate por enfrentamiento directo,
    limitación heredada — ver §10 de la vista original).
  - **Regla "0 ≠ SIN DATOS" aplicada:** un partido `finished` sin fila en `match_period_scores` para
    `full_time` (resultado nunca cargado) se excluye del cálculo de goles/resultado en vez de
    tratarse como 0-0 — y se cuenta aparte en `matchesMissingScore` por equipo más un `warning` global
    en la respuesta, para que la UI lo señale en vez de mentir con un PJ que no cuadra con la
    realidad. Probado explícitamente con un partido finalizado sin marcador cargado junto a partidos
    normales: el cálculo excluyó sólo ese partido y el aviso apareció correctamente.
  - **Frontend:** tabla de posiciones (`components/StandingsTable.tsx`, componente compartido —
    tercera vez que se necesita este patrón, así que se extrajo de entrada en vez de duplicarlo,
    mismo criterio que motivó extraer `StatusBadge`/`Avatar` en el módulo de Oficiales) montada en
    dos lugares reales: pestaña "Equipos participantes" → sección "Clasificación" del detalle de
    Temporada (siempre visible, no placeholder), y la pestaña **"Clasificación" del detalle de
    Competición**, que existía desde antes marcada `ready: false` ("Próximamente") — ahora resuelve
    la temporada actual (`isCurrent`) por defecto con selector para cambiar de temporada.
  - Probado por API con dos escenarios reales end-to-end (usuario descartable, datos creados y
    eliminados al terminar): 3 equipos/3 partidos (incluyendo el caso de partido finalizado sin
    marcador) confirmando orden y exclusión correctos; 2 equipos empatados en puntos/DG/GF
    confirmando el desempate alfabético. Capturas de pantalla de ambas pantallas (Temporada y
    Competición) revisadas visualmente — datos reales, sin hardcodear. `npx tsc --noEmit` sin errores
    en frontend; backend recompiló sin errores (0 errors, hot-reload). Base de datos verificada en
    estado limpio después de cada prueba (0 partidos, 1 usuario = sólo `admin`, 0 competiciones de
    prueba).
  - Pendiente dentro del mismo pedido de finalización (no abandonado, siguiente tramo): Parametrizaciones,
    Estadísticas + Gráficos, Historial, Comparador + Rankings, Búsqueda global, reorganización de
    menú, exportación CSV. Explícitamente fuera de alcance de esta pasada (con justificación, no por
    descuido): importador real de WorldFootball.net, exportación PDF/Excel, visualizaciones que
    dependen de GPS/xG/heatmaps.
- **2026-08-24 (v21):** Segundo tramo del "Prompt maestro de finalización" — **módulo de
  Parametrizaciones**, pedido explícitamente como funcional de verdad (no un menú vacío), a
  diferencia de todas las veces anteriores en este proyecto donde se difirió a propósito (comentarios
  literales "sin construir un módulo de Configuración/Parametrización todavía" en
  `matches/constants.ts` y `players/dto/create-player.dto.ts`).
  - **Diseño:** catálogo genérico de dos tablas (migración `018`) — `dbo.parameter_categories`
    (código, nombre, descripción y **`used_in`**, el campo que documenta explícitamente "dónde se
    utiliza" que el pedido exige) y `dbo.parameters` (valores por categoría, con `is_active` y
    `is_system`). **No** duplica `dbo.official_types`, que ya es su propio módulo completo con su
    propia UI desde Oficiales (regla del pedido: si un módulo ya existe con otro nombre, se usa el
    existente). Backend: `ParametersService`/`ParametersController` (`GET /parameter-categories`,
    `GET/POST /parameter-categories/:code/parameters`, `PATCH /parameters/:id`,
    `PATCH /parameters/:id/active`, `DELETE /parameters/:id`), mismo criterio de guards que el resto
    de los módulos de dominio (`JwtAuthGuard`, no un guard admin-only nuevo). Frontend:
    `pages/parameters/ParametersPage.tsx`, dos paneles (categorías a la izquierda, valores de la
    categoría elegida a la derecha), enlazada en el navbar (sólo visible para admin, igual que
    Seguridad — el propio backend no distingue rol, es sólo prolijidad de UX como ya documentado ahí).
  - **10 categorías sembradas 1:1 con las listas fijas que ya existían en el código** (para no
    inventar nada nuevo): estados de partido, roles arbitrales, roles de cuerpo técnico, tipos de
    tarjeta/gol/interrupción, estado del césped, condición climática, posiciones de jugador, tipos de
    competición — 49 valores en total, cada uno marcado `is_system = 1` salvo `competition_type`
    (nunca tuvo una lista fija real; texto libre desde siempre).
  - **Alcance honesto de la integración (no todo quedó "enchufado" de verdad):** de las 10
    categorías, sólo **`match_status`** quedó con validación dinámica real contra la base —
    `MatchesService.assertActiveCode()` consulta `dbo.parameters` en `create`/`update`/`setStatus`
    antes de aceptar un estado, además del `@IsIn` estático del DTO (que sigue filtrando basura
    estructural sin ir a la base). Probado explícitamente: desactivar "Suspendido" desde
    Parametrizaciones bloqueó de inmediato crear un partido nuevo con ese estado (mensaje con los
    valores permitidos vigentes); reactivarlo lo volvió a permitir; intentar desactivar un valor en
    uso (`in_progress` con un partido real usándolo) fue rechazado con el conteo real de registros
    afectados; intentar borrar un valor `is_system` fue rechazado (sólo se puede desactivar). Las
    otras 9 categorías quedan sembradas y administrables desde la UI, pero sus validadores de
    aplicación (`@IsIn` en los DTOs de Jugadores/Partidos) **no** se tocaron todavía — se dejó
    señalado como pendiente real en vez de afirmar una integración que no existe.
  - **`EN CURSO` agregado** (`match_status` = `in_progress`), pedido explícito de finalización §48 —
    único valor nuevo en el ciclo de vida de partido desde que se definió en el módulo 8. Reflejado
    en `matches/constants.ts` (backend) y `types/match.ts` (frontend, `MATCH_STATUS_LABELS` +
    `STATUS_COLORS` del listado de partidos).
  - **Hallazgo de proceso (no de producto):** `npx tsc --noEmit -p tsconfig.json` en el frontend es
    un no-op silencioso — el `tsconfig.json` raíz sólo tiene `references`, así que nunca compiló nada
    y reportaba "sin errores" falsamente. Detectado porque `STATUS_COLORS` (un `Record<MatchStatus,
    string>` en `MatchesListPage.tsx`) quedó sin la clave `in_progress` y el chequeo "limpio" no lo
    marcó; repetido apuntando a `tsconfig.app.json` sí lo detectó al toque. Corregido en el código
    (clave agregada) y anotado en memoria para no repetir el chequeo inútil en el resto de esta
    sesión ni en futuras.
  - Probado por API con usuario descartable de punta a punta (categorías, alta de valor
    personalizado, activar/desactivar, borrar, las cuatro protecciones de integridad de arriba) y
    visualmente con Playwright (pantalla de Parametrizaciones con "Estados de partido" seleccionado,
    formulario de partido nuevo con el selector de Estado ya ofreciendo "En curso"). `npx tsc --noEmit
    -p tsconfig.app.json` sin errores (chequeo real esta vez). Backend recompiló sin errores
    (hot-reload, rutas nuevas listadas en el log). Datos y usuario de prueba eliminados al terminar;
    base verificada en 0 partidos / 1 usuario (`admin`) / 49 parámetros (el seed original intacto).
- **2026-08-24 (v22):** Tercer tramo de finalización — **Estadísticas + Gráficos**, con datos reales
  únicamente (nada hardcodeado ni inventado para "verse completo").
  - **Backend:** módulo nuevo `stats` (`GET /stats/overview|top-scorers|top-assists|goals-by-team|
    cards-by-team|matches-by-status|goals-by-season`), todas parametrizables por `competitionId`/
    `seasonId` opcionales. Leen directamente de `dbo.goals`/`dbo.cards`/`dbo.matches` — nada
    precalculado ni cacheado. **Autogoles excluidos** de goleadores y de "goles por equipo"
    (`own_goal = 0`): igual que `match_period_scores` (v18) no se deriva el marcador oficial desde
    los eventos, acá tampoco se le atribuye a ningún equipo un autogol como si fuera un gol a favor
    -- se documenta la exclusión en vez de adivinar a quién atribuirlo.
  - **Frontend:** se agregó `recharts` (única dependencia nueva de esta pasada, ningún gráfico
    existente lo necesitaba todavía). Página `/estadisticas` (reemplaza el placeholder "Próximamente"
    que existía desde el principio) con filtro competición → temporada en cascada, 4 tarjetas resumen,
    3 gráficos de barras (goles por equipo, tarjetas por equipo apiladas amarilla/roja, partidos por
    estado), 1 gráfico de líneas (evolución de goles por temporada, sólo visible con una competición
    elegida) y 2 tablas (máximos goleadores/asistentes) — todo clickeable hacia el equipo/jugador
    correspondiente. Nota explícita y honesta en la propia pantalla listando qué NO se muestra y por
    qué (posesión/tiros/xG/xA/mapas de calor: no hay datos reales cargados para esas métricas en
    ningún partido todavía).
  - **Bug real encontrado y corregido antes de dar por terminado (no un artefacto de prueba):**
    `GET /competitions` devuelve un array plano (`Competition[]`), a diferencia de `/seasons`/
    `/matches` que devuelven `{ items, total, page, pageSize }` -- son convenciones distintas porque
    Competiciones es anterior a que el proyecto adoptara paginación. El primer borrador de
    `StatisticsPage.tsx` asumió la forma paginada para el selector de competición; la página cargó en
    blanco (`Cannot read properties of undefined (reading 'map')`, confirmado con Playwright
    capturando `pageerror` de la consola real, no una captura ambigua). Corregido leyendo el array
    directo, mismo patrón que ya usan `MatchFormPage`/`MatchesListPage`/`TeamsListPage`/etc.
  - Probado con un escenario rico (usuario descartable, 1 competición, 2 temporadas, 4 equipos, 4
    jugadores, 5 partidos incluyendo uno programado sin jugar): los 7 goles, 4 tarjetas, 4
    finalizados/1 programado, goleador máximo y desglose por equipo coincidieron exactamente con lo
    cargado -- verificado número por número, no sólo "se ve bien". `npx tsc --noEmit -p
    tsconfig.app.json` sin errores tras el fix. Datos y usuarios de prueba eliminados; base verificada
    en 0 partidos / 1 usuario / 0 jugadores / 0 competiciones al terminar.
- **2026-08-24 (v23):** Cuarto y quinto tramo de finalización — **Historial** y **Comparador**.
  - **Historial:** no se creó un módulo nuevo separado (tal como se había planteado) -- se
    reemplazaron placeholders "Próximamente"/"Disponible cuando se implemente Partidos" ya
    existentes en Jugador y Equipo por datos reales. `PlayerDetailPage` "Estadísticas": ahora usa
    `GET /stats/players/:id/summary` (partidos/goles/asistencias/amarillas/rojas reales). `TeamDetailPage`
    ganó tres pestañas que ya existían declaradas pero vacías: **Resultados** (partidos finalizados
    con indicador G/E/P), **Estadísticas** (`GET /stats/teams/:id/summary`, agregando TODAS las
    competiciones/temporadas del equipo, distinto de Clasificaciones que es siempre de una sola
    temporada) e **Historial** (nueva: `GET /teams/:id/roster-history`, listado de altas/bajas de
    plantel vía `player_team_history`, simétrico al "Historial de equipos" que ya tenía el jugador).
    Se dejaron fuera, documentado explícitamente y no fabricado: historial de oficiación de árbitros
    y de cuerpos técnicos (decisión ya tomada en v16, sigue sin datos reales que mostrar).
  - **Comparador:** página nueva `/comparador` (3 pestañas: Jugadores, Equipos, Temporadas), buscador
    con debounce reutilizando `/players?search=`/`/teams?search=`, comparación lado a lado
    reutilizando los mismos endpoints de `stats` ya construidos (sin backend nuevo salvo lo que ya
    existía). Temporadas compara dentro de una misma competición vía `/stats/overview`. Rankings
    (máximos goleadores/asistentes) ya había quedado cubierto en Estadísticas (v22) -- no se duplicó.
  - **Bug real detectado y corregido en el camino:** `GET /teams` y `GET /competitions` devuelven
    arrays planos (no `{items,...}`), mientras que `/players`/`/seasons`/`/matches` sí devuelven la
    forma paginada -- inconsistencia heredada de cuándo se construyó cada módulo, documentada acá
    para no volver a asumir mal la forma de respuesta en trabajo futuro.
  - Probado de punta a punta con usuarios descartables: transferencia de jugador entre equipos
    (Historial de plantel de ambos equipos correcto), partido 1-0 con gol+amarilla (estadísticas de
    jugador y equipo coinciden exactamente), comparación de dos jugadores con goles distintos
    (resaltado visual del mayor valor correcto). `npx tsc --noEmit -p tsconfig.app.json` sin errores.
    Datos y usuarios de prueba eliminados; base verificada en 0 partidos / 1 usuario / 0 jugadores / 0
    competiciones al terminar cada prueba.
- **2026-08-24 (v24):** Sexto, séptimo y octavo tramo de finalización — **Búsqueda global**,
  **reorganización de menú** y **exportación CSV**. Con esto se completan los 8 puntos priorizados
  acordados con el usuario para este pedido de finalización.
  - **Búsqueda global:** módulo nuevo `search` (`GET /search?q=`), busca en paralelo por
    competiciones/equipos/jugadores/oficiales/entrenadores/temporadas/partidos (7 tipos, tope 5
    resultados por tipo). `GlobalSearch.tsx` en el navbar, con debounce y resultados agrupados por
    tipo. **Decisión honesta:** los entrenadores SÍ aparecen en los resultados (dato real, la consulta
    funciona) pero se muestran no-clickeables ("sin ficha propia") porque el módulo de Entrenadores
    nunca tuvo pantallas de frontend propias (sólo se usan inline dentro de Partidos) -- no se inventó
    una navegación falsa hacia una página que no existe.
  - **Reorganización de menú:** el navbar había crecido a 12 ítems de primer nivel (justo lo que el
    pedido anticipaba). Se agrupó en 5: Inicio, Partidos (sueltos, son el núcleo) + **Gestión**
    (Competiciones/Temporadas/Equipos/Jugadores/Oficiales), **Análisis**
    (Estadísticas/Comparador/Reportes), **Administración** (Parametrizaciones/Seguridad, sólo admin)
    -- misma agrupación que había sugerido el usuario. Menú mobile mantiene la lista plana con
    encabezados de sección (más simple para tacto que dropdowns anidados).
  - **Exportación CSV:** utilidad compartida `lib/csv.ts` (con BOM UTF-8 para que Excel abra tildes/Ñ
    bien, mismo problema de fondo que documenta la memoria del proyecto sobre `sqlcmd -f 65001`),
    cableada en 4 lugares reales: Jugadores, Equipos, Partidos (los tres respetan los filtros
    activos, no sólo la página visible) y Clasificación (tabla de posiciones). Deliberadamente
    NO se implementó PDF/Excel -- requeriría una dependencia nueva no evaluada, fuera del alcance
    acordado para esta pasada.
  - Probado de punta a punta: búsqueda real con navegación confirmada (competición → equipo →
    jugador clickeados, entrenador correctamente no-clickeable), menú agrupado abierto/cerrado y
    navegación confirmada en desktop y mobile (390×844), CSV descargado y verificado byte a byte
    (BOM `EF BB BF` + `José Muñoz,Defensor,Peñarol CSV Test,Paraguay,active` -- acentos perfectos,
    sólo el jugador filtrado, no toda la lista). `npx tsc --noEmit -p tsconfig.app.json` sin errores
    en cada paso. Datos y usuarios de prueba eliminados; base verificada limpia después de cada
    prueba.
- **2026-08-24 (v25):** Dashboard real, agregado después de los 8 puntos priorizados porque el
  pedido original de finalización lo pedía explícitamente y ya era barato de hacer con los
  endpoints de `stats` recién construidos. `DashboardController` sumó `upcoming-matches` (próximos
  5 partidos `scheduled` con fecha ≥ hoy) y `recent-matches` (últimos 5 `finished`, con marcador de
  `match_period_scores`). El Dashboard ahora muestra ambas listas (clickeables al partido) más dos
  gráficos reales (`recharts`, reutilizando `/stats/goals-by-team` y `/stats/matches-by-status` sin
  scope, o sea sistema completo) en vez de sólo los 6 contadores que tenía antes. Probado con un
  partido pasado (resultado real) y uno futuro (a 7 días) sembrados con usuario descartable —
  ambas listas y ambos gráficos coincidieron exactamente con los datos cargados.
- **2026-08-24 (v26):** Módulo de Partidos — **Vista táctica interactiva**, pedido en un prompt
  maestro aparte y separado del de finalización (68 secciones). Mismo criterio de todo el resto de
  la sesión: auditar antes de crear, reutilizar lo que ya existe, no inventar datos. Alcance real
  construido, con justificación explícita de lo que quedó fuera:
  - **Auditoría previa:** `dbo.goals` ya tenía `pos_x`/`pos_y` (0-100) desde la migración 015 (v18);
    `dbo.match_lineups` no tenía coordenadas; no existía una tabla de tiros individuales (sólo el
    conteo agregado en `match_team_stats.shots`); no había página de detalle de Estadio/Entrenador en
    el frontend (`Venues`/`Coaches` son módulos mínimos, sin pantallas propias, ya documentado en
    sesiones anteriores); los oficiales del partido se mostraban como texto plano, no clickeables
    hacia su ficha (`/oficiales/:id` ya existía).
  - **Base de datos** (migración 019): `match_lineups` gana `pos_x`/`pos_y` (posición táctica
    normalizada 0-100, `NULL` = sin posicionar todavía, nunca un valor por defecto guardado). Tabla
    nueva `dbo.shots` — tiros que **no** terminaron en gol, mismo criterio que ya separaba
    `penalty_kicks` de `goals` en la migración 015: un tiro convertido ya es una fila de `goals`, acá
    sólo van `saved`/`blocked`/`off_target`/`post`, con `xg` opcional para cuando exista un modelo
    real (no se calculó ningún xG automáticamente, sólo se preparó el campo).
  - **Backend:** `setLineupPosition` (`PATCH /matches/:id/lineups/:lineupId/position`), CRUD de tiros
    y `GET /matches/:id/shot-map` (combina `goals` con coordenadas + `shots`, sin duplicar datos).
  - **Frontend:** cancha SVG reutilizable (`components/pitch/FootballPitch.tsx`, líneas/áreas/círculo
    dibujados con paths, no una imagen estática — pedido explícito), `PlayerMarker.tsx` (arrastrable
    en modo edición, clickeable en modo vista), `PlayerInfoPanel.tsx` (panel contextual con
    estadísticas reales de ESE partido — minutos/goles/asistencias/tarjetas, ya calculadas por
    `MatchParticipantsService.listLineups` desde v18 — más `[Ver jugador]`/`[Editar]` hacia las
    páginas YA existentes, sin duplicar el formulario). Pestaña nueva "Vista táctica" en
    `MatchDetailPage` (reemplaza la pestaña "Físico / GPS", que era un placeholder honesto sin
    contenido real que ahora tiene una razón mejor de existir). Selector Local/Visitante/Ambos
    (con el equipo visitante reflejado verticalmente sólo en "Ambos", para que los dos bancos de
    jugadores no se superpongan), capa de mapa de tiros opcional, lista de suplentes clickeable.
    **Regla "no inventar datos" aplicada acá también:** en modo vista, un jugador sin posición
    guardada simplemente NO aparece en la cancha (no se le asigna una ubicación falsa); en modo
    edición sí se calcula una ubicación de referencia por grupo de posición (Portero/Defensor/
    Mediocampista/Delantero) para que haya algo de dónde arrastrar, pero esa ubicación nunca se
    persiste sola — sólo lo que el admin efectivamente suelta.
  - **Bug real encontrado y corregido durante la prueba (no un artefacto del script, confirmado dos
    veces):** el primer borrador de `PlayerMarker.tsx` pedía la captura del puntero
    (`setPointerCapture`) sobre el `<svg>` contenedor en vez de sobre el propio `<g>` que escucha
    `pointermove`/`pointerup` -- con la captura mal targeteada, los eventos redirigidos nunca
    llegaban al marcador después del `pointerdown` inicial, así que arrastrar un jugador no hacía
    nada (ni visualmente ni en la base). Confirmado con Playwright real: el primer intento de
    arrastre no cambió `pos_x`/`pos_y` en `dbo.match_lineups` (verificado por SQL directo, no sólo
    por la captura de pantalla). Corregido moviendo `setPointerCapture`/`releasePointerCapture` al
    propio `<g>` (`e.currentTarget`); reverificado con SQL directo después: `pos_x=22.59,
    pos_y=76.24` — coincide con el arrastre real hecho por el mouse simulado.
  - **Wiring adicional aprovechando la misma pasada:** nombre del oficial en la pestaña Arbitraje
    ahora es un link real a `/oficiales/:id` (antes era texto plano) -- pedido explícito de la
    sección 5 del prompt, barato de corregir una vez detectado en la auditoría.
  - **Explícitamente fuera de alcance, con motivo (no un olvido):** mapa de pases (cientos de pases
    por partido, sin fuente de datos realista para cargarlos a mano -- mismo principio que ya
    aplicaba a heatmap/GPS en v18); heatmap, recorrido y posición-media-como-serie-temporal
    (requieren tracking real con múltiples puntos en el tiempo, hoy sólo existe UNA posición táctica
    estática por jugador, no una trayectoria); tabla de tracking GPS cruda (la estructura ya
    preparada para esto es `match_advanced_metrics`, formato atributo-valor con `provider`, de v18 --
    agregar una tabla de pings crudos ahora sería diseñar a ciegas el formato de un proveedor que
    todavía no se eligió); reproducción/animación del partido (explícitamente no obligatoria según
    el propio pedido); "Modo analista" como pantalla separada (sus capas -- pases/heatmap/duelos --
    no tienen datos reales hoy, así que hubiera sido una segunda pantalla vacía; sus capacidades ya
    disponibles quedaron en la misma pestaña Vista táctica); página de detalle de Estadio (el módulo
    Venues sigue sin frontend propio, mismo estado que Coaches -- no se armó un "Ver/Editar estadio"
    porque no hay a dónde llevarlo todavía).
  - Probado de punta a punta con usuario descartable: 2 equipos de 5 titulares + 1 suplente,
    posiciones explícitas para 2 jugadores, gol con coordenadas + 2 tiros no convertidos, selector
    Local/Visitante/Ambos, panel contextual con estadísticas reales del partido, arrastre con
    persistencia verificada por SQL, capa de mapa de tiros (gol en amarillo, tiros en blanco,
    ubicados correctamente cerca del arco correspondiente). `npx tsc --noEmit -p tsconfig.app.json`
    sin errores. Backend recompiló sin errores (rutas nuevas confirmadas en el log). Datos y usuario
    de prueba eliminados; base verificada en 0 partidos / 1 usuario / 0 jugadores / 0 competiciones /
    0 tiros al terminar.
- **2026-08-24 (v27):** Seguridad — **Motor de Importación y Sincronización de Datos**, pedido en dos
  prompts maestros consecutivos (motor base + selector dinámico de alcance). Antes de escribir una
  sola línea de scraper se hizo lo que el propio pedido exigía en su §34/§7.1 del documento de
  futuro: analizar técnicamente la fuente real antes de implementar.
  - **Hallazgo real (no hipotético):** el `robots.txt` de worldfootball.net (fetched verbatim,
    `https://www.worldfootball.net/robots.txt`) bloquea explícitamente `User-agent: ClaudeBot` con
    `Disallow: /`, junto con GPTBot/Google-Extended/CCBot/Bytespider/Amazonbot/Applebot-Extended/
    meta-externalagent/CloudflareBrowserRenderingCrawler — es decir, todo rastreador de IA conocido
    por nombre. El user-agent genérico (`*`) tiene `Allow: /` pero declara
    `Content-Signal: ai-train=no, use=reference`.
  - **Decisión, consultada con el usuario en vez de resuelta unilateralmente:** dado que el proceso
    lo construiría y operaría Claude, usar un user-agent genérico para esquivar el bloqueo específico
    de "ClaudeBot" sería rodear una decisión explícita del sitio, no respetarla. Se le presentaron 3
    opciones (construir el motor sin esta fuente / construir el motor + un conector CSV manual /
    proceder igual con el scraper real) — eligió la primera. **No se construyó ningún scraper contra
    worldfootball.net.**
  - **Se construyó en cambio el motor genérico completo**, sin ninguna fuente conectada, exactamente
    como pedía §30/§37 del segundo prompt ("la lógica de progreso/lotes/pausa/cancelación/
    reanudación/comparación/conflictos/auditoría debe pertenecer al motor, no a un único botón").
    Migración `020`: `dbo.sync_sources` (worldfootball sembrada con `status='blocked'` y el motivo
    real de arriba, no oculto), `dbo.sync_runs` (progreso/pausa/cancelación/simulación),
    `dbo.sync_run_stages`, `dbo.sync_conflicts`, `dbo.sync_errors`, `dbo.sync_log_entries`. Backend
    nuevo `import-engine`: `EntityMatcherService` (coincidencia por `external_id` exacto o nombre
    normalizado idéntico → automática; cualquier otra similitud → **siempre** conflicto, nunca
    auto-fusión con incertidumbre — regla explícita del pedido), `SyncRunsService` +
    `ImportEngineController` bajo `AdminOnlyGuard` (mismo guard que ya usa Seguridad, ningún sistema
    de permisos nuevo), con auditoría real en `dbo.audit_log` en cada acción (crear/pausar/reanudar/
    cancelar corrida). Frontend: pestaña nueva "Importación de datos" en Seguridad
    (`ImportSyncPanel.tsx`) — lista de fuentes con estado y motivo real, historial de
    sincronizaciones (genuinamente vacío, no fabricado), vista de detalle de corrida lista para
    cuando exista una real. Contrato `SourceAdapter` (`import-engine/types.ts`) definido para que
    conectar una fuente futura sea implementar una interfaz, no rediseñar el motor.
  - **Bug real encontrado y corregido durante la prueba del `EntityMatcherService`** (con datos de
    prueba explícitos, no con datos reales de ninguna fuente): el primer diseño combinaba similitud
    por caracteres (Levenshtein) y superposición de palabras tomando el máximo de ambas. Con nombres
    cortos sin ninguna palabra en común ("Sportivo Trinidense" vs "Cerro Porteño"), la similitud por
    caracteres daba ~26% por puro azar de letras compartidas — suficiente para cruzar el umbral y
    generar un conflicto falso entre dos clubes sin relación real. Corregido: se prioriza la
    superposición de palabras cuando existe (señal confiable), y sin ninguna palabra en común sólo se
    confía en similitud por caracteres si es muy alta (≥75%, típico de un typo en un nombre corto).
    Reverificado con 6 casos reales tras el fix: exact external_id, exact nombre normalizado
    (mayúsculas/acentos), coincidencia parcial genuina ("Olimpia Asunción" vs "Club Olimpia" →
    conflicto, correcto), nombres sin relación → nuevo (ya no falso conflicto), typo de una palabra
    → conflicto (ni se fusiona solo ni se pierde). Probado contra el servicio real compilado por el
    propio `nest start --watch` (endpoint temporal agregado y retirado después de verificar, no una
    reimplementación aparte).
  - Probado también: `AdminOnlyGuard` rechaza correctamente a un usuario no-admin en los 5 endpoints
    (403 real, no sólo ocultar el link); intentar iniciar una sincronización contra `worldfootball`
    es rechazado con el motivo explicado (`"Esta fuente no está disponible..."`); fuente desconocida
    rechazada; ninguna fila quedó en `dbo.sync_runs` tras los intentos rechazados (falla antes del
    INSERT, como corresponde). `npx tsc --noEmit -p tsconfig.app.json` sin errores. Datos y usuarios
    de prueba eliminados; base verificada en 0 `sync_runs` / 1 usuario (`admin`) al terminar.
  - `docs/FUTURO_IMPORTACION_DATOS_EXTERNOS.md` actualizado con el hallazgo completo y el nuevo
    estado ("motor listo, ninguna fuente conectada") — ya no dice "NO implementado", dice
    explícitamente qué parte se implementó y qué parte sigue pendiente y por qué.
  - **Pendiente real, no fabricado:** ningún conector de fuente real (ni WorldFootball.net ni
    ninguna otra); selector dinámico de país/competición/temporada (no tiene sentido sin una fuente
    real detrás — sería el selector-que-no-hace-nada que el propio pedido prohibía); orquestación de
    lotes/reanudación ejercitada de punta a punta (el campo de estado existe, pero sin un
    `SourceAdapter` real no hay nada que orquestar todavía).
- **2026-08-24 (v28):** Bug real reportado por el usuario ("al hacer click en Seguridad y
  Parametrización no me ejecuta nada, se queda ahí, lo mismo con las demás opciones del menú") —
  corregido en `Navbar.tsx`.
  - **Causa raíz:** los menús agrupados (Gestión/Análisis/Administración, agregados en v24) cerraban
    con `onBlur` del botón + `setTimeout(150ms)`. En un click real (mousedown → cambio de foco →
    mouseup → click), el `blur` del botón dispara casi inmediatamente al mover el foco hacia el link
    que se está por clickear, programando el cierre del menú. Si React llega a desmontar el link
    antes de que el evento `click` termine de procesarse (más probable bajo la carga de re-renders
    que tuvo esta sesión larga), el click se pierde sin navegar — exactamente el síntoma reportado.
    Una prueba automatizada con `.click()` sintético (instantáneo) no lo detectaba porque completa
    muy por debajo de la ventana de 150ms; sólo apareció al simular un click humano real (mousedown →
    espera ~80ms → mouseup).
  - **Corregido:** se reemplazó `onBlur`+`setTimeout` por un listener de `mousedown` en `document`
    que cierra el menú sólo cuando el click cae **fuera** de un contenedor referenciado (`useRef`) —
    sin ninguna ventana de tiempo de por medio, no hay carrera posible contra el click de navegación
    porque nunca compite con él (un click adentro del contenedor simplemente no dispara el cierre).
    Se aplicó el mismo arreglo al dropdown de perfil de usuario, que tenía la misma fragilidad
    latente (aunque sin el síntoma reportado, porque sus opciones son botones que navegan y cierran
    en el mismo handler, no links separados).
  - Reproducido y verificado con Playwright simulando movimiento y tiempo de click reales (no
    `.click()` instantáneo): 5/5 clicks en Seguridad exitosos tras el fix (antes del fix no se
    reprodujo el fallo de forma determinística en automatizado, pero la causa estructural — una
    carrera dependiente de tiempo — ya no existe en absoluto, no sólo "es menos probable"). Probado
    también perfil → Mi perfil, Análisis → Estadísticas, Gestión → Equipos, y que clickear afuera
    del menú lo sigue cerrando correctamente (no se perdió esa función al sacar el timeout).
    `npx tsc --noEmit -p tsconfig.app.json` sin errores. Usuario de prueba eliminado.
- **2026-08-24 (v29):** Primera fuente REAL conectada al motor de importación (v27) — **carga de
  archivos CSV/JSON**, a pedido explícito del usuario tras preguntarle "¿qué necesitás para que
  funcione?" sobre el motor sin fuentes. Se le presentaron 3 opciones (archivo / sus propios
  `.div`/`.bak` de Ltrack exportados / una API con licencia) y eligió archivo.
  - Migración `021`: `dbo.sync_sources` gana `file_import` con `status='available'` — primera fuente
    que realmente puede sincronizar algo, sin llamadas a redes externas (sin restricción de
    robots.txt/ToS posible).
  - **Backend:** `file-parser.ts` (parser CSV propio, RFC4180 básico, sin dependencia nueva —
    mismo criterio que ya se usó para `lib/csv.ts` del frontend; soporta también JSON como array de
    objetos), `FileImportService` — reutiliza los `create()` reales de `CompetitionsService`/
    `TeamsService`/`PlayersService` (exportados de sus módulos para esto, antes no lo estaban) en
    vez de reimplementar el INSERT, así que toda la validación existente de esos módulos se respeta
    tal cual. Cada fila pasa por `EntityMatcherService`: exacto → sin cambios; nuevo → se crea (salvo
    en modo simulación); cualquier otro grado de similitud → conflicto registrado, nunca insertado
    automáticamente. Tipos de dato soportados: Competiciones (`nombre`/`tipo`/`deporte`), Equipos
    (`nombre`/`ciudad`/`fundacion`, con la competición destino elegida una sola vez en el formulario,
    no por fila), Jugadores (`nombre`/`apellido`/`posicion`/`nacionalidad`, con el equipo destino
    elegido una sola vez). Endpoint `POST /import-sync/runs/file` (multipart, `AdminOnlyGuard`,
    auditoría real).
  - **Frontend:** formulario "Importar desde archivo" en el mismo panel de Seguridad → Importación
    de datos (aparece automáticamente porque ahora hay una fuente `available`), con selector de tipo
    de dato, selectores en cascada de competición/equipo destino, botones Simular/Importar
    deshabilitados hasta elegir un archivo real. `api.upload()` del frontend ganó soporte para campos
    extra además del archivo (antes sólo mandaba el archivo solo).
  - **Tres bugs reales encontrados y corregidos probando con datos reales, no hipotéticos** (mismo
    patrón que toda esta sesión: cada refinamiento del emparejador de entidades salió de un caso que
    realmente falló, no de razonar en abstracto):
    1. Un placeholder residual (`bumpCounter(runId, 'total_new')`) quedó en `recordError()` por error
       de edición, incrementando "nuevos" en cada fila con error -- corregido antes de cualquier
       prueba visible, encontrado en revisión propia del código recién escrito.
    2. Nombres que sólo comparten un descriptor genérico de club ("Real Halcones" vs "Real Tigres",
       equivalente real a "Deportivo Cali" vs "Deportivo Pasto") daban conflicto falso porque el
       descriptor contaba como palabra "significativa". Corregido con una lista de descriptores
       genéricos (`real`, `club`, `deportivo`, `atlético`, `sporting`, `fc`, etc.) excluidos del
       cálculo de superposición de palabras.
    3. Consecuencia no prevista del fix anterior: si DESPUÉS de quitar el descriptor genérico a
       ambos nombres queda el mismo único token ("Club Zzqxlmpo" vs "Real Zzqxlmpo" → ambos reducen a
       "zzqxlmpo"), la superposición daba 100% y el sistema lo trataba como *coincidencia exacta*
       auto-enlazable -- exactamente lo que NO debía pasar, porque en nombres de clubes reales el
       descriptor suele ser lo que distingue a dos clubes distintos. Corregido: la superposición de
       palabras nunca devuelve 100 (tope 99) -- el 100% real queda reservado exclusivamente para
       cuando el string completo normalizado es idéntico, que ya se resolvía aparte antes de llegar a
       esta función.
  - Probado de punta a punta con usuario descartable: simulación vs. importación real (la simulación
    no persiste nada), re-importar el mismo archivo da "sin cambios" en vez de duplicar, importar
    Equipos con competición destino elegida en el formulario, importar Jugadores con equipo destino
    elegido en el formulario, fila con campo obligatorio faltante genera error sin detener el resto
    del archivo, y los 3 casos de nombres (genérico compartido / palabra distintiva compartida /
    sin relación) dan la clasificación correcta tras los fixes. Probado también desde la UI real
    (Playwright: subir un CSV, click en Importar, ver el resultado con el detalle de la corrida) y
    verificado en base que la competición creada por la UI existe de verdad. `npx tsc --noEmit -p
    tsconfig.app.json` sin errores. Datos y usuarios de prueba eliminados en cada ronda; base
    verificada en 0 competiciones/equipos/jugadores/sync_runs / 1 usuario (`admin`) al terminar.

- **2026-08-25 (v30):** Segunda fuente REAL conectada al motor de importación (v27) — **TheSportsDB.com
  (plan gratuito)**, a pedido explícito del usuario tras el intento fallido con worldfootball.net
  (v27, bloqueado por robots.txt): "en lugar de WorldFootball.net, analiza... y ve si puedes adaptar
  esta api... siempre dando un ambiente donde elegir que año, que torneo y que país poblar".
  - **Investigación real antes de programar** (mismo criterio que worldfootball.net en v27, no se
    asumió nada de la documentación sin verificarlo con llamadas reales): términos de uso de
    TheSportsDB permiten explícitamente scraping vía sus endpoints oficiales ("You can scrape, copy
    and modify any content returned from the API, as long as you use the official end points"), sin
    ninguna restricción para rastreadores de IA a diferencia de worldfootball.net. Límites reales del
    plan gratuito verificados con llamadas reales contra datos paraguayos reales (Primera División,
    Copa Paraguay, División Intermedia), no sólo documentación: máximo 10 equipos por liga (una real
    tiene 12+), 5 filas de tabla de posiciones, 15 partidos por temporada (una real tiene 200+), 10
    jugadores por plantel (uno real tiene 20-30). `all_countries.php` devuelve máximo 50 países y
    Paraguay NO está en esa lista, aunque sus torneos se puedan buscar sin problema pasando
    "Paraguay" directamente como texto — por eso el selector de país en la UI es de texto libre con
    sugerencias (`<datalist>`), nunca un `<select>` limitado a esa lista incompleta.
  - **Backend:** migración `022` (`thesportsdb` con `status='available'` y la razón/límites como
    `status_reason`). `TheSportsDbClient` (nuevo) — cliente HTTP contra la API pública oficial
    (`https://www.thesportsdb.com/api/v1/json/123/...`, clave de prueba gratuita documentada por el
    propio proveedor), con límite propio de ~1 consulta cada 2.2s para respetar el límite documentado
    de 30 req/min. `TheSportsDbImportService` (nuevo) — orquesta competición → temporada → equipos →
    jugadores → partidos en secuencia, reutilizando los `create()` reales de
    `CompetitionsService`/`SeasonsService`/`TeamsService`/`PlayersService`/`MatchesService` (todos
    exportados de sus módulos para esto) y el mismo `EntityMatcherService` que ya usa la fuente de
    archivo. `SyncRunTracker` (nuevo) — se extrajo la lógica de seguimiento de corridas
    (`createRun`/`setStage`/`finishRun`/`bumpCounter`/`log`/`recordError`/`recordConflict`), antes
    duplicada dentro de `FileImportService`, a un servicio compartido entre ambas fuentes; se
    reverificó sin regresión en el flujo de archivo tras el refactor. Endpoints (todos
    `AdminOnlyGuard`): `GET thesportsdb/countries` (sugerencias), `GET thesportsdb/leagues?country=`,
    `GET thesportsdb/seasons?leagueId=`, `POST runs/thesportsdb` (con auditoría real).
  - **Cuarto bug real del emparejador de entidades**, encontrado con datos reales de Paraguay (no
    sintéticos): "Sportivo Luqueño" vs "Sportivo Ameliano" (dos clubes reales sin relación) se
    marcaban como conflicto porque "sportivo" no estaba en la lista de descriptores genéricos
    excluidos. Agregado a `GENERIC_CLUB_WORDS`; reverificado con el mismo import real, ahora ambos se
    crean correctamente como equipos nuevos y los partidos que los involucran se resuelven.
  - **Frontend:** formulario "Importar desde TheSportsDB" en el mismo panel de Seguridad →
    Importación de datos (aparece automáticamente porque la fuente ya está `available`) — campo de
    país de texto libre con `<datalist>` (nunca `<select>` estricto, por el hallazgo de Paraguay
    arriba), selector de torneo poblado en cascada tras buscar, selector de temporada poblado en
    cascada tras elegir torneo, checkboxes independientes para Equipos/Jugadores/Partidos, aviso
    explícito de los topes del plan gratuito ANTES de importar, mensaje de "procesando, puede tardar
    varios minutos" durante la corrida real (nunca una barra de progreso falsa, dado que es una sola
    petición síncrona rate-limited del lado del servidor). Botones Simular/Importar deshabilitados
    hasta tener país + torneo + temporada elegidos.
  - Probado de punta a punta desde la UI real con usuario descartable (Playwright, con temporización
    realista de mouse, no clicks instantáneos): búsqueda de "Paraguay" → 3 torneos reales devueltos
    (Copa Paraguay, División Intermedia, Primera División) → selección de temporada → simulación
    (se detiene honestamente en la competición porque todavía no existe, con el mensaje explicando
    por qué) → importación real (Primera División 2023: competición + temporada + 10 equipos + 6
    partidos creados; 9 partidos más quedaron como error `equipo_no_resuelto` porque involucran a los
    5 equipos reales que el tope gratuito de 10 no devuelve — comportamiento correcto y esperado, no
    un bug, reportado con honestidad en vez de fallar en silencio) → reimportación idéntica confirmó
    `totalNew: 0` (sin duplicados). `npx tsc --noEmit -p tsconfig.app.json` (frontend) y `npx tsc
    --noEmit -p tsconfig.json` (backend) sin errores. Datos y corridas de prueba eliminados; base
    verificada en 0 tras cada ronda.

- **2026-08-25 (v31, "Módulo de Reportes — Centro de Reportes y Análisis"):** pedido de 59 secciones
  para un centro de reportes real (no un listado con botones de PDF). Auditoría previa del proyecto
  antes de programar (pedido explícito §1): `/matches`, `/players` ya traían listados filtrables/
  ordenables/paginados; `/teams`, `/competitions` listados simples; `/stats/*` ya cubría goleadores/
  asistencias/resúmenes por jugador y equipo; `/seasons/:id/standings` ya calculaba la clasificación
  (`StandingsTable.tsx` reutilizable tal cual); `/comparador` ya cubría comparación de jugadores/
  equipos/temporadas; `lib/csv.ts` ya exportaba CSV con BOM UTF-8; los componentes de cancha
  interactiva de v26 (`FootballPitch`/`PlayerMarker`/`TacticalViewTab`) eran reutilizables sin
  cambios. Huecos reales encontrados: sin agregaciones de árbitros/estadios/enfrentamientos, sin
  lectura de `dbo.audit_log` en ningún lado, sin tabla de reportes guardados/favoritos, sin librería
  de PDF/Excel en el proyecto, y sin el módulo "Organización Institucional → Configuración de
  Documentos" que el pedido asumía que podía existir.
  - **Decisiones explícitas de alcance, no builds a medias**: (1) el módulo institucional de
    documentos NO existe — se reutilizó `dbo.login_settings` (nombre del sistema + logo, ya real y
    cargado por el admin) para el encabezado impreso en vez de crear un segundo lugar de
    configuración de identidad. (2) "PDF" se resuelve con una vista de impresión (`ReportLayout` +
    `window.print()`) en vez de agregar `jspdf`/similar — el navegador ya ofrece "Guardar como PDF"
    como destino de impresión, así que previsualización y exportación a PDF son literalmente la
    misma vista (satisface §24/§53 sin descargar primero). (3) "Excel" se resuelve con el mismo CSV
    con BOM ya existente (`lib/csv.ts`), que Excel abre directo sin corrupción — no se agregó
    `xlsx`/`exceljs` real.
  - **Backend — una sola tabla nueva** (migración `023`, `dbo.saved_reports`: filtros/columnas/orden
    como JSON, `is_favorite`) para §31/§32/§33. Todo lo demás reutiliza tablas existentes. Nuevo
    módulo `reports/` (`ReportsService`, `SavedReportsService`, `ReportsController` en
    `/reports/...`, `JwtAuthGuard` para cualquier usuario logueado, `AdminOnlyGuard` sólo en
    `/reports/audit*` por integrarse con Seguridad): `GET referees` (por árbitro con rol
    `main_referee`: partidos dirigidos, amarillas/rojas/faltas/penales ocurridos en esos partidos,
    vía subconsultas correlacionadas — nada existía para esto antes), `GET referees/:id/matches`,
    `GET venues` (partidos/competiciones distintas por estadio — primera pantalla de todo el
    frontend para el módulo Estadios, que antes sólo era un buscador embebido en Partidos), `GET
    venues/:id/matches`, `GET head-to-head?teamAId&teamBId` (enfrentamientos, W/D/L y goles
    calculados en el propio servicio a partir de los partidos reales entre dos equipos), `GET audit`
    (lee `dbo.audit_log` tal cual — esa tabla NUNCA guardó campo/valor-anterior/valor-nuevo, sólo
    acción/entidad/id/detalle/ip/fecha, así que el reporte muestra exactamente eso, sin inventar
    columnas de "antes/después"), `GET audit/actions`/`audit/entities` (listas reales para los
    filtros), CRUD de `saved`. También: `StatsService.cardsByPlayer` nuevo (mismo patrón que
    `topScorers`, para el tab "Tarjetas" de Competición) y `DashboardController.stats` ganó
    `estadios`/`importaciones` (reusa la misma consulta de conteos del Dashboard para las tarjetas
    del Centro de Reportes, en vez de un endpoint de conteos paralelo).
  - **Frontend — arquitectura reutilizable** (§50, `ReportDefinition`/`ReportQuery`/`ReportResult`
    adaptado al proyecto sin nombres literales): `ReportLayout` (encabezado/pie impreso + botón
    Imprimir/PDF, compartido por los 11 reportes), `ReportTable` (columnas mostrar/ocultar, orden,
    paginación en cliente, estado vacío honesto "Sin datos", click-through a la entidad — §33/§34/
    §35/§36/§44 resueltos una sola vez), `SaveReportButton` (§31), `CompetitionSeasonFilter`
    (selector en cascada compartido). 13 pantallas nuevas bajo `pages/reports/`: Centro de Reportes
    (tarjetas con conteos reales, favoritos, reportes guardados), Partidos (reusa `/matches`),
    Partido detallado (agrega los endpoints ya existentes de Partidos — datos generales/equipos/
    arbitraje/alineaciones/eventos/estadísticas — más un tab "Vista táctica" que reutiliza
    `TacticalViewTab` sin forkearlo), Jugadores + Perfil estadístico (honesto: pases/tiros/duelos/
    defensa/xG/xA/heatmap/recorrido se muestran como "No disponible" en gris, nunca un cero
    inventado, porque LeagueCore no calcula nada de eso hoy), Equipos + Perfil de equipo (resumen +
    goleadores del equipo filtrando `/stats/top-scorers` del lado del cliente, sin endpoint nuevo +
    plantilla), Competición (tabs Clasificación/Goleadores/Tarjetas/Calendario), Árbitros y Estadios
    (tabla + modal de drill-down a los partidos), Enfrentamientos, Importaciones (reusa
    `/import-sync/runs`), Auditoría (admin-only). Menú: `/reportes` ya tenía un link en el navbar
    apuntando a un placeholder desde v24 — se reemplazó por el Centro de Reportes real.
  - **Tres bugs reales encontrados y corregidos probando con datos reales** (mismo patrón que toda
    la sesión):
    1. `GET /matches/:id` (a diferencia de `GET /matches`, que sí precalcula `score`) sólo devuelve
       `periodScores` crudo — el reporte detallado de partido mostraba "Sin datos" en el resultado
       de un partido que en realidad tenía 1-1 cargado. Corregido derivando el resultado de
       `periodScores.find(p => p.period === 'full_time')`, igual que ya hace `MatchDetailPage.tsx`
       del módulo Partidos.
    2. La misma pantalla mostraba la hora como `1970-01-01T23:30:00.000Z` en crudo en vez de
       `23:30` — faltaba el mismo `.slice(11, 16)` que ya usa `MatchDetailPage.tsx` para el mismo
       campo. Corregido.
    3. En `ReportTable`, las columnas ordenables (`sortValue` presente) tenían la clase `no-print` en
       el `<th>` para ocultar el cursor/hover de interacción en la vista impresa — pero eso ocultaba
       el ENCABEZADO completo de esas columnas al imprimir, mientras sus celdas de datos seguían
       visibles, desalineando la tabla impresa (ej. en Partidos, "Fecha/Competición/Local/Visitante/
       Estado" desaparecían del encabezado pero sus datos seguían ahí, corriendo el resto de
       columnas). Encontrado recién al revisar una captura en `media: print`, no se veía en pantalla
       normal. Corregido quitando `no-print` del `<th>` (sólo el cursor pointer se condiciona con
       `print:cursor-auto`, que no afecta la visibilidad).
  - Probado de punta a punta con usuario descartable y datos reales (Playwright, importación real de
    Paraguayan Primera División vía TheSportsDB + un estadio, un árbitro, alineaciones/gol/tarjeta
    creados a mano para ejercitar cada sección): Centro de Reportes con conteos reales, Partidos →
    detalle → Vista táctica (reutilizada, honesta con jugadores sin posición guardada), Jugadores →
    Perfil (1 gol real, resto honestamente "No disponible"), Equipos → Perfil (resumen real,
    plantilla real), Competición con sus 4 tabs (clasificación/goleadores/tarjetas/calendario, todos
    con datos reales), Árbitros y Estadios con drill-down modal, Enfrentamientos (1-1 real),
    Auditoría (paginación de servidor con "Cargar más", 181 registros reales, admin-only verificado),
    Importaciones, guardar un reporte + marcarlo favorito + volver a ejecutarlo desde el Centro,
    exportación CSV verificada con archivo real descargado (BOM UTF-8 correcto, tildes/Ñ intactas),
    vista de impresión verificada con `media: print` tras el fix del bug #3. `npx tsc --noEmit -p
    tsconfig.app.json` (frontend) y `-p tsconfig.json` (backend) sin errores en cada punto. Datos y
    corridas de prueba eliminados; base verificada en 0 en todas las tablas de dominio al terminar
    (sólo queda el usuario de prueba `lc_test_tsdb`, reutilizado entre sesiones).
  - Explícitamente fuera de alcance (no builds a medias, documentado): PDF/Excel binarios reales (se
    usa impresión del navegador y CSV, ver arriba), un motor de reportes verdaderamente genérico
    tipo "arrastrar y soltar" (`ReportLayout`/`ReportTable` son reutilizables pero cada pantalla de
    reporte sigue siendo código propio, no configuración declarativa), heatmap/recorrido/mapa de
    pases por jugador (requieren datos de posicionamiento que no existen), permisos granulares
    `REPORTES_VER/EXPORTAR/GUARDAR/ADMINISTRAR` como tabla propia (mapeados sobre el sistema de
    roles admin/editor/viewer ya existente, sin tabla de permisos nueva), botón "Guardar reporte" en
    todas las pantallas (sólo en Partidos/Jugadores/Equipos, las de filtros más ricos).

- **2026-08-25 (v32, "Eliminar WorldFootball.net" + "Importar archivos .div de Ltrack"):** pedido en
  dos partes explícitas del usuario.
  - **Parte 1 — Eliminación de WorldFootball.net.** El origen `worldfootball` (siempre `blocked`
    desde v27, nunca conectado de verdad) se eliminó por completo del sistema, no sólo se ocultó:
    migración `024` borra la fila real de `dbo.sync_sources` (verificado seguro: ningún
    `dbo.sync_runs` la había usado nunca) y corrige el texto de `thesportsdb` que la mencionaba por
    comparación. `docs/FUTURO_IMPORTACION_DATOS_EXTERNOS.md` se reescribió para ser agnóstico de
    fuente (título, §1, §7 y su tabla ya no nombran WorldFootball.net específicamente, aunque
    conservan la misma tabla de clasificación de datos por origen, ahora con columnas genéricas
    "fuente externa típica"/"proveedor especializado"). Comentarios sueltos en código y migraciones
    (`011`, `012`, `021`, `022`, `src/backend/src/import-engine/types.ts`) que la mencionaban de
    paso se genericaron. La memoria de proyecto (archivo dedicado `worldfootball-robots-blocked`) se
    eliminó por pedido explícito; el changelog histórico de v27/v29/v30 (que documenta por qué
    `EntityMatcherService` es tan conservador) se dejó intacto como registro de lo que realmente
    pasó, con una nota de actualización agregada explicando la eliminación posterior.
  - **Parte 2 — Conector real para archivos propios de Ltrack (.div/.bak).** Pedido explícito de
    importar `TORNEO REPUBLICA.div` y "adaptar los datos al sistema para poder visualizarse
    correctamente". El formato es binario propietario de Ltrack v7.0 (Nugget Software, descontinuado,
    sin especificación pública) — la memoria del proyecto y un análisis previo independiente
    (encontrado en `Descargas/LTRACK_INDEX_LECTURA.md`, de otra conversación, con sus documentos
    técnicos NO accesibles desde acá) coincidían en que el camino validado era exportar desde
    Ltrack32.exe a CSV, no reingeniería directa del binario. Se presentó esta disyuntiva al usuario
    (`AskUserQuestion`) junto con un hallazgo real ya encontrado (texto legible de nombres de clubes/
    árbitros dentro del binario, interrumpido por relleno de ancho fijo) — **el usuario eligió
    reingeniería directa**, con el riesgo explícito de interpretar mal un campo aceptado.
    - **Formato reconstruido y verificado con datos reales** (`TORNEO REPUBLICA.div` 380KB +
      `TORNEO REPUBLICA.bak` 1.35MB), documentado en detalle en
      `src/backend/src/import-engine/ltrack-div-parser.ts`: encabezado `05 44 49 56 48 44 [subtipo]`
      + nombre del torneo (ShortString de Delphi); catálogo de equipos en registros de ancho fijo
      (241 bytes en el `.div`, **242 en el `.bak`** — el ancho varía por subtipo, se detecta
      probando un rango en vez de asumir un valor fijo); catálogo de jugadores en registros de 267
      bytes con el nombre y un byte de índice de equipo (1-based) que agrupa correctamente a los
      jugadores en bloques contiguos por plantel real; partidos dispersos por una firma binaria
      reconocible (marcador + par de índices de equipo + goles local/visitante + fecha TDateTime de
      Delphi de 8 bytes), presentes sólo en el `.bak` de prueba (el `.div` resultó ser sólo
      plantel/equipos, sin historial de partidos).
    - **Cinco bugs reales encontrados y corregidos durante la propia reconstrucción** (mismo patrón
      de todo el proyecto: nunca se asumió que un primer resultado plausible era correcto sin
      verificarlo contra los datos reales):
      1. Un campo del encabezado (visto como "8 DE DICIEMBRE" en el archivo real) cae, por pura
         coincidencia de bytes, exactamente un ancho de registro antes del catálogo real de
         equipos — la detección automática de cadena lo contaba de más como si fuera un equipo
         extra, corriendo TODOS los índices de equipo en uno. Corregido recortando entradas del
         INICIO del catálogo hasta que la cantidad coincida con el índice de equipo más alto
         realmente referenciado por jugadores/partidos (esos índices son enteros crudos del
         archivo, independientes de la detección, así que sirven de ancla real).
      2. Ancho de registro de equipo hardcodeado en 241 bytes rompía por completo la lectura del
         `.bak` (que usa 242) — corregido probando un rango de anchos plausibles y quedándose con
         el que arma la cadena más larga, en vez de asumir un valor fijo entre subtipos de archivo.
      3. Offset del byte de longitud del nombre de jugador mal calculado en el parser (7 en vez de
         8) — desalineaba la lectura del índice de equipo de cada jugador y hacía que los 633
         jugadores quedaran sin equipo asignado (`teamIndex: null`) pese a que el dato SÍ estaba ahí
         y era correcto. Encontrado recién al re-verificar contra el mismo byte que ya se había
         confirmado manualmente antes de escribir el parser.
      4. La búsqueda de partidos escaneaba el archivo completo, incluyendo los propios catálogos de
         equipos/jugadores (datos binarios densos, con mucho relleno numérico) — contra el `.div` de
         prueba, que estructuralmente no tiene ningún partido, esto generaba más de 100 coincidencias
         falsas por puro azar. Corregido excluyendo directamente el rango de bytes de esos catálogos
         de la búsqueda de partidos, en vez de intentar afinar la firma al infinito.
      5. El filtro de "8 bytes en cero antes de la firma" (patrón real observado en cada partido
         verificado a mano) se había implementado revisando sólo 4 bytes -- no reducía casi nada los
         falsos positivos hasta corregirlo a los 8 bytes reales.
    - **Backend:** `ltrack-div-parser.ts` (función pura, sin dependencias de NestJS, probada de forma
      aislada contra los archivos reales antes de integrarla), `LtrackDivImportService` (mismo
      patrón que los otros dos conectores: `EntityMatcherService` para coincidencias/conflictos,
      `SyncRunTracker` para seguimiento de la corrida). Temporada resuelta por año calendario de
      cada partido (una temporada real puede cruzar de un año a otro; misma heurística ya usada por
      el conector de TheSportsDB). Endpoint extra `POST /import-sync/ltrack/inspect` (analiza el
      archivo SIN tocar la base) para la vista previa obligatoria del formulario. Migración `025`
      siembra `ltrack_div` como fuente `available`, con el texto explicando honestamente que es un
      formato reconstruido, no oficial.
    - **Frontend:** formulario "Importar desde Ltrack (.div / .bak)" en el mismo panel de Seguridad →
      Importación de datos. Exige "Analizar archivo" primero (llama a `/ltrack/inspect`) y muestra
      equipos/jugadores/partidos encontrados + advertencias reales ANTES de habilitar Simular/
      Importar -- dado que el formato no tiene especificación oficial, nunca se permite disparar una
      importación a ciegas.
    - **Probado de punta a punta con datos reales** (Playwright + llamadas directas a la API, usuario
      descartable): análisis del `.div` real (42 equipos, 633 jugadores, 0 partidos, mostrado
      correctamente en la UI con sus advertencias), importación real (equipos/jugadores creados;
      nombres abreviados típicos de Ltrack como "A. PEREIRA" generaron conflictos reales por
      similitud incierta -- comportamiento correcto, no un bug), reimportación idéntica confirmó
      `totalNew: 0`, importación real del `.bak` del mismo torneo agregó 42 partidos reales con
      fecha/resultado (algunos nombres de equipo variaron levemente entre archivos --ej. "MCAL LOPEZ"
      vs "MCAL LOPEZ DE PILAR"-- y quedaron correctamente como conflicto para revisión manual, nunca
      fusionados a ciegas). `npx tsc --noEmit -p tsconfig.app.json` (frontend) y `-p tsconfig.json`
      (backend) sin errores. Datos y corridas de prueba eliminados; verificado que sólo quedó
      actividad real y genuina del usuario (una importación de TheSportsDB para "Copa Paraguay" bajo
      la cuenta `admin`, `user_id=1` -- no tocada, no es dato de prueba).
    - **Límite honesto, no oculto:** el `.bak` de prueba resultó tener un catálogo de equipos más
      grande (61) que el `.div` (42), probablemente por abarcar más temporadas/fases históricas del
      mismo torneo -- no se investigó más a fondo si eso implica alguna forma de mezcla entre
      divisiones dentro del mismo backup. Dado que cada equipo pasa individualmente por
      `EntityMatcherService` antes de crearse (nunca se crea nada en bloque sin pasar por
      coincidencia/conflicto), esto no representa un riesgo de corrupción de datos aunque la
      composición exacta del archivo no esté 100% explicada.
- **2026-08-25 (v33, "Reconstrucción histórica de Paraguay — limpieza de datos + analizador/importador
  RSSSF"):** pedido de 38 secciones numeradas, con una regla de proceso explícita y no negociable:
  **"NO programes inmediatamente"** — analizar base de datos actual, modelo, módulos, relaciones,
  sistema de importación existente y la fuente RSSSF real, y presentar un análisis A-I (diagnóstico,
  propuesta técnica, estructura de importación/datos, normalización, duplicados, conflictos,
  reanudación, plan) **antes** de escribir código. Se siguió ese orden.
  - **Limpieza de datos deportivos de prueba (§1-§2).** Se analizaron las relaciones/FK de todas las
    tablas deportivas antes de borrar nada, se determinó el orden seguro
    (`match_shootout_kicks/penalty_kicks/offsides/fouls/cards/goals/substitutions/match_interruptions/
    match_*_stats/match_lineups/match_officials/match_coaches` → `matches` →
    `player_team_history/season_teams` → `seasons` → `teams/coaches/officials/venues` →
    `competitions` → `sync_*`), y se le mostró al usuario qué se iba a borrar antes de ejecutar. Se
    preservaron explícitamente `users`, `parameters`, `parameter_categories`, `sync_sources`,
    `sessions`, `login_settings`, `audit_log`, `official_types` (nada de seguridad/parametrización/
    configuración se tocó). El usuario confirmó por `AskUserQuestion` borrar también "Copa Paraguay"
    (dato de prueba real del propio admin, vía TheSportsDB) como parte de la limpieza. Todos los
    IDENTITY deportivos se reiniciaron (`DBCC CHECKIDENT ... RESEED, 0`); verificado un estado 100%
    limpio (0 filas en toda tabla deportiva, `users`/`parameters`/`sync_sources` intactos) antes de
    construir nada nuevo.
  - **RSSSF (rsssf.org) analizado y verificado como fuente, no asumido.** Sin `robots.txt` (404),
    con permiso explícito de copia citando la fuente ("Access to all data collected in the archive
    shall be free for anyone with access to the WWW") — contraste deliberado con el bloqueo de
    WorldFootball.net de v27/v32, que sigue completamente eliminado y no se reintrodujo. Estructura
    HTML real (no interpretada por IA — bajada con `curl` e inspeccionada byte a byte) confirmada:
    contenido dentro de bloques `<pre>` de texto plano, **codificación Latin-1/Windows-1252, no
    UTF-8** (verificado con `Buffer.toString('latin1')` vs `'utf8'` sobre "Cerro Porteño" real —
    decodificar como UTF-8 habría corrompido en silencio cada nombre con tilde/ñ), tres formatos
    estructurales distintos por época: 1906-1959 un único documento disperso (`parahist.html`, a
    veces sólo el campeón), 1960-2007 una página por año con una sola tabla, 2008+ con
    Apertura/Clausura y sub-fases anidadas (Regular/Playoff Stage). `parachamp.html` es el índice
    maestro de campeones de Primera División (única referencia cruzada confiable de qué años
    existieron y quién ganó).
  - **Motor de normalización/duplicados/conflictos reutilizado sin cambios** (`EntityMatcherService`
    + `SyncRunTracker`, los mismos que ya usan TheSportsDB/Ltrack/archivo): coincidencia exacta por
    nombre → vincula; cualquier otra similitud → siempre conflicto para revisión manual, nunca
    fusión automática (confirmado por el usuario vía `AskUserQuestion` para el caso específico de
    clubes que cambiaron de nombre históricamente — nunca crear "Club X" y "Club X (antes)" como
    entidades separadas sin marcarlo, pero tampoco fusionarlas a ciegas). Dos adiciones reales al
    esquema, ambas mínimas (migración `026`): `dbo.team_name_history` (mismo patrón que
    `player_team_history`, existe pero ningún flujo la escribe todavía — el rediseño de nombres
    históricos de club queda como trabajo futuro) y `seasons.data_completeness` (`completo` /
    `parcial` / `fragmentario` / `desconocido` / `no_disponible` / `no_aplica`, calculado por una
    función pura `completenessFor()` a partir de filas de tabla + partidos + campeón conocido — nunca
    inventa 22 partidos cuando sólo se sabe el campeón).
  - **Conector nuevo:** `rsssf-parser.ts` (funciones puras, sin dependencias de NestJS/DB) +
    `rsssf-client.service.ts` (throttle de 1.5s, `User-Agent` identificable, 404 tratado como "no hay
    página para ese año" y no como error) + `rsssf-import.service.ts`, registrados en
    `import-engine.module.ts` y expuestos en `import-engine.controller.ts`
    (`POST rsssf/analyze`, `POST runs/rsssf`). Primera fuente del motor que corre en **segundo plano
    real dentro del mismo proceso Node** (el controller dispara `executeRun()` sin esperarla) con
    **checkpoint de reanudación** (año completado guardado en `sync_runs.scope_json.checkpoint`,
    reanudable desde el año siguiente, no desde cero) y **pausa/cancelación honradas de verdad**
    entre cada año procesado (`SyncRunTracker.getControlFlags`), no sólo aceptadas y  	ignoradas.
    Migración `027` siembra `dbo.sync_sources` con `code='rsssf'`.
    - **Cinco bugs reales encontrados y corregidos contra HTML real** (nunca contra HTML "leído" por
      un modelo — `WebFetch` da una interpretación, no el HTML exacto; se usó `curl` para bajar
      páginas reales y probar el parser contra ellas): (1) filas de tabla de posiciones mal
      interpretadas como partidos porque la columna GF-GA ("15-5") calzaba con la regex de resultado
      de partido; (2) el campeón del índice de campeones se perdía por tratar mal el prefijo de fase
      entre paréntesis; (3) los años 2008+ meten Apertura/Clausura como subtítulos de texto plano
      dentro de un mismo bloque `<pre>`, no como secciones HTML separadas — requirió una segunda capa
      de división en bloques por torneo; (4) para 1906-1959 el encabezado real es sólo el año
      ("1906"), no un nombre de competición — se fijó a "Primera División" para esa era en vez de
      crear una competición nueva por año; (5) la vista previa de sólo lectura no cruzaba
      `parachamp.html` igual que la importación real, subestimando la completitud mostrada al admin.
    - **Sexto bug encontrado recién al probar el panel nuevo de punta a punta** (no durante la
      construcción del parser, sino corriendo `/rsssf/analyze` real contra 1960): el cruce con el
      índice de campeones no verificaba a qué división pertenecía cada bloque, así que "Segunda
      División" y "Tercera División" (sin tabla ni partidos propios ese año) heredaban por accidente
      el campeón real de Primera División ("Olimpia") sólo por compartir el mismo año — dato
      inventado para una división de la que RSSSF no dice nada, violación directa de la regla de no
      inventar datos (§17). Corregido excluyendo divisiones inferiores (detectadas por encabezado:
      "segunda"/"tercera"/"cuarta"/"reserva"/"intermedia") del cruce con el índice de campeones, tanto
      en la vista previa como en la importación real. Verificado el arreglo con una corrida real
      (1958-1960): Segunda/Tercera División vuelven a mostrar `champion: null` /
      `no_disponible` correctamente, mientras Primera División sigue mostrando su campeón real
      ("Olimpia") con fuente y fecha de consulta en las observaciones de la temporada.
  - **Panel de frontend nuevo** (`RsssfImportPanel.tsx`, dentro de Seguridad → Importación de datos,
    mismo patrón que TheSportsDB/Ltrack/archivo): País fijo "Paraguay", año desde/hasta, filtro de
    competición opcional, checkboxes Equipos/Partidos (jugadores individuales no están disponibles en
    esta fuente — RSSSF no da planteles, sólo resultados y goleadores de texto libre, y no se
    intentó crear jugadores a partir de esos nombres sueltos por el riesgo real de identidad
    incierta), botón "Analizar" (llama a `/rsssf/analyze`, sólo lectura, muestra tabla año por año con
    ✓/✗ y un resumen agregado de totales antes de habilitar la importación real — cumple el paso
    obligatorio de vista previa de §9), botón "Poblar todo Paraguay" (precarga 1906-año actual sin
    saltarse el análisis), y una vez iniciada la importación real, barra de progreso **real** con
    `polling` cada 2s a `GET /import-sync/runs/:id` mostrando etapa/porcentaje/procesados/nuevos/sin
    cambios/conflictos/errores en vivo, más pausar/cancelar/reanudar conectados a los endpoints ya
    existentes del motor.
  - **Probado de punta a punta con datos reales** (llamadas directas a la API con el mismo usuario
    descartable de siempre, replicando exactamente las llamadas que hace el panel nuevo): análisis
    real de 1958-1960 mostró conteos y estados de completitud correctos; importación real del mismo
    rango creó 1 competición, 2 temporadas (1958 completa con partido y campeón reales, 1959 parcial
    sin inventar nada) y 7 equipos reales; un partido con equipos no resolubles quedó correctamente
    como error registrado en vez de romper toda la corrida; nombres de competición con similitud
    parcial contra "Primera División" (66.7%/33.3%) quedaron correctamente como conflicto para
    revisión manual en vez de fusionarse o duplicarse a ciegas — exactamente el comportamiento
    exigido en §13-16. `npx tsc --noEmit -p tsconfig.app.json` (frontend) y `-p tsconfig.json`
    (backend) sin errores. Toda la corrida de prueba se eliminó después y se verificó que la base
    volvió a 0 filas en toda tabla deportiva.
  - **Pendiente, no construido en esta entrega (dejado explícito, no oculto):** una corrida real
    "poblar todo Paraguay 1906-2026" (costo real de más de cien consultas HTTP con throttle propio,
    no se ejecutó de punta a punta en esta sesión — el conector queda listo y verificado en una
    muestra representativa, disponible para que el admin la dispare desde el panel); una UI dedicada
    para resolver manualmente los conflictos de "posible cambio de nombre de club" (existen como
    `sync_conflicts` genéricos cuando la similitud de texto supera el umbral, pero un cambio de nombre
    real con similitud casi nula hoy NO se marcaría como conflicto — límite conocido, no resuelto);
    tablas de posiciones separadas por fase (Apertura/Clausura comparten hoy una sola fila de
    temporada, así que `SeasonsService.getStandings()` las mezclaría si ambas ya tuvieran partidos
    cargados).
- **2026-08-25 (v34, "Mejora del módulo de Seguridad — Usuarios y roles"):** pedido explícito de NO
  reconstruir el módulo de Seguridad desde cero, sino analizar lo existente y agregar gestión de
  usuarios + exactamente dos roles (ADMINISTRADOR/BÁSICO), con la regla de proceso de siempre
  (diagnóstico → cambios necesarios → estructura → plan → recién ahí implementar).
  - **Diagnóstico real, no asumido:** ya existían todas las columnas necesarias en `dbo.users`
    (username/email únicos, password_hash con bcrypt, is_active, etc.), `AdminOnlyGuard` ya protegía
    Configuración del Login/Importación de datos, y el menú (`Navbar.tsx`) ya ocultaba
    Administración para no-admins. Lo que NO existía: ningún CRUD de usuarios (`auth.service.ts`
    sólo tenía autoservicio). Se encontraron **dos gaps reales de seguridad** verificando el código,
    no supuestos: `parameters.controller.ts` (Parametrizaciones) sólo exigía estar logueado, sin
    `AdminOnlyGuard` — cualquier autenticado podía crear/editar parametrizaciones por API; y
    `ParametersPage.tsx` no tenía ningún guard de rol en el frontend (a diferencia de
    `SecurityPage.tsx`, que sí lo tenía), alcanzable por URL directa.
  - **Roles reducidos a exactamente dos** (migración `028`): `CK_users_role` pasó de permitir
    `admin`/`editor`/`viewer` (los últimos dos nunca se usaron en ningún lado del código, verificado
    por grep — puro resto de esquema sin lógica detrás) a sólo `admin`/`basico`. Nueva fuente única
    de verdad `src/backend/src/auth/roles.ts` (`USER_ROLES`, `ROLE_LABELS`) que alimenta los DTOs, el
    `<select>` del formulario y el label mostrado en Mi perfil — nunca "ADMINISTRADOR"/"BÁSICO"
    hardcodeado en dos lugares distintos.
  - **Módulo `UsersModule` nuevo** (`src/backend/src/users/`): `GET/POST /users`,
    `GET/PUT /users/:id`, `PATCH /users/:id/status`, `POST /users/:id/reset-password`,
    `PATCH /users/:id/password` (que un admin le fije una contraseña específica a otro usuario,
    distinto de "restablecer a 123456"), `DELETE /users/:id` — todo bajo
    `AdminOnlyGuard` y auditado (`create_user`/`update_user`/`delete_user`/`activate_user`/
    `deactivate_user`/`admin_reset_password`/`admin_change_password`) reusando `dbo.audit_log` tal
    cual ya existía, sin tabla nueva. `DELETE` sigue el mismo patrón FK-547 ya usado en todo el
    proyecto (equipos/jugadores/oficiales): si el usuario tiene historial asociado
    (sesiones/auditoría/corridas de importación/reportes guardados), sugiere desactivar en vez de
    romper la relación — nunca elimina a ciegas.
  - **Protección real de la cuenta `admin`** (no sólo un comentario): no se le puede cambiar el rol,
    ni desactivarla, ni eliminarla — verificado con una corrida real contra el backend, las tres
    devuelven 403 con mensaje explicativo, incluso pedidas por OTRO admin real (no sólo bloqueado
    para BÁSICO, que de todos modos nunca llega al módulo). Extra, no pedido explícitamente pero
    consistente con "protegerse para evitar quedar sin administrador": ningún usuario puede
    desactivarse o eliminarse a sí mismo, tampoco verificado con una corrida real.
  - **Cerrado el gap de Parametrizaciones**: `AdminOnlyGuard` agregado a `parameters.controller.ts`
    (se confirmó primero que ningún formulario deportivo depende de ese endpoint — sólo
    `ParametersPage.tsx` lo llama; Partidos/Jugadores/etc. usan sus propias listas fijas en el
    frontend — así que el cambio no rompe nada fuera de la propia pantalla) y el mismo guard
    frontend que ya usaba `SecurityPage.tsx` se replicó en `ParametersPage.tsx`.
  - **Frontend**: nueva pestaña "Usuarios" (primera pestaña, antes de Configuración del Login) dentro
    de la `SecurityPage.tsx` existente — ninguna página/ruta nueva, mismo patrón de tabs ya
    establecido. `UsersPanel.tsx`: tabla Usuario/Nombre/Rol/Estado/Último acceso/Acciones
    (Ver/Editar/Activar-Desactivar/Restablecer contraseña/Eliminar), formulario de alta con rol
    limitado a un `<select>` de dos opciones (nunca texto libre). "Cambiar contraseña de un usuario"
    (§12, distinto de "restablecer a 123456") se resolvió como un campo opcional "Nueva contraseña"
    dentro del propio formulario de edición, en vez de un sexto botón en la fila.
  - **Un bug real, no cosmético, encontrado en la propia revisión antes de probar**: el guard de
    rol agregado a `ParametersPage.tsx` se había escrito con un `return` anticipado ANTES de la
    llamada a `useEffect` — viola las Reglas de Hooks de React (un hook nunca puede quedar después
    de un return condicional, aunque en este caso puntual no se manifestara como error visible de
    inmediato). Corregido moviendo el guard después de todos los hooks, mismo lugar exacto donde ya
    lo tenía `SecurityPage.tsx`.
  - **Una decisión de interpretación, comunicada al usuario en vez de asumida en silencio**: "Fuentes
    externas/Importación de datos" se dejó admin-only (no se abrió a BÁSICO) — la matriz concreta del
    pedido no la lista como fila para BÁSICO, y ya era admin-only por un pedido explícito de una
    sesión anterior; cambiarlo no estaba pedido de forma inequívoca.
  - **Verificado de punta a punta contra el backend real** (script Node replicando exactamente las
    llamadas del panel, no sólo lectura de código): usuario BÁSICO de prueba creado → login OK, rol
    correcto en `/auth/me` → `/parameter-categories`, `/users` e `/import-sync/sources` devuelven 403
    → el mismo usuario SÍ pudo crear/ver/editar/eliminar una competición y un equipo reales (CRUD
    deportivo completo, sin restricciones) → intentos de eliminar/desactivar/degradar la cuenta
    `admin` real devolvieron 403 los tres → auto-eliminación de la propia cuenta admin de prueba
    devolvió 403 → usuario desactivado no pudo loguearse (401) → reseteo de contraseña por admin
    funcionó. `npx tsc --noEmit` limpio en frontend y backend. Toda la data de prueba (usuario
    BÁSICO, competición y equipo de prueba) eliminada al final; estado de la base verificado limpio.
- **2026-08-25 (v35, cuatro bugs reales del parser RSSSF encontrados con datos de producción del
  propio usuario):** el usuario corrió una importación real (Sincronización #8, 474 registros
  analizados, 128 nuevos, 26 conflictos, **119 errores**) y pidió explicación de los conflictos y
  errores mostrados. El análisis de las causas encontró cuatro bugs reales en el parser (v33),
  verificados contra el HTML real de rsssf.org (`para65.html`), no supuestos:
  1. **Anotación de sede neutral pegada al nombre del equipo visitante**: líneas tipo
     "Rubio Ñu   2-1 Nacional   [at Olimpia]" (Copa Asunción, partidos en sede neutral) dejaban el
     "equipo visitante" parseado como `"Nacional [at Olimpia]"` en vez de `"Nacional"` -- nunca
     resolvía contra ningún equipo real. Responsable de la gran mayoría de los 119 errores
     `equipo_no_resuelto`. Corregido recortando `[at Venue]` del final de la línea.
  2. **Fila de tabla de posiciones sin número de puesto (empate) mal identificada como partido**:
     cuando dos equipos empatan en posición, RSSSF no repite el "N." (ej. "Olimpia" empatado en 1er
     puesto con Cerro Porteño en Torneo Preparación 1965 aparece sin "1." propio) -- esa fila caía
     por las hendijas de la detección de filas de tabla y terminaba interpretada como un partido
     inventado ("Olimpia 8 6 1 1" vs "13 Playoff"), generando otro error más. Corregido con una
     regla adicional (`TIED_ROW_RE`) que hereda la posición de la fila anterior sólo cuando el resto
     de la línea tiene forma real de columnas estadísticas.
  3. **Nombre de competición con el rango de temporada pegado, distinto de la barra baja usada para
     un solo año**: `resolveCompetitionName` ya sabía recortar "Campeonato... 1960" (año simple),
     pero no "Copa República 1963/64" (rango con barra) -- cada año generaba una competición nueva
     ("Copa República 1963/64", "Copa República 1964/65", ...) en vez de reutilizar la misma,
     generando conflictos falsos año tras año. Corregido extendiendo el recorte a también aceptar el
     formato "NNNN/NN".
  4. **El más silencioso y con más impacto real en los datos**: la columna de goles (GF-GC) usa
     relleno de espacio para el gol visitante de un solo dígito ("25- 8", con espacio entre el guión
     y el "8") -- el código partía la línea por espacios ANTES de buscar el patrón "N-N", así que ese
     campo quedaba partido en dos tokens sueltos ("25-" y "8") y el patrón nunca calzaba. Resultado:
     esa fila entera perdía PJ/PG/PE/PP/GF/GC en silencio (mostraba `null`), incluyendo la fila del
     **propio campeón** de Torneo Preparación 1965 (Cerro Porteño). Corregido buscando el patrón de
     goles sobre el string completo, antes de partirlo.
  - **Los 26 "conflictos" y el resto de errores no eran bugs**: nombres de competición con
    similitud parcial contra una ya existente (ej. "Primera División" vs "Campeonato de Primera
    División A", 66.7%) quedaron correctamente sin fusionar, a la espera de revisión manual --
    exactamente el comportamiento pedido en el conector original (nunca autofusionar bajo
    incertidumbre). Un único error residual genuinamente exótico ("remaining 42' match" -- un
    partido suspendido y reanudado, con una anotación que no es un simple "[at Venue]") quedó fuera
    de alcance, correctamente fallado en vez de adivinado.
  - **Verificado con una reimportación real del mismo rango (1963-1965)**: de 119 errores (contra un
    rango mayor) bajó a un solo error residual genuinamente exótico; se crearon 38 partidos reales
    nuevos que antes fallaban por el bug de sede neutral. La importación es idempotente (no duplica
    lo ya creado), así que reimportar el mismo rango o volver a correr "Poblar todo" es seguro sin
    borrar nada primero.
  - **Dato ya en la base que quedó con el nombre viejo (pre-fix)**: la corrida original del usuario
    ya había creado la competición `Copa República 1963/64` (id real en la base) con el nombre
    afectado por el bug #3, antes de la corrección -- una reimportación futura del mismo período va a
    generar un conflicto contra ese nombre viejo ("Copa República 1963/64" vs "Copa República"), que
    hay que resolver manualmente (fusionar bajo el nombre correcto) ya que el sistema nunca renombra
    ni fusiona competiciones existentes por sí solo.
  - `npx tsc --noEmit` limpio en frontend y backend. Verificación hecha con una cuenta de prueba
    descartable separada de la cuenta real del usuario (que estaba con actividad real simultánea
    durante esta sesión) -- la cuenta de prueba se desactivó al terminar en vez de eliminarse, porque
    ya tenía una corrida de importación real asociada (mismo criterio de trazabilidad que protege
    manualmente el `DELETE` de usuarios desde v34).
- **2026-08-25 (v36, "Mejoras avanzadas — Importación de datos + Archivos DIV + Conflictos +
  Interfaz visual interactiva"):** pedido de 40 secciones cubriendo tres frentes grandes
  (motor de conflictos + import multi-formato, resolución de archivos DIV, centro visual
  interactivo). Presentado el diagnóstico A-K completo y, dado el tamaño real (tres subsistemas
  independientes, no una mejora), se le preguntó al usuario por dónde empezar en vez de intentar
  los tres a medias -- eligió **"Motor de conflictos + import multi-formato"**, quedando DIV
  (§15-19) y el centro visual (§20-39) explícitamente diferidos para una entrega futura.
  - **Diagnóstico real, no asumido**: el importador de archivo sólo soportaba CSV/JSON y tres tipos
    de entidad (competición/equipo/jugador) sin partidos, sin mapeo de columnas, sin previsualización
    real. El sistema de conflictos (`sync_conflicts`) existía desde v27 pero **era de sólo lectura
    -- nunca se pudo actuar sobre un conflicto** (verificado: 42 conflictos reales seguían
    pendientes en la base del usuario, algunos de semanas atrás). Se confirmó además, leyendo el
    código de `ltrack-div-import.service.ts`, que el "equipo no definido" de los .DIV tiene la
    MISMA causa raíz: un equipo con nombre parecido-pero-no-idéntico cae en el balde "conflicto" y
    nunca entra al mapa de equipos resueltos, así que cualquier partido que lo referencie falla --
    resolver conflictos de verdad also destraba DIV sin tocar el parser DIV en sí.
  - **Motor de conflictos real** (`ConflictResolutionService`, nuevo): dos familias de conflicto
    según `conflict_kind` (migración `029`) -- `duplicate_entity` (¿es la misma entidad o una
    distinta? -- link_existing/create_new/skip) y `field_diff` (misma entidad, algún campo
    distinto -- ej. resultado 2-1 vs 3-1 -- keep_existing/use_imported/skip). `link_existing` ahora
    es una acción real, no cosmética: `competitions`/`teams` ganaron columnas
    `external_source`/`external_id` (mismo patrón que ya tenían jugadores/árbitros/temporadas desde
    antes) para que la PRÓXIMA importación de la misma fuente auto-vincule en vez de repetir el
    mismo conflicto. `POST /import-sync/conflicts/:id/resolve` y `/resolve-bulk` (para "Conservar
    todos"/"Reemplazar todos"/"Omitir todos", §12), con una tarjeta de conflicto nueva en el
    frontend (`ConflictCard.tsx`) que muestra el diff campo a campo real (§11 -- nunca "existe
    conflicto" a secas) y un panel nuevo de "conflictos pendientes" cruzando todas las corridas
    (antes había que entrar corrida por corrida para encontrarlos).
  - **Importador de archivo ampliado**: Excel (.xlsx y .xls legado, vía `xlsx`/SheetJS -- única
    librería nueva del pedido, justificada porque no existe forma razonable de leer el formato
    binario de Excel a mano) y TXT (delimitador auto-detectado: tab/punto y coma/coma/barra,
    contando cuál da un conteo de columnas consistente en las primeras líneas) sumados a CSV/JSON.
    **Cuarto tipo de entidad: Partidos** -- a diferencia de equipo/jugador (que se importan CONTRA
    un padre ya elegido), cada fila de partido trae su propia competición/equipos por nombre, así
    que arrastra su propia validación completa (§8): fecha inválida, resultado inválido, equipo
    inexistente, competición inexistente, campos obligatorios vacíos, equipos iguales -- todo
    verificado con casos reales, cada uno cae en su propio `errorType`.
    - **Mapeo de columnas inteligente** (§6): `POST /import-sync/file/inspect` lee el archivo SIN
      tocar la base, detecta hojas/columnas y sugiere el mapeo comparando cada encabezado detectado
      contra una lista de alias por campo ("Equipo Local"/"Resultado Local" -> `equipo_local`/
      `goles_local`, el ejemplo textual del pedido, verificado tal cual). El admin corrige
      manualmente antes de que exista la opción de importar de verdad.
    - **Plantillas descargables** (§2-4): nunca un archivo vacío -- CSV/TXT/JSON traen encabezados +
      2 filas de ejemplo reales por tipo de entidad; la de Excel es multi-hoja (Competiciones/
      Equipos/Jugadores/Partidos, adaptadas al modelo REAL de LeagueCore, no al ejemplo genérico del
      pedido) más una hoja INSTRUCCIONES con Campo/Obligatorio/Tipo/Ejemplo/Descripción de todos los
      campos. Misma fuente de verdad (`TARGET_FIELDS`) que alimenta la sugerencia de mapeo y la
      validación, para que plantilla/mapeo/validación nunca puedan desalinearse entre sí.
  - **Dos bugs reales encontrados probando el flujo completo de punta a punta** (no durante la
    construcción, sino recién al ejercitar resolución de conflictos con datos reales):
    1. `sync_conflicts` ya tenía, desde v27, un CHECK constraint viejo nunca usado por ningún código
       hasta ahora (`status IN ('ignored','resolved_merge','resolved_use_external',
       'resolved_use_leaguecore','pending')`) -- el nuevo motor usa `status='resolved'` +
       `resolution_action` por separado (más flexible), lo cual violaba ese constraint viejo y
       tiraba un 500 genérico en CADA resolución, aunque el trabajo real (actualizar el partido) ya
       se hubiera aplicado correctamente -- sólo la fila de conflicto se quedaba sin marcar. Migración
       `031` reemplaza ese constraint por uno acorde al vocabulario nuevo.
    2. Un partido reimportado con hora distinta mostraba "Hora: Thu J" en el diff en vez de "Hora:
       18:00" -- mssql devuelve una columna TIME como objeto `Date` de JS, y convertirlo con
       `String()` directo da el `toString()` completo, no la hora; corregido pasando por
       `toISOString().slice(11,16)`, mismo patrón que ya usa el resto del proyecto para horas de
       partido (encontrado antes en el módulo de Reportes, v31).
  - **Verificado de punta a punta contra el backend real** (nunca contra código leído solo):
    plantilla Excel descargada y reimportada con éxito (Competiciones → Equipos → Partidos, en ese
    orden, con `totalNew`/`totalErrors` correctos y de-duplicación real contra datos ya existentes
    de una importación RSSSF anterior); reimportar el mismo partido con resultado distinto generó el
    `field_diff` esperado con el diff campo a campo correcto; resolver "usar importado" actualizó de
    verdad el resultado real en `dbo.matches`/`dbo.match_period_scores`; reimportar sin cambios
    correctamente contado como "sin cambios" (cero conflictos fantasma); las 5 validaciones (fecha/
    resultado/equipo inexistente/campos faltantes/equipos iguales) dispararon cada una su propio
    error; un conflicto de nombre de competición (99% similar) resuelto con "crear como nueva" creó
    correctamente una segunda entidad separada; resolución en bloque (`resolve-bulk`) funcionó sobre
    un conflicto de equipo. `npx tsc --noEmit` y la suite de tests (23 backend + 2 frontend) limpios
    después de cada ronda de cambios. Toda la data de prueba (competiciones/equipos/partidos/
    estadios/conflictos de prueba) eliminada al final, preservando intacta la data histórica real
    importada de RSSSF en sesiones anteriores.
  - **Explícitamente diferido, no construido en esta entrega** (por elección del usuario, no
    supuesto): resolución de equipos en archivos .DIV con niveles de resolución/asignación manual/
    memoria de asignaciones/analizador DIV (§15-19); el centro visual interactivo (cancha por
    partido/equipo/jugador, heatmaps, mapas de pases, comparación visual, vista de estadios) (§20-39)
    -- la base para esto último ya existe y es sólida (`FootballPitch.tsx`/`PlayerMarker.tsx` de v26),
    pero además del tamaño del pedido, las tablas que alimentarían heatmap/mapa de pases/velocidad/
    GPS (`match_player_stats`, `match_player_physical_stats`, `match_player_positions`, `shots`)
    tienen hoy CERO filas reales en la base (verificado con consulta directa) -- construir esa
    interfaz a fondo ahora mostraría "no disponible" en la gran mayoría de los casos hasta que exista
    una fuente real que cargue esos datos.
- **2026-08-25 (v37, tres pedidos juntos en un mismo mensaje): interfaz visual interactiva (bloqueada
  por falta de imagen de referencia) + Estadísticas/Reportes reales dentro de Competiciones +
  mejoras a la plantilla Excel.** El primer pedido dependía explícitamente de analizar una imagen de
  referencia que el usuario dijo que iba a adjuntar pero no llegó adjunta -- se avisó esto de
  entrada y se confirmó con el usuario seguir con los otros dos mientras tanto (§29 del pedido
  original la hace indispensable: "la imagen es referencia de composición/concepto/jerarquía
  visual", no se puede analizar sin verla).
  - **Estadísticas de Competición, real** (`CompetitionStatsTab.tsx`, reemplaza el "Próximamente"):
    la mayoría de los datos ya existían -- `StatsService` (desde v22/v31) ya aceptaba
    `competitionId`/`seasonId` en `overview`/`top-scorers`/`top-assists`/`goals-by-team`/
    `cards-by-team`/`goals-by-season`, así que gran parte de esta pestaña es ensamblar gráficos
    (`recharts`, reusados tal cual de `StatisticsPage.tsx`, extraídos a
    `components/stats/StatsCharts.tsx` para no duplicar el código del gráfico global y el de
    competición) más que construir desde cero. Tres piezas SÍ nuevas en `StatsService`:
    `matchStatsSummary` (splits local/empate/visitante + promedio de goles), `matchExtremes`
    (mayor goleada/partido con más goles/partido con menos goles, cada uno un partido real, nunca
    inventado), `teamsSummaryForCompetition` (tabla ordenable de PJ/PG/PE/PP/GF/GC por equipo,
    cruzando todas las temporadas de la competición o acotada a una si se elige). `overview` también
    se extendió con autogoles/penales/equipos/jugadores.
  - **Reportes de Competición, real** (`CompetitionReportsTab.tsx`): en vez de reconstruir
    clasificación/goleadores/tarjetas/calendario de cero, se extrajeron esas tres secciones de
    `CompetitionReportPage.tsx` (el reporte global ya existente desde v31) a
    `components/reports/CompetitionReportSections.tsx` para reusarlas literalmente, sólo que
    embebidas dentro de Competición → Detalle con la competición ya fija (nunca hay que volver a
    elegirla, cumpliendo la regla de "no perder el contexto" que insistía el pedido de interfaz
    visual). `CompetitionReportPage.tsx` ahora además acepta `?competitionId=` por URL para que el
    botón "Ver reporte completo →" de la pestaña embebida la deep-linkee directo.
  - **Exportación real a Excel** (nuevo, no existía): antes "Excel" era literalmente el mismo CSV
    con BOM abierto en Excel. `POST /reports/export-xlsx` (nuevo, genérico, cualquier reporte puede
    usarlo) recibe lo que la pantalla ya tiene renderizado y genera un libro real con la librería
    `xlsx` (ya sumada en v36 para las plantillas de importación) -- sin volver a consultar la base,
    misma data que ve el admin.
  - **Plantilla de importación ampliada**: dos tipos de entidad nuevos, Estadios y Oficiales
    (`venue`/`official` en `FileImportService`) -- Oficiales resuelve su "tipo" por NOMBRE contra
    `dbo.official_types` ya existente (nunca le pide al usuario el ID interno del catálogo). La
    plantilla Excel pasó de 4 a 6 hojas de datos + INSTRUCCIONES, ahora con sello de versión
    ("LeagueCore v1" + fecha de generación), ancho de columna automático, fila de encabezado
    congelada y autofiltro -- todo verificado que realmente funciona (soportado por la edición
    gratuita de `xlsx`). **Límite técnico honesto, no silencioso**: la edición gratuita de `xlsx`
    (SheetJS) no permite escribir color de fondo en celdas (es exclusivo de su versión paga) --
    por eso la distinción obligatorio/opcional vive como texto en la columna "Obligatorio" de
    INSTRUCCIONES, no como color en el encabezado de cada hoja; además, marcar visualmente el
    encabezado de datos (ej. anteponiendo "*") habría roto el mapeo automático de columnas al
    reimportar la propia plantilla.
  - **Un bug real encontrado sólo al probar de punta a punta, no durante la construcción**: se
    agregaron los tipos `venue`/`official` al union de TypeScript `ImportEntityType` y a toda la
    lógica de servicio, pero se olvidó actualizar la lista `IMPORT_ENTITY_TYPES` del controller (un
    array de VALORES en tiempo de ejecución, no derivado del tipo -- por eso TypeScript no lo marcó
    como error, es perfectamente válido que un array sea un subconjunto del union). Resultado: cada
    endpoint de importación rechazaba "venue"/"official" con 400 "Tipo de entidad inválido" pese a
    que el resto del código ya los soportaba. Encontrado recién al intentar importar la hoja
    "Estadios" real, corregido, reverificado con una corrida real completa.
  - **Verificado de punta a punta con datos reales**: 3 equipos + 3 partidos reales creados a mano
    para probar `matchStatsSummary`/`matchExtremes`/`teamsSummaryForCompetition` -- cada valor
    calculado (mayor goleada, partido con más/menos goles, PJ/PG/PE/PP/GF/GC por equipo) verificado
    a mano contra los partidos cargados, coincide exactamente. Plantilla Excel de 6 hojas descargada
    y reimportada con éxito para Estadios y Oficiales (tipo resuelto por nombre confirmado en la
    base vía JOIN real). `npx tsc --noEmit` y la suite de tests (23 backend + 2 frontend) limpios.
    Toda la data de prueba eliminada al final.
  - **Sigue pendiente**: la interfaz visual interactiva completa (§20-39 del pedido anterior + este
    nuevo pedido de cancha animada/heatmap/mapa de pases/comparación) -- bloqueada por la imagen de
    referencia que todavía no llegó; el modo analista inline (crear/seleccionar/omitir al resolver
    un equipo no encontrado por nombre, §17-19 del pedido de plantillas) tampoco se construyó esta
    vez, queda como una mejora real pendiente sobre el importador de partidos.
- **2026-08-25 (v38, llegaron las 3 imágenes de referencia — vista visual de partido rediseñada.**
  Analizadas como CONCEPTO (composición, jerarquía visual), nunca copiadas literalmente: encabezado
  de equipos + marcador (imagen 1), tarjeta de jugador foto-céntrica (imagen 2), cancha con foto real
  de fondo (imagen 3). **Verificado antes de diseñar, no supuesto**: `teams.logo_url` y
  `players.photo_url` ya existían y son reales -- se usan tal cual; `dbo.venues` no tenía NINGÚN
  campo de imagen; y **no existe ningún campo de rating de habilidad** (nada como ATT/TEC/DEF/TAC/CRE
  ni PAC/SHO/PAS/DRI/DEF/PHY de las imágenes de referencia) -- **deliberadamente no se inventó
  ninguno**, el radar y las "stats" de las tarjetas FIFA se adaptaron a lo que sí es real (goles/
  asistencias/tarjetas/minutos por partido), nunca a un puntaje de habilidad fabricado.
  - **`venues.photo_url` nuevo** (migración `032`) + `POST /venues/:id/photo` (mismo patrón multer/
    diskStorage ya usado en jugadores/oficiales/login) -- sin esto era estructuralmente imposible
    mostrar "la cancha real" de un estadio, como pedía explícitamente la imagen 3.
  - **`FootballPitch.tsx` ahora acepta una foto de fondo real** (`backgroundPhotoUrl`, con una capa
    oscura semitransparente para que las líneas blancas se sigan viendo) -- si el partido no tiene
    estadio registrado o el estadio no tiene foto cargada, cae automáticamente al degradé verde
    genérico que ya existía (exactamente lo pedido: "si no hay cancha registrada, poner un
    genérico", nunca una foto inventada ni una cancha vacía).
  - **`PlayerMarker.tsx` ahora muestra la foto real del jugador** sobre la cancha (círculo recortado
    + dorsal superpuesto), con el mismo círculo de color de equipo + número de antes como
    respaldo cuando el jugador no tiene foto cargada -- nunca una foto genérica de stock.
  - **`PlayerInfoPanel.tsx` rediseñado como tarjeta de jugador** (concepto de la imagen 2): foto
    grande, nombre, posición, nacionalidad, y la grilla de estadísticas reales del partido que ya
    existía (minutos/goles/asistencias/tarjetas) -- **sin ningún número de "rating" inventado**.
  - **`MatchScoreboardHeader.tsx` nuevo** (concepto de la imagen 1): escudos reales de ambos equipos
    (silueta genérica si no hay logo cargado) + marcador central grande + resultado de penales si lo
    hubo (`match.periodScores` ya tenía el período `'penalties'` desde antes) + fecha/hora/estadio.
  - **`TacticalViewTab.tsx` gana listas de plantel con íconos de eventos reales** (concepto de la
    imagen 1: dos columnas numeradas con íconos junto a cada nombre) -- ⚽/🅰️/🟨/🟥 ya venían
    contados en la respuesta de alineaciones; 🔄 (cambio) se cruza contra `GET /matches/:id/timeline`
    (endpoint real desde v18, no se inventó nada nuevo para esto).
  - **`teams.logo_url` tenía la columna pero NUNCA había un endpoint para subirle una foto real**
    (sólo se podía pegar una URL a mano por `PUT /teams/:id`) -- se agregó `POST /teams/:id/logo`,
    mismo patrón multer que el resto del proyecto. Encontrado al probar de punta a punta (el primer
    intento de subir un logo de prueba dio 404).
  - **Segundo bug real encontrado sólo al probar de punta a punta**: `MatchScoreboardHeader.tsx`
    mostraba la hora con `match.matchTime.slice(0, 5)` -- mssql serializa una columna TIME como
    fecha de referencia ISO completa (`1970-01-01T19:00:00.000Z`), así que esos primeros 5
    caracteres son literalmente "1970-", no la hora. El mismo tipo exacto de bug ya se había
    encontrado y corregido antes en Reportes (v31) y en el importador de archivo (v36) -- esta vez
    se coló en un componente nuevo por no reusar el helper existente. Corregido a
    `.slice(11, 16)`, verificado el resultado exacto contra el mismo string real.
  - **Verificado de punta a punta con datos reales, no sólo lectura de código** (sin herramienta de
    navegador disponible esta sesión, así que la verificación fue por llamadas API reales
    replicando exactamente lo que hace cada componente, no una captura de pantalla): estadio +
    equipos + jugadores + partido de prueba creados, foto de estadio y logos de equipo y foto de
    jugador subidos de verdad -- confirmado que `GET /matches/:id` trae `homeTeamLogoUrl`/
    `awayTeamLogoUrl`/`venuePhotoUrl` reales, que `GET /matches/:id/lineups` trae `photoUrl`/
    `nationality`, y que el archivo de la foto del estadio realmente se puede descargar (200,
    `image/png`). `npx tsc --noEmit` y la suite de tests (23 backend + 2 frontend) limpios. Toda la
    data y los archivos de prueba eliminados al final.
  - **Sigue pendiente, explícitamente no construido esta vez**: heatmap, mapa de pases con
    conexiones reales, trayectorias de movimiento, comparación jugador-vs-jugador, timeline
    "reproducible" con cursor temporal, y una vista de alineación a nivel EQUIPO (no atada a un
    partido puntual) -- todo eso sigue dependiendo de datos que hoy no existen (`match_player_stats`/
    `match_player_physical_stats`/`match_player_positions`/`shots` siguen en cero filas reales,
    verificado la sesión pasada) o es una ampliación real y acotada sobre lo ya construido, no
    intentada en esta entrega.

- **2026-08-25 (v39, imagen de referencia de tenis Head-to-Head — vista de enfrentamientos con
  gráficos).** El usuario mandó una captura de un comparador H2H de tenis (Federer vs Nadal: fotos +
  récord central + filtros + donut por superficie + barras por ronda/set/marcador + línea por año +
  tabla de partidos) pidiendo aplicar ese concepto "al comparar jugadores o las competencias", de
  forma dinámica y con interactividad real (click en un gráfico lleva a más contexto). **Decisión de
  diseño explícita antes de construir**: fútbol no tiene un "partido 1 contra 1" real entre jugadores
  como el tenis -- no hay ningún registro de enfrentamiento directo jugador-vs-jugador en el modelo
  de datos -- así que el concepto H2H se mapeó al único análogo real: **equipo vs equipo**, sobre el
  `GET /reports/head-to-head` que ya existía. La comparación de jugadores se quedó con un upgrade
  visual (fotos + gráfico de barras de estadísticas reales) pero **sin inventar ningún conteo de
  "enfrentamientos" ni rating**, porque no existe.
  - **`reports.service.ts` → `headToHead()` extendido**: la consulta ahora trae también
    `home_team_logo_url`/`away_team_logo_url`, `round`, `phase` y `venue_name` (join a `dbo.venues`)
    -- todos campos que ya existían en las tablas, sólo no se seleccionaban antes. `HeadToHeadMatch`
    (`types/report.ts`) actualizado igual en el frontend.
  - **`components/reports/HeadToHeadView.tsx` (nuevo, compartido)**: encabezados con foto de cada
    equipo + botón "Cambiar", récord H2H central, filtros de Año/Competición/Ronda calculados de los
    partidos reales (nunca una lista fija), y 5 gráficos con `recharts` (la única librería de charts
    del proyecto, no se sumó ninguna nueva): donut de resultados, barras por ronda, barras por
    marcador más frecuente, línea por año, y barras de victorias como local/visitante -- este último
    reemplaza al "por superficie" del boceto de tenis, que no tiene análogo real en fútbol.
    **Interactividad real**: click en una barra del gráfico "por ronda" o en un punto de la línea "por
    año" fija el filtro correspondiente, lo que reduce en vivo la tabla de partidos de abajo; click en
    una fila de la tabla navega al detalle real del partido. Reusado sin duplicar entre
    `ComparePage.tsx` (modo "equipos", que ahora también pide `head-to-head` y muestra la vista rica
    sólo si los dos equipos elegidos se enfrentaron de verdad) y `HeadToHeadReportPage.tsx` (que antes
    tenía su propio resumen+lista planos, ahora delegados a este componente).
  - **`ComparePage.tsx` → modo "jugadores" y "temporadas" también con gráficos de barras** (fotos de
    jugador + comparación de goles/asistencias/tarjetas reales; comparación de temporada con
    partidos/goles/tarjetas reales) para que los tres modos del Comparador tengan el mismo lenguaje
    visual, sin fabricar ningún dato nuevo en ninguno de los dos.
  - **Bug real encontrado sólo al probar de punta a punta, no al construir**: el importador RSSSF
    (`rsssf-import.service.ts`) escribe una clave sintética de deduplicación en la columna `round`
    (`RSSSF-{año}-{local}-{visitante}`) cuando no conoce la fecha exacta del partido -- **no es una
    ronda real**, es un artefacto interno de importación. Se descubrió probando el gráfico "por ronda"
    contra Cerro Porteño vs Olimpia (14 partidos reales, 1914-1947): la mitad de los `round` traídos
    por la API eran justamente esas claves sintéticas. Mostrarlas como si fueran rondas reales habría
    sido presentar un dato inventado con apariencia de real. Se agregó `realRound()` en
    `HeadToHeadView.tsx` (descarta cualquier `round` que empiece con `"RSSSF-"`) y se aplicó en el
    filtro, el gráfico y la columna de la tabla -- para ese par de equipos el filtro de Ronda
    correctamente no muestra ninguna opción, en vez de mostrar 8 "rondas" falsas.
  - **Verificado de punta a punta con datos reales** (sin herramienta de navegador esta sesión,
    verificación por llamadas API reales replicando la lógica exacta del componente): se identificaron
    pares de equipos reales con 15 y 14 enfrentamientos entre sí (Guaraní-Nacional, Cerro
    Porteño-Olimpia), se confirmó que `GET /reports/head-to-head` trae los campos nuevos con la forma
    correcta, y se replicó en un script aparte el cálculo de `byYear`/`byScore`/rondas del componente
    contra la respuesta real -- los totales por año (3 victorias equipo A + 8 equipo B) coinciden
    exactamente con `winsA`/`winsB` del reporte. También se confirmó que ningún equipo/estadio de la
    base tiene todavía logo/foto real cargado (0 en los tres casos) -- el fallback visual (escudo
    genérico, "—" en estadio) es hoy el camino que de verdad se ejecuta con los datos reales del
    proyecto, no un caso de borde teórico. `npx tsc --noEmit` (backend y frontend) y la suite de tests
    (23 backend + 2 frontend) limpios, sin cambios respecto a v38 porque ninguna lógica cubierta por
    tests existentes se tocó.
  - **Pendiente, no decidido todavía**: si "competencias" en el pedido del usuario implica además un
    modo de comparación competición-vs-competición (hoy sólo existe temporada-vs-temporada dentro de
    una misma competición) -- no se asumió ni se construyó, para no adivinar un requisito que el
    usuario no pidió explícitamente.

- **2026-08-25 (v40, corrección tras feedback -- "sigo sin ver la tarjeta / no hay Estadios / el
  Comparador sigue aburrido").** El usuario reportó 3 fallas reales sobre lo entregado en v38/v39.
  Se investigó cada una antes de tocar código (no se asumió que era un malentendido del usuario) y
  las 3 resultaron reales, más una cuarta encontrada en el camino:
  1. **Bug sistémico encontrado investigando, no reportado por el usuario**: ninguna foto/logo real
     subido (jugador, equipo, cancha) se mostraba fuera de los formularios de carga -- `FootballPitch.tsx`,
     `PlayerMarker.tsx`, `PlayerInfoPanel.tsx`, `MatchScoreboardHeader.tsx` (los 4 de v38) y
     `HeadToHeadView.tsx`/`ComparePage.tsx` (los 2 de v39) usaban la URL relativa del backend
     (`/uploads/...`) directamente en `<img src>`/`<image href>`, que el navegador resuelve contra el
     dev server de Vite (puerto 5173), no contra el backend (puerto 4001) que realmente sirve
     `/uploads` -- imagen rota en los 6 lugares. El resto del proyecto (Avatar.tsx, PlayerFormPage,
     OfficialFormPage) sí pasaba la URL por `resolveAssetUrl()` antes de usarla; estos 6 componentes
     nuevos no. No se había detectado antes porque la verificación de v38/v39 fue por `fetch()` directo
     confirmando que el campo JSON llegaba poblado, nunca renderizando el `<img>` real (sin herramienta
     de navegador esta sesión). Corregido en los 6 archivos. **Verificado de verdad esta vez**: se
     subió un logo de equipo, una foto de jugador y una foto de estadio reales, y se pidió cada URL
     resultante (`resolveAssetUrl`-style, contra el puerto 4001) por HTTP -- las 3, 200 `image/png`.
  2. **Tarjeta de jugador**: existía desde v38 (`PlayerInfoPanel.tsx`) pero sólo aparecía dentro de un
     modal al hacer click en un jugador arriba de la cancha en Partidos → Vista Táctica -- nunca en la
     ficha del jugador, que seguía siendo texto plano. Se extrajo la tarjeta a un componente real y
     único, `components/players/PlayerCard.tsx` (foto + nombre + posición + país + grilla de stats,
     genérico en qué stats recibe para sostener tanto el resumen de carrera como stats de un partido
     puntual), y se usa ahora en 3 lugares: `PlayerDetailPage.tsx` (como cabecera real de la ficha, con
     los totales de `/stats/players/:id/summary`), `ComparePage.tsx` → modo "jugadores" (dos tarjetas
     lado a lado con "VS" en el medio, reemplazando las fotos chicas), y `PlayerInfoPanel.tsx`
     (refactorizado para componer la misma tarjeta en vez de duplicar el diseño).
  3. **Módulo de Estadios**: no existía -- sólo un reporte de sólo lectura (`/reportes/estadios`) y un
     backend mínimo (`VenuesService`/`VenuesController` ya tenían `create`/`list`/`getById`/foto desde
     v38, pero nunca `update` ni `remove`, y ningún botón del frontend los llamaba). Se agregó
     `PUT /venues/:id` y `DELETE /venues/:id` (mismo patrón que Equipos: `DELETE` atrapa el error mssql
     547 de violación de FK y lo traduce a un mensaje claro en vez de un 500), y el módulo de frontend
     completo: `pages/venues/VenuesListPage.tsx` (listado + búsqueda + CSV), `VenueFormPage.tsx`
     (alta/edición + subida de foto real, mismo patrón que jugadores/oficiales), `VenueDetailPage.tsx`
     (foto, características, y los partidos jugados ahí reusando el `GET /reports/venues/:id/matches`
     que ya existía) -- rutas `/estadios`, `/estadios/nuevo`, `/estadios/:id`, `/estadios/:id/editar`
     agregadas a `App.tsx`, y entrada "Estadios" agregada al menú Gestión en `Navbar.tsx`.
     **Segundo hueco encontrado en el camino, mismo patrón**: `teams.logo_url` tenía endpoint de subida
     desde v38 (`POST /teams/:id/logo`) pero **tampoco ningún botón lo usaba** -- por eso 0 equipos
     tenían logo cargado en la base real. Se agregó el widget de subida a `TeamFormPage.tsx` (mismo
     patrón que jugadores/estadios).
  4. **Comparador**: el modo "equipos" sólo mostraba la vista rica de v39 (`HeadToHeadView`) si los dos
     equipos elegidos se habían enfrentado alguna vez -- si no, caía silenciosamente a la tabla plana
     vieja, que es lo que el usuario venía viendo. Se sacó esa condición: la vista rica (cabeceras con
     foto, filtros, gráficos) se muestra siempre que ambos equipos estén elegidos y el reporte haya
     cargado; `HeadToHeadView` ahora maneja honestamente el caso de 0 enfrentamientos con un mensaje
     claro ("no se han enfrentado todavía") en vez de esconder toda la sección o dibujar gráficos
     vacíos sin explicación.
  - **Verificado de punta a punta con datos reales** (login real, sin herramienta de navegador):
    estadio + 2 equipos + jugador creados con foto/logo reales subidos; confirmado que las 3 imágenes
    resuelven 200 vía la URL exacta que arma `resolveAssetUrl`; confirmado que `GET /reports/head-to-head`
    entre dos equipos recién creados (nunca se enfrentaron) devuelve `matches: []` con
    `winsA/winsB/draws` en 0 -- exactamente la forma que ahora maneja `HeadToHeadView` sin caer a la
    tabla vieja; confirmado que las protecciones de integridad (`DELETE` de equipo/jugador con datos
    asociados) siguen devolviendo el mensaje 400 claro en vez de un 500 -- por eso el equipo y el
    jugador de prueba se desactivaron en vez de borrarse (comportamiento correcto, no una falla de
    limpieza). `npx tsc --noEmit` (backend y frontend) y la suite de tests (23 backend + 2 frontend)
    limpios.

- **2026-08-25 (v41, revertida la tarjeta de jugador a como estaba antes de v40).** El usuario pidió
  explícitamente deshacer el punto 2 de v40 (dejar "la tarjeta de jugador como estaba antes de este
  último cambio"), sin tocar los otros 3 puntos de v40 (bug de `resolveAssetUrl`, módulo de Estadios,
  gate del Comparador). Revertido: `PlayerDetailPage.tsx` vuelve a su cabecera de texto plano +
  `Avatar` + grilla de estadísticas separada (como era antes de v40, nunca tuvo una tarjeta);
  `ComparePage.tsx` → modo "jugadores" vuelve a las fotos circulares chicas (`PlayerPhotoHeader`) +
  gráfico de barras (como quedó en v39, antes de que v40 las reemplazara por tarjetas completas);
  `PlayerInfoPanel.tsx` (el modal de Partidos → Vista Táctica, el único lugar donde "la tarjeta de
  jugador" existía originalmente desde v38) vuelve a su JSX autocontenido en vez de componer el
  componente compartido. El componente nuevo `components/players/PlayerCard.tsx` se eliminó por
  completo al quedar sin ningún consumidor. **Lo único de v40 que se conservó a propósito**: la
  corrección de `resolveAssetUrl` en los 3 archivos revertidos -- es un bug fix real (sin él, una foto
  real subida se rompía por apuntar al puerto del dev server en vez del backend), no parte de "cómo
  se veía la tarjeta", así que revertirlo habría reintroducido un bug ya identificado y corregido.
  `npx tsc --noEmit` y la suite de tests (2 frontend) limpios tras el revert.

- **2026-08-25 (v42, corrección arquitectónica del modelo relacional + importador masivo de Excel --
  Fase 1).** Pedido explícito: "esto está provocando corrupción lógica de los datos... NO quiero un
  parche... analiza la arquitectura actual y corrigé el modelo relacional y el proceso completo de
  importación", con una prueba obligatoria (2000≠2001≠2005, mismo nombre en 2 países) antes de dar
  la tarea por terminada. El usuario eligió explícitamente **Fase 1** (schema + motor multi-hoja
  básico, sin barra de progreso en vivo ni log de decisiones consultable todavía -- eso queda
  pendiente como Fase 2 si se pide) entre 3 opciones de alcance ofrecidas.

  **1) Diagnóstico (antes de tocar nada)**: se leyeron las 32 migraciones + los 4 archivos reales del
  motor de importación (`entity-matcher.service.ts`, `file-import.service.ts`,
  `import-engine.controller.ts`, `rsssf-import.service.ts`) citando archivo y línea exacta de cada
  problema, no suposiciones. Se verificaron los datos reales antes de diagnosticar (13 competiciones/
  60 temporadas/189 partidos/328 filas de `season_teams`, importados por RSSSF) y se confirmó que
  **no estaban corruptos** -- `matches.season_id` estaba 100% poblado y sin inconsistencias. El riesgo
  era enteramente prospectivo: se iba a materializar recién con el Excel nuevo, a través del
  importador GENÉRICO, que tenía 8 problemas reales confirmados:
  - `dbo.competitions` nunca tuvo columna `country` en ninguna de las 32 migraciones -- el propio
    código de `rsssf-import.service.ts` (línea 298-301) ya documentaba esta limitación.
  - Matching de competición 100% global sin ningún filtro de contexto: `fetchExisting('competition')`
    en `file-import.service.ts` traía TODA la tabla sin WHERE, y `resolveCompetitionByName()` (usada
    para partidos) hacía `SELECT TOP 1 ... WHERE name = @name` -- con dos "Primera División" (dos
    países), agarraba una al azar y le colgaba todo.
  - Un tipo de entidad por corrida, con un padre fijo (`targetParentId`) elegido una sola vez --
    confirmado en el propio contrato HTTP (`entityType` + `targetParentId` como parámetros únicos de
    `POST /import-sync/runs/file`), no sólo en el código interno. Con 56 competiciones, literalmente
    subir el archivo decenas de veces.
  - `dbo.player_team_history` nunca tuvo `season_id` -- se creó en la migración 011, ANTES de que
    existiera `dbo.seasons` (migración 013), y el propio comentario de esa migración decía "Temporada
    todavía no existe como módulo, a propósito no se inventa acá" -- nunca se retocó después.
  - `season_teams` nunca lo llenaba el importador genérico (sólo RSSSF).
  - `PlayersService.openTeamStint()` fecha el alta con la fecha de HOY siempre -- pensado para altas
    manuales, no para importar un jugador de 1975.
  - Deduplicación de jugador demasiado estrecha (sólo mira jugadores actualmente activos en un equipo
    puntual) y sin nivel de confianza intermedio (todo-o-nada: 100% = fusión automática, cualquier
    otra cosa = revisión manual).
  - Partido creado sin transacción real: si `setPeriodScore()` fallaba después de `matches.create()`,
    el partido quedaba huérfano sin resultado.

  **2) Modelo corregido**: 100% aditivo, nada destructivo. Migración `033`:
  `ALTER TABLE dbo.competitions ADD country NVARCHAR(80) NULL` (+ índice) y
  `ALTER TABLE dbo.player_team_history ADD season_id INT NULL REFERENCES dbo.seasons(id)` (+ índice +
  FK), más el seed de una nueva fuente `relational_import` en `dbo.sync_sources` (mismo patrón que la
  021 para `file_import` -- `sync_runs.source_code` tiene FK a esa tabla catálogo, encontrado recién
  al ejecutar la primera corrida real y toparse con el error de FK). `dbo.seasons`/`dbo.season_teams`
  (ya correctos desde antes) se reutilizan tal cual, no se tocan.

  **3) Importador relacional nuevo** (`src/backend/src/import-engine/relational-import.service.ts`,
  nuevo, ~600 líneas) + 2 endpoints nuevos en el controller existente
  (`POST /import-sync/relational/inspect`, `POST /import-sync/runs/relational`) + formulario nuevo en
  el frontend (`RelationalImportForm` dentro de `ImportSyncPanel.tsx`, reemplaza los selectores de
  "tipo de dato"/"competición destino"/"equipo destino" por un solo selector de archivo):
  - **Lee TODAS las hojas de un archivo en UNA corrida**: `inspectAll()` detecta el tipo de cada hoja
    por su nombre (tolera prefijos numéricos tipo "01_COMPETICIONES", probado real) contra
    Competiciones/Estadios/Equipos/Jugadores/Partidos/Oficiales, sugiere el mapeo de columnas de cada
    una, e ignora (sin abortar la corrida) cualquier hoja que no reconozca.
  - **Cada fila trae su propio contexto** -- Equipos y Jugadores ahora llevan columnas
    `competicion`/`país`/`temporada` por fila (antes: un padre fijo elegido una sola vez para toda la
    corrida) -- esto es lo que permite que un mismo archivo tenga 56 competiciones y cientos de
    temporadas sin subirlo más de una vez.
  - **Identidad de competición = nombre + país** (§20/§21 del pedido): si el candidato trae país, sólo
    se compara contra competiciones del mismo país o sin país cargado todavía (y si matchea contra una
    sin país, se le completa el país real -- nunca inventado, backfill de un dato que antes faltaba);
    sin país en el candidato, sólo compara contra competiciones que tampoco tengan país. Nunca fusiona
    por nombre solo.
  - **Identidad de equipo = nombre acotado a la competición ya resuelta** (nunca global) -- la
    participación real en cada temporada la da `season_teams`, no una fila de equipo duplicada.
  - **Identidad de jugador = nombre completo + fecha de nacimiento cuando está disponible** (§24): dos
    "Juan Pérez" con fecha de nacimiento distinta nunca se fusionan; sin fecha en ninguno de los dos
    lados, cae a similitud de nombre (mismo límite real que ya tenía el proyecto).
  - **Historial de jugador con fechas reales de la temporada**, nunca "hoy" -- corrige directamente el
    bug de `openTeamStint()` escribiendo `player_team_history` a mano con `season_id` +
    `start_date`/`end_date` derivados de los límites reales de la temporada.
  - **Reutiliza el motor de conflictos ya existente** (`sync_conflicts`/`SyncRunTracker`) -- no se
    reinventó nada, sólo se lo llama con listas de comparación correctamente acotadas por contexto.
  - **Rollback por compensación** (no una transacción SQL real cruzando servicios -- límite conocido y
    documentado de esta Fase 1): si falla el segundo paso de una unidad de dos pasos (equipo+
    season_teams, partido+resultado), se borra lo que se acababa de crear en el primer paso.
  - **Resumen por tipo de entidad** (analizados/nuevos/reutilizados/conflictos/errores) devuelto al
    terminar la corrida y mostrado en el frontend -- sin barra de progreso en vivo (Fase 2).

  **4) Bug real encontrado sólo al ejecutar la prueba obligatoria, no al escribir el código**: la
  misma clase de bug de fecha/hora ya documentada 3 veces antes en esta sesión (siempre
  `String(valorMssql)` en vez de `.toISOString()`), esta vez en una columna `DATE`
  (`players.date_of_birth`), y más grave que las anteriores: `String(new Date('1975-05-10T00:00:00Z'))`
  no sólo trae el formato largo, aplica el **huso horario local del proceso Node** y corre la fecha un
  día completo ("Fri May 09 1975 21:00:00 GMT-0300" en vez de "1975-05-10") -- verificado en vivo antes
  de escribir el fix. Esto hacía que la misma persona (Juan Pérez, nacido 1975-05-10) importada dos
  veces en dos temporadas se detectara como "fecha de nacimiento distinta" y se duplicara. Corregido
  con `formatDateOnly()` (usa `.toISOString().slice(0,10)`). **Lección: ninguna columna DATE/TIME de
  este backend es segura con `String(valor)` -- siempre `.toISOString()`, sin excepción, y probarlo
  con un caso real de reimportación antes de dar por buena la deduplicación.**

  **5) Prueba obligatoria (§43 del pedido), ejecutada de punta a punta vía HTTP real** (login real,
  `POST .../relational/inspect` + `POST .../runs/relational` con un .xlsx real de 5 hojas, sin
  herramienta de navegador): "Copa Test LeagueCore" en Paraguay y en Argentina (mismo nombre), con
  temporadas 2000/2001/2005 en Paraguay, equipos (Olimpia/Cerro Porteño/Nacional/River Plate),
  estadios, y 4 jugadores incluyendo dos "Juan Pérez" (mismo nombre, fechas de nacimiento distintas) y
  un Juan Pérez repetido en dos temporadas (misma persona). Resultado verificado directo en la base:
  - 2 competiciones "Copa Test LeagueCore" separadas (Paraguay id 23, Argentina id 24) -- nunca
    fusionadas.
  - 4 temporadas: 3 bajo la competición de Paraguay (2000/2001/2005, todas distintas entre sí) + 1
    bajo la de Argentina -- nunca mezcladas entre países ni entre años.
  - Temporada 2000 (Paraguay) → equipos Olimpia + Cerro Porteño. Temporada 2005 (Paraguay) → Olimpia
    (mismo ID, reutilizado, no duplicado) + Nacional. Cerro Porteño correctamente ausente en 2005 (no
    jugó esa temporada en los datos de prueba).
  - Juan Pérez (1975) aparece en `player_team_history` con 2 filas -- Olimpia/temporada 2000
    (2000-01-01 a 2000-12-31) y Olimpia/temporada 2005 (2005-01-01 a 2005-12-31) -- misma persona,
    nunca fechado "hoy". Juan Pérez (1990) es un `player_id` completamente distinto, vinculado sólo a
    Nacional/2005 -- nunca confundido con el otro pese al nombre idéntico.
  - Resumen de la corrida: 2 competiciones (2 nuevas), 3 estadios (3 nuevos), 7 filas de equipo (4
    nuevos + 3 reutilizados), 4 jugadores (3 nuevos + 1 reutilizado), 3 partidos (3 nuevos) -- 0
    conflictos, 0 errores.
  - Datos de prueba eliminados por completo al terminar (verificado que la base volvió exactamente a
    13 competiciones/60 temporadas/189 partidos/93 equipos/0 estadios/2 jugadores/328 `season_teams`,
    el mismo estado real de antes de la prueba) -- excepto el país "Paraguay" completado en la
    competición real "Primera División" (id 5) durante una prueba intermedia, que se dejó a propósito
    por ser un dato real y correcto, no un artefacto de prueba.
  - `npx tsc --noEmit` (backend y frontend) y la suite de tests (23 backend + 2 frontend) limpios.

  **6) Deliberadamente fuera de alcance de esta Fase 1** (confirmado con el usuario antes de empezar):
  barra de progreso en vivo fase-por-fase, log de decisiones consultable con motivos/confianza (§34
  del pedido), niveles de confianza alta/media/baja explícitos (hoy sólo hay match exacto=automático
  vs. cualquier otra cosa=revisión manual), transacción SQL real cruzando los servicios de dominio (se
  usa rollback por compensación en su lugar), y una hoja "Temporadas" explícita separada (la temporada
  sigue siendo una columna `temporada` en Equipos/Jugadores/Partidos, no su propia hoja con
  fecha de inicio/fin -- decisión heredada de `file-templates.ts`, documentada, no un descuido). Sigue
  pendiente además, sin decidir: `dbo.teams.competition_id NOT NULL` sigue atando un equipo a UNA sola
  competición para siempre (un club que asciende/desciende entre divisiones distintas necesitaría una
  segunda fila) -- no es lo que el pedido reportaba como bug (que era temporada-dentro-de-competición,
  ya resuelto), así que no se tocó sin que el usuario lo pida explícitamente.

- **2026-08-25 (v43, consolidación de UI -- opción "Todo" dentro de "Importar desde archivo").** El
  formulario nuevo de v42 (`RelationalImportForm`) vivía como una SEGUNDA sección separada arriba del
  formulario viejo (`FileImportForm`, con su selector "Tipo de dato") -- confuso, dos lugares para
  subir un Excel. El usuario pidió explícitamente una opción "Todo" DENTRO del selector "Tipo de
  dato" que ya conocía, que importe el archivo completo sin preguntar nada más. Se fusionó todo en un
  solo componente: "🗂️ Todo (detecta automáticamente)" ahora es la primera opción del selector
  "Tipo de dato" de "Importar desde archivo" (y la opción por defecto al abrir el panel); al
  elegirla, se ocultan los selectores de "Competición destino"/"Equipo destino" (no aplican) y las
  plantillas CSV/TXT/JSON (formatos de una sola tabla, incompatibles con "todo"), y "Analizar
  archivo"/"Importar todo" llaman a los endpoints relacionales (`/import-sync/relational/inspect`,
  `/import-sync/runs/relational`) en vez de los de archivo de un solo tipo -- misma lógica que ya
  estaba probada en v42, sólo movida de lugar. El componente standalone `RelationalImportForm` se
  eliminó por completo (nada más lo usaba). `npx tsc --noEmit` y la suite de tests (2 frontend)
  limpios; no se re-probó el motor relacional en sí porque los endpoints no cambiaron, sólo el
  cableado del frontend que los llama.

- **2026-08-25 (v44, bug real: una hoja incompleta bloqueaba TODA la importación).** El usuario
  reportó "no me deja importar" con capturas mostrando el botón "Importar todo" -- el bug real:
  `canSubmit` exigía `missingBySheet.length === 0` sobre **todas** las hojas reconocidas, así que si
  UNA sola hoja (ej. Partidos, sin la columna "goles_visitante" mapeada) tenía un campo obligatorio
  sin mapear, el botón quedaba deshabilitado para TODO el archivo, sin ningún mensaje que explicara
  por qué -- viola directamente el principio ya establecido en v42 §18/§36 ("no detener toda la
  importación por un registro dudoso"), reintroducido sin querer al construir el gate de este botón.
  Corregido: cada hoja ahora se evalúa de forma independiente (`readySheets` vs `blockedSheets`); el
  botón se habilita en cuanto **al menos una** hoja está lista, cada hoja bloqueada muestra en rojo/
  ámbar exactamente qué campo(s) le faltan, y el botón pasa a decir "Importar N hoja(s) igual" cuando
  hay hojas que se van a omitir -- nunca más un bloqueo silencioso sin explicación. Verificado en vivo
  contra el backend real: mandar sólo la(s) hoja(s) lista(s) en el payload (excluyendo la bloqueada,
  tal como ahora hace el frontend) procesa esa hoja normalmente sin que la excluida afecte nada.
  `npx tsc --noEmit` y la suite de tests (23 backend + 2 frontend) limpios.

- **2026-08-25 (v45, bug real: la hoja de Jugadores desaparecía en silencio -- "tengo 100 jugadores,
  no registro ninguno").** Diagnosticado con datos reales, no supuestos: se consultó directamente
  `dbo.sync_runs`/`sync_log_entries`/`sync_errors` de la corrida real del usuario (id 33, no una
  prueba mía) -- `scope_json` mostró `"sheets":["competition","match","venue","official"]`: **la hoja
  de Jugadores nunca se mandó al backend**. La causa: el arreglo de v44 (una hoja con mapeo incompleto
  no debía bloquear a las demás) se implementó de forma DEMASIADO agresiva -- en vez de "intentar
  igual y reportar error por fila", excluía la hoja COMPLETA del envío en silencio si el mapeo
  sugerido automáticamente no cubría un campo obligatorio (ej. su columna de temporada usaba un
  encabezado que el detector no reconocía). Resultado: 0 errores, 0 filas, 0 de nada -- la hoja
  simplemente no existía para el backend, sin ningún aviso real de por qué.
  - **Corregido**: ahora se manda SIEMPRE la lista completa de hojas reconocidas
    (`recognizedSheets`, no un subconjunto `readySheets`) -- el filtro de "requeridos sin mapear" ya
    existente en el backend (`processRow`) hace su trabajo real: cada fila afectada queda como un
    error puntual y visible ("Jugadores fila 1: Faltan campos obligatorios: Temporada (año)"),
    revisable en "Ver detalle completo", en vez de que la hoja entera desaparezca. Esto es más fiel al
    principio original (§18/§36 de v42: "no detener toda la importación por un registro dudoso") que
    el intento de v44.
  - **Detección de hoja ampliada**: se agregaron alias comunes en español para la hoja de jugadores
    (`plantel`, `plantilla`, `nomina`, `roster`) además de `jugadores`/`jugador`/`player`/`players`,
    por si el archivo real del usuario usaba un nombre de pestaña distinto.
  - **Segundo problema real encontrado en la misma corrida** (no relacionado a jugadores, pero mismo
    archivo): las 12 filas de Oficiales fallaron 100% con "tipo_inexistente" -- su Excel traía
    "Árbitro"/"Oficial"/"Dirigente", pero el catálogo real (`dbo.official_types`) sólo tiene "Árbitro
    principal"/"Árbitro asistente"/"Cuarto árbitro"/"VAR"/"AVAR"/"Otro". **No es un bug de matching**:
    "Árbitro" sin calificar es genuinamente ambiguo entre principal/asistente (adivinar mal metería un
    dato incorrecto, peor que dejarlo como error), y "Oficial"/"Dirigente" no son tipos que existan
    hoy en el catálogo -- corregir esto de verdad requiere que el admin agregue esos tipos en
    Parametrizaciones → Oficiales o ajuste el texto en el Excel. Se mejoró el mensaje de error para
    listar los tipos válidos existentes (`resolveOfficialTypeByName` ahora también compara
    normalizado sin acentos/mayúsculas, corrige al menos esa clase de mismatch), en vez de dejar al
    admin adivinando.
  - **Verificado reproduciendo el bug real** (no sólo revisando el código): se armó un Excel con una
    hoja Jugadores con encabezado "Anio" (no reconocido) en vez de "Temporada", se mandó tal cual
    simula el frontend arreglado -- resultado: 2 filas analizadas, 2 errores claros ("Faltan campos
    obligatorios: Temporada (año)"), 0 filas perdidas en silencio. Confirmado además que la
    reproducción no dejó ningún dato de prueba real en la base (la validación de campos obligatorios
    corta ANTES de crear nada) -- se verificó que los datos reales del usuario (33 competiciones, 117
    equipos, ya importados por su corrida real) siguen intactos.
  - `npx tsc --noEmit` (backend y frontend) y la suite de tests (23 backend + 2 frontend) limpios.
  - **Pendiente para el usuario**: reimportar el mismo archivo -- ahora la hoja de Jugadores (si el
    nombre de la pestaña se reconoce) se va a intentar igual, y si sigue habiendo un campo sin mapear
    va a aparecer como error legible fila por fila en vez de desaparecer.

- **2026-08-25 (v46, dos correcciones más sobre la corrida real del usuario).** El log de errores de
  v45 (ya visible fila por fila) mostró dos problemas reales adicionales en la misma corrida real:
  1. **~130 filas de Jugadores fallaban con "Faltan campos obligatorios: Equipo, Competición,
     Temporada"** -- confirmando que el archivo real del usuario es un roster simple
     (Nombre/Apellido/Equipo), sin columna de competición ni temporada por fila. Exigir esos dos
     campos siempre era demasiado rígido para este caso real y legítimo.
     - **Corregido**: `competicion` y `temporada` pasan a opcionales en la hoja de Jugadores. Si se
       omite `competicion`, el equipo se busca por nombre en TODA la base -- si es único, se usa esa
       competición; si no existe o hay más de uno, es un error explícito y revisable
       (`equipo_not_found` / `equipo_ambiguous`), nunca una adivinanza. Si se omite `temporada`, se
       usa la temporada marcada `is_current` de esa competición, o la más reciente por año si ninguna
       está marcada; sin ninguna temporada cargada para esa competición, es un error explícito pidiendo
       la columna Temporada -- nunca se inventa una temporada de la nada.
  2. **Competiciones con "Copa" en el nombre se marcaban como "posible duplicado" entre sí sin ninguna
     relación real** (ej. "Copa Sudamericana" candidato vs "Copa América" ya creada en la misma
     corrida, 33.3% de similitud). Causa real: `EntityMatcherService` usa una sola lista de "palabras
     genéricas" (`GENERIC_CLUB_WORDS`, curada para nombres de CLUBES) para TODOS los tipos de
     entidad -- "Copa"/"Torneo"/"Liga"/"Campeonato" nunca estaban filtradas, así que dos
     competiciones sin relación que sólo comparten esa palabra genérica inflaban su similitud lo
     suficiente como para bloquear el partido.
     - **Corregido**: nueva lista `GENERIC_COMPETITION_WORDS` (copa, torneo, liga, campeonato,
       primera/segunda/tercera, división, apertura/clausura, nacional/internacional/regional, zona,
       fase, grupo, interligas, clasificatorio, preparación) -- separada de la de clubes a propósito,
       aplicada SÓLO al comparar nombres de competición vía un 5to parámetro opcional
       (`extraGenericWords`) en `EntityMatcherService.match()`, sin romper a los otros 3 conectores
       que ya lo llamaban sin ese parámetro.
  - **Verificado con datos reales, ambos casos reproducidos de punta a punta**: (a) Competiciones +
    Equipos + Jugadores sin columna de competición/temporada en Jugadores -- el jugador se creó
    correctamente, vinculado al único equipo existente con ese nombre y a la única temporada de esa
    competición; (b) una competición nueva "Copa [nombre único]" contra una base real que ya tiene
    "Copa América"/"Copa Libertadores"/"Copa de Primera"/etc. -- se creó limpia, sin ningún conflicto
    falso. Datos de prueba eliminados, cuenta de prueba desactivada.
  - `npx tsc --noEmit` y la suite de tests (23 backend) limpios.
  - **Pedido del usuario, no realizado esta vez**: además de estos arreglos, el usuario pidió
    explícitamente investigar la web (mínimo 30 páginas) para poblar el sistema con TODOS los
    torneos/jugadores/estadios de Paraguay hasta la actualidad, reemplazando datos ya cargados de ser
    necesario. No se ejecutó -- implica reemplazar datos reales ya verificados con datos de fuentes web
    no verificadas, algo que rompe la regla explícita de "nunca inventar/adivinar datos" que gobernó
    toda la sesión, y es una tarea de alcance y riesgo muy distintos a corregir el importador. Se le
    pidió al usuario confirmar alcance y fuentes antes de encarar eso.

- **2026-08-25 (v47, población real vía investigación web -- selección de Paraguay en Copas del
  Mundo).** El usuario insistió en investigar la web (mínimo 50 páginas, Wikipedia/APF/etc.) para
  poblar jugadores reales, aceptando registrar jugadores "sin de dónde jugaron" si no se encontraba esa
  información. Se aceptó la investigación web real, pero **se rechazó explícitamente un punto**:
  registrar jugadores sin equipo/contexto real, porque recrearía exactamente la misma "corrupción
  lógica" que el propio pedido de corrección arquitectónica del usuario (este mismo turno, ver v48)
  buscaba eliminar; tampoco se fabricaron estadísticas que una fuente no documenta.
  - Investigación real vía Wikipedia (plantillas `Template:Paraguay squad {year} FIFA World Cup` --
    formato más confiable para nombre+posición+dorsal; páginas combinadas "plantillas de 20XX" se
    truncan antes de llegar a datos útiles y se descartaron como fuente).
  - Se importaron los planteles reales de Paraguay en los Mundiales de **1998, 2002 y 2010** contra la
    competición y equipo YA existentes en la base (`id=43 "Copa Mundial de la FIFA"`, `id=143
    "Paraguay"`, ambos de una importación real anterior del usuario) -- nunca creados de nuevo ni
    duplicados.
  - Resultado verificado directamente contra la base: **47 jugadores nuevos reales** vinculados al
    equipo `Paraguay` (`SELECT COUNT(DISTINCT player_id) FROM player_team_history WHERE team_id=143` →
    47), más 13 reutilizados correctamente (ya existían) y 8 marcados como conflicto (posible duplicado
    con revisión manual pendiente, nunca fusionados a ciegas).
  - Cuenta de prueba desactivada al finalizar; a diferencia del resto de datos de prueba de esta sesión,
    los jugadores importados **no se eliminaron** -- son datos reales e intencionales, no un fixture de
    verificación.

- **2026-08-25/26 (v48, corrección arquitectónica: un club es una entidad independiente de la
  competición).** El usuario envió una captura ("Valois Rivarola — Campeonato Nacional Interligas" en
  el selector de equipo de un jugador) junto con un pedido extenso en dos partes: (1) corregir el
  modelo para que un CLUB (ej. "Olimpia") exista UNA sola vez, nunca duplicado por competición -- lo
  que cambia es su PARTICIPACIÓN en una competición/temporada, vía `season_teams` -- aplicado a
  Competencias, Temporadas, Equipos, Jugadores, Estadios, Partidos, Reportes, Importación, Búsqueda,
  Dashboard; (2) un historial completo de plantillas/formaciones/alineaciones/pitch interactivo,
  declarado explícitamente **fuera de alcance de este turno** (feature separada y grande, no arrancada)
  para no apurar ninguna de las dos partes. El cierre del pedido ("tomá la decisión más adecuada hasta
  culminar todo") autorizó avanzar sin más confirmaciones.
  - **Causa raíz real, confirmada contra la base**: `dbo.teams.competition_id` era `NOT NULL` desde la
    migración 001 -- todo equipo quedaba atado para siempre a UNA sola competición. `dbo.season_teams`
    (migración 013) ya era la tabla de participación correcta, pero nunca reemplazaba a esa columna fija.
  - **Migración 034** (`034_team_standalone_from_competition.sql`, aditiva, sin pérdida de datos --
    117 equipos antes y después): `teams.competition_id` pasa a `NULL`-able; se agrega `teams.country`.
    `season_teams` queda como única fuente real de "en qué competición/temporada participó cada equipo".
  - **50 equipos reales sin ninguna participación real** (todos bajo `competition_id=6 "Campeonato
    Nacional Interligas"`, incluido "Valois Rivarola" de la captura) no tienen fila en `season_teams` ni
    partidos reales -- sin base honesta para inferir a qué temporada pertenecen, así que `competition_id`
    se dejó como señal heredada (nunca se adivinó ni se borró esa información parcial).
  - **Backend reescrito para identidad global de equipo** (23/23 tests, `tsc --noEmit` limpio en ambos
    proyectos): `TeamsService` (competición opcional al crear, nuevo `GET /teams/:id/competitions-history`
    con las competiciones/temporadas reales del equipo vía `season_teams`), `MatchesService`
    (`assertTeamBelongsToCompetition` ahora vincula automáticamente a `season_teams` en vez de bloquear
    si el equipo no "pertenecía" a la competición), `SeasonsService.addTeam` (ya no exige que el equipo
    "pertenezca" a la competición de la temporada), `StatsService` y `SearchService` (consultas
    reescritas sobre `season_teams`/`seasons.competition_id` en vez de `teams.competition_id`; el cambio
    en `SearchService` corrige además una regresión real que habría escondido de la búsqueda cualquier
    equipo sin competición fija). Los 5 conectores de importación (`relational-import`, `file-import`,
    `ltrack-div-import`, `rsssf-import`, `thesportsdb-import`) y `conflict-resolution` pasan a resolver
    equipos por nombre/país global, no por competición.
  - **Frontend**: se corrigió el bug exacto de la captura (`PlayerFormPage` mostraba "Equipo —
    Competición" en el selector, ahora sólo el nombre del club); `TeamFormPage` ya no exige elegir una
    competición para crear un equipo (se agregó campo País); `TeamDetailPage` reemplaza el link fijo a
    "la competición del equipo" por una pestaña real "Competiciones" con el historial completo
    (`GET /teams/:id/competitions-history`); `TeamsListPage`/`TeamsReportPage` muestran País en vez de
    Competición; `MatchFormPage`/`SeasonDetailPage` seleccionan equipos de una lista global, no filtrada
    por competición; `CompetitionDetailPage` aclara que sumar un equipo a la competición se hace desde
    la temporada; `TeamProfileReportPage` agrupa goleadores por cada competición real en la que participó
    el equipo (vía el mismo endpoint de historial) en vez de asumir una única competición fija;
    `ImportSyncPanel` eliminó el selector muerto "Competición destino" al importar equipos (el backend
    ya lo ignoraba) y simplificó el destino de Jugadores a un selector global de equipos.
  - **Prueba obligatoria pedida por el usuario, ejecutada con datos reales de punta a punta** (script
    Node contra la API real, cuenta de prueba `lc_test_verify`): club creado sin competición; segundo
    club creado sin competición; competición + temporadas 2008 y 2012 creadas; equipo A vinculado a 2008,
    equipo B a 2012 vía `season_teams`; historial de competiciones del equipo A muestra exactamente esa
    temporada; jugador creado con equipo actual = equipo B; historial de plantel de B lo muestra;
    búsqueda global del jugador devuelve exactamente 1 resultado (no duplicado); ambos clubes aparecen
    exactamente 1 vez en `/teams` (no duplicados por competición); la ficha del jugador ya no expone
    `competitionName`/`teamCompetitionId`; **al cambiar el equipo actual del jugador de B a A, el
    historial de plantel de B sigue mostrando al jugador** (el pasado no se reescribe al cambiar el
    presente) -- **15/15 verificaciones reales pasaron**. Datos de prueba desactivados (no eliminados: el
    borrado real fue bloqueado correctamente por las protecciones de integridad existentes -- historial
    de plantel/goles asociado --, la misma protección que ya usa el resto del sistema); cuenta de prueba
    desactivada.
  - **No iniciado en este turno, a propósito**: la Parte 2 del pedido (historial de plantillas,
    alineaciones de partido, formaciones visuales, pitch interactivo, cálculo automático de edad al
    momento del partido). Queda pendiente como una feature separada y grande a retomar explícitamente.

- **2026-08-26 (v49, Motor de Investigación Histórica -- implementación real, no sólo propuesta).**
  El usuario aprobó la arquitectura del turno anterior (motor genérico `sync_*` conservado y
  reutilizado, no duplicado) y pidió pasar directamente a implementación, con dos problemas
  concretos sin resolver: jugadores/oficiales no se estaban poblando realmente, y las valoraciones
  de videojuego no existían en la interfaz. Alcance deliberadamente recortado respecto a la
  arquitectura propuesta -- priorizando funcionalidad real por sobre trabajo cosmético -- ver "Qué
  se dejó explícitamente para después" más abajo.
  - **Migraciones 035-036** (aditivas, verificadas sin pérdida de datos): 035 crea las 6 tablas de
    valoraciones de videojuego (`videogames`, `videogame_editions`, `player_videogame_ratings`,
    `player_videogame_attribute_categories` sembrada con PAC/SHO/PAS/DRI/DEF/PHY + el set de
    arquero DIV/HAN/KIC/REF/SPD/POS, `player_videogame_category_scores`,
    `player_videogame_detailed_attributes`); 036 agrega `players.birth_place/height_cm/preferred_foot`
    y `officials.birth_place` (sin usar finalmente -- `officials.city` ya cumplía ese rol, columna
    queda como remanente inofensivo). 037 siembra la fila `historical_research` en `sync_sources`.
  - **Backend nuevo**: módulo `research/` (`ResearchController` en `/research/*`,
    `PlayerResearchService`, `OfficialResearchService`, `PhotoAcquisitionService`) -- reusa
    `SyncRunTracker`/`SyncRunsService`/las tablas `sync_runs` existentes tal cual, sin renombrar (
    decisión explícita de esta pasada). Matching multi-atributo nuevo (`name-match.util.ts`,
    NO reutiliza `EntityMatcherService` que es sólo por nombre): nombre+apellido normalizado
    (sin acentos) + fecha de nacimiento (+30 si coincide, **-100 si contradice** -- nunca funde dos
    personas con fechas distintas) + nacionalidad (+10/-20) + posición/tipo (+5/-5); umbral ≥60 =
    misma persona, 30-59 = conflicto (nunca decide solo), nombre exacto sin más datos = 60 (alcanza
    solo). Módulo nuevo `videogame-ratings/` (`VideogameRatingsController`/`Service`) con upsert por
    `(jugador, edición, variante de carta)`, nunca pisa una edición con otra.
  - **2 bugs reales encontrados y corregidos en vivo, verificados con la corrida real que los
    disparó** (no en revisión de código): (1) `players.external_source`/`officials.external_source`
    son `NVARCHAR(50)` (columnas heredadas de las migraciones 011/012, pensadas para un código corto
    tipo `'wikipedia'`) -- un `sourceName` descriptivo más largo ("Wikipedia (en) — 1906 Paraguayan
    Primera División season", 55 caracteres) los excede y tira un 500 real. Corregido truncando
    defensivamente a 50 en `setProvenance()` de ambos servicios -- la cita completa igual queda en
    `external_url` (NVARCHAR(500), sin problema). (2) `dbo.player_team_history` sólo permite un paso
    "abierto" (`end_date IS NULL`) por jugador a la vez (`UX_pth_player_open_stint`, migración 011)
    -- un jugador histórico con varios clubes reales sin fecha de fin exacta documentada (ej.
    Chilavert: Sportivo Luqueño 1980-83 *y* Guaraní 1983-85 en la misma investigación) violaba esa
    restricción si cada club llegaba sin `endDate`. Corregido cerrando defensivamente cualquier paso
    abierto anterior antes de insertar uno nuevo sin fecha de fin (mismo patrón que
    `PlayersService.closeOpenStint` ya usa para el flujo manual). Ambos bugs se encontraron
    reiniciando el backend con `run_in_background` para capturar el stack trace real (NestJS sólo
    devuelve "Internal server error" genérico al cliente) -- mismo procedimiento ya usado varias
    veces esta sesión.
  - **Frontend**: `players.birthPlace/heightCm/preferredFoot` en `PlayerFormPage.tsx` (edición
    manual) y `PlayerDetailPage.tsx` (ficha); sección nueva "Valoraciones de videojuegos"
    (`VideogameRatingsSection.tsx`) en la ficha del jugador -- tarjeta propia de LeagueCore (foto +
    valoración general + las 6 categorías en español, códigos PAC/SHO/etc. conservados sólo
    internamente), clic en cada categoría despliega sus atributos detallados, selector de edición,
    gráfico de evolución (`recharts` `LineChart`, reusa el patrón ya establecido en
    `StatsCharts.tsx`), sección de fuentes por valoración. Sección "Fuentes" nueva al pie de la
    ficha del jugador (sólo visible si hay `externalSource`/`externalUrl` reales). Panel nuevo
    `ResearchPanel.tsx` -- pestaña "Investigación histórica" dentro de Seguridad (mismo patrón que
    la pestaña "Importación de datos" existente): formulario de alcance (país/competición/rango de
    años/tipo de entidad) + `POST /research/runs`, lista de corridas con progreso/contadores/log en
    tiempo real por polling (mismo patrón que `ImportSyncPanel` ya usa).
  - **Aclaración honesta sobre "segundo plano"**: el backend no tiene cola de trabajos (Redis/Bull) ni
    un crawler autónomo -- no se prometió esa capacidad. La ejecución real de descubrimiento (buscar
    en fuentes públicas) la hace un agente explícitamente por corrida, usando las mismas herramientas
    de búsqueda web ya usadas esta sesión; el backend aporta el seguimiento real de progreso/
    conflictos/log mientras esa corrida ocurre, consultable por HTTP. Esto se le explicó al usuario
    en la propuesta de arquitectura previa y se mantuvo sin cambios.
  - **Ejecución real, dos corridas, verificadas contra la base (no simuladas)**:
    - **Corrida piloto #39** (Paraguay 1906-1910, el rango pedido explícitamente para validar antes
      de escalar): investigación real vía Wikipedia sobre la fundación de la Liga Paraguaya de
      Football (18/06/1906) encontró **2 jugadores reales, verificables, citados**: Salvador Melián
      (Guaraní) y Miguel Díaz (Olimpia), primer y segundo goleador de la historia de la liga
      paraguaya (partido inaugural, 08/07/1906) -- confirmado directamente en
      `en.wikipedia.org/wiki/1906_Paraguayan_Primera_Division_season`, tras descartar una síntesis
      de búsqueda que atribuía el mismo dato a una fuente que en realidad no lo mencionaba (mismo
      criterio de verificación directa contra la fuente primaria de toda la sesión). Vinculados a
      sus clubes reales, temporada 1906, reutilizando la competición ya existente "Liga Paraguaya de
      Football" (id 16, no se creó una duplicada). **No se encontraron oficiales verificables para
      1906-1910** (ninguna fuente consultada nombra árbitros de ese período) -- resultado honesto,
      no forzado.
    - **Corrida principal #40** (Paraguay 1990-2026): se enriquecieron **8 jugadores reales ya
      existentes** en la base (del import real de mundialistas de una sesión anterior, todos con
      `date_of_birth`/`position` vacíos hasta ahora) con datos verificados vía Wikipedia: José Luis
      Chilavert, Roque Santa Cruz, Carlos Gamarra, Celso Ayala, Justo Villar, Nelson Valdez, Denis
      Caniza, José Cardozo -- fecha de nacimiento, lugar de nacimiento, posición, altura, y su
      historial real de clubes paraguayos (Cerro Porteño, Olimpia, Libertad, Sol de América,
      Tembetary, River Plate, Guaraní, Sportivo Luqueño, según cada caso), sin tocar ni duplicar su
      historial ya real de selección nacional (mundiales 1998/2002/2010) cargado anteriormente.
      **Caso insignia: Aldo Bobadilla** (el ejemplo que el propio usuario usó repetidamente durante
      toda la sesión) pasó de fecha de nacimiento/posición/equipo vacíos a: nacido 20/04/1976 en
      Pedro Juan Caballero, portero, 1,92 m, con su historial real completo (Cerro Porteño
      1997-2004, Libertad 2005-2006, Olimpia 2011) -- verificado con 3 fuentes independientes
      (Transfermarkt, Wikipedia en inglés, síntesis de búsqueda), todas coincidentes. **1 oficial
      real nuevo**: Ubaldo Aquino (árbitro principal, dirigió partidos del Mundial 2002 y finales de
      Copa América), encontrado en la categoría real de Wikipedia "Árbitros de fútbol de Paraguay".
      **1 fotografía real adquirida y verificada**: Chilavert, vía Wikimedia Commons (CC BY 2.0) --
      con un caso real de identificación fallida correctamente rechazado en el camino (un archivo
      llamado "Chilavert2.jpg" resultó ser una foto de una esquina de un barrio de Buenos Aires
      llamado Chilavert, no del futbolista -- se descartó sin usarlo, exactamente la protección que
      pedía el punto 5/12 del pedido).
    - **Verificado directamente en la base (no inventado), antes/después**: jugadores 50→52 (+2
      reales, pilot), 11 jugadores con `data_origin='research'`; oficiales 0→1; relaciones
      jugador-equipo 64→84 (+20 reales); fotos de jugador +1 (verificada); `teams`/`competitions`
      sin cambio de cantidad (119/34) -- **cero duplicados creados** pese a que ya existían filas
      duplicadas preexistentes de "Olimpia"/"Guaraní" en la base (halladas durante la verificación,
      de datos de prueba/importaciones anteriores a este turno) -- el resolvedor de equipos priorizó
      correctamente la fila real con `country` poblado sobre las duplicadas sin país, sin crear una
      octava/cuarta.
  - **Valoraciones de videojuego: estructura y funcionalidad completa, cero datos reales cargados
    -- limitación técnica real, no simulada**. Se intentó activamente (Roque Santa Cruz, con
    ediciones reales confirmadas por buscador desde FIFA 07 hasta FC 25) contra 4 fuentes
    especializadas distintas (SoFIFA, FIFACM, FUTWIZ, FIFAIndex) -- **las 4 bloquearon el acceso
    automatizado (403)**. Por la regla explícita de no evadir bloqueos y no cargar un dato sin
    poder verificarlo directamente contra la página real (mismo criterio que ya exigió corregir el
    caso Melián/Díaz de la corrida piloto), no se insertó ningún valor de valoración a partir de
    fragmentos de resultados de búsqueda sin confirmación directa. El endpoint
    `GET /players/:id/videogame-ratings` y la sección de la ficha muestran correctamente el estado
    honesto "NO DISPONIBLE" para todos los jugadores reales hoy.
  - **Qué se dejó explícitamente para después** (no forma parte de los dos problemas que el usuario
    pidió resolver esta vez): no se renombró `sync_*`→`research_*` ni se construyó la tabla genérica
    `field_provenance`/`entity_external_ids` de la arquitectura propuesta (se usaron las columnas de
    procedencia ya existentes por entidad); no se eliminó el sistema de importación anterior (RSSSF/
    TheSportsDB/Ltrack/CSV/Excel siguen presentes, sin usarse en este turno); no se construyó
    `match_formations` ni la cancha interactiva/mapa de calor (no estaban en la lista de prioridades
    1-10 de este pedido). El motor de investigación en background real (cola de trabajos,
    ejecución desatendida) tampoco existe -- ver aclaración arriba.
  - `npx tsc --noEmit` y la suite de tests (backend 24/24, frontend 2/2) limpios antes y después de
    la ejecución real. Cuenta de prueba desactivada al finalizar.

- **2026-08-26 (v50, corrección de la sección de Valoraciones + población real vía PESmaster.com).**
  El usuario dio dos pedidos seguidos sobre el trabajo de v49:
  1. **Corrección de interfaz**: "Valoraciones de videojuegos" en la ficha del jugador debía decir
     sólo "Valoraciones" (el framing de videojuegos era "un ejemplo nada más") y debía poder cargarse
     manualmente. Corregido: título y descripción genéricos en `VideogameRatingsSection.tsx`
     (`{selected.videogameName} — {selected.editionName}` en la tarjeta pasó a mostrar sólo la
     edición); nuevo formulario `AddRatingForm` con botón "+ Agregar valoración" que arma el mismo
     payload que ya aceptaba `POST /players/:id/videogame-ratings`, con las categorías filtradas por
     posición del jugador (`playerType` field/goalkeeper) y todos los valores etiquetados como
     porcentaje. Probado de punta a punta (crear → aparece en la lista → se ve en la tarjeta) y el
     dato de prueba se eliminó después (`DELETE` directo, cascada limpia sobre `category_scores`).
  2. **Nueva fuente real**: el usuario pidió consultar `pesmaster.com/es/efootball-2022/` para
     valoraciones y fotos. `robots.txt` de PESmaster permite explícitamente el acceso automatizado
     (`Allow: /`) -- funcionó de punta a punta. **3 jugadores paraguayos reales nuevos** (no
     existían en la base): Antonio Sanabria, Juan Escobar, Alejandro Romero ("Kaku") -- cada uno con
     su valoración eFootball 2022 real (general + 5 categorías + ~20 atributos detallados).
     **Hallazgo real de modelo**: eFootball agrupa sus atributos ofensivos bajo "Attacking", que no
     equivale a "Tiro" (SHO, categoría FIFA/EA) -- se agregó una categoría nueva `ATK`/"Ataque"
     (migración 038) en vez de tergiversar el dato metiéndolo en una categoría ajena.
  - **Segundo pedido, mismo turno**: el usuario pidió consultar `fifaindex.com/es/jugadores`
    también. **Bloqueado (403) -- incluso su propio `robots.txt` devuelve 403**, típico de
    protección Cloudflare a nivel de dominio, no una política de robots.txt que se pueda respetar
    selectivamente. Es la 5ª fuente especializada de valoraciones de videojuego que bloquea el
    acceso automatizado en esta sesión (las otras 4: SoFIFA, FIFACM, FUTWIZ, FIFAIndex mismo con
    otra URL). No se intentó evadir. En cambio, se continuó por la fuente que sí funciona
    (PESmaster) para cumplir el pedido de "si es necesario agregar más": **6 jugadores reales
    adicionales** -- 5 nuevos (Gustavo Gómez, Roberto Junior "Gatito" Fernández, Miguel Almirón,
    Damián Bobadilla -- hijo real de Aldo Bobadilla, confirmado por fuente --, Carlos González) más
    1 enriquecido (Julio Enciso, ya existía en la base desde una importación real anterior).
    **Hallazgo real de modelo #2**: a diferencia de lo asumido en v49 (arquero = set de categorías
    exclusivo DIV/HAN/KIC/REF/SPD/POS, calcado de FIFA), eFootball le da a un arquero real valores
    genuinos en las 5 categorías de campo *más* una categoría "Goalkeeping" compuesta real (no un
    valor de relleno) -- se agregó `GK`/"Portería" (migración 039) en vez de forzar los datos reales
    de Gatito Fernández dentro del set FIFA-céntrico que no aplica a esta fuente.
  - **Fotografías**: 2 reales obtenidas y verificadas por identidad vía Wikimedia Commons (Gustavo
    Gómez, Miguel Almirón, ambas CC BY-SA 4.0) -- de PESmaster mismo no se pudieron recuperar fotos
    (las imágenes se cargan por JavaScript, sin URL directa disponible en el HTML que las
    herramientas puedan leer; no se inventó ninguna).
  - **Verificado en la base, antes/después de este turno completo**: jugadores 55→60 (+5 reales),
    oficiales sin cambio (1), valoraciones de videojuego 0→9 (todas reales, con fuente y URL),
    fotos +2 reales, `teams`/`competitions` sin cambio (119/34, cero duplicados). `npx tsc --noEmit`
    limpio. Cuenta de prueba desactivada al finalizar.

- **2026-08-26 (v51, corrección de traducción en atributos detallados + investigación real vía
  Sofascore.com: 77 jugadores + 1 partido real completo).**
  1. **Bug real reportado por captura de pantalla**: los atributos detallados de las valoraciones
     (ej. "Offensive Awareness", "Finishing", "Kicking Power" bajo "Ataque") se mostraban en inglés
     -- `attribute_name_source` guarda el nombre TAL CUAL lo dio la fuente (necesario para citar la
     procedencia con precisión), pero la interfaz lo usaba directo como texto a mostrar. Corregido
     con una tabla de traducción `DETAILED_ATTRIBUTE_ES` en `VideogameRatingsSection.tsx` (26
     códigos, cubre el 100% de lo cargado hasta ahora vía PESmaster) que traduce para mostrar sin
     perder el nombre original de la fuente.
  2. **Sofascore.com**: `robots.txt` sólo bloquea el bot "Bytespider" y rutas de archivo histórico/
     tablas de posiciones -- no bloquea jugadores/equipos/partidos. Funcionó para roster de equipo,
     **no funcionó** para pestañas interactivas (alineaciones/formaciones/árbitro/valoraciones por
     partido -- cargan por JavaScript, no están en el HTML que las herramientas pueden leer) ni para
     su API directa (`api.sofascore.com`, bloqueada con 403 -- no se intentó evadir).
     - **77 jugadores reales nuevos**: planteles completos y reales de Olimpia (37) y Cerro Porteño
       (42, con el plantel completo real verificado, 1 no procesado por conflicto) vía las páginas de
       equipo de Sofascore, cada uno vinculado a su club real actual. **2 conflictos reales
       correctamente detectados y NO fusionados a ciegas**: "Roberto Fernández" (arquero actual de
       Cerro Porteño) vs. "Roberto Junior Fernández" (Gatito, ya cargado desde PESmaster -- 40% de
       similitud, ambigüedad real: ¿mismo apodo abreviado o persona distinta?); "Carlos Franco"
       (mediocampista actual de Cerro Porteño) vs. "Juan Carlos Franco" (ya existía en la base desde
       antes de esta sesión -- 35% de similitud). Ambos quedan pendientes de revisión manual, tal
       como exige la regla de identificación del pedido original.
     - **1 partido real completo creado** (Olimpia 2-1 Cerro Porteño, 23/08/2026, Primera División
       Clausura Fecha 6, estadio real Osvaldo Domínguez Dibb) usando los endpoints YA EXISTENTES de
       Partidos (`POST /matches`, `PUT /matches/:id/result`, `POST /matches/:id/goals`) -- no hizo
       falta código nuevo. 3 goles reales con autor y minuto exacto (Alexis Cañete 44', Eduardo
       Delmas 58', Hugo Sandoval 63'), los 3 goleadores además cargados como participantes reales del
       partido (`match_lineups`) -- **sin inventar** el resto de la alineación, titular/suplente,
       formación ni árbitro, ya que esa información específica no se pudo verificar (motivo
       registrado en el comentario del propio partido, visible en el sistema, no oculto). Esto deja
       explícitamente sin resolver, por limitación técnica real, la parte de CANCHA/formaciones/
       oficiales de partido del pedido -- no simulado, no forzado.
  - **Verificado en la base, antes/después**: jugadores 60→137 (+77 reales), partidos +1 real,
    goles +3 reales, `teams` sin cambio (119, Olimpia/Cerro Porteño reutilizados correctamente por
    id existente -- confirmado contra las filas duplicadas ya preexistentes de antes de esta
    sesión, ninguna nueva creada). `npx tsc --noEmit` y la suite de tests (backend 24/24) limpios.
    Cuenta de prueba desactivada al finalizar.

- **2026-08-26 (v52, `match_formations` -- esquema informado por la estructura de StatsBomb
  open-data, sin importar sus datos reales).**
  1. **Pedido del usuario**: analizar `open-data-master.zip` (ya presente en la raíz del repo),
     "profundizar" y "replicar funcionalidades y estilos" del proyecto que contiene, y ejecutarlo.
  2. **Hallazgo real al abrir el zip**: es el repositorio oficial de datos abiertos de StatsBomb
     (`README.md` dice literalmente "# StatsBomb Open Data"). Su `LICENSE.pdf` (StatsBomb Public
     Data User Agreement) prohíbe expresamente en la cláusula 1.2.1 "edit, distort, distribute,
     reproduce, sell or in any way provide the data to any external or third party", en la 1.2.2
     "commercially exploit the data", y en la Sección 7 (Intellectual Property Rights) establece que
     todos los datos son propiedad de StatsBomb y que el usuario "shall not modify, translate,
     transfer, distribute, license, sell or otherwise exploit for any purposes whatsoever any
     data... without the express prior written consent of StatsBomb".
  3. **Decisión**: cargar los partidos/jugadores/eventos reales de StatsBomb dentro de la base de
     LeagueCore violaría esos términos. En vez de decidir unilateralmente (ni cumplir literalmente
     el pedido ignorando el riesgo legal, ni negarme sin más), se consultó al usuario con
     `AskUserQuestion` explicando el hallazgo. El usuario eligió **"Sólo replicar
     estructura/estilo"**: estudiar el esquema JSON únicamente como inspiración de diseño para el
     modelo de datos propio de LeagueCore, sin cargar jamás contenido real de StatsBomb (nombres de
     competiciones, equipos, jugadores, partidos o eventos) en la base.
  4. **Lo aprendido de la estructura real (sólo esquema, ningún dato cargado)**: en
     `data/lineups/<match_id>.json` y `data/events/<match_id>.json`, la formación táctica se declara
     por EQUIPO (no por jugador) como un código numérico (ej. `433`) sobre eventos "Starting XI"/
     "Tactical Shift"; las coordenadas de cancha son `[x,y]` sobre una grilla de 120×80 yardas
     (distinto de la convención 0-100 normalizada que ya usa LeagueCore, que se mantuvo sin tocar).
  5. **Implementado (real, ejecutado, verificado)**: tabla nueva `match_formations` (migración 040:
     `match_id`, `team_id`, `formation_shape` NVARCHAR(10), `period` opcional, `source` opcional,
     `UNIQUE(match_id, team_id, period)`) -- traduce la convención de StatsBomb (código numérico,
     inglés) a la propia de LeagueCore (string con guiones, ej. `'4-3-3'`, ver
     `FORMATION_SHAPES` en `matches/constants.ts`). Backend: `GET/PUT /matches/:id/formations`
     (`match-participants.service.ts`, `matches.controller.ts`). Frontend: selector `FormationPicker`
     en `TacticalViewTab.tsx` por equipo (align local/visitante), con aviso NO bloqueante cuando el
     conteo real de titulares por línea (derivado de `position` real de `match_lineups`, nunca
     inventado) no coincide con lo que implica la formación declarada -- sólo informa, no fuerza.
  6. **Verificado real, extremo a extremo, contra el partido 259** (Olimpia vs. Cerro Porteño, el
     mismo partido real cargado en v51): `GET` antes → `[]`; `PUT` equipo 25 → crea id 1; `PUT`
     equipo 34 → crea id 2; `GET` después → ambas filas; segundo `PUT` sobre el mismo equipo/período
     → actualiza la fila existente (mismo id, `updatedAt` cambia) en vez de duplicar. Los valores de
     formación usados en esta prueba (`4-3-3`/`4-2-3-1`/`4-4-2`) fueron arbitrarios, sólo para
     probar el mecanismo -- por la misma disciplina de "nunca inventar datos" de toda la sesión, se
     **borraron de la base** (`DELETE FROM match_formations WHERE match_id=259`) apenas terminada la
     verificación, a diferencia de los datos reales investigados en v49-v51 que sí se conservan.
     `npx tsc --noEmit` limpio en backend y frontend (`tsconfig.app.json`), suite Vitest del
     frontend 2/2. Cuenta de prueba desactivada al finalizar.
  7. **Qué sigue sin resolver, explícitamente**: esta versión cierra el mecanismo/esquema de
     formaciones que v51 había dejado pendiente, pero NO agrega formaciones reales para partidos
     paraguayos concretos -- eso requeriría una investigación real con fuente citable (como las de
     v49-v51), que no fue parte de este pedido (scope de esta fase = estructura, no datos nuevos).

- **2026-08-26 (v53, limpieza definitiva de importadores legado + procedencia multifuente real +
  primera corrida real con el nuevo sistema).** Mega-pedido de 30 fases + 21 decisiones pidiendo
  ejecución directa ("NO QUIERO OTRO INFORME TEÓRICO... IMPLEMENTA"). Se ejecutaron, en orden, las
  primeras fases (limpieza + procedencia + una corrida real de validación); el resto queda en
  [[Decisiones Abiertas|Decisiones abiertas]] con su motivo real, no simulado.
  1. **Fase 1 -- eliminación completa de conectores legado, motor genérico intacto.** Borrados los
     11 archivos backend específicos de RSSSF/TheSportsDB/Ltrack .div-.bak/importador de archivo
     CSV-JSON-TXT-Excel (`rsssf-*.ts`, `thesportsdb-*.ts`, `ltrack-div-*.ts`, `file-import.service.ts`,
     `file-parser.ts`, `file-templates.ts`, `relational-import.service.ts`) y los 2 componentes
     frontend (`ImportSyncPanel.tsx` 1200 líneas, `RsssfImportPanel.tsx` 406 líneas). `import-engine.
     module.ts`/`import-engine.controller.ts` reescritos para quedarse SÓLO con lo genérico (16 rutas
     legado eliminadas, verificadas 404 en vivo; 10 rutas genéricas -- runs/conflicts/sources --
     intactas). **Nada de esto tocó `sync-runs.service.ts`, `sync-run-tracker.service.ts`,
     `entity-matcher.service.ts`, `conflict-resolution.service.ts` ni `ConflictCard.tsx`** -- el
     motor de seguimiento de corridas sigue siendo el mismo, ahora con un único conector real
     (`historical_research`). Pestaña "Importación de datos" borrada de Seguridad. Reporte
     "Importaciones" renombrado a "Investigación" (`InvestigacionReportPage.tsx`, ruta
     `/reportes/investigacion`, tarjeta del Centro de Reportes actualizada, `dashboard/stats` ahora
     expone `investigaciones` en vez de `importaciones`). Las 5 filas de `sync_sources` de los
     conectores eliminados NO se borraron (violarían FK de corridas históricas reales) -- se
     marcaron `status='blocked'` con motivo real (migración 041). Doc obsoleto
     `FUTURO_IMPORTACION_DATOS_EXTERNOS.md` eliminado. `npx tsc --noEmit` limpio en backend y
     frontend tras la limpieza; verificado en vivo que las rutas legado dan 404 y las genéricas
     siguen funcionando.
  2. **Fase 2 -- procedencia multifuente real (Decisiones 3-4), implementada y usada, no sólo con
     tablas.** Migración 042: `dbo.data_sources` (catálogo real: Wikipedia/Wikidata/Wikimedia
     Commons/RSSSF/PESmaster/Sofascore disponibles, SoFIFA/FIFACM/Futwiz/FIFAIndex/api.sofascore
     bloqueadas -- estados ya verificados en rondas anteriores, ninguno inventado ahora), `dbo.
     field_provenance` (log apend-only: qué fuente dijo qué valor de qué campo de qué entidad --
     nunca se pisa una fila anterior), `dbo.entity_external_ids` (varios IDs externos reales por
     entidad, no uno solo). `ProvenanceService` nuevo, wireado en `PlayerResearchService`/
     `OfficialResearchService` -- cada campo puede citar una fuente distinta de la fuente por
     defecto de la corrida (`fieldSources` en el DTO) y una entidad puede registrar varios IDs
     externos a la vez (`additionalSources`), tal cual el ejemplo del pedido (fecha de nacimiento de
     una fuente, nacionalidad de otra, club de una tercera). Nuevos endpoints `GET /players/:id/
     provenance` y `GET /officials/:id/provenance` (mismo guard que el resto de esos módulos, no
     sólo admin, porque básico también puede ver la ficha). **Backfill real** (migración 043): los
     96 jugadores + 1 oficial ya investigados en v49-v51 (antes de que existiera esta tabla) recibieron
     154 filas reales de `field_provenance` propagando su fuente ya verificada (`external_source`/
     `external_url`) a nivel de campo -- no se inventó ninguna fuente nueva, sólo se hizo explícito a
     nivel de campo lo que ya estaba registrado a nivel de fila.
     **Verificado en vivo**: Aldo Bobadilla (id 59) hoy expone 5 filas reales de procedencia
     (fecha de nacimiento, ciudad natal, nacionalidad, altura, posición, todas citando la Wikipedia
     real usada en v49). Un intento de prueba con fecha de nacimiento ficticia creó un duplicado real
     (id 148) -- confirma que el motor de matching rechaza correctamente por contradicción de fecha
     de nacimiento (regla ya existente, documentada) en vez de fusionar a ciegas; el duplicado de
     prueba se borró explícitamente (no es dato real) apenas terminada la verificación.
  3. **Fase 3/21/22 -- primera corrida real de investigación con el sistema nuevo, no simulada.**
     Fuente nueva evaluada: Portal Guaraní (`portalguarani.com`), que aloja un documento histórico
     real ("80 Años de Fútbol en el Paraguay", Miguel Ángel Bestard) con nombres reales de
     jugadores 1906-1910 -- **su `robots.txt` bloquea explícitamente a `GPTBot`**, así que ese
     contenido, aunque técnicamente accesible, NO se usó para poblar nada (misma regla de esta
     sesión: nunca evadir una restricción explícita de la fuente). En cambio se usó **ABC Color**
     (diario real paraguayo, `robots.txt` sin restricción para la nota usada), que corrobora de forma
     independiente la misma nómina de la Primera Selección Nacional Paraguaya de 1910: F. Melián, G.
     Almeida, A. Rodríguez, M. Barrios, P. Samaniego, J. Morín, Z. Gadea, D. Andreani, C. Mena Porta,
     B. Villamayor, M. Rojas, E. Erico. Los 12 son reales y nuevos (verificados contra la base antes
     de cargar -- ningún apellido coincidía con un jugador ya existente con el mismo nombre/inicial).
     **Nombres cargados exactamente como los da la fuente** (sólo inicial de nombre de pila en varios
     casos) -- no se completó ningún nombre de pila ni fecha de nacimiento por no tener esa
     información en una fuente permitida (la versión completa de esos nombres SÍ aparece en el
     documento de Portal Guaraní, pero usarla habría sido mezclar datos de una fuente bloqueada por
     la puerta de atrás, así que se dejó incompleto a propósito). Vinculados al equipo "Paraguay" ya
     existente (id 143, selección nacional) -- no se creó un equipo nuevo.
     **Verificado en la base, antes/después**: jugadores 137→149 (+12 reales), 0 conflictos, 0
     errores, corrida completa registrada (`sync_runs` id 47, 12/12 nuevos). Cuenta de prueba
     desactivada al finalizar.
  4. **Qué queda del pedido de 30 fases, sin simular que ya está hecho:** el resto (investigación
     masiva de oficiales, tarjeta visual del jugador, cancha interactiva con panel de jugador,
     mapas de calor preparados para datos reales, estadísticas avanzadas con "NO DISPONIBLE"
     explícito, ampliar Reportes con investigación/fuentes/cobertura) sigue pendiente -- ver
     [[Decisiones Abiertas|Decisiones abiertas]]. Las Valoraciones de videojuego (Fase 10-15 del
     pedido) ya estaban implementadas de punta a punta desde v49-v51 (tarjeta, categorías en
     español, drill-down, selector de edición, gráfico de evolución, alta manual) -- no se
     re-verificaron en este turno, queda pendiente confirmar que siguen funcionando tal cual antes
     de reportarlo como cerrado.

- **2026-08-26 (v54, cancha interactiva real -- `InteractiveFootballPitch`, timeline y comparación
  visual, en respuesta a "el diseño visual que pedí no está implementado").**
  1. **Pedido**: el usuario marcó que v52 (`match_formations`) implementó mecanismo/estructura pero
     ninguna experiencia visual nueva -- pidió explícitamente un componente reutilizable
     `InteractiveFootballPitch`, formación realmente animada (no sólo el texto "4-3-3"), timeline
     interactiva, panel de jugador, y comparación de equipos, aclarando de nuevo que StatsBomb es
     sólo referencia conceptual, nunca copia de diseño/datos.
  2. **`InteractiveFootballPitch.tsx`** (nuevo, `components/pitch/`): layout real por formación --
     dado un `formationShape` (`'4-3-3'`, `'4-2-3-1'`, etc.) y los titulares reales de
     `match_lineups`, calcula líneas reales (defensa/uno-o-más-medios/ataque) agrupando por la
     posición REAL de cada jugador, con tantas líneas intermedias como declara la forma -- ya no un
     agrupamiento fijo de 3 franjas. Sin formación declarada, cae al agrupamiento por rol de
     siempre (nunca cancha vacía). Reemplaza la lógica antes duplicada dentro de `TacticalViewTab`;
     queda como pieza central para reusar en otras pantallas (jugador, comparación) más adelante.
  3. **Animación real**: `PlayerMarker.tsx` ahora anima la transición de posición (`transform 0.5s
     ease`, desactivada mientras se arrastra en modo edición para no verse "atrasada") -- cambiar de
     formación o de filtro de equipo mueve a los jugadores con transición, no un salto instantáneo.
     Tooltip nativo (`<title>`) agregado por jugador (nombre + dorsal al pasar el mouse).
  4. **`MatchTimeline.tsx`** (nuevo): línea de tiempo horizontal 00'-90'+ con los eventos reales ya
     existentes (goles/tarjetas/cambios/offsides/faltas/interrupciones, mismo `GET /matches/:id/
     timeline` de siempre) posicionados por minuto real, ícono por tipo, clic abre el detalle
     (jugador/asistencia/tipo). No agrega ninguna fuente de datos nueva.
  5. **`MatchCompareStats.tsx`** (nuevo): vista "Comparar" de la pestaña táctica, lee `GET /matches/
     :id/team-stats` (el mismo endpoint ya usado por la pestaña Estadísticas) y lo muestra como
     barras enfrentadas -- si no hay ninguna estadística cargada, dice explícitamente "Estadísticas
     de equipo no disponibles para este partido todavía" en vez de inventar valores.
  6. **`TacticalViewTab.tsx` reestructurado** con selector interno `[Partido] [Equipo A] [Equipo B]
     [Comparar]` (pedido explícito §4) -- Partido conserva formaciones+timeline+cancha+suplentes,
     Equipo A/B muestran el plantel+eventos de ese equipo solo, Comparar usa el componente nuevo.
  7. **Bug real encontrado y corregido durante la verificación, no cosmético**: `match_lineups.
     position` es un campo POR PARTIDO (distinto de `players.position`, el canónico del jugador) que
     el formulario real "Agregar jugador al partido" nunca completa -- **todo jugador cargado a un
     partido por la interfaz normal quedaba con posición NULL en ese partido**, lo cual ya rompía
     silenciosamente el agrupamiento por rol desde que existe (v26), no sólo el layout nuevo. Se
     corrigió `match-participants.service.ts` para que `listLineups` devuelva
     `COALESCE(l.position, p.position)` -- una posición específica del partido sigue pudiendo
     sobreescribir la del jugador si algún día se carga, pero el caso común (nadie la completó)
     ahora usa la posición real del jugador en vez de quedar vacío.
  8. **Verificado en vivo, no sólo por tipos**: no existe ningún partido con alineación titular
     completa real en la base (`match_lineups` sólo tiene 3 filas en total, los 3 goleadores reales
     del partido Olimpia-Cerro Porteño, ninguno marcado titular) -- se armó una alineación de PRUEBA
     real (22 jugadores reales de los planteles ya investigados de Olimpia/Cerro Porteño vía
     Sofascore en v51, formaciones 4-3-3/4-4-2) contra el partido 259 para ejercitar el pipeline
     completo end-to-end (alta de alineación → formación → `GET /lineups` con posición ya resuelta
     por el fix del punto 7 → conteo real 2 Porteros/9 Defensores/8 Mediocampistas/6 Delanteros,
     coincide exactamente con lo cargado). Los 22 jugadores de prueba y las 2 formaciones se
     borraron después de verificar (no son un hecho histórico verificado de ese partido real, sólo
     sirvieron para probar el mecanismo) -- se dejaron intactos los 3 goleadores reales originales.
     `npx tsc --noEmit` limpio (backend y frontend), 24/24 tests backend, 2/2 frontend.
  9. **Limitación real, dicha explícitamente**: no hay herramienta de automatización de navegador
     disponible en esta sesión, así que no se pudo tomar una captura de pantalla real de la nueva
     experiencia -- la verificación fue por tipos + tests + contrato de API con datos reales, no
     visual. Cómo probarlo manualmente: abrir cualquier partido → pestaña "Vista táctica" -- hoy
     mostrará el estado vacío ("Todavía no hay alineación titular cargada") porque, como se explicó
     en el punto 8, ningún partido real tiene alineación titular completa todavía; para ver la
     cancha nueva en acción hace falta cargar una alineación titular real (11 jugadores por equipo,
     pestaña "Jugadores" del partido) y opcionalmente una formación.
  10. **No implementado en este turno, dicho explícitamente** (no marcado como hecho): mapa de
      pases (no hay datos de pases con coordenadas en ningún partido), mapa de calor/recorrido
      reproducible (`match_player_positions` en 0 filas), datos físicos/velocidad
      (`match_player_physical_stats` en 0 filas), comparación entre jugadores, cancha mini dentro
      del perfil del jugador, navegación contextual ampliada (estadio→partidos→competición como red
      navegable). Todos requieren datos reales que hoy no existen, o son trabajo adicional de UI no
      alcanzado en esta pasada -- quedan en [[Decisiones Abiertas|Decisiones abiertas]].

- **2026-08-26 (v55, consolidación real de 15 clubes duplicados -- 58 filas de `dbo.teams` a 15,
  cero pérdida de datos, auditoría completa).** Script: `database/data-fixes/2026-08-26_team_deduplication.sql`.

  **1. Identificación de duplicados.** Agrupados por nombre normalizado (minúsculas, espacios
  recortados) -- coincide exactamente con los 15 clubes que el usuario nombró explícitamente
  (Atlántida, Cerro Porteño, General Caballero JLM, Guaraní, Libertad, Nacional, Olimpia,
  Presidente Hayes, River Plate, Rubio Ñu, San Lorenzo, Sol de América, Sport Colombia, Sportivo
  Ameliano, Sportivo Luqueño). Total: 58 filas duplicadas → 15 maestros (-43 filas).

  **2. Registro maestro elegido por grupo** (criterio: País+Ciudad > Ciudad > País > más
  relaciones > más antiguo -- en los 15 grupos el criterio de Ciudad ya alcanzó para decidir sin
  empates, ninguno necesitó desempate por relaciones):

  | Grupo | Maestro (id) | Ciudad ya cargada | Duplicados eliminados |
  |---|---|---|---|
  | Olimpia | 75 | Asunción | 130,135,138,60,66,25 (6) |
  | Libertad | 78 | Asunción | 141,133,26,48,56 (5) |
  | Nacional | 77 | Asunción | 129,28,65,58 (4) |
  | Sol de América | 80 | Villa Elisa* | 131,32,51,57 (4) |
  | Cerro Porteño | 79 | Asunción | 139,132,34,47 (4) |
  | Presidente Hayes | 89 | Asunción | 33,55,49 (3) |
  | River Plate | 87 | Asunción | 61,46,35 (3) |
  | Rubio Ñu | 85 | Asunción | 41,59,64 (3) |
  | Sportivo Luqueño | 81 | Luque | 50,54,40 (3) |
  | San Lorenzo | 100 | San Lorenzo | 63,52 (2) |
  | Guaraní | 76 | Asunción | 62,24 (2) |
  | Atlántida | 88 | Asunción | 30 (1) |
  | General Caballero JLM | 82 | Juan León Mallorquín | 142 (1) |
  | Sport Colombia | 98 | Fernando de la Mora | 45 (1) |
  | Sportivo Ameliano | 83 | Asunción | 140 (1) |

  *Sol de América: verificado por Wikipedia antes de aceptarlo -- la sede social del club está en
  Barrio Obrero, Asunción, pero su estadio real (Luis Alfonso Giagni) está en Villa Elisa desde
  1984. El dato existente no estaba mal, es una ambigüedad real del propio club -- se dejó como
  estaba en vez de "corregirlo" con una suposición.
  [Fuente](https://es.wikipedia.org/wiki/Club_Sol_de_Am%C3%A9rica_(Asunci%C3%B3n)).

  Los 15 maestros tenían ciudad pero ningún `country` cargado -- se completó `country='Paraguay'`
  en los 15 (dato real, tomado de duplicados del mismo grupo que ya lo tenían, no inventado).

  **3. Verificación previa a tocar cualquier dato** (script de sólo lectura, sin cambios):
  cero conflictos de clave compuesta en `season_teams`/`match_coaches`/`match_formations`/
  `match_team_stats` (ningún duplicado y su maestro ya compartían la misma fila real), cero
  partidos que quedarían con local=visitante tras redirigir los IDs, cero filas de
  `player_team_history` que resultarían exactamente duplicadas (mismo jugador+equipo+fechas) --
  el script pudo ejecutarse como UPDATEs directos sin necesitar lógica de fusión fila-por-fila.

  **4. Relaciones migradas, con conteo real** (antes de borrar cualquier duplicado, dentro de una
  única transacción con `TRY/CATCH` + verificación de integridad interna antes del `COMMIT`):

  | Tabla | Filas redirigidas |
  |---|---|
  | `season_teams` | 365 |
  | `matches.home_team_id` | 202 |
  | `matches.away_team_id` | 201 |
  | `player_team_history` | 97 |
  | `goals` | 3 |
  | `match_lineups` | 3 |
  | `players.team_id` | 1 |
  | cards/fouls/offsides/substitutions/penalty_kicks/shots/match_coaches/match_formations/match_shootout_kicks/match_team_stats/match_player_stats/match_player_positions/match_advanced_metrics/team_name_history | 0 (todas vacías hoy, sin excepción) |

  **5. Verificación posterior, real, no asumida**: `dbo.teams` 119→76 (-43, exacto); TODAS las
  demás tablas con el mismo conteo total de filas antes y después (`season_teams` 405→405,
  `player_team_history` 173→173, `matches` 221→221, `goals` 3→3, `match_lineups` 3→3, `players`
  149→149) -- cero filas perdidas. Cero referencias huérfanas verificadas en las 7 tablas
  principales tras el commit. Cero nombres duplicados restantes.

  **6. Hallazgo adicional durante la verificación, limpiado aparte** (no es parte del pedido de
  consolidación, es basura de una prueba automatizada anterior sin limpiar): dos equipos
  `"TestVerif Olimpia 1787709442573"`/`"TestVerif Cerro Porteño 1787709442573"` (ids 154/155) con
  un jugador ficticio (`"TestVerif Jugador..."`, id 60) y una competición/temporadas de prueba
  completa (`"TestVerif Primera División..."`, competición id 47, temporadas 107/108) -- un árbol
  entero de fixture de test nunca borrado. Verificado que no tenía ningún partido real asociado, se
  borró el árbol completo. `dbo.teams` final: 74. `dbo.players` final: 148.

  **7. No fusionado, dicho explícitamente (regla §7 del pedido: "no asumir automáticamente")**:
  `"Sp. San Lorenzo"` (id 44) y `"Tembetary"` (id 53) probablemente sean el mismo club que
  `"San Lorenzo"`/`"Atlético Tembetary"` respectivamente (abreviaturas plausibles del nombre
  oficial), pero no se fusionaron sin verificación adicional -- quedan señalados en
  [[Decisiones Abiertas|Decisiones abiertas]] para una próxima ronda con evidencia real, no una
  suposición de coincidencia de texto.

  **8. Impacto real, verificable de inmediato**: el gráfico "Goles por equipo" (corregido en v53
  para leer de `match_period_scores`) mostraba a Olimpia y Cerro Porteño repartidos entre sus
  duplicados -- verificado en vivo tras la consolidación: Olimpia ahora es una sola fila con 135
  goles reales (antes repartidos en 3 filas), Cerro Porteño 117 (antes en 2 filas), etc.

  **9. No se tocó ningún archivo de código** -- esto fue exclusivamente una corrección de datos
  (`database/data-fixes/2026-08-26_team_deduplication.sql`, no una migración de esquema numerada
  porque no crea/altera ninguna tabla). Backend verificado sano (`GET /health`) después de correrlo.

- **2026-08-26 (v56, migración real de experiencia visual -- Partidos/Jugadores/Equipos/Temporadas,
  componentes reutilizables de análisis, sin tocar la consolidación de equipos de v55).** El usuario
  marcó que v54 sólo tocó la pestaña táctica, no una migración real de la experiencia de consulta.

  1. **`InteractiveFootballPitch` como elemento central, no descartado** -- sigue siendo el mismo
     componente de v54, ahora usado en dos modos distintos dentro de la misma pantalla de partido
     (vista de sólo lectura en "Partido", editable con drag-and-drop en "Táctica") en vez de una
     única mezcla de ambos.
  2. **`TacticalViewTab.tsx` reestructurado con el switcher pedido exactamente**: `[Partido]
     [Táctica] [Eventos] [Estadísticas]` (antes era `[Partido][Equipo A][Equipo B][Comparar]`).
     Partido = cancha de sólo lectura + filtro de equipo + mapa de tiros. Táctica = selector de
     formación + cancha editable + suplentes. Eventos = `MatchTimeline` + planteles con eventos por
     equipo. Estadísticas = `MatchCompareStats` + panel de "Analítica avanzada" (GPS/xG/xA/PPDA,
     `NO DISPONIBLE` explícito porque `match_advanced_metrics` sigue en 0 filas) + selector de
     jugador para ver su mapa de pases/calor/tiros/recorrido de ESE partido.
  3. **`MatchDetailPage.tsx`**: la pestaña de análisis pasa a ser la PRIMERA y la que carga por
     defecto al entrar (antes era "Información general"). Las pestañas de administración/CRUD
     (Eventos, Estadísticas, Jugadores) siguen existiendo tal cual, relabeleadas "(administrar)"/
     "(cargar)"/"(alineación)" para diferenciarlas de la nueva experiencia de consulta -- nada de
     esa funcionalidad se quitó. Encabezado del partido: competición/temporada/estadio ahora son
     clickeables (antes sólo los equipos lo eran) -- navegación cruzada real, no sólo conceptual.
     Se borró el placeholder puro "Analítica" (texto fijo, cero función) porque ahora la pestaña
     Estadísticas del análisis ya hace esa misma comprobación con datos reales.
  4. **Componentes nuevos reutilizables** (todos usan datos reales de endpoints ya existentes o
     nuevos, ninguno inventa un valor cuando no hay datos):
     - `components/stats/StatBars.tsx` -- barras enfrentadas A/B genéricas (extraído de
       `MatchCompareStats`, que ahora lo usa en vez de tener su propia lógica de barras).
     - `components/stats/StatRadar.tsx` -- radar 0-100 genérico (recharts `RadarChart`, primer uso
       de ese tipo de gráfico en todo el proyecto -- confirmado que no existía antes).
     - `components/pitch/PassMap.tsx` -- cancha + conexiones jugador→jugador, filtros reales
       (Todos/Completados/Fallados/jugador), acepta `passes` real cuando exista (hoy vacío en todos
       los partidos, no existe ninguna tabla de eventos de pase con coordenadas en el esquema).
     - `components/pitch/PlayerPitchViz.tsx` -- cancha de jugador con selector
       `[Posición][Mapa de calor][Recorrido][Pases][Tiros]`, recorrido con reproductor real
       (▶⏸⏪⏩ + slider por minuto). Reutiliza `FootballPitch`/`PassMap`, no una cancha nueva por
       pantalla.
  5. **3 endpoints backend nuevos, sólo lectura** (arquitectura preparada, datos reales cuando
     existan): `GET /matches/:id/positions[?playerId=]` (`match_player_positions`), `GET /matches/
     :id/advanced-metrics[?playerId=]` (`match_advanced_metrics`), `GET /matches/:id/players/
     :playerId/physical-stats` (`match_player_physical_stats`), `GET /players/:id/positions`
     (mismo `match_player_positions`, agregado a través de TODOS los partidos del jugador). Las
     tres tablas siguen en 0 filas reales en toda la base -- todos devuelven array/null vacío hoy,
     verificado en vivo, no inventado.
  6. **`PlayerDetailPage.tsx` reestructurado**: la tarjeta de `VideogameRatingsSection` (ya existía
     desde v49-v51 con foto+nombre+posición+valoración+6 categorías en español) ahora también
     recibe equipo/nacionalidad/edad reales y subió a ser el primer bloque de la página -- es el
     "PLAYER ANALYTICS" pedido, sin duplicar una tarjeta paralela con la misma información. Debajo:
     nueva sección de cancha del jugador (`PlayerPitchViz`, real `GET /players/:id/positions`) y
     estadísticas ahora filtrables por período real de su historial de clubes (chips clickeables
     "2011 · Olimpia", etc.) -- misma persona, mismo id, sólo cambia el alcance de la consulta
     (`GET /stats/players/:id/summary?seasonId=X`, parámetro nuevo agregado al backend).
  7. **Bug real corregido en el camino**: `player_team_history` nunca exponía `season_id` en la
     respuesta de `GET /players/:id` (columna real en la tabla desde antes, simplemente no
     seleccionada) -- sin esto, el filtro por período de la Fase 11 del pedido no tenía manera real
     de funcionar. Agregado `season_id`/`season_label` al SELECT y al tipo `PlayerTeamHistoryEntry`.
  8. **`ComparePage.tsx`** (comparador de jugadores, ya existía con stats reales vía `BarChart`) --
     se le agregó comparación de valoraciones de videojuego vía `StatRadar` (Velocidad/Tiro/Pase/
     Regate/Defensa/Físico enfrentados), usando la valoración más reciente real de cada jugador; si
     a alguno le falta, dice explícitamente `NO DISPONIBLE` en vez de mostrar un radar vacío o
     inventado.
  9. **`TeamDetailPage.tsx`**: barra de resumen real bajo el escudo (Partidos/Ganados/Empatados/
     Perdidos/Goles a favor/Goles en contra, mismo `GET /stats/teams/:id/summary` que ya alimentaba
     la pestaña Estadísticas) -- sin columna de "Títulos" porque no existe ninguna tabla de trofeos
     en el esquema, se omite en vez de inventarla.
  10. **`SeasonDetailPage.tsx`**: reemplazado el placeholder literal "Información futura" /
      "Disponible cuando se implementen los módulos correspondientes" (Jugadores/Oficiales/
      Estadísticas mostrando `--` fijo) por contenido real escopado a esa temporada puntual
      (`OverviewCards`/`GoalsByTeamChart`/`CardsByTeamChart`/`TopListCard` de goleadores y
      asistencias, mismos componentes ya probados de Competición, con `seasonId=X` real).
      **Verificado en vivo** contra la temporada 127 (la que tiene el único partido real con goles
      reales cargado): goleadores reales (Alexis Cañete, Eduardo Delmas, Hugo Sandoval), goles por
      equipo reales (Olimpia 2, Cerro Porteño 1) -- no placeholders, no ceros falsos.
  11. **`CompetitionDetailPage.tsx`**: ya tenía Estadísticas y Reportes reales (no placeholder,
      verificado leyendo el código antes de tocar nada) -- no se rediseñó visualmente esta pasada,
      queda para una ronda futura si se pide explícitamente.
  12. **No tocado esta pasada, dicho explícitamente**: `VenueDetailPage.tsx` (ya tenía foto de
      portada real desde v38, no se amplió con navegación cruzada nueva), reportes visuales nuevos
      más allá de lo ya construido en rondas anteriores, la red de navegación contextual completa
      (hoy sólo partido→equipo/competición/temporada/estadio/jugador está cableada, no
      equipo→jugadores clickeables individualmente desde la pestaña del equipo más allá de lo que
      ya hacía cada tabla).

  **Verificación final real** (no simulada): `npx tsc --noEmit` limpio en backend y frontend,
  `npm run build` (frontend, `vite build`) y `npx nest build` (backend) ambos compilan sin errores,
  24/24 tests backend + 2/2 frontend siguen pasando. Los 3 endpoints nuevos + `GET /players/:id/
  positions` + `GET /stats/players/:id/summary?seasonId=` verificados en vivo contra el partido 259
  y el jugador 59 (Aldo Bobadilla) con la cuenta de prueba, incluida la verificación de que el
  cliente HTTP del frontend (`services/api.ts`) ya maneja con seguridad una respuesta 200 con cuerpo
  vacío (los tres endpoints de analítica avanzada la devuelven hoy) sin romper -- confirmado
  leyendo su código, no supuesto.

- **2026-08-27 (v57, motor de migración histórica -- andamiaje real construido y probado, SIN datos
  reales de Registro Fútbol migrados todavía).** Plan técnico previamente aprobado por el usuario
  (`docs/ANALISIS_REGISTRO_FUTBOL_VS_LEAGUECORE.md` + plan de arquitectura). Regla explícita
  respetada: "NO CREAR UN SEGUNDO MOTOR" -- todo lo nuevo reutiliza `sync_runs`/`sync_conflicts`/
  `field_provenance`/`entity_external_ids`/`ConflictResolutionService` tal cual.

  1. **3 migraciones nuevas** (`045`-`047`): `dbo.migration_staging_items` (la "cola de
     investigación" que pedía el diagrama del cliente -- no existía ninguna tabla de staging en todo
     el esquema antes de esto), `dbo.coach_team_history` (gap real: sólo existía `match_coaches` por
     partido puntual, sin historial de período) + `dbo.seasons.champion_team_id` (gap real: no había
     registro de campeón de temporada), y columnas computadas persistidas `normalized_*` +
     índices en `players`/`officials`/`coaches`/`teams`/`competitions`/`venues` para que el matching
     no tenga que escanear la tabla completa en memoria por cada registro (problema real confirmado
     en `name-match.util.ts`, aceptable hoy con "decenas de filas", no con una migración masiva).
     Gotcha real encontrado en el camino: estas 6 tablas ahora también necesitan `SET
     QUOTED_IDENTIFIER ON` para `sqlcmd` suelto (documentado en `database/migrations/README.md`).
  2. **Módulo `src/backend/src/migration-engine/` nuevo**, 10 archivos: `StagingRepository`
     (CRUD de la cola), `NormalizationService` (valida/coerciona el JSON ya estructurado que se
     captura -- nunca parsea HTML/XML él mismo, ver decisión de diseño abajo), `MigrationMatcherService`
     (identidad multi-atributo real: país/ciudad para equipos-estadios-competiciones vía
     `EntityMatcherService` reactivado, apellido+fecha nacimiento+nacionalidad para personas vía
     `name-match.util.ts` pero contra un shortlist indexado en vez de toda la tabla),
     `ReconciliationService` (decide crear/enriquecer/marcar conflicto -- nunca sobrescribe un valor
     existente que contradice al nuevo, igual que ya hacía el motor de investigación), `ValidationService`
     (gate de integridad pre-commit), `CommitService` (escribe a producción con transacción SQL real
     por unidad, fix del gap documentado de que ni `PlayerResearchService` ni
     `OfficialResearchService` usan `sql.Transaction` hoy), `PipelineRunnerService` (orquesta las 15
     fases en orden, activa `sync_run_stages`/`saveCheckpoint`/`getControlFlags` -- vestigiales desde
     que se construyeron en 2020, sin ningún llamador real hasta ahora), y el controlador/módulo/DTOs.
  3. **Decisión de diseño clave**: la CAPTURA (traducir lo que se ve en Registro Fútbol a JSON
     estructurado) es siempre manual/supervisada -- igual que el motor de investigación, nunca un
     scraper desatendido -- y es la única mitad sujeta al ritmo conservador acordado con el cliente.
     Todo lo posterior (normalizar→matchear→reconciliar→validar→comprometer) es 100% automático
     porque no vuelve a tocar el sitio externo, así que puede procesar el backlog capturado sin
     límite de "cortesía". Esto resuelve a la vez la regla de nunca escribir las credenciales en
     ningún lado (la captura nunca corre desatendida con credenciales en una variable de entorno) y
     el pedido de una migración masiva real.
  4. **`ConflictResolutionService.ALIAS_TABLES` extendido** con `official`/`venue`/`coach` (antes
     sólo `competition`/`team`/`player` -- un conflicto de oficial duplicado no se podía resolver con
     "vincular con el existente", gap real documentado en el plan).
  5. **`MatchesModule` ahora también exporta `MatchEventsService`/`MatchParticipantsService`**
     (antes sólo `MatchesService` -- ningún otro módulo externo los había necesitado hasta este).

  **Smoke test real ejecutado y verificado** (no la Fase 0 piloto completa contra Registro Fútbol en
  sí -- eso requiere una sesión de captura real contra el sitio, todavía no hecha): corrida de prueba
  con 4 items sintéticos -- una competición real existente ("Primera División", Paraguay) y un
  equipo real existente ("Olimpia", Paraguay) ambos correctamente identificados como YA EXISTENTES
  (`matchVerdict: "same"`, sin duplicar), más una competición y un jugador claramente ficticios
  ambos correctamente creados como NUEVOS con procedencia real registrada en `field_provenance`
  (fuente "Registro Fútbol"). Las 15 etapas de `sync_run_stages` avanzaron con `processedItems`
  reales. `npx nest build` limpio, servidor reiniciado y probado en vivo. Datos de prueba
  eliminados después (mismo criterio que pruebas anteriores de esta sesión).

  **Explícitamente NO implementado todavía** (para no repetir el error de marcar como hecho algo que
  sólo tiene el mecanismo): ninguna captura real contra `registrofutbol.cl` -- eso es la Fase 0 del
  plan aprobado, una sesión supervisada aparte. `NormalizationService` no sabe parsear HTML/XML de
  Registro Fútbol -- ese trabajo de traducción es responsabilidad de quien captura, todavía sin
  hacer. Sin UI de frontend para este motor (el panel de progreso con barras por fase que pidió el
  cliente queda para cuando haya una corrida real que mostrar). Procedencia a nivel de campo sólo se
  registra para las entidades de catálogo (competición/temporada/equipo/estadio/jugador/oficial/
  técnico) -- los tipos de relación/evento (gol/tarjeta/alineación/etc.) todavía no generan su propia
  fila de `field_provenance`.

- **2026-08-27 (v58, Fase 0 -- primera captura real contra Registro Fútbol, autorizada por el
  cliente).** Ejecutada la sesión de captura supervisada que v57 dejó pendiente.

  1. **El propio ejemplo del cliente (Olimpia, Primera División, 2008) no existe en la fuente.**
     Revisado el selector completo de 427 equipos de "Equipos → Historial": cero coincidencias para
     "Olimpia". Escalando la investigación con Cerro Porteño (uno de los 3 únicos clubes paraguayos
     reales en la base, junto a Guaraní y 12 de Octubre), se confirmó un hallazgo estructural mayor:
     **Registro Fútbol es una base de datos de fútbol CHILENO**, no sudamericana en general -- las 19
     campañas reales de Cerro Porteño ahí (1967-2024) son TODAS copas continentales (Libertadores/
     Sudamericana/Mercosur) contra un club chileno, nunca su liga doméstica paraguaya. Yendo más
     profundo con 2 partidos reales (Colo Colo vs Cerro Porteño, Copa Libertadores 2011, ida y
     vuelta): **la alineación/goleadores/cambios sólo se registran del lado chileno** -- la tabla de
     alineación de Cerro Porteño estaba vacía en las DOS fichas (incluso jugando de local), y 8 de
     sus 8 goles reales entre ambos partidos no figuran como incidencias individuales, sólo el
     resultado global. Esto recorta bastante el valor real de la fuente para historia paraguaya
     específicamente -- documentado en detalle junto al resto de la auditoría.
  2. **Corrida piloto real ejecutada con Cerro Porteño vs Colo Colo (Copa Libertadores 2011, ambos
     partidos)**, con autorización explícita del cliente y en modo estrictamente lectura sobre
     Registro Fútbol (nunca se tocó ni un botón de crear/editar/eliminar). 70 items reales capturados
     (1 competición, 1 temporada, 2 equipos, 2 estadios, 15 jugadores, 2 técnicos, 2 árbitros, 15
     relaciones jugador-equipo, 2 relaciones técnico-equipo, 2 partidos, 22 alineaciones, 4 goles) --
     **resultado final: 70/70 comprometidos, cero errores, cero conflictos sin resolver.** Copa
     Libertadores (id 38) y Cerro Porteño (id 79) reconocidos correctamente como ya existentes (sin
     duplicar); los 68 restantes creados como nuevos, con `field_provenance` real citando "Registro
     Fútbol". Verificado con consultas relacionales reales (plantel completo de Colo Colo 2011 con
     nacionalidad y temporada, goleadores por partido con minuto, alineación titular, técnico por
     temporada) -- exactamente las preguntas de ejemplo que pidió el cliente, todas responden con
     datos reales.
  3. **3 bugs reales encontrados y corregidos en el camino** (justo para lo que sirve un piloto antes
     de escalar): (a) `sync_conflicts.external_id` es NVARCHAR(100) pero `ReconciliationService`
     pasaba una referencia descriptiva de ~108 caracteres -- truncamiento SQL sin capturar tumbaba
     toda la corrida con un 500 genérico; se trunca defensivamente y la referencia completa se
     conserva en `context_json`. (b) `MatchRef` tenía un solo campo `country` compartido -- se rompió
     con el primer partido internacional real (Colo Colo=Chile vs Cerro Porteño=Paraguay, mismo
     partido); rediseñado en `competitionCountry` opcional (una copa continental no tiene un solo
     país -- LeagueCore ya guarda `country=NULL` para Copa Libertadores) + `homeTeamCountry`/
     `awayTeamCountry` independientes. (c) Empate real de 3 vías en el matching de competencias:
     "Copa Libertadores Conmebol" (así etiqueta Registro Fútbol cualquier copa continental en sus
     filas de campaña) puntuó exactamente 50% de similitud contra 3 competiciones ya reales y
     distintas ("Copa Libertadores", "Copa Conmebol", "Clasificatorias CONMEBOL" -- esta última sólo
     por casualidad, ya que "clasificatorias" está en la lista de palabras genéricas del propio
     matcher). El mecanismo de seguridad funcionó bien (marcó conflicto, no fusionó solo), pero el
     candidato específico sugerido para revisar era arbitrario entre los 3 empatados -- se corrigió
     de raíz agregando `stripConmebolSuffix()` a `NormalizationService` (Registro Fútbol le agrega
     " Conmebol" al nombre de cualquier copa continental sólo en sus listados de campaña, no es parte
     del nombre real), con lo que ahora matchea exacto (100%) sin ambigüedad.
  4. **Gaps reales encontrados, no bloqueantes, quedan para una ronda futura**: no existe manera de
     reintentar automáticamente los items dependientes de un conflicto ya resuelto (tuvo que
     reiniciarse manualmente vía SQL); `CommitService.commitMatch()` no marca `data_origin`/
     `external_source` en el propio partido (sólo las entidades de catálogo tienen procedencia real
     hoy); no existe todavía un `entity_type` para sustituciones (se vieron 3 reales en la fuente,
     no se capturaron); se encontraron ids internos reales de jugador de Registro Fútbol (inputs
     ocultos `jugador_cancha[N]` en la ficha de partido, ej. `value="6597"` para Esteban Paredes) que
     serían una clave mucho mejor para `entity_external_ids` que el matching por nombre -- no usados
     todavía. El botón real "generar xml" (mencionado en la auditoría original) devolvió 404 al
     reproducirlo directamente -- no se confirmó funcional por esta vía.

  **Verificación final real**: `npx nest build` limpio tras cada corrección, servidor reiniciado y
  probado en vivo en cada paso. Integridad confirmada por consulta directa: cero filas huérfanas en
  `player_team_history`/`match_lineups`, cero duplicados (Cerro Porteño sigue siendo una sola fila,
  Copa Libertadores también). Sesión de Registro Fútbol cerrada correctamente al terminar, caché
  local borrado, credenciales nunca escritas en ningún archivo.

- **2026-08-27 (v59, primera migración masiva real -- ampliación explícita a todos los países/clubes,
  no sólo Paraguay, pedida por el cliente tras v58).** Dos partes reales: (1) inteligencia agregada
  de toda la plataforma sin necesidad de miles de requests, (2) migración relacional completa de los
  30 máximos goleadores históricos reales de Registro Fútbol.

  1. **Los 5 rankings históricos completos capturados** (Penales/Goleadores/Tarjetas/Autogoles/Más
     Campeones, filtro "Todos" = límite 100.000, años 1900-2026): **12.278 jugadores reales únicos**
     (nombre+nacionalidad) across **51 países distintos** -- Chile domina como es esperable (16.206
     apariciones agregadas) pero con presencia real confirmada de Argentina (2.624), Uruguay (587),
     Paraguay (446), Brasil (214), hasta países con una sola aparición real (Cuba, Hungría,
     Dinamarca, Bélgica, Israel, Suecia, Rusia, Austria, Irán, Irlanda del Norte, Islandia, Irlanda,
     Inglaterra). Esto responde en sí mismo al pedido de "estadística de todos los países" sin
     necesitar miles de capturas individuales -- son consultas agregadas reales de la propia fuente.
  2. **Migración relacional completa de los 30 máximos goleadores históricos** (encabezados por
     Esteban Paredes -- 338 goles reales, Francisco Valdés -- 280, Sergio Salgado -- 267): se
     capturó la carrera COMPLETA campaña por campaña de cada uno (1217 campañas reales, 1900-2026),
     no sólo su ficha básica. Resultado final tras las correcciones: **125 equipos reales, 52
     competiciones reales, 438 temporadas reales, 863 relaciones jugador-equipo reales** -- cero
     huérfanos, cero duplicados. Ejemplo real verificado: la carrera completa y correcta de Esteban
     Paredes reconstruida año por año, 2000 (Santiago Morning) → 2023 (San Antonio Unido), incluyendo
     sus años en Colo Colo (2009-2020) EN PARALELO con sus convocatorias a la selección de Chile
     (2006, 2009-2013, 2017-2018) -- exactamente el tipo de reconstrucción relacional real que pedía
     el objetivo original del motor.
  3. **3 bugs reales más encontrados y corregidos** (a escala real, no sintética):
     - Un jugador con varias campañas reales en el mismo club a lo largo de los años colapsaba a UNA
       sola relación `player_team_history` porque el chequeo de idempotencia de `CommitService` sólo
       miraba (jugador, equipo), ignorando que cada año es una relación real distinta con su propia
       temporada -- 1217 campañas reales capturadas quedaban en sólo 382 filas. Corregido: la
       idempotencia ahora es por (jugador, equipo, fecha de inicio).
     - Procesar las campañas en el orden en que la fuente las lista (año más reciente primero) violó
       la restricción real `CK_pth_dates` (fin < inicio) en 719 filas, porque el mecanismo de "cerrar
       el paso anterior" asume orden cronológico ascendente. Corregido de raíz: cada campaña
       histórica ahora lleva fecha de inicio Y fin explícitas (todo el año calendario), así ninguna
       fila queda "abierta" esperando que la siguiente la cierre.
     - **Jugador duplicado real encontrado**: el mismo Esteban Paredes ya creado en la Fase 0 (v58,
       `firstName="Esteban Efraín"`, `lastName="Paredes"`) volvió a crearse como persona distinta
       (`firstName="Esteban"`, `lastName="Efraín Paredes Quintanilla"`) porque el script de captura
       masiva partió su nombre completo con una heurística ingenua (primera palabra = nombre, resto
       = apellido) -- el shortlist de matching por apellido normalizado (migración 047, construido
       para que el matching escale) nunca encontró al candidato real porque "Paredes" ≠ "Efraín
       Paredes Quintanilla" como texto exacto. **Gap real, no resuelto de raíz todavía**: nombres
       españoles con más de un nombre de pila son ambiguos de partir sin una fuente de verdad
       adicional, y el shortlist por apellido exacto (necesario para que el matching escale a miles
       de personas) puede fallar precisamente en este caso. Se fusionó manualmente la persona
       duplicada (mismo criterio que la consolidación de clubes de agosto: mover el historial real a
       la entidad correcta, con gate de integridad antes de borrar) -- pero el riesgo de que esto
       vuelva a pasar con otro nombre compuesto sigue latente para futuras corridas masivas.
  4. **Gap real, no corregido todavía**: el camino de "enriquecer" (`verdict === 'same'`) de
     `CommitService` nunca llama a `ProvenanceService.recordField()` -- sólo el camino de "crear
     nuevo" registra procedencia. En una migración masiva con reintentos (como ésta, que tuvo que
     reprocesar corridas varias veces tras cada corrección), esto significa que la procedencia real
     de un campo puede faltar si la entidad ya existía de una corrida anterior al momento de
     escribirla.

  **Explícitamente NO hecho todavía, alcance real de esta ronda**: sólo 30 personas (los máximos
  goleadores históricos) tienen su carrera completa migrada -- los otros ~12.248 nombres reales de
  los rankings son inteligencia agregada real, no personas individualmente migradas con su historial
  de club. Ningún partido/alineación/gol a nivel de evento fue migrado en esta ronda (sólo relaciones
  jugador-equipo-temporada) -- eso fue exclusivo de la Fase 0 (v58, un solo cruce Cerro
  Porteño/Colo Colo). Escalar más allá de estos 30 jugadores requiere nuevas sesiones de captura
  supervisada, respetando el ritmo conservador ya acordado.

- **2026-08-27 (v60, segundo lote real -- goleadores históricos posiciones 31-80, mismo día, tras
  "continua").** Antes de escalar, se cerró el gap de persona duplicada que v59 había dejado abierto.

  1. **`MigrationMatcherService.matchPerson()` ahora tiene un fallback real**: si el apellido exacto
     no encuentra nada, busca candidatos cuyo nombre completo comparta alguna palabra significativa
     (≥4 caracteres) con la consulta, y los puntúa con la misma superposición de palabras que ya usa
     `EntityMatcherService` para equipos/competiciones -- cualquier coincidencia por esta vía queda
     como `ambiguous` como mínimo, nunca se auto-declara "misma persona" (señal más débil que el
     camino principal). **Probado en vivo contra el bug real exacto**: volver a enviar "Esteban" /
     "Efrain Paredes Quintanilla" (el mismo corte que generó el duplicado en v59) ahora encuentra
     correctamente al jugador 172 real como conflicto, en vez de crear otra persona.
  2. **Gap real que el propio v59 decía haber cerrado pero no había cerrado**: `create_new` para un
     conflicto de tipo `player` exigía `context.teamId`, pese a que `dbo.players.team_id` es NULL-able
     desde la migración 011 -- bloqueaba exactamente el caso real de crear una persona nueva sin
     equipo resuelto todavía en la misma corrida. Corregido: `teamId` ahora es opcional de verdad, y
     el partido de nombre usa la misma heurística de "últimas 2 palabras = apellido" ya corregida en
     el motor de migración.
  3. **Migrada la carrera completa real de 50 goleadores históricos más** (posiciones 31-80, 1719
     campañas reales, 1900-2026). 17 conflictos reales encontrados en el camino -- **9 de ellos contra
     leyendas paraguayas ya cargadas en LeagueCore** (José Luis Chilavert, Carlos Gamarra, Roberto
     Acuña, Ricardo Tavarelli, Juan Escobar) que compartían nombre de pila con jugadores chilenos
     nuevos -- el sistema los distinguió correctamente en todos los casos, cero fusiones falsas.
     2 conflictos reales sí eran duplicados genuinos (Copa Mercosur/Mercosur, Deportivo
     Recoleta/Recoleta) y se vincularon.
  4. **Alias real agregado a `NormalizationService`** (mismo criterio que el sufijo "Conmebol" de
     v58): Registro Fútbol nombra "Mercosur" e "Intercontinental" sin el prefijo "Copa" en su propio
     catálogo de campeonatos, mientras LeagueCore ya las tenía cargadas con el prefijo -- confirmado
     real dos veces (v58 y esta ronda) antes de corregirlo de raíz en vez de parchear a mano en cada
     corrida.

  **Resultado final combinado de toda la migración hasta ahora** (Fase 0 + ambos lotes de
  goleadores): **242 jugadores, 132 equipos, 52 competiciones, 519 temporadas, 1.815 relaciones
  jugador-equipo reales -- cero huérfanos, cero duplicados**, verificado por consulta directa tras
  cada ronda. `npx nest build` limpio en cada corrección, servidor probado en vivo en cada paso.

---

## 0. Nota crítica sobre las fuentes analizadas

### 0.1 El texto de requisitos específico de LeagueCore no fue recibido aún

El mensaje del usuario indica: *"también se te proporcionará un texto adicional donde se detallará
específicamente cómo quiero que sea LeagueCore"*. Se esperaba que ese texto fuera el archivo
`Archivos/Indicaciones de como armar el sistema.txt`, pero al leerlo su contenido real es un **índice de
lectura ("hoja de ruta") para los documentos de análisis de Ltrack** — no contiene requisitos
específicos de LeagueCore (nombre del sistema nuevo, diferencias deseadas, alcance, features nuevas,
qué se descarta, etc.).

**Consecuencia:** las secciones que dependen de saber qué es "diferente" en LeagueCore (§7) no se
pueden completar todavía con certeza. Todo lo que sigue en este informe describe **Ltrack** (el sistema
de referencia) y propone una arquitectura técnica genérica razonable, pero no puede afirmar qué de
esto aplica a LeagueCore hasta recibir ese texto.

### 0.2 Verificación directa contra los archivos reales de la máquina

Más allá de los documentos, se comprobó directamente en este equipo:

| Elemento | Ruta | Estado |
|---|---|---|
| Ejecutable Ltrack32.exe | `C:\Program Files (x86)\Ltrack\` | ✅ Presente (6.69 MB, instalado) |
| Archivos de datos .div/.bak | `C:\Users\PC-HORIZONTE\Documents\LTRACK\` | ✅ 9 archivos presentes, tamaños coinciden con lo documentado |
| Configuración | `...\AppData\Roaming\Nugget Software\Ltrack\ltrack.ini` | ✅ Presente, en uso activo |
| Header binario .div (`05 44 49 56 48 44 [F/P/M/O]`) | COPA ASUNCION.div/.bak, PARAGUAY PRIMERA.div | ✅ **Confirmado por hexdump real**, coincide byte a byte con la especificación documentada |

Esto es relevante porque el material de `/Archivos` fue generado por un análisis previo (con fecha
"19 Agosto 2026", firmado como hecho por "Claude") y **no todo lo que afirma está verificado de forma
independiente**. La parte del formato de header sí quedó confirmada ahora. El **contenido comprimido
interno** (partidos, goles, fechas exactas) sigue sin decodificarse — sólo se extrajeron *strings* sueltos
(nombres de equipos/jugadores) por búsqueda de texto plano en el binario, no una lectura estructurada.

> **Actualización 2026-08-25 (ver changelog v32):** esta última afirmación ya no es cierta. El
> contenido estructurado (catálogo de equipos, catálogo de jugadores CON su equipo, y el historial de
> partidos con fecha/resultado real) fue efectivamente decodificado por ingeniería inversa y conectado
> como fuente real del motor de importación (`ltrack_div`). Ver el changelog v32 para el detalle
> técnico completo.

### 0.3 Documentos referenciados que no están presentes

Los documentos existentes se citan entre sí y mencionan otros archivos que **no están** en
`/Archivos`: `LTRACK_OPCIONES_ALMACENAMIENTO.md`, `LTRACK_ANALISIS_VIABILIDAD_TECNICA.md`,
`LTRACK_CHANGELOG.md`, `LTRACK_MATRIZ_AUTOEVALUACION.md`, `LTRACK_INDEX_LECTURA.md`. Todo lo que
esos documentos ausentes pudieran decir sólo se conoce indirectamente por resúmenes en los
documentos que sí están, y se marca como tal donde corresponda.

### 0.4 Contradicción interna detectada en el material de Ltrack (no de LeagueCore)

El documento madre (`LTRACK_DOCUMENTO_TRANSFERENCIA_COMPLETO.md`) declara como **"decisión aprobada"**
usar **SQLite local + Google Drive** (arquitectura offline-first, sync cada 5 min). Sin embargo, el PDF
de fases (`LTRACK_PLAN_FASES_COMPLETO.pdf`) describe repetidamente un **"schema PostgreSQL"** y dice
literalmente "equivalentes claros en React/Express/**PostgreSQL**". Es decir, el propio análisis previo
no fue consistente en su elección de motor de datos. Esto ya no importa para LeagueCore porque el
usuario definió explícitamente **SQL Server** como motor (§8), pero sirve de advertencia: las
"decisiones aprobadas" de esos documentos no deben tomarse como definitivas sin revisarlas.

---

## 1. Comprensión general de LeagueCore

Con la información disponible hasta ahora:

- **LeagueCore** es el nombre oficial del sistema nuevo a construir en
  `C:\Users\PC-HORIZONTE\Documents\GitHub\LeagueCore`.
- Su punto de partida funcional es **Ltrack v7.0** ("League Tracker"), un programa freeware de
  escritorio para Windows (Delphi 32-bit, compañía **Nugget Software**, ya extinta, sin soporte),
  cuyo propósito documentado por el propio autor original (README.TXT del instalador) es: *"a Windows
  program that allows you to track one or more Football league tables through the season"*, con
  predicción de resultados futuros y actualización automática por Internet para algunas ligas
  inglesas.
- El usuario (dueño de este equipo) tiene datos reales cargados en Ltrack: principalmente **ligas de
  fútbol paraguayo** (Copa Asunción, Paraguay Primera División — con datos históricos que el análisis
  previo afirma cubren 1964–2024, Torneo de Paraguarí, Torneo República, Torneo Femenino) y una liga
  inglesa (`englge22021` = English League 2021).
- LeagueCore **no es una copia** de Ltrack: conserva las funcionalidades y reglas de negocio que se
  confirmen necesarias, pero se construye con stack moderno, base de datos SQL Server, y — según el
  texto de requisitos aún no recibido — probablemente con mejoras/cambios de alcance que **todavía no
  conozco**.
- **Lo que falta para cerrar esta comprensión:** el texto de requisitos específico (§0.1).

---

## 2. Funcionalidades identificadas (en Ltrack — base de partida)

Documentadas en el análisis previo y, donde fue posible, confirmadas con evidencia primaria
(`README.TXT`, `ltrack.ini` reales de esta máquina):

### Gestión de competición
- Crear nueva liga/competición desde cero; nombre, año.
- Configurar reglas de puntuación (puntos por victoria/empate/derrota).
- Configurar promoción/relegación automática y por playoffs (cantidades configurables por liga).
- Configurar duración de partido y cantidad de tiempos (jugables, ej. 2 tiempos de 45 min).
- Gestión de equipos, jugadores, plantillas, árbitros, estadios y naciones (CRUD).

### Entrada de resultados
- Alta de partidos (fixture), ingreso de marcador, fecha/hora, jornada ("round").
- Registro de goles por jugador (minuto, autogol, penal).
- Registro de tarjetas amarillas/rojas (jugador, minuto).
- Registro de penales (incluye penales fallados).
- Sustituciones de jugadores.
- Estadísticas por partido: asistencia/público ("crowd" — confirmado real en `ltrack.ini`, consulta
  guardada "Crowd Summary"), posesión, corners, faltas (mencionados en el análisis previo, no
  verificados directamente).
- Recalculo automático de la tabla de posiciones al modificar un resultado.
- Validación de duplicados e integridad de datos.

### Tabla de posiciones y estadísticas
- Tabla de posiciones automática, con criterios de desempate configurables.
- Filtros: local/visitante, rango de fechas.
- Estadísticas por equipo (PJ, PG, PE, PP, goles) y por jugador (goles, asistencias).
- Top goleadores, distribución de goles por tiempo de juego, mejor ataque/mejor defensa (confirmado
  real en `ltrack.ini`: consultas guardadas "Best Attack", "Best Defence", "Top Scorers").
- Estadísticas de árbitros (partidos dirigidos, ratio de tarjetas).
- Gráficos de evolución de puntos.

### Consultas y reportes
- **Query Builder visual** confirmado real: el `ltrack.ini` de este equipo tiene 9 consultas
  guardadas por el usuario (Table Summary, Crowd Summary, Best Attack, Best Defence, High Scoring
  Games, Penalty Goals, Own Goals, Top Scorers, Red Card List), con predicados, orden y campos
  codificados numéricamente — evidencia de que el módulo de consultas es real y activamente usado.
- Exportación: CSV, TXT, HTML (con plantilla, `template.txt` presente en la instalación),
  portapapeles.
- Importación: CSV, TXT, con detección de duplicados y validación.

### Otros
- 7 temas visuales VCL compilados (no extraíbles como asset — hay que rediseñar UI desde cero).
- Ayuda contextual (CHM), impresión, configuración persistente (`ltrack.ini`).
- **Predicción de resultados futuros**: mencionada explícitamente en el README oficial ("allows you
  to predict the results of future matches and analyse their impact on league table positions"), pero
  su lógica interna **no está documentada** — riesgo señalado también por el análisis previo.
- **Actualización automática vía Internet** para algunas ligas (mencionada en el README oficial);
  casi seguro basada en APIs de ~2010-2015 hoy extintas, no verificado.

---

## 3. Módulos identificados

El análisis previo mapeó **48 formularios Delphi** del ejecutable original en 4 grupos funcionales
(esto es un inventario de la interfaz original, no confirmado por inspección propia del binario, sólo
heredado del documento fuente):

| Módulo | Cant. formularios | Ejemplos |
|---|---|---|
| Competición | 8 | Crear liga, configurar reglas, gestión de equipos/plantillas/árbitros/estadios |
| Resultados | 12 | Alta de partido, cambiar marcador, goles, tarjetas, penales, sustituciones, predicción |
| Consultas y Reportes | 15 | Query builder, export/import múltiple formato, gráficos, estadísticas de árbitros |
| Otros / sistema | 13 | Ventana principal, splash, selector de fecha/equipos, configuración, actualización web |

Estos 4 grupos son un buen punto de partida para pensar los **módulos de LeagueCore** (Competiciones,
Resultados, Estadísticas/Reportes, Administración), pero la organización final depende del texto de
requisitos aún no recibido.

---

## 4. Entidades y datos identificados

### Modelo de datos propuesto por el análisis previo (sin adaptar a SQL Server todavía)

El documento madre propone 7 entidades + 1 vista calculada, pensadas originalmente para SQLite:

| Entidad | Campos clave |
|---|---|
| `competitions` | nombre, año, cantidad de equipos, puntos por victoria/empate/derrota, config. de promoción/relegación |
| `teams` | competición, nombre, ciudad, estadio, fundación, escudo (URL), DT, puntos añadidos/incrementos (para descuentos de puntos), sección |
| `players` | equipo, nombre, posición, dorsal, fecha nac., nacionalidad, altura, peso |
| `matches` | competición, equipo local/visitante, goles local/visitante, fecha/hora, jornada, período, estadio, árbitro, asistencia, televisado, abandonado, anulado |
| `goals` | partido, jugador, minuto, autogol, penal |
| `cards` | partido, jugador, tipo (amarilla/roja), minuto |
| `officials` (árbitros) | nombre, nacionalidad, ciudad, partidos dirigidos, tarjetas por partido |
| `venues` (estadios) | nombre, ciudad, capacidad, equipo, año de apertura |
| Vista `standings` | tabla de posiciones calculada (PJ/PG/PE/PP, goles, diferencia, puntos) a partir de `matches` |

**Importante:** este esquema está escrito en sintaxis SQLite y **no debe copiarse tal cual** a SQL
Server (tipos, `AUTOINCREMENT`, vistas, etc. difieren). Se documenta aquí solo como insumo de diseño
para la fase de arquitectura — **no se ha creado ninguna tabla todavía**, conforme a la instrucción de
no desarrollar en esta etapa.

### Datos históricos reales disponibles para migrar

| Archivo | Tamaño | Tipo (header) | Contenido |
|---|---|---|---|
| COPA ASUNCION.div / .bak | 67.9 KB / 369 KB | HDF / HDM | Liga actual, 13 equipos |
| **PARAGUAY PRIMERA.div / .bak** | 14.47 MB / 22 MB | HDP / HDM | ⭐ Más crítico — histórico multi-década (afirmado 1964–2024, no verificado en detalle) |
| TORNEO DE PARAGUARI.div | 91.3 KB | HDO | Torneo especial |
| TORNEO FEMENINO.div | 38.2 KB | HDF | Liga femenina |
| TORNEO REPUBLICA.div / .bak | 371.7 KB / 1.3 MB | HDF / HDM | Torneo |
| englge22021.div | 239.2 KB | HDP | English League 2021 |

Los 9 archivos existen realmente en `C:\Users\PC-HORIZONTE\Documents\LTRACK\` (verificado). El método
de recuperación recomendado por el análisis previo — y el más razonable dado que **Ltrack32.exe
funciona en esta misma máquina** — es exportar cada archivo a CSV usando el propio Ltrack (Export →
CSV), no un parser binario propio. Esto queda para la fase de migración, no ahora.

---

## 5. Reglas de negocio identificadas

| Regla | Detalle |
|---|---|
| Puntuación | Victoria = 3 pts, empate = 1 pt (c/u), derrota = 0 (configurable por competición) |
| Desempate | Orden: 1) puntos, 2) diferencia de goles, 3) goles a favor, 4) head-to-head (si aplica) |
| Promoción/relegación | Cantidad de equipos configurable por competición (automática y por playoffs) |
| Clasificación a copas | Cantidad de equipos configurable |
| Duración de partido | Configurable (default 45 min x 2 tiempos) |
| Recalculo de tabla | Automático al modificar cualquier resultado |
| Integridad | Validación de duplicados al importar/ingresar datos |

Estas reglas están documentadas de forma consistente en todo el material de Ltrack y no presentan
contradicciones internas — se consideran **suficientemente definidas** para avanzar, salvo que el
texto de requisitos de LeagueCore indique cambios.

---

## 6. Funcionalidades heredadas de Ltrack (candidatas a conservar)

Propuesta de "núcleo funcional" a replicar en LeagueCore, por ser el corazón del sistema y no
presentar ambigüedad de diseño:

1. Gestión de competiciones con reglas de puntuación configurables.
2. CRUD de equipos, jugadores, árbitros, estadios.
3. Ingreso de resultados con goles, tarjetas, penales, sustituciones.
4. Tabla de posiciones automática con desempates configurables.
5. Estadísticas de equipo/jugador/árbitro y top goleadores.
6. Import/export CSV (mínimo — HTML/portapapeles a evaluar).
7. Migración de los datos históricos reales (9 archivos, especialmente Paraguay Primera).

Esto es una **propuesta**, no una decisión — debe confirmarse contra el texto de requisitos aún
pendiente.

---

## 7. Funcionalidades nuevas de LeagueCore

**Sigo sin poder completar esta sección con certeza total** (ver §0.1) — falta el texto general de
requisitos funcionales. Pero el requisito arquitectónico recibido después (ver §8) sí **confirma**
(ya no son inferencia mía) dos puntos que antes estaban marcados como propuesta:

- ✅ **Confirmado:** UI web responsiva (desktop/tablet/móvil) diseñada así desde el inicio, no
  adaptada después — reemplaza la interfaz de escritorio Delphi + 7 temas VCL no recuperables.
- ✅ **Confirmado:** arquitectura API-first (backend/API + clientes, no "página + base de datos"),
  pensada para que un futuro cliente (app móvil u otro) reutilice la misma lógica de negocio sin
  reescritura.

Lo que sigue siendo inferencia propia, no confirmada:

- Base de datos relacional estándar (SQL Server) con backups/migraciones versionadas, en lugar de un
  formato binario propietario `.div` no estandarizado — se desprende de una decisión ya tomada, pero
  el usuario no lo enunció como "mejora" explícita.
- Autenticación multi-usuario con roles — el requisito de multi-**cliente** (web + app) no implica por
  sí solo múltiples **usuarios** humanos; sigue abierto (ver §12).

Todo lo demás (qué se agrega, qué se descarta, qué cambia de comportamiento funcional heredado de
Ltrack) depende del texto general de requisitos que aún falta.

---

## 8. Arquitectura técnica propuesta

### 8.0 Lo que ya está definido (instrucciones directas, no propuestas)

- Motor de base de datos: **Microsoft SQL Server**, instancia local `localhost:1433`, base
  `LeagueCore`, usuario `sa` (credenciales sólo para desarrollo, vía variables de entorno, nunca
  hardcodeadas; `.env.example` sin credenciales reales en el repo).
- Raíz única del proyecto: `C:\Users\PC-HORIZONTE\Documents\GitHub\LeagueCore`.
- Uso exclusivo de la base `LeagueCore` — nunca tocar otras bases del servidor SQL Server local.
- **LeagueCore se piensa como Backend/API + clientes**, no como "página web + base de datos". El
  frontend web (V1) es el primer cliente; una futura app debe poder consumir la misma API sin
  reescribir lógica de negocio.
- El frontend **no debe** contener lógica de negocio crítica (cálculos de tabla, validaciones
  importantes, permisos): eso vive en el backend/API.

### 8.1 Capas obligatorias (para que la evolución a V2 no requiera reconstrucción)

```
V1: LeagueCore Web  →  LeagueCore API  →  SQL Server
V2: LeagueCore Web ┐
    LeagueCore App ┴→  LeagueCore API  →  SQL Server   (misma API, mismo backend)
```

Para que este salto sea real y no obligue a reescribir el backend, quedan como **reglas vinculantes
del proyecto** desde el primer commit:

1. **API 100% JSON, sin vistas renderizadas en el servidor.** Nada de HTML generado por el backend
   (descarta, por ejemplo, Razor Pages, plantillas server-side, Blazor Server). El backend sólo
   expone endpoints REST (o GraphQL) que devuelven datos — el frontend web es una SPA que los
   consume, igual que lo hará mañana una app nativa.
2. **Autenticación basada en token, no en sesión de navegador atada exclusivamente a cookies web.**
   Un esquema tipo JWT permite que web, futura app móvil y futura app de escritorio compartan el
   mismo mecanismo de login contra la misma API.
3. **Toda regla de negocio y cálculo vive en el backend**: tabla de posiciones, desempates,
   validaciones de resultados, permisos. El frontend puede duplicar un cálculo sólo como
   optimización visual (ej. previsualizar un cambio antes de guardar), nunca como fuente de verdad.
4. **Versionado de API desde el primer endpoint** (ej. `/api/v1/...`), para poder evolucionar sin
   romper clientes ya desplegados cuando exista más de uno.
5. **CORS configurado explícitamente** desde el inicio.
6. **Backend y frontend como proyectos/despliegues separados** dentro del repo (no un framework
   full-stack que fusione ambos en un solo proceso), para que sumar un cliente nuevo sea agregar un
   proyecto que hable con la misma API, no tocar el backend.

### 8.2 Veredicto: ¿la arquitectura permite esta evolución sin reconstrucción?

**Sí**, siempre que se respeten las 6 reglas de 8.1 desde el primer commit. Una API REST/JSON con SQL
Server detrás, consumida por una SPA, es exactamente el patrón que permite sumar después un segundo
cliente (app móvil o de escritorio) sin tocar el backend — sólo se agrega un cliente nuevo que llama a
los mismos endpoints. El riesgo real no es de arquitectura general sino de **disciplina de
desarrollo**: si en el camino se cuela lógica de negocio en el frontend "porque es más rápido", ahí sí
se rompe la premisa y habría que duplicar trabajo al construir la app futura. Por eso las reglas de
8.1 quedan documentadas como principios del proyecto (para guiar también el trabajo de Codex), no como
sugerencia opcional.

### 8.3 Lo que cambia respecto al análisis previo de Ltrack (y por qué)

El documento madre de Ltrack "aprobaba" **SQLite local + Google Drive** como arquitectura
offline-first (sincronización cada 5 min, multi-dispositivo vía nube). Esa decisión queda sin efecto:
un SQL Server centralizado con host/puerto, sumado a este nuevo requisito de "API + múltiples
clientes", confirma el modelo **cliente-servidor tradicional** (no un archivo embebido por
dispositivo). El diseño de `SyncService` con Google Drive del análisis original ya no aplica tal como
estaba pensado.

Lo que **sigue sin confirmarse**: si además del acceso multi-**cliente** (web + futura app) habrá
múltiples **usuarios humanos** con roles distintos (admin, cargador de resultados, sólo lectura), o
un único usuario administrador accediendo desde varios dispositivos. Esto no cambia las capas de 8.1
(aplican igual en ambos casos) pero sí el diseño del módulo de autenticación y permisos — ver §12.

### 8.4 Propuesta de stack (a confirmar)

El usuario pidió explícitamente no asumir tecnología sólo porque aparecía en el análisis de Ltrack,
sino justificarla contra los requisitos reales. Con el requisito de API-first + multi-cliente ya
conocido, la justificación queda así:

**Frontend (propuesto, no decidido):** React 18 + Vite + TypeScript + Tailwind CSS. Justificación:
Tailwind resuelve bien el enfoque *mobile-first* pedido en §6 (utilidades de breakpoint por diseño,
sin "adaptar" después); Vite da un dev server rápido; TypeScript permite compartir contratos de datos
con el backend si éste también es TypeScript, reduciendo bugs de integración.

**Backend — dos alternativas razonables, ninguna descartable a priori:**

| Opción | A favor | En contra |
|---|---|---|
| **Node.js + TypeScript (NestJS o Express)** | Mismo lenguaje que el frontend (se pueden compartir tipos/DTOs); NestJS da estructura de módulos/controladores/servicios que encaja naturalmente con las reglas de 8.1; Swagger/OpenAPI de fábrica facilita que un futuro cliente móvil sepa qué consumir; buen soporte de SQL Server vía `mssql`/`tedious`, TypeORM o Prisma | Prisma/TypeORM en SQL Server son sólidos pero algo menos pulidos que en Postgres/MySQL |
| **.NET / ASP.NET Core Web API (C#)** | Integración nativa con SQL Server (mismo fabricante); Entity Framework Core con migraciones muy maduras; ASP.NET Identity resuelve auth/roles "de fábrica"; Swagger integrado | Lenguaje distinto al frontend (más context-switching); sin evidencia en el material de preferencia o experiencia previa del usuario con .NET |

**Recomendación (mía, pendiente de tu confirmación):** Node.js + TypeScript con **NestJS**. Motivo
principal: consistencia de lenguaje de punta a punta, estructura por módulos que hace casi automático
cumplir "una sola lógica de negocio, muchos clientes", y buen soporte de SQL Server. .NET es una
alternativa igual de válida técnicamente — si tenés preferencia o experiencia previa con C#/.NET,
decílo y ajusto la recomendación.

**Migraciones de esquema:** herramienta versionada desde el inicio (Prisma Migrate o TypeORM
migrations si Node; EF Core Migrations si .NET) — no scripts SQL sueltos.

### 8.5 Responsive (desde el diseño, no como adaptación posterior)

Principio de diseño para la Fase 4 (frontend), no para implementar ahora: cada módulo (tabla de
posiciones, carga de resultados, estadísticas) debe diseñarse pensando en 3 quiebres (desktop /
tablet / móvil) desde el primer boceto, con Tailwind como herramienta natural (`sm:`/`md:`/`lg:` en
vez de hojas de estilo separadas por dispositivo). Implicancia concreta: las tablas anchas
(posiciones, estadísticas) necesitan una estrategia de móvil (scroll horizontal contenido, o
colapsar a tarjetas) definida *de antemano*, no como parche posterior.

### 8.6 Evaluación PWA (sin implementar todavía)

Conviene dejar la puerta abierta desde la arquitectura, con costo bajo:

- Vite tiene soporte maduro para PWA vía `vite-plugin-pwa` (manifest + service worker con poca
  configuración) — no hace falta otro framework para dejarlo preparado.
- Se puede reservar la estructura (manifest, íconos en varios tamaños, estrategia de caché) sin
  activar el service worker todavía, evitando complejidad de caché/actualización antes de tiempo.
- Una PWA instalable podría cubrir buena parte de la necesidad de "app" sin llegar a una app nativa,
  dependiendo de qué funciones de dispositivo (push, cámara, offline real) termine necesitando la
  futura app — **conviene decidirlo cuando existan más detalles de esa futura app**, no ahora.
- Decisión para esta etapa: **no implementar PWA todavía**, sólo evitar en la Fase 4 decisiones que la
  bloqueen a futuro (ej. lógica que asuma que el navegador está siempre online).

---

## 9. Recomendación para SQL Server

- **Collation:** los datos reales contienen caracteres especiales del español (ej. "CERRO PORTEÑO"
  con Ñ, nombres con tildes). Se recomienda una collation compatible, por ejemplo
  `Modern_Spanish_CI_AS` o `Latin1_General_CI_AS`, a definir en la fase de creación de la base — no
  se ha creado todavía.
- **Idioma de nombres de tablas/columnas:** el esquema heredado del análisis de Ltrack está en
  inglés (`teams`, `matches`, `goals`...). Debe decidirse si LeagueCore mantiene inglés o pasa a
  español — no está definido por ningún documento.
- **Alcance de credenciales `sa`/`123456`:** uso exclusivo para crear/modificar/consultar la base
  `LeagueCore` únicamente, tal como indicó el usuario. Se respetará estrictamente esta restricción en
  cualquier script o migración futura.
- **Nunca ejecutar comandos destructivos sobre otras bases** del servidor local — se toma como regla
  operativa permanente para este proyecto.

---

## 10. Riesgos técnicos

| Riesgo | Severidad | Detalle |
|---|---|---|
| Contenido interno comprimido de `.div` sin decodificar | 🟡 Medio | Sólo se extrajeron *strings* sueltos por búsqueda de texto; no hay parser estructurado. Mitigación ya validada: exportar con el propio Ltrack (instalado y funcional en esta máquina) a CSV, no reverse-engineering. |
| Algoritmo de predicción de resultados desconocido | 🟠 Alto (si se quiere replicar fielmente) | Mencionado en el README oficial, lógica cerrada. Omitible en v1, o rehacer con lógica propia simple. |
| APIs de actualización web (ligas inglesas) | 🟢 Bajo | Casi seguro extintas (~10+ años). Omitible. |
| Afirmación "60 años de histórico" en Paraguay Primera | 🟡 Medio | No verificado end-to-end, sólo *strings* encontrados en el binario. Se confirmará recién al exportar/migrar. |
| Documentos de referencia faltantes en `/Archivos` | 🟡 Medio | No se puede verificar todo lo citado indirectamente (ver §0.3). |
| Inconsistencia del análisis previo (SQLite vs PostgreSQL vs ahora SQL Server) | 🟢 Bajo (ya resuelto por instrucción directa) | Ilustra que ninguna "decisión aprobada" de esos documentos debe darse por firme sin revisar. |
| Falta el texto de requisitos de LeagueCore | 🔴 Alto (bloqueante para decisiones de alcance) | Ver §0.1 — sin esto no se puede cerrar el alcance funcional real. |
| Filtración de lógica de negocio al frontend | 🟡 Medio | Rompe el principio de §8.1 (una sola lógica, múltiples clientes); se previene con revisión de código enfocada en que cálculos/validaciones vivan sólo en el backend. |

---

## 11. Información faltante

1. **El texto de requisitos funcionales específico de LeagueCore** (qué se agrega/descarta de Ltrack,
   alcance) — prometido, aún no recibido. Sigue siendo el insumo más importante pendiente.
2. ~~¿Uso único/local o en red?~~ **Parcialmente resuelto:** §8 confirma que será una web accesible en
   red, preparada para múltiples clientes (web + futura app). Lo que sigue abierto es si habrá
   **múltiples usuarios humanos con roles** (admin, editor, sólo lectura) o un único usuario
   administrador — ver §12.
3. Confirmación de la **recomendación de backend** (Node.js/TypeScript + NestJS, propuesta en §8.4) o
   preferencia por .NET/otro.
4. ¿Se conserva algún esquema de **respaldo/sincronización en la nube** (Google Drive u otro), o se
   descarta por completo al centralizar en SQL Server?
5. ¿LeagueCore se mantiene enfocado en **fútbol**, o debe generalizarse a otros deportes/formatos de
   competición (el nombre "LeagueCore" es más genérico que "Ltrack")?
6. ¿Qué se hace con la **predicción de resultados** (lógica original desconocida) y la
   **actualización automática vía Internet**? ¿Se omiten, se rehacen, o quedan para una v2?
7. **Idioma** de nombres de tablas/columnas/UI: ¿español o inglés?
8. Confirmación de que el **núcleo funcional propuesto en §6** es efectivamente lo que se quiere
   conservar de Ltrack.
9. Alcance real de la futura **app** (móvil nativa, PWA instalable, o app de escritorio) — condiciona
   si conviene invertir en soporte PWA (§8.6) o planificar directamente una app nativa más adelante.

---

## 12. Preguntas que necesito resolver antes de comenzar

1. ¿Podés compartir el **texto general con los requisitos funcionales específicos de LeagueCore**
   (qué se agrega, qué se descarta de Ltrack, alcance)? Sigue siendo el insumo que más impacta el
   resto de las decisiones.
2. Dentro del sistema web multi-cliente ya confirmado (§8): ¿va a haber **varios usuarios humanos con
   roles distintos** (admin, cargador de resultados, sólo lectura), o un único usuario administrador
   accediendo desde distintos dispositivos?
3. ¿Confirmás la recomendación de backend — **Node.js/TypeScript + NestJS** (§8.4) — o preferís
   .NET/otra tecnología?
4. ¿Se mantiene el alcance a **fútbol paraguayo/inglés** como en los datos actuales, o se amplía a
   otros deportes/formatos?
5. ¿Qué hacemos con **predicción de resultados** y **sync web** (features de Ltrack con lógica
   desconocida/obsoleta)? ¿Se descartan, se rehacen, o se posponen?
6. ¿Preferís nombres de tablas/campos en **español o inglés**?
7. Sobre la futura "app" (§8): ¿ya tenés en mente si será **app móvil nativa, PWA instalable, o app de
   escritorio**? No hace falta decidirlo ahora, pero ayuda a priorizar si conviene invertir en soporte
   PWA más adelante.

---

## 13. Propuesta de fases de desarrollo (ajustada — aún no autorizada)

| Fase | Objetivo | Depende de |
|---|---|---|
| **Fase 0** | Cerrar requisitos: recibir texto de LeagueCore, resolver preguntas de §12, aprobar este informe | Usuario |
| **Fase 1** | Diseño de datos: esquema T-SQL para SQL Server adaptado del modelo heredado (§4) + reglas de negocio confirmadas | Fase 0 |
| **Fase 2** | Migración de datos históricos: exportar los 9 `.div`/`.bak` reales con Ltrack32.exe → CSV → carga a `LeagueCore` (SQL Server) con validación de integridad | Fase 1 |
| **Fase 3** | Backend / API sobre SQL Server | Fase 1-2 |
| **Fase 4** | Frontend (React u otro, según se confirme) | Fase 3 |
| **Fase 5** | Testing, documentación, puesta en uso | Fase 4 |

No se han estimado tiempos todavía porque dependen del alcance real (aún no definido).

**Nota (actualizada tras §8):** Fase 3 y Fase 4 deben quedar como proyectos/despliegues separados
dentro del repo (regla 6 de §8.1: backend y frontend desacoplados), y Fase 4 debe aplicar el enfoque
responsive de §8.5 desde el primer componente, no como ajuste al final.

---

## 14. Estructura inicial recomendada del repositorio

Propuesta únicamente — no creada:

```
LeagueCore/
├─ Archivos/              # material fuente (ya existe, no tocar)
├─ docs/                  # documentación del proyecto (este informe, futuras specs)
├─ src/
│  ├─ backend/            # API (stack a confirmar)
│  └─ frontend/           # UI (React propuesto)
├─ database/
│  ├─ migrations/         # migraciones versionadas del esquema SQL Server
│  └─ seed/                # datos de referencia / migración histórica
├─ scripts/                # scripts de migración .div → CSV → SQL Server
├─ .env.example            # variables de entorno documentadas, sin credenciales reales
├─ .gitignore               # incluye .env, credenciales, node_modules, etc.
└─ README.md
```

---

## Cierre

Este informe cubre lo que el material disponible permite responder con confianza (funcionalidad,
módulos, reglas de negocio y arquitectura de datos de Ltrack, verificados donde fue posible contra los
archivos reales de esta máquina), más el requisito arquitectónico de "web-first + preparación para
futura app" ya incorporado (§8): se concluyó que una API REST/JSON + SQL Server, consumida por una SPA
desacoplada, **sí permite** sumar después un cliente móvil sin reconstruir el backend, siempre que se
respeten las reglas vinculantes de §8.1.

Lo que falta para avanzar a desarrollo, en orden de impacto:

1. El **texto de requisitos funcionales específico de LeagueCore** (§0.1, §12.1) — sigue siendo lo más
   importante y aún no se recibió.
2. Respuestas a las preguntas de §12.2–§12.7 (usuarios/roles, backend, alcance, features heredadas de
   lógica desconocida, idioma, futura app).

No se iniciará desarrollo hasta recibir ese texto y las definiciones pendientes.
