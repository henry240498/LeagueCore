import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthProvider } from '../context/AuthContext'
import LoginPage from './LoginPage'

function mockFetchSequence(responses: Array<{ status: number; body: unknown }>) {
  let call = 0
  globalThis.fetch = vi.fn(async () => {
    const r = responses[Math.min(call, responses.length - 1)]
    call += 1
    return {
      ok: r.status < 400,
      status: r.status,
      headers: { get: () => 'application/json' },
      json: async () => r.body,
    } as unknown as Response
  })
}

function renderLoginPage() {
  render(
    <MemoryRouter>
      <AuthProvider>
        <LoginPage />
      </AuthProvider>
    </MemoryRouter>,
  )
}

describe('LoginPage', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('renderiza el formulario de login', async () => {
    mockFetchSequence([{ status: 401, body: { message: 'No autenticado' } }])
    renderLoginPage()

    expect(screen.getByLabelText('Usuario')).toBeInTheDocument()
    expect(screen.getByLabelText('Contraseña')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Iniciar sesión' })).toBeInTheDocument()
  })

  it('muestra un error cuando las credenciales son incorrectas', async () => {
    mockFetchSequence([
      { status: 401, body: { message: 'No autenticado' } }, // /auth/me al montar
      { status: 401, body: { message: 'Usuario o contraseña incorrectos' } }, // /auth/login
    ])
    renderLoginPage()

    const user = userEvent.setup()
    await user.type(screen.getByLabelText('Usuario'), 'admin')
    await user.type(screen.getByLabelText('Contraseña'), 'incorrecta')
    await user.click(screen.getByRole('button', { name: 'Iniciar sesión' }))

    await waitFor(() => {
      expect(screen.getByText('Usuario o contraseña incorrectos')).toBeInTheDocument()
    })
  })
})
