import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import Avatar from '../../components/Avatar'
import StatusBadge from '../../components/StatusBadge'
import PlayerPitchViz from '../../components/pitch/PlayerPitchViz'
import { ApiError } from '../../context/AuthContext'
import { calculateAge } from '../../lib/age'
import { api } from '../../services/api'
import type { Player, PlayerPositionEntry } from '../../types/player'
import VideogameRatingsSection from './VideogameRatingsSection'

type PlayerSummary = {
  matchesPlayed: number
  goals: number
  assists: number
  yellowCards: number
  redCards: number
}

const DATA_ORIGIN_LABELS: Record<string, string> = {
  manual: 'Manual',
  imported: 'Importado',
  research: 'Investigación histórica',
}

export default function PlayerDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [player, setPlayer] = useState<Player | null>(null)
  const [error, setError] = useState('')

  const load = () => {
    api
      .get<Player>(`/players/${id}`)
      .then(setPlayer)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Error al cargar el jugador'))
  }

  useEffect(load, [id])

  const handleToggleStatus = async () => {
    if (!player) return
    const next = player.status === 'active' ? 'inactive' : 'active'
    try {
      await api.patch(`/players/${player.id}/status`, { status: next })
      load()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Error al cambiar el estado')
    }
  }

  const handleDelete = async () => {
    if (!player) return
    if (
      !window.confirm(
        `¿Desea eliminar este jugador?\n\n${player.fullName}\n\nEsta acción puede afectar información relacionada.`,
      )
    ) {
      return
    }
    try {
      await api.delete(`/players/${player.id}`)
      navigate('/jugadores')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Error al eliminar')
    }
  }

  if (error) return <p className="p-8 text-center text-red-600">{error}</p>
  if (!player) return <p className="p-8 text-center text-slate-500">Cargando...</p>

  const age = calculateAge(player.dateOfBirth)

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <div className="mb-6 rounded-lg bg-white p-6 shadow">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <Avatar photoUrl={player.photoUrl} alt={player.fullName} size={96} />
            <div>
              <h1 className="text-2xl font-bold sm:text-3xl">{player.fullName}</h1>
              <p className="text-slate-500">{player.position ?? 'Sin posición asignada'}</p>
              {player.teamName ? (
                <button
                  type="button"
                  onClick={() => navigate(`/equipos/${player.teamId}`)}
                  className="text-sm text-blue-600 hover:underline"
                >
                  {player.teamName}
                </button>
              ) : (
                <p className="text-sm text-slate-400">Sin equipo actual</p>
              )}
              <div className="mt-1">
                <StatusBadge status={player.status} />
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => navigate(`/jugadores/${player.id}/editar`)}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
            >
              Editar
            </button>
            <button
              type="button"
              onClick={handleToggleStatus}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
            >
              {player.status === 'active' ? 'Desactivar' : 'Activar'}
            </button>
            <button
              type="button"
              onClick={handleDelete}
              className="rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
            >
              Eliminar
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-400 bg-red-100 px-4 py-3 text-red-700">{error}</div>
      )}

      {/* PLAYER ANALYTICS: tarjeta de valoraciones ya trae foto+nombre+posición, ahora también
          equipo/nacionalidad/edad -- es el "hero" de análisis del jugador, arriba de los CRUD
          tradicionales de abajo (que siguen existiendo tal cual, sólo bajaron de lugar). */}
      <div className="mb-6">
        <VideogameRatingsSection
          playerId={player.id}
          photoUrl={player.photoUrl}
          fullName={player.fullName}
          position={player.position}
          teamName={player.teamName}
          nationality={player.nationality}
          age={age}
        />
      </div>

      <div className="mb-6">
        <PlayerPitchSection playerId={player.id} />
      </div>

      <div className="mb-6">
        <PlayerStatsSection playerId={player.id} teamHistory={player.teamHistory ?? []} />
      </div>

      <div className="mb-6 rounded-lg bg-white p-6 shadow">
        <h2 className="mb-4 text-lg font-bold">Información</h2>
        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <InfoField
            label="Fecha de nacimiento"
            value={
              player.dateOfBirth
                ? `${player.dateOfBirth.slice(0, 10)}${age !== null ? ` (${age} años)` : ''}`
                : undefined
            }
          />
          <InfoField label="Lugar de nacimiento" value={player.birthPlace} />
          <InfoField label="Nacionalidad" value={player.nationality} />
          <InfoField label="Posición" value={player.position} />
          <InfoField label="Número de camiseta" value={player.squadNumber?.toString()} />
          <InfoField label="Altura" value={player.heightCm ? `${player.heightCm} cm` : undefined} />
          <InfoField label="Pie dominante" value={player.preferredFoot ? player.preferredFoot[0].toUpperCase() + player.preferredFoot.slice(1) : undefined} />
          <InfoField label="Origen" value={DATA_ORIGIN_LABELS[player.dataOrigin] ?? player.dataOrigin} />
        </dl>
      </div>

      <div className="mb-6 rounded-lg bg-white p-6 shadow">
        <h2 className="mb-4 text-lg font-bold">Historial de equipos</h2>
        {!player.teamHistory || player.teamHistory.length === 0 ? (
          <p className="text-slate-500">Sin historial de equipos registrado.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {player.teamHistory.map((h) => (
              <li key={h.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <button
                  type="button"
                  onClick={() => navigate(`/equipos/${h.teamId}`)}
                  className="font-medium text-blue-600 hover:underline"
                >
                  {h.teamName}
                </button>
                <span className="text-sm text-slate-500">
                  {h.seasonLabel ? `${h.seasonLabel} · ` : ''}
                  {h.startDate.slice(0, 10)} — {h.endDate ? h.endDate.slice(0, 10) : 'Actual'}
                  {h.squadNumber ? ` · #${h.squadNumber}` : ''}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {(player.externalSource || player.externalUrl) && (
        <div className="mt-6 rounded-lg bg-white p-6 shadow">
          <h2 className="mb-1 text-lg font-bold">Fuentes</h2>
          <p className="text-sm text-slate-600">
            {player.externalSource}
            {player.externalUrl && (
              <>
                {' — '}
                <a href={player.externalUrl} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">
                  ver fuente
                </a>
              </>
            )}
          </p>
          {player.lastSyncedAt && <p className="text-xs text-slate-400">Última consulta: {player.lastSyncedAt.slice(0, 10)}</p>}
        </div>
      )}
    </div>
  )
}

// Historial navegable por período (Fase 11 del pedido): elegir una temporada del historial real de
// clubes recalcula las estadísticas SÓLO de ese período -- nunca duplica al jugador, sólo cambia el
// alcance de la consulta (misma persona, mismo id, distinto filtro temporal).
function PlayerStatsSection({ playerId, teamHistory }: { playerId: number; teamHistory: import('../../types/player').PlayerTeamHistoryEntry[] }) {
  const [summary, setSummary] = useState<PlayerSummary | null>(null)
  const [seasonId, setSeasonId] = useState<number | null>(null)

  useEffect(() => {
    setSummary(null)
    const qs = seasonId ? `?seasonId=${seasonId}` : ''
    api
      .get<PlayerSummary>(`/stats/players/${playerId}/summary${qs}`)
      .then(setSummary)
      .catch(() => setSummary(null))
  }, [playerId, seasonId])

  const periods = teamHistory.filter((h) => h.seasonId != null)

  return (
    <div className="rounded-lg bg-white p-6 shadow">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-bold">Estadísticas</h2>
        {periods.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => setSeasonId(null)}
              className={`rounded-full px-3 py-1 text-xs font-medium ${seasonId === null ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
            >
              Toda la carrera
            </button>
            {periods.map((h) => (
              <button
                key={h.id}
                type="button"
                onClick={() => setSeasonId(h.seasonId)}
                className={`rounded-full px-3 py-1 text-xs font-medium ${seasonId === h.seasonId ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
              >
                {h.seasonLabel} · {h.teamName}
              </button>
            ))}
          </div>
        )}
      </div>
      <p className="mb-4 text-sm text-slate-400">Calculadas en tiempo real a partir de los partidos registrados.</p>
      {!summary ? (
        <p className="text-slate-500">Cargando...</p>
      ) : (
        <dl className="grid grid-cols-2 gap-4 sm:grid-cols-5">
          <StatValue label="Partidos" value={summary.matchesPlayed} />
          <StatValue label="Goles" value={summary.goals} />
          <StatValue label="Asistencias" value={summary.assists} />
          <StatValue label="Amarillas" value={summary.yellowCards} />
          <StatValue label="Rojas" value={summary.redCards} />
        </dl>
      )}
    </div>
  )
}

function PlayerPitchSection({ playerId }: { playerId: number }) {
  const [positions, setPositions] = useState<PlayerPositionEntry[]>([])

  useEffect(() => {
    api
      .get<PlayerPositionEntry[]>(`/players/${playerId}/positions`)
      .then(setPositions)
      .catch(() => setPositions([]))
  }, [playerId])

  return (
    <PlayerPitchViz positions={positions.map((p) => ({ minute: p.minute, posX: p.posX, posY: p.posY, weight: p.weight }))} />
  )
}

function StatValue({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <dt className="text-sm text-slate-500">{label}</dt>
      <dd className="text-xl font-bold text-slate-900">{value}</dd>
    </div>
  )
}

function InfoField({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <dt className="text-sm text-slate-500">{label}</dt>
      <dd className="font-medium text-slate-900">{value || '—'}</dd>
    </div>
  )
}
