import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ApiError } from '../../context/AuthContext'
import { api } from '../../services/api'
import type { Competition } from '../../types/competition'

export default function CompetitionsListPage() {
  const [items, setItems] = useState<Competition[] | null>(null)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const navigate = useNavigate()

  const load = () => {
    const params = new URLSearchParams()
    if (search) params.set('search', search)
    if (status) params.set('status', status)
    api
      .get<Competition[]>(`/competitions?${params.toString()}`)
      .then(setItems)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Error al cargar competiciones'))
  }

  useEffect(() => {
    const timeout = setTimeout(load, 250)
    return () => clearTimeout(timeout)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, status])

  const handleToggleStatus = async (c: Competition) => {
    const next = c.status === 'active' ? 'inactive' : 'active'
    try {
      await api.patch(`/competitions/${c.id}/status`, { status: next })
      load()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Error al cambiar el estado')
    }
  }

  const handleDelete = async (c: Competition) => {
    if (!window.confirm(`¿Eliminar la competición "${c.name}"? Esta acción no se puede deshacer.`)) return
    try {
      await api.delete(`/competitions/${c.id}`)
      load()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Error al eliminar')
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold sm:text-3xl">🏆 Competiciones</h1>
        <button
          type="button"
          onClick={() => navigate('/competiciones/nueva')}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          + Nueva competición
        </button>
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
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Todos los estados</option>
          <option value="active">Activas</option>
          <option value="inactive">Inactivas</option>
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
              <th className="px-4 py-3">Deporte</th>
              <th className="px-4 py-3">Temporada</th>
              <th className="px-4 py-3">Estado</th>
              <th className="px-4 py-3 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {items?.map((c) => (
              <tr key={c.id}>
                <td className="px-4 py-3">
                  <button
                    type="button"
                    onClick={() => navigate(`/competiciones/${c.id}`)}
                    className="font-medium text-blue-600 hover:underline"
                  >
                    {c.name}
                  </button>
                </td>
                <td className="px-4 py-3 text-slate-600">{c.sport}</td>
                <td className="px-4 py-3 text-slate-600">{c.seasonYear ?? '—'}</td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      c.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-slate-200 text-slate-600'
                    }`}
                  >
                    {c.status === 'active' ? 'Activa' : 'Inactiva'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-3 text-sm">
                    <button
                      type="button"
                      onClick={() => navigate(`/competiciones/${c.id}/editar`)}
                      className="text-slate-600 hover:underline"
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      onClick={() => handleToggleStatus(c)}
                      className="text-slate-600 hover:underline"
                    >
                      {c.status === 'active' ? 'Desactivar' : 'Activar'}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(c)}
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
        {items?.length === 0 && (
          <p className="p-6 text-center text-slate-500">No hay competiciones todavía.</p>
        )}
        {!items && !error && <p className="p-6 text-center text-slate-500">Cargando...</p>}
      </div>
    </div>
  )
}
