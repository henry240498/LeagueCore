import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ApiError } from '../../context/AuthContext'
import { api } from '../../services/api'
import { tacticsService } from '../../services/tactics'
import type { Match, MatchLineupEntry, TimelineEvent } from '../../types/match'

function describeEvent(e: TimelineEvent): string {
  switch (e.type) {
    case 'goal':
      return `⚽ Gol ${e.playerName ?? ''}${e.teamName ? ` (${e.teamName})` : ''}`
    case 'card':
      return `🟨/🟥 ${e.playerName ?? ''} (${e.cardType ?? ''})`
    case 'substitution':
      return `🔄 ${e.playerOutName ?? '?'} → ${e.playerInName ?? '?'}`
    case 'foul':
      return `🚩 Falta ${e.playerName ?? ''}`
    case 'offside':
      return `🚩 Offside ${e.playerName ?? ''}`
    case 'interruption':
      return `⏸️ ${e.interruptionType ?? 'Interrupción'}`
    default:
      return e.type
  }
}

// Modo partido en vivo: botones grandes para el estadístico en cancha/tablet, marcador que se
// actualiza por polling (todos los dispositivos ven lo mismo porque comparten la base).
export default function LiveMatchPage() {
  const { id } = useParams()
  const matchId = Number(id)
  const navigate = useNavigate()
  const [match, setMatch] = useState<Match | null>(null)
  const [lineups, setLineups] = useState<MatchLineupEntry[]>([])
  const [timeline, setTimeline] = useState<TimelineEvent[]>([])
  const [error, setError] = useState('')
  const [minute, setMinute] = useState('0')
  const [teamId, setTeamId] = useState('')
  const [playerId, setPlayerId] = useState('')
  const [playerInId, setPlayerInId] = useState('')
  const [lastAction, setLastAction] = useState('')

  const load = useCallback(() => {
    api
      .get<Match>(`/matches/${matchId}`)
      .then((m) => {
        setMatch(m)
        setTeamId((prev) => prev || String(m.homeTeamId))
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Error al cargar'))
    api.get<MatchLineupEntry[]>(`/matches/${matchId}/lineups`).then(setLineups).catch(() => {})
    api.get<TimelineEvent[]>(`/matches/${matchId}/timeline`).then(setTimeline).catch(() => {})
  }, [matchId])

  useEffect(() => {
    load()
    const timer = setInterval(load, 10000)
    return () => clearInterval(timer)
  }, [load])

  const fail = (err: unknown, what: string) => {
    const msg = err instanceof ApiError ? err.message : `Error al registrar ${what}`
    setError(msg)
    setTimeout(() => setError(''), 4000)
  }

  const ok = (what: string) => {
    setLastAction(`✅ ${what}`)
    setTimeout(() => setLastAction(''), 3000)
    load()
  }

  const base = () => ({
    teamId: Number(teamId),
    minute: minute ? Number(minute) : undefined,
    period: Number(minute) > 45 ? 'second_half' : 'first_half',
  })

  const logGoal = async () => {
    if (!teamId || !playerId) return setError('Elegí equipo y jugador.')
    try {
      await api.post(`/matches/${matchId}/goals`, { ...base(), playerId: Number(playerId) })
      ok('Gol')
    } catch (err) {
      fail(err, 'el gol')
    }
  }

  const logShot = async (outcome: string) => {
    if (!teamId || !playerId) return setError('Elegí equipo y jugador.')
    try {
      // Tiro rápido al centro del área rival (el analista lo reubica después en Táctica avanzada)
      await api.post(`/matches/${matchId}/shots`, { ...base(), playerId: Number(playerId), posX: 50, posY: 85, outcome })
      ok('Tiro')
    } catch (err) {
      fail(err, 'el tiro')
    }
  }

  const logFoul = async () => {
    if (!teamId) return setError('Elegí equipo.')
    try {
      await api.post(`/matches/${matchId}/fouls`, { ...base(), playerId: playerId ? Number(playerId) : undefined })
      ok('Falta')
    } catch (err) {
      fail(err, 'la falta')
    }
  }

  const logCard = async (cardType: string) => {
    if (!teamId || !playerId) return setError('Elegí equipo y jugador.')
    try {
      await api.post(`/matches/${matchId}/cards`, { ...base(), playerId: Number(playerId), cardType })
      ok('Tarjeta')
    } catch (err) {
      fail(err, 'la tarjeta')
    }
  }

  const logCorner = async () => {
    if (!teamId) return setError('Elegí equipo.')
    try {
      await tacticsService.createSetPiece(matchId, { teamId: Number(teamId), kind: 'CORNER', minute: minute ? Number(minute) : undefined })
      ok('Córner')
    } catch (err) {
      fail(err, 'el córner')
    }
  }

  const logSub = async () => {
    if (!teamId || !playerId || !playerInId) return setError('Elegí equipo, sale y entra.')
    try {
      await api.post(`/matches/${matchId}/substitutions`, {
        ...base(),
        playerOutId: Number(playerId),
        playerInId: Number(playerInId),
      })
      ok('Cambio')
    } catch (err) {
      fail(err, 'el cambio')
    }
  }

  if (!match) return <p className="p-8 text-center text-slate-500">Cargando modo live…</p>

  const teamPlayers = lineups.filter((l) => l.teamId === Number(teamId))
  const bigBtn =
    'rounded-2xl px-4 py-6 text-lg font-bold text-white shadow transition active:scale-95 disabled:opacity-40'

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6">
      <button type="button" onClick={() => navigate(`/partidos/${matchId}`)} className="mb-3 text-sm text-slate-600 hover:underline">
        ← Salir del modo live
      </button>

      <div className="mb-4 rounded-2xl bg-slate-900 p-4 text-center text-white">
        <p className="text-sm opacity-70">
          {match.homeTeamName} vs {match.awayTeamName} · se actualiza cada 10 s
        </p>
        <p className="my-1 text-5xl font-bold tabular-nums">
          {timeline.filter((e) => e.type === 'goal' && e.teamId === match.homeTeamId).length}
          {' - '}
          {timeline.filter((e) => e.type === 'goal' && e.teamId === match.awayTeamId).length}
        </p>
        <div className="mx-auto flex max-w-xs items-center gap-2">
          <label className="text-sm opacity-70">Min</label>
          <input
            type="number"
            value={minute}
            onChange={(e) => setMinute(e.target.value)}
            className="w-full rounded-lg bg-slate-800 px-3 py-2 text-center text-2xl font-bold tabular-nums focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {error && (
        <div className="mb-3 rounded-lg border border-red-400 bg-red-100 px-4 py-2 text-sm text-red-700">{error}</div>
      )}
      {lastAction && (
        <div className="mb-3 rounded-lg border border-green-400 bg-green-100 px-4 py-2 text-center text-sm text-green-700">
          {lastAction}
        </div>
      )}

      <div className="mb-3 grid grid-cols-2 gap-2">
        <select value={teamId} onChange={(e) => { setTeamId(e.target.value); setPlayerId(''); setPlayerInId('') }} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm">
          <option value={match.homeTeamId}>{match.homeTeamName} (L)</option>
          <option value={match.awayTeamId}>{match.awayTeamName} (V)</option>
        </select>
        <select value={playerId} onChange={(e) => setPlayerId(e.target.value)} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm">
          <option value="">Jugador…</option>
          {teamPlayers.map((l) => (
            <option key={l.id} value={l.playerId}>
              {l.shirtNumber ? `${l.shirtNumber} · ` : ''}{l.playerFullName}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <button type="button" onClick={logGoal} className={`${bigBtn} bg-green-600 hover:bg-green-700`}>
          ⚽ GOL
        </button>
        <button type="button" onClick={() => logShot('off_target')} className={`${bigBtn} bg-blue-600 hover:bg-blue-700`}>
          🎯 TIRO
        </button>
        <button type="button" onClick={logFoul} className={`${bigBtn} bg-amber-600 hover:bg-amber-700`}>
          🚩 FALTA
        </button>
        <button type="button" onClick={() => logCard('yellow')} className={`${bigBtn} bg-yellow-500 hover:bg-yellow-600`}>
          🟨 AMARILLA
        </button>
        <button type="button" onClick={() => logCard('red')} className={`${bigBtn} bg-red-600 hover:bg-red-700`}>
          🟥 ROJA
        </button>
        <button type="button" onClick={logCorner} className={`${bigBtn} bg-purple-600 hover:bg-purple-700`}>
          🚩 CÓRNER
        </button>
      </div>

      <div className="mt-3 flex gap-2 rounded-2xl bg-white p-3 shadow">
        <select value={playerInId} onChange={(e) => setPlayerInId(e.target.value)} className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" aria-label="Jugador que entra">
          <option value="">Entra…</option>
          {teamPlayers.filter((l) => String(l.playerId) !== playerId).map((l) => (
            <option key={l.id} value={l.playerId}>
              {l.shirtNumber ? `${l.shirtNumber} · ` : ''}{l.playerFullName}
            </option>
          ))}
        </select>
        <button type="button" onClick={logSub} className="rounded-xl bg-slate-800 px-4 py-2 font-bold text-white hover:bg-slate-900">
          🔄 CAMBIO
        </button>
      </div>

      <div className="mt-4 rounded-2xl bg-white p-4 shadow">
        <h2 className="mb-2 font-bold">Timeline en vivo ({timeline.length})</h2>
        <ul className="max-h-64 divide-y divide-slate-100 overflow-y-auto text-sm">
          {[...timeline].reverse().map((e, i) => (
            <li key={i} className="py-1.5">
              <strong>{e.minute ?? '?'}′</strong> · {describeEvent(e)}
            </li>
          ))}
        </ul>
        {timeline.length === 0 && <p className="text-sm text-slate-500">Sin eventos todavía.</p>}
      </div>
    </div>
  )
}
