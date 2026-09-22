import { render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import ErrorBoundary from './ErrorBoundary'

function Boom(): never {
  throw new Error('fallo de render')
}

describe('ErrorBoundary', () => {
  // React escribe el error en consola aunque el boundary lo capture: se silencia para no ensuciar.
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('muestra el contenido normal cuando no hay error', () => {
    render(
      <ErrorBoundary>
        <p>contenido ok</p>
      </ErrorBoundary>,
    )
    expect(screen.getByText('contenido ok')).toBeInTheDocument()
  })

  it('captura un error de render y muestra una salida en vez de pantalla en blanco', () => {
    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>,
    )
    expect(screen.getByText('Algo salió mal en esta pantalla')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Volver al inicio' })).toBeInTheDocument()
  })
})
