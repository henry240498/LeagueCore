import { useEffect, useRef, useState, type CSSProperties, type FormEvent } from 'react'
import { resolveAssetUrl } from '../lib/assetUrl'
import type { LoginSettings } from '../types/loginSettings'

type LoginVisualProps = {
  settings: LoginSettings
  username?: string
  password?: string
  onUsernameChange?: (v: string) => void
  onPasswordChange?: (v: string) => void
  onSubmit?: (e: FormEvent) => void
  error?: string
  loading?: boolean
  /** true = pantalla real de login; false = vista previa dentro de Seguridad (no envía nada) */
  interactive?: boolean
  /** clase de altura del contenedor raíz: "min-h-svh" (página completa) o "h-full" (embebido en un panel con altura fija) */
  className?: string
}

/**
 * Convierte un color hex (#rgb o #rrggbb) + opacidad (0–1) a `rgba(...)`. Se usa para el fondo
 * del formulario en vez de la propiedad CSS `opacity`, que también desvanecería el texto y los
 * inputs de adentro — acá sólo se necesita transparentar el fondo de la tarjeta.
 */
function hexToRgba(hex: string, alpha: number): string {
  const clean = hex.replace('#', '')
  const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean
  const r = parseInt(full.slice(0, 2), 16)
  const g = parseInt(full.slice(2, 4), 16)
  const b = parseInt(full.slice(4, 6), 16)
  if ([r, g, b].some(Number.isNaN)) return hex
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

function EyeIcon({ off }: { off: boolean }) {
  return off ? (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3 3l18 18M10.6 10.6a2 2 0 002.8 2.8M9.9 5.1A9.8 9.8 0 0112 5c5 0 9 4.5 10 7-.4 1.1-1.2 2.4-2.3 3.6M6.6 6.6C4.5 8 3 10 2 12c1 2.5 5 7 10 7 1.3 0 2.5-.3 3.6-.8"
      />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7z" />
      <circle cx="12" cy="12" r="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/**
 * Los navegadores bloquean el autoplay de video CON sonido salvo que el usuario ya haya
 * interactuado con la página — no es opcional, es política de Chrome/Firefox/Safari. Por eso el
 * video siempre arranca muteado (autoplay confiable) y, si el admin configuró audio, se muestra
 * un botón para que el visitante lo active con un clic (eso sí cuenta como interacción real).
 */
function VideoBackground({ settings: s }: { settings: LoginSettings }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [unmuted, setUnmuted] = useState(false)
  const wantsAudio = !s.backgroundVideoMuted

  useEffect(() => {
    setUnmuted(false)
  }, [s.backgroundVideoUrl])

  const start = s.backgroundVideoStartSeconds ?? 0
  const end = s.backgroundVideoEndSeconds

  const seekToStart = (video: HTMLVideoElement) => {
    try {
      video.currentTime = start
    } catch {
      // el video puede no estar listo para buscar todavía; se ignora, loopea en el próximo tick
    }
  }

  return (
    <>
      <video
        key={s.backgroundVideoUrl}
        ref={videoRef}
        className="absolute inset-0 h-full w-full object-cover"
        src={resolveAssetUrl(s.backgroundVideoUrl) ?? undefined}
        autoPlay
        muted
        loop={!end}
        playsInline
        onLoadedMetadata={(e) => seekToStart(e.currentTarget)}
        onTimeUpdate={(e) => {
          if (end && e.currentTarget.currentTime >= end) seekToStart(e.currentTarget)
        }}
        onEnded={(e) => seekToStart(e.currentTarget)}
      />
      {wantsAudio && !unmuted && (
        <button
          type="button"
          onClick={() => {
            if (videoRef.current) {
              videoRef.current.muted = false
              videoRef.current.play().catch(() => {})
            }
            setUnmuted(true)
          }}
          className="absolute bottom-4 right-4 z-10 flex items-center gap-2 rounded-full bg-black/50 px-3 py-2 text-sm text-white backdrop-blur hover:bg-black/70"
        >
          🔇 Activar sonido
        </button>
      )}
    </>
  )
}

export default function LoginVisual({
  settings: s,
  username = '',
  password = '',
  onUsernameChange,
  onPasswordChange,
  onSubmit,
  error,
  loading,
  interactive = true,
  className = 'min-h-svh',
}: LoginVisualProps) {
  const [showPassword, setShowPassword] = useState(false)

  const isImageBg = s.backgroundType === 'image' && !!s.backgroundImageUrl
  const isVideoBg = s.backgroundType === 'video' && !!s.backgroundVideoUrl

  const pageStyle: CSSProperties = {
    backgroundColor: s.backgroundColor,
    backgroundImage: isImageBg ? `url(${resolveAssetUrl(s.backgroundImageUrl)})` : undefined,
    backgroundPosition: s.backgroundPosition,
    backgroundSize: s.backgroundSize,
    backgroundRepeat: s.backgroundRepeat as CSSProperties['backgroundRepeat'],
  }

  const overlayStyle: CSSProperties = {
    backgroundColor: s.overlayColor,
    opacity: s.overlayOpacity,
  }

  const cardStyle: CSSProperties = {
    backgroundColor: hexToRgba(s.colorFormBg, s.colorFormBgOpacity ?? 1),
  }
  const titleStyle: CSSProperties = { color: s.colorText }
  const subtitleStyle: CSSProperties = { color: s.colorTextSecondary }
  const labelStyle: CSSProperties = { color: s.colorText }
  const inputStyle: CSSProperties = {
    backgroundColor: s.colorInputBg,
    color: s.colorText,
    borderColor: s.colorBorder,
  }
  const buttonStyle: CSSProperties = { backgroundColor: s.colorButton, color: '#ffffff' }
  const errorStyle: CSSProperties = { color: s.colorError, borderColor: s.colorError }

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (interactive) onSubmit?.(e)
  }

  return (
    <div
      className={`relative flex items-center justify-center overflow-hidden px-4 py-10 ${className}`}
      style={pageStyle}
    >
      {isVideoBg && <VideoBackground settings={s} />}
      <div className="pointer-events-none absolute inset-0" style={overlayStyle} />

      <div
        className="relative z-10 w-full max-w-md rounded-xl p-6 shadow-2xl sm:p-8"
        style={cardStyle}
      >
        <div className="mb-7 text-center">
          {s.showLogo &&
            (s.logoLoginUrl ? (
              <img
                src={resolveAssetUrl(s.logoLoginUrl)}
                alt={s.systemName}
                className="mx-auto mb-3 h-14 w-auto object-contain"
              />
            ) : (
              <div className="mb-3 text-4xl" aria-hidden>
                ⚽
              </div>
            ))}
          <h1 className="text-2xl font-bold sm:text-3xl" style={titleStyle}>
            {s.title}
          </h1>
          {s.showSubtitle && (
            <p className="mt-1 text-sm sm:text-base" style={subtitleStyle}>
              {s.subtitle}
            </p>
          )}
          {s.showWelcomeMessage && (
            <p className="mt-3 text-sm font-medium" style={labelStyle}>
              {s.welcomeMessage}
            </p>
          )}
        </div>

        <form onSubmit={handleSubmit} noValidate={!interactive}>
          <div className="mb-4">
            <label htmlFor="login-username" className="mb-2 block text-sm font-medium" style={labelStyle}>
              Usuario
            </label>
            <input
              id="login-username"
              type="text"
              value={username}
              onChange={(e) => onUsernameChange?.(e.target.value)}
              placeholder={s.placeholderUsername}
              className="w-full rounded-lg border px-4 py-2.5 outline-none transition-shadow placeholder:opacity-60"
              style={inputStyle}
              onFocus={(e) => (e.currentTarget.style.boxShadow = `0 0 0 3px ${s.colorPrimary}33`)}
              onBlur={(e) => (e.currentTarget.style.boxShadow = 'none')}
              autoComplete="username"
              readOnly={!interactive}
              required={interactive}
            />
          </div>

          <div className="mb-5">
            <label htmlFor="login-password" className="mb-2 block text-sm font-medium" style={labelStyle}>
              Contraseña
            </label>
            <div className="relative">
              <input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => onPasswordChange?.(e.target.value)}
                placeholder={s.placeholderPassword}
                className="w-full rounded-lg border px-4 py-2.5 pr-11 outline-none transition-shadow placeholder:opacity-60"
                style={inputStyle}
                onFocus={(e) => (e.currentTarget.style.boxShadow = `0 0 0 3px ${s.colorPrimary}33`)}
                onBlur={(e) => (e.currentTarget.style.boxShadow = 'none')}
                autoComplete="current-password"
                readOnly={!interactive}
                required={interactive}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute inset-y-0 right-0 flex items-center px-3"
                style={{ color: s.colorTextSecondary }}
                aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                tabIndex={interactive ? 0 : -1}
              >
                <EyeIcon off={showPassword} />
              </button>
            </div>
          </div>

          {error && (
            <div
              className="mb-5 rounded-lg border px-4 py-3 text-sm"
              style={{ ...errorStyle, backgroundColor: `${s.colorError}1a` }}
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg py-2.5 font-medium transition disabled:opacity-50"
            style={buttonStyle}
            onMouseEnter={(e) => {
              if (!loading) e.currentTarget.style.backgroundColor = s.colorButtonHover
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = s.colorButton
            }}
          >
            {loading ? 'Iniciando sesión...' : s.buttonText}
          </button>
        </form>
      </div>
    </div>
  )
}
