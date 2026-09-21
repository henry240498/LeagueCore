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

describe('MatchVideoTab', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('lista videos y muestra el sync evento-video', async () => {
    // listVideos, listTags, listMarkers, listClips, getSync
    mockFetchSequence([VIDEOS, [], [], [], SYNC])
    render(<MatchVideoTab match={MATCH} onError={() => {}} />)

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Partido completo' })).toBeInTheDocument()
    })
    await waitFor(() => {
      expect(screen.getByText(/Recuperación/)).toBeInTheDocument()
    })
    expect(screen.getByText('37:42')).toBeInTheDocument()
  })

  it('ofrece agregar video cuando no hay ninguno', async () => {
    mockFetchSequence([[], []])
    render(<MatchVideoTab match={MATCH} onError={() => {}} />)

    await waitFor(() => {
      expect(screen.getByText(/Sin videos/)).toBeInTheDocument()
    })
  })
})
