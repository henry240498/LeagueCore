import { useEffect, useRef, useState } from 'react'
import LoginVisual from '../components/LoginVisual'
import { DEFAULT_LOGIN_SETTINGS } from '../defaultLoginSettings'
import { resolveAssetUrl } from '../lib/assetUrl'
import { ApiError } from '../context/AuthContext'
import { api } from '../services/api'
import type { LoginSettings } from '../types/loginSettings'

type MediaField = 'logoMain' | 'logoLogin' | 'backgroundImage' | 'backgroundVideo'
const MEDIA_FIELD_TO_KEY: Record<MediaField, keyof LoginSettings> = {
  logoMain: 'logoMainUrl',
  logoLogin: 'logoLoginUrl',
  backgroundImage: 'backgroundImageUrl',
  backgroundVideo: 'backgroundVideoUrl',
}
const VIDEO_FIELDS: MediaField[] = ['backgroundVideo']
const IMAGE_MIME = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']
const VIDEO_MIME = ['video/mp4', 'video/webm']
const IMAGE_MAX_BYTES = 2 * 1024 * 1024
const VIDEO_MAX_BYTES = 30 * 1024 * 1024

export default function LoginSettingsPanel() {
  const [draft, setDraft] = useState<LoginSettings>(DEFAULT_LOGIN_SETTINGS)
  const [loaded, setLoaded] = useState(false)
  const [saving, setSaving] = useState(false)
  const [uploadingField, setUploadingField] = useState<MediaField | null>(null)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    api
      .get<LoginSettings>('/settings/login')
      .then((s) => {
        setDraft(s)
        setLoaded(true)
      })
      .catch(() => setLoaded(true))
  }, [])

  const set = <K extends keyof LoginSettings>(key: K, value: LoginSettings[K]) =>
    setDraft((d) => ({ ...d, [key]: value }))

  const handleSave = async () => {
    setMessage('')
    setError('')
    setSaving(true)
    try {
      const editable = {
        systemName: draft.systemName,
        title: draft.title,
        subtitle: draft.subtitle,
        welcomeMessage: draft.welcomeMessage,
        showLogo: draft.showLogo,
        showSubtitle: draft.showSubtitle,
        showWelcomeMessage: draft.showWelcomeMessage,
        backgroundType: draft.backgroundType,
        backgroundVideoMuted: draft.backgroundVideoMuted,
        backgroundVideoStartSeconds: draft.backgroundVideoStartSeconds,
        backgroundVideoEndSeconds: draft.backgroundVideoEndSeconds,
        backgroundColor: draft.backgroundColor,
        backgroundPosition: draft.backgroundPosition,
        backgroundSize: draft.backgroundSize,
        backgroundRepeat: draft.backgroundRepeat,
        overlayColor: draft.overlayColor,
        overlayOpacity: draft.overlayOpacity,
        colorPrimary: draft.colorPrimary,
        colorSecondary: draft.colorSecondary,
        colorText: draft.colorText,
        colorTextSecondary: draft.colorTextSecondary,
        colorFormBg: draft.colorFormBg,
        colorFormBgOpacity: draft.colorFormBgOpacity,
        colorButton: draft.colorButton,
        colorButtonHover: draft.colorButtonHover,
        colorError: draft.colorError,
        colorBorder: draft.colorBorder,
        colorInputBg: draft.colorInputBg,
        buttonText: draft.buttonText,
        placeholderUsername: draft.placeholderUsername,
        placeholderPassword: draft.placeholderPassword,
      }
      const updated = await api.put<LoginSettings>('/settings/login', editable)
      setDraft(updated)
      setMessage('✅ Configuración guardada')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Error al guardar la configuración')
    } finally {
      setSaving(false)
    }
  }

  const handleReset = async () => {
    if (!window.confirm('¿Restaurar el Login a la apariencia predeterminada? Esto no se puede deshacer.')) {
      return
    }
    setMessage('')
    setError('')
    setSaving(true)
    try {
      const restored = await api.post<LoginSettings>('/settings/login/reset')
      setDraft(restored)
      setMessage('✅ Configuración restaurada a los valores predeterminados')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Error al restaurar la configuración')
    } finally {
      setSaving(false)
    }
  }

  const handleUpload = async (field: MediaField, file: File) => {
    setMessage('')
    setError('')
    const isVideo = VIDEO_FIELDS.includes(field)
    const allowedMime = isVideo ? VIDEO_MIME : IMAGE_MIME
    const maxBytes = isVideo ? VIDEO_MAX_BYTES : IMAGE_MAX_BYTES

    if (!allowedMime.includes(file.type)) {
      setError(isVideo ? 'Formato no permitido. Usá MP4 o WEBM.' : 'Formato no permitido. Usá PNG, JPG, WEBP o SVG.')
      return
    }
    if (file.size > maxBytes) {
      setError(`El archivo no puede superar los ${Math.round(maxBytes / 1024 / 1024)} MB.`)
      return
    }
    setUploadingField(field)
    try {
      const updated = await api.upload<LoginSettings>(`/settings/login/upload/${field}`, file)
      const urlKey = MEDIA_FIELD_TO_KEY[field]
      // Fusiona sólo el campo que cambió — el endpoint de upload persiste y devuelve el estado
      // COMPLETO del servidor, que no incluye ediciones locales todavía no guardadas (por ej.
      // haber elegido "Tipo de fondo: Video" en el <select> justo antes de subir el archivo).
      // Si se pisara todo el draft con la respuesta, esas ediciones sin guardar se perderían.
      setDraft((prev) => ({
        ...prev,
        [urlKey]: updated[urlKey],
        ...(isVideo ? { backgroundVideoStartSeconds: null, backgroundVideoEndSeconds: null } : {}),
      }))
      setMessage(isVideo ? '✅ Video actualizado' : '✅ Imagen actualizada')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Error al subir el archivo')
    } finally {
      setUploadingField(null)
    }
  }

  const handleClearImage = async (field: MediaField) => {
    setMessage('')
    setError('')
    const urlKey = MEDIA_FIELD_TO_KEY[field]
    try {
      await api.put<LoginSettings>('/settings/login', { [urlKey]: null })
      // mismo motivo que en handleUpload: fusionar, no reemplazar todo el draft.
      setDraft((prev) => ({ ...prev, [urlKey]: null }))
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Error al quitar el archivo')
    }
  }

  if (!loaded) {
    return <p className="text-slate-500">Cargando configuración...</p>
  }

  return (
    <div>
      {message && (
        <div className="mb-4 rounded-lg border border-green-400 bg-green-100 px-4 py-3 text-green-700">
          {message}
        </div>
      )}
      {error && (
        <div className="mb-4 rounded-lg border border-red-400 bg-red-100 px-4 py-3 text-red-700">
          {error}
        </div>
      )}

      <div className="mb-6 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="rounded-lg bg-blue-600 px-5 py-2 font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? 'Guardando...' : 'Guardar'}
        </button>
        <button
          type="button"
          onClick={handleReset}
          disabled={saving}
          className="rounded-lg border border-slate-300 px-5 py-2 font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50"
        >
          Restaurar valores predeterminados
        </button>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        <div className="space-y-8">
          <Section title="Identidad">
            <TextField label="Nombre del sistema" value={draft.systemName} onChange={(v) => set('systemName', v)} />
            <TextField label="Título" value={draft.title} onChange={(v) => set('title', v)} />
            <TextField label="Subtítulo" value={draft.subtitle} onChange={(v) => set('subtitle', v)} />
            <TextField
              label="Mensaje de bienvenida"
              value={draft.welcomeMessage}
              onChange={(v) => set('welcomeMessage', v)}
            />
            <ToggleField label="Mostrar logo" checked={draft.showLogo} onChange={(v) => set('showLogo', v)} />
            <ToggleField
              label="Mostrar subtítulo"
              checked={draft.showSubtitle}
              onChange={(v) => set('showSubtitle', v)}
            />
            <ToggleField
              label="Mostrar mensaje de bienvenida"
              checked={draft.showWelcomeMessage}
              onChange={(v) => set('showWelcomeMessage', v)}
            />
            <ImageUploadField
              label="Logo principal"
              url={draft.logoMainUrl}
              uploading={uploadingField === 'logoMain'}
              onUpload={(f) => handleUpload('logoMain', f)}
              onClear={() => handleClearImage('logoMain')}
            />
            <ImageUploadField
              label="Logo del Login"
              url={draft.logoLoginUrl}
              uploading={uploadingField === 'logoLogin'}
              onUpload={(f) => handleUpload('logoLogin', f)}
              onClear={() => handleClearImage('logoLogin')}
            />
          </Section>

          <Section title="Fondo">
            <SelectField
              label="Tipo de fondo"
              value={draft.backgroundType}
              options={['color', 'image', 'video']}
              optionLabels={{ color: 'Color sólido', image: 'Imagen', video: 'Video' }}
              onChange={(v) => set('backgroundType', v as LoginSettings['backgroundType'])}
            />
            <ColorField label="Color de fondo" value={draft.backgroundColor} onChange={(v) => set('backgroundColor', v)} />

            {draft.backgroundType === 'image' && (
              <>
                <ImageUploadField
                  label="Imagen de fondo"
                  url={draft.backgroundImageUrl}
                  uploading={uploadingField === 'backgroundImage'}
                  accept="image/png,image/jpeg,image/webp,image/svg+xml"
                  hint="PNG, JPG, WEBP o SVG. Máximo 2 MB."
                  onUpload={(f) => handleUpload('backgroundImage', f)}
                  onClear={() => handleClearImage('backgroundImage')}
                />
                <SelectField
                  label="Posición de la imagen"
                  value={draft.backgroundPosition}
                  options={['center', 'top', 'bottom', 'left', 'right']}
                  onChange={(v) => set('backgroundPosition', v)}
                />
                <SelectField
                  label="Tamaño de la imagen"
                  value={draft.backgroundSize}
                  options={['cover', 'contain', 'auto']}
                  onChange={(v) => set('backgroundSize', v)}
                />
                <SelectField
                  label="Repetición"
                  value={draft.backgroundRepeat}
                  options={['no-repeat', 'repeat', 'repeat-x', 'repeat-y']}
                  onChange={(v) => set('backgroundRepeat', v)}
                />
              </>
            )}

            {draft.backgroundType === 'video' && (
              <VideoBackgroundField
                url={draft.backgroundVideoUrl}
                muted={draft.backgroundVideoMuted}
                start={draft.backgroundVideoStartSeconds}
                end={draft.backgroundVideoEndSeconds}
                uploading={uploadingField === 'backgroundVideo'}
                onUpload={(f) => handleUpload('backgroundVideo', f)}
                onClear={() => handleClearImage('backgroundVideo')}
                onChangeMuted={(v) => set('backgroundVideoMuted', v)}
                onChangeStart={(v) => set('backgroundVideoStartSeconds', v)}
                onChangeEnd={(v) => set('backgroundVideoEndSeconds', v)}
              />
            )}

            <ColorField label="Color de overlay" value={draft.overlayColor} onChange={(v) => set('overlayColor', v)} />
            <RangeField
              label={`Opacidad del overlay (${Math.round(draft.overlayOpacity * 100)}%)`}
              value={draft.overlayOpacity}
              onChange={(v) => set('overlayOpacity', v)}
            />
          </Section>

          <Section title="Colores">
            <div className="grid grid-cols-2 gap-4">
              <ColorField label="Principal" value={draft.colorPrimary} onChange={(v) => set('colorPrimary', v)} />
              <ColorField label="Secundario" value={draft.colorSecondary} onChange={(v) => set('colorSecondary', v)} />
              <ColorField label="Texto" value={draft.colorText} onChange={(v) => set('colorText', v)} />
              <ColorField
                label="Texto secundario"
                value={draft.colorTextSecondary}
                onChange={(v) => set('colorTextSecondary', v)}
              />
              <ColorField
                label="Fondo del formulario"
                value={draft.colorFormBg}
                onChange={(v) => set('colorFormBg', v)}
              />
              <RangeField
                label={`Opacidad del fondo del formulario (${Math.round(draft.colorFormBgOpacity * 100)}%)`}
                value={draft.colorFormBgOpacity}
                onChange={(v) => set('colorFormBgOpacity', v)}
              />
              <ColorField label="Botón" value={draft.colorButton} onChange={(v) => set('colorButton', v)} />
              <ColorField
                label="Botón (hover)"
                value={draft.colorButtonHover}
                onChange={(v) => set('colorButtonHover', v)}
              />
              <ColorField label="Error" value={draft.colorError} onChange={(v) => set('colorError', v)} />
              <ColorField label="Bordes" value={draft.colorBorder} onChange={(v) => set('colorBorder', v)} />
              <ColorField label="Fondo de inputs" value={draft.colorInputBg} onChange={(v) => set('colorInputBg', v)} />
            </div>
          </Section>

          <Section title="Formulario">
            <TextField label="Texto del botón" value={draft.buttonText} onChange={(v) => set('buttonText', v)} />
            <TextField
              label="Placeholder de usuario"
              value={draft.placeholderUsername}
              onChange={(v) => set('placeholderUsername', v)}
            />
            <TextField
              label="Placeholder de contraseña"
              value={draft.placeholderPassword}
              onChange={(v) => set('placeholderPassword', v)}
            />
          </Section>
        </div>

        <div className="lg:sticky lg:top-6 lg:self-start">
          <p className="mb-2 text-sm font-medium text-slate-600">Vista previa</p>
          <div className="overflow-hidden rounded-xl border border-slate-200 shadow-inner" style={{ height: 640 }}>
            <LoginVisual settings={draft} interactive={false} className="h-full" />
          </div>
        </div>
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg bg-white p-5 shadow">
      <h3 className="mb-4 text-base font-bold text-slate-900">{title}</h3>
      <div className="space-y-4">{children}</div>
    </div>
  )
}

