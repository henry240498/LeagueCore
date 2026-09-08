import { useEffect, useState } from 'react'
import { ApiError, useAuth } from '../context/AuthContext'
import { api } from '../services/api'
import { ROLE_LABELS, type ManagedUser, type UserRole } from '../types/user'

type FormMode = { kind: 'create' } | { kind: 'view' | 'edit'; user: ManagedUser }

function relativeTime(iso: string | null): string {
  if (!iso) return 'Nunca'
  const diffMs = Date.now() - new Date(iso).getTime()
  const minutes = Math.round(diffMs / 60_000)
  if (minutes < 1) return 'hace instantes'
  if (minutes < 60) return `hace ${minutes} min`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `hace ${hours} h`
  const days = Math.round(hours / 24)
  return `hace ${days} d`
}

export default function UsersPanel() {
  const { user: currentUser } = useAuth()
  const [users, setUsers] = useState<ManagedUser[] | null>(null)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState<number | null>(null)
  const [form, setForm] = useState<FormMode | null>(null)

  const load = () => {
    api
      .get<ManagedUser[]>('/users')
      .then(setUsers)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Error al cargar los usuarios'))
  }

  useEffect(load, [])

  const isProtected = (u: ManagedUser) => u.username === 'admin'
  const isSelf = (u: ManagedUser) => u.id === currentUser?.id

  const handleToggleStatus = async (u: ManagedUser) => {
    const next = u.isActive ? 'inactive' : 'active'
    setMessage('')
    setError('')
    setBusyId(u.id)
    try {
      await api.patch(`/users/${u.id}/status`, { status: next })
      setMessage(u.isActive ? `✅ Usuario "${u.username}" desactivado` : `✅ Usuario "${u.username}" activado`)
      load()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Error al cambiar el estado')
    } finally {
      setBusyId(null)
    }
  }

  const handleResetPassword = async (u: ManagedUser) => {
    if (!window.confirm(`¿Restablecer la contraseña de "${u.username}" a 123456?`)) return
    setMessage('')
    setError('')
    setBusyId(u.id)
    try {
      await api.post(`/users/${u.id}/reset-password`)
      setMessage(`✅ Contraseña de "${u.username}" restablecida a 123456`)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Error al restablecer la contraseña')
    } finally {
      setBusyId(null)
    }
  }

  const handleDelete = async (u: ManagedUser) => {
    if (!window.confirm(`¿Eliminar el usuario "${u.username}"? Esta acción no se puede deshacer.`)) return
    setMessage('')
    setError('')
    setBusyId(u.id)
    try {
      await api.delete(`/users/${u.id}`)
      setMessage(`✅ Usuario "${u.username}" eliminado`)
      load()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Error al eliminar el usuario')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="rounded-lg bg-white p-6 shadow">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-bold">Usuarios</h2>
        <button
          type="button"
          onClick={() => setForm({ kind: 'create' })}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          + Crear usuario
        </button>
      </div>

      {message && (
        <div className="mb-4 rounded-lg border border-green-400 bg-green-100 px-4 py-3 text-sm text-green-700">
          {message}
        </div>
      )}
      {error && (
        <div className="mb-4 rounded-lg border border-red-400 bg-red-100 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {form && (
        <UserForm
          mode={form}
          onClose={() => setForm(null)}
          onSaved={(msg) => {
            setForm(null)
            setMessage(msg)
            load()
          }}
          onError={setError}
        />
      )}

      {!users && !error && <p className="text-slate-500">Cargando...</p>}

      {users && (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 text-slate-500">
              <tr>
                <th className="py-2 pr-4">Usuario</th>
                <th className="py-2 pr-4">Nombre</th>
                <th className="py-2 pr-4">Rol</th>
                <th className="py-2 pr-4">Estado</th>
                <th className="py-2 pr-4">Último acceso</th>
                <th className="py-2 pr-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.map((u) => (
                <tr key={u.id}>
                  <td className="py-2 pr-4 font-medium text-slate-900">{u.username}</td>
                  <td className="py-2 pr-4">{u.displayName ?? '—'}</td>
                  <td className="py-2 pr-4">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        u.role === 'admin' ? 'bg-purple-100 text-purple-700' : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {ROLE_LABELS[u.role]}
                    </span>
                  </td>
                  <td className="py-2 pr-4">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        u.isActive ? 'bg-green-100 text-green-700' : 'bg-slate-200 text-slate-600'
                      }`}
                    >
                      {u.isActive ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td className="py-2 pr-4 text-slate-500">{relativeTime(u.lastLogin)}</td>
                  <td className="py-2 pr-4">
                    <div className="flex flex-wrap justify-end gap-3 text-xs">
                      <button type="button" className="text-slate-600 hover:underline" onClick={() => setForm({ kind: 'view', user: u })}>
                        Ver
                      </button>
                      <button type="button" className="text-blue-600 hover:underline" onClick={() => setForm({ kind: 'edit', user: u })}>
                        Editar
                      </button>
                      <button
                        type="button"
                        disabled={busyId === u.id || (isProtected(u) && u.isActive) || (isSelf(u) && u.isActive)}
                        className="text-amber-700 hover:underline disabled:opacity-40"
                        onClick={() => handleToggleStatus(u)}
                        title={isProtected(u) && u.isActive ? 'El administrador principal no se puede desactivar' : isSelf(u) ? 'No podés desactivar tu propia cuenta' : ''}
                      >
                        {u.isActive ? 'Desactivar' : 'Activar'}
                      </button>
                      <button
                        type="button"
                        disabled={busyId === u.id}
                        className="text-slate-600 hover:underline disabled:opacity-40"
                        onClick={() => handleResetPassword(u)}
                      >
                        Restablecer contraseña
                      </button>
                      <button
                        type="button"
                        disabled={busyId === u.id || isProtected(u) || isSelf(u)}
                        className="text-red-600 hover:underline disabled:opacity-40"
                        onClick={() => handleDelete(u)}
                        title={isProtected(u) ? 'El administrador principal no se puede eliminar' : isSelf(u) ? 'No podés eliminar tu propia cuenta' : ''}
                      >
                        Eliminar
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function UserForm({
  mode,
  onClose,
  onSaved,
  onError,
}: {
  mode: FormMode
  onClose: () => void
  onSaved: (message: string) => void
  onError: (message: string) => void
}) {
  const existing = mode.kind !== 'create' ? mode.user : null
  const readOnly = mode.kind === 'view'
  const isProtectedAdmin = existing?.username === 'admin'

  const [username, setUsername] = useState(existing?.username ?? '')
  const [displayName, setDisplayName] = useState(existing?.displayName ?? '')
  const [email, setEmail] = useState(existing?.email ?? '')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [role, setRole] = useState<UserRole>(existing?.role ?? 'basico')
  const [isActive, setIsActive] = useState(existing?.isActive ?? true)
  const [saving, setSaving] = useState(false)
  const [localError, setLocalError] = useState('')

  const handleSubmit = async () => {
    setLocalError('')
    onError('')
    if (mode.kind === 'create') {
      if (!username.trim()) return setLocalError('El nombre de usuario es obligatorio')
      if (!password) return setLocalError('La contraseña es obligatoria')
      if (password !== confirmPassword) return setLocalError('Las contraseñas no coinciden')
    }
    if (mode.kind === 'edit' && newPassword && newPassword !== confirmPassword) {
      return setLocalError('Las contraseñas no coinciden')
    }

    setSaving(true)
    try {
      if (mode.kind === 'create') {
        await api.post('/users', {
          username: username.trim(),
          email: email.trim() || undefined,
          displayName: displayName.trim() || undefined,
          password,
          role,
          isActive,
        })
        onSaved(`✅ Usuario "${username}" creado`)
      } else {
        await api.put(`/users/${mode.user.id}`, {
          username: username.trim() !== mode.user.username ? username.trim() : undefined,
          email: email.trim() || undefined,
          displayName: displayName.trim() || undefined,
          role: role !== mode.user.role ? role : undefined,
        })
        if (newPassword) {
          await api.patch(`/users/${mode.user.id}/password`, { password: newPassword })
        }
        onSaved(`✅ Usuario "${mode.user.username}" actualizado`)
      }
    } catch (err) {
      setLocalError(err instanceof ApiError ? err.message : 'Error al guardar el usuario')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mb-6 rounded-lg border border-slate-200 bg-slate-50 p-4">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-bold text-slate-900">
          {mode.kind === 'create' ? 'Crear usuario' : mode.kind === 'view' ? 'Detalle del usuario' : 'Editar usuario'}
        </h3>
        <button type="button" onClick={onClose} className="text-sm text-slate-500 hover:underline">
          Cerrar
        </button>
      </div>

      {localError && <p className="mb-3 text-sm text-red-600">{localError}</p>}
      {isProtectedAdmin && mode.kind === 'edit' && (
        <p className="mb-3 text-xs text-amber-700">
          Este es el administrador principal: no se le puede cambiar el nombre de usuario ni el rol.
        </p>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Nombre de usuario" value={username} onChange={setUsername} disabled={readOnly || isProtectedAdmin} required />
        <Field label="Nombre" value={displayName} onChange={setDisplayName} disabled={readOnly} />
        <Field label="Correo electrónico" value={email} onChange={setEmail} disabled={readOnly} type="email" />

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Rol</label>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as UserRole)}
            disabled={readOnly || isProtectedAdmin}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm disabled:bg-slate-100"
          >
            <option value="admin">Administrador</option>
            <option value="basico">Básico</option>
          </select>
        </div>

        {mode.kind === 'create' && (
          <>
            <Field label="Contraseña" value={password} onChange={setPassword} disabled={readOnly} type="password" required />
            <Field label="Confirmar contraseña" value={confirmPassword} onChange={setConfirmPassword} disabled={readOnly} type="password" required />
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Estado</label>
              <select
                value={isActive ? 'active' : 'inactive'}
                onChange={(e) => setIsActive(e.target.value === 'active')}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
              >
                <option value="active">Activo</option>
                <option value="inactive">Inactivo</option>
              </select>
            </div>
          </>
        )}

        {mode.kind === 'edit' && (
          <>
            <Field label="Nueva contraseña (opcional)" value={newPassword} onChange={setNewPassword} type="password" />
            <Field label="Confirmar nueva contraseña" value={confirmPassword} onChange={setConfirmPassword} type="password" />
          </>
        )}

        {mode.kind === 'view' && (
          <>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Estado</label>
              <p className="text-sm text-slate-900">{existing?.isActive ? 'Activo' : 'Inactivo'}</p>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Último acceso</label>
              <p className="text-sm text-slate-900">{relativeTime(existing?.lastLogin ?? null)}</p>
            </div>
          </>
        )}
      </div>

      {!readOnly && (
        <button
          type="button"
          onClick={handleSubmit}
          disabled={saving}
          className="mt-4 rounded-lg bg-blue-600 px-6 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? 'Guardando...' : 'Guardar'}
        </button>
      )}
    </div>
  )
}

function Field({
  label,
  value,
  onChange,
  disabled,
  required,
  type = 'text',
}: {
  label: string
  value: string
  onChange: (v: string) => void
  disabled?: boolean
  required?: boolean
  type?: string
}) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-slate-700">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        required={required}
        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm disabled:bg-slate-100"
      />
    </div>
  )
}
