import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ClubsListPage from './ClubsListPage'

function mockFetch(body: unknown) {
  globalThis.fetch = vi.fn(async () => {
    return {
      ok: true,
      status: 200,
      headers: { get: () => 'application/json' },
      json: async () => body,
    } as unknown as Response
  })
}

describe('ClubsListPage', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('renderiza la lista de clubes con sus contadores', async () => {
    mockFetch([
      {
        id: 1,
        name: 'Club Olimpia',
        shortName: 'OLI',
        country: 'Paraguay',
        city: 'Asunción',
        foundedYear: 1902,
        logoUrl: null,
        primaryColor: '#000000',
        secondaryColor: '#FFFFFF',
        history: null,
        status: 'active',
        teamsCount: 3,
        staffCount: 5,
        createdAt: '2026-01-01',
        updatedAt: null,
      },
    ])
    render(
      <MemoryRouter>
        <ClubsListPage />
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(screen.getByText('Club Olimpia')).toBeInTheDocument()
    })
    expect(screen.getByText('3')).toBeInTheDocument()
    expect(screen.getByText('5')).toBeInTheDocument()
  })

  it('muestra mensaje vacío cuando no hay clubes', async () => {
    mockFetch([])
    render(
      <MemoryRouter>
        <ClubsListPage />
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(screen.getByText('No hay clubes todavía.')).toBeInTheDocument()
    })
  })
})
