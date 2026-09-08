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
}: {
  player: PitchPlayer
  editable: boolean
  onClick: (playerId: number) => void
  onMove?: (lineupId: number, x: number, y: number) => void
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
      {photoUrl ? (
        <>
          <defs>
            <clipPath id={`photo-clip-${player.lineupId}`}>
              <circle r={4} />
            </clipPath>
          </defs>
          <image
            href={photoUrl}
            x={-4}
            y={-4}
            width={8}
            height={8}
            preserveAspectRatio="xMidYMid slice"
            clipPath={`url(#photo-clip-${player.lineupId})`}
          />
          <circle r={4} fill="none" stroke={player.teamColor} strokeWidth={0.8} />
          <circle cx={2.9} cy={-2.9} r={1.6} fill={player.teamColor} stroke="white" strokeWidth={0.3} />
          <text x={2.9} y={-2.9} textAnchor="middle" dy={0.6} fontSize={1.9} fontWeight={700} fill="white">
            {player.shirtNumber ?? '-'}
          </text>
        </>
      ) : (
        <>
          <circle r={4} fill={player.teamColor} stroke="white" strokeWidth={0.4} />
          <text textAnchor="middle" dy={1.4} fontSize={3.6} fontWeight={700} fill="white">
            {player.shirtNumber ?? '-'}
          </text>
        </>
      )}
      <text textAnchor="middle" y={7} fontSize={2.6} fill="white" style={{ paintOrder: 'stroke', stroke: 'rgba(0,0,0,0.55)', strokeWidth: 0.6 }}>
        {player.name.split(' ').slice(-1)[0]}
      </text>
    </g>
  )
}
