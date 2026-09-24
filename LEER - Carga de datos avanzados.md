# LEER — Carga de datos avanzados (decisiones pendientes)

**Para:** Henry y el equipo · **Fecha:** 2026-09-24 · **Estado:** listo para usar, falta decidir cómo se carga

Hay cuatro conjuntos de datos que **el sistema ya sabe mostrar pero nunca se cargaron**. Hasta ahora
ni siquiera existía forma de cargarlos: las tablas estaban en la base, pero ninguna pantalla ni
proceso podía escribirlas, así que el xG, los mapas de calor, las estadísticas por jugador y los
datos físicos mostraban "sin datos" de forma permanente.

Eso ya está resuelto a nivel de software. **Lo que falta es una decisión de ustedes sobre de dónde
salen los datos y quién los carga.**

---

## 1) Qué quedó habilitado

| Dato | Dónde se carga | Qué habilita al cargarlo |
|---|---|---|
| **Estadísticas por jugador** (remates, pases, duelos, recuperaciones, intercepciones, despejes, bloqueos) | Partido → pestaña **Estadísticas (cargar)** → *Estadísticas por jugador* | Planilla del jugador y comparación de jugadores en el Match Center |
| **Métricas avanzadas** (xG, xA, PPDA, Field Tilt…) | Partido → **Estadísticas (cargar)** → *Importar datos avanzados* | Gráficos de xG y sección de métricas avanzadas |
| **Posiciones** (muestras x/y por minuto) | ídem, importación por lote | Mapas de calor y posición media |
| **Datos físicos** (GPS: distancia, velocidad, sprints) | ídem, importación por lote | Datos físicos del jugador |

Las estadísticas por jugador se cargan **a mano, de a un jugador**. Las otras tres van **por lote**
(pegar CSV o subir archivo), porque un partido con muestreo por minuto ronda las **2.000 filas** de
posiciones: a mano no es viable.

---

## 2) Formato de los CSV

La primera fila es el encabezado. Los nombres no distinguen mayúsculas, espacios ni tildes
(`Pos X`, `pos_x` y `posX` se aceptan igual). Una columna vacía significa **"sin dato"**, no cero.

```
Métricas avanzadas:  playerId,teamId,metricName,metricValue,provider,modelVersion
Posiciones:          playerId,period,minute,posX,posY,weight,source
Datos físicos:       playerId,distanceKm,topSpeedKmh,sprintsCount,accelerations,decelerations,dataSource
```

- **Métricas:** cada fila es de UN jugador o de UN equipo. Se deja vacía la columna que no corresponda.
- **Posiciones:** `posX` y `posY` van de **0 a 100** en ambos ejes (mismo criterio que el resto del sistema).
- Se acepta coma, punto y coma o tabulación como separador, y el BOM que agrega Excel.

---

## 3) Reglas que aplica el sistema (para que nadie se sorprenda)

- **La alineación del partido debe estar cargada primero.** De ahí se deduce a qué equipo pertenece
  cada jugador; no se adivina nunca.
- Si el archivo trae **un jugador que no jugó ese partido**, se **rechaza el lote completo**
  indicando cuáles. Es a propósito: es preferible a importar la mitad y quedarse con datos
  inconsistentes.
- **Métricas y posiciones se reemplazan** por partido: volver a importar **corrige**, no duplica.
- **Los datos físicos se actualizan** por jugador, sin borrar los de los demás.
- Tope: 20.000 filas de posiciones por partido.

---

## 4) Lo que hay que decidir

1. **¿De dónde salen los datos?** ¿Hay un proveedor que exporte CSV/Excel, o se van a cargar a mano?
   Esto define si el formato de arriba sirve tal cual o hay que adaptar la importación al formato
   del proveedor.
2. **¿Quién carga y cuándo?** ¿Después de cada partido, o una carga histórica de una vez?
3. **¿Con qué partido se hace la primera prueba?**

---

## 5) ⚠️ Antes de la primera carga real

**La importación nunca se ejecutó contra la base de datos real.** Está validada por pruebas
automáticas (124 en backend, 59 en frontend, todas en verde) y por compilación, pero esas pruebas
usan una base simulada, no SQL Server.

**Recomendación: la primera importación hacerla con 3 o 4 filas**, verificar que aparezcan en la
pantalla correspondiente, y recién después cargar un partido completo. Si algo falla, el error se
verá en pantalla (los fallos de servidor ahora se muestran, antes quedaban en silencio).

---

## 6) Otra decisión pendiente, aparte de esto

El usuario **`admin` sigue con la contraseña `123456`** (la que siembra `scripts/seed-admin.js`).
Con el túnel de acceso remoto abierto, cualquiera con el enlace llega al login y esa contraseña es
adivinable. **No se cambió porque afecta el flujo de trabajo del equipo y la decisión es de ustedes.**

Sugerencia: cambiar la contraseña de `admin`, o crear otro administrador y desactivar ese, antes de
volver a compartir el enlace remoto. Detalle en `docs/DEV_TOOLS_QUITAR_ANTES_DE_RELEASE.md`.

---

## Dónde está el detalle técnico

- `.context/deuda-tecnica.md` — qué se resolvió, qué se auditó y descartó, y qué queda pendiente.
- `.context/planilla-jugador.md` — de qué tabla sale cada dato de la planilla del jugador.
- `src/backend/src/matches/match-import.service.ts` — la lógica de importación, comentada.
