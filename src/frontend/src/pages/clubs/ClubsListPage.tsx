import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ApiError } from '../../context/AuthContext'
import { clubsService } from '../../services/clubs'
import type { Club } from '../../types/club'

export default function ClubsListPage() {
  const [items, setItems] = useState<Club[] | null>(null)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const navigate = useNavigate()

  const load = () => {
    clubsService
      .list({ search: search || undefined, status: status || undefined })
      .then(setItems)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Error al cargar clubes'))
  }

  useEffect(() => {
    const timeout = setTimeout(load, 250)
    return () => clearTimeout(timeout)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, status])

  const handleToggleStatus = async (c: Club) => {
    const next = c.status === 'active' ? 'inactive' : 'active'
    try {
      await clubsService.setStatus(c.id, next)
      load()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Error al cambiar el estado')
    }
  }

  const handleDelete = async (c: Club) => {
    if (!window.confirm(`¿Eliminar el club "${c.name}"? Esta acción no se puede deshacer.`)) return
    try {
      await clubsService.remove(c.id)
      load()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Error al eliminar')
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold sm:text-3xl">🏟️ Clubes</h1>
        <button
          type="button"
          onClick={() => navigate('/clubes/nuevo')}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          + Nuevo club
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
          <option value="active">Activos</option>
          <option value="inactive">Inactivos</option>
        </select>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-400 bg-red-100 px-4 py-3 text-red-700">{error}</div>
      )}

      <div className="overflow-x-auto rounded-lg bg-white shadow">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="border-b border-slate-200 text-slate-500">
            <tr>
              <th className="px-4 py-3">Club</th>
              <th className="px-4 py-3">País</th>
              <th className="px-4 py-3">Equipos</th>
              <th className="px-4 py-3">Staff</th>
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
                    onClick={() => navigate(`/clubes/${c.id}`)}
                    className="flex items-center gap-2 font-medium text-blue-600 hover:underline"
                  >
                    {c.primaryColor && (
                      <span
                        className="inline-block h-4 w-4 rounded-full border border-slate-300"
                        style={{ backgroundColor: c.primaryColor }}
                        aria-hidden
                      />
                    )}
                    {c.name}
                  </button>
                  {c.city && <p className="text-xs text-slate-500">{c.city}</p>}
                </td>
                <td className="px-4 py-3 text-slate-600">{c.country ?? '—'}</td>
                <td className="px-4 py-3 text-slate-600">{c.teamsCount}</td>
                <td className="px-4 py-3 text-slate-600">{c.staffCount}</td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      c.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-slate-200 text-slate-600'
                    }`}
                  >
                    {c.status === 'active' ? 'Activo' : 'Inactivo'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-3 text-sm">
                    <button
                      type="button"
                      onClick={() => navigate(`/clubes/${c.id}/editar`)}
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
        {items?.length === 0 && <p className="p-6 text-center text-slate-500">No hay clubes todavía.</p>}
        {!items && !error && <p className="p-6 text-center text-slate-500">Cargando...</p>}
      </div>
    </div>
  )
}
