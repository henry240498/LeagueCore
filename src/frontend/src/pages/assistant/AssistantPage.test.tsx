import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import AssistantPage from './AssistantPage'

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

describe('AssistantPage', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('responde una pregunta con datos', async () => {
    mockFetchSequence([
      [],
      [],
      { intent: 'lesionados', answer: 'Sin lesionados registrados. ✅', sources: [] },
    ])
    render(
      <MemoryRouter>
        <AssistantPage />
      </MemoryRouter>,
    )

    const user = userEvent.setup()
    await user.type(screen.getByPlaceholderText(/¿Por qué perdimos/), '¿Quiénes están lesionados?')
    await user.click(screen.getByRole('button', { name: 'Preguntar' }))

    await waitFor(() => {
      expect(screen.getByText(/Sin lesionados/)).toBeInTheDocument()
    })
  })

  it('ofrece ejemplos clicables', async () => {
    mockFetchSequence([[], []])
    render(
      <MemoryRouter>
        <AssistantPage />
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(screen.getByText('¿Por qué perdimos el partido?')).toBeInTheDocument()
    })
  })
})
