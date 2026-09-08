import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ApiError } from '../../context/AuthContext'
import { exportToCsv } from '../../lib/csv'
import { api } from '../../services/api'
import type { Competition } from '../../types/competition'
import type { Team } from '../../types/team'

export default function TeamsListPage() {
  const [items, setItems] = useState<Team[] | null>(null)
  const [competitions, setCompetitions] = useState<Competition[]>([])
  const [search, setSearch] = useState('')
  const [competitionId, setCompetitionId] = useState('')
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const navigate = useNavigate()

  useEffect(() => {
    api.get<Competition[]>('/competitions').then(setCompetitions).catch(() => {})
  }, [])

  const load = () => {
    const params = new URLSearchParams()
    if (search) params.set('search', search)
    if (competitionId) params.set('competitionId', competitionId)
    if (status) params.set('status', status)
    api
      .get<Team[]>(`/teams?${params.toString()}`)
      .then(setItems)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Error al cargar equipos'))
  }

  useEffect(() => {
    const timeout = setTimeout(load, 250)
    return () => clearTimeout(timeout)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, competitionId, status])

  const handleToggleStatus = async (t: Team) => {
    const next = t.status === 'active' ? 'inactive' : 'active'
    try {
      await api.patch(`/teams/${t.id}/status`, { status: next })
      load()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Error al cambiar el estado')
    }
  }

  const handleDelete = async (t: Team) => {
    if (!window.confirm(`¿Eliminar el equipo "${t.name}"? Esta acción no se puede deshacer.`)) return
    try {
      await api.delete(`/teams/${t.id}`)
      load()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Error al eliminar')
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold sm:text-3xl">⚽ Equipos</h1>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() =>
              items &&
              exportToCsv('equipos.csv', items, [
                { key: 'name', label: 'Nombre' },
                { key: 'city', label: 'Ciudad' },
                { key: 'country', label: 'País' },
                { key: 'status', label: 'Estado' },
              ])
            }
            disabled={!items || items.length === 0}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-40"
          >
            ⬇ Exportar CSV
          </button>
          <button
            type="button"
            onClick={() => navigate('/equipos/nuevo')}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            + Nuevo equipo
          </button>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap gap-3">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nombre..."
          className="flex-1 min-w-[200px] rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <select
          value={competitionId}
          onChange={(e) => setCompetitionId(e.target.value)}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Todas las competiciones</option>
          {competitions.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
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
        <div className="mb-4 rounded-lg border border-red-400 bg-red-100 px-4 py-3 text-red-700">{error}</div>
      )}

      <div className="overflow-x-auto rounded-lg bg-white shadow">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="border-b border-slate-200 text-slate-500">
            <tr>
              <th className="px-4 py-3">Nombre</th>
              <th className="px-4 py-3">País</th>
              <th className="px-4 py-3">Ciudad</th>
              <th className="px-4 py-3">Estado</th>
              <th className="px-4 py-3 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {items?.map((t) => (
              <tr key={t.id}>
                <td className="px-4 py-3">
                  <button
                    type="button"
                    onClick={() => navigate(`/equipos/${t.id}`)}
                    className="font-medium text-blue-600 hover:underline"
                  >
                    {t.name}
                  </button>
                </td>
                <td className="px-4 py-3 text-slate-600">{t.country ?? '—'}</td>
                <td className="px-4 py-3 text-slate-600">{t.city ?? '—'}</td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      t.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-slate-200 text-slate-600'
                    }`}
                  >
                    {t.status === 'active' ? 'Activo' : 'Inactivo'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-3 text-sm">
                    <button
                      type="button"
                      onClick={() => navigate(`/equipos/${t.id}/editar`)}
                      className="text-slate-600 hover:underline"
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      onClick={() => handleToggleStatus(t)}
                      className="text-slate-600 hover:underline"
                    >
                      {t.status === 'active' ? 'Desactivar' : 'Activar'}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(t)}
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
        {items?.length === 0 && <p className="p-6 text-center text-slate-500">No hay equipos todavía.</p>}
        {!items && !error && <p className="p-6 text-center text-slate-500">Cargando...</p>}
      </div>
    </div>
  )
}
