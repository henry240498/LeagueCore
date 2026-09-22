import { lazy, Suspense, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ApiError } from '../../context/AuthContext'
import { api } from '../../services/api'
import MatchScoreboardHeader from '../../components/pitch/MatchScoreboardHeader'
import { useMatchLive } from '../../hooks/useMatchLive'
// TacticalViewTab NO se carga con lazy: el reporte de partido lo importa de forma estática, así que
// separarlo en un chunk aparte sería inefectivo (quedaría igual en el bundle principal).
import TacticalViewTab from './TacticalViewTab'
import type { Official } from '../../types/official'
import type { Player } from '../../types/player'
import {
  CARD_TYPE_LABELS,
  COACH_ROLE_LABELS,
  COACH_ROLES,
  EVENT_PERIODS,
  EVENT_PERIOD_LABELS,
  GOAL_TYPE_LABELS,
  GOAL_TYPES,
  INTERRUPTION_TYPE_LABELS,
  INTERRUPTION_TYPES,
  MATCH_OFFICIAL_ROLE_LABELS,
  MATCH_OFFICIAL_ROLES,
  RESULT_PERIOD_LABELS,
  RESULT_PERIODS,
} from '../../types/match'
import type {
  Coach,
  Match,
  MatchCoachEntry,
  MatchHistoryEntry,
  MatchLineupEntry,
  MatchOfficialEntry,
  MatchTeamStats,
  ShootoutKick,
  TimelineEvent,
} from '../../types/match'

// FASE 15 — code-splitting: las pestañas pesadas se cargan bajo demanda (chunks separados),
// reduciendo el bundle inicial. Se envuelven en <Suspense> al renderizarlas.
const MatchCenterTab = lazy(() => import('./MatchCenterTab'))
const MatchTacticsTab = lazy(() => import('./MatchTacticsTab'))
const MatchVideoTab = lazy(() => import('./MatchVideoTab'))

type Tab =
  | 'center'
  | 'tactical'
  | 'advanced'
  | 'video'
  | 'info'
  | 'teams'
  | 'officials'
  | 'result'
  | 'events'
  | 'stats'
  | 'players'
  | 'history'

// "Análisis" (ex vista táctica) es ahora la experiencia de CONSULTA principal -- primera pestaña,
// pestaña por defecto al entrar al partido (pedido explícito: "quiero que la pantalla principal sea
// una experiencia de análisis", no una tabla). El resto sigue siendo administración/CRUD tradicional,
// tal como pidió explícitamente que se conservara.
const TABS: { key: Tab; label: string }[] = [
  { key: 'center', label: '🎯 Centro' },
  { key: 'tactical', label: '📊 Análisis' },
  { key: 'advanced', label: '📐 Táctica avanzada' },
  { key: 'video', label: '🎬 Video' },
  { key: 'info', label: 'Información general' },
  { key: 'teams', label: 'Equipos y cuerpo técnico' },
  { key: 'officials', label: 'Arbitraje' },
  { key: 'result', label: 'Resultado' },
  { key: 'events', label: 'Eventos (administrar)' },
  { key: 'stats', label: 'Estadísticas (cargar)' },
  { key: 'players', label: 'Jugadores (alineación)' },
  { key: 'history', label: 'Historial' },
]

export default function MatchDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const matchId = Number(id)
  // FASE 3 — tiempo real centralizado: alimenta la cabecera (árbitro/VAR, minuto en vivo) y el
  // Match Center, reutilizando el polling contra los endpoints existentes.
  const live = useMatchLive(matchId)
  const match = live.match
  const officials = live.officials
  const load = live.refresh
  const [tab, setTab] = useState<Tab>('center')
  const [error, setError] = useState('')

  const handleDelete = async () => {
    if (!match) return
    if (
      !window.confirm(
        `¿Desea eliminar este partido?\n\n${match.homeTeamName} vs ${match.awayTeamName}\n\nEsta acción puede afectar información relacionada.`,
      )
    ) {
      return
    }
    try {
      await api.delete(`/matches/${match.id}`)
      navigate('/partidos')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Error al eliminar')
    }
  }

  if (!match && (error || live.error))
    return <p className="p-8 text-center text-red-600">{error || live.error}</p>
  if (!match) return <p className="p-8 text-center text-slate-500">Cargando...</p>

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <div className="mb-6">
        <MatchScoreboardHeader
          match={match}
          officials={officials}
          liveMinute={live.liveMinute}
          context={
            <span>
              <button
                type="button"
                onClick={() => navigate(`/competiciones/${match.competitionId}`)}
                className="text-white hover:underline"
              >
                {match.competitionName}
              </button>
              {match.seasonLabel && (
                <>
                  {' · '}
                  <button
                    type="button"
                    onClick={() => navigate(`/temporadas/${match.seasonId}`)}
                    className="text-white hover:underline"
                  >
                    {match.seasonLabel}
                  </button>
                </>
              )}
              {match.round ? ` · ${match.round}` : ''}
              {match.phase ? ` · ${match.phase}` : ''}
            </span>
          }
          actions={
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => navigate(`/partidos/${match.id}/live`)}
                className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700"
                title="Modo carga en vivo (para el estadístico en cancha)"
              >
                🔴 Modo carga
              </button>
              <button
                type="button"
                onClick={() => navigate(`/asistente`)}
                className="rounded-lg bg-white/10 px-3 py-1.5 text-xs font-medium text-white hover:bg-white/20"
                title="Preguntarle al asistente por este partido"
              >
                🤖 IA
              </button>
              <button
                type="button"
                onClick={() => navigate(`/partidos/${match.id}/editar`)}
                className="rounded-lg bg-white/10 px-3 py-1.5 text-xs font-medium text-white hover:bg-white/20"
              >
                Editar
              </button>
              <button
                type="button"
                onClick={handleDelete}
                className="rounded-lg bg-white/10 px-3 py-1.5 text-xs font-medium text-red-200 hover:bg-red-500/30"
              >
                Eliminar
              </button>
            </div>
          }
        />
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-400 bg-red-100 px-4 py-3 text-red-700">{error}</div>
      )}

      <div className="mb-6 flex gap-2 overflow-x-auto border-b border-slate-200">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium ${
              tab === t.key ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <Suspense fallback={<p className="p-8 text-center text-slate-500">Cargando sección…</p>}>
        {tab === 'center' && <MatchCenterTab match={match} live={live} onError={setError} />}
        {tab === 'info' && <InfoTab match={match} />}
        {tab === 'teams' && <TeamsCoachesTab match={match} onError={setError} />}
        {tab === 'officials' && <OfficialsTab matchId={matchId} onError={setError} />}
        {tab === 'result' && <ResultTab match={match} onReload={load} onError={setError} />}
        {tab === 'events' && <EventsTab match={match} onError={setError} />}
        {tab === 'stats' && <StatsTab match={match} onError={setError} />}
        {tab === 'players' && <PlayersTab match={match} onError={setError} />}
        {tab === 'tactical' && <TacticalViewTab match={match} onError={setError} />}
        {tab === 'advanced' && <MatchTacticsTab match={match} onError={setError} />}
        {tab === 'video' && <MatchVideoTab match={match} onError={setError} />}
        {tab === 'history' && <HistoryTab matchId={matchId} />}
      </Suspense>
    </div>
  )
}

