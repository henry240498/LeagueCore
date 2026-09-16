# Testing — LeagueCore

[Comandos declarados](ejecucion.md). La presencia de pruebas no acredita una ejecución reciente.

Separar unitarias de integración/E2E. Estas últimas requieren una DB de prueba expresamente identificada, migraciones controladas y datos de fixture; no reutilizar una DB compartida por defecto.

## Suites localizadas
- [src/backend/src/auth/auth.service.spec.ts](<../src/backend/src/auth/auth.service.spec.ts>)
- [src/backend/src/auth/password-policy.spec.ts](<../src/backend/src/auth/password-policy.spec.ts>)
- [src/backend/src/auth/sessions.spec.ts](<../src/backend/src/auth/sessions.spec.ts>)
- [src/backend/src/clubs/clubs.service.spec.ts](<../src/backend/src/clubs/clubs.service.spec.ts>)

Registrar comando, fecha, revisión y resultado real; consultar proyecto.json y el informe del cambio.
