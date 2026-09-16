# Seguridad y variables

Conservar cambios existentes. Detener solo procesos identificados como propios.

Los archivos .env reales se conservan fuera del contexto y deben estar ignorados por Git. Los ejemplos no prueban que una variable sea obligatoria; se mantiene NO DETERMINADO hasta revisar su validación en código.

| NOMBRE_VARIABLE | PROPÓSITO | EJEMPLO_SEGURO | REQUERIDA | FUENTES |
|---|---|---|---|---|
| DB_HOST | Configuración específica; consultar el consumidor y las fuentes indicadas | NO DETERMINADO | NO DETERMINADO; verificar modo de ejecución | src/backend/.env.example |
| DB_NAME | Configuración específica; consultar el consumidor y las fuentes indicadas | NO DETERMINADO | NO DETERMINADO; verificar modo de ejecución | src/backend/.env.example |
| DB_PASSWORD | Configuración específica; consultar el consumidor y las fuentes indicadas | REEMPLAZAR_LOCALMENTE | NO DETERMINADO; verificar modo de ejecución | src/backend/.env.example |
| DB_PORT | Configuración específica; consultar el consumidor y las fuentes indicadas | NO DETERMINADO | NO DETERMINADO; verificar modo de ejecución | src/backend/.env.example |
| DB_USER | Configuración específica; consultar el consumidor y las fuentes indicadas | NO DETERMINADO | NO DETERMINADO; verificar modo de ejecución | src/backend/.env.example |
| FRONTEND_ORIGIN | Configuración específica; consultar el consumidor y las fuentes indicadas | NO DETERMINADO | NO DETERMINADO; verificar modo de ejecución | src/backend/.env.example |
| JWT_EXPIRES_IN | Configuración específica; consultar el consumidor y las fuentes indicadas | NO DETERMINADO | NO DETERMINADO; verificar modo de ejecución | src/backend/.env.example |
| JWT_SECRET | Firma de tokens | REEMPLAZAR_LOCALMENTE | NO DETERMINADO; verificar modo de ejecución | src/backend/.env.example |
| PORT | Puerto de escucha | NO DETERMINADO | NO DETERMINADO; verificar modo de ejecución | src/backend/.env.example |
| VITE_API_URL | URL pública de API incorporada al frontend | NO DETERMINADO | NO DETERMINADO; verificar modo de ejecución | src/frontend/.env.example |

No ejecutar proveedores, pagos, mensajería ni migraciones reales durante una validación documental.
