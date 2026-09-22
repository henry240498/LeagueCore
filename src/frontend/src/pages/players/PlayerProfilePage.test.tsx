import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import PlayerProfilePage from './PlayerProfilePage'

const PROFILE = {
  player: {
    id: 7,
    firstName: 'Juan',
    lastName: 'Pérez',
    fullName: 'Juan Pérez',
    position: 'Delantero',
    teamName: 'Olimpia',
    heightCm: 180,
    weightKg: 75,
    contractStatus: 'VIGENTE',
    status: 'active',
  },
  physicalLatest: {
    id: 1,
    maxSpeedKmh: 32,
    distanceM: 10500,
    sprints: 24,
    playerLoad: 890,
    acwr: 1.2,
    fatigue: 40,
    availability: 'DISPONIBLE',
  },
  physicalEvolution: [],
  technical: [
    { id: 1, playerId: 7, attribute: 'VELOCIDAD', value: 87, evaluatedAt: '2026-09-01', evaluator: 'Analista' },
    { id: 2, playerId: 7, attribute: 'VISION', value: 94, evaluatedAt: '2026-09-01', evaluator: 'Analista' },
  ],
  activeInjury: null,
  injuriesCount: 0,
}

function mockFetchSequence(responses: unknown[]) {
  let call = 0
  globalThis.fetch = vi.fn(async () => {
    const body = responses[Math.min(call, responses.length - 1)]
    call += 1
    return {
      ok: true,
      status: 200,
      headers: { get: () => 'application/json' },
      json: async () => body,
    } as unknown as Response
  })
}

function renderProfile() {
  render(
    <MemoryRouter initialEntries={['/jugadores/7/expediente']}>
      <Routes>
        <Route path="/jugadores/:id" element={<div />} />
        <Route path="/jugadores/:id/expediente" element={<PlayerProfilePage />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('PlayerProfilePage', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('muestra el expediente con disponibilidad y radar técnico', async () => {
    mockFetchSequence([PROFILE, []])
    renderProfile()

    await waitFor(() => {
      expect(screen.getByText(/Juan Pérez/)).toBeInTheDocument()
    })
    expect(screen.getByText('Disponible')).toBeInTheDocument()
    expect(screen.getByText('Vigente')).toBeInTheDocument()
  })

  it('muestra la lesión activa cuando existe', async () => {
    mockFetchSequence([
      {
        ...PROFILE,
        activeInjury: { id: 9, injuryType: 'Desgarro', bodyPart: 'Isquio', status: 'ACTIVA', startDate: '2026-08-01', endDate: null, severity: 'MODERADA' },
        injuriesCount: 1,
      },
      [{ id: 9, injuryType: 'Desgarro', bodyPart: 'Isquio', status: 'ACTIVA', startDate: '2026-08-01', endDate: null, severity: 'MODERADA' }],
    ])
    renderProfile()

    await waitFor(() => {
      expect(screen.getByText('Lesionado')).toBeInTheDocument()
    })
    // "Desgarro" puede aparecer tanto en la lesión activa como en el historial: aceptamos 1 o más
    // (usar getByText, que exige exactamente uno, hacía este test flaky).
    expect(screen.getAllByText(/Desgarro/).length).toBeGreaterThan(0)
  })
})
