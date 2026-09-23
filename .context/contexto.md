# LeagueCore — contexto

Fecha de revisión estructural: 2026-09-14. Identificador: leaguecore.

## Producto y alcance
Aplicación deportiva en desarrollo con cambios locales.

Tecnología y persistencia: NestJS 10, React/Vite; SQL Server

Dependencias y servidor: Node y SQL Server.

## Lectura obligatoria
1. [Contexto general de Vaults](<../../Vaults/jmartinez/Ecosistema/contexto.md>) y [reglas generales](<../../Vaults/jmartinez/Ecosistema/reglas.md>).
2. [Reglas particulares](reglas.md) y [ejecución y validación](ejecucion.md).
3. Documentación y decisiones del componente que vaya a cambiar.

## Límites
Conservar cambios existentes. Detener solo procesos identificados como propios.

## Fuentes técnicas
- [src/backend/package.json](<../src/backend/package.json>)
- [src/frontend/package.json](<../src/frontend/package.json>)

## Documentación conservada
- [Archivos/LTRACK_CHECKLIST_AUTORIZACION.md](<../Archivos/LTRACK_CHECKLIST_AUTORIZACION.md>)
- [Archivos/LTRACK_DESCUBRIMIENTOS_ARCHIVOS_REALES.md](<../Archivos/LTRACK_DESCUBRIMIENTOS_ARCHIVOS_REALES.md>)
- [Archivos/LTRACK_DOCUMENTO_TRANSFERENCIA_COMPLETO.md](<../Archivos/LTRACK_DOCUMENTO_TRANSFERENCIA_COMPLETO.md>)
- [Archivos/LTRACK_ESPECIFICACION_FORMATO_DIV.md](<../Archivos/LTRACK_ESPECIFICACION_FORMATO_DIV.md>)
- [database/migrations/README.md](<../database/migrations/README.md>)
- [docs/ANALISIS_INICIAL_LEAGUECORE.md](<../docs/ANALISIS_INICIAL_LEAGUECORE.md>)
- [docs/ANALISIS_REGISTRO_FUTBOL_VS_LEAGUECORE.md](<../docs/ANALISIS_REGISTRO_FUTBOL_VS_LEAGUECORE.md>)
- [src/frontend/README.md](<../src/frontend/README.md>)

## Estado verificable
La metadata está en [proyecto.json](proyecto.json). STATUS y último despliegue permanecen NO DETERMINADO hasta contar con evidencia. Una revisión documental no valida el funcionamiento de la aplicación.
[Seguimiento de correcciones y dependencias externas](<../../Vaults/jmartinez/Ecosistema/seguimiento.md>).

No copiar versiones, estado de Git o resultados históricos como si fueran hechos permanentes. Al cambiar una fuente técnica, revisar el contexto y actualizar su hash solo después de comprobar coherencia.

<!-- BEGIN ECOSYSTEM DETAILS -->
## Documentos por tarea

- [arquitectura.md](<arquitectura.md>)
- [testing.md](<testing.md>)
- [base-datos.md](<base-datos.md>)
- [seguridad.md](<seguridad.md>)

## Funcionalidades documentadas
- [match-center-plan.md](<match-center-plan.md>) — Reinvención de la vista de partido (Match Center). **Estado: CERRADO** (fases 0–16 + QA final). Auditoría, mapa de endpoints y datos faltantes reales.
- [match-center-continuar-aqui.md](<match-center-continuar-aqui.md>) — Handoff del Match Center (contexto autosuficiente para retomarlo).
- [planilla-jugador.md](<planilla-jugador.md>) — Trayectoria e historial del jugador: de dónde sale cada dato y qué falta (cargar `match_player_stats`).
- [cancha-visual.md](<cancha-visual.md>) — Convenciones de la cancha SVG, aparición animada y marca de agua. **Leer antes de tocar `components/pitch/`** (hay una trampa que rompe el arrastre).
- [deuda-tecnica.md](<deuda-tecnica.md>) — Deuda técnica: resuelto, auditado y descartado, y pendiente.
<!-- END ECOSYSTEM DETAILS -->
