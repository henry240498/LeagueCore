import { useRef, useState } from 'react'
import { resolveAssetUrl } from '../../lib/assetUrl'
import { dataYToSvg, VB_HEIGHT } from './FootballPitch'

export type PitchPlayer = {
  lineupId: number
  playerId: number
  name: string
  photoUrl?: string | null
  shirtNumber: number | null
  x: number
  y: number
  teamColor: string
  hasEvents?: boolean
}

export default function PlayerMarker({
  player,
  editable,
  onClick,
  onMove,
  index = 0,
}: {
  player: PitchPlayer
  editable: boolean
  onClick: (playerId: number) => void
  onMove?: (lineupId: number, x: number, y: number) => void
  /** Orden de aparición: escalona la animación de entrada para que salgan uno tras otro. */
  index?: number
}) {
  const [dragPos, setDragPos] = useState<{ x: number; y: number } | null>(null)
  const draggingRef = useRef(false)
  const movedRef = useRef(false)

  const x = dragPos?.x ?? player.x
  const y = dragPos?.y ?? player.y

  const toDataCoords = (clientX: number, clientY: number, svg: SVGSVGElement) => {
    const rect = svg.getBoundingClientRect()
    const dx = ((clientX - rect.left) / rect.width) * 100
    const dy = (((clientY - rect.top) / rect.height) * VB_HEIGHT) / 1.5
    return { x: Math.max(2, Math.min(98, dx)), y: Math.max(2, Math.min(98, dy)) }
  }

  const handlePointerDown = (e: React.PointerEvent<SVGGElement>) => {
    if (!editable) return
    e.stopPropagation()
    draggingRef.current = true
    movedRef.current = false
    // La captura debe pedirse sobre el propio elemento que escucha move/up (el <g>), no sobre el
    // <svg> contenedor -- si se captura en el ancestro, los eventos redirigidos se despachan
    // dirigidos a ESE ancestro (y su fase de burbuja hacia arriba), nunca hacia abajo a este <g>,
    // así que los handlers de acá nunca los reciben y el arrastre queda "muerto" tras el primer
    // pointerdown (bug real encontrado por Playwright: el drag no persistía nada en la base).
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  const handlePointerMove = (e: React.PointerEvent<SVGGElement>) => {
    if (!draggingRef.current) return
    const svg = e.currentTarget.ownerSVGElement
    if (!svg) return
    movedRef.current = true
    setDragPos(toDataCoords(e.clientX, e.clientY, svg))
  }

  const handlePointerUp = (e: React.PointerEvent<SVGGElement>) => {
    if (!draggingRef.current) return
    draggingRef.current = false
    e.currentTarget.releasePointerCapture(e.pointerId)
    if (movedRef.current && dragPos && onMove) {
      onMove(player.lineupId, dragPos.x, dragPos.y)
    } else if (!movedRef.current) {
      onClick(player.playerId)
    }
    setDragPos(null)
  }

  const svgY = dataYToSvg(y)
  const photoUrl = resolveAssetUrl(player.photoUrl)
  // Se muestra el apellido (último token) y se acota para que la placa no invada a otro jugador.
  const lastName = player.name.trim().split(/\s+/).slice(-1)[0] ?? player.name
  const shortName = lastName.length > 12 ? `${lastName.slice(0, 11)}…` : lastName

  return (
    <g
      transform={`translate(${x}, ${svgY})`}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      // La transición sólo se anima cuando NO se está arrastrando (si no, el drag en vivo se ve
      // "atrasado" siguiendo al puntero) -- un cambio de formación o de filtro sí debe animarse.
      style={{ cursor: editable ? 'grab' : 'pointer', transition: dragPos ? 'none' : 'transform 0.5s ease' }}
      onClick={(e) => {
        if (!editable) {
          e.stopPropagation()
          onClick(player.playerId)
        }
      }}
    >
      <title>
        {player.name} · #{player.shirtNumber ?? '-'}
      </title>
      {/* Grupo interior: sólo acá vive la animación de entrada (opacidad + escala), para no
          interferir con el translate del grupo exterior ni con el arrastre. Mientras se arrastra
          se desactiva, si no el jugador "reaparecería" en cada re-render. */}
      <g
        className={dragPos ? undefined : 'lc-player-enter'}
        style={dragPos ? undefined : { animationDelay: `${Math.min(index, 22) * 45}ms` }}
      >
        {/* Sombra proyectada en el césped: da sensación de volumen. */}
        <ellipse cx={0} cy={4.6} rx={3.4} ry={1.1} fill="rgba(0,0,0,0.3)" />

        <g filter="url(#lc-player-shadow)">
          {photoUrl ? (
            <>
              <defs>
                <clipPath id={`photo-clip-${player.lineupId}`}>
                  <circle r={4} />
                </clipPath>
              </defs>
              <circle r={4.3} fill="white" opacity={0.9} />
              <image
                href={photoUrl}
                x={-4}
                y={-4}
                width={8}
                height={8}
                preserveAspectRatio="xMidYMid slice"
                clipPath={`url(#photo-clip-${player.lineupId})`}
              />
              <circle r={4} fill="none" stroke={player.teamColor} strokeWidth={0.9} />
              <circle cx={2.9} cy={-2.9} r={1.7} fill={player.teamColor} stroke="white" strokeWidth={0.35} />
              <text x={2.9} y={-2.9} textAnchor="middle" dy={0.62} fontSize={1.9} fontWeight={700} fill="white">
                {player.shirtNumber ?? '-'}
              </text>
            </>
          ) : (
            <>
              <circle r={4} fill={player.teamColor} stroke="white" strokeWidth={0.5} />
              {/* Brillo superior sutil: aspecto de ficha, no de círculo plano. */}
              <ellipse cx={0} cy={-1.5} rx={3.1} ry={1.9} fill="white" opacity={0.14} />
              <text textAnchor="middle" dy={1.4} fontSize={3.6} fontWeight={700} fill="white">
                {player.shirtNumber ?? '-'}
              </text>
            </>
          )}
        </g>

        {/* Nombre sobre una placa semitransparente: legible sobre césped o foto de estadio. */}
        <g>
          <rect
            x={-Math.max(5.5, shortName.length * 0.78)}
            y={5.2}
            width={Math.max(11, shortName.length * 1.56)}
            height={3.6}
            rx={1.8}
            fill="rgba(0,0,0,0.55)"
          />
          <text
            textAnchor="middle"
            y={7.1}
            dy={0.65}
            fontSize={2.5}
            fontWeight={600}
            fill="white"
            style={{ letterSpacing: '0.02em' }}
          >
            {shortName}
          </text>
        </g>
      </g>
    </g>
  )
}
