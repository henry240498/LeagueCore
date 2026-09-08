import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ApiError } from '../../context/AuthContext'
import { COUNTRY_SUGGESTIONS } from '../../lib/countries'
import { api } from '../../services/api'
import type { Competition, CompetitionInput } from '../../types/competition'

const EMPTY: CompetitionInput = {
  name: '',
  description: '',
  competitionType: '',
  sport: 'Fútbol',
  country: '',
  status: 'active',
  startDate: '',
  endDate: '',
  organization: '',
  observations: '',
}

export default function CompetitionFormPage() {
  const { id } = useParams()
  const isEdit = !!id
  const navigate = useNavigate()

  const [form, setForm] = useState<CompetitionInput>(EMPTY)
  const [loading, setLoading] = useState(isEdit)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!isEdit) return
    api
      .get<Competition>(`/competitions/${id}`)
      .then((c) =>
        setForm({
          name: c.name,
          description: c.description ?? '',
          competitionType: c.competitionType ?? '',
          sport: c.sport,
          country: c.country ?? '',
          status: c.status,
          startDate: c.startDate?.slice(0, 10) ?? '',
          endDate: c.endDate?.slice(0, 10) ?? '',
          organization: c.organization ?? '',
          observations: c.observations ?? '',
          seasonYear: c.seasonYear ?? undefined,
          pointsWin: c.pointsWin,
          pointsDraw: c.pointsDraw,
          pointsLoss: c.pointsLoss,
        }),
      )
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Error al cargar la competición'))
      .finally(() => setLoading(false))
  }, [id, isEdit])

  const set = <K extends keyof CompetitionInput>(key: K, value: CompetitionInput[K]) =>
    setForm((f) => ({ ...f, [key]: value }))

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setSaving(true)
    try {
      const payload = {
        ...form,
        startDate: form.startDate || undefined,
        endDate: form.endDate || undefined,
      }
      if (isEdit) {
        await api.put(`/competitions/${id}`, payload)
      } else {
        const created = await api.post<Competition>('/competitions', payload)
        navigate(`/competiciones/${created.id}`)
        return
      }
      navigate(`/competiciones/${id}`)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Error al guardar la competición')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <p className="p-8 text-center text-slate-500">Cargando...</p>

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
      <h1 className="mb-6 text-2xl font-bold sm:text-3xl">
        {isEdit ? 'Editar competición' : 'Nueva competición'}
      </h1>

      {error && (
        <div className="mb-4 rounded-lg border border-red-400 bg-red-100 px-4 py-3 text-red-700">{error}</div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4 rounded-lg bg-white p-6 shadow">
        <Field label="Nombre *" value={form.name} onChange={(v) => set('name', v)} required />
        <Field
          label="Descripción"
          value={form.description ?? ''}
          onChange={(v) => set('description', v)}
          textarea
        />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Tipo" value={form.competitionType ?? ''} onChange={(v) => set('competitionType', v)} />
          <Field label="Deporte" value={form.sport ?? ''} onChange={(v) => set('sport', v)} />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">País</label>
          <input
            list="competition-country-suggestions"
            type="text"
            value={form.country ?? ''}
            onChange={(e) => set('country', e.target.value)}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <datalist id="competition-country-suggestions">
            {COUNTRY_SUGGESTIONS.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
          <p className="mt-1 text-xs text-slate-400">
            Distingue competiciones con el mismo nombre en países distintos (ej. "Primera División" en Paraguay vs. Argentina).
          </p>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field
            label="Temporada (año)"
            type="number"
            value={form.seasonYear?.toString() ?? ''}
            onChange={(v) => set('seasonYear', v ? Number(v) : undefined)}
          />
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Estado</label>
            <select
              value={form.status}
              onChange={(e) => set('status', e.target.value as 'active' | 'inactive')}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="active">Activa</option>
              <option value="inactive">Inactiva</option>
            </select>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Fecha de inicio" type="date" value={form.startDate ?? ''} onChange={(v) => set('startDate', v)} />
          <Field label="Fecha de fin" type="date" value={form.endDate ?? ''} onChange={(v) => set('endDate', v)} />
        </div>
        <Field label="Organización" value={form.organization ?? ''} onChange={(v) => set('organization', v)} />
        <Field
          label="Observaciones"
          value={form.observations ?? ''}
          onChange={(v) => set('observations', v)}
          textarea
        />

        <details className="rounded-lg border border-slate-200 p-3">
          <summary className="cursor-pointer text-sm font-medium text-slate-700">
            Reglas de puntuación (opcional)
          </summary>
          <div className="mt-3 grid grid-cols-3 gap-3">
            <Field
              label="Pts. victoria"
              type="number"
              value={form.pointsWin?.toString() ?? ''}
              onChange={(v) => set('pointsWin', v ? Number(v) : undefined)}
            />
            <Field
              label="Pts. empate"
              type="number"
              value={form.pointsDraw?.toString() ?? ''}
              onChange={(v) => set('pointsDraw', v ? Number(v) : undefined)}
            />
            <Field
              label="Pts. derrota"
              type="number"
              value={form.pointsLoss?.toString() ?? ''}
              onChange={(v) => set('pointsLoss', v ? Number(v) : undefined)}
            />
          </div>
        </details>

        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-blue-600 px-6 py-2 font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? 'Guardando...' : 'Guardar'}
          </button>
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="rounded-lg border border-slate-300 px-6 py-2 font-medium text-slate-700 hover:bg-slate-100"
          >
            Cancelar
          </button>
        </div>
      </form>
    </div>
  )
}

function Field({
  label,
  value,
  onChange,
  type = 'text',
  required,
  textarea,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  type?: string
  required?: boolean
  textarea?: boolean
}) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-slate-700">{label}</label>
      {textarea ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={3}
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      ) : (
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required={required}
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      )}
    </div>
  )
}
