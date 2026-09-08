import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ApiError } from '../../context/AuthContext'
import { api } from '../../services/api'
import type { Competition } from '../../types/competition'
import type { Season, SeasonInput } from '../../types/season'

type FormState = {
  competitionId: number | ''
  startYear: string
  endYear: string
  startDate: string
  endDate: string
  status: 'active' | 'inactive'
  observations: string
}

export default function SeasonFormPage() {
  const { id } = useParams()
  const [searchParams] = useSearchParams()
  const isEdit = !!id
  const navigate = useNavigate()

  const [competitions, setCompetitions] = useState<Competition[]>([])
  const [form, setForm] = useState<FormState>({
    competitionId: Number(searchParams.get('competitionId')) || '',
    startYear: '',
    endYear: '',
    startDate: '',
    endDate: '',
    status: 'active',
    observations: '',
  })
  const [loading, setLoading] = useState(isEdit)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    api.get<Competition[]>('/competitions').then(setCompetitions).catch(() => {})
  }, [])

  useEffect(() => {
    if (!isEdit) return
    api
      .get<Season>(`/seasons/${id}`)
      .then((s) =>
        setForm({
          competitionId: s.competitionId,
          startYear: String(s.startYear),
          endYear: s.endYear !== s.startYear ? String(s.endYear) : '',
          startDate: s.startDate ? s.startDate.slice(0, 10) : '',
          endDate: s.endDate ? s.endDate.slice(0, 10) : '',
          status: s.status,
          observations: s.observations ?? '',
        }),
      )
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Error al cargar la temporada'))
      .finally(() => setLoading(false))
  }, [id, isEdit])

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((f) => ({ ...f, [key]: value }))

  const startYearNum = form.startYear ? Number(form.startYear) : null
  const endYearNum = form.endYear ? Number(form.endYear) : startYearNum
  const previewLabel =
    startYearNum && endYearNum
      ? endYearNum === startYearNum
        ? String(startYearNum)
        : `${startYearNum}/${endYearNum}`
      : null

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')

    if (!form.competitionId) {
      setError('Elegí una competición')
      return
    }
    if (!startYearNum) {
      setError('Ingresá el año de inicio')
      return
    }

    setSaving(true)
    try {
      const payload: SeasonInput = {
        competitionId: Number(form.competitionId),
        startYear: startYearNum,
        endYear: endYearNum ?? undefined,
        startDate: form.startDate || null,
        endDate: form.endDate || null,
        status: form.status,
        observations: form.observations || null,
      }

      let season: Season
      if (isEdit) {
        season = await api.put<Season>(`/seasons/${id}`, payload)
      } else {
        season = await api.post<Season>('/seasons', payload)
      }
      navigate(`/temporadas/${season.id}`)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Error al guardar la temporada')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <p className="p-8 text-center text-slate-500">Cargando...</p>

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
      <h1 className="mb-6 text-2xl font-bold sm:text-3xl">{isEdit ? 'Editar temporada' : 'Nueva temporada'}</h1>

      {error && (
        <div className="mb-4 rounded-lg border border-red-400 bg-red-100 px-4 py-3 text-red-700">{error}</div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4 rounded-lg bg-white p-6 shadow">
        <div>
          <label htmlFor="season-competition" className="mb-1 block text-sm font-medium text-slate-700">
            Competición *
          </label>
          <select
            id="season-competition"
            value={form.competitionId}
            onChange={(e) => set('competitionId', e.target.value ? Number(e.target.value) : '')}
            required
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Elegir competición...</option>
            {competitions.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="season-start-year" className="mb-1 block text-sm font-medium text-slate-700">
              Año de inicio *
            </label>
            <input
              id="season-start-year"
              type="number"
              value={form.startYear}
              onChange={(e) => set('startYear', e.target.value)}
              required
              min={1900}
              max={2200}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label htmlFor="season-end-year" className="mb-1 block text-sm font-medium text-slate-700">
              Año de fin
            </label>
            <input
              id="season-end-year"
              type="number"
              value={form.endYear}
              onChange={(e) => set('endYear', e.target.value)}
              min={1900}
              max={2200}
              placeholder="Dejar vacío si es de un solo año"
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
        {previewLabel && <p className="text-sm text-slate-500">Vista previa: <strong>{previewLabel}</strong></p>}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="season-start-date" className="mb-1 block text-sm font-medium text-slate-700">
              Fecha de inicio
            </label>
            <input
              id="season-start-date"
              type="date"
              value={form.startDate}
              onChange={(e) => set('startDate', e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label htmlFor="season-end-date" className="mb-1 block text-sm font-medium text-slate-700">
              Fecha de finalización
            </label>
            <input
              id="season-end-date"
              type="date"
              value={form.endDate}
              onChange={(e) => set('endDate', e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div>
          <label htmlFor="season-status" className="mb-1 block text-sm font-medium text-slate-700">
            Estado
          </label>
          <select
            id="season-status"
            value={form.status}
            onChange={(e) => set('status', e.target.value as 'active' | 'inactive')}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="active">Activa</option>
            <option value="inactive">Finalizada</option>
          </select>
        </div>

        <div>
          <label htmlFor="season-observations" className="mb-1 block text-sm font-medium text-slate-700">
            Observaciones
          </label>
          <textarea
            id="season-observations"
            value={form.observations}
            onChange={(e) => set('observations', e.target.value)}
            rows={3}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

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