function TextField({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-slate-700">{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
    </div>
  )
}

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-slate-700">{label}</label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-9 w-10 cursor-pointer rounded border border-slate-300 bg-white p-0.5"
        />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
    </div>
  )
}

function SelectField({
  label,
  value,
  options,
  optionLabels,
  onChange,
}: {
  label: string
  value: string
  options: string[]
  optionLabels?: Record<string, string>
  onChange: (v: string) => void
}) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-slate-700">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {optionLabels?.[opt] ?? opt}
          </option>
        ))}
      </select>
    </div>
  )
}

function RangeField({
  label,
  value,
  onChange,
}: {
  label: string
  value: number
  onChange: (v: number) => void
}) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-slate-700">{label}</label>
      <input
        type="range"
        min={0}
        max={1}
        step={0.05}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full"
      />
    </div>
  )
}

function ToggleField({
  label,
  checked,
  onChange,
}: {
  label: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 rounded border-slate-300"
      />
      {label}
    </label>
  )
}

function ImageUploadField({
  label,
  url,
  uploading,
  onUpload,
  onClear,
  accept = 'image/png,image/jpeg,image/webp,image/svg+xml',
  hint = 'PNG, JPG, WEBP o SVG. Máximo 2 MB.',
}: {
  label: string
  url: string | null
  uploading: boolean
  onUpload: (file: File) => void
  onClear: () => void
  accept?: string
  hint?: string
}) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-slate-700">{label}</label>
      <div className="flex items-center gap-3">
        {url ? (
          <img
            src={resolveAssetUrl(url)}
            alt={label}
            className="h-12 w-12 rounded border border-slate-200 object-contain bg-white"
          />
        ) : (
          <div className="flex h-12 w-12 items-center justify-center rounded border border-dashed border-slate-300 text-xs text-slate-400">
            Sin imagen
          </div>
        )}
        <input
          type="file"
          accept={accept}
          disabled={uploading}
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) onUpload(file)
            e.target.value = ''
          }}
          className="text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-sm file:font-medium hover:file:bg-slate-200"
        />
        {url && (
          <button
            type="button"
            onClick={onClear}
            className="text-sm text-red-600 hover:underline"
          >
            Quitar
          </button>
        )}
      </div>
      <p className="mt-1 text-xs text-slate-400">{hint}</p>
    </div>
  )
}

