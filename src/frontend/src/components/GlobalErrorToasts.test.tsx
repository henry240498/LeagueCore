import { render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import GlobalErrorToasts from './GlobalErrorToasts'
import { api } from '../services/api'

afterEach(() => {
  vi.restoreAllMocks()
})

function mockFetch(impl: () => Promise<Response>) {
  globalThis.fetch = vi.fn(impl) as unknown as typeof fetch
}

describe('GlobalErrorToasts', () => {
  it('no muestra nada mientras no falle ninguna petición', () => {
    const { container } = render(<GlobalErrorToasts />)
    expect(container).toBeEmptyDOMElement()
  })

  it('avisa cuando la API no responde (fallo de red)', async () => {
    render(<GlobalErrorToasts />)
    mockFetch(async () => {
      throw new TypeError('Failed to fetch')
    })

    await expect(api.get('/cualquiera')).rejects.toThrow()
    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument()
    })
    expect(screen.getByText(/No se pudo conectar con el servidor/)).toBeInTheDocument()
  })

  it('avisa ante un error 5xx del servidor', async () => {
    render(<GlobalErrorToasts />)
    mockFetch(
      async () =>
        ({
          ok: false,
          status: 500,
          headers: { get: () => 'application/json' },
          json: async () => ({ message: 'boom' }),
        }) as unknown as Response,
    )

    await expect(api.get('/cualquiera')).rejects.toThrow()
    await waitFor(() => {
      expect(screen.getByText(/El servidor respondió con un error \(500\)/)).toBeInTheDocument()
    })
  })

  it('NO avisa ante un 4xx (es una respuesta esperada del negocio)', async () => {
    render(<GlobalErrorToasts />)
    mockFetch(
      async () =>
        ({
          ok: false,
          status: 400,
          headers: { get: () => 'application/json' },
          json: async () => ({ message: 'falta el nombre' }),
        }) as unknown as Response,
    )

    await expect(api.get('/cualquiera')).rejects.toThrow()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('agrupa el mismo fallo repetido en vez de apilar avisos', async () => {
    render(<GlobalErrorToasts />)
    mockFetch(async () => {
      throw new TypeError('Failed to fetch')
    })

    await expect(api.get('/a')).rejects.toThrow()
    await expect(api.get('/b')).rejects.toThrow()

    await waitFor(() => {
      expect(screen.getByText(/Ocurrió 2 veces/)).toBeInTheDocument()
    })
    expect(screen.getAllByRole('alert')).toHaveLength(1)
  })
})
