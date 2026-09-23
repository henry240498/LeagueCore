# Cancha (SVG) — convenciones visuales y trampas

> Cómo está armada la cancha, qué se agregó el 2026-09-23 (aparición animada + marca de agua) y
> **qué NO hay que romper**. Leer antes de tocar `components/pitch/`.

## Componentes y quién los usa

| Componente | Rol | Consumidores |
|---|---|---|
| `FootballPitch.tsx` | Cancha base: césped/foto, líneas, `defs` compartidos, marca de agua, viñeta | `InteractiveFootballPitch`, `PassMap`, `PlayerPitchViz`, `TacticalBoard`, `MatchMapsSection`, `MatchTacticsTab` |
| `InteractiveFootballPitch.tsx` | Calcula el layout por formación y dibuja los jugadores | `TacticalViewTab` (2 usos) |
| `PlayerMarker.tsx` | Un jugador (foto o ficha, dorsal, apellido, arrastre) | sólo `InteractiveFootballPitch` |

**Regla del proyecto:** no crear una cancha distinta por módulo. Todo pasa por `FootballPitch`.

## Coordenadas
Los datos siempre son **0–100 en ambos ejes** (igual que `match_lineups.pos_x/pos_y` y
`goals.pos_x/pos_y`). El SVG dibuja en `100 x 150` para una proporción realista: usar
`dataYToSvg(y)` para convertir. Nunca guardar coordenadas en unidades SVG.

## ⚠️ Trampa crítica: la animación NO va en el mismo `<g>` que el `translate`

El `<g>` **exterior** de `PlayerMarker` lleva `transform: translate(...)` + `transition` para moverse
por la cancha y para el arrastre. La animación de entrada vive en un `<g>` **interior**
(`className="lc-player-enter"`) y **sólo toca opacidad y escala**.

Si se pone la animación en el elemento exterior:
- pelea con el `translate` (el jugador "salta" de posición), y
- **rompe el arrastre**, que ya costó un bug difícil de encontrar (ver el comentario largo en
  `handlePointerDown`: la captura del puntero debe pedirse sobre el propio `<g>`, no sobre el `<svg>`).

Además, mientras se arrastra la clase de animación se **desactiva**; si no, el jugador "reaparecería"
en cada re-render del drag.

## Aparición animada
- Keyframes en `src/index.css` (`@keyframes lc-player-enter` + `.lc-player-enter`), no inline, para
  no duplicar `<style>` por cada cancha montada.
- El escalonado se pasa inline: `animationDelay = min(index, 22) * 45ms`. El tope evita esperas
  absurdas si algún día se dibujan muchos jugadores.
- **Respeta `prefers-reduced-motion`**: con esa preferencia los jugadores aparecen ya colocados.

## Marca de agua (escudo)
- Prop opcional `watermarks?: PitchWatermark[]` en `FootballPitch`; `InteractiveFootballPitch` la
  arma desde `PitchTeamInput.logoUrl`.
- El escudo va sobre la **mitad del equipo** (el local abajo, porque su arco está en `y=92`), a
  **opacidad 0.1**, detrás de líneas y jugadores, con `pointerEvents: none`.
- **Si el equipo no tiene logo cargado, esa mitad no lleva marca.** No se inventa ningún escudo
  (mismo criterio que `MatchScoreboardHeader`, que muestra una silueta genérica antes que el logo de
  otro club).

## Acabado profesional (qué se agregó)
Sombra proyectada en el césped (elipse), filtro `lc-player-shadow` (drop shadow suave), viñeta
`lc-pitch-vignette` por encima del césped pero **debajo** de los jugadores (para no apagarlos),
anillo del color del equipo, brillo sutil en fichas sin foto, y el apellido sobre una **placa
semitransparente** para que se lea sobre césped o sobre la foto real del estadio.

## Compatibilidad
`watermarks`, `logoUrl` e `index` son **opcionales**: los demás consumidores de `FootballPitch`
(mapas de calor, mapa de pases, pizarra, tiros) no se tocaron y siguen igual.

## Tests
`components/pitch/InteractiveFootballPitch.test.tsx` fija: animación escalonada (delays distintos),
marca de agua **discreta** (opacidad < 0.25), que **no se genere imagen sin logo**, y que se muestren
los apellidos.

## Pendiente
No se pudo **ver renderizado en un navegador** en el entorno de trabajo: se validó por tipos, tests y
estructura del SVG. Si hace falta calibrar intensidad (opacidad de la marca, velocidad de la
animación, tamaño del escudo), son constantes en `FootballPitch.tsx` / `index.css`.
