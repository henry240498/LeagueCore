import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import MatchScoreboardHeader from './MatchScoreboardHeader'
import type { Match } from '../../types/match'

// FASE 16 — validación de estados de la cabecera del Match Center.
// Verifica que cada estado se muestre correctamente y que NUNCA aparezca undefined/NaN/null.

function baseMatch(overrides: Partial<Match> = {}): Match {
  return {
    id: 1,
    competitionId: 10,
    competitionName: 'Primera División',
    seasonId: 5,
    seasonLabel: 'Clausura 2026',
    homeTeamId: 1,
    homeTeamName: 'Olimpia',
    homeTeamLogoUrl: null,
    awayTeamId: 2,
    awayTeamName: 'Cerro Porteño',
    awayTeamLogoUrl: null,
    venueId: null,
    venueName: null,
    matchDate: '2026-09-21T00:00:00.000Z',
    matchTime: null,
    status: 'scheduled',
    attendance: null,
    round: null,
    phase: null,
    groupName: null,
    leg: null,
    weatherCondition: null,
    temperatureCelsius: null,
    humidityPct: null,
    windKmh: null,
    pitchCondition: null,
    comments: null,
    televised: false,
    dataOrigin: 'manual',
    periodScores: [],
    score: null,
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: null,
    ...overrides,
  } as Match
}

describe('MatchScoreboardHeader', () => {
  it('partido programado: muestra "vs" y estado Programado', () => {
    render(<MatchScoreboardHeader match={baseMatch()} />)
    expect(screen.getByText('vs')).toBeInTheDocument()
    expect(screen.getByText('Programado')).toBeInTheDocument()
    expect(screen.getByText('Olimpia')).toBeInTheDocument()
  })

  it('partido en vivo: muestra EN VIVO y el minuto', () => {
    render(
      <MatchScoreboardHeader
        match={baseMatch({ status: 'in_progress', score: { homeScore: 1, awayScore: 0 } })}
        liveMinute={67}
      />,
    )
    expect(screen.getByText('EN VIVO')).toBeInTheDocument()
    expect(screen.getByText(/67/)).toBeInTheDocument()
  })

  it('finalizado con penales: muestra el marcador y "penales"', () => {
    const { container } = render(
      <MatchScoreboardHeader
        match={baseMatch({
          status: 'finished',
          score: { homeScore: 1, awayScore: 1 },
          periodScores: [
            { period: 'full_time', homeScore: 1, awayScore: 1 },
            { period: 'penalties', homeScore: 4, awayScore: 3 },
          ],
        })}
      />,
    )
    expect(screen.getByText('Finalizado')).toBeInTheDocument()
    expect(screen.getByText(/penales/)).toBeInTheDocument()
    expect(container.textContent).toContain('1')
  })

  it('nunca renderiza undefined/NaN aunque falten datos opcionales', () => {
    const { container } = render(<MatchScoreboardHeader match={baseMatch()} />)
    expect(container.textContent).not.toContain('undefined')
    expect(container.textContent).not.toContain('NaN')
    expect(container.textContent).not.toContain('null')
  })

  it('estado suspendido se muestra con su etiqueta', () => {
    render(<MatchScoreboardHeader match={baseMatch({ status: 'suspended' })} />)
    expect(screen.getByText('Suspendido')).toBeInTheDocument()
  })

  it('en vivo con prórroga: deriva "Prórroga" del marcador de tiempo extra', () => {
    render(
      <MatchScoreboardHeader
        match={baseMatch({
          status: 'in_progress',
          score: { homeScore: 1, awayScore: 1 },
          periodScores: [{ period: 'extra_time', homeScore: 0, awayScore: 0 }],
        })}
      />,
    )
    expect(screen.getByText(/Prórroga/)).toBeInTheDocument()
  })

  it('en vivo con penales: deriva "Penales" del marcador de la tanda', () => {
    render(
      <MatchScoreboardHeader
        match={baseMatch({
          status: 'in_progress',
          score: { homeScore: 1, awayScore: 1 },
          periodScores: [
            { period: 'full_time', homeScore: 1, awayScore: 1 },
            { period: 'penalties', homeScore: 2, awayScore: 1 },
          ],
        })}
      />,
    )
    expect(screen.getByText(/Penales/)).toBeInTheDocument()
  })
})
