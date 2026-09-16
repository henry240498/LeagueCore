import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ApiError } from '../../context/AuthContext'
import { resolveAssetUrl } from '../../lib/assetUrl'
import { COUNTRY_SUGGESTIONS } from '../../lib/countries'
import { api } from '../../services/api'
import { PLAYER_POSITIONS } from '../../types/player'
import type { DuplicateMatch, Player, PlayerInput } from '../../types/player'
import type { Team } from '../../types/team'

const PHOTO_MAX_BYTES = 2 * 1024 * 1024
const PHOTO_MIME = ['image/png', 'image/jpeg', 'image/webp']

export default function PlayerFormPage() {
  const { id } = useParams()
  const [searchParams] = useSearchParams()
  const isEdit = !!id
  const navigate = useNavigate()

  const [teams, setTeams] = useState<Team[]>([])
  const [form, setForm] = useState<PlayerInput>({
    firstName: '',
    lastName: '',
    dateOfBirth: '',
    birthPlace: '',
    nationality: '',
    position: '',
    squadNumber: undefined,
    heightCm: undefined,
    weightKg: undefined,
    contractStatus: '',
    preferredFoot: '',
    teamId: Number(searchParams.get('teamId')) || null,
    status: 'active',
  })
  const [loading, setLoading] = useState(isEdit)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [existingPhotoUrl, setExistingPhotoUrl] = useState<string | null>(null)
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)

  const [duplicates, setDuplicates] = useState<DuplicateMatch[]>([])
  const skipDuplicateCheck = useRef(isEdit)

  useEffect(() => {
    api.get<Team[]>('/teams').then(setTeams).catch(() => {})
  }, [])

  useEffect(() => {
    if (!isEdit) return
    api
      .get<Player>(`/players/${id}`)
      .then((p) => {
        setForm({
          firstName: p.firstName,
          lastName: p.lastName,
          dateOfBirth: p.dateOfBirth ? p.dateOfBirth.slice(0, 10) : '',
          birthPlace: p.birthPlace ?? '',
          nationality: p.nationality ?? '',
          position: p.position ?? '',
          squadNumber: p.squadNumber ?? undefined,
          heightCm: p.heightCm ?? undefined,
          weightKg: p.weightKg ?? undefined,
          contractStatus: p.contractStatus ?? '',
          preferredFoot: p.preferredFoot ?? '',
          teamId: p.teamId,
          status: p.status,
        })
        setExistingPhotoUrl(p.photoUrl)
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Error al cargar el jugador'))
      .finally(() => setLoading(false))
  }, [id, isEdit])

  // Chequeo de posible duplicado — sólo al crear, con debounce, y sólo cuando hay suficiente texto
  // como para que la búsqueda tenga sentido (evita pegarle al backend en cada tecla desde vacío).
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
        .get<DuplicateMatch[]>(`/players/check-duplicates?${params.toString()}`)
        .then(setDuplicates)
        .catch(() => {})
    }, 400)
    return () => clearTimeout(timeout)
  }, [form.firstName, form.lastName])

  const set = <K extends keyof PlayerInput>(key: K, value: PlayerInput[K]) =>
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
        const updated = await api.upload<Player>(`/players/${id}/photo`, file)
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
        await api.put<Player>(`/players/${id}`, { photoUrl: null })
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

    if (
      !isEdit &&
      duplicates.length > 0 &&
      !window.confirm(
        `⚠ Se encontraron ${duplicates.length} jugador(es) con nombre similar:\n\n` +
          duplicates.map((d) => `• ${d.fullName}${d.teamName ? ` (${d.teamName})` : ''}`).join('\n') +
          '\n\n¿Confirmás que querés crear este jugador de todas formas?',
      )
    ) {
      return
    }

    setSaving(true)
    try {
      const payload: PlayerInput = {
        ...form,
        dateOfBirth: form.dateOfBirth || null,
        birthPlace: form.birthPlace || null,
        nationality: form.nationality || null,
        position: form.position || null,
        squadNumber: form.squadNumber || null,
        heightCm: form.heightCm || null,
        weightKg: form.weightKg || null,
        contractStatus: form.contractStatus || null,
        preferredFoot: form.preferredFoot || null,
        teamId: form.teamId || null,
      }

      let player: Player
      if (isEdit) {
        player = await api.put<Player>(`/players/${id}`, payload)
      } else {
        player = await api.post<Player>('/players', payload)
        if (photoFile) {
          try {
            await api.upload<Player>(`/players/${player.id}/photo`, photoFile)
          } catch {
            // el jugador ya se creó; la foto se puede subir después desde el detalle
          }
        }
      }
      navigate(`/jugadores/${player.id}`)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Error al guardar el jugador')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <p className="p-8 text-center text-slate-500">Cargando...</p>

  const photoToShow = photoPreview ?? resolveAssetUrl(existingPhotoUrl)

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
      <h1 className="mb-6 text-2xl font-bold sm:text-3xl">{isEdit ? 'Editar jugador' : 'Nuevo jugador'}</h1>

      {error && (
        <div className="mb-4 rounded-lg border border-red-400 bg-red-100 px-4 py-3 text-red-700">{error}</div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <Section title="Datos personales">
          <div className="mb-4 flex items-center gap-4">
            {photoToShow ? (
              <img src={photoToShow} alt="Foto del jugador" className="h-20 w-20 rounded-full object-cover" />
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
                <button
                  type="button"
                  onClick={handleClearPhoto}
                  className="ml-2 text-sm text-red-600 hover:underline"
                >
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
              <p className="mb-2 font-medium">⚠ Posible jugador existente</p>
              <p className="mb-2">Se encontraron registros similares:</p>
              <ul className="mb-2 list-inside list-disc">
                {duplicates.map((d) => (
                  <li key={d.id}>
                    <a
                      href={`/jugadores/${d.id}`}
                      target="_blank"
                      rel="noreferrer"
                      className="font-medium underline"
                    >
                      {d.fullName}
                    </a>
                    {d.teamName ? ` — ${d.teamName}` : ''}
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
              <label htmlFor="player-nationality" className="mb-1 block text-sm font-medium text-slate-700">
                Nacionalidad
              </label>
              <input
                id="player-nationality"
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
            <Field label="Lugar de nacimiento" value={form.birthPlace ?? ''} onChange={(v) => set('birthPlace', v)} />
          </div>
        </Section>

        <Section title="Datos deportivos">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="player-position" className="mb-1 block text-sm font-medium text-slate-700">
                Posición
              </label>
              <select
                id="player-position"
                value={form.position ?? ''}
                onChange={(e) => set('position', e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Sin especificar</option>
                {PLAYER_POSITIONS.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
            <Field
              label="Número de camiseta"
              type="number"
              value={form.squadNumber?.toString() ?? ''}
              onChange={(v) => set('squadNumber', v ? Number(v) : undefined)}
              min={1}
              max={99}
            />
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field
              label="Altura (cm)"
              type="number"
              value={form.heightCm?.toString() ?? ''}
              onChange={(v) => set('heightCm', v ? Number(v) : undefined)}
              min={120}
              max={230}
            />
            <Field
              label="Peso (kg)"
              type="number"
              value={form.weightKg?.toString() ?? ''}
              onChange={(v) => set('weightKg', v ? Number(v) : undefined)}
              min={30}
              max={200}
            />
            <div>
              <label htmlFor="player-foot" className="mb-1 block text-sm font-medium text-slate-700">
                Pie dominante
              </label>
              <select
                id="player-foot"
                value={form.preferredFoot ?? ''}
                onChange={(e) => set('preferredFoot', e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Sin especificar</option>
                <option value="izquierdo">Izquierdo</option>
                <option value="derecho">Derecho</option>
                <option value="ambidiestro">Ambidiestro</option>
              </select>
            </div>
            <div>
              <label htmlFor="player-contract" className="mb-1 block text-sm font-medium text-slate-700">
                Estado contractual
              </label>
              <select
                id="player-contract"
                value={form.contractStatus ?? ''}
                onChange={(e) => set('contractStatus', e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Sin especificar</option>
                <option value="VIGENTE">Vigente</option>
                <option value="POR_VENCER">Por vencer</option>
                <option value="VENCIDO">Vencido</option>
                <option value="A_PRESTAMO">A préstamo</option>
                <option value="LIBRE">Libre</option>
                <option value="JUVENIL">Juvenil</option>
              </select>
            </div>
          </div>

          <div className="mt-4">
            <label htmlFor="player-status" className="mb-1 block text-sm font-medium text-slate-700">
              Estado
            </label>
            <select
              id="player-status"
              value={form.status}
              onChange={(e) => set('status', e.target.value as 'active' | 'inactive')}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="active">Activo</option>
              <option value="inactive">Inactivo</option>
            </select>
          </div>
        </Section>

        <Section title="Equipo">
          <label htmlFor="player-team" className="mb-1 block text-sm font-medium text-slate-700">
            Equipo actual
          </label>
          <select
            id="player-team"
            value={form.teamId ?? ''}
            onChange={(e) => set('teamId', e.target.value ? Number(e.target.value) : null)}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">— Sin equipo —</option>
            {teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
                {t.city ? ` (${t.city})` : ''}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-slate-400">
            Cambiar de equipo queda registrado en el historial del jugador — no se pierde el paso por equipos anteriores.
          </p>
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
  min,
  max,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  type?: string
  required?: boolean
  min?: number | string
  max?: number | string
}) {
  const id = `player-field-${label.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}`
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
        min={min}
        max={max}
        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
    </div>
  )
}
