import { useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ApiError, useAuth } from '../context/AuthContext'
import { api } from '../services/api'
import LoginSettingsPanel from './LoginSettingsPanel'
import ResearchPanel from './ResearchPanel'
import SessionsPanel from './SessionsPanel'
import UsersPanel from './UsersPanel'

type Tab = 'usuarios' | 'config-login' | 'cambiar' | 'resetear' | 'sesiones' | 'investigacion'
const VALID_TABS: Tab[] = ['usuarios', 'config-login', 'cambiar', 'resetear', 'sesiones', 'investigacion']

export default function SecurityPage() {
  const { user } = useAuth()
  const [searchParams] = useSearchParams()
  const initialTab = searchParams.get('tab')
  const [tab, setTab] = useState<Tab>(
    VALID_TABS.includes(initialTab as Tab) ? (initialTab as Tab) : 'usuarios',
  )
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  // El backend rechaza estas acciones igual (AdminOnlyGuard) — esto es sólo
  // para no mostrarle el formulario a alguien que no puede usarlo.
  if (user?.role !== 'admin') {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center sm:px-6">
        <h1 className="mb-2 text-2xl font-bold">Acceso denegado</h1>
        <p className="text-slate-600">No tenés permisos para acceder al módulo de Seguridad.</p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <h1 className="mb-6 text-2xl font-bold sm:text-3xl">🔐 Seguridad</h1>

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

      <div className="mb-6 flex gap-2 border-b border-slate-200 overflow-x-auto">
        <TabButton active={tab === 'usuarios'} onClick={() => setTab('usuarios')}>
          Usuarios
        </TabButton>
        <TabButton active={tab === 'config-login'} onClick={() => setTab('config-login')}>
          Configuración del Login
        </TabButton>
        <TabButton active={tab === 'cambiar'} onClick={() => setTab('cambiar')}>
          Cambiar contraseña
        </TabButton>
        <TabButton active={tab === 'resetear'} onClick={() => setTab('resetear')}>
          Resetear contraseña
        </TabButton>
        <TabButton active={tab === 'sesiones'} onClick={() => setTab('sesiones')}>
          Sesiones activas
        </TabButton>
        <TabButton active={tab === 'investigacion'} onClick={() => setTab('investigacion')}>
          Investigación histórica
        </TabButton>
      </div>

      {tab === 'usuarios' && <UsersPanel />}
      {tab === 'config-login' && <LoginSettingsPanel />}
      {tab === 'cambiar' && (
        <ChangePasswordForm onSuccess={setMessage} onError={setError} />
      )}
      {tab === 'resetear' && <ResetPasswordPanel onSuccess={setMessage} onError={setError} />}
      {tab === 'sesiones' && <SessionsPanel />}
      {tab === 'investigacion' && <ResearchPanel />}
    </div>
  )
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium ${
        active
          ? 'border-blue-600 text-blue-600'
          : 'border-transparent text-slate-500 hover:text-slate-700'
      }`}
    >
      {children}
    </button>
  )
}

function ChangePasswordForm({
  onSuccess,
  onError,
}: {
  onSuccess: (msg: string) => void
  onError: (msg: string) => void
}) {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    onSuccess('')
    onError('')

    if (newPassword !== confirmPassword) {
      onError('Las contraseñas no coinciden')
      return
    }

    setLoading(true)
    try {
      await api.post<{ message: string }>('/auth/change-password', {
        currentPassword,
        newPassword,
      })
      onSuccess('✅ Contraseña cambiada exitosamente')
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch (err) {
      onError(err instanceof ApiError ? err.message : 'Error al cambiar la contraseña')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="rounded-lg bg-white p-6 shadow">
      <h2 className="mb-4 text-lg font-bold">Cambiar tu contraseña</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field
          label="Contraseña actual"
          value={currentPassword}
          onChange={setCurrentPassword}
        />
        <Field label="Nueva contraseña" value={newPassword} onChange={setNewPassword} />
        <Field
          label="Confirmar nueva contraseña"
          value={confirmPassword}
          onChange={setConfirmPassword}
        />
        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-blue-600 px-6 py-2 font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? 'Cambiando...' : 'Cambiar contraseña'}
        </button>
      </form>
    </div>
  )
}

function ResetPasswordPanel({
  onSuccess,
  onError,
}: {
  onSuccess: (msg: string) => void
  onError: (msg: string) => void
}) {
  const { user, refreshUser } = useAuth()
  const [loading, setLoading] = useState(false)
  const [togglingPref, setTogglingPref] = useState(false)
  const forcePasswordChange = user?.forcePasswordChangeOnReset ?? false

  const handleReset = async () => {
    if (!window.confirm('¿Confirmás resetear tu contraseña a 123456?')) return
    onSuccess('')
    onError('')
    setLoading(true)
    try {
      await api.post<{ message: string }>('/auth/reset-password')
      onSuccess(
        forcePasswordChange
          ? '✅ Contraseña reseteada a 123456. Se pedirá cambiarla en el próximo login.'
          : '✅ Contraseña reseteada a 123456.',
      )
    } catch (err) {
      onError(err instanceof ApiError ? err.message : 'Error al resetear la contraseña')
    } finally {
      setLoading(false)
    }
  }

  const handleTogglePref = async (checked: boolean) => {
    onSuccess('')
    onError('')
    setTogglingPref(true)
    try {
      await api.patch('/auth/preferences', { forcePasswordChangeOnReset: checked })
      await refreshUser()
    } catch (err) {
      onError(err instanceof ApiError ? err.message : 'Error al actualizar la preferencia')
    } finally {
      setTogglingPref(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-lg bg-white p-6 shadow">
        <h2 className="mb-2 text-lg font-bold">Resetear contraseña</h2>
        <p className="mb-6 text-slate-600">
          Reseteará tu contraseña a <strong>123456</strong>.{' '}
          {forcePasswordChange
            ? 'Se pedirá cambiarla en el próximo inicio de sesión.'
            : 'No se pedirá cambiarla en el próximo inicio de sesión (según la preferencia actual).'}
        </p>
        <button
          type="button"
          onClick={handleReset}
          disabled={loading}
          className="rounded-lg bg-red-600 px-6 py-2 font-medium text-white hover:bg-red-700 disabled:opacity-50"
        >
          {loading ? 'Reseteando...' : 'Resetear contraseña'}
        </button>
      </div>

      <div className="rounded-lg bg-white p-6 shadow">
        <h2 className="mb-2 text-lg font-bold">Preferencia de cambio de contraseña</h2>
        <p className="mb-4 text-slate-600">
          ¿Solicitar cambio de contraseña al iniciar sesión la primera vez después de un
          reseteo?
        </p>
        <label className="flex items-center gap-3">
          <input
            type="checkbox"
            checked={forcePasswordChange}
            disabled={togglingPref}
            onChange={(e) => handleTogglePref(e.target.checked)}
            className="h-5 w-5 rounded border-slate-300"
          />
          <span className="text-sm font-medium">
            {forcePasswordChange ? 'Sí, solicitar cambio' : 'No, ir directo al login'}
          </span>
        </label>
      </div>
    </div>
  )
}

function Field({
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
      <label className="mb-2 block text-sm font-medium">{label}</label>
      <input
        type="password"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-slate-300 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
        required
      />
    </div>
  )
}
