import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import LiveMatchPage from './LiveMatchPage'

const MATCH = {
  id: 3,
  homeTeamId: 1,
  homeTeamName: 'Olimpia',
  awayTeamId: 2,
  awayTeamName: 'Cerro Porteño',
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

function renderLive() {
  render(
    <MemoryRouter initialEntries={['/partidos/3/live']}>
      <Routes>
        <Route path="/partidos/:id" element={<div />} />
        <Route path="/partidos/:id/live" element={<LiveMatchPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('LiveMatchPage', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('muestra el marcador en vivo con botones grandes', async () => {
    mockFetchSequence([
      MATCH,
      [],
      [
        { type: 'goal', id: 1, minute: 23, teamId: 1, playerName: 'Juan Pérez' },
        { type: 'goal', id: 2, minute: 55, teamId: 2, playerName: 'Pedro Gómez' },
      ],
    ])
    renderLive()

    await waitFor(() => {
      expect(screen.getByText('⚽ GOL')).toBeInTheDocument()
    })
    expect(screen.getByText('🎯 TIRO')).toBeInTheDocument()
    expect(screen.getByText('🔄 CAMBIO')).toBeInTheDocument()
  })

  it('muestra el timeline con los eventos', async () => {
    mockFetchSequence([
      MATCH,
      [],
      [{ type: 'goal', id: 1, minute: 23, teamId: 1, playerName: 'Juan Pérez' }],
    ])
    renderLive()

    await waitFor(() => {
      expect(screen.getByText(/Juan Pérez/)).toBeInTheDocument()
    })
  })
})
