import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ApiError } from '../../context/AuthContext'
import { api } from '../../services/api'
import {
  FORMAT_LABELS,
  STATUS_LABELS,
  type InformalTournament,
  type TournamentFormat,
  type TournamentStatus,
} from '../../types/informalTournament'

type FormState = {
  name: string
  sport: string
  format: '' | TournamentFormat
  status: TournamentStatus
  location: string
  startDate: string
  endDate: string
  maxTeams: string
  organizer: string
  contact: string
  participants: string
  observations: string
}

const EMPTY: FormState = {
  name: '',
  sport: 'Fútbol',
  format: '',
  status: 'abierto',
  location: '',
  startDate: '',
  endDate: '',
  maxTeams: '',
  organizer: '',
  contact: '',
  participants: '',
  observations: '',
}

export default function InformalTournamentFormPage() {
  const { id } = useParams()
  const isEdit = !!id
  const navigate = useNavigate()

  const [form, setForm] = useState<FormState>(EMPTY)
  const [loading, setLoading] = useState(isEdit)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!isEdit) return
    api
      .get<InformalTournament>(`/informal-tournaments/${id}`)
      .then((t) =>
        setForm({
          name: t.name,
          sport: t.sport ?? '',
          format: (t.format as TournamentFormat) ?? '',
          status: t.status,
          location: t.location ?? '',
          startDate: t.startDate?.slice(0, 10) ?? '',
          endDate: t.endDate?.slice(0, 10) ?? '',
          maxTeams: t.maxTeams?.toString() ?? '',
          organizer: t.organizer ?? '',
          contact: t.contact ?? '',
          participants: t.participants ?? '',
          observations: t.observations ?? '',
        }),
      )
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Error al cargar el torneo'))
      .finally(() => setLoading(false))
  }, [id, isEdit])

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }))

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setSaving(true)
    try {
      const payload = {
        name: form.name,
        sport: form.sport || undefined,
        format: form.format || undefined,
        status: form.status,
        location: form.location || undefined,
        startDate: form.startDate || undefined,
        endDate: form.endDate || undefined,
        maxTeams: form.maxTeams ? Number(form.maxTeams) : undefined,
        organizer: form.organizer || undefined,
        contact: form.contact || undefined,
        participants: form.participants || undefined,
        observations: form.observations || undefined,
      }
      if (isEdit) {
        await api.put(`/informal-tournaments/${id}`, payload)
      } else {
        await api.post<InformalTournament>('/informal-tournaments', payload)
      }
      navigate('/torneos')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Error al guardar el torneo')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <p className="p-8 text-center text-slate-500">Cargando...</p>

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
      <h1 className="mb-6 text-2xl font-bold sm:text-3xl">
        {isEdit ? 'Editar torneo informal' : 'Nuevo torneo informal'}
      </h1>

      {error && (
        <div className="mb-4 rounded-lg border border-red-400 bg-red-100 px-4 py-3 text-red-700">{error}</div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4 rounded-lg bg-white p-6 shadow">
        <Field label="Nombre *" value={form.name} onChange={(v) => set('name', v)} required />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Deporte" value={form.sport} onChange={(v) => set('sport', v)} />
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Formato</label>
            <select
              value={form.format}
              onChange={(e) => set('format', e.target.value as FormState['format'])}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Sin especificar</option>
              {(Object.keys(FORMAT_LABELS) as TournamentFormat[]).map((f) => (
                <option key={f} value={f}>
                  {FORMAT_LABELS[f]}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Estado</label>
            <select
              value={form.status}
              onChange={(e) => set('status', e.target.value as TournamentStatus)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {(Object.keys(STATUS_LABELS) as TournamentStatus[]).map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABELS[s]}
                </option>
              ))}
            </select>
          </div>
          <Field
            label="Cupo de equipos"
            type="number"
            value={form.maxTeams}
            onChange={(v) => set('maxTeams', v)}
          />
        </div>

        <Field label="Lugar / sede" value={form.location} onChange={(v) => set('location', v)} />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Fecha de inicio" type="date" value={form.startDate} onChange={(v) => set('startDate', v)} />
          <Field label="Fecha de fin" type="date" value={form.endDate} onChange={(v) => set('endDate', v)} />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Organizador" value={form.organizer} onChange={(v) => set('organizer', v)} />
          <Field label="Contacto" value={form.contact} onChange={(v) => set('contact', v)} />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Participantes</label>
          <textarea
            value={form.participants}
            onChange={(e) => set('participants', e.target.value)}
            rows={5}
            placeholder="Un equipo por línea..."
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <p className="mt-1 text-xs text-slate-400">Escribí un participante por línea (nombres libres, no hace falta que estén en el catálogo de equipos).</p>
        </div>

        <Field
          label="Observaciones"
          value={form.observations}
          onChange={(v) => set('observations', v)}
          textarea
        />

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