function Card({ title, children, action }: { title?: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="rounded-lg bg-white p-6 shadow">
      {title && (
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">{title}</h2>
          {action}
        </div>
      )}
      {children}
    </div>
  )
}

function InfoField({ label, value }: { label: string; value?: string | number | null }) {
  return (
    <div>
      <dt className="text-sm text-slate-500">{label}</dt>
      <dd className="font-medium text-slate-900">{value ?? '—'}</dd>
    </div>
  )
}

// ---------------------------------------------------------------------------------
function InfoTab({ match: m }: { match: Match }) {
  return (
    <Card title="Información general">
      <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <InfoField label="Competición" value={m.competitionName} />
        <InfoField label="Temporada" value={m.seasonLabel} />
        <InfoField label="Estadio" value={m.venueName} />
        <InfoField label="Asistencia" value={m.attendance?.toLocaleString('es-PY')} />
        <InfoField label="Jornada / ronda" value={m.round} />
        <InfoField label="Fase" value={m.phase} />
        <InfoField label="Grupo" value={m.groupName} />
        <InfoField label="Ida/Vuelta" value={m.leg === 'ida' ? 'Ida' : m.leg === 'vuelta' ? 'Vuelta' : null} />
        <InfoField label="Clima" value={m.weatherCondition} />
        <InfoField label="Temperatura" value={m.temperatureCelsius != null ? `${m.temperatureCelsius}°C` : null} />
        <InfoField label="Estado del césped" value={m.pitchCondition} />
      </dl>
      {m.comments && (
        <div className="mt-4">
          <p className="text-sm text-slate-500">Observaciones</p>
          <p className="text-slate-900">{m.comments}</p>
        </div>
      )}
    </Card>
  )
}

