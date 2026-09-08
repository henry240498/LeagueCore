import { useEffect, useState, type FormEvent } from 'react'
import StatusBadge from '../../components/StatusBadge'
import { ApiError, useAuth } from '../../context/AuthContext'
import { api } from '../../services/api'
import type { Parameter, ParameterCategory } from '../../types/parameter'

export default function ParametersPage() {
  const { user } = useAuth()
  const [categories, setCategories] = useState<ParameterCategory[] | null>(null)
  const [selected, setSelected] = useState<string | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    api
      .get<ParameterCategory[]>('/parameter-categories')
      .then((cats) => {
        setCategories(cats)
        if (cats.length > 0) setSelected(cats[0].code)
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Error al cargar las categorías'))
  }, [])

  const current = categories?.find((c) => c.code === selected) ?? null

  // El backend rechaza igual estos endpoints (AdminOnlyGuard) -- esto es sólo para no mostrarle el
  // formulario a alguien que no puede usarlo, mismo patrón que SecurityPage.tsx. Va después de
  // todos los hooks (Rules of Hooks: un return anticipado nunca puede quedar antes de un hook).
  if (user?.role !== 'admin') {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center sm:px-6">
        <h1 className="mb-2 text-2xl font-bold">Acceso denegado</h1>
        <p className="text-slate-600">No tenés permisos para acceder a Parametrizaciones.</p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <h1 className="mb-1 text-2xl font-bold sm:text-3xl">🧩 Parametrizaciones</h1>
      <p className="mb-6 text-sm text-slate-500">
        Catálogos de valores usados en distintos módulos del sistema. Cada categoría indica en qué
        parte de LeagueCore se utiliza.
      </p>

      {error && (
        <div className="mb-4 rounded-lg border border-red-400 bg-red-100 px-4 py-3 text-red-700">{error}</div>
      )}

      {!categories && !error && <p className="text-slate-500">Cargando...</p>}

      {categories && (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          <div className="md:col-span-1">
            <ul className="overflow-hidden rounded-lg bg-white shadow">
              {categories.map((c) => (
                <li key={c.code}>
                  <button
                    type="button"
                    onClick={() => setSelected(c.code)}
                    className={`block w-full border-b border-slate-100 px-4 py-3 text-left text-sm last:border-0 ${
                      selected === c.code ? 'bg-blue-50 font-medium text-blue-700' : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    {c.name}
                  </button>
                </li>
              ))}
            </ul>
          </div>
          <div className="md:col-span-2">{current && <CategoryValues category={current} />}</div>
        </div>
      )}
    </div>
  )
}

function CategoryValues({ category }: { category: ParameterCategory }) {
  const [values, setValues] = useState<Parameter[] | null>(null)
  const [newCode, setNewCode] = useState('')
  const [newLabel, setNewLabel] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const load = () => {
    api
      .get<Parameter[]>(`/parameter-categories/${category.code}/parameters?includeInactive=true`)
      .then(setValues)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Error al cargar los valores'))
  }

  useEffect(() => {
    setValues(null)
    setError('')
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category.code])

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    if (!newCode.trim() || !newLabel.trim()) return
    setSaving(true)
    try {
      await api.post(`/parameter-categories/${category.code}/parameters`, {
        code: newCode.trim(),
        label: newLabel.trim(),
      })
      setNewCode('')
      setNewLabel('')
      load()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Error al crear el valor')
    } finally {
      setSaving(false)
    }
  }

  const handleToggleActive = async (p: Parameter) => {
    setError('')
    try {
      await api.patch(`/parameters/${p.id}/active`, { isActive: !p.isActive })
      load()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Error al cambiar el estado')
    }
  }

  const handleDelete = async (p: Parameter) => {
    if (!window.confirm(`¿Eliminar el valor "${p.label}"?`)) return
    setError('')
    try {
      await api.delete(`/parameters/${p.id}`)
      load()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Error al eliminar')
    }
  }

  return (
    <div className="rounded-lg bg-white p-6 shadow">
      <h2 className="text-lg font-bold">{category.name}</h2>
      {category.description && <p className="mt-1 text-sm text-slate-500">{category.description}</p>}
      {category.usedIn && (
        <p className="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
          <span className="font-medium text-slate-600">Dónde se usa: </span>
          {category.usedIn}
        </p>
      )}

      {error && (
        <div className="mt-4 rounded-lg border border-red-400 bg-red-100 px-4 py-3 text-red-700">{error}</div>
      )}

      <form onSubmit={handleCreate} className="mt-4 flex flex-wrap gap-2">
        <input
          type="text"
          value={newCode}
          onChange={(e) => setNewCode(e.target.value)}
          placeholder="Código (ej. friendly)"
          className="w-40 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <input
          type="text"
          value={newLabel}
          onChange={(e) => setNewLabel(e.target.value)}
          placeholder="Etiqueta visible (ej. Amistoso)"
          className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          type="submit"
          disabled={saving || !newCode.trim() || !newLabel.trim()}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? 'Agregando...' : '+ Agregar'}
        </button>
      </form>

      {!values && !error && <p className="mt-4 text-slate-500">Cargando...</p>}

      {values && (
        <ul className="mt-4 divide-y divide-slate-100">
          {values.map((p) => (
            <li key={p.id} className="flex items-center justify-between py-2">
              <div className="flex items-center gap-2">
                <span className={`font-medium ${p.isActive ? 'text-slate-900' : 'text-slate-400 line-through'}`}>
                  {p.label}
                </span>
                <span className="text-xs text-slate-400">({p.code})</span>
                {!p.isActive && <StatusBadge status="inactive" />}
                {p.isSystem && (
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">base</span>
                )}
              </div>
              <div className="flex items-center gap-3 text-sm">
                <button type="button" onClick={() => handleToggleActive(p)} className="text-slate-600 hover:underline">
                  {p.isActive ? 'Desactivar' : 'Activar'}
                </button>
                {!p.isSystem && (
                  <button type="button" onClick={() => handleDelete(p)} className="text-red-600 hover:underline">
                    Eliminar
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
