import { render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import MatchVideoTab from './MatchVideoTab'
import type { Match } from '../../types/match'

const MATCH = {
  id: 10,
  homeTeamId: 1,
  homeTeamName: 'Olimpia',
  awayTeamId: 2,
  awayTeamName: 'Cerro Porteño',
} as Match

const VIDEOS = [
  {
    id: 1,
    matchId: 10,
    title: 'Partido completo',
    kind: 'PARTIDO_COMPLETO',
    videoUrl: null,
    durationSeconds: null,
    offsetSeconds: 0,
    recordedAt: null,
    markersCount: 1,
    clipsCount: 0,
  },
]

const SYNC = {
  video: VIDEOS[0],
  items: [
    { timeSeconds: 2262, timestamp: '37:42', kind: 'custom', label: '🏷️ Recuperación', ref: 'custom:3' },
    { timeSeconds: 872, timestamp: '14:32', kind: 'shot', label: '🎯 Tiro Juan Pérez', ref: 'shot:5' },
  ],
}

/**
 * Mock de fetch POR URL (no por orden de llamada).
 *
 * La pestaña dispara videos/tags/markers/clips/sync desde efectos distintos, con orden no
 * determinista: emparejar por posición hacía que el sync cayera en otro request y el test fallara
 * de forma intermitente (~50% de las corridas). Las rutas se prueban de la más específica a la
 * más general, porque `/video/videos/1/markers` también contiene `/video/videos`.
 */
function mockFetchByUrl(routes: Array<[string, unknown]>) {
  globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
    const url =
      typeof input === 'string' ? input : input instanceof URL ? input.toString() : (input as Request).url
    const hit = routes.find(([path]) => url.includes(path))
    return {
      ok: true,
      status: 200,
      headers: { get: () => 'application/json' },
      json: async () => (hit ? hit[1] : []),
    } as unknown as Response
  }) as unknown as typeof fetch
}

describe('MatchVideoTab', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('lista videos y muestra el sync evento-video', async () => {
    mockFetchByUrl([
      ['/sync', SYNC],
      ['/markers', []],
      ['/clips', []],
      ['/video/tags', []],
      ['/video/videos', VIDEOS],
    ])
    render(<MatchVideoTab match={MATCH} onError={() => {}} />)

    // El sync llega recién tras una cadena de async (listar videos → seleccionar → pedir sync).
    // Con la suite completa en paralelo esa cadena supera el timeout por defecto de waitFor (1s),
    // así que se le da margen explícito en vez de depender de la carga de la máquina.
    await waitFor(
      () => {
        expect(screen.getByRole('heading', { name: 'Partido completo' })).toBeInTheDocument()
      },
      { timeout: 5000 },
    )
    await waitFor(
      () => {
        expect(screen.getByText(/Recuperación/)).toBeInTheDocument()
      },
      { timeout: 5000 },
    )
    expect(screen.getByText('37:42')).toBeInTheDocument()
  })

  it('ofrece agregar video cuando no hay ninguno', async () => {
    mockFetchByUrl([
      ['/video/tags', []],
      ['/video/videos', []],
    ])
    render(<MatchVideoTab match={MATCH} onError={() => {}} />)

    await waitFor(() => {
      expect(screen.getByText(/Sin videos/)).toBeInTheDocument()
    })
  })
})
