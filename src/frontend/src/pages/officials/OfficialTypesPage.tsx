import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import StatusBadge from '../../components/StatusBadge'
import { ApiError } from '../../context/AuthContext'
import { api } from '../../services/api'
import type { OfficialType } from '../../types/official'

export default function OfficialTypesPage() {
  const navigate = useNavigate()
  const [types, setTypes] = useState<OfficialType[] | null>(null)
  const [newName, setNewName] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const load = () => {
    api
      .get<OfficialType[]>('/official-types')
      .then(setTypes)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'No fue posible cargar los tipos'))
  }

  useEffect(load, [])

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    if (!newName.trim()) return
    setSaving(true)
    try {
      await api.post('/official-types', { name: newName.trim() })
      setNewName('')
      load()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Error al crear el tipo')
    } finally {
      setSaving(false)
    }
  }

  const handleToggleStatus = async (t: OfficialType) => {
    const next = t.status === 'active' ? 'inactive' : 'active'
    try {
      await api.patch(`/official-types/${t.id}/status`, { status: next })
      load()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Error al cambiar el estado')
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
      <div className="mb-6 flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold sm:text-3xl">⚙ Tipos de oficial</h1>
        <button
          type="button"
          onClick={() => navigate('/oficiales')}
          className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
        >
          ← Volver a Oficiales
        </button>
      </div>

      <p className="mb-6 text-sm text-slate-500">
        Los tipos desactivados dejan de aparecer para elegir en un oficial nuevo, pero los oficiales
        que ya los tienen asignados no se ven afectados.
      </p>

      {error && (
        <div className="mb-4 rounded-lg border border-red-400 bg-red-100 px-4 py-3 text-red-700">{error}</div>
      )}

      <form onSubmit={handleCreate} className="mb-6 flex gap-3">
        <input
          type="text"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="Nombre del nuevo tipo (ej. Delegado de campo)"
          className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          type="submit"
          disabled={saving || !newName.trim()}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? 'Agregando...' : '+ Agregar'}
        </button>
      </form>

      {!types && <p className="text-slate-500">Cargando...</p>}

      {types && (
        <div className="overflow-hidden rounded-lg bg-white shadow">
          <ul className="divide-y divide-slate-100">
            {types.map((t) => (
              <li key={t.id} className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-3">
                  <span className="font-medium text-slate-900">{t.name}</span>
                  <StatusBadge status={t.status} />
                </div>
                <button
                  type="button"
                  onClick={() => handleToggleStatus(t)}
                  className="text-sm text-slate-600 hover:underline"
                >
                  {t.status === 'active' ? 'Desactivar' : 'Activar'}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
