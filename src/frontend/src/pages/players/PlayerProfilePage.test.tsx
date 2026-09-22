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

/**
 * Mock de fetch POR URL (no por orden de llamada).
 *
 * La página pide `/profile` e `/injuries` desde efectos distintos, así que el orden en que salen
 * no es determinista: con un mock por orden, bajo carga cada request recibía el cuerpo del otro y
 * el test fallaba de forma intermitente. Emparejar por ruta lo vuelve estable.
 */
function mockFetchByUrl(routes: Record<string, unknown>) {
  globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
    const url =
      typeof input === 'string' ? input : input instanceof URL ? input.toString() : (input as Request).url
    const key = Object.keys(routes).find((path) => url.includes(path))
    return {
      ok: true,
      status: 200,
      headers: { get: () => 'application/json' },
      json: async () => (key ? routes[key] : {}),
    } as unknown as Response
  }) as unknown as typeof fetch
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
    mockFetchByUrl({ '/profile': PROFILE, '/injuries': [] })
    renderProfile()

    await waitFor(() => {
      expect(screen.getByText(/Juan Pérez/)).toBeInTheDocument()
    })
    expect(screen.getByText('Disponible')).toBeInTheDocument()
    expect(screen.getByText('Vigente')).toBeInTheDocument()
  })

  it('muestra la lesión activa cuando existe', async () => {
    const injury = {
      id: 9,
      injuryType: 'Desgarro',
      bodyPart: 'Isquio',
      status: 'ACTIVA',
      startDate: '2026-08-01',
      endDate: null,
      severity: 'MODERADA',
    }
    mockFetchByUrl({
      '/profile': { ...PROFILE, activeInjury: injury, injuriesCount: 1 },
      '/injuries': [injury],
    })
    renderProfile()

    await waitFor(() => {
      expect(screen.getByText('Lesionado')).toBeInTheDocument()
    })
    // "Desgarro" puede aparecer tanto en la lesión activa como en el historial: aceptamos 1 o más
    // (usar getByText, que exige exactamente uno, hacía este test flaky).
    expect(screen.getAllByText(/Desgarro/).length).toBeGreaterThan(0)
  })
})
