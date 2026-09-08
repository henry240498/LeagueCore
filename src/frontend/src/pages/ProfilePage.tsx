import { useAuth } from '../context/AuthContext'
import { ROLE_LABELS, type UserRole } from '../types/user'

export default function ProfilePage() {
  const { user } = useAuth()

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
      <h1 className="mb-6 text-2xl font-bold sm:text-3xl">👤 Mi perfil</h1>
      <div className="rounded-lg bg-white p-6 shadow">
        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-sm text-slate-500">Usuario</dt>
            <dd className="text-base font-medium text-slate-900">{user?.username}</dd>
          </div>
          <div>
            <dt className="text-sm text-slate-500">Nombre</dt>
            <dd className="text-base font-medium text-slate-900">{user?.displayName ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-sm text-slate-500">Email</dt>
            <dd className="text-base font-medium text-slate-900">{user?.email ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-sm text-slate-500">Rol</dt>
            <dd className="text-base font-medium text-slate-900">
              {user ? (ROLE_LABELS[user.role as UserRole] ?? user.role) : '—'}
            </dd>
          </div>
        </dl>
      </div>
    </div>
  )
}
