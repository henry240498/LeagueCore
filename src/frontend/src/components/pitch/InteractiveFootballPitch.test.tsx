import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import InteractiveFootballPitch from './InteractiveFootballPitch'
import type { MatchLineupEntry } from '../../types/match'

function starter(id: number, name: string, position: string, shirt: number): MatchLineupEntry {
  return {
    id,
    teamId: 1,
    playerId: id,
    playerFullName: name,
    photoUrl: null,
    nationality: null,
    isStarting: true,
    shirtNumber: shirt,
    position,
    minutesPlayed: 90,
    posX: null,
    posY: null,
    goals: 0,
    assists: 0,
    yellowCards: 0,
    redCards: 0,
  }
}

const STARTERS = [
  starter(1, 'Juan Pérez', 'Portero', 1),
  starter(2, 'Pedro Gómez', 'Defensor', 2),
  starter(3, 'Luis Benítez', 'Delantero', 9),
]

function renderPitch(logoUrl: string | null) {
  return render(
    <InteractiveFootballPitch
      home={{ starters: STARTERS, formationShape: null, color: '#2563eb', mirror: false, logoUrl }}
      away={null}
      onPlayerClick={() => {}}
    />,
  )
}

describe('InteractiveFootballPitch', () => {
  it('anima la aparición de cada jugador de forma escalonada', () => {
    const { container } = renderPitch(null)
    const animated = container.querySelectorAll('.lc-player-enter')
    expect(animated).toHaveLength(STARTERS.length)

    // Cada jugador entra un poco después que el anterior.
    const delays = Array.from(animated).map((el) => (el as SVGElement).style.animationDelay)
    expect(delays[0]).toBe('0ms')
    expect(delays[1]).not.toBe(delays[0])
  })

  it('usa el escudo del equipo como marca de agua cuando existe', () => {
    const { container } = renderPitch('/uploads/teams/olimpia.png')
    const images = Array.from(container.querySelectorAll('image'))
    const watermark = images.find((img) => (img.getAttribute('href') ?? '').includes('olimpia.png'))
    expect(watermark).toBeTruthy()
    // Marca de agua = discreta, no debe competir con la información del partido.
    expect(Number(watermark!.getAttribute('opacity'))).toBeLessThan(0.25)
  })

  it('NO inventa un escudo cuando el equipo no tiene logo cargado', () => {
    const { container } = renderPitch(null)
    // Sin logo no hay ninguna imagen de marca de agua (los jugadores tampoco tienen foto acá).
    expect(container.querySelectorAll('image')).toHaveLength(0)
  })

  it('muestra el apellido de cada titular sobre la cancha', () => {
    const { container } = renderPitch(null)
    const texts = Array.from(container.querySelectorAll('text')).map((t) => t.textContent)
    expect(texts).toContain('Pérez')
    expect(texts).toContain('Benítez')
  })
})
