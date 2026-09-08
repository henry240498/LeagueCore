import { useMemo } from 'react'
import FootballPitch, { dataYToSvg } from './FootballPitch'
import PlayerMarker, { type PitchPlayer } from './PlayerMarker'
import type { MatchLineupEntry } from '../../types/match'

// Componente central reutilizable de cancha interactiva (pedido explícito: "no crear una cancha
// diferente para cada módulo"). Encapsula el layout real por formación táctica -- antes cada
// pantalla calculaba posiciones a mano; ahora una sola función deriva líneas reales (portero,
// defensa, una o más líneas intermedias según la forma, ataque) a partir de la forma declarada
// (ej. "4-2-3-1") y las posiciones reales de LeagueCore (Portero/Defensor/Mediocampista/Delantero).
// Cuando NO hay formación declarada para un equipo, cae a un agrupamiento simple por rol (mismo
// comportamiento de siempre) en vez de dejar la cancha vacía.

function spreadX(i: number, n: number): number {
  return n <= 1 ? 50 : 12 + (i * 76) / (n - 1)
}

function lineY(i: number, total: number): number {
  // y=74 (línea más cercana al propio arco) -> y=20 (línea más ofensiva); GK vive aparte en y=92.
  return total <= 1 ? 48 : 74 - (i * (74 - 20)) / (total - 1)
}

// Deriva un layout real a partir de la forma declarada (ej. "4-2-3-1" -> [4,2,3,1]): la primera
// cifra es la línea defensiva, la última la línea ofensiva, y las intermedias se reparten entre las
// líneas de mediocampo reales disponibles (LeagueCore sólo distingue una categoría "Mediocampista",
// no defensivo/ofensivo por separado -- se aproxima repartiendo la lista real en tantos grupos como
// líneas intermedias declara la formación, respetando el orden por dorsal para que sea estable).
function computeFormationLayout(shape: string, entries: MatchLineupEntry[]): Map<number, { x: number; y: number }> {
  const nums = shape.split('-').map(Number)
  const layout = new Map<number, { x: number; y: number }>()

  const gk = entries.filter((e) => e.position === 'Portero')
  gk.forEach((e) => layout.set(e.id, { x: 50, y: 92 }))

  const defenders = entries.filter((e) => e.position === 'Defensor').sort((a, b) => (a.shirtNumber ?? 99) - (b.shirtNumber ?? 99))
  const forwards = entries.filter((e) => e.position === 'Delantero').sort((a, b) => (a.shirtNumber ?? 99) - (b.shirtNumber ?? 99))
  const midfielders = entries.filter((e) => e.position !== 'Portero' && e.position !== 'Defensor' && e.position !== 'Delantero').sort((a, b) => (a.shirtNumber ?? 99) - (b.shirtNumber ?? 99))

  const middleLineCount = Math.max(1, nums.length - 2)
  const totalLines = 2 + middleLineCount // defensa + N medios + ataque

  defenders.forEach((e, i) => layout.set(e.id, { x: spreadX(i, defenders.length), y: lineY(0, totalLines) }))
  forwards.forEach((e, i) => layout.set(e.id, { x: spreadX(i, forwards.length), y: lineY(totalLines - 1, totalLines) }))

  // Reparte a los mediocampistas reales en `middleLineCount` grupos, tamaño proporcional a lo que
  // pide la formación (nums[1..-2]) pero siempre usando el conteo REAL disponible -- nunca inventa
  // jugadores que no están cargados en la alineación.
  const middleShapeCounts = nums.slice(1, -1)
  const weights = middleShapeCounts.length === middleLineCount ? middleShapeCounts : Array(middleLineCount).fill(1)
  const weightSum = weights.reduce((a, b) => a + b, 0) || 1
  let cursor = 0
  weights.forEach((w, lineIdx) => {
    const take = lineIdx === weights.length - 1 ? midfielders.length - cursor : Math.round((w / weightSum) * midfielders.length)
    const group = midfielders.slice(cursor, cursor + take)
    group.forEach((e, i) => layout.set(e.id, { x: spreadX(i, group.length), y: lineY(1 + lineIdx, totalLines) }))
    cursor += take
  })

  return layout
}

// Agrupamiento simple por rol (comportamiento previo, sin formación declarada) -- 3 franjas fijas.
function computeRoleLayout(entries: MatchLineupEntry[]): Map<number, { x: number; y: number }> {
  const groups: Record<string, MatchLineupEntry[]> = {}
  for (const e of entries) {
    const key = e.position ?? 'Mediocampista'
    groups[key] = groups[key] ?? []
    groups[key].push(e)
  }
  const layout = new Map<number, { x: number; y: number }>()
  for (const [role, list] of Object.entries(groups)) {
    const y = role === 'Portero' ? 92 : role === 'Defensor' ? 72 : role === 'Delantero' ? 28 : 50
    list.forEach((e, i) => layout.set(e.id, { x: spreadX(i, list.length), y }))
  }
  return layout
}

export type PitchTeamInput = {
  starters: MatchLineupEntry[]
  formationShape: string | null
  color: string
  mirror: boolean
}

export default function InteractiveFootballPitch({
  home,
  away,
  editable = false,
  onPlayerClick,
  onMove,
  backgroundPhotoUrl,
  extraLayer,
}: {
  home: PitchTeamInput
  away: PitchTeamInput | null
  editable?: boolean
  onPlayerClick: (playerId: number) => void
  onMove?: (lineupId: number, x: number, y: number) => void
  backgroundPhotoUrl?: string | null
  extraLayer?: React.ReactNode
}) {
  const buildPlayers = (team: PitchTeamInput): PitchPlayer[] => {
    const layout = team.formationShape ? computeFormationLayout(team.formationShape, team.starters) : computeRoleLayout(team.starters)
    return team.starters
      .filter((e) => editable || e.posX != null || layout.has(e.id))
      .map((e) => {
        const manual = e.posX != null && e.posY != null
        const pos = manual ? { x: e.posX as number, y: e.posY as number } : layout.get(e.id) ?? { x: 50, y: 50 }
        const y = team.mirror ? 100 - pos.y : pos.y
        const x = team.mirror ? 100 - pos.x : pos.x
        return {
          lineupId: e.id,
          playerId: e.playerId,
          name: e.playerFullName,
          photoUrl: e.photoUrl,
          shirtNumber: e.shirtNumber,
          x,
          y,
          teamColor: team.color,
        }
      })
  }

  const players = useMemo(() => [...buildPlayers(home), ...(away ? buildPlayers(away) : [])], [home, away, editable])

  return (
    <FootballPitch backgroundPhotoUrl={backgroundPhotoUrl}>
      {players.map((p) => (
        <PlayerMarker key={p.lineupId} player={p} editable={editable} onClick={onPlayerClick} onMove={onMove} />
      ))}
      {extraLayer}
    </FootballPitch>
  )
}

export { dataYToSvg }
