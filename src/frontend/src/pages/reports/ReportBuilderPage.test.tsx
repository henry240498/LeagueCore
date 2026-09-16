import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ReportBuilderPage from './ReportBuilderPage'

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

describe('ReportBuilderPage', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('lista plantillas y genera un informe en markdown', async () => {
    mockFetchSequence([
      [{ id: 1, name: 'Informe de partido', entity: 'MATCH', sections: ['RESULTADO', 'GOLES'] }],
      [],
      [],
      [],
      { title: 'Informe de partido', markdown: '# Informe de partido\n\n## RESULTADO\n\nResultado: 2 - 1' },
    ])
    render(
      <MemoryRouter>
        <ReportBuilderPage />
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(screen.getByText('Informe de partido')).toBeInTheDocument()
    })

    const user = userEvent.setup()
    const selects = screen.getAllByRole('combobox')
    await user.selectOptions(selects[1], '1')
    await user.click(screen.getByRole('button', { name: 'Generar' }))

    await waitFor(() => {
      expect(screen.getByText(/Resultado: 2 - 1/)).toBeInTheDocument()
    })
    expect(screen.getByText(/Descargar .md/)).toBeInTheDocument()
  })
})
