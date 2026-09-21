import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import DevCredentialsPanel from './DevCredentialsPanel'

const CREDENTIALS = [{ label: 'Administrador', username: 'admin', password: '123456', role: 'admin' }]

function mockBackend(status = 200, body: unknown = CREDENTIALS) {
  globalThis.fetch = vi.fn(async () => ({
    ok: status >= 200 && status < 300,
    status,
    headers: { get: () => 'application/json' },
    json: async () => body,
  })) as unknown as typeof fetch
}

/** Devuelve `false` si algún listener llamó a preventDefault (patrón de fireEvent). */
const keyDown = (init: KeyboardEventInit) => fireEvent.keyDown(window, init)
const keyUp = (init: KeyboardEventInit) => fireEvent.keyUp(window, init)

const L = { code: 'KeyL', key: 'l', ctrlKey: true }
const NINE = { code: 'Digit9', key: '9', ctrlKey: true }

const panelTitle = () => screen.queryByText(/Credenciales de prueba/)

describe('DevCredentialsPanel – atajo Ctrl+L+9', () => {
  beforeEach(() => mockBackend())
  afterEach(() => vi.restoreAllMocks())

  it('no se muestra hasta que se usa el atajo', () => {
    render(<DevCredentialsPanel />)
    expect(panelTitle()).toBeNull()
  })

  it('Ctrl+L y luego 9 muestra las credenciales, y repetirlo las oculta', async () => {
    render(<DevCredentialsPanel />)

    keyDown(L)
    keyUp({ code: 'KeyL', key: 'l' })
    keyDown(NINE)
    await waitFor(() => expect(panelTitle()).toBeInTheDocument())
    expect(await screen.findByText(/admin \/ 123456/)).toBeInTheDocument()

    keyUp({ code: 'Digit9', key: '9' })
    keyDown(L)
    keyDown(NINE)
    await waitFor(() => expect(panelTitle()).toBeNull())
  })

  it('funciona con L y 9 mantenidas a la vez', async () => {
    render(<DevCredentialsPanel />)
    keyDown(L) // L queda mantenida
    keyDown(NINE)
    await waitFor(() => expect(panelTitle()).toBeInTheDocument())
  })

  it('cancela la acción del navegador de Ctrl+L (enfocar la barra de direcciones)', () => {
    render(<DevCredentialsPanel />)
    const notPrevented = keyDown(L)
    expect(notPrevented).toBe(false)
  })

  it('Ctrl+9 solo, sin la L, no hace nada', () => {
    render(<DevCredentialsPanel />)
    keyDown(NINE)
    expect(panelTitle()).toBeNull()
  })

  it('el 9 tarde (fuera de la ventana) no cuenta como parte del atajo', () => {
    vi.useFakeTimers()
    try {
      render(<DevCredentialsPanel />)
      keyDown(L)
      keyUp({ code: 'KeyL', key: 'l' })
      vi.advanceTimersByTime(2000)
      keyDown(NINE)
      expect(panelTitle()).toBeNull()
    } finally {
      vi.useRealTimers()
    }
  })

  it('un 9 sin Ctrl, aunque se haya pulsado la L, no lo abre', () => {
    render(<DevCredentialsPanel />)
    keyDown(L)
    keyUp({ code: 'KeyL', key: 'l' })
    keyDown({ code: 'Digit9', key: '9', ctrlKey: false })
    expect(panelTitle()).toBeNull()
  })

  it('Escape lo cierra', async () => {
    render(<DevCredentialsPanel />)
    keyDown(L)
    keyDown(NINE)
    await waitFor(() => expect(panelTitle()).toBeInTheDocument())
    fireEvent.keyDown(window, { key: 'Escape' })
    await waitFor(() => expect(panelTitle()).toBeNull())
  })

  it('"Usar" autocompleta usuario y contraseña y cierra el panel', async () => {
    const onPick = vi.fn()
    render(<DevCredentialsPanel onPick={onPick} />)
    keyDown(L)
    keyDown(NINE)
    fireEvent.click(await screen.findByRole('button', { name: 'Usar' }))
    expect(onPick).toHaveBeenCalledWith('admin', '123456')
    await waitFor(() => expect(panelTitle()).toBeNull())
  })

  it('si el backend responde 404 (acceso remoto), explica por qué no hay credenciales', async () => {
    mockBackend(404, { message: 'Not Found' })
    render(<DevCredentialsPanel />)
    keyDown(L)
    keyDown(NINE)
    expect(await screen.findByText(/solo se muestran al usar el sistema desde este equipo/i)).toBeInTheDocument()
    expect(screen.queryByText(/admin \/ 123456/)).toBeNull()
  })
})