// ---------------------------------------------------------------------------------
function TeamsCoachesTab({ match, onError }: { match: Match; onError: (m: string) => void }) {
  const [coaches, setCoaches] = useState<MatchCoachEntry[] | null>(null)
  const [coachSearch, setCoachSearch] = useState('')
  const [coachOptions, setCoachOptions] = useState<Coach[]>([])
  const [newCoachTeamId, setNewCoachTeamId] = useState(match.homeTeamId)
  const [newCoachId, setNewCoachId] = useState('')
  const [newCoachRole, setNewCoachRole] = useState('head_coach')
  const [newCoachName, setNewCoachName] = useState('')

  const load = () => {
    api.get<MatchCoachEntry[]>(`/matches/${match.id}/coaches`).then(setCoaches).catch(() => setCoaches([]))
  }
  useEffect(load, [match.id])

  useEffect(() => {
    if (coachSearch.trim().length < 2) {
      setCoachOptions([])
      return
    }
    const t = setTimeout(() => {
      api.get<Coach[]>(`/coaches?search=${encodeURIComponent(coachSearch)}`).then(setCoachOptions).catch(() => {})
    }, 300)
    return () => clearTimeout(t)
  }, [coachSearch])

  const handleAddExisting = async () => {
    if (!newCoachId) return
    try {
      await api.post(`/matches/${match.id}/coaches`, { teamId: newCoachTeamId, coachId: Number(newCoachId), role: newCoachRole })
      setNewCoachId('')
      setCoachSearch('')
      load()
    } catch (err) {
      onError(err instanceof ApiError ? err.message : 'Error al agregar el entrenador')
    }
  }

  const handleCreateAndAdd = async () => {
    const [firstName, ...rest] = newCoachName.trim().split(' ')
    if (!firstName || rest.length === 0) {
      onError('Ingresá nombre y apellido del entrenador')
      return
    }
    try {
      const coach = await api.post<Coach>('/coaches', { firstName, lastName: rest.join(' ') })
      await api.post(`/matches/${match.id}/coaches`, { teamId: newCoachTeamId, coachId: coach.id, role: newCoachRole })
      setNewCoachName('')
      load()
    } catch (err) {
      onError(err instanceof ApiError ? err.message : 'Error al crear el entrenador')
    }
  }

  const handleRemove = async (matchCoachId: number) => {
    try {
      await api.delete(`/matches/${match.id}/coaches/${matchCoachId}`)
      load()
    } catch (err) {
      onError(err instanceof ApiError ? err.message : 'Error al quitar el entrenador')
    }
  }

  return (
    <div className="space-y-6">
      <Card title="Equipos">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <InfoField label="Local" value={match.homeTeamName} />
          <InfoField label="Visitante" value={match.awayTeamName} />
        </div>
      </Card>

      <Card title="Cuerpo técnico">
        {!coaches && <p className="text-slate-500">Cargando...</p>}
        {coaches?.length === 0 && <p className="mb-4 text-slate-500">Todavía no hay entrenadores registrados.</p>}
        {coaches && coaches.length > 0 && (
          <ul className="mb-4 divide-y divide-slate-100">
            {coaches.map((c) => (
              <li key={c.id} className="flex items-center justify-between py-2">
                <span>
                  <span className="font-medium text-slate-900">{c.coachFullName}</span>
                  <span className="ml-2 text-sm text-slate-500">
                    {c.teamName} · {COACH_ROLE_LABELS[c.role] ?? c.role}
                  </span>
                </span>
                <button type="button" onClick={() => handleRemove(c.id)} className="text-sm text-red-600 hover:underline">
                  Quitar
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="space-y-2 rounded-lg border border-slate-200 p-3">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <select
              value={newCoachTeamId}
              onChange={(e) => setNewCoachTeamId(Number(e.target.value))}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
            >
              <option value={match.homeTeamId}>{match.homeTeamName}</option>
              <option value={match.awayTeamId}>{match.awayTeamName}</option>
            </select>
            <select
              value={newCoachRole}
              onChange={(e) => setNewCoachRole(e.target.value)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
            >
              {COACH_ROLES.map((r) => (
                <option key={r} value={r}>
                  {COACH_ROLE_LABELS[r]}
                </option>
              ))}
            </select>
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={coachSearch}
              onChange={(e) => {
                setCoachSearch(e.target.value)
                setNewCoachId('')
              }}
              placeholder="Buscar entrenador existente..."
              className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
            />
            <button
              type="button"
              onClick={handleAddExisting}
              disabled={!newCoachId}
              className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              + Agregar
            </button>
          </div>
          {coachOptions.length > 0 && (
            <ul className="rounded-lg border border-slate-200 text-sm">
              {coachOptions.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setNewCoachId(String(c.id))
                      setCoachSearch(c.fullName)
                      setCoachOptions([])
                    }}
                    className="block w-full px-3 py-1.5 text-left hover:bg-slate-100"
                  >
                    {c.fullName}
                  </button>
                </li>
              ))}
            </ul>
          )}
          <p className="text-xs text-slate-400">¿No existe todavía? Creá uno nuevo:</p>
          <div className="flex gap-2">
            <input
              type="text"
              value={newCoachName}
              onChange={(e) => setNewCoachName(e.target.value)}
              placeholder="Nombre y apellido"
              className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
            />
            <button
              type="button"
              onClick={handleCreateAndAdd}
              disabled={!newCoachName.trim()}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50"
            >
              + Crear y agregar
            </button>
          </div>
        </div>
      </Card>
    </div>
  )
}

// ---------------------------------------------------------------------------------
function OfficialsTab({ matchId, onError }: { matchId: number; onError: (m: string) => void }) {
  const navigate = useNavigate()
  const [officials, setOfficials] = useState<MatchOfficialEntry[] | null>(null)
  const [search, setSearch] = useState('')
  const [options, setOptions] = useState<Official[]>([])
  const [selectedId, setSelectedId] = useState('')
  const [role, setRole] = useState('main_referee')

  const load = () => {
    api.get<MatchOfficialEntry[]>(`/matches/${matchId}/officials`).then(setOfficials).catch(() => setOfficials([]))
  }
  useEffect(load, [matchId])

  useEffect(() => {
    if (search.trim().length < 2) {
      setOptions([])
      return
    }
    const t = setTimeout(() => {
      api
        .get<{ items: Official[] }>(`/officials?search=${encodeURIComponent(search)}&pageSize=10`)
        .then((r) => setOptions(r.items))
        .catch(() => {})
    }, 300)
    return () => clearTimeout(t)
  }, [search])

  const handleAdd = async () => {
    if (!selectedId) return
    try {
      await api.post(`/matches/${matchId}/officials`, { officialId: Number(selectedId), role })
      setSelectedId('')
      setSearch('')
      load()
    } catch (err) {
      onError(err instanceof ApiError ? err.message : 'Error al agregar el oficial')
    }
  }

  const handleRemove = async (matchOfficialId: number) => {
    try {
      await api.delete(`/matches/${matchId}/officials/${matchOfficialId}`)
      load()
    } catch (err) {
      onError(err instanceof ApiError ? err.message : 'Error al quitar el oficial')
    }
  }

  return (
    <Card title="Arbitraje">
      {!officials && <p className="text-slate-500">Cargando...</p>}
      {officials?.length === 0 && <p className="mb-4 text-slate-500">Todavía no hay oficiales registrados.</p>}
      {officials && officials.length > 0 && (
        <ul className="mb-4 divide-y divide-slate-100">
          {officials.map((o) => (
            <li key={o.id} className="flex items-center justify-between py-2">
              <span>
                <button
                  type="button"
                  onClick={() => navigate(`/oficiales/${o.officialId}`)}
                  className="font-medium text-blue-600 hover:underline"
                >
                  {o.officialFullName}
                </button>
                <span className="ml-2 text-sm text-slate-500">{MATCH_OFFICIAL_ROLE_LABELS[o.role] ?? o.role}</span>
              </span>
              <button type="button" onClick={() => handleRemove(o.id)} className="text-sm text-red-600 hover:underline">
                Quitar
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="space-y-2 rounded-lg border border-slate-200 p-3">
        <select value={role} onChange={(e) => setRole(e.target.value)} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm">
          {MATCH_OFFICIAL_ROLES.map((r) => (
            <option key={r} value={r}>
              {MATCH_OFFICIAL_ROLE_LABELS[r]}
            </option>
          ))}
        </select>
        <div className="flex gap-2">
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setSelectedId('')
            }}
            placeholder="Buscar oficial (del módulo Oficiales)..."
            className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
          />
          <button
            type="button"
            onClick={handleAdd}
            disabled={!selectedId}
            className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            + Agregar
          </button>
        </div>
        {options.length > 0 && (
          <ul className="rounded-lg border border-slate-200 text-sm">
            {options.map((o) => (
              <li key={o.id}>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedId(String(o.id))
                    setSearch(o.fullName)
                    setOptions([])
                  }}
                  className="block w-full px-3 py-1.5 text-left hover:bg-slate-100"
                >
                  {o.fullName} {o.officialTypeName ? `— ${o.officialTypeName}` : ''}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  )
}

// ---------------------------------------------------------------------------------
function ResultTab({ match, onReload, onError }: { match: Match; onReload: () => void; onError: (m: string) => void }) {
  const [period, setPeriod] = useState('full_time')
  const [homeScore, setHomeScore] = useState('')
  const [awayScore, setAwayScore] = useState('')
  const [kicks, setKicks] = useState<ShootoutKick[] | null>(null)
  const [kickTeamId, setKickTeamId] = useState(match.homeTeamId)
  const [kickPlayers, setKickPlayers] = useState<Player[]>([])
  const [kickPlayerId, setKickPlayerId] = useState('')
  const [kickOutcome, setKickOutcome] = useState<'scored' | 'missed' | 'saved'>('scored')

  const loadKicks = () => {
    api.get<ShootoutKick[]>(`/matches/${match.id}/shootout-kicks`).then(setKicks).catch(() => setKicks([]))
  }
  useEffect(loadKicks, [match.id])

  useEffect(() => {
    api
      .get<{ items: Player[] }>(`/players?teamId=${kickTeamId}&pageSize=100`)
      .then((r) => setKickPlayers(r.items))
      .catch(() => setKickPlayers([]))
  }, [kickTeamId])

  const handleSetScore = async () => {
    if (homeScore === '' || awayScore === '') {
      onError('Completá el resultado de ambos equipos')
      return
    }
    try {
      await api.put(`/matches/${match.id}/result`, { period, homeScore: Number(homeScore), awayScore: Number(awayScore) })
      setHomeScore('')
      setAwayScore('')
      onReload()
    } catch (err) {
      onError(err instanceof ApiError ? err.message : 'Error al guardar el resultado')
    }
  }

  const handleRemoveScore = async (p: string) => {
    try {
      await api.delete(`/matches/${match.id}/result/${p}`)
      onReload()
    } catch (err) {
      onError(err instanceof ApiError ? err.message : 'Error al quitar el resultado')
    }
  }

  const handleAddKick = async () => {
    if (!kicks) return
    const teamKicks = kicks.filter((k) => k.teamId === kickTeamId)
    const nextOrder = teamKicks.length + 1
    try {
      await api.post(`/matches/${match.id}/shootout-kicks`, {
        teamId: kickTeamId,
        playerId: kickPlayerId ? Number(kickPlayerId) : null,
        kickOrder: nextOrder,
        outcome: kickOutcome,
      })
      setKickPlayerId('')
      loadKicks()
    } catch (err) {
      onError(err instanceof ApiError ? err.message : 'Error al agregar el lanzamiento')
    }
  }

  const handleRemoveKick = async (kickId: number) => {
    try {
      await api.delete(`/matches/${match.id}/shootout-kicks/${kickId}`)
      loadKicks()
    } catch (err) {
      onError(err instanceof ApiError ? err.message : 'Error al quitar el lanzamiento')
    }
  }

  return (
    <div className="space-y-6">
      <Card title="Resultado por periodo">
        {match.periodScores.length === 0 && <p className="mb-4 text-slate-500">Sin resultado cargado todavía.</p>}
        {match.periodScores.length > 0 && (
          <table className="mb-4 w-full text-left text-sm">
            <thead className="border-b border-slate-200 text-slate-500">
              <tr>
                <th className="py-2">Periodo</th>
                <th className="py-2">{match.homeTeamName}</th>
                <th className="py-2">{match.awayTeamName}</th>
                <th className="py-2 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {match.periodScores.map((p) => (
                <tr key={p.period}>
                  <td className="py-2">{RESULT_PERIOD_LABELS[p.period] ?? p.period}</td>
                  <td className="py-2 font-medium">{p.homeScore}</td>
                  <td className="py-2 font-medium">{p.awayScore}</td>
                  <td className="py-2 text-right">
                    <button type="button" onClick={() => handleRemoveScore(p.period)} className="text-sm text-red-600 hover:underline">
                      Quitar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <div className="flex flex-wrap items-end gap-2 rounded-lg border border-slate-200 p-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Periodo</label>
            <select value={period} onChange={(e) => setPeriod(e.target.value)} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm">
              {RESULT_PERIODS.map((p) => (
                <option key={p} value={p}>
                  {RESULT_PERIOD_LABELS[p]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">{match.homeTeamName}</label>
            <input type="number" min={0} value={homeScore} onChange={(e) => setHomeScore(e.target.value)} className="w-20 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">{match.awayTeamName}</label>
            <input type="number" min={0} value={awayScore} onChange={(e) => setAwayScore(e.target.value)} className="w-20 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" />
          </div>
          <button type="button" onClick={handleSetScore} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
            Guardar
          </button>
        </div>
      </Card>

      <Card title="Tanda de penales">
        <p className="mb-3 text-sm text-slate-400">Separada del resultado normal — no es un gol ni cuenta como tal.</p>
        {kicks?.length === 0 && <p className="mb-4 text-slate-500">Sin lanzamientos registrados.</p>}
        {kicks && kicks.length > 0 && (
          <ul className="mb-4 divide-y divide-slate-100">
            {kicks.map((k) => (
              <li key={k.id} className="flex items-center justify-between py-2 text-sm">
                <span>
                  #{k.kickOrder} — {k.teamName} — {k.playerName ?? 'Sin especificar'} —{' '}
                  <strong>{k.outcome === 'scored' ? 'Convertido' : k.outcome === 'missed' ? 'Errado' : 'Atajado'}</strong>
                </span>
                <button type="button" onClick={() => handleRemoveKick(k.id)} className="text-red-600 hover:underline">
                  Quitar
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="flex flex-wrap items-end gap-2 rounded-lg border border-slate-200 p-3">
          <select
            value={kickTeamId}
            onChange={(e) => setKickTeamId(Number(e.target.value))}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
          >
            <option value={match.homeTeamId}>{match.homeTeamName}</option>
            <option value={match.awayTeamId}>{match.awayTeamName}</option>
          </select>
          <select value={kickPlayerId} onChange={(e) => setKickPlayerId(e.target.value)} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm">
            <option value="">Sin especificar</option>
            {kickPlayers.map((p) => (
              <option key={p.id} value={p.id}>
                {p.fullName}
              </option>
            ))}
          </select>
          <select value={kickOutcome} onChange={(e) => setKickOutcome(e.target.value as any)} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm">
            <option value="scored">Convertido</option>
            <option value="missed">Errado</option>
            <option value="saved">Atajado</option>
          </select>
          <button type="button" onClick={handleAddKick} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
            + Agregar
          </button>
        </div>
      </Card>
    </div>
  )
}

// ---------------------------------------------------------------------------------
const EVENT_ICONS: Record<string, string> = {
  goal: '⚽',
  card: '🟨',
  substitution: '🔄',
  offside: '🚩',
  foul: '✋',
  interruption: '⏱',
}

function describeEvent(e: TimelineEvent): string {
  switch (e.type) {
    case 'goal':
      return `${e.playerName}${e.ownGoal ? ' (en contra)' : ''}${e.penalty ? ' (penal)' : ''}${e.assistPlayerName ? ` — asistencia de ${e.assistPlayerName}` : ''}`
    case 'card':
      return `${e.playerName} — ${CARD_TYPE_LABELS[e.cardType ?? ''] ?? e.cardType}`
    case 'substitution':
      return `Sale ${e.playerOutName}, entra ${e.playerInName}`
    case 'offside':
      return e.playerName ?? 'Fuera de juego'
    case 'foul':
      return `${e.playerName ?? 'Falta'}${e.reason ? ` — ${e.reason}` : ''}`
    case 'interruption':
      return `${INTERRUPTION_TYPE_LABELS[e.interruptionType ?? ''] ?? e.interruptionType}${e.reason ? ` — ${e.reason}` : ''}`
    default:
      return ''
  }
}

function EventsTab({ match, onError }: { match: Match; onError: (m: string) => void }) {
  const [events, setEvents] = useState<TimelineEvent[] | null>(null)
  const [lineups, setLineups] = useState<MatchLineupEntry[]>([])

  const load = () => {
    api.get<TimelineEvent[]>(`/matches/${match.id}/timeline`).then(setEvents).catch(() => setEvents([]))
  }
  useEffect(load, [match.id])
  useEffect(() => {
    api.get<MatchLineupEntry[]>(`/matches/${match.id}/lineups`).then(setLineups).catch(() => {})
  }, [match.id])

  const remove = async (type: TimelineEvent['type'], eventId: number) => {
    const endpoint =
      type === 'goal' ? 'goals' :
      type === 'card' ? 'cards' :
      type === 'substitution' ? 'substitutions' :
      type === 'offside' ? 'offsides' :
      type === 'foul' ? 'fouls' :
      'interruptions'
    try {
      await api.delete(`/matches/${match.id}/${endpoint}/${eventId}`)
      load()
    } catch (err) {
      onError(err instanceof ApiError ? err.message : 'Error al eliminar el evento')
    }
  }

  return (
    <div className="space-y-6">
      <Card title="Línea de tiempo">
        {events?.length === 0 && <p className="text-slate-500">Sin eventos registrados todavía.</p>}
        {events && events.length > 0 && (
          <ul className="divide-y divide-slate-100">
            {events.map((e) => (
              <li key={`${e.type}-${e.id}`} className="flex items-center justify-between gap-3 py-2 text-sm">
                <span className="flex items-center gap-2">
                  <span className="w-12 shrink-0 font-mono text-slate-500">
                    {e.minute ?? '—'}
                    {e.minuteExtra ? `+${e.minuteExtra}` : ''}'
                  </span>
                  <span>{EVENT_ICONS[e.type]}</span>
                  <span>
                    {e.teamName ? <span className="text-slate-500">{e.teamName} — </span> : null}
                    {describeEvent(e)}
                  </span>
                </span>
                <button type="button" onClick={() => remove(e.type, e.id)} className="shrink-0 text-red-600 hover:underline">
                  Quitar
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <AddGoalForm match={match} lineups={lineups} onAdded={load} onError={onError} />
      <AddCardForm match={match} lineups={lineups} onAdded={load} onError={onError} />
      <AddSubstitutionForm match={match} lineups={lineups} onAdded={load} onError={onError} />
      <AddOffsideForm match={match} lineups={lineups} onAdded={load} onError={onError} />
      <AddFoulForm match={match} lineups={lineups} onAdded={load} onError={onError} />
      <AddInterruptionForm match={match} onAdded={load} onError={onError} />
    </div>
  )
}

function teamLineup(lineups: MatchLineupEntry[], teamId: number) {
  return lineups.filter((l) => l.teamId === teamId)
}

function AddGoalForm({
  match,
  lineups,
  onAdded,
  onError,
}: {
  match: Match
  lineups: MatchLineupEntry[]
  onAdded: () => void
  onError: (m: string) => void
}) {
  const [teamId, setTeamId] = useState(match.homeTeamId)
  const [playerId, setPlayerId] = useState('')
  const [assistPlayerId, setAssistPlayerId] = useState('')
  const [minute, setMinute] = useState('')
  const [minuteExtra, setMinuteExtra] = useState('')
  const [period, setPeriod] = useState('first_half')
  const [ownGoal, setOwnGoal] = useState(false)
  const [penalty, setPenalty] = useState(false)
  const [goalType, setGoalType] = useState('open_play')

  const players = teamLineup(lineups, teamId)

  const submit = async () => {
    if (!playerId) return onError('Elegí el autor del gol')
    try {
      await api.post(`/matches/${match.id}/goals`, {
        teamId,
        playerId: Number(playerId),
        assistPlayerId: assistPlayerId ? Number(assistPlayerId) : null,
        minute: minute ? Number(minute) : null,
        minuteExtra: minuteExtra ? Number(minuteExtra) : null,
        period,
        ownGoal,
        penalty,
        goalType,
      })
      setPlayerId('')
      setAssistPlayerId('')
      setMinute('')
      setMinuteExtra('')
      setOwnGoal(false)
      setPenalty(false)
      onAdded()
    } catch (err) {
      onError(err instanceof ApiError ? err.message : 'Error al registrar el gol')
    }
  }

  return (
    <Card title="⚽ Agregar gol">
      <div className="flex flex-wrap items-end gap-2">
        <MiniSelect label="Equipo" value={teamId} onChange={(v) => setTeamId(Number(v))} options={[[match.homeTeamId, match.homeTeamName!], [match.awayTeamId, match.awayTeamName!]]} />
        <MiniSelect label="Jugador" value={playerId} onChange={setPlayerId} options={players.map((p) => [p.playerId, p.playerFullName])} placeholder="Elegir..." />
        <MiniSelect label="Asistencia" value={assistPlayerId} onChange={setAssistPlayerId} options={players.map((p) => [p.playerId, p.playerFullName])} placeholder="Sin asistencia" />
        <MiniInput label="Minuto" value={minute} onChange={setMinute} width="w-16" />
        <MiniInput label="+" value={minuteExtra} onChange={setMinuteExtra} width="w-12" />
        <MiniSelect label="Periodo" value={period} onChange={setPeriod} options={EVENT_PERIODS.map((p) => [p, EVENT_PERIOD_LABELS[p]])} />
        <MiniSelect label="Tipo" value={goalType} onChange={setGoalType} options={GOAL_TYPES.map((g) => [g, GOAL_TYPE_LABELS[g]])} />
        <label className="flex items-center gap-1 pb-2 text-sm">
          <input type="checkbox" checked={ownGoal} onChange={(e) => setOwnGoal(e.target.checked)} /> En contra
        </label>
        <label className="flex items-center gap-1 pb-2 text-sm">
          <input type="checkbox" checked={penalty} onChange={(e) => setPenalty(e.target.checked)} /> Penal
        </label>
        <button type="button" onClick={submit} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
          Agregar
        </button>
      </div>
    </Card>
  )
}

function AddCardForm({
  match,
  lineups,
  onAdded,
  onError,
}: {
  match: Match
  lineups: MatchLineupEntry[]
  onAdded: () => void
  onError: (m: string) => void
}) {
  const [teamId, setTeamId] = useState(match.homeTeamId)
  const [playerId, setPlayerId] = useState('')
  const [cardType, setCardType] = useState('yellow')
  const [minute, setMinute] = useState('')
  const players = teamLineup(lineups, teamId)

  const submit = async () => {
    if (!playerId) return onError('Elegí el jugador amonestado')
    try {
      await api.post(`/matches/${match.id}/cards`, { teamId, playerId: Number(playerId), cardType, minute: minute ? Number(minute) : null })
      setPlayerId('')
      setMinute('')
      onAdded()
    } catch (err) {
      onError(err instanceof ApiError ? err.message : 'Error al registrar la tarjeta')
    }
  }

  return (
    <Card title="🟨 Agregar tarjeta">
      <div className="flex flex-wrap items-end gap-2">
        <MiniSelect label="Equipo" value={teamId} onChange={(v) => setTeamId(Number(v))} options={[[match.homeTeamId, match.homeTeamName!], [match.awayTeamId, match.awayTeamName!]]} />
        <MiniSelect label="Jugador" value={playerId} onChange={setPlayerId} options={players.map((p) => [p.playerId, p.playerFullName])} placeholder="Elegir..." />
        <MiniSelect label="Tipo" value={cardType} onChange={setCardType} options={[['yellow', 'Amarilla'], ['second_yellow', 'Doble amarilla'], ['red', 'Roja']]} />
        <MiniInput label="Minuto" value={minute} onChange={setMinute} width="w-16" />
        <button type="button" onClick={submit} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
          Agregar
        </button>
      </div>
    </Card>
  )
}

function AddSubstitutionForm({
  match,
  lineups,
  onAdded,
  onError,
}: {
  match: Match
  lineups: MatchLineupEntry[]
  onAdded: () => void
  onError: (m: string) => void
}) {
  const [teamId, setTeamId] = useState(match.homeTeamId)
  const [playerOutId, setPlayerOutId] = useState('')
  const [playerInId, setPlayerInId] = useState('')
  const [minute, setMinute] = useState('')
  const players = teamLineup(lineups, teamId)

  const submit = async () => {
    if (!playerOutId || !playerInId) return onError('Elegí quién sale y quién entra')
    try {
      await api.post(`/matches/${match.id}/substitutions`, {
        teamId,
        playerOutId: Number(playerOutId),
        playerInId: Number(playerInId),
        minute: minute ? Number(minute) : null,
      })
      setPlayerOutId('')
      setPlayerInId('')
      setMinute('')
      onAdded()
    } catch (err) {
      onError(err instanceof ApiError ? err.message : 'Error al registrar la sustitución')
    }
  }

  return (
    <Card title="🔄 Agregar sustitución">
      <div className="flex flex-wrap items-end gap-2">
        <MiniSelect label="Equipo" value={teamId} onChange={(v) => setTeamId(Number(v))} options={[[match.homeTeamId, match.homeTeamName!], [match.awayTeamId, match.awayTeamName!]]} />
        <MiniSelect label="Sale" value={playerOutId} onChange={setPlayerOutId} options={players.map((p) => [p.playerId, p.playerFullName])} placeholder="Elegir..." />
        <MiniSelect label="Entra" value={playerInId} onChange={setPlayerInId} options={players.map((p) => [p.playerId, p.playerFullName])} placeholder="Elegir..." />
        <MiniInput label="Minuto" value={minute} onChange={setMinute} width="w-16" />
        <button type="button" onClick={submit} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
          Agregar
        </button>
      </div>
    </Card>
  )
}

function AddOffsideForm({
  match,
  lineups,
  onAdded,
  onError,
}: {
  match: Match
  lineups: MatchLineupEntry[]
  onAdded: () => void
  onError: (m: string) => void
}) {
  const [teamId, setTeamId] = useState(match.homeTeamId)
  const [playerId, setPlayerId] = useState('')
  const [minute, setMinute] = useState('')
  const players = teamLineup(lineups, teamId)

  const submit = async () => {
    try {
      await api.post(`/matches/${match.id}/offsides`, { teamId, playerId: playerId ? Number(playerId) : null, minute: minute ? Number(minute) : null })
      setPlayerId('')
      setMinute('')
      onAdded()
    } catch (err) {
      onError(err instanceof ApiError ? err.message : 'Error al registrar el fuera de juego')
    }
  }

  return (
    <Card title="🚩 Agregar fuera de juego">
      <div className="flex flex-wrap items-end gap-2">
        <MiniSelect label="Equipo" value={teamId} onChange={(v) => setTeamId(Number(v))} options={[[match.homeTeamId, match.homeTeamName!], [match.awayTeamId, match.awayTeamName!]]} />
        <MiniSelect label="Jugador" value={playerId} onChange={setPlayerId} options={players.map((p) => [p.playerId, p.playerFullName])} placeholder="Sin especificar" />
        <MiniInput label="Minuto" value={minute} onChange={setMinute} width="w-16" />
        <button type="button" onClick={submit} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
          Agregar
        </button>
      </div>
    </Card>
  )
}

function AddFoulForm({
  match,
  lineups,
  onAdded,
  onError,
}: {
  match: Match
  lineups: MatchLineupEntry[]
  onAdded: () => void
  onError: (m: string) => void
}) {
  const [teamId, setTeamId] = useState(match.homeTeamId)
  const [playerId, setPlayerId] = useState('')
  const [minute, setMinute] = useState('')
  const players = teamLineup(lineups, teamId)

  const submit = async () => {
    try {
      await api.post(`/matches/${match.id}/fouls`, { teamId, playerId: playerId ? Number(playerId) : null, minute: minute ? Number(minute) : null })
      setPlayerId('')
      setMinute('')
      onAdded()
    } catch (err) {
      onError(err instanceof ApiError ? err.message : 'Error al registrar la falta')
    }
  }

  return (
    <Card title="✋ Agregar falta">
      <div className="flex flex-wrap items-end gap-2">
        <MiniSelect label="Equipo (comete la falta)" value={teamId} onChange={(v) => setTeamId(Number(v))} options={[[match.homeTeamId, match.homeTeamName!], [match.awayTeamId, match.awayTeamName!]]} />
        <MiniSelect label="Jugador" value={playerId} onChange={setPlayerId} options={players.map((p) => [p.playerId, p.playerFullName])} placeholder="Sin especificar" />
        <MiniInput label="Minuto" value={minute} onChange={setMinute} width="w-16" />
        <button type="button" onClick={submit} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
          Agregar
        </button>
      </div>
    </Card>
  )
}

function AddInterruptionForm({ match, onAdded, onError }: { match: Match; onAdded: () => void; onError: (m: string) => void }) {
  const [interruptionType, setInterruptionType] = useState('var_review')
  const [minuteStart, setMinuteStart] = useState('')
  const [minuteEnd, setMinuteEnd] = useState('')
  const [reason, setReason] = useState('')

  const submit = async () => {
    try {
      await api.post(`/matches/${match.id}/interruptions`, {
        interruptionType,
        minuteStart: minuteStart ? Number(minuteStart) : null,
        minuteEnd: minuteEnd ? Number(minuteEnd) : null,
        reason: reason || null,
      })
      setMinuteStart('')
      setMinuteEnd('')
      setReason('')
      onAdded()
    } catch (err) {
      onError(err instanceof ApiError ? err.message : 'Error al registrar la interrupción')
    }
  }

  return (
    <Card title="⏱ Agregar interrupción">
      <div className="flex flex-wrap items-end gap-2">
        <MiniSelect label="Tipo" value={interruptionType} onChange={setInterruptionType} options={INTERRUPTION_TYPES.map((t) => [t, INTERRUPTION_TYPE_LABELS[t]])} />
        <MiniInput label="Desde" value={minuteStart} onChange={setMinuteStart} width="w-16" />
        <MiniInput label="Hasta" value={minuteEnd} onChange={setMinuteEnd} width="w-16" />
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Motivo</label>
          <input type="text" value={reason} onChange={(e) => setReason(e.target.value)} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" />
        </div>
        <button type="button" onClick={submit} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
          Agregar
        </button>
      </div>
    </Card>
  )
}

function MiniSelect({
  label,
  value,
  onChange,
  options,
  placeholder,
}: {
  label: string
  value: string | number
  onChange: (v: string) => void
  options: [string | number, string][]
  placeholder?: string
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-slate-600">{label}</label>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm">
        {placeholder && <option value="">{placeholder}</option>}
        {options.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
    </div>
  )
}

function MiniInput({ label, value, onChange, width }: { label: string; value: string; onChange: (v: string) => void; width: string }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-slate-600">{label}</label>
      <input type="number" value={value} onChange={(e) => onChange(e.target.value)} className={`${width} rounded-lg border border-slate-300 bg-white px-2 py-2 text-sm`} />
    </div>
  )
}

// ---------------------------------------------------------------------------------
const STAT_FIELDS: { key: keyof MatchTeamStats; label: string }[] = [
  { key: 'possessionPct', label: 'Posesión (%)' },
  { key: 'shots', label: 'Tiros' },
  { key: 'shotsOnTarget', label: 'Tiros a puerta' },
  { key: 'shotsOffTarget', label: 'Tiros desviados' },
  { key: 'shotsBlocked', label: 'Tiros bloqueados' },
  { key: 'corners', label: 'Córners' },
  { key: 'fouls', label: 'Faltas' },
  { key: 'offsidesCount', label: 'Fueras de juego' },
  { key: 'throwIns', label: 'Saques de banda' },
  { key: 'goalKicks', label: 'Saques de meta' },
  { key: 'freeKicksDirect', label: 'Tiros libres directos' },
  { key: 'freeKicksIndirect', label: 'Tiros libres indirectos' },
  { key: 'passes', label: 'Pases' },
  { key: 'passesCompleted', label: 'Pases completados' },
  { key: 'touches', label: 'Toques' },
]

function StatsTab({ match, onError }: { match: Match; onError: (m: string) => void }) {
  const [stats, setStats] = useState<MatchTeamStats[] | null>(null)
  const [homeForm, setHomeForm] = useState<Record<string, string>>({})
  const [awayForm, setAwayForm] = useState<Record<string, string>>({})

  const load = () => {
    api.get<MatchTeamStats[]>(`/matches/${match.id}/team-stats`).then((data) => {
      setStats(data)
      const home = data.find((s) => s.teamId === match.homeTeamId)
      const away = data.find((s) => s.teamId === match.awayTeamId)
      setHomeForm(Object.fromEntries(STAT_FIELDS.map((f) => [f.key, home?.[f.key]?.toString() ?? ''])))
      setAwayForm(Object.fromEntries(STAT_FIELDS.map((f) => [f.key, away?.[f.key]?.toString() ?? ''])))
    }).catch(() => setStats([]))
  }
  useEffect(load, [match.id])

  const save = async (teamId: number, form: Record<string, string>) => {
    // Se manda null (no undefined) para un campo vacío: el backend ignora los undefined (no
    // toca esa columna), pero acá un campo vaciado a propósito debe poder limpiar un valor
    // cargado antes, no dejarlo pegado con el número viejo.
    const payload: Record<string, number | null> = {}
    for (const f of STAT_FIELDS) payload[f.key] = form[f.key] === '' ? null : Number(form[f.key])
    try {
      await api.put(`/matches/${match.id}/team-stats/${teamId}`, payload)
      load()
    } catch (err) {
      onError(err instanceof ApiError ? err.message : 'Error al guardar las estadísticas')
    }
  }

  if (!stats) return <Card><p className="text-slate-500">Cargando...</p></Card>

  return (
    <Card title="Estadísticas del equipo">
      <p className="mb-4 text-xs text-slate-400">Un campo vacío significa "sin datos", no cero.</p>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[480px] text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-slate-500">
              <th className="py-2 text-left">Estadística</th>
              <th className="py-2 text-center">{match.homeTeamName}</th>
              <th className="py-2 text-center">{match.awayTeamName}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {STAT_FIELDS.map((f) => (
              <tr key={f.key}>
                <td className="py-1.5 text-slate-700">{f.label}</td>
                <td className="py-1.5 text-center">
                  <input
                    type="number"
                    value={homeForm[f.key] ?? ''}
                    onChange={(e) => setHomeForm((s) => ({ ...s, [f.key]: e.target.value }))}
                    className="w-20 rounded border border-slate-300 px-2 py-1 text-center"
                  />
                </td>
                <td className="py-1.5 text-center">
                  <input
                    type="number"
                    value={awayForm[f.key] ?? ''}
                    onChange={(e) => setAwayForm((s) => ({ ...s, [f.key]: e.target.value }))}
                    className="w-20 rounded border border-slate-300 px-2 py-1 text-center"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-4 flex justify-center gap-3">
        <button type="button" onClick={() => save(match.homeTeamId, homeForm)} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
          Guardar {match.homeTeamName}
        </button>
        <button type="button" onClick={() => save(match.awayTeamId, awayForm)} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
          Guardar {match.awayTeamName}
        </button>
      </div>
    </Card>
  )
}

// ---------------------------------------------------------------------------------
function PlayersTab({ match, onError }: { match: Match; onError: (m: string) => void }) {
  const [lineups, setLineups] = useState<MatchLineupEntry[] | null>(null)
  const [teamId, setTeamId] = useState(match.homeTeamId)
  const [teamPlayers, setTeamPlayers] = useState<Player[]>([])
  const [playerId, setPlayerId] = useState('')
  const [isStarting, setIsStarting] = useState(true)
  const [shirtNumber, setShirtNumber] = useState('')

  const load = () => {
    api.get<MatchLineupEntry[]>(`/matches/${match.id}/lineups`).then(setLineups).catch(() => setLineups([]))
  }
  useEffect(load, [match.id])

  useEffect(() => {
    api
      .get<{ items: Player[] }>(`/players?teamId=${teamId}&pageSize=100`)
      .then((r) => setTeamPlayers(r.items))
      .catch(() => setTeamPlayers([]))
  }, [teamId])

  const handleAdd = async () => {
    if (!playerId) return onError('Elegí un jugador')
    try {
      await api.post(`/matches/${match.id}/lineups`, {
        teamId,
        playerId: Number(playerId),
        isStarting,
        shirtNumber: shirtNumber ? Number(shirtNumber) : null,
      })
      setPlayerId('')
      setShirtNumber('')
      load()
    } catch (err) {
      onError(err instanceof ApiError ? err.message : 'Error al agregar el jugador')
    }
  }

  const handleRemove = async (lineupId: number) => {
    try {
      await api.delete(`/matches/${match.id}/lineups/${lineupId}`)
      load()
    } catch (err) {
      onError(err instanceof ApiError ? err.message : 'Error al quitar el jugador')
    }
  }

  if (!lineups) return <Card><p className="text-slate-500">Cargando...</p></Card>

  return (
    <div className="space-y-6">
      {[match.homeTeamId, match.awayTeamId].map((tid) => (
        <Card key={tid} title={tid === match.homeTeamId ? match.homeTeamName : match.awayTeamName}>
          {teamLineup(lineups, tid).length === 0 && <p className="mb-2 text-slate-500">Sin jugadores registrados.</p>}
          <table className="w-full text-left text-sm">
            <tbody className="divide-y divide-slate-100">
              {teamLineup(lineups, tid).map((p) => (
                <tr key={p.id}>
                  <td className="py-1.5">
                    {p.shirtNumber ? `#${p.shirtNumber} ` : ''}
                    {p.playerFullName}
                    {p.isStarting && <span className="ml-2 rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700">Titular</span>}
                  </td>
                  <td className="py-1.5 text-slate-500">
                    ⚽{p.goals} · 🅰{p.assists} · 🟨{p.yellowCards} · 🟥{p.redCards}
                  </td>
                  <td className="py-1.5 text-right">
                    <button type="button" onClick={() => handleRemove(p.id)} className="text-red-600 hover:underline">
                      Quitar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      ))}

      <Card title="Agregar jugador al partido">
        <div className="flex flex-wrap items-end gap-2">
          <MiniSelect label="Equipo" value={teamId} onChange={(v) => setTeamId(Number(v))} options={[[match.homeTeamId, match.homeTeamName!], [match.awayTeamId, match.awayTeamName!]]} />
          <MiniSelect label="Jugador" value={playerId} onChange={setPlayerId} options={teamPlayers.map((p) => [p.id, p.fullName])} placeholder="Elegir..." />
          <MiniInput label="Dorsal" value={shirtNumber} onChange={setShirtNumber} width="w-16" />
          <label className="flex items-center gap-1 pb-2 text-sm">
            <input type="checkbox" checked={isStarting} onChange={(e) => setIsStarting(e.target.checked)} /> Titular
          </label>
          <button type="button" onClick={handleAdd} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
            + Agregar
          </button>
        </div>
      </Card>
    </div>
  )
}

// ---------------------------------------------------------------------------------
function HistoryTab({ matchId }: { matchId: number }) {
  const [history, setHistory] = useState<MatchHistoryEntry[] | null>(null)

  useEffect(() => {
    api.get<MatchHistoryEntry[]>(`/matches/${matchId}/history`).then(setHistory).catch(() => setHistory([]))
  }, [matchId])

  return (
    <Card title="Historial de modificaciones">
      {!history && <p className="text-slate-500">Cargando...</p>}
      {history?.length === 0 && <p className="text-slate-500">Sin cambios registrados todavía.</p>}
      {history && history.length > 0 && (
        <ul className="divide-y divide-slate-100 text-sm">
          {history.map((h, i) => (
            <li key={i} className="py-2">
              <span className="font-medium text-slate-900">{h.action}</span>
              {h.details && <span className="text-slate-600"> — {h.details}</span>}
              <span className="block text-xs text-slate-400">
                {h.username ?? 'Sistema'} · {new Date(h.createdAt).toLocaleString('es-PY')}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}
