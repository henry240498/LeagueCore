import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ApiError } from '../../context/AuthContext'
import { resolveAssetUrl } from '../../lib/assetUrl'
import { exportToCsv } from '../../lib/csv'
import { api } from '../../services/api'
import type { Venue } from '../../types/venue'

export default function VenuesListPage() {
  const [items, setItems] = useState<Venue[] | null>(null)
  const [search, setSearch] = useState('')
  const [error, setError] = useState('')
  const navigate = useNavigate()

  const load = () => {
    const params = new URLSearchParams()
    if (search) params.set('search', search)
    api
      .get<Venue[]>(`/venues?${params.toString()}`)
      .then(setItems)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Error al cargar estadios'))
  }

  useEffect(() => {
    const timeout = setTimeout(load, 250)
    return () => clearTimeout(timeout)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search])

  const handleDelete = async (v: Venue) => {
    if (!window.confirm(`¿Eliminar el estadio "${v.name}"? Esta acción no se puede deshacer.`)) return
    try {
      await api.delete(`/venues/${v.id}`)
      load()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Error al eliminar')
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold sm:text-3xl">🏟️ Estadios</h1>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() =>
              items &&
              exportToCsv('estadios.csv', items, [
                { key: 'name', label: 'Nombre' },
                { key: 'city', label: 'Ciudad' },
                { key: 'country', label: 'País' },
                { key: 'capacity', label: 'Capacidad' },
                { key: 'openedYear', label: 'Año de apertura' },
              ])
            }
            disabled={!items || items.length === 0}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-40"
          >
            ⬇ Exportar CSV
          </button>
          <button
            type="button"
            onClick={() => navigate('/estadios/nuevo')}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            + Nuevo estadio
          </button>
        </div>
      </div>

      <div className="mb-4">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nombre..."
          className="w-full min-w-[200px] rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 sm:max-w-sm"
        />
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-400 bg-red-100 px-4 py-3 text-red-700">{error}</div>
      )}

      <div className="overflow-x-auto rounded-lg bg-white shadow">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="border-b border-slate-200 text-slate-500">
            <tr>
              <th className="px-4 py-3"></th>
              <th className="px-4 py-3">Nombre</th>
              <th className="px-4 py-3">Ciudad</th>
              <th className="px-4 py-3">País</th>
              <th className="px-4 py-3">Capacidad</th>
              <th className="px-4 py-3 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {items?.map((v) => {
              const photoUrl = resolveAssetUrl(v.photoUrl)
              return (
                <tr key={v.id}>
                  <td className="px-4 py-2">
                    <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-lg bg-slate-100">
                      {photoUrl ? (
                        <img src={photoUrl} alt={v.name} className="h-full w-full object-cover" />
                      ) : (
                        <span className="text-lg">🏟️</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => navigate(`/estadios/${v.id}`)}
                      className="font-medium text-blue-600 hover:underline"
                    >
                      {v.name}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{v.city ?? '—'}</td>
                  <td className="px-4 py-3 text-slate-600">{v.country ?? '—'}</td>
                  <td className="px-4 py-3 text-slate-600">{v.capacity ?? '—'}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-3 text-sm">
                      <button
                        type="button"
                        onClick={() => navigate(`/estadios/${v.id}/editar`)}
                        className="text-slate-600 hover:underline"
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(v)}
                        className="text-red-600 hover:underline"
                      >
                        Eliminar
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {items?.length === 0 && <p className="p-6 text-center text-slate-500">No hay estadios todavía.</p>}
        {!items && !error && <p className="p-6 text-center text-slate-500">Cargando...</p>}
      </div>
    </div>
  )
}
