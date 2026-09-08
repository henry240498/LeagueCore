import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Avatar from '../../components/Avatar'
import StatusBadge from '../../components/StatusBadge'
import { ApiError } from '../../context/AuthContext'
import { api } from '../../services/api'
import type { Official, OfficialListResponse, OfficialType } from '../../types/official'

const PAGE_SIZE = 25

export default function OfficialsListPage() {
  const [data, setData] = useState<OfficialListResponse | null>(null)
  const [types, setTypes] = useState<OfficialType[]>([])
  const [nationalities, setNationalities] = useState<string[]>([])
  const [search, setSearch] = useState('')
  const [officialTypeId, setOfficialTypeId] = useState('')
  const [nationality, setNationality] = useState('')
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)
  const [error, setError] = useState('')
  const navigate = useNavigate()

  useEffect(() => {
    api.get<OfficialType[]>('/official-types').then(setTypes).catch(() => {})
    api.get<string[]>('/officials/nationalities').then(setNationalities).catch(() => {})
  }, [])

  const load = () => {
    const params = new URLSearchParams()
    if (search) params.set('search', search)
    if (officialTypeId) params.set('officialTypeId', officialTypeId)
    if (nationality) params.set('nationality', nationality)
    if (status) params.set('status', status)
    params.set('page', String(page))
    params.set('pageSize', String(PAGE_SIZE))
    api
      .get<OfficialListResponse>(`/officials?${params.toString()}`)
      .then(setData)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'No fue posible cargar los oficiales'))
  }

  useEffect(() => {
    const timeout = setTimeout(load, 250)
    return () => clearTimeout(timeout)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, officialTypeId, nationality, status, page])

  useEffect(() => {
    setPage(1)
  }, [search, officialTypeId, nationality, status])

  const handleToggleStatus = async (o: Official) => {
    const next = o.status === 'active' ? 'inactive' : 'active'
    try {
      await api.patch(`/officials/${o.id}/status`, { status: next })
      load()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Error al cambiar el estado')
    }
  }

  const handleDelete = async (o: Official) => {
    if (!window.confirm(`¿Eliminar al oficial "${o.fullName}"? Esta acción puede afectar información relacionada.`)) {
      return
    }
    try {
      await api.delete(`/officials/${o.id}`)
      load()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Error al eliminar')
    }
  }

  const items = data?.items ?? null
  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold sm:text-3xl">🧑‍⚖️ Oficiales</h1>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => navigate('/oficiales/tipos')}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
          >
            ⚙ Tipos de oficial
          </button>
          <button
            type="button"
            onClick={() => navigate('/oficiales/nuevo')}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            + Nuevo oficial
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
          value={officialTypeId}
          onChange={(e) => setOfficialTypeId(e.target.value)}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Todos los tipos</option>
          {types.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
        <select
          value={nationality}
          onChange={(e) => setNationality(e.target.value)}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Todas las nacionalidades</option>
          {nationalities.map((n) => (
            <option key={n} value={n}>
              {n}
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

      {!items && !error && <p className="p-6 text-center text-slate-500">Cargando oficiales...</p>}

      {items && items.length === 0 && (
        <div className="rounded-lg bg-white p-10 text-center shadow">
          <p className="mb-4 text-slate-500">No hay oficiales registrados.</p>
          <button
            type="button"
            onClick={() => navigate('/oficiales/nuevo')}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            + Nuevo oficial
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
                  <th className="px-4 py-3">Oficial</th>
                  <th className="px-4 py-3">Tipo</th>
                  <th className="px-4 py-3">Nacionalidad</th>
                  <th className="px-4 py-3">Estado</th>
                  <th className="px-4 py-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((o) => (
                  <tr key={o.id}>
                    <td className="px-4 py-3">
                      <Avatar photoUrl={o.photoUrl} alt={o.fullName} size={36} />
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => navigate(`/oficiales/${o.id}`)}
                        className="font-medium text-blue-600 hover:underline"
                      >
                        {o.fullName}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{o.officialTypeName ?? '—'}</td>
                    <td className="px-4 py-3 text-slate-600">{o.nationality ?? '—'}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={o.status} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-3 text-sm">
                        <button
                          type="button"
                          onClick={() => navigate(`/oficiales/${o.id}/editar`)}
                          className="text-slate-600 hover:underline"
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          onClick={() => handleToggleStatus(o)}
                          className="text-slate-600 hover:underline"
                        >
                          {o.status === 'active' ? 'Desactivar' : 'Activar'}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(o)}
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
            {items.map((o) => (
              <div key={o.id} className="rounded-lg bg-white p-4 shadow">
                <div className="flex items-start gap-3">
                  <Avatar photoUrl={o.photoUrl} alt={o.fullName} size={48} />
                  <div className="min-w-0 flex-1">
                    <button
                      type="button"
                      onClick={() => navigate(`/oficiales/${o.id}`)}
                      className="block truncate font-medium text-blue-600 hover:underline"
                    >
                      {o.fullName}
                    </button>
                    <p className="truncate text-sm text-slate-500">
                      {o.officialTypeName ?? 'Sin tipo'} · {o.nationality ?? 'Sin nacionalidad'}
                    </p>
                    <div className="mt-1">
                      <StatusBadge status={o.status} />
                    </div>
                  </div>
                </div>
                <div className="mt-3 flex gap-4 border-t border-slate-100 pt-3 text-sm">
                  <button type="button" onClick={() => navigate(`/oficiales/${o.id}/editar`)} className="text-slate-600">
                    Editar
                  </button>
                  <button type="button" onClick={() => handleToggleStatus(o)} className="text-slate-600">
                    {o.status === 'active' ? 'Desactivar' : 'Activar'}
                  </button>
                  <button type="button" onClick={() => handleDelete(o)} className="text-red-600">
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