function VideoBackgroundField({
  url,
  muted,
  start,
  end,
  uploading,
  onUpload,
  onClear,
  onChangeMuted,
  onChangeStart,
  onChangeEnd,
}: {
  url: string | null
  muted: boolean
  start: number | null
  end: number | null
  uploading: boolean
  onUpload: (file: File) => void
  onClear: () => void
  onChangeMuted: (v: boolean) => void
  onChangeStart: (v: number) => void
  onChangeEnd: (v: number | null) => void
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [duration, setDuration] = useState<number | null>(null)

  const useCurrentTimeAs = (setter: (v: number) => void) => {
    if (videoRef.current) setter(Math.round(videoRef.current.currentTime * 100) / 100)
  }

  const previewTrim = () => {
    const video = videoRef.current
    if (!video) return
    video.currentTime = start ?? 0
    video.play().catch(() => {})
  }

  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-slate-700">Video de fondo</label>

      {url ? (
        <video
          ref={videoRef}
          src={resolveAssetUrl(url)}
          controls
          className="mb-2 w-full rounded-lg bg-black"
          onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
          onTimeUpdate={(e) => {
            if (end && e.currentTarget.currentTime >= end) e.currentTarget.pause()
          }}
        />
      ) : (
        <div className="mb-2 flex h-32 items-center justify-center rounded-lg border border-dashed border-slate-300 text-sm text-slate-400">
          Sin video
        </div>
      )}

      <div className="flex items-center gap-3">
        <input
          type="file"
          accept="video/mp4,video/webm"
          disabled={uploading}
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) onUpload(file)
            e.target.value = ''
          }}
          className="text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-sm file:font-medium hover:file:bg-slate-200"
        />
        {url && (
          <button type="button" onClick={onClear} className="text-sm text-red-600 hover:underline">
            Quitar
          </button>
        )}
      </div>
      <p className="mt-1 text-xs text-slate-400">MP4 o WEBM. Máximo 30 MB.</p>

      {url && (
        <div className="mt-3 space-y-3 rounded-lg border border-slate-200 p-3">
          <p className="text-sm font-medium text-slate-700">
            Recorte {duration ? `— duración total: ${duration.toFixed(1)}s` : ''}
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Inicio (segundos)</label>
              <div className="flex gap-2">
                <input
                  type="number"
                  min={0}
                  step={0.1}
                  value={start ?? 0}
                  onChange={(e) => onChangeStart(Number(e.target.value))}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  type="button"
                  onClick={() => useCurrentTimeAs(onChangeStart)}
                  className="whitespace-nowrap rounded-lg border border-slate-300 px-2 text-xs text-slate-600 hover:bg-slate-100"
                >
                  Usar actual
                </button>
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Fin (segundos, vacío = hasta el final)</label>
              <div className="flex gap-2">
                <input
                  type="number"
                  min={0}
                  step={0.1}
                  value={end ?? ''}
                  onChange={(e) => onChangeEnd(e.target.value === '' ? null : Number(e.target.value))}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  type="button"
                  onClick={() => useCurrentTimeAs((v) => onChangeEnd(v))}
                  className="whitespace-nowrap rounded-lg border border-slate-300 px-2 text-xs text-slate-600 hover:bg-slate-100"
                >
                  Usar actual
                </button>
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={previewTrim}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-100"
          >
            ▶ Probar recorte
          </button>

          <ToggleField
            label="Reproducir con audio (el visitante va a tener que activarlo con un clic — los navegadores no dejan hacerlo automático)"
            checked={!muted}
            onChange={(v) => onChangeMuted(!v)}
          />
        </div>
      )}
    </div>
  )
}
