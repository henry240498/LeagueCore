import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import WatchlistPage from './WatchlistPage'

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

describe('WatchlistPage', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('muestra jugadores en seguimiento con prioridad y estado', async () => {
    mockFetchSequence([
      [
        {
          id: 1,
          playerId: 5,
          playerName: 'Pedro Gómez',
          externalName: null,
          priority: 'ALTA',
          status: 'EN_SEGUIMIENTO',
          owner: 'Scout 1',
          lastObservation: null,
          nextObservation: '2026-10-01',
          notes: null,
        },
      ],
    ])
    render(
      <MemoryRouter>
        <WatchlistPage />
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(screen.getByText('Pedro Gómez')).toBeInTheDocument()
    })
    expect(screen.getByText('ALTA')).toBeInTheDocument()
    expect(screen.getByText('EN SEGUIMIENTO')).toBeInTheDocument()
  })

  it('permite agregar un jugador externo', async () => {
    mockFetchSequence([[], { id: 2 }, []])
    render(
      <MemoryRouter>
        <WatchlistPage />
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(screen.getByText(/Nadie en seguimiento/)).toBeInTheDocument()
    })
    const user = userEvent.setup()
    await user.type(screen.getByPlaceholderText(/Jugador externo/), 'Extremo libre 19 años')
    await user.click(screen.getByRole('button', { name: '+ Observar' }))

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledTimes(3)
    })
  })
})
