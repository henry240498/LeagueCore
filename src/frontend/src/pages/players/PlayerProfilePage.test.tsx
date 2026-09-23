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

// Planilla (trayectoria + partido a partido) que consume PlayerCareerSection.
const CAREER = {
  teamHistory: [
    {
      id: 1,
      teamId: 5,
      teamName: 'Olimpia',
      teamLogoUrl: null,
      startDate: '2026-01-01',
      endDate: null,
      squadNumber: 9,
      note: null,
      current: true,
    },
  ],
  totals: {
    matches: 12,
    starts: 10,
    substituteAppearances: 2,
    minutes: 900,
    goals: 4,
    ownGoals: 0,
    assists: 3,
    yellowCards: 2,
    redCards: 0,
  },
  byCompetition: [
    { competitionId: 1, competitionName: 'Primera División', matches: 12, minutes: 900, goals: 4, assists: 3, yellowCards: 2, redCards: 0 },
  ],
  positions: [{ position: 'Delantero', matches: 12 }],
  statTotals: null,
}

const MATCH_LOG = {
  items: [
    {
      matchId: 31,
      matchDate: '2026-09-01',
      status: 'finished',
      competitionName: 'Primera División',
      seasonLabel: 'Clausura 2026',
      round: 'Fecha 5',
      teamId: 5,
      teamName: 'Olimpia',
      isHome: true,
      opponentName: 'Cerro Porteño',
      homeScore: 2,
      awayScore: 1,
      isStarting: true,
      position: 'Delantero',
      shirtNumber: 9,
      minutesPlayed: 90,
      goals: 1,
      ownGoals: 0,
      assists: 0,
      yellowCards: 0,
      redCards: 0,
    },
  ],
  total: 1,
  page: 1,
  pageSize: 20,
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
    mockFetchByUrl({ '/profile': PROFILE, '/injuries': [], '/career': CAREER, '/match-log': MATCH_LOG })
    renderProfile()

    await waitFor(() => {
      expect(screen.getByText(/Juan Pérez/)).toBeInTheDocument()
    })
    expect(screen.getByText('Disponible')).toBeInTheDocument()
    expect(screen.getByText('Vigente')).toBeInTheDocument()
  })

  it('muestra la planilla: trayectoria, totales y partido a partido', async () => {
    mockFetchByUrl({ '/profile': PROFILE, '/injuries': [], '/career': CAREER, '/match-log': MATCH_LOG })
    renderProfile()

    // Se espera por el badge "Actual", que SÓLO aparece con la trayectoria ya cargada. Esperar por
    // el encabezado no sirve: también se muestra durante la carga y el test seguía antes de tiempo.
    await waitFor(
      () => {
        expect(screen.getByText('Actual')).toBeInTheDocument()
      },
      { timeout: 5000 },
    )

    expect(screen.getByText('📋 Planilla del jugador')).toBeInTheDocument()
    // Matcher flexible: el nombre del equipo se renderiza junto al dorsal ("Olimpia · #9").
    expect(screen.getAllByText(/Olimpia/).length).toBeGreaterThan(0)
    expect(screen.getByText(/#9/)).toBeInTheDocument()
    // Posición realmente jugada.
    expect(screen.getByText(/Delantero · 12 PJ/)).toBeInTheDocument()
    // Sin estadísticas individuales cargadas: lo dice, no inventa ceros.
    expect(screen.getByText(/Sin estadísticas individuales por partido/)).toBeInTheDocument()
    // Partido a partido: aparece el rival del único encuentro.
    await waitFor(
      () => {
        expect(screen.getByText(/Cerro Porteño/)).toBeInTheDocument()
      },
      { timeout: 5000 },
    )
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
      '/career': CAREER,
      '/match-log': MATCH_LOG,
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
