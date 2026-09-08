import type { ReactNode } from 'react'
import { resolveAssetUrl } from '../../lib/assetUrl'

// Coordenadas de datos siempre normalizadas 0-100 en ambos ejes (igual que dbo.goals.pos_x/pos_y
// y dbo.match_lineups.pos_x/pos_y) -- el viewBox del SVG usa una proporción más realista de cancha
// (100 x 150) sólo para el dibujo; VB_HEIGHT_RATIO convierte el dato (0-100) a coordenada SVG.
const VB_WIDTH = 100
const VB_HEIGHT_RATIO = 1.5
export const VB_HEIGHT = VB_WIDTH * VB_HEIGHT_RATIO

export function dataYToSvg(y: number) {
  return y * VB_HEIGHT_RATIO
}

export default function FootballPitch({
  children,
  onPitchClick,
  backgroundPhotoUrl,
}: {
  children?: ReactNode
  onPitchClick?: (x: number, y: number) => void
  // Foto real del estadio (dbo.venues.photo_url) cuando el partido tiene un estadio registrado CON
  // foto -- si no hay ninguna, se usa el degradé verde genérico de siempre (nunca se inventa una
  // foto ni se deja la cancha vacía). Va detrás de las líneas + una capa oscura semitransparente
  // para que las líneas blancas se sigan viendo legibles sobre cualquier foto.
  backgroundPhotoUrl?: string | null
}) {
  const resolvedBackground = resolveAssetUrl(backgroundPhotoUrl)

  const handleClick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!onPitchClick) return
    const svg = e.currentTarget
    const rect = svg.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width) * VB_WIDTH
    const y = (((e.clientY - rect.top) / rect.height) * VB_HEIGHT) / VB_HEIGHT_RATIO
    onPitchClick(Math.max(0, Math.min(100, x)), Math.max(0, Math.min(100, y)))
  }

  return (
    <svg
      viewBox={`0 0 ${VB_WIDTH} ${VB_HEIGHT}`}
      className="w-full rounded-lg"
      style={resolvedBackground ? undefined : { background: 'linear-gradient(180deg, #2f9e44 0%, #37b24d 50%, #2f9e44 100%)' }}
      onClick={handleClick}
    >
      {resolvedBackground && (
        <>
          <image href={resolvedBackground} x={0} y={0} width={VB_WIDTH} height={VB_HEIGHT} preserveAspectRatio="xMidYMid slice" />
          <rect x={0} y={0} width={VB_WIDTH} height={VB_HEIGHT} fill="rgba(6, 40, 18, 0.45)" />
        </>
      )}

      {/* Franjas de césped (sólo con el fondo genérico -- sobre una foto real no suman nada) */}
      {!resolvedBackground &&
        Array.from({ length: 10 }).map((_, i) => (
          <rect key={i} x={0} y={(i * VB_HEIGHT) / 10} width={VB_WIDTH} height={VB_HEIGHT / 10} fill={i % 2 === 0 ? 'rgba(255,255,255,0.03)' : 'transparent'} />
        ))}

      {/* Borde de cancha */}
      <rect x={2} y={2} width={VB_WIDTH - 4} height={VB_HEIGHT - 4} fill="none" stroke="white" strokeWidth={0.4} opacity={0.85} />

      {/* Línea media */}
      <line x1={2} y1={VB_HEIGHT / 2} x2={VB_WIDTH - 2} y2={VB_HEIGHT / 2} stroke="white" strokeWidth={0.4} opacity={0.85} />

      {/* Círculo central */}
      <circle cx={VB_WIDTH / 2} cy={VB_HEIGHT / 2} r={9} fill="none" stroke="white" strokeWidth={0.4} opacity={0.85} />
      <circle cx={VB_WIDTH / 2} cy={VB_HEIGHT / 2} r={0.5} fill="white" opacity={0.85} />

      {/* Área grande + chica + punto penal, arriba y abajo */}
      {[0, 1].map((half) => {
        const top = half === 0
        const baseY = top ? 2 : VB_HEIGHT - 2
        const dir = top ? 1 : -1
        return (
          <g key={half}>
            <rect x={VB_WIDTH / 2 - 22} y={top ? baseY : baseY - 16 * 1} width={44} height={16} fill="none" stroke="white" strokeWidth={0.4} opacity={0.85} />
            <rect x={VB_WIDTH / 2 - 10} y={top ? baseY : baseY - 6} width={20} height={6} fill="none" stroke="white" strokeWidth={0.4} opacity={0.85} />
            <circle cx={VB_WIDTH / 2} cy={baseY + dir * 11} r={0.5} fill="white" opacity={0.85} />
            <path
              d={
                top
                  ? `M ${VB_WIDTH / 2 - 4.5} 16 A 9 9 0 0 0 ${VB_WIDTH / 2 + 4.5} 16`
                  : `M ${VB_WIDTH / 2 - 4.5} ${VB_HEIGHT - 16} A 9 9 0 0 1 ${VB_WIDTH / 2 + 4.5} ${VB_HEIGHT - 16}`
              }
              fill="none"
              stroke="white"
              strokeWidth={0.4}
              opacity={0.85}
            />
            <rect x={VB_WIDTH / 2 - 5} y={top ? 0 : VB_HEIGHT - 2} width={10} height={2} fill="none" stroke="white" strokeWidth={0.4} opacity={0.85} />
          </g>
        )
      })}

      {children}
    </svg>
  )
}
