# Herramientas de desarrollo — QUITAR ANTES DE RELEASE

Este documento lista las funcionalidades **solo para desarrollo** agregadas para las pruebas.
Deben eliminarse (o quedar deshabilitadas) antes de publicar el sistema.

> Las piezas del panel de credenciales están marcadas en el código con el comentario
> `// DEV-ONLY: quitar antes de release`. Buscá ese texto en el repo para encontrarlas todas rápido.

## 1. Panel oculto de credenciales de prueba (login)

Muestra una lista de credenciales de prueba en la pantalla de login.

**Cómo mostrarlo y ocultarlo (en desarrollo):**
- Teclado: **`Ctrl + L + 9`** — alterna: la primera vez lo muestra, la segunda lo oculta. Se puede pulsar
  con L y 9 a la vez, o L y luego 9 sin soltar Ctrl (ventana de 1,5 s). Ctrl+L y Ctrl+9 normalmente son
  "ir a la barra de direcciones" y "última pestaña" del navegador; en el login se cancela esa acción.
- Teclado: `Ctrl + Alt + K` (alterna) · `Esc` (cierra).
- Toque/clic: 3 clics rápidos en la esquina inferior derecha de la pantalla de login.
- "Usar" autocompleta usuario y contraseña; "Copiar" copia `usuario / contraseña`.

**Barreras que impiden que llegue a producción o a terceros (ya activas):**
- Frontend: se renderiza solo si `import.meta.env.DEV`; en `vite build` la rama se elimina por tree-shaking.
- Backend: `DevModule` solo se importa si `NODE_ENV !== 'production'`, y el endpoint responde 404 en producción.
- Backend: **solo responde a accesos locales.** El túnel de Cloudflare arranca junto con la aplicación
  (ver §2), así que cualquiera con la URL pública llegaría a `/api/v1/dev/test-credentials`. Una petición
  que pasó por el túnel o por un proxy (cabeceras `cf-connecting-ip`, `cf-ray`, `x-forwarded-for`, etc.) o
  que no viene de loopback recibe 404. Solo se abre a propósito con `DEV_CREDENTIALS_REMOTE=true` en
  `src/backend/.env` (ver `.env.example`). Tests: `src/backend/src/dev/dev.controller.spec.ts`.

**Para eliminarlo definitivamente:**

Backend:
- Borrar la carpeta `src/backend/src/dev/` (`dev.controller.ts`, `dev.controller.spec.ts`, `dev.module.ts`,
  `test-credentials.fixtures.ts`).
- En `src/backend/src/app.module.ts`: quitar el `import { DevModule }` y la línea
  `...(process.env.NODE_ENV === 'production' ? [] : [DevModule]),`.
- Quitar `DEV_CREDENTIALS_REMOTE` de `.env.example`.

Frontend:
- Borrar `src/frontend/src/components/DevCredentialsPanel.tsx` y `DevCredentialsPanel.test.tsx`.
- En `src/frontend/src/pages/LoginPage.tsx`: quitar el `import DevCredentialsPanel` y el bloque
  `{import.meta.env.DEV && (<DevCredentialsPanel ... />)}` (y volver a devolver solo `<LoginVisual .../>`).

**Editar la lista de credenciales:** `src/backend/src/dev/test-credentials.fixtures.ts`.
Son cuentas de prueba que vos definís; nunca poner credenciales reales de producción.

## 2. Acceso remoto por túnel de Cloudflare (arranca junto con la aplicación)

`start.bat` levanta **API + Web + túnel** con un solo paso, todo oculto (`scripts/start-all.ps1`):

- **Idempotente:** si la API (4001), la Web (5173) o el túnel ya corren y son de LeagueCore, se reutilizan; no se
  lanzan duplicados. Si un puerto lo ocupa otro programa, avisa y no lo toca. Un mutex evita dos arranques a la vez.
- **Portátil:** todo se resuelve desde la ubicación del repo; no hay rutas fijas. Primera vez en un equipo:
  instala dependencias (`npm install`) y crea `src/backend/.env` desde `.env.example` si falta.
- **La Web usa la API por ruta relativa** (`VITE_API_URL=/api/v1`, mismo origen). `src/frontend/vite.config.ts`
  (`server.proxy` para `/api` y `/uploads`, y `server.allowedHosts` con `.trycloudflare.com`) reenvía al
  backend local. Sirve igual por `localhost` y por el túnel.
- **`cloudflared --protocol http2`:** muchas redes bloquean el UDP saliente (QUIC, puerto 7844) y en modo
  `auto` el túnel nunca se conecta. El lanzador da el túnel por listo solo cuando el conector se registra
  (`Registered tunnel connection`), no cuando aparece la URL.
- La URL pública (`https://XXXX.trycloudflare.com`, cambia en cada inicio) se muestra en un aviso, se copia al
  portapapeles y queda en `logs/tunnel-url.txt`. Si falta cloudflared o el túnel falla, la app sigue en local.
- **`start-local.bat`** arranca sin túnel (nadie entra desde afuera).
- **`stop.bat`** apaga API, Web y túnel deteniendo el árbol de procesos **propios** (por ruta del repo / destino del
  túnel, más los PIDs de `logs/stack.json`). No toca procesos de otros programas.

**Consideración de seguridad:** mientras el túnel esté abierto, cualquiera con la URL puede llegar al login.
El acceso a datos sigue exigiendo usuario y contraseña, **pero el usuario `admin` sembrado por
`scripts/seed-admin.js` usa la contraseña conocida `123456`** (la misma que muestra el panel del §1) y, si su
marca `password_temp_reset` está en 0, el sistema no obliga a cambiarla. Con el túnel abierto eso equivale a dejar
la puerta de administrador con una clave adivinable: **cambiá la contraseña de `admin` (o creá otro administrador y
desactivá ese) antes de compartir el enlace remoto.** Usá `LeagueCore (solo local)` o `stop.bat` cuando no
necesites el acceso remoto. Para producción real conviene un
despliegue con dominio propio y HTTPS gestionado, no `trycloudflare`.

**Archivos:** `start.bat`, `start-local.bat`, `stop.bat`, `enlace-remoto.bat`, `Instalar accesos directos.bat`,
`scripts/start-hidden.vbs`, `scripts/start-all.ps1`, `scripts/stop.ps1`, `scripts/mostrar-enlace.ps1`,
`scripts/process-ownership.ps1`, `scripts/crear-acceso-directo.ps1`.

## 3. Accesos directos (uno por equipo)

Los `.lnk` guardan rutas absolutas, por eso **no se versionan** (`*.lnk` está en `.gitignore`): un acceso creado
en la PC de otra persona apunta a una carpeta que no existe en la tuya. En cada equipo, una vez, hacer doble clic
en **`Instalar accesos directos.bat`**. Verifica requisitos (Node, `.env` del backend, cloudflared —ofrece
instalarlo con winget—) y crea en el Escritorio, apuntando a donde esté clonado el repo:

- `LeagueCore` → `start.bat` (API + Web + túnel)
- `LeagueCore (solo local)` → `start-local.bat`
- `LeagueCore (detener)` → `stop.bat`
- `LeagueCore (enlace remoto)` → `enlace-remoto.bat` (vuelve a mostrar y copiar la URL del túnel)

No afectan al build; se pueden borrar del Escritorio en cualquier momento. Instructivo para usuarios:
`LEER - Accesos directos.txt` (raíz del repo).
