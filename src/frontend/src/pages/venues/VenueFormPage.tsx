import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ApiError } from '../../context/AuthContext'
import { resolveAssetUrl } from '../../lib/assetUrl'
import { COUNTRY_SUGGESTIONS } from '../../lib/countries'
import { api } from '../../services/api'
import type { Venue, VenueInput } from '../../types/venue'

const PHOTO_MAX_BYTES = 4 * 1024 * 1024
const PHOTO_MIME = ['image/png', 'image/jpeg', 'image/webp']

export default function VenueFormPage() {
  const { id } = useParams()
  const isEdit = !!id
  const navigate = useNavigate()

  const [form, setForm] = useState<VenueInput>({ name: '', city: '', country: '', capacity: undefined, openedYear: undefined })
  const [loading, setLoading] = useState(isEdit)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [existingPhotoUrl, setExistingPhotoUrl] = useState<string | null>(null)
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)

  useEffect(() => {
    if (!isEdit) return
    api
      .get<Venue>(`/venues/${id}`)
      .then((v) => {
        setForm({
          name: v.name,
          city: v.city ?? '',
          country: v.country ?? '',
          capacity: v.capacity ?? undefined,
          openedYear: v.openedYear ?? undefined,
        })
        setExistingPhotoUrl(v.photoUrl)
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Error al cargar el estadio'))
      .finally(() => setLoading(false))
  }, [id, isEdit])

  const set = <K extends keyof VenueInput>(key: K, value: VenueInput[K]) => setForm((f) => ({ ...f, [key]: value }))

  const validatePhotoFile = (file: File): string | null => {
    if (!PHOTO_MIME.includes(file.type)) return 'Formato no permitido. Usá PNG, JPG o WEBP.'
    if (file.size > PHOTO_MAX_BYTES) return 'La foto no puede superar los 4 MB.'
    return null
  }

  const handlePhotoSelect = async (file: File) => {
    setError('')
    const validationError = validatePhotoFile(file)
    if (validationError) {
      setError(validationError)
      return
    }

    if (isEdit && id) {
      setUploadingPhoto(true)
      try {
        const updated = await api.upload<Venue>(`/venues/${id}/photo`, file)
        setExistingPhotoUrl(updated.photoUrl)
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'Error al subir la foto')
      } finally {
        setUploadingPhoto(false)
      }
    } else {
      setPhotoFile(file)
      setPhotoPreview(URL.createObjectURL(file))
    }
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setSaving(true)
    try {
      const payload: VenueInput = {
        ...form,
        city: form.city || null,
        country: form.country || null,
        capacity: form.capacity || null,
        openedYear: form.openedYear || null,
      }

      let venue: Venue
      if (isEdit) {
        venue = await api.put<Venue>(`/venues/${id}`, payload)
      } else {
        venue = await api.post<Venue>('/venues', payload)
        if (photoFile) {
          try {
            await api.upload<Venue>(`/venues/${venue.id}/photo`, photoFile)
          } catch {
            // el estadio ya se creó; la foto se puede subir después desde la edición
          }
        }
      }
      navigate(`/estadios/${venue.id}`)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Error al guardar el estadio')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <p className="p-8 text-center text-slate-500">Cargando...</p>

  const photoToShow = photoPreview ?? resolveAssetUrl(existingPhotoUrl)

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
      <h1 className="mb-6 text-2xl font-bold sm:text-3xl">{isEdit ? 'Editar estadio' : 'Nuevo estadio'}</h1>

      {error && (
        <div className="mb-4 rounded-lg border border-red-400 bg-red-100 px-4 py-3 text-red-700">{error}</div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4 rounded-lg bg-white p-6 shadow">
        <div className="mb-2 flex items-center gap-4">
          {photoToShow ? (
            <img src={photoToShow} alt="Foto del estadio" className="h-20 w-28 rounded-lg object-cover" />
          ) : (
            <div className="flex h-20 w-28 items-center justify-center rounded-lg bg-slate-200 text-3xl">🏟️</div>
          )}
          <div>
            <label className="inline-block cursor-pointer rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100">
              {uploadingPhoto ? 'Subiendo...' : photoToShow ? 'Reemplazar foto' : 'Subir foto'}
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                disabled={uploadingPhoto}
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) handlePhotoSelect(file)
                  e.target.value = ''
                }}
              />
            </label>
            <p className="mt-1 text-xs text-slate-400">PNG, JPG o WEBP. Máximo 4 MB.</p>
            {!isEdit && <p className="mt-1 text-xs text-slate-400">Se sube al guardar el estadio.</p>}
          </div>
        </div>

        <Field label="Nombre *" value={form.name} onChange={(v) => set('name', v)} required />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Ciudad" value={form.city ?? ''} onChange={(v) => set('city', v)} />
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">País</label>
            <input
              list="venue-country-suggestions"
              type="text"
              value={form.country ?? ''}
              onChange={(e) => set('country', e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <datalist id="venue-country-suggestions">
              {COUNTRY_SUGGESTIONS.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field
            label="Capacidad"
            type="number"
            value={form.capacity?.toString() ?? ''}
            onChange={(v) => set('capacity', v ? Number(v) : undefined)}
            min={0}
          />
          <Field
            label="Año de apertura"
            type="number"
            value={form.openedYear?.toString() ?? ''}
            onChange={(v) => set('openedYear', v ? Number(v) : undefined)}
            min={1800}
            max={2200}
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

function Field({
  label,
  value,
  onChange,
  type = 'text',
  required,
  min,
  max,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  type?: string
  required?: boolean
  min?: number
  max?: number
}) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-slate-700">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        min={min}
        max={max}
        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
    </div>
  )
}
