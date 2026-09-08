import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ApiError } from '../../context/AuthContext'
import { resolveAssetUrl } from '../../lib/assetUrl'
import { COUNTRY_SUGGESTIONS } from '../../lib/countries'
import { api } from '../../services/api'
import type { Team, TeamInput } from '../../types/team'

const LOGO_MAX_BYTES = 2 * 1024 * 1024
const LOGO_MIME = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']

// Un club es una entidad independiente (corrección arquitectónica) -- este formulario NUNCA pide
// elegir una competición para crear/editar un equipo. La participación real en una competición se
// registra por separado (Equipos → Temporadas, o directamente al cargar un partido/temporada).
export default function TeamFormPage() {
  const { id } = useParams()
  const isEdit = !!id
  const navigate = useNavigate()

  const [form, setForm] = useState<TeamInput>({
    name: '',
    city: '',
    country: '',
    managerName: '',
    note: '',
    status: 'active',
  })
  const [loading, setLoading] = useState(isEdit)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [existingLogoUrl, setExistingLogoUrl] = useState<string | null>(null)
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [logoPreview, setLogoPreview] = useState<string | null>(null)
  const [uploadingLogo, setUploadingLogo] = useState(false)

  useEffect(() => {
    if (!isEdit) return
    api
      .get<Team>(`/teams/${id}`)
      .then((t) => {
        setForm({
          name: t.name,
          city: t.city ?? '',
          country: t.country ?? '',
          foundedYear: t.foundedYear ?? undefined,
          managerName: t.managerName ?? '',
          note: t.note ?? '',
          status: t.status,
        })
        setExistingLogoUrl(t.logoUrl)
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Error al cargar el equipo'))
      .finally(() => setLoading(false))
  }, [id, isEdit])

  const set = <K extends keyof TeamInput>(key: K, value: TeamInput[K]) =>
    setForm((f) => ({ ...f, [key]: value }))

  const validateLogoFile = (file: File): string | null => {
    if (!LOGO_MIME.includes(file.type)) return 'Formato no permitido. Usá PNG, JPG, WEBP o SVG.'
    if (file.size > LOGO_MAX_BYTES) return 'El logo no puede superar los 2 MB.'
    return null
  }

  const handleLogoSelect = async (file: File) => {
    setError('')
    const validationError = validateLogoFile(file)
    if (validationError) {
      setError(validationError)
      return
    }

    if (isEdit && id) {
      setUploadingLogo(true)
      try {
        const updated = await api.upload<Team>(`/teams/${id}/logo`, file)
        setExistingLogoUrl(updated.logoUrl)
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'Error al subir el logo')
      } finally {
        setUploadingLogo(false)
      }
    } else {
      setLogoFile(file)
      setLogoPreview(URL.createObjectURL(file))
    }
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setSaving(true)
    try {
      if (isEdit) {
        await api.put(`/teams/${id}`, form)
        navigate(`/equipos/${id}`)
      } else {
        const created = await api.post<Team>('/teams', form)
        if (logoFile) {
          try {
            await api.upload<Team>(`/teams/${created.id}/logo`, logoFile)
          } catch {
            // el equipo ya se creó; el logo se puede subir después desde la edición
          }
        }
        navigate(`/equipos/${created.id}`)
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Error al guardar el equipo')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <p className="p-8 text-center text-slate-500">Cargando...</p>

  const logoToShow = logoPreview ?? resolveAssetUrl(existingLogoUrl)

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
      <h1 className="mb-6 text-2xl font-bold sm:text-3xl">{isEdit ? 'Editar equipo' : 'Nuevo equipo'}</h1>

      {error && (
        <div className="mb-4 rounded-lg border border-red-400 bg-red-100 px-4 py-3 text-red-700">{error}</div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4 rounded-lg bg-white p-6 shadow">
        <div className="mb-2 flex items-center gap-4">
          {logoToShow ? (
            <img src={logoToShow} alt="Logo del equipo" className="h-20 w-20 rounded-lg object-contain" />
          ) : (
            <div className="flex h-20 w-20 items-center justify-center rounded-lg bg-slate-200 text-3xl">🛡️</div>
          )}
          <div>
            <label className="inline-block cursor-pointer rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100">
              {uploadingLogo ? 'Subiendo...' : logoToShow ? 'Reemplazar logo' : 'Subir logo'}
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp,image/svg+xml"
                className="hidden"
                disabled={uploadingLogo}
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) handleLogoSelect(file)
                  e.target.value = ''
                }}
              />
            </label>
            <p className="mt-1 text-xs text-slate-400">PNG, JPG, WEBP o SVG. Máximo 2 MB.</p>
            {!isEdit && <p className="mt-1 text-xs text-slate-400">Se sube al guardar el equipo.</p>}
          </div>
        </div>

        <Field label="Nombre *" value={form.name} onChange={(v) => set('name', v)} required />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Ciudad" value={form.city ?? ''} onChange={(v) => set('city', v)} />
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">País</label>
            <input
              list="team-country-suggestions"
              type="text"
              value={form.country ?? ''}
              onChange={(e) => set('country', e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <datalist id="team-country-suggestions">
              {COUNTRY_SUGGESTIONS.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </div>
        </div>
        <Field
          label="Fundación (año)"
          type="number"
          value={form.foundedYear?.toString() ?? ''}
          onChange={(v) => set('foundedYear', v ? Number(v) : undefined)}
        />
        <Field label="Director técnico" value={form.managerName ?? ''} onChange={(v) => set('managerName', v)} />
        <Field label="Notas" value={form.note ?? ''} onChange={(v) => set('note', v)} textarea />

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Estado</label>
          <select
            value={form.status}
            onChange={(e) => set('status', e.target.value as 'active' | 'inactive')}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="active">Activo</option>
            <option value="inactive">Inactivo</option>
          </select>
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
