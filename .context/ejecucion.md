# Ejecución y validación

## Requisitos y límites
Node y SQL Server.

Conservar cambios existentes. Detener solo procesos identificados como propios.

## Comandos declarados
Ejecutar desde el directorio indicado, después de revisar sus efectos. Esta tabla acredita que existe el script, no que haya pasado recientemente.
Los comandos de prueba pueden escribir archivos o datos. Builds móviles requieren SDK/firma y Maven puede ejecutar pruebas de integración.

| Fuente | Directorio relativo a la raíz | Script o propósito | Comando |
|---|---|---|---|
| [src/backend/package.json](<../src/backend/package.json>) | src/backend | build | npm run build |
| [src/backend/package.json](<../src/backend/package.json>) | src/backend | start | npm run start |
| [src/backend/package.json](<../src/backend/package.json>) | src/backend | start:dev | npm run start:dev |
| [src/backend/package.json](<../src/backend/package.json>) | src/backend | test | npm test |
| [src/frontend/package.json](<../src/frontend/package.json>) | src/frontend | dev | npm run dev |
| [src/frontend/package.json](<../src/frontend/package.json>) | src/frontend | build | npm run build |
| [src/frontend/package.json](<../src/frontend/package.json>) | src/frontend | lint | npm run lint |
| [src/frontend/package.json](<../src/frontend/package.json>) | src/frontend | test | npm test |

## Configuración y despliegue encontrados
- NO DETERMINADO.

Despliegue efectivo: NO DETERMINADO. No ejecutar Compose, migraciones o arranque contra datos compartidos por inferencia.

## Puertos
Consultar [registro global](<../../Vaults/jmartinez/Infraestructura/Puertos/registro.json>) antes de iniciar varias aplicaciones. Se conservan los puertos actuales; si un proceso ajeno ocupa uno, informar y no detenerlo.

## Cierre de un cambio
Registrar comando, entorno, revisión, fecha y resultado real en proyecto.json o en el informe de validación del cambio. Actualizar documentación afectada y revisar el diff. No confundir la existencia de CI con un resultado aprobado.
