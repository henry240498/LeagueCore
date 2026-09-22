import { renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useMatchLive } from './useMatchLive'

// Mock de fetch POR URL (no por orden): el hook dispara 5 requests en paralelo con Promise.all,
// así que el orden de resolución no es determinista y emparejar por ruta es lo único estable.
function mockApi(routes: Record<string, unknown>, opts: { failMatch?: boolean } = {}) {
  globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
    const url =
      typeof input === 'string' ? input : input instanceof URL ? input.toString() : (input as Request).url

    // El endpoint principal del partido es el que decide "conectado": se puede hacer fallar.
    const isMainMatch = /\/matches\/\d+$/.test(url)
    if (isMainMatch && opts.failMatch) {
      return { ok: false, status: 500, headers: { get: () => 'application/json' }, json: async () => ({ message: 'boom' }) } as unknown as Response
    }

    const key = Object.keys(routes).find((path) => url.includes(path))
    const body = key ? routes[key] : isMainMatch ? routes['__match__'] : []
    return {
      ok: true,
      status: 200,
      headers: { get: () => 'application/json' },
      json: async () => body,
    } as unknown as Response
  }) as unknown as typeof fetch
}

const MATCH_LIVE = { id: 3, status: 'in_progress', homeTeamId: 1, awayTeamId: 2, periodScores: [] }
const MATCH_SCHEDULED = { ...MATCH_LIVE, status: 'scheduled' }

afterEach(() => {
  vi.restoreAllMocks()
})

describe('useMatchLive', () => {
  it('carga el partido y marca conexión y última actualización', async () => {
    mockApi({ '__match__': MATCH_LIVE, '/timeline': [], '/team-stats': [], '/lineups': [], '/officials': [] })
    const { result, unmount } = renderHook(() => useMatchLive(3))

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.match?.id).toBe(3)
    expect(result.current.connected).toBe(true)
    expect(result.current.lastUpdatedAt).toBeInstanceOf(Date)
    expect(result.current.error).toBe('')
    unmount()
  })

  it('deriva el minuto en vivo del último evento del timeline', async () => {
    mockApi({
      '__match__': MATCH_LIVE,
      '/timeline': [
        { type: 'goal', id: 1, minute: 23 },
        { type: 'card', id: 2, minute: 67 },
        { type: 'foul', id: 3, minute: 41 },
      ],
      '/team-stats': [],
      '/lineups': [],
      '/officials': [],
    })
    const { result, unmount } = renderHook(() => useMatchLive(3))

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.liveMinute).toBe(67)
    unmount()
  })

  it('no deriva minuto si el partido no está en vivo', async () => {
    mockApi({
      '__match__': MATCH_SCHEDULED,
      '/timeline': [{ type: 'goal', id: 1, minute: 23 }],
      '/team-stats': [],
      '/lineups': [],
      '/officials': [],
    })
    const { result, unmount } = renderHook(() => useMatchLive(3))

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.liveMinute).toBeNull()
    unmount()
  })

  it('marca desconexión cuando falla el partido, sin romper la vista', async () => {
    mockApi({ '__match__': MATCH_LIVE }, { failMatch: true })
    const { result, unmount } = renderHook(() => useMatchLive(3))

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.connected).toBe(false)
    expect(result.current.error).not.toBe('')
    // Nunca deja datos basura: sigue siendo null/[] en vez de undefined.
    expect(result.current.match).toBeNull()
    expect(result.current.timeline).toEqual([])
    unmount()
  })

  it('tolera que los endpoints secundarios fallen y aun así carga el partido', async () => {
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : (input as Request).url
      if (/\/matches\/\d+$/.test(url)) {
        return { ok: true, status: 200, headers: { get: () => 'application/json' }, json: async () => MATCH_LIVE } as unknown as Response
      }
      return { ok: false, status: 500, headers: { get: () => 'application/json' }, json: async () => ({ message: 'x' }) } as unknown as Response
    }) as unknown as typeof fetch

    const { result, unmount } = renderHook(() => useMatchLive(3))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.match?.id).toBe(3)
    expect(result.current.connected).toBe(true)
    expect(result.current.lineups).toEqual([])
    unmount()
  })
})
