# Herramientas de desarrollo — QUITAR ANTES DE RELEASE

Este documento lista las funcionalidades **solo para desarrollo** agregadas para las pruebas.
Deben eliminarse (o quedar deshabilitadas) antes de publicar el sistema.

> Todas las piezas están marcadas en el código con el comentario `// DEV-ONLY: quitar antes de release`.
> Buscá ese texto en el repo para encontrarlas todas rápido.

## 1. Panel oculto de credenciales de prueba (login)

Muestra una lista de credenciales de prueba en la pantalla de login.

**Cómo abrirlo (en desarrollo):**
- Teclado: `Ctrl + Alt + K`
- Toque/clic: 3 clics rápidos en la esquina inferior derecha de la pantalla de login.

**Barreras que impiden que llegue a producción (ya activas):**
- Frontend: se renderiza solo si `import.meta.env.DEV`; en `vite build` la rama se elimina por tree-shaking.
- Backend: `DevModule` solo se importa si `NODE_ENV !== 'production'`, y el endpoint responde 404 en producción.

**Para eliminarlo definitivamente:**

Backend:
- Borrar la carpeta `src/backend/src/dev/` (`dev.controller.ts`, `dev.module.ts`, `test-credentials.fixtures.ts`).
- En `src/backend/src/app.module.ts`: quitar el `import { DevModule }` y la línea
  `...(process.env.NODE_ENV === 'production' ? [] : [DevModule]),`.

Frontend:
- Borrar `src/frontend/src/components/DevCredentialsPanel.tsx`.
- En `src/frontend/src/pages/LoginPage.tsx`: quitar el `import DevCredentialsPanel` y el bloque
  `{import.meta.env.DEV && (<DevCredentialsPanel ... />)}` (y volver a devolver solo `<LoginVisual .../>`).

**Editar la lista de credenciales:** `src/backend/src/dev/test-credentials.fixtures.ts`.
Son cuentas de prueba que vos definís; nunca poner credenciales reales de producción.

## 2. Acceso remoto por túnel de Cloudflare

Permite acceder al proyecto desde afuera mediante una URL pública temporal.

**Archivos:**
- `start-remote.bat` (raíz) → `scripts/start-remote.ps1`: levanta API + Web y abre el túnel.
- `scripts/crear-acceso-directo.ps1`: crea accesos directos en el Escritorio.
- `src/frontend/vite.config.ts`: `server.proxy` (/api, /uploads) y `server.allowedHosts`
  (incluye `.trycloudflare.com`). El proxy es same-origin: sirve para el túnel y **no**
  afecta el uso local por defecto.

**Consideración de seguridad:** mientras el túnel esté abierto, cualquiera con la URL puede
llegar al login. No dejarlo abierto sin necesidad; para cerrarlo, cerrá la ventana del túnel
o `Ctrl+C`. Para producción real conviene un despliegue con dominio propio y HTTPS gestionado,
no `trycloudflare`. Las carpetas de scripts pueden conservarse, pero no dejar el túnel corriendo
de forma permanente ni combinarlo con el panel de credenciales.

## 3. Accesos directos

`scripts/crear-acceso-directo.ps1` genera en el Escritorio:
- `LeagueCore (Local)` → `start.bat`
- `LeagueCore (Remoto)` → `start-remote.bat`

No afectan al build; se pueden borrar del Escritorio en cualquier momento.
