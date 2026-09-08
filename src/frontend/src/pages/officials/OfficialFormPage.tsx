import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ApiError } from '../../context/AuthContext'
import { resolveAssetUrl } from '../../lib/assetUrl'
import { COUNTRY_SUGGESTIONS } from '../../lib/countries'
import { api } from '../../services/api'
import type { Official, OfficialDuplicateMatch, OfficialInput, OfficialType } from '../../types/official'

const PHOTO_MAX_BYTES = 2 * 1024 * 1024
const PHOTO_MIME = ['image/png', 'image/jpeg', 'image/webp']

export default function OfficialFormPage() {
  const { id } = useParams()
  const isEdit = !!id
  const navigate = useNavigate()

  const [types, setTypes] = useState<OfficialType[]>([])
  const [form, setForm] = useState<OfficialInput>({
    firstName: '',
    lastName: '',
    dateOfBirth: '',
    nationality: '',
    city: '',
    officialTypeId: null,
    status: 'active',
  })
  const [loading, setLoading] = useState(isEdit)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [existingPhotoUrl, setExistingPhotoUrl] = useState<string | null>(null)
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)

  const [duplicates, setDuplicates] = useState<OfficialDuplicateMatch[]>([])
  const skipDuplicateCheck = useRef(isEdit)

  useEffect(() => {
    api.get<OfficialType[]>('/official-types').then((all) => setTypes(all.filter((t) => t.status === 'active'))).catch(() => {})
  }, [])

  useEffect(() => {
    if (!isEdit) return
    api
      .get<Official>(`/officials/${id}`)
      .then((o) => {
        setForm({
          firstName: o.firstName,
          lastName: o.lastName,
          dateOfBirth: o.dateOfBirth ? o.dateOfBirth.slice(0, 10) : '',
          nationality: o.nationality ?? '',
          city: o.city ?? '',
          officialTypeId: o.officialTypeId,
          status: o.status,
        })
        setExistingPhotoUrl(o.photoUrl)
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Error al cargar el oficial'))
      .finally(() => setLoading(false))
  }, [id, isEdit])

  useEffect(() => {
    if (skipDuplicateCheck.current) return
    if (form.lastName.trim().length < 2) {
      setDuplicates([])
      return
    }
    const timeout = setTimeout(() => {
      const params = new URLSearchParams()
      params.set('firstName', form.firstName)
      params.set('lastName', form.lastName)
      api
        .get<OfficialDuplicateMatch[]>(`/officials/check-duplicates?${params.toString()}`)
        .then(setDuplicates)
        .catch(() => {})
    }, 400)
    return () => clearTimeout(timeout)
  }, [form.firstName, form.lastName])

  const set = <K extends keyof OfficialInput>(key: K, value: OfficialInput[K]) =>
    setForm((f) => ({ ...f, [key]: value }))

  const validatePhotoFile = (file: File): string | null => {
    if (!PHOTO_MIME.includes(file.type)) return 'Formato no permitido. Usá PNG, JPG o WEBP.'
    if (file.size > PHOTO_MAX_BYTES) return 'La foto no puede superar los 2 MB.'
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
        const updated = await api.upload<Official>(`/officials/${id}/photo`, file)
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

  const handleClearPhoto = async () => {
    if (isEdit && id) {
      try {
        await api.put<Official>(`/officials/${id}`, { photoUrl: null })
        setExistingPhotoUrl(null)
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'Error al quitar la foto')
      }
    } else {
      setPhotoFile(null)
      setPhotoPreview(null)
    }
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')

    if (!form.officialTypeId) {
      setError('Elegí un tipo de oficial')
      return
    }

    if (
      !isEdit &&
      duplicates.length > 0 &&
      !window.confirm(
        `⚠ Se encontraron ${duplicates.length} oficial(es) con nombre similar:\n\n` +
          duplicates.map((d) => `• ${d.fullName}${d.officialTypeName ? ` (${d.officialTypeName})` : ''}`).join('\n') +
          '\n\n¿Confirmás que querés crear este oficial de todas formas?',
      )
    ) {
      return
    }

    setSaving(true)
    try {
      const payload: OfficialInput = {
        ...form,
        dateOfBirth: form.dateOfBirth || null,
        nationality: form.nationality || null,
        city: form.city || null,
      }

      let official: Official
      if (isEdit) {
        official = await api.put<Official>(`/officials/${id}`, payload)
      } else {
        official = await api.post<Official>('/officials', payload)
        if (photoFile) {
          try {
            await api.upload<Official>(`/officials/${official.id}/photo`, photoFile)
          } catch {
            // el oficial ya se creó; la foto se puede subir después desde el detalle
          }
        }
      }
      navigate(`/oficiales/${official.id}`)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Error al guardar el oficial')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <p className="p-8 text-center text-slate-500">Cargando...</p>

  const photoToShow = photoPreview ?? resolveAssetUrl(existingPhotoUrl)

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
      <h1 className="mb-6 text-2xl font-bold sm:text-3xl">{isEdit ? 'Editar oficial' : 'Nuevo oficial'}</h1>

      {error && (
        <div className="mb-4 rounded-lg border border-red-400 bg-red-100 px-4 py-3 text-red-700">{error}</div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <Section title="Datos personales">
          <div className="mb-4 flex items-center gap-4">
            {photoToShow ? (
              <img src={photoToShow} alt="Foto del oficial" className="h-20 w-20 rounded-full object-cover" />
            ) : (
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-slate-200 text-3xl">👤</div>
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
              {photoToShow && (
                <button type="button" onClick={handleClearPhoto} className="ml-2 text-sm text-red-600 hover:underline">
                  Quitar
                </button>
              )}
              <p className="mt-1 text-xs text-slate-400">PNG, JPG o WEBP. Máximo 2 MB.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Nombre *" value={form.firstName} onChange={(v) => set('firstName', v)} required />
            <Field label="Apellido *" value={form.lastName} onChange={(v) => set('lastName', v)} required />
          </div>

          {!isEdit && duplicates.length > 0 && (
            <div className="mt-4 rounded-lg border border-amber-400 bg-amber-50 p-4 text-sm text-amber-800">
              <p className="mb-2 font-medium">⚠ Posible oficial existente</p>
              <p className="mb-2">Se encontraron registros similares:</p>
              <ul className="mb-2 list-inside list-disc">
                {duplicates.map((d) => (
                  <li key={d.id}>
                    <a href={`/oficiales/${d.id}`} target="_blank" rel="noreferrer" className="font-medium underline">
                      {d.fullName}
                    </a>
                    {d.officialTypeName ? ` — ${d.officialTypeName}` : ''}
                    {d.dateOfBirth ? ` (nacido ${d.dateOfBirth.slice(0, 10)})` : ''}
                  </li>
                ))}
              </ul>
              <p>Podés revisarlos en una pestaña nueva antes de guardar, o continuar si es una persona distinta.</p>
            </div>
          )}

          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field
              label="Fecha de nacimiento"
              type="date"
              value={form.dateOfBirth ?? ''}
              onChange={(v) => set('dateOfBirth', v)}
              max={new Date().toISOString().slice(0, 10)}
            />
            <div>
              <label htmlFor="official-nationality" className="mb-1 block text-sm font-medium text-slate-700">
                Nacionalidad
              </label>
              <input
                id="official-nationality"
                list="country-suggestions"
                type="text"
                value={form.nationality ?? ''}
                onChange={(e) => set('nationality', e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <datalist id="country-suggestions">
                {COUNTRY_SUGGESTIONS.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </div>
          </div>

          <div className="mt-4">
            <Field label="Ciudad" value={form.city ?? ''} onChange={(v) => set('city', v)} />
          </div>
        </Section>

        <Section title="Información profesional">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="official-type" className="mb-1 block text-sm font-medium text-slate-700">
                Tipo de oficial *
              </label>
              <select
                id="official-type"
                value={form.officialTypeId ?? ''}
                onChange={(e) => set('officialTypeId', e.target.value ? Number(e.target.value) : null)}
                required
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Elegir tipo...</option>
                {types.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-slate-400">
                ¿Falta un tipo?{' '}
                <a href="/oficiales/tipos" target="_blank" rel="noreferrer" className="underline">
                  Gestionar tipos de oficial
                </a>
                .
              </p>
            </div>
            <div>
              <label htmlFor="official-status" className="mb-1 block text-sm font-medium text-slate-700">
                Estado
              </label>
              <select
                id="official-status"
                value={form.status}
                onChange={(e) => set('status', e.target.value as 'active' | 'inactive')}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="active">Activo</option>
                <option value="inactive">Inactivo</option>
              </select>
            </div>
          </div>
        </Section>

        <div className="flex gap-3">
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

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg bg-white p-6 shadow">
      <h2 className="mb-4 text-lg font-bold">{title}</h2>
      {children}
    </div>
  )
}

function Field({
  label,
  value,
  onChange,
  type = 'text',
  required,
  max,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  type?: string
  required?: boolean
  max?: string
}) {
  const id = `official-field-${label.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}`
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-medium text-slate-700">
        {label}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        max={max}
        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
    </div>
  )
}
