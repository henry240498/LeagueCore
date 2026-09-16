import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import PlaysLibraryPage from './PlaysLibraryPage'

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

describe('PlaysLibraryPage', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('lista las jugadas con su código y contador de uso', async () => {
    mockFetch([
      {
        id: 1,
        code: 'CORNER-001',
        category: 'CORNER',
        title: 'Primer palo',
        description: null,
        diagramJson: null,
        videoUrl: null,
        rival: null,
        result: null,
        usageCount: 3,
      },
    ])
    render(
      <MemoryRouter>
        <PlaysLibraryPage />
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(screen.getByText('CORNER-001')).toBeInTheDocument()
    })
    expect(screen.getByText('Primer palo')).toBeInTheDocument()
    expect(screen.getByText(/usada 3 veces/)).toBeInTheDocument()
  })

  it('muestra estado vacío sin jugadas', async () => {
    mockFetch([])
    render(
      <MemoryRouter>
        <PlaysLibraryPage />
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(screen.getByText(/Sin jugadas/)).toBeInTheDocument()
    })
  })
})
