import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ApiError } from '../../context/AuthContext'
import { api } from '../../services/api'
import {
  FORMAT_LABELS,
  STATUS_LABELS,
  type InformalTournament,
  type TournamentFormat,
  type TournamentStatus,
} from '../../types/informalTournament'

const STATUS_BADGE: Record<TournamentStatus, string> = {
  abierto: 'bg-blue-100 text-blue-700',
  en_curso: 'bg-green-100 text-green-700',
  finalizado: 'bg-slate-200 text-slate-600',
}

export default function InformalTournamentsListPage() {
  const [items, setItems] = useState<InformalTournament[] | null>(null)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const navigate = useNavigate()

  const load = () => {
    const params = new URLSearchParams()
    if (search) params.set('search', search)
    if (status) params.set('status', status)
    api
      .get<InformalTournament[]>(`/informal-tournaments?${params.toString()}`)
      .then(setItems)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Error al cargar torneos'))
  }

  useEffect(() => {
    const timeout = setTimeout(load, 250)
    return () => clearTimeout(timeout)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, status])

  const handleDelete = async (t: InformalTournament) => {
    if (!window.confirm(`¿Eliminar el torneo "${t.name}"? Esta acción no se puede deshacer.`)) return
    try {
      await api.delete(`/informal-tournaments/${t.id}`)
      load()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Error al eliminar')
    }
  }

  const fmtDate = (d?: string | null) => (d ? new Date(d).toLocaleDateString() : '—')

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold sm:text-3xl">🎪 Torneos informales</h1>
        <button
          type="button"
          onClick={() => navigate('/torneos/nuevo')}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          + Nuevo torneo
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
          <option value="abierto">Abiertos</option>
          <option value="en_curso">En curso</option>
          <option value="finalizado">Finalizados</option>
        </select>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-400 bg-red-100 px-4 py-3 text-red-700">{error}</div>
      )}

      <div className="overflow-x-auto rounded-lg bg-white shadow">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="border-b border-slate-200 text-slate-500">
            <tr>
              <th className="px-4 py-3">Nombre</th>
              <th className="px-4 py-3">Formato</th>
              <th className="px-4 py-3">Fechas</th>
              <th className="px-4 py-3">Lugar</th>
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
                    onClick={() => navigate(`/torneos/${t.id}/editar`)}
                    className="font-medium text-blue-600 hover:underline"
                  >
                    {t.name}
                  </button>
                </td>
                <td className="px-4 py-3 text-slate-600">
                  {t.format ? FORMAT_LABELS[t.format as TournamentFormat] ?? t.format : '—'}
                </td>
                <td className="px-4 py-3 text-slate-600">
                  {fmtDate(t.startDate)}
                  {t.endDate ? ` → ${fmtDate(t.endDate)}` : ''}
                </td>
                <td className="px-4 py-3 text-slate-600">{t.location || '—'}</td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[t.status] ?? 'bg-slate-200 text-slate-600'}`}
                  >
                    {STATUS_LABELS[t.status] ?? t.status}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-3 text-sm">
                    <button
                      type="button"
                      onClick={() => navigate(`/torneos/${t.id}/editar`)}
                      className="text-slate-600 hover:underline"
                    >
                      Editar
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
        {items?.length === 0 && (
          <p className="p-6 text-center text-slate-500">No hay torneos informales todavía.</p>
        )}
        {!items && !error && <p className="p-6 text-center text-slate-500">Cargando...</p>}
      </div>
    </div>
  )
}
