import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ApiError } from '../../context/AuthContext'
import { clubsService } from '../../services/clubs'
import type { ClubInput } from '../../types/club'

const EMPTY: ClubInput = { name: '' }

export default function ClubFormPage() {
  const { id } = useParams()
  const isEdit = Boolean(id)
  const navigate = useNavigate()
  const [form, setForm] = useState<ClubInput>(EMPTY)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (isEdit) {
      clubsService
        .getById(Number(id))
        .then((c) =>
          setForm({
            name: c.name,
            shortName: c.shortName ?? undefined,
            country: c.country ?? undefined,
            city: c.city ?? undefined,
            foundedYear: c.foundedYear ?? undefined,
            logoUrl: c.logoUrl ?? undefined,
            primaryColor: c.primaryColor ?? undefined,
            secondaryColor: c.secondaryColor ?? undefined,
            history: c.history ?? undefined,
            status: c.status,
          }),
        )
        .catch((err) => setError(err instanceof ApiError ? err.message : 'Error al cargar el club'))
    }
  }, [id, isEdit])

  const set = (key: keyof ClubInput, value: string) =>
    setForm((f) => ({
      ...f,
      [key]:
        key === 'foundedYear' ? (value === '' ? undefined : Number(value)) : value === '' ? undefined : value,
    }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSaving(true)
    try {
      const saved = isEdit
        ? await clubsService.update(Number(id), form)
        : await clubsService.create(form)
      navigate(`/clubes/${saved.id}`)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  const inputClass =
    'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500'

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <h1 className="mb-6 text-2xl font-bold sm:text-3xl">{isEdit ? '✏️ Editar club' : '🏟️ Nuevo club'}</h1>

      {error && (
        <div className="mb-4 rounded-lg border border-red-400 bg-red-100 px-4 py-3 text-red-700">{error}</div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4 rounded-lg bg-white p-6 shadow">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Nombre *</label>
          <input
            type="text"
            required
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="Club Olimpia"
            className={inputClass}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Sigla</label>
            <input
              type="text"
              value={form.shortName ?? ''}
              onChange={(e) => set('shortName', e.target.value)}
              placeholder="OLI"
              maxLength={20}
              className={inputClass}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Año de fundación</label>
            <input
              type="number"
              value={form.foundedYear ?? ''}
              onChange={(e) => set('foundedYear', e.target.value)}
              min={1800}
              max={2200}
              className={inputClass}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">País</label>
            <input
              type="text"
              value={form.country ?? ''}
              onChange={(e) => set('country', e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Ciudad</label>
            <input
              type="text"
              value={form.city ?? ''}
              onChange={(e) => set('city', e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Color principal</label>
            <div className="flex gap-2">
              <input
                type="color"
                value={form.primaryColor ?? '#000000'}
                onChange={(e) => setForm((f) => ({ ...f, primaryColor: e.target.value }))}
                className="h-10 w-14 cursor-pointer rounded border border-slate-300"
              />
              <input
                type="text"
                value={form.primaryColor ?? ''}
                onChange={(e) => set('primaryColor', e.target.value)}
                placeholder="#000000"
                pattern="#[0-9A-Fa-f]{6}"
                className={inputClass}
              />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Color secundario</label>
            <div className="flex gap-2">
              <input
                type="color"
                value={form.secondaryColor ?? '#FFFFFF'}
                onChange={(e) => setForm((f) => ({ ...f, secondaryColor: e.target.value }))}
                className="h-10 w-14 cursor-pointer rounded border border-slate-300"
              />
              <input
                type="text"
                value={form.secondaryColor ?? ''}
                onChange={(e) => set('secondaryColor', e.target.value)}
                placeholder="#FFFFFF"
                pattern="#[0-9A-Fa-f]{6}"
                className={inputClass}
              />
            </div>
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">URL del escudo</label>
          <input
            type="text"
            value={form.logoUrl ?? ''}
            onChange={(e) => set('logoUrl', e.target.value)}
            placeholder="https://..."
            className={inputClass}
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Historial del club</label>
          <textarea
            value={form.history ?? ''}
            onChange={(e) => set('history', e.target.value)}
            rows={4}
            placeholder="Fundación, títulos, hitos..."
            className={inputClass}
          />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? 'Guardando...' : isEdit ? 'Guardar cambios' : 'Crear club'}
          </button>
        </div>
      </form>
    </div>
  )
}
