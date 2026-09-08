import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Avatar from '../../components/Avatar'
import StatusBadge from '../../components/StatusBadge'
import { ApiError } from '../../context/AuthContext'
import { exportToCsv } from '../../lib/csv'
import { api } from '../../services/api'
import { PLAYER_POSITIONS } from '../../types/player'
import type { Player, PlayerListResponse } from '../../types/player'
import type { Team } from '../../types/team'

const PAGE_SIZE = 25

export default function PlayersListPage() {
  const [data, setData] = useState<PlayerListResponse | null>(null)
  const [teams, setTeams] = useState<Team[]>([])
  const [search, setSearch] = useState('')
  const [teamId, setTeamId] = useState('')
  const [position, setPosition] = useState('')
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)
  const [error, setError] = useState('')
  const navigate = useNavigate()

  useEffect(() => {
    api.get<Team[]>('/teams').then(setTeams).catch(() => {})
  }, [])

  const load = () => {
    const params = new URLSearchParams()
    if (search) params.set('search', search)
    if (teamId) params.set('teamId', teamId)
    if (position) params.set('position', position)
    if (status) params.set('status', status)
    params.set('page', String(page))
    params.set('pageSize', String(PAGE_SIZE))
    api
      .get<PlayerListResponse>(`/players?${params.toString()}`)
      .then(setData)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'No fue posible cargar los jugadores'))
  }

  useEffect(() => {
    const timeout = setTimeout(load, 250)
    return () => clearTimeout(timeout)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, teamId, position, status, page])

  // cualquier cambio de filtro vuelve a la página 1 (si no, se puede quedar "colgado" en una
  // página que ya no existe para el nuevo filtro)
  useEffect(() => {
    setPage(1)
  }, [search, teamId, position, status])

  const handleToggleStatus = async (p: Player) => {
    const next = p.status === 'active' ? 'inactive' : 'active'
    try {
      await api.patch(`/players/${p.id}/status`, { status: next })
      load()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Error al cambiar el estado')
    }
  }

  const handleDelete = async (p: Player) => {
    if (!window.confirm(`¿Eliminar al jugador "${p.fullName}"? Esta acción puede afectar información relacionada.`)) {
      return
    }
    try {
      await api.delete(`/players/${p.id}`)
      load()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Error al eliminar')
    }
  }

  const items = data?.items ?? null
  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  const handleExportCsv = async () => {
    const params = new URLSearchParams()
    if (search) params.set('search', search)
    if (teamId) params.set('teamId', teamId)
    if (position) params.set('position', position)
    if (status) params.set('status', status)
    params.set('pageSize', String(Math.max(total, 1)))
    try {
      const full = await api.get<PlayerListResponse>(`/players?${params.toString()}`)
      exportToCsv(
        'jugadores.csv',
        full.items,
        [
          { key: 'fullName', label: 'Nombre completo' },
          { key: 'position', label: 'Posición' },
          { key: 'teamName', label: 'Equipo' },
          { key: 'nationality', label: 'Nacionalidad' },
          { key: 'status', label: 'Estado' },
        ],
      )
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Error al exportar')
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold sm:text-3xl">👤 Jugadores</h1>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleExportCsv}
            disabled={!items || items.length === 0}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-40"
          >
            ⬇ Exportar CSV
          </button>
          <button
            type="button"
            onClick={() => navigate('/jugadores/nuevo')}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            + Nuevo jugador
          </button>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap gap-3">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nombre o apellido..."
          className="flex-1 min-w-[200px] rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <select
          value={teamId}
          onChange={(e) => setTeamId(e.target.value)}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Todos los equipos</option>
          {teams.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
        <select
          value={position}
          onChange={(e) => setPosition(e.target.value)}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Todas las posiciones</option>
          {PLAYER_POSITIONS.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Todos los estados</option>
          <option value="active">Activos</option>
          <option value="inactive">Inactivos</option>
        </select>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-400 bg-red-100 px-4 py-3 text-red-700">
          {error}
          <button type="button" onClick={load} className="ml-3 font-medium underline">
            Reintentar
          </button>
        </div>
      )}

      {!items && !error && <p className="p-6 text-center text-slate-500">Cargando jugadores...</p>}

      {items && items.length === 0 && (
        <div className="rounded-lg bg-white p-10 text-center shadow">
          <p className="mb-4 text-slate-500">No hay jugadores registrados.</p>
          <button
            type="button"
            onClick={() => navigate('/jugadores/nuevo')}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            + Nuevo jugador
          </button>
        </div>
      )}

      {items && items.length > 0 && (
        <>
          {/* Desktop/tablet: tabla */}
          <div className="hidden overflow-x-auto rounded-lg bg-white shadow sm:block">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="border-b border-slate-200 text-slate-500">
                <tr>
                  <th className="px-4 py-3">Foto</th>
                  <th className="px-4 py-3">Jugador</th>
                  <th className="px-4 py-3">Posición</th>
                  <th className="px-4 py-3">Equipo</th>
                  <th className="px-4 py-3">Estado</th>
                  <th className="px-4 py-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((p) => (
                  <tr key={p.id}>
                    <td className="px-4 py-3">
                      <Avatar photoUrl={p.photoUrl} alt={p.fullName} size={36} />
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => navigate(`/jugadores/${p.id}`)}
                        className="font-medium text-blue-600 hover:underline"
                      >
                        {p.fullName}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{p.position ?? '—'}</td>
                    <td className="px-4 py-3 text-slate-600">{p.teamName ?? '—'}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={p.status} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-3 text-sm">
                        <button
                          type="button"
                          onClick={() => navigate(`/jugadores/${p.id}/editar`)}
                          className="text-slate-600 hover:underline"
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          onClick={() => handleToggleStatus(p)}
                          className="text-slate-600 hover:underline"
                        >
                          {p.status === 'active' ? 'Desactivar' : 'Activar'}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(p)}
                          className="text-red-600 hover:underline"
                        >
                          Eliminar
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile: tarjetas, la tabla no entra legible en una pantalla chica */}
          <div className="space-y-3 sm:hidden">
            {items.map((p) => (
              <div key={p.id} className="rounded-lg bg-white p-4 shadow">
                <div className="flex items-start gap-3">
                  <Avatar photoUrl={p.photoUrl} alt={p.fullName} size={48} />
                  <div className="min-w-0 flex-1">
                    <button
                      type="button"
                      onClick={() => navigate(`/jugadores/${p.id}`)}
                      className="block truncate font-medium text-blue-600 hover:underline"
                    >
                      {p.fullName}
                    </button>
                    <p className="truncate text-sm text-slate-500">
                      {p.position ?? 'Sin posición'} · {p.teamName ?? 'Sin equipo'}
                    </p>
                    <div className="mt-1">
                      <StatusBadge status={p.status} />
                    </div>
                  </div>
                </div>
                <div className="mt-3 flex gap-4 border-t border-slate-100 pt-3 text-sm">
                  <button type="button" onClick={() => navigate(`/jugadores/${p.id}/editar`)} className="text-slate-600">
                    Editar
                  </button>
                  <button type="button" onClick={() => handleToggleStatus(p)} className="text-slate-600">
                    {p.status === 'active' ? 'Desactivar' : 'Activar'}
                  </button>
                  <button type="button" onClick={() => handleDelete(p)} className="text-red-600">
                    Eliminar
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-slate-600">
            <p>
              Mostrando {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} de {total}
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="rounded-lg border border-slate-300 px-3 py-1.5 font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-40"
              >
                Anterior
              </button>
              <span className="px-2 py-1.5">
                Página {page} de {totalPages}
              </span>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="rounded-lg border border-slate-300 px-3 py-1.5 font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-40"
              >
                Siguiente
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
